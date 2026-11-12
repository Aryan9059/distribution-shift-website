"""The source classifier. The architecture must match the notebook exactly or the checkpoint will not load."""
import numpy as np
import torch
import torch.nn as nn
import torchvision

from ..config import ARTIFACTS, CFG

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

_MEAN = torch.tensor(CFG["norm_mean"], dtype=torch.float32).view(1, 3, 1, 1).to(device)
_STD = torch.tensor(CFG["norm_std"], dtype=torch.float32).view(1, 3, 1, 1).to(device)


def build_resnet18(num_classes: int = 43) -> nn.Module:
    model = torchvision.models.resnet18(weights=None, num_classes=num_classes)
    model.conv1 = nn.Conv2d(3, 64, kernel_size=3, stride=1, padding=1, bias=False)  # 3x3 stride-1 stem
    model.maxpool = nn.Identity()
    return model


def load_source_model() -> nn.Module:
    model = build_resnet18().to(device)
    model.load_state_dict(torch.load(ARTIFACTS / "resnet18_source.pt", map_location=device))
    return model.eval().requires_grad_(False)


def to_input(X: np.ndarray) -> torch.Tensor:
    """uint8 images (N, H, W, 3) -> normalised float tensor, same preprocessing as training."""
    x = torch.from_numpy(np.ascontiguousarray(X)).to(device).permute(0, 3, 1, 2).float().div_(255)
    return (x - _MEAN) / _STD
