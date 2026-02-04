from __future__ import annotations

from typing import Any

from app.modules.ai.drafts.service import build_draft_from_image


def generate_draft_for_inbox_image(image_path: str) -> dict[str, Any]:
    return build_draft_from_image(image_path)
