from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .. import emulator
from ..config import settings
from ..db import get_db
from ..models import AuditEvent, MetricSnapshot
from ..schemas import ActionRequest, AuditEventIn, AuditEventOut, MetricPoint

router = APIRouter()


def _require_name(value: str | None, allowed: str) -> str:
    name = value or allowed
    if name != allowed:
        raise HTTPException(status_code=422, detail=f"unknown resource: {name}")
    return name


def _audit(db: Session, action: str, target: str, status: str) -> None:
    db.add(AuditEvent(action=action, target=target, status=status))
    db.commit()


def _run_action(db: Session, action: str, target: str, fn, **kwargs) -> dict:
    try:
        result = fn(**kwargs)
    except Exception as exc:  # noqa: BLE001 - surface a clean 503, not a stack trace
        _audit(db, action, target, "error")
        raise HTTPException(
            status_code=503, detail=f"emulator error: {exc.__class__.__name__}"
        )
    _audit(db, action, target, "ok")
    return {"action": action, "target": target, **result}


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail={"status": "error", "db": "down"})
    try:
        emulator.ping()
        emulator_status = "ok"
    except Exception:  # noqa: BLE001 - reported, not fatal
        emulator_status = "down"
    return {
        "status": "ok",
        "checks": {"db": "ok", "emulator": emulator_status},
    }


@router.get("/api/snapshot")
def get_snapshot(db: Session = Depends(get_db)) -> dict:
    data = emulator.snapshot()
    lambda_state = data.setdefault("lambda", {"status": "down"})
    lambda_state["invocations"] = int(
        db.scalar(
            select(func.count())
            .select_from(AuditEvent)
            .where(AuditEvent.action == "invoke")
        )
        or 0
    )
    return data


@router.post("/api/actions/simulate", status_code=201)
def simulate(payload: ActionRequest, db: Session = Depends(get_db)) -> dict:
    queue = _require_name(payload.name, settings.sqs_queue)
    return _run_action(db, "simulate", queue, emulator.send_messages, count=payload.count)


@router.post("/api/actions/publish", status_code=201)
def publish(payload: ActionRequest, db: Session = Depends(get_db)) -> dict:
    topic = _require_name(payload.name, settings.sns_topic)
    return _run_action(db, "publish", topic, emulator.publish, count=payload.count)


@router.post("/api/actions/upload", status_code=201)
def upload(payload: ActionRequest, db: Session = Depends(get_db)) -> dict:
    bucket = _require_name(payload.name, settings.s3_bucket)
    return _run_action(db, "upload", bucket, emulator.upload, count=payload.count)


@router.post("/api/actions/item", status_code=201)
def write_item(payload: ActionRequest, db: Session = Depends(get_db)) -> dict:
    table = _require_name(payload.name, settings.dynamodb_table)
    return _run_action(db, "item", table, emulator.write_item, count=payload.count)


@router.post("/api/actions/invoke", status_code=201)
def invoke(payload: ActionRequest, db: Session = Depends(get_db)) -> dict:
    function = _require_name(payload.name, settings.lambda_function)
    return _run_action(db, "invoke", function, emulator.invoke)


@router.get("/api/events", response_model=list[AuditEventOut])
def list_events(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = select(AuditEvent).order_by(AuditEvent.id.desc()).limit(limit)
    return db.scalars(stmt).all()


@router.post("/api/events", response_model=AuditEventOut, status_code=201)
def create_event(payload: AuditEventIn, db: Session = Depends(get_db)):
    event = AuditEvent(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/api/metrics", response_model=list[MetricPoint])
def list_metrics(
    minutes: int = Query(default=15, ge=1, le=1440),
    limit: int = Query(default=2000, ge=1, le=5000),
    service: str | None = Query(default=None, max_length=32),
    db: Session = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    stmt = (
        select(MetricSnapshot)
        .where(MetricSnapshot.captured_at >= since)
        .order_by(MetricSnapshot.captured_at)
        .limit(limit)
    )
    if service:
        stmt = stmt.where(MetricSnapshot.service == service)
    return db.scalars(stmt).all()
