"""Tunnel-darkness and fog corruptions, ported from the Detect-Trust-Adapt package (lib.py: tunnel, fog) so the
demo sees the same shifts the published results were measured on."""
import numpy as np
import torch
import torch.nn.functional as F
from scipy.ndimage import gaussian_filter

from ..config import CFG

LEVELS = [0, 1, 2, 3]
TUNNEL = CFG["tunnel_params"]
FOG = CFG["fog_params"]


def _level(table, key, sev):
    return float(np.interp(sev, LEVELS, table[key]))


def _blur(x, sigma):
    # Package: separable Gaussian, radius ceil(3 sigma), reflect padding without edge repeat (scipy "mirror").
    return gaussian_filter(x, sigma=(0, sigma, sigma, 0), mode="mirror", truncate=3.0) if sigma > 1e-6 else x


def _to_uint8(x):
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)


def tunnel_darkness(X, sev, rng):
    """Low light: gamma and brightness drop, slight blur, then sensor noise."""
    x = X.astype(np.float32) / 255
    x = _level(TUNNEL, "brightness", sev) * x ** _level(TUNNEL, "gamma", sev)
    x = _blur(x, _level(TUNNEL, "blur", sev))
    x = x + rng.normal(0, _level(TUNNEL, "noise", sev), x.shape).astype(np.float32)
    return _to_uint8(x)


def fog(X, sev, rng):
    """Blur, then blend towards a bright, spatially uneven haze (a 4x4 random field upsampled bilinearly)."""
    x = _blur(X.astype(np.float32) / 255, _level(FOG, "blur", sev))
    n, h, w, _ = x.shape
    low = torch.from_numpy(rng.random((n, 1, 4, 4), dtype=np.float32))
    up = F.interpolate(low, size=(h, w), mode="bilinear", align_corners=False)
    haze = (0.85 + 0.1 * up).permute(0, 2, 3, 1).numpy()
    a = _level(FOG, "alpha", sev)
    return _to_uint8(x * (1 - a) + haze * a)


def corrupt(X, cond, sev, rng):
    """X: uint8 images (N, H, W, 3)."""
    if cond == "clean" or sev <= 0:
        return X.copy()
    return {"tunnel": tunnel_darkness, "fog": fog}[cond](X, sev, rng)
