from contextlib import asynccontextmanager

from fastapi import FastAPI

from .db import Base, engine
from .routers.api import router


@asynccontextmanager
async def lifespan(_: FastAPI):
    # the db container gates startup via its healthcheck, so create_all is safe here
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="CendekiAwan", version="0.1.0", lifespan=lifespan)
app.include_router(router)
