from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import experiments, inference, simulation
from .config import ALLOWED_ORIGINS, GATE_K, GATE_M, TAU
from .services.resources import get_resources


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_resources()   # load the checkpoint, reference entropies and test pool once at start-up
    yield


app = FastAPI(title="Detect, then Adapt API", lifespan=lifespan)
# Any localhost port is allowed for development (Next.js moves to 3001 if 3000 is busy); deployed origins
# come from ALLOWED_ORIGINS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inference.router)
app.include_router(simulation.router)
app.include_router(experiments.router)


@app.get("/health")
def health():
    return {"status": "ok", "threshold": TAU, "gate": {"m": GATE_M, "k": GATE_K}}
