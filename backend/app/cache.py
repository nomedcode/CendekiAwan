"""Best-effort Redis cache: a Redis outage must never fail an API request."""

import json
from functools import lru_cache

import redis

from .config import settings


@lru_cache(maxsize=1)
def client() -> redis.Redis:
    return redis.Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_timeout=1,
        socket_connect_timeout=1,
    )


def get(key: str):
    try:
        raw = client().get(key)
    except Exception:  # noqa: BLE001 - cache is optional
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return None


def set(key: str, value, ttl: int = 2) -> None:
    try:
        client().set(key, json.dumps(value), ex=ttl)
    except Exception:  # noqa: BLE001 - cache is optional
        pass


def ping() -> bool:
    return bool(client().ping())


def close() -> None:
    try:
        client().close()
    except Exception:  # noqa: BLE001 - shutdown must not raise
        pass