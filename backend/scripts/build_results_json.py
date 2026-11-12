"""Aggregate the notebook's CSVs into lib/data/results.json for the Results page.
Every number on the page comes from these files; nothing is typed in by hand.

    python scripts/build_results_json.py <folder with the notebook's CSVs>
"""
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path
from statistics import mean, pstdev

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "artifacts"
OUT = Path(__file__).resolve().parent.parent.parent / "lib" / "data" / "results.json"


def read(name):
    with open(SRC / name, newline="") as f:
        return list(csv.DictReader(f))


def num(v):
    return None if v in (None, "", "nan") else float(v)


def aggregate(rows, keys, metrics):
    groups = defaultdict(list)
    for r in rows:
        groups[tuple(r[k] for k in keys)].append(r)
    out = []
    for key, rs in groups.items():
        item = dict(zip(keys, key))
        item["n_streams"] = len(rs)
        for m in metrics:
            vals = [num(r.get(m)) for r in rs if num(r.get(m)) is not None]
            item[m] = {"mean": mean(vals), "std": pstdev(vals) if len(vals) > 1 else 0.0} if vals else None
        out.append(item)
    return out


ACC = ["overall_acc", "clean_acc", "shift_acc", "post_shift_clean_acc", "worst_window_acc", "macro_f1"]
COST = ["adapt_steps", "false_alarms", "detection_delay_windows", "missed_shifts", "resets"]

results = {
    "core": aggregate(read("core_results_per_seed.csv"), ["experiment", "policy"], ACC + COST),
    "order": aggregate(read("ablation_order_per_seed.csv"), ["experiment", "order", "policy"],
                       ["overall_acc", "clean_acc", "shift_acc"]),
    "detector": aggregate(read("ablation_detector_per_seed.csv"), ["order", "experiment", "detector"],
                          ["clean_alarm_rate", "shift_alarm_rate", "nominal_p05_clean_alarm_rate", "overall_acc"]),
    "gate_mk": aggregate(read("ablation_gate_mk_per_seed.csv"), ["m", "k"],
                         ["overall_acc", "clean_acc", "shift_acc", "adapt_steps", "false_alarms"]),
    "static": [{k: (num(v) if k not in ("data", "condition") else v) for k, v in r.items()} for r in read("static_robustness.csv")],
    "training": [{k: num(v) for k, v in r.items()} for r in read("training_log.csv")],
    "calibration": read("calibration_summary.csv"),
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(results, indent=1))
print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
