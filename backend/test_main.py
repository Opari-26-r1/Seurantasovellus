from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

def test_status_valid():
    response = client.get("/status")

    assert response.status_code == 200
    
    data = response.json()
    assert data["backend"] == "ok"
    assert "database" in data

def test_readings():
    response = client.get("/readings/latest")

    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "Mittauksia ei vielä ole"

def test_readings_range():
    response = client.get("/readings")

    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0

def test_create_reading():
    reading = {
        "device_id": "test_device",
        "temperature": 25.5,
        "humidity": 50.0,
        "pressure": 1013.25,
        "motion": True,
        "rssi": -70,
        "uptime_s": 3600
    }
    response = client.post("/readings", json=reading)

    assert response.status_code == 201
    data = response.json()
    assert "time" in data

def test_create_reading_invalid_type():
    reading = {
        "device_id": "test_device",
        "temperature": "invalid",
        "humidity": 50.0,
        "pressure": 1013.25,
        "motion": True,
        "rssi": -70,
        "uptime_s": 3600
    }
    response = client.post("/readings", json=reading)

    assert response.status_code == 422

def test_create_reading_invalid_motion():
    reading = {
        "device_id": "test_device",
        "temperature": 25.5,
        "humidity": 50.0,
        "pressure": 1013.25,
        "motion": "invalid",
        "rssi": -70,
        "uptime_s": 3600
    }
    response = client.post("/readings", json=reading)

    assert response.status_code == 422

def test_create_reading_invalid_rssi():
    reading = {
        "device_id": "test_device",
        "temperature": 25.5,
        "humidity": 50.0,
        "pressure": 1013.25,
        "motion": True,
        "rssi": "invalid",
        "uptime_s": 3600
    }
    response = client.post("/readings", json=reading)

    assert response.status_code == 422

def test_create_reading_invalid_uptime():
    reading = {
        "device_id": "test_device",
        "temperature": 25.5,
        "humidity": 50.0,
        "pressure": 1013.25,
        "motion": True,
        "rssi": -70,
        "uptime_s": "invalid"
    }
    response = client.post("/readings", json=reading)

    assert response.status_code == 422

def test_create_reading_invalid_device_id():
    reading = {
        "device_id": None,
        "temperature": 25.5,
        "humidity": 50.0,
        "pressure": 1013.25,
        "motion": True,
        "rssi": -70,
        "uptime_s": 3600
    }
    response = client.post("/readings", json=reading)

    assert response.status_code == 422

def test_create_reading_invalid_temperature():
    reading = {
        "device_id": "test_device",
        "temperature": None,
        "humidity": 50.0,
        "pressure": 1013.25,
        "motion": True,
        "rssi": -70,
        "uptime_s": 3600
    }
    response = client.post("/readings", json=reading)

    assert response.status_code == 422

def test_create_reading_invalid_humidity():
    reading = {
        "device_id": "test_device",
        "temperature": 25.5,
        "humidity": None,
        "pressure": 1013.25,
        "motion": True,
        "rssi": -70,
        "uptime_s": 3600
    }
    response = client.post("/readings", json=reading)

    assert response.status_code == 422

def test_create_reading_invalid_pressure():
    reading = {
        "device_id": "test_device",
        "temperature": 25.5,
        "humidity": 50.0,
        "pressure": None,
        "motion": True,
        "rssi": -70,
        "uptime_s": 3600
    }
    response = client.post("/readings", json=reading)

    assert response.status_code == 422

def test_get_presence_recent():
    response = client.get("/presence/recent")

    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0

def test_post_presence():
    presence = {
        "device_id": "test_device",
        "motion": True
    }
    response = client.post("/readings", json=presence)

    assert response.status_code == 201
    data = response.json()
    assert "time" in data