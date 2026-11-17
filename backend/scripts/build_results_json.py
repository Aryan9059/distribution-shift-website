"""Parse the extension's results file (out/results.txt from aggregate.py) into lib/data/results.json for the
website. Every number on the Overview and Results pages comes from that file; nothing is typed in by hand.

    python backend/scripts/build_results_json.py [path/to/results.txt]

Default input: backend/artifacts/detect_trust_adapt/results.txt (copied from the Detect-Trust-Adapt package).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "backend" / "artifacts" / "detect_trust_adapt" / "results.txt"
CFG = SRC.parent / "frozen_cfg.json"
OUT = ROOT / "lib" / "data" / "results.json"

EXPERIMENTS = {
    "E1 clean": "E1_clean",
    "E2 tunnel bursts": "E2_tunnel_bursts",
    "E3 fog bursts": "E3_fog_bursts",
    "E4 recovery": "E4_recovery",
    "E5 slow fog": "E5_slow_fog",
}
POLICIES = {
    "Never adapt": "never",
    "Always TENT": "always_tent",
    "Gated TENT (original)": "gated_tent",
    "Gated BN (original)": "gated_bn",
    "Oracle TENT": "oracle_tent",
    "SES gate + SES adapter (ours)": "ours",
    "Oracle-timed SES adapter": "oracle_ses",
    "old entropy gate + SES adapter": "old_gate_ses",
    "new gate + TENT": "new_gate_tent",
    "new gate + BN-EMA": "new_gate_bn_ema",
    "new gate + untrusted blend (ESS)": "new_gate_blend",
    "SES adapter always on, no gate/reset": "ses_always_on",
    "oracle: batch statistics only (no gradient)": "oracle_bn_only",
    "oracle: entropy gradient only (source statistics)": "oracle_grad_only",
}
VALUE = re.compile(r"-?\d+(?:\.\d+)? ± \d+(?:\.\d+)?|—")
EXP_PREFIX = re.compile(r"^(" + "|".join(re.escape(e) for e in EXPERIMENTS) + r")\s+")


def stat(tok):
    if tok == "—":
        return None
    m, s = tok.split(" ± ")
    return {"mean": float(m), "std": float(s)}


def sections(text):
    """{banner title: [body lines]} split on the ==== banners."""
    out, lines, i = {}, text.splitlines(), 0
    while i < len(lines):
        if lines[i].startswith("====") and i + 2 < len(lines) and lines[i + 2].startswith("===="):
            title, body, i = lines[i + 1].strip(), [], i + 3
            while i < len(lines) and not lines[i].startswith("===="):
                body.append(lines[i])
                i += 1
            out[title] = body
        else:
            i += 1
    return out


def find(secs, prefix):
    hits = [v for k, v in secs.items() if k.startswith(prefix)]
    if len(hits) != 1:
        raise SystemExit(f"expected one section starting with {prefix!r}, found {len(hits)}")
    return hits[0]


def stat_tables(body, columns_list):
    """Parse one or more consecutive experiment x policy tables of 'mean ± std' cells.
    columns_list gives the column names of each table in order; a new table starts at its header line."""
    tables, cur, exp = [], None, None
    for line in body:
        if not line.strip() or line.strip().startswith("experiment"):
            continue
        vals = VALUE.findall(line)
        if not vals:                                   # header line of the next table
            cur = {}
            tables.append(cur)
            exp = None
            continue
        label = line[: VALUE.search(line).start()]
        m = EXP_PREFIX.match(label)
        if m:
            exp = EXPERIMENTS[m.group(1)]
            label = label[m.end():]
        policy = label.strip()
        cols = columns_list[len(tables) - 1]
        if len(vals) != len(cols):
            raise SystemExit(f"column mismatch in line: {line!r}")
        if policy not in POLICIES:
            raise SystemExit(f"unknown policy {policy!r}")
        cur[(exp, POLICIES[policy])] = dict(zip(cols, map(stat, vals)))
    return tables


def merged(tables):
    rows = {}
    for t in tables:
        for key, cells in t.items():
            rows.setdefault(key, {}).update(cells)
    return [{"experiment": e, "policy": p, **cells} for (e, p), cells in rows.items()]


text = SRC.read_text(encoding="utf-8")
secs = sections(text)

ACC = ["overall", "clean", "shift", "post_clean", "worst_window", "macro_f1"]
COST = ["adapt_steps", "clean_adapted", "false_alarms", "fa_per_1k", "delay", "missed", "shift_coverage", "resets"]
core = merged(stat_tables(find(secs, "CORE RESULTS, filmed-order (correlated)"), [ACC])
              + stat_tables(find(secs, "CORE RESULTS, filmed-order - COST"), [COST]))

shuffled = merged(stat_tables(find(secs, "SAME FRAMES SHUFFLED"),
                              [["overall", "clean", "shift"],
                               ["adapt_steps", "false_alarms", "delay", "missed", "shift_coverage"]]))

ablations = merged(stat_tables(find(secs, "ABLATIONS"), [["overall", "clean", "shift"]]))

paired = []
for line in find(secs, "PAIRED DIFFERENCES"):
    m = re.match(r"^\s*(correlated|shuffled)\s+(" + "|".join(map(re.escape, EXPERIMENTS)) + r")\s+(.+?)\s{2,}(.*)$", line)
    if not m:
        continue
    order, exp, policy, rest = m.groups()
    nums = rest.split()
    f = lambda v: None if v == "NaN" else float(v)
    paired.append({"order": order, "experiment": EXPERIMENTS[exp], "policy": POLICIES[policy],
                   "mean_diff": f(nums[0]), "min": f(nums[1]), "max": f(nums[2]),
                   "better": int(nums[3]), "equal": int(nums[4]), "worse": int(nums[5]), "shift_diff": f(nums[6])})

detectors, nominal = [], None
for line in find(secs, "DETECTORS"):
    if line.startswith("nominal"):
        nominal = {k: stat(v) for k, v in re.findall(r"'(\w+)': '([^']+)'", line)}
        continue
    m = re.match(r"^\s*(correlated|shuffled)\s+(\S+)\s+(.*)$", line)
    vals = VALUE.findall(line)
    if m and len(vals) == 3:
        detectors.append({"order": m.group(1), "detector": m.group(2),
                          "clean": stat(vals[0]), "tunnel": stat(vals[1]), "fog": stat(vals[2])})

static = []
for line in find(secs, "STATIC ROBUSTNESS"):
    m = re.match(r"^\s*(.+?)\s+(clean|tunnel|fog)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s*$", line)
    if m:
        static.append({"data": m.group(1), "condition": m.group(2), "severity": int(m.group(3)),
                       "resnet18": float(m.group(4)), "hog_svm": float(m.group(5))})

config = json.loads(CFG.read_text()) if CFG.exists() else None
seeds = re.search(r"stream seeds: \[([^\]]*)\]", text)

results = {
    "source": "Detect-Trust-Adapt package, out/results.txt",
    "stream_seeds": [int(s) for s in seeds.group(1).split(",")] if seeds else None,
    "config": config,
    "core": core,
    "paired": paired,
    "shuffled": shuffled,
    "detectors": detectors,
    "nominal_entropy_ks_clean": nominal,
    "ablations": ablations,
    "static": static,
}
for k in ("core", "paired", "shuffled", "detectors", "ablations", "static"):
    if not results[k]:
        raise SystemExit(f"section {k} parsed empty")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(results, indent=1, ensure_ascii=False), encoding="utf-8")
print(f"wrote {OUT}: " + ", ".join(f"{k}={len(results[k])}" for k in ("core", "paired", "shuffled", "detectors", "ablations", "static")))
