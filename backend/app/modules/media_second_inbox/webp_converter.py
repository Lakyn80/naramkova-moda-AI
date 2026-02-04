from __future__ import annotations

import uuid
from pathlib import Path

from PIL import Image
import pillow_heif

from app.core.paths import UPLOAD_DIR

SECOND_INBOX_WEBP_DIR = UPLOAD_DIR / "second_inbox_webp"


def convert_to_webp(input_path: str) -> str:
    """
    Convert input image to WebP, save under static/uploads/second_inbox_webp,
    delete the original, and return the new WebP absolute path.
    """
    pillow_heif.register_heif_opener()
    src = Path(input_path)
    SECOND_INBOX_WEBP_DIR.mkdir(parents=True, exist_ok=True)
    out_name = f"{uuid.uuid4().hex}.webp"
    out_path = SECOND_INBOX_WEBP_DIR / out_name

    with Image.open(src) as img:
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")
        img.save(out_path, format="WEBP", quality=85, method=6)

    try:
        src.unlink()
    except Exception:
        pass

    return str(out_path)
