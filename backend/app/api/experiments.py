"""Stored (historical) results from the notebook. Read from the exported CSV, never recalculated."""
import csv
from collections import defaultdict
from statistics import mean, pstdev

from fastapi import APIRouter, HTTPException

from ..config import ARTIFACTS, CFG

router = APIRouter()
METRICS = ["overall_acc", "clean_acc", "shift_acc", "post_shift_clean_acc", "worst_window_acc", "macro_f1",
           "adapt_steps", "false_alarms", "detection_delay_windows", "missed_shifts", "resets"]


def _rows():
    with open(ARTIFACTS / "core_results_per_seed.csv", newline="") as f:
        return list(csv.DictReader(f))


@router.get("/experiments")
def list_experiments():
    return [{"id": k, "description": v} for k, v in CFG["schedules"].items()]


@router.get("/experiments/{exp_id}")
def experiment(exp_id: str):
    by_policy = defaultdict(list)
    for r in _rows():
        if r["experiment"] == exp_id:
            by_policy[r["policy"]].append(r)
    if not by_policy:
        raise HTTPException(404, "Unknown experiment.")
    out = {}
    for policy, rows in by_policy.items():
        out[policy] = {}
        for m in METRICS:
            vals = [float(r[m]) for r in rows if r.get(m) not in (None, "")]
            out[policy][m] = {"mean": mean(vals), "std": pstdev(vals) if len(vals) > 1 else 0.0} if vals else None
    return {"id": exp_id, "description": CFG["schedules"][exp_id], "seeds": len(next(iter(by_policy.values()))),
            "policies": out}
