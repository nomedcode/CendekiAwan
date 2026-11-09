from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

_TEXT_FIELDS = ("action", "target", "status")


def _reject_control_chars(value: str) -> str:
    """Postgres text rejects NUL and psycopg cannot encode lone surrogates."""
    if "\x00" in value or any(0xD800 <= ord(ch) <= 0xDFFF for ch in value):
        raise ValueError("control characters are not allowed")
    return value


class AuditEventIn(BaseModel):
    action: str = Field(min_length=1, max_length=64)
    target: str = Field(min_length=1, max_length=128)
    status: str = Field(default="ok", min_length=1, max_length=32)

    @field_validator(*_TEXT_FIELDS)
    @classmethod
    def _validate_text(cls, value: str) -> str:
        return _reject_control_chars(value)


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
