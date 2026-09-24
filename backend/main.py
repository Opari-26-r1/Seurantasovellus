import os

import psycopg2
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Seurantasovellus API")

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/status")
def get_status():
    """Testiendpoint: kertoo että backend toimii ja saa yhteyden tietokantaan."""
    try:
        with psycopg2.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'"
            )
            row = cur.fetchone()
        database = f"ok (TimescaleDB {row[0]})" if row else "ok (ei TimescaleDB:tä)"
    except psycopg2.Error as e:
        database = f"virhe: {e}"
    return {"backend": "ok", "database": database}
