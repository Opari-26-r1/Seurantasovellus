from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

def test_status_valid():
    response = client.get("/status")

    assert response.status_code == 200
    
    data = response.json()
    assert data["backend"] == "ok"
    assert "database" in data

def test_status_invalid():
    response = client.get("/status")

    assert response.status_code == 404

    data = response.json()
    assert data["backend"] == "not found"
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

def test_create_reading_invalid():
    reading = {
        "device_id": "test_device",
        "temperature": 25.5,
        "humidity": 50.0,
        "pressure": 1013.25,
        "motion": True,
        "rssi": -70
    }
    response = client.post("/readings", json=reading)

    assert response.status_code == 422

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