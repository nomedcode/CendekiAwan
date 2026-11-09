from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AuditEventIn(BaseModel):
    action: str = Field(min_length=1, max_length=64)
    target: str = Field(min_length=1, max_length=128)
    status: str = Field(default="ok", min_length=1, max_length=32)


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: str
    target: str
    status: str
    created_at: datetime


class MetricPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    service: str
    resource: str
    metric: str
    value: float
    source: str
    captured_at: datetime
