"""Täyttää tietokannan testidatalla, jolla dashboardin kaikki näkymät saa näkyviin.

Oletuksilla syntyy (~1000 mittausta + 4 linjatulosta per mittaus):
  - 30 vrk historiaa tunnin välein, viimeinen vuorokausi 5 min välein -> 24 h / 7 pv / 30 pv kaaviot
  - liikejaksot linjoittain (1–2 TX-linjaa kerrallaan), lähinnä klo 7–22 Suomen aikaa
    -> presenssin aikajana, viimeisimmät havainnot, "Linjat nyt"
  - lämpötila, kosteus ja paine vaihtelevat vuorokauden ja "sään" mukaan
  - 2 katkosta (laite offline 1–3 h, toinen viimeisellä vuorokaudella) ja satunnaisia uudelleenkäynnistyksiä
    -> aukot kaavioissa ja aikajanalla, käyttöaika nollautuu

Skenaariot:
  --end occupied | empty     viimeiset 15 min liikettä ("Jatkuu") / huone tyhjä (oletus: satunnainen)
  --missing humidity,...     sensorit, jotka eivät lähetä arvoa -> "Sensorien tila" näyttää Vika
  --missing all              kuten nykyinen RX-firmis ilman BMP280:tä: vain linjat, RSSI ja käyttöaika
  --tx 0                     ei linjakohtaista dataa (vain huoneen motion)
  --live [S]                 jatkaa simulointia ja lähettää S s välein (oletus 30) mittauksen backendin
                             POST /readings -rajapintaan kuten RX-hubi -> "Yhdistetty" ja nykytila päivittyvät.
                             Pysäytys Ctrl+C.

Huom: ilman --live dataa ei tule lisää, joten laite näkyy offline-tilassa 90 s jälkeen
ja 24 h näkymät tyhjenevät vuorokauden kuluttua. Aja seed silloin uudelleen.

Ajetaan backend-kontissa (projektin juuresta):
    docker compose exec backend python tools/seed_db.py --clear                  # tyhjentää taulut ensin
    docker compose exec backend python tools/seed_db.py --clear --live           # + live-data perään
    docker compose exec backend python tools/seed_db.py --clear --end occupied --missing humidity
    docker compose exec backend python tools/seed_db.py --days 0 --live 5 --activity 5   # pelkkä live, paljon liikettä
"""

import argparse
import json
import math
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from psycopg2.extras import execute_values

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from db import get_cursor, init_schema  # noqa: E402

# Kontin kello on UTC; päivä/yö-rytmi lasketaan Suomen ajassa (kesäaika huomioiden)
try:
    from zoneinfo import ZoneInfo

    LOCAL_TZ = ZoneInfo("Europe/Helsinki")
except Exception:  # tzdata puuttuu
    LOCAL_TZ = timezone(timedelta(hours=2))

DAY = 2 * math.pi / 24
SENSORS = ("temperature", "humidity", "pressure")
ROW_KEYS = ("time", "device_id", *SENSORS, "motion", "rssi", "uptime_s")
END_WINDOW = timedelta(minutes=15)
REBOOT_EVERY_MIN = 7 * 24 * 60  # keskimäärin kerran viikossa


def timestamps(days, step_min, recent_step_min, now):
    """Harva historia vanhemmalle ajalle, tiheä data viimeiselle vuorokaudelle."""
    start = now - timedelta(days=days)
    recent_start = max(start, now - timedelta(days=1))
    result = []
    ts = start
    while ts < recent_start:
        result.append(ts)
        ts += timedelta(minutes=step_min)
    ts = recent_start
    while ts <= now:
        result.append(ts)
        ts += timedelta(minutes=recent_step_min)
    return result


def make_gaps(count, start, now):
    """1–3 h katkokset, joiden aikana laite ei lähetä. Ensimmäinen osuu viimeiselle vuorokaudelle,
    jotta se näkyy 24 h näkymässä. Viimeiset 2 h pidetään ehjinä."""
    gaps = []
    for i in range(count):
        length = timedelta(minutes=random.randint(60, 180))
        lo = max(start, now - timedelta(days=1)) if i == 0 else start
        hi = now - timedelta(hours=2) - length
        if hi > lo:
            begin = lo + (hi - lo) * random.random()
            gaps.append((begin, begin + length))
    return sorted(gaps)


