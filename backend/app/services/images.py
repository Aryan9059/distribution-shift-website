import base64
import io

import numpy as np
from PIL import Image, UnidentifiedImageError

from ..config import IMG

MAX_UPLOAD_BYTES = 5 * 1024 * 1024


def to_data_uri(arr: np.ndarray) -> str:
    """uint8 image (H, W, 3) -> PNG data URI."""
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def decode_upload(data: bytes) -> np.ndarray:
    """Uploaded file -> uint8 (IMG, IMG, 3), resized the same way as the training data."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("Image is larger than 5 MB.")
    try:
        with Image.open(io.BytesIO(data)) as im:
            return np.asarray(im.convert("RGB").resize((IMG, IMG), Image.BILINEAR))
    except (UnidentifiedImageError, OSError) as e:
        raise ValueError("Could not read this file as an image.") from e
