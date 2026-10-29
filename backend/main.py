import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal

import psycopg2
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import execute_values

from db import get_cursor, init_schema
from models import ReadingIn

from dotenv import load_dotenv

load_dotenv()

# Jos laite on ollut hiljaa tätä pidempään, se näytetään offline-tilassa (3 väliin jäänyttä 30 s lähetystä)
ONLINE_THRESHOLD_S = 90

# Aikaväli -> (kuinka pitkältä ajalta, minkä kokoisiin jaksoihin keskiarvot lasketaan)
RANGES = {
    "24h": ("24 hours", "30 minutes"),
    "7d": ("7 days", "2 hours"),
    "30d": ("30 days", "6 hours"),
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_schema()
    yield


app = FastAPI(title="Seurantasovellus API", lifespan=lifespan)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins],
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_device_key(
    x_api_key: str | None = Header(default=None),
    x_device_key: str | None = Header(default=None),
):
    """Jos DEVICE_API_KEY on asetettu .env:iin, laitteen pitää lähettää se X-API-Key- tai X-Device-Key-headerissa."""
    expected = os.getenv("DEVICE_API_KEY")
    key = x_api_key or x_device_key
    if expected and key != expected:
        raise HTTPException(status_code=401, detail="Virheellinen tai puuttuva API-avain")


@app.get("/status")
def get_status():
    """Testiendpoint: kertoo että backend toimii ja saa yhteyden tietokantaan."""
    try:
        with get_cursor() as cur:
            cur.execute("SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'")
            row = cur.fetchone()
        database = f"ok (TimescaleDB {row['extversion']})" if row else "ok (ei TimescaleDB:tä)"
    except psycopg2.Error as e:
        database = f"virhe: {e}"
    return {"backend": "ok", "database": database}


@app.post("/readings", status_code=201, dependencies=[Depends(verify_device_key)])
def create_reading(reading: ReadingIn):
    """RX-hubi lähettää tähän mittauksen 30 s välein (ja heti, kun presenssin tila muuttuu).
    Linjakohtaiset tulokset tallennetaan link_readings-tauluun samalla aikaleimalla."""
    data = reading.model_dump(exclude={"links"})
    data["motion"] = reading.room_motion()
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO readings (device_id, temperature, humidity, pressure, motion, rssi, uptime_s)
            VALUES (%(device_id)s, %(temperature)s, %(humidity)s,
                    %(pressure)s, %(motion)s, %(rssi)s, %(uptime_s)s)
            RETURNING time
            """,
            data,
        )
        time = cur.fetchone()["time"]
        if reading.links:
            execute_values(
                cur,
                "INSERT INTO link_readings (time, device_id, tx_id, variance, presence) VALUES %s",
                [(time, reading.device_id, link.tx_id, link.variance, link.presence) for link in reading.links],
            )
        return {"time": time}


@app.get("/readings/latest")
def get_latest_reading(device_id: str | None = None):
    """Uusin mittaus + tieto siitä, onko laite yhteydessä. Frontti hakee tätä 10 s välein."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT *, EXTRACT(EPOCH FROM now() - time)::int AS age_s
            FROM readings
            WHERE %(device_id)s::text IS NULL OR device_id = %(device_id)s
            ORDER BY time DESC
            LIMIT 1
            """,
            {"device_id": device_id},
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Mittauksia ei vielä ole")
        cur.execute(
            """
            SELECT tx_id, variance, presence FROM link_readings
            WHERE device_id = %(device_id)s AND time = %(time)s
            ORDER BY tx_id
            """,
            row,
        )
        links = cur.fetchall()
    return {**row, "links": links, "online": row["age_s"] <= ONLINE_THRESHOLD_S}


@app.get("/readings")
def get_readings(
    range: Literal["24h", "7d", "30d"] = "24h",
    device_id: str | None = None,
):
    """Kaavioiden data: keskiarvot tasaisin aikavälein (24h: 30 min, 7d: 2 h, 30d: 6 h).
    motion = oliko jakson aikana liikettä."""
    span, bucket = RANGES[range]
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT time_bucket(%(bucket)s::interval, time) AS time,
                   round(avg(temperature)::numeric, 1)::float AS temperature,
                   round(avg(humidity)::numeric, 1)::float AS humidity,
                   round(avg(pressure)::numeric, 1)::float AS pressure,
                   bool_or(motion) AS motion
            FROM readings
            WHERE time > now() - %(span)s::interval
              AND (%(device_id)s::text IS NULL OR device_id = %(device_id)s)
            GROUP BY 1
            ORDER BY 1
            """,
            {"bucket": bucket, "span": span, "device_id": device_id},
        )
        return cur.fetchall()


@app.get("/presence/timeline")
def get_presence_timeline(
    range: Literal["24h", "7d", "30d"] = "24h",
    device_id: str | None = None,
):
    """Linjakohtainen aikajana: jokaiselle jaksolle ja TX-laitteelle tieto, havaitsiko linja liikettä.
    Jaksot ovat samat kuin /readings-endpointissa, joten aikaleimat täsmäävät."""
    span, bucket = RANGES[range]
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT time_bucket(%(bucket)s::interval, time) AS time,
                   tx_id,
                   bool_or(presence) AS presence,
                   round(max(variance)::numeric, 2)::float AS max_variance
            FROM link_readings
            WHERE time > now() - %(span)s::interval
              AND (%(device_id)s::text IS NULL OR device_id = %(device_id)s)
            GROUP BY 1, 2
            ORDER BY 1, 2
            """,
            {"bucket": bucket, "span": span, "device_id": device_id},
        )
        return cur.fetchall()


@app.get("/presence/recent")
def get_recent_presence(device_id: str | None = None, limit: int = Query(default=5, ge=1, le=50)):
    """Viimeisen 24 h liikejaksot uusin ensin. Jakso alkaa ensimmäisestä motion=true-mittauksesta
    ja päättyy ensimmäiseen sen jälkeiseen motion=false-mittaukseen."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT time, motion FROM readings
            WHERE time > now() - interval '24 hours'
              AND motion IS NOT NULL
              AND (%(device_id)s::text IS NULL OR device_id = %(device_id)s)
            ORDER BY time
            """,
            {"device_id": device_id},
        )
        rows = cur.fetchall()

    periods = []
    start = None
    for row in rows:
        if row["motion"] and start is None:
            start = row["time"]
        elif not row["motion"] and start is not None:
            periods.append((start, row["time"]))
            start = None
    if start is not None:
        periods.append((start, None))  # liike jatkuu edelleen

    now = datetime.now(timezone.utc)
    result = []
    with get_cursor() as cur:
        for s, e in reversed(periods[-limit:]):
            # Mitkä TX-linjat havaitsivat liikettä jakson aikana
            cur.execute(
                """
                SELECT DISTINCT tx_id FROM link_readings
                WHERE presence
                  AND time >= %(start)s AND time < %(end)s
                  AND (%(device_id)s::text IS NULL OR device_id = %(device_id)s)
                ORDER BY tx_id
                """,
                {"start": s, "end": e or now, "device_id": device_id},
            )
            result.append({
                "start": s,
                "end": e,
                "duration_s": int(((e or now) - s).total_seconds()),
                "ongoing": e is None,
                "tx_ids": [r["tx_id"] for r in cur.fetchall()],
            })
    return result