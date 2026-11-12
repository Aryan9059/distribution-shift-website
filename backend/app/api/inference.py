"""Single-image demo: upload (or pick a sample), apply tunnel/fog, classify. This does NOT run the 64-frame
shift detector; a single image cannot."""
import numpy as np
import torch
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..classes import CLASS_NAMES
from ..config import IMG
from ..detection.entropy import entropy
from ..detection.ks_detector import softmax_probs
from ..models.resnet import to_input
from ..services.images import decode_upload, to_data_uri
from ..services.resources import COMPUTE_LOCK, get_resources
from ..simulation.corruptions import corrupt

router = APIRouter()
CONDITIONS = ("clean", "tunnel", "fog")


async def _read_image(file: UploadFile | None, sample_id: int | None) -> np.ndarray:
    pool = get_resources().pool
    if file is not None:
        try:
            return decode_upload(await file.read())
        except ValueError as e:
            raise HTTPException(400, str(e))
    if sample_id is not None:
        if not 0 <= sample_id < len(pool.X):
            raise HTTPException(400, "Unknown sample id.")
        return pool.X[sample_id]
    raise HTTPException(400, "Provide an image file or a sample_id.")


def _check(condition: str, severity: float) -> None:
    if condition not in CONDITIONS:
        raise HTTPException(400, "condition must be clean, tunnel or fog.")
    if not 0 <= severity <= 3:
        raise HTTPException(400, "severity must be between 0 and 3.")


def _classify(x_u8: np.ndarray) -> dict:
    res = get_resources()
    with COMPUTE_LOCK, torch.no_grad():
        probs = softmax_probs(res.model, to_input(x_u8[None]))[0]
    top = np.argsort(probs)[::-1][:5]
    return {
        "class_id": int(top[0]), "class_name": CLASS_NAMES[top[0]], "confidence": float(probs[top[0]]),
        "entropy": float(entropy(probs[None])[0]),
        "top5": [{"class_id": int(c), "class_name": CLASS_NAMES[c], "prob": float(probs[c])} for c in top],
    }


@router.get("/samples")
def samples(n: int = 12):
    """A few held-out test images (one per class, spread over the label space) so visitors need no upload."""
    pool = get_resources().pool
    n = max(1, min(n, 24))
    classes = np.unique(pool.y)[:: max(1, len(np.unique(pool.y)) // n)][:n]
    out = []
    for c in classes:
        idx = int(np.flatnonzero(pool.y == c)[0])
        out.append({"sample_id": idx, "class_id": int(c), "class_name": CLASS_NAMES[c],
                    "image": to_data_uri(pool.X[idx])})
    return out


@router.post("/corrupt")
async def corrupt_image(file: UploadFile | None = File(None), sample_id: int | None = Form(None),
                        condition: str = Form("clean"), severity: float = Form(1.0)):
    _check(condition, severity)
    x = await _read_image(file, sample_id)
    bad = corrupt(x[None], condition, severity, np.random.default_rng(0))[0]
    return {"original": to_data_uri(x), "corrupted": to_data_uri(bad), "size": IMG}


@router.post("/predict")
async def predict(file: UploadFile | None = File(None), sample_id: int | None = Form(None),
                  condition: str = Form("clean"), severity: float = Form(1.0)):
    _check(condition, severity)
    x = await _read_image(file, sample_id)
    bad = corrupt(x[None], condition, severity, np.random.default_rng(0))[0]
    return {
        "size": IMG, "condition": condition, "severity": severity,
        "max_entropy": float(np.log(len(CLASS_NAMES))),
        "original": {"image": to_data_uri(x), **_classify(x)},
        "corrupted": {"image": to_data_uri(bad), **_classify(bad)},
    }
