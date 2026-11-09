import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from . import cache, emulator, sampler
from .db import Base, engine
from .routers.api import router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # the db container gates startup via its healthcheck, so create_all is safe here
    Base.metadata.create_all(bind=engine)
    try:
        await asyncio.to_thread(emulator.ensure_resources)
    except Exception:  # noqa: BLE001 - the emulator may still be booting
        logger.warning("emulator not ready at startup; sampler will retry")
    tasks = [
        asyncio.create_task(sampler.run()),
        asyncio.create_task(sampler.run_cloudwatch()),
    ]
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            with suppress(asyncio.CancelledError):
                await task
        cache.close()


app = FastAPI(title="CendekiAwan", version="0.1.0", lifespan=lifespan)
app.include_router(router)
