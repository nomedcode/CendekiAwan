from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AuditEvent, MetricSnapshot
from ..schemas import AuditEventIn, AuditEventOut, MetricPoint

router = APIRouter()


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail={"status": "error", "db": "down"})
    return {"status": "ok", "checks": {"db": "ok"}}


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
