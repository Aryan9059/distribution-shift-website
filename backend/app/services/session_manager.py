"""One simulation = one session. Every session owns its gate, its TENT adapter (model copy + optimizer) and
its stream, so visitors can never affect one another's model state. The frozen source model is shared
read-only; it is never updated."""
import threading
import time
import uuid

import numpy as np
import torch

from ..adaptation.gate import PersistenceGate
from ..config import GATE_K, GATE_M, MAX_SESSIONS, SESSION_TTL_SECONDS, TAU, TENT_LR, WINDOW
from ..detection.ks_detector import softmax_probs
from ..models.resnet import to_input
from ..models.tent import TentAdapter
from ..simulation.streams import SCENARIOS, Stream
from .images import to_data_uri
from .resources import COMPUTE_LOCK, get_resources

N_THUMBS = 8


class Session:
    def __init__(self, scenario: str, order: str, seed: int):
        self.scenario, self.order, self.seed = scenario, order, seed
        self.tau = TAU[order]
        self.lock = threading.Lock()
        self.touched = time.time()
        self.restart()

    def restart(self) -> None:
        res = get_resources()
        self.stream = Stream(res.pool, self.scenario, self.order, self.seed)
        self.gate = PersistenceGate(self.tau, GATE_M, GATE_K)
        self.adapter = TentAdapter(res.model, TENT_LR)
        self.w = 0
        self.sum_deployed = self.sum_source = 0.0
        self.adapt_windows = self.false_alarms = self.resets = 0
        self.last = None

    @property
    def total(self) -> int:
        return self.stream.n_windows

    def info(self) -> dict:
        return {"total_windows": self.total, "threshold": self.tau, "gate_m": GATE_M, "gate_k": GATE_K,
                "window_size": WINDOW, "scenario": self.scenario, "order": self.order}

    def step(self) -> dict:
        """Process the next window of 64 frames: score -> gate -> (TENT step | predict) -> maybe reset."""
        res = get_resources()
        if self.w >= self.total:
            return {**self.summary(), "done": True}
        w = self.w
        x_u8, y, cond, sev = self.stream.window(w)
        shifted = cond != "clean"

        with COMPUTE_LOCK:
            x = to_input(x_u8)
            probs = softmax_probs(res.model, x)                       # frozen detector model
            ks, p_value = res.detector.score(probs)
            adapt, just_closed = self.gate.update(ks)
            if just_closed:
                self.adapter.reset()
                self.resets += 1
            if adapt:
                logits = self.adapter.step(x)
            else:
                logits = torch.from_numpy(probs).to(x.device)         # source predictions, already computed
            pred = logits.argmax(1).cpu().numpy()
        acc_deployed = float((pred == y).mean())
        acc_source = float((probs.argmax(1) == y).mean())

        was_adapting = bool(self.last and self.last["adapting"])
        self.adapt_windows += int(adapt)
        if adapt and not was_adapting and not shifted:
            self.false_alarms += 1                                    # the gate opened inside a clean window
        self.sum_deployed += acc_deployed
        self.sum_source += acc_source
        self.w += 1

        picks = np.linspace(0, WINDOW - 1, N_THUMBS).astype(int)
        self.last = {
            "window": w, "condition": cond, "severity": sev, "shifted": shifted,
            "ks": ks, "p_value": p_value, "threshold": self.tau, "alarm": ks > self.tau,
            "gate_open": self.gate.open, "adapting": bool(adapt), "just_reset": just_closed,
            "model_state": "adapted" if self.adapter.adapted else "source",
            "tent_steps": self.adapter.steps,
            "acc_deployed": acc_deployed, "acc_source": acc_source,
            "thumbnails": [to_data_uri(x_u8[i]) for i in picks],
            "done": self.w >= self.total, **self.summary(),
        }
        return self.last

    def summary(self) -> dict:
        n = max(1, self.w)
        return {"processed": self.w, "total": self.total,
                "mean_acc_deployed": self.sum_deployed / n, "mean_acc_source": self.sum_source / n,
                "adapt_windows": self.adapt_windows, "false_alarms": self.false_alarms, "resets": self.resets}


class SessionManager:
    def __init__(self):
        self._sessions: dict[str, Session] = {}
        self._lock = threading.Lock()

    def _evict(self) -> None:
        now = time.time()
        for sid in [s for s, v in self._sessions.items() if now - v.touched > SESSION_TTL_SECONDS]:
            del self._sessions[sid]
        while len(self._sessions) >= MAX_SESSIONS:                     # drop the least recently used
            del self._sessions[min(self._sessions, key=lambda s: self._sessions[s].touched)]

    def create(self, scenario: str, order: str, seed: int) -> tuple[str, Session]:
        valid = {s["id"] for s in SCENARIOS}
        if scenario not in valid or order not in ("correlated", "shuffled"):
            raise ValueError("Unknown scenario or ordering.")
        session = Session(scenario, order, seed)
        with self._lock:
            self._evict()
            sid = uuid.uuid4().hex
            self._sessions[sid] = session
        return sid, session

    def get(self, sid: str) -> Session | None:
        session = self._sessions.get(sid)
        if session:
            session.touched = time.time()
        return session


manager = SessionManager()