class Simulator:
    """RX-hubin tila: liikejaksot, käynnistyshetki ja Wi-Fi-signaali. Sama malli tuottaa historian ja live-datan."""

    def __init__(self, device_id, tx_count, missing, activity):
        self.device_id = device_id
        self.tx_count = tx_count
        self.missing = missing
        self.activity = activity
        self.motion = False
        self.active_tx = set()
        self.boot = None
        self.prev = None
        self.rssi = -56.0

    def reboot(self, ts):
        self.boot = ts - timedelta(seconds=random.randint(5, 60))

    def _start_motion(self):
        # Uusi liikejakso: 1–2 linjaa, joiden alueella henkilö liikkuu
        self.motion = True
        if self.tx_count:
            k = min(self.tx_count, random.randint(1, 2))
            self.active_tx = set(random.sample(range(1, self.tx_count + 1), k=k))

    def step(self, ts, force_motion=None):
        # Todennäköisyydet skaalataan mittausvälin mukaan, jotta tiheä ja harva data käyttäytyvät samoin
        step_min = (ts - self.prev).total_seconds() / 60 if self.prev else 5
        self.prev = ts
        local = ts.astimezone(LOCAL_TZ)
        hour = local.hour + local.minute / 60
        days = ts.timestamp() / 86400

        if self.boot is None:
            self.boot = ts - timedelta(hours=random.uniform(1, 72))
        elif random.random() < 1 - math.exp(-step_min / REBOOT_EVERY_MIN):
            self.reboot(ts)

        # Liike alkaa todennäköisemmin päivällä ja kestää tyypillisesti 10–30 min
        if force_motion is not None:
            if force_motion and not self.motion:
                self._start_motion()
            self.motion = force_motion
        elif self.motion:
            self.motion = random.random() < math.exp(-step_min / 15)
        else:
            per_hour = (0.6 if 7 <= local.hour <= 22 else 0.05) * self.activity
            if random.random() < 1 - math.exp(-per_hour * step_min / 60):
                self._start_motion()

        # Linjakohtaiset tulokset: liikkeen aikana vain osa linjoista havaitsee.
        # Varianssit ovat RX-firmiksen kynnysarvon (3.5) eri puolilla.
        links = []
        for tx in range(1, self.tx_count + 1):
            presence = self.motion and tx in self.active_tx
            variance = random.uniform(4.0, 8.0) if presence else random.uniform(0.8, 2.8)
            links.append({"tx_id": tx, "variance": round(variance, 2), "presence": presence})

        # Signaali vaeltaa hitaasti -56 dBm:n ympärillä
        self.rssi += random.gauss(0, 1.2) + (-56 - self.rssi) * 0.15
        self.rssi = min(-40.0, max(-85.0, self.rssi))

        # Lämpötila huipussaan iltapäivällä, kosteus aamuyöllä; paine vaihtelee usean päivän jaksoissa.
        # Ihmisen läsnäolo nostaa lämpöä ja kosteutta hieman.
        occupied = 1 if self.motion else 0
        reading = {
            "time": ts,
            "device_id": self.device_id,
            "temperature": round(21.8 + 1.3 * math.sin((hour - 10) * DAY) + 0.8 * math.sin(days * 2 * math.pi / 9)
                                 + 0.3 * occupied + random.gauss(0, 0.1), 1),
            "humidity": round(45 + 3 * math.sin((hour + 2) * DAY) + 6 * math.sin(days * 2 * math.pi / 12)
                              + 1.0 * occupied + random.gauss(0, 0.5), 1),
            "pressure": round(1010.5 + 5 * math.sin(days * 2 * math.pi / 5) + 2 * math.sin(days * 2 * math.pi / 2.3)
                              + random.gauss(0, 0.1), 1),
            "motion": self.motion,
            "rssi": round(self.rssi),
            "uptime_s": int((ts - self.boot).total_seconds()),
            "links": links,
        }
        for key in self.missing:
            reading[key] = None
        return reading


def seed_history(sim, times, gaps, end, now):
    """Generoi historian ja palauttaa (readings-rivit, link_readings-rivit)."""
    rows, link_rows = [], []
    in_gap = False
    for ts in times:
        if any(a <= ts < b for a, b in gaps):
            in_gap = True
            continue
        if in_gap:
            sim.reboot(ts)  # laite käynnistyi uudelleen katkoksen jälkeen
            in_gap = False
        force = None
        if end != "random" and ts >= now - END_WINDOW:
            force = end == "occupied"
        r = sim.step(ts, force)
        rows.append(tuple(r[k] for k in ROW_KEYS))
        link_rows += [(ts, r["device_id"], link["tx_id"], link["variance"], link["presence"]) for link in r["links"]]
    return rows, link_rows


