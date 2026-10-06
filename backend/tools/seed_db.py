"""Täyttää readings-taulun testidatalla, joka päättyy nykyhetkeen.

Oletuksena (~1000 riviä):
  - 30 vrk historiaa tunnin välein   -> 7 pv ja 30 pv näkymät
  - viimeinen vuorokausi 5 min välein -> 24 h näkymä ja presenssin havainnot

Ajetaan backend-kontissa (projektin juuresta):
    docker compose exec backend python tools/seed_db.py
    docker compose exec backend python tools/seed_db.py --clear              # tyhjentää taulun ensin
    docker compose exec backend python tools/seed_db.py --days 7 --step 30 --recent-step 2
"""

import argparse
import math
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from psycopg2.extras import execute_values

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from db import get_cursor, init_schema  # noqa: E402

DAY = 2 * math.pi / 24
# Kontin kello on UTC; päivä/yö-rytmi lasketaan Suomen ajassa
LOCAL_OFFSET = timedelta(hours=3)


def timestamps(days, step_min, recent_step_min):
    """Harva historia vanhemmalle ajalle, tiheä data viimeiselle vuorokaudelle."""
    now = datetime.now(timezone.utc)
    recent_start = now - timedelta(days=1)
    result = []
    ts = now - timedelta(days=days)
    while ts < recent_start:
        result.append(ts)
        ts += timedelta(minutes=step_min)
    ts = recent_start
    while ts <= now:
        result.append(ts)
        ts += timedelta(minutes=recent_step_min)
    return result


def make_rows(device_id, times):
    start = times[0]
    motion = False
    prev = None
    rows = []
    for ts in times:
        h = ts.timestamp() / 3600

        # Liike alkaa todennäköisemmin päivällä ja kestää tyypillisesti 10–30 min.
        # Todennäköisyydet skaalataan mittausvälin mukaan, jotta tiheä ja harva data käyttäytyvät samoin.
        step_min = (ts - prev).total_seconds() / 60 if prev else 5
        prev = ts
        daytime = 7 <= (ts + LOCAL_OFFSET).hour <= 22
        if motion:
            motion = random.random() < math.exp(-step_min / 15)
        else:
            per_hour = 0.6 if daytime else 0.05
            motion = random.random() < 1 - math.exp(-per_hour * step_min / 60)

        rows.append((
            ts,
            device_id,
            round(22 + 1.3 * math.sin(h * DAY - 2) + 1.2 * math.sin(h * DAY / 10) + random.gauss(0, 0.1), 1),
            round(45 + 3 * math.sin(h * DAY + 0.5) + 6 * math.sin(h * DAY / 12) + random.gauss(0, 0.5), 1),
            round(1010.5 + 3 * math.sin(h * DAY / 6) + 1.8 * math.sin(h / 16) + random.gauss(0, 0.1), 1),
            motion,
            random.randint(-62, -50),
            int((ts - start).total_seconds()),
        ))
    return rows


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--days", type=float, default=30, help="historian pituus vuorokausina (oletus 30)")
    p.add_argument("--step", type=float, default=60, help="historian mittausväli minuutteina (oletus 60)")
    p.add_argument("--recent-step", type=float, default=5, help="viimeisen vuorokauden mittausväli minuutteina (oletus 5)")
    p.add_argument("--device", default="esp32-1", help="laitteen tunniste")
    p.add_argument("--clear", action="store_true", help="tyhjennä readings-taulu ennen täyttöä")
    args = p.parse_args()

    init_schema()
    rows = make_rows(args.device, timestamps(args.days, args.step, args.recent_step))
    with get_cursor() as cur:
        if args.clear:
            cur.execute("TRUNCATE readings")
        execute_values(
            cur,
            "INSERT INTO readings (time, device_id, temperature, humidity, pressure, motion, rssi, uptime_s) VALUES %s",
            rows,
        )
    recent = sum(1 for r in rows if r[0] >= rows[-1][0] - timedelta(days=1))
    print(f"Lisätty {len(rows)} riviä ({args.days:g} vrk), joista {recent} viimeiseltä vuorokaudelta.")
