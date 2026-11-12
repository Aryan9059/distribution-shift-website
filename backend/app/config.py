"""Paths and the experiment configuration exported by the notebook (artifacts/config.json)."""
import json
import os
from pathlib import Path

ARTIFACTS = Path(os.environ.get("ARTIFACTS_DIR", Path(__file__).resolve().parent.parent / "artifacts"))

with open(ARTIFACTS / "config.json") as f:
    CFG = json.load(f)

IMG = CFG["img_size"]          # 48
WINDOW = CFG["window"]         # 64 frames per window
GATE_M, GATE_K = CFG["gate_m"], CFG["gate_k"]
TENT_LR = CFG["tent_lr"]
BURST_SEVERITY = CFG["burst_severity"]
E5_MAX_SEVERITY = CFG["e5_max_severity"]
TAU = CFG["tau"]["entropy"]    # {"correlated": ..., "shuffled": ...}

ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
MAX_SESSIONS = int(os.environ.get("MAX_SESSIONS", "8"))
SESSION_TTL_SECONDS = int(os.environ.get("SESSION_TTL_SECONDS", "900"))
