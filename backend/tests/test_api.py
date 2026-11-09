def test_health_reports_db_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["checks"]["db"] == "ok"


def test_create_event_returns_201(client):
    response = client.post(
        "/api/events",
        json={"action": "simulate", "target": "cendekiawan-queue", "status": "ok"},
    )
    assert response.status_code == 201
    assert response.json()["id"] == 1


def test_created_event_is_persisted(client):
    client.post(
        "/api/events",
        json={"action": "simulate", "target": "cendekiawan-queue", "status": "ok"},
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


def test_metrics_limit_out_of_range_is_422(client):
    assert client.get("/api/metrics?limit=0").status_code == 422


def test_event_with_nul_byte_is_422(client):
    response = client.post(
        "/api/events",
        json={"action": "bad\u0000action", "target": "x", "status": "ok"},
    )
    assert response.status_code == 422


def test_action_rejects_unknown_resource_name(client):
    response = client.post(
        "/api/actions/simulate", json={"name": "not-our-queue", "count": 1}
    )
    assert response.status_code == 422


def test_action_rejects_count_out_of_range(client):
    assert (
        client.post("/api/actions/simulate", json={"count": 0}).status_code == 422
    )
    assert (
        client.post("/api/actions/simulate", json={"count": 101}).status_code == 422
    )


def test_simulate_returns_201_and_writes_audit(client, monkeypatch):
    from app import emulator

    monkeypatch.setattr(emulator, "send_messages", lambda count: {"sent": count})
    response = client.post("/api/actions/simulate", json={"count": 3})
    assert response.status_code == 201
    assert response.json()["sent"] == 3
    assert client.get("/api/events").json()[0]["action"] == "simulate"


def test_snapshot_returns_cached_payload_without_calling_emulator(client, monkeypatch):
    from app import emulator
    from app.routers import api

    cached = {
        "sqs": {"status": "ok", "depth": 7},
        "s3": {"status": "ok", "objects": 1},
        "sns": {"status": "ok", "subscriptions": 1},
        "dynamodb": {"status": "ok", "items": 2},
        "lambda": {"status": "ok", "invocations": 0},
    }
    monkeypatch.setattr(api.cache, "get", lambda key: cached)

    def boom():
        raise AssertionError("emulator should not be called on a cache hit")

    monkeypatch.setattr(emulator, "snapshot", boom)
    response = client.get("/api/snapshot")
    assert response.status_code == 200
    assert response.json()["sqs"]["depth"] == 7