def run_live(sim, interval, api_url):
    """Lähettää mittauksen backendiin interval sekunnin välein, kuten RX-hubi. Pysäytys Ctrl+C."""
    url = api_url.rstrip("/") + "/readings"
    headers = {"Content-Type": "application/json"}
    if os.getenv("DEVICE_API_KEY"):
        headers["X-API-Key"] = os.environ["DEVICE_API_KEY"]
    print(f"Live-simulointi: POST {url} {interval:g} s välein (Ctrl+C lopettaa)")
    try:
        while True:
            r = sim.step(datetime.now(timezone.utc))
            payload = {k: r[k] for k in ("device_id", *SENSORS, "rssi", "uptime_s")}
            # Kuten RX-hubi: motion päätellään backendissä linjoista, jos niitä on
            if r["links"]:
                payload["links"] = r["links"]
            else:
                payload["motion"] = r["motion"]
            req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
            clock = r["time"].astimezone(LOCAL_TZ).strftime("%H:%M:%S")
            active = [link["tx_id"] for link in r["links"] if link["presence"]]
            try:
                with urllib.request.urlopen(req, timeout=10):
                    pass
                state = f"liikettä (TX {', '.join(map(str, active))})" if active else ("liikettä" if r["motion"] else "tyhjä")
                print(f"  {clock}  {state}")
            except urllib.error.HTTPError as e:
                print(f"  {clock}  virhe {e.code}: {e.read().decode(errors='replace')}")
            except urllib.error.URLError as e:
                print(f"  {clock}  backend ei vastaa: {e.reason}")
            time.sleep(interval)
    except KeyboardInterrupt:
        print("Live-simulointi lopetettu.")


def parse_missing(value):
    if not value:
        return ()
    names = SENSORS if value == "all" else tuple(v.strip() for v in value.split(","))
    unknown = set(names) - set(SENSORS)
    if unknown:
        raise argparse.ArgumentTypeError(f"tuntematon sensori: {', '.join(sorted(unknown))} (sallitut: {', '.join(SENSORS)}, all)")
    return names


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--days", type=float, default=30, help="historian pituus vuorokausina, 0 = ei historiaa (oletus 30)")
    p.add_argument("--step", type=float, default=60, help="historian mittausväli minuutteina (oletus 60)")
    p.add_argument("--recent-step", type=float, default=5, help="viimeisen vuorokauden mittausväli minuutteina (oletus 5)")
    p.add_argument("--device", default="RX_S3_HUB", help="RX-hubin tunniste (oletus RX_S3_HUB)")
    p.add_argument("--tx", type=int, default=4, help="TX-laitteiden määrä, 0 = ei linjadataa (oletus 4)")
    p.add_argument("--gaps", type=int, default=2, help="katkosten määrä historiassa (oletus 2)")
    p.add_argument("--end", choices=["random", "occupied", "empty"], default="random",
                   help="liiketila viimeisen 15 min ajalta (oletus random)")
    p.add_argument("--missing", type=parse_missing, default=(), metavar="SENSORIT",
                   help="pilkuilla erotetut sensorit ilman arvoa (temperature,humidity,pressure tai all)")
    p.add_argument("--activity", type=float, default=1.0, help="liikejaksojen yleisyys kertoimena (oletus 1)")
    p.add_argument("--live", type=float, nargs="?", const=30, metavar="S",
                   help="jatka live-simulointia S s välein backendin kautta (oletus 30)")
    p.add_argument("--api-url", default="http://localhost:8000", help="backendin osoite live-tilassa")
    p.add_argument("--seed", type=int, help="satunnaislukusiemen toistettavaa dataa varten")
    p.add_argument("--clear", action="store_true", help="tyhjennä taulut ennen täyttöä")
    args = p.parse_args()

    if args.seed is not None:
        random.seed(args.seed)
    init_schema()
    sim = Simulator(args.device, args.tx, args.missing, args.activity)

    if args.clear:
        with get_cursor() as cur:
            cur.execute("TRUNCATE readings, link_readings")
        print("Taulut tyhjennetty.")

    if args.days > 0:
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=args.days)
        gaps = make_gaps(args.gaps, start, now)
        rows, link_rows = seed_history(sim, timestamps(args.days, args.step, args.recent_step, now), gaps, args.end, now)
        with get_cursor() as cur:
            execute_values(cur, f"INSERT INTO readings ({', '.join(ROW_KEYS)}) VALUES %s", rows)
            if link_rows:
                execute_values(
                    cur,
                    "INSERT INTO link_readings (time, device_id, tx_id, variance, presence) VALUES %s",
                    link_rows,
                )

        fmt = lambda ts: ts.astimezone(LOCAL_TZ).strftime("%d.%m. %H:%M")  # noqa: E731
        recent = sum(1 for r in rows if r[0] >= now - timedelta(days=1))
        print(f"Lisätty {len(rows)} mittausta ({args.days:g} vrk, joista {recent} viimeiseltä vuorokaudelta) "
              f"ja {len(link_rows)} linjatulosta ({args.tx} TX-laitetta).")
        for a, b in gaps:
            print(f"  Katkos {fmt(a)} – {fmt(b)}")
        print(f"  Viimeisin mittaus {fmt(rows[-1][0])}: {'liikettä' if rows[-1][5] else 'ei liikettä'}"
              + (f", ei arvoa: {', '.join(args.missing)}" if args.missing else ""))

    if args.live:
        run_live(sim, args.live, args.api_url)
