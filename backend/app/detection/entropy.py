import numpy as np


def entropy(p: np.ndarray) -> np.ndarray:
    """Prediction entropy of each softmax row, in nats."""
    return -(p * np.log(p + 1e-12)).sum(axis=1)
