import os
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor

SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    time        TIMESTAMPTZ      NOT NULL DEFAULT now(),
    device_id   TEXT             NOT NULL,
    temperature DOUBLE PRECISION,
    humidity    DOUBLE PRECISION,
    pressure    DOUBLE PRECISION,
    motion      BOOLEAN,
    rssi        INTEGER,
    uptime_s    BIGINT
);
SELECT create_hypertable('readings', by_range('time'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS readings_device_time_idx ON readings (device_id, time DESC);
"""


@contextmanager
def get_cursor():
    """Avaa yhteyden ja palauttaa kursorin, joka antaa rivit dict-muodossa.
    Commit tehdään automaattisesti, jos lohko päättyy ilman virhettä."""
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        with conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
    finally:
        conn.close()


def init_schema():
    """Luo taulut, jos niitä ei vielä ole. Ajetaan backendin käynnistyessä."""
    with get_cursor() as cur:
        cur.execute(SCHEMA)
