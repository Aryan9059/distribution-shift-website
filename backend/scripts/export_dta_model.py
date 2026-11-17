"""Install the Detect-Trust-Adapt model into the backend and rebuild the data that depends on its split.

    python scripts/export_dta_model.py <path to detect_trust_adapt_package>

Steps:
  1. Copy resnet18_original_geo_aug.pt (the model the published results use) to artifacts/resnet18_source.pt.
  2. Put the package's normalisation (normalisation.npz) into artifacts/config.json.
  3. Rebuild the package's track-aware split (lib.py: load_data) from the GTSRB training images in backend/data,
     and check it by recomputing the training-split mean/std, which must equal normalisation.npz.
  4. Write artifacts/test_pool.npz (held-out test tracks, frames in filmed order) and
     artifacts/reference_entropy.npy (clean 'ref' track entropies, used by the stream simulator).
  5. Report frame-level accuracy against the package's static robustness numbers.

GTSRB must already be in backend/data/gtsrb/GTSRB/Training (scripts/export_data.py downloads it).
"""
import glob
import json
import os
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

PKG = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Desktop" / "detect_trust_adapt_package"
BACKEND = Path(__file__).resolve().parent.parent
ARTIFACTS = BACKEND / "artifacts"
TRAIN_DIR = BACKEND / "data" / "gtsrb" / "GTSRB" / "Training"
SEED = 42

# 1-2. checkpoint and normalisation -----------------------------------------------------------------------
shutil.copyfile(PKG / "resnet18_original_geo_aug.pt", ARTIFACTS / "resnet18_source.pt")
norm = np.load(PKG / "normalisation.npz")
cfg_path = ARTIFACTS / "config.json"
cfg = json.loads(cfg_path.read_text())
cfg["norm_mean"] = [round(float(v), 7) for v in norm["mean"]]
cfg["norm_std"] = [round(float(v), 7) for v in norm["std"]]
cfg["model"] = "Detect-Trust-Adapt package: resnet18_original_geo_aug.pt"
cfg_path.write_text(json.dumps(cfg, indent=2))
print("checkpoint and normalisation installed")

# Imported after config.json is updated so the model code picks up the new normalisation.
sys.path.insert(0, str(BACKEND))
import torch  # noqa: E402

from app.detection.entropy import entropy  # noqa: E402
from app.models.resnet import load_source_model, to_input  # noqa: E402
from app.simulation.corruptions import corrupt  # noqa: E402

# 3. split, identical to the package's lib.load_data ------------------------------------------------------
paths = sorted(glob.glob(str(TRAIN_DIR / "*" / "*.ppm")))
assert paths, f"no GTSRB images under {TRAIN_DIR}"
X = np.zeros((len(paths), 48, 48, 3), np.uint8)
cls, trk = [], []
for i, p in enumerate(paths):
    with Image.open(p) as im:
        X[i] = np.asarray(im.convert("RGB").resize((48, 48), Image.BILINEAR))
    cls.append(int(os.path.basename(os.path.dirname(p))))
    trk.append(int(os.path.basename(p)[:-4].split("_")[0]))
cls, trk = np.array(cls), np.array(trk)
gtrk = cls * 1000 + trk
rng = np.random.RandomState(SEED)
role = np.empty(len(gtrk), dtype=object)
for c in range(43):
    ts = np.unique(gtrk[cls == c]); rng.shuffle(ts)
    n = len(ts); ntr = int(round(.6 * n)); nva = int(round(.2 * n))
    for j, t in enumerate(ts):
        role[gtrk == t] = "train" if j < ntr else ("val" if j < ntr + nva else "test")
vts = np.unique(gtrk[role == "val"]); rng.shuffle(vts)
nref = int(round(.5625 * len(vts)))
for j, t in enumerate(vts):
    role[gtrk == t] = "ref" if j < nref else "calib"
print("split sizes:", {r: int((role == r).sum()) for r in ("train", "ref", "calib", "test")})

tr = X[role == "train"].astype(np.float32) / 255.
mean, std = tr.mean((0, 1, 2)), tr.std((0, 1, 2))
assert np.allclose(mean, norm["mean"], atol=1e-4) and np.allclose(std, norm["std"], atol=1e-4), \
    f"split does not reproduce the package's normalisation: {mean} {std} vs {norm['mean']} {norm['std']}"
print("split verified: training mean/std match normalisation.npz")

# 4. test pool and reference entropies --------------------------------------------------------------------
test_idx = np.where(role == "test")[0]                        # already sorted by class, track, frame
_, lengths = np.unique(gtrk[test_idx], return_counts=True)    # gtrk increases along test_idx, so counts align
X_test, y_test = X[test_idx], cls[test_idx]
np.savez_compressed(ARTIFACTS / "test_pool.npz", X=X_test, y=y_test, lengths=lengths)
print(f"test_pool.npz: {len(X_test)} images in {len(lengths)} tracks")

model = load_source_model()


@torch.no_grad()
def probs(x_u8):
    return np.concatenate([torch.softmax(model(to_input(x_u8[i:i + 512])), 1).double().cpu().numpy()
                           for i in range(0, len(x_u8), 512)])


ref_entropy = entropy(probs(X[role == "ref"]))
np.save(ARTIFACTS / "reference_entropy.npy", ref_entropy)
print(f"reference_entropy.npy: {len(ref_entropy)} values")

# 5. sanity check against the package's static robustness table --------------------------------------------
EXPECTED = {("clean", 0): 94.66, ("tunnel", 1): 91.55, ("tunnel", 2): 78.79, ("tunnel", 3): 55.40,
            ("fog", 1): 81.10, ("fog", 2): 54.41, ("fog", 3): 27.82}
gen = np.random.default_rng(0)
for (cond, sev), ref in EXPECTED.items():
    acc = 100 * (probs(corrupt(X_test, cond, sev, gen)).argmax(1) == y_test).mean()
    print(f"{cond:6s} s{sev}: {acc:6.2f}%   (package: {ref:.2f}%)")
