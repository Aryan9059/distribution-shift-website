"""One-off export of the two artifacts the notebook did not save:

  artifacts/reference_entropy.npy  - prediction entropies of the clean 'ref' tracks (the detector's reference)
  artifacts/test_pool.npz          - the held-out test tracks the stream scenarios are built from

It rebuilds the notebook's track-aware split with the same seed and checks it against the numbers the
notebook reported (15,990 / 2,970 / 2,310 / 5,370 images) before writing anything.

    python scripts/export_data.py
"""
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torchvision
from PIL import Image

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from app.config import ARTIFACTS, CFG, IMG  # noqa: E402
from app.detection.entropy import entropy  # noqa: E402
from app.models.resnet import load_source_model, to_input  # noqa: E402

SEED = CFG["seed"]
EXPECTED = {"train": 15990, "ref": 2970, "calib": 2310, "test": 5370}

print("loading GTSRB (downloads ~190 MB the first time) ...")
raw = torchvision.datasets.GTSRB(root=str(BACKEND / "data"), split="train", download=True)

rows = []
for path, label in raw._samples:
    m = re.match(r"^(\d+)_(\d+)\.\w+$", Path(path).name)
    assert m, f"unexpected file name {path}"
    rows.append({"path": path, "label": label, "track": f"{label:02d}_{m.group(1)}", "frame": int(m.group(2))})
meta = pd.DataFrame(rows).sort_values(["label", "track", "frame"]).reset_index(drop=True)

# Identical to the notebook: per class, shuffle the tracks and cut 60 / 20 (ref, calib alternating) / 20.
rng = np.random.default_rng(SEED)
role = {}
for label, g in meta.groupby("label"):
    tracks = rng.permutation(g.track.unique())
    n = len(tracks)
    n_tr = int(round(CFG["split_fractions"]["train"] * n))
    n_va = max(1, int(round(CFG["split_fractions"]["val"] * n)))
    for t in tracks[:n_tr]:
        role[t] = "train"
    for j, t in enumerate(tracks[n_tr:n_tr + n_va]):
        role[t] = "ref" if j % 2 == 0 else "calib"
    for t in tracks[n_tr + n_va:]:
        role[t] = "test"
meta["role"] = meta.track.map(role)

counts = meta.role.value_counts().to_dict()
print("split sizes:", counts)
assert counts == EXPECTED, f"split does not match the notebook: {counts} != {EXPECTED}"


def load(paths):
    out = np.empty((len(paths), IMG, IMG, 3), dtype=np.uint8)
    for i, p in enumerate(paths):
        with Image.open(p) as im:
            out[i] = np.asarray(im.convert("RGB").resize((IMG, IMG), Image.BILINEAR))
    return out


# Test pool: tracks in the same order the notebook used (sorted by track id), frames in temporal order.
test_groups = [g for _, g in meta[meta.role == "test"].groupby("track")]
test_idx = np.concatenate([g.index.to_numpy() for g in test_groups])
lengths = np.array([len(g) for g in test_groups])
X_test, y_test = load(meta.path.to_numpy()[test_idx].tolist()), meta.label.to_numpy()[test_idx]
np.savez_compressed(ARTIFACTS / "test_pool.npz", X=X_test, y=y_test, lengths=lengths)
print(f"test_pool.npz: {len(X_test)} images in {len(lengths)} tracks")

# Reference entropies from the clean 'ref' tracks, computed by the frozen source model.
model = load_source_model()
ref_idx = meta.index[meta.role == "ref"].to_numpy()
X_ref = load(meta.path.to_numpy()[ref_idx].tolist())
ents = []
with torch.no_grad():
    for i in range(0, len(X_ref), 512):
        p = torch.softmax(model(to_input(X_ref[i:i + 512])), dim=1).double().cpu().numpy()
        ents.append(entropy(p))
ref_entropy = np.concatenate(ents)
np.save(ARTIFACTS / "reference_entropy.npy", ref_entropy)
print(f"reference_entropy.npy: {len(ref_entropy)} values, mean {ref_entropy.mean():.4f}")

# Sanity check against the notebook's static result (94.12% on the clean held-out test tracks).
with torch.no_grad():
    pred = np.concatenate([model(to_input(X_test[i:i + 512])).argmax(1).cpu().numpy() for i in range(0, len(X_test), 512)])
print(f"clean accuracy on test tracks: {100 * (pred == y_test).mean():.2f}%  (notebook reported 94.12%)")
