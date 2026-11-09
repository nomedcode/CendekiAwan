"""Background sampling: instant attributes every tick, CloudWatch once a minute."""

import asyncio
import logging

from . import emulator
from .config import settings
from .db import SessionLocal
from .models import MetricSnapshot

logger = logging.getLogger(__name__)

_SERVICE_METRICS = {
    "sqs": ("depth", "in_flight"),
    "s3": ("objects", "bytes"),
    "sns": ("subscriptions",),
    "dynamodb": ("items",),
    "lambda": ("invocations",),
}


def _record(service: str, metric: str, value: float, source: str = "live") -> None:
    with SessionLocal() as session:
        session.add(
            MetricSnapshot(
                service=service,
                resource="demo",
                metric=metric,
                value=float(value),
                source=source,
            )
        )
        session.commit()


def sample_once() -> dict:
    data = emulator.snapshot()
    for service, metrics in _SERVICE_METRICS.items():
        state = data.get(service, {})
        if state.get("status") != "ok":
            continue
        for metric in metrics:
            value = state.get(metric)
            if value is not None:
                _record(service, metric, value)
    return data


def sample_cloudwatch() -> None:
    age = emulator.oldest_message_age()
    if age is not None:
        _record("sqs", "oldest_message_age", age, source="cloudwatch")


async def run() -> None:
    seeded = False
    while True:
        try:
            if not seeded:
                await asyncio.to_thread(emulator.ensure_resources)
                seeded = True
            await asyncio.to_thread(sample_once)
        except Exception:  # noqa: BLE001 - keep the loop alive, log and retry
            logger.exception("sampler tick failed; will re-seed next tick")
            seeded = False
        await asyncio.sleep(settings.sample_interval_seconds)


async def run_cloudwatch() -> None:
    while True:
        try:
            await asyncio.to_thread(sample_cloudwatch)
        except Exception:  # noqa: BLE001 - CloudWatch is best-effort
            logger.exception("cloudwatch sample failed")
        await asyncio.sleep(settings.cloudwatch_interval_seconds)