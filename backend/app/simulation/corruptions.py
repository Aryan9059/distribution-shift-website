"""Tunnel-darkness and fog corruptions. Ported unchanged from the notebook so the demo sees the same shifts."""
import numpy as np
from scipy.ndimage import gaussian_filter

from ..config import CFG, IMG

LEVELS = [0, 1, 2, 3]
TUNNEL = CFG["tunnel_params"]
FOG = CFG["fog_params"]


def _level(table, key, sev):
    return float(np.interp(sev, LEVELS, table[key]))


def _blur(x, sigma):
    return gaussian_filter(x, sigma=(0, sigma, sigma, 0)) if sigma > 0 else x


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
    """Blur, then blend towards a bright and slightly uneven haze."""
    x = _blur(X.astype(np.float32) / 255, _level(FOG, "blur", sev))
    haze = gaussian_filter(rng.normal(size=(len(x), IMG, IMG, 1)).astype(np.float32), sigma=(0, 6, 6, 0))
    haze = 0.8 + 0.08 * haze / (haze.std(axis=(1, 2, 3), keepdims=True) + 1e-6)
    a = _level(FOG, "alpha", sev)
    return _to_uint8((1 - a) * x + a * haze)


def corrupt(X, cond, sev, rng):
    """X: uint8 images (N, H, W, 3)."""
    if cond == "clean" or sev <= 0:
        return X.copy()
    return {"tunnel": tunnel_darkness, "fog": fog}[cond](X, sev, rng)
