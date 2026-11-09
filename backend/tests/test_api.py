def test_health_reports_db_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["checks"]["db"] == "ok"


def test_create_event_returns_201(client):
    response = client.post(
        "/api/events",
        json={"action": "simulate", "target": "cloudlens-queue", "status": "ok"},
    )
    assert response.status_code == 201
    assert response.json()["id"] == 1


def test_created_event_is_persisted(client):
    client.post(
        "/api/events",
        json={"action": "simulate", "target": "cloudlens-queue", "status": "ok"},
    )
    response = client.get("/api/events")
    assert response.status_code == 200
    assert response.json()[0]["action"] == "simulate"


def test_event_limit_out_of_range_is_422(client):
    assert client.get("/api/events?limit=0").status_code == 422
    assert client.get("/api/events?limit=201").status_code == 422


def test_metrics_returns_empty_list(client):
    response = client.get("/api/metrics?minutes=15")
    assert response.status_code == 200
    assert response.json() == []


def test_metrics_window_out_of_range_is_422(client):
    assert client.get("/api/metrics?minutes=0").status_code == 422
