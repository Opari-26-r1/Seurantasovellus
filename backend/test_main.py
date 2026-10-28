from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

def test_status():
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