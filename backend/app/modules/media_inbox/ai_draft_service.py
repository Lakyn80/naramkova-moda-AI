from __future__ import annotations

from typing import Any

from app.modules.ai.rag.service import (
    _contains_emoji,
    _get_title_and_description,
    detect_product_type,
    random_emoji,
    translate_tags_to_czech,
)
from app.modules.ai.rag.vision_client import analyze_image_with_vision, normalize_tags


def generate_draft_for_inbox_image(image_path: str) -> dict[str, Any]:
    vision_result = analyze_image_with_vision(image_path)
    raw_tags = normalize_tags(vision_result)
    tags_cz = translate_tags_to_czech(raw_tags)
    product_type = detect_product_type(tags_cz)
    combined_tags = list(dict.fromkeys(tags_cz))

    title, description = _get_title_and_description(product_type, combined_tags)
    if title and not _contains_emoji(title):
        title = f"{random_emoji()} {title}"

    return {
        "title": title,
        "description": description,
        "product_type": product_type,
        "combined_tags": combined_tags,
    }
