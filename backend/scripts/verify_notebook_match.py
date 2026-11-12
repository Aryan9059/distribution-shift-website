"""Replays notebook streams (seed 0, correlated) through the backend and compares them with the notebook's own
timelines_seed0.csv: detector score, gate state and per-window accuracy of the gated-TENT policy.

    python scripts/verify_notebook_match.py [E2_tunnel_bursts E3_fog_bursts ...]
"""
import csv
import sys
import time
from pathlib import Path

import numpy as np

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from app.config import ARTIFACTS  # noqa: E402
from app.services.session_manager import Session  # noqa: E402

scenarios = sys.argv[1:] or ["E2_tunnel_bursts", "E3_fog_bursts"]
with open(ARTIFACTS / "timelines_seed0.csv", newline="") as f:
    rows = list(csv.DictReader(f))

for sc in scenarios:
    ref = [r for r in rows if r["experiment"] == sc]
    s = Session(sc, "correlated", seed=0)
    t0 = time.time()
    got = [s.step() for _ in range(s.total)]
    assert len(got) == len(ref), (len(got), len(ref))

    ks_diff = np.abs([g["ks"] - float(r["entropy_D"]) for g, r in zip(got, ref)])
    gate_same = np.mean([int(g["adapting"]) == int(r["adapting_gated_tent"]) for g, r in zip(got, ref)])
    cond_same = np.mean([g["condition"] == r["condition"] for g, r in zip(got, ref)])
    acc_diff = np.abs([100 * g["acc_deployed"] - float(r["acc_gated_tent"]) for g, r in zip(got, ref)])
    src_diff = np.abs([100 * g["acc_source"] - float(r["acc_never"]) for g, r in zip(got, ref)])
    print(f"\n{sc}: {len(got)} windows in {time.time() - t0:.0f}s")
    print(f"  condition identical      : {100 * cond_same:.1f}% of windows")
    print(f"  KS distance  max |diff|  : {ks_diff.max():.2e}")
    print(f"  gate decision identical  : {100 * gate_same:.1f}% of windows")
    print(f"  gated accuracy max |diff|: {acc_diff.max():.2f} points (mean {acc_diff.mean():.3f})")
    print(f"  source accuracy max diff : {src_diff.max():.2f} points")
    print(f"  adapted windows backend/notebook: {got[-1]['adapt_windows']} / {sum(int(r['adapting_gated_tent']) for r in ref)}")
