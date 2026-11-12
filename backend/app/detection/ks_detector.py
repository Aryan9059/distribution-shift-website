"""Primary detector: two-sample KS distance between a window's prediction entropies and the clean reference."""
import numpy as np
import torch
import torch.nn.functional as F
from scipy import stats

from .entropy import entropy


@torch.no_grad()
def softmax_probs(model, x: torch.Tensor) -> np.ndarray:
    return F.softmax(model(x), dim=1).double().cpu().numpy()


class EntropyKS:
    def __init__(self, reference_entropy: np.ndarray):
        self.ref = np.asarray(reference_entropy, dtype=np.float64)

    def score(self, probs: np.ndarray) -> tuple[float, float]:
        r = stats.ks_2samp(self.ref, entropy(probs), method="asymp")
        return float(r.statistic), float(r.pvalue)
