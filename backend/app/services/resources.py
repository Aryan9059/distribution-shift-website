"""Heavy objects loaded once per process: the source model, the reference entropies and the test pool."""
import threading
from functools import lru_cache

import numpy as np

from ..config import ARTIFACTS
from ..detection.ks_detector import EntropyKS
from ..models.resnet import load_source_model
from ..simulation.streams import TestPool

# One heavy computation at a time keeps a small CPU host responsive when several visitors are active.
COMPUTE_LOCK = threading.Lock()


class Resources:
    def __init__(self):
        self.model = load_source_model()                     # frozen source model, shared read-only
        self.detector = EntropyKS(np.load(ARTIFACTS / "reference_entropy.npy"))
        self.pool = TestPool()


@lru_cache(maxsize=1)
def get_resources() -> Resources:
    return Resources()
