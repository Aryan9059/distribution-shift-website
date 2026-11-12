"""Stream scenarios E1-E5 and the window generator (same logic and random-number order as the notebook)."""
import numpy as np

from ..config import ARTIFACTS, BURST_SEVERITY, CFG, E5_MAX_SEVERITY, WINDOW
from .corruptions import corrupt


class TestPool:
    """Held-out test tracks, stored as one array in track order, with the length of every track."""

    def __init__(self, path=ARTIFACTS / "test_pool.npz"):
        data = np.load(path)
        self.X, self.y, lengths = data["X"], data["y"], data["lengths"]
        ends = np.cumsum(lengths)
        starts = ends - lengths
        self.tracks = [np.arange(s, e) for s, e in zip(starts, ends)]


def piecewise(*parts):
    """parts = (fraction of the stream, condition, severity), with fractions summing to 1."""
    edges = np.cumsum([p[0] for p in parts])

    def schedule(w, n):
        i = min(int(np.searchsorted(edges, (w + 0.5) / n, side="right")), len(parts) - 1)
        return parts[i][1], parts[i][2]
    return schedule


def _bursts(cond, n_bursts=3):
    parts = []
    for _ in range(n_bursts):
        parts += [("clean", 0.0), (cond, BURST_SEVERITY)]
    parts.append(("clean", 0.0))
    return piecewise(*[(1 / len(parts), c, s) for c, s in parts])


def _slow_fog(w, n):
    f = (w + 0.5) / n   # fog creeps in and never clears (negative control)
    if f < 0.15:
        return "clean", 0.0
    return "fog", E5_MAX_SEVERITY * (f - 0.15) / 0.85


SCHEDULES = {
    "E1_clean": piecewise((1.0, "clean", 0.0)),
    "E2_tunnel_bursts": _bursts("tunnel"),
    "E3_fog_bursts": _bursts("fog"),
    "E4_recovery": piecewise((0.2, "clean", 0.0), (0.2, "tunnel", BURST_SEVERITY),
                             (0.2, "fog", BURST_SEVERITY), (0.4, "clean", 0.0)),
    "E5_slow_fog": _slow_fog,
}

SCENARIOS = [
    {"id": "E1_clean", "label": "E1 · Clean stream", "description": CFG["schedules"]["E1_clean"]},
    {"id": "E2_tunnel_bursts", "label": "E2 · Tunnel bursts", "description": CFG["schedules"]["E2_tunnel_bursts"]},
    {"id": "E3_fog_bursts", "label": "E3 · Fog bursts", "description": CFG["schedules"]["E3_fog_bursts"]},
    {"id": "E4_recovery", "label": "E4 · Tunnel, fog, clean recovery", "description": CFG["schedules"]["E4_recovery"]},
    {"id": "E5_slow_fog", "label": "E5 · Slowly increasing fog", "description": CFG["schedules"]["E5_slow_fog"]},
]


class Stream:
    """Yields one window of 64 frames at a time. The random generator is consumed in the notebook's order:
    first the track/frame permutation, then each window's corruption noise in turn."""

    def __init__(self, pool: TestPool, scenario: str, order: str, seed: int):
        self.pool, self.schedule = pool, SCHEDULES[scenario]
        self.rng = np.random.default_rng(seed)
        if order == "correlated":
            seq = np.concatenate([pool.tracks[i] for i in self.rng.permutation(len(pool.tracks))])
        else:
            seq = self.rng.permutation(np.concatenate(pool.tracks))
        self.n_windows = len(seq) // WINDOW
        self.seq = seq[: self.n_windows * WINDOW].reshape(self.n_windows, WINDOW)

    def window(self, w: int):
        cond, sev = self.schedule(w, self.n_windows)
        x = corrupt(self.pool.X[self.seq[w]], cond, sev, self.rng)
        return x, self.pool.y[self.seq[w]], (cond if sev > 0 else "clean"), float(sev)
