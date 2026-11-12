"""Stream simulation, processed one 64-frame window per request so the UI can show the detector and gate live."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.session_manager import manager
from ..simulation.streams import SCENARIOS

router = APIRouter()


class StartRequest(BaseModel):
    scenario: str = "E2_tunnel_bursts"
    order: str = "correlated"          # "correlated" | "shuffled"
    seed: int = 0                      # the notebook's test streams used seeds 0-2


def _session(sid: str):
    s = manager.get(sid)
    if s is None:
        raise HTTPException(404, "Simulation not found or expired. Start a new one.")
    return s


@router.get("/simulation/scenarios")
def scenarios():
    return SCENARIOS


@router.post("/simulation/start")
def start(req: StartRequest):
    if not 0 <= req.seed <= 99:
        raise HTTPException(400, "seed must be between 0 and 99.")
    try:
        sid, session = manager.create(req.scenario, req.order, req.seed)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"session_id": sid, **session.info()}


@router.post("/simulation/{sid}/step")
def step(sid: str):
    s = _session(sid)
    with s.lock:
        return s.step()


@router.get("/simulation/{sid}/status")
def status(sid: str):
    s = _session(sid)
    return {**s.info(), **s.summary(), "last": s.last}


@router.post("/simulation/{sid}/reset")
def reset(sid: str):
    s = _session(sid)
    with s.lock:
        s.restart()
    return {"session_id": sid, **s.info()}
