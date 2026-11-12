"""TENT (Wang et al., ICLR 2021): minimise prediction entropy by updating only the BatchNorm scale and shift.

The deployed copy is created lazily on the first update, so a session that never adapts costs no memory.
reset() drops the copy and the optimizer; the next update starts again from the untouched source weights.
"""
import copy

import torch
import torch.nn as nn


def softmax_entropy(logits: torch.Tensor) -> torch.Tensor:
    return -(logits.softmax(1) * logits.log_softmax(1)).sum(1)


class TentAdapter:
    def __init__(self, source: nn.Module, lr: float):
        self.source, self.lr = source, lr
        self.model = None
        self.opt = None
        self.steps = 0

    def reset(self) -> None:
        self.model, self.opt, self.steps = None, None, 0

    def _build(self) -> None:
        self.model = copy.deepcopy(self.source).train().requires_grad_(False)
        params = []
        for mod in self.model.modules():
            if isinstance(mod, nn.BatchNorm2d):
                mod.track_running_stats = False   # always use the statistics of the current window
                mod.running_mean, mod.running_var = None, None
                mod.weight.requires_grad_(True)
                mod.bias.requires_grad_(True)
                params += [mod.weight, mod.bias]
        self.opt = torch.optim.Adam(params, lr=self.lr, betas=(0.9, 0.999))

    @property
    def adapted(self) -> bool:
        return self.steps > 0

    def step(self, x: torch.Tensor) -> torch.Tensor:
        """One entropy-minimisation step. The window is predicted in the same forward pass."""
        if self.model is None:
            self._build()
        logits = self.model(x)
        loss = softmax_entropy(logits).mean()
        self.opt.zero_grad()
        loss.backward()
        self.opt.step()
        self.steps += 1
        return logits.detach()

    @torch.no_grad()
    def predict(self, x: torch.Tensor) -> torch.Tensor:
        # Before the first update (or after a reset) the deployed model is exactly the source model.
        return self.source(x) if self.steps == 0 else self.model(x)
