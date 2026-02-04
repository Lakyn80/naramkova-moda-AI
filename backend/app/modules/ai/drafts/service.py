# -*- coding: utf-8 -*-
from __future__ import annotations

import re
from typing import Any

from app.modules.ai.rag.service import (
    _contains_emoji,
    _get_title_and_description,
    detect_product_type,
    random_emoji,
    translate_tags_to_czech,
)
from app.modules.ai.rag.vision_client import analyze_image_with_vision, normalize_tags
from app.modules.ai.templates.service import suggest_price


def _strip_emoji(text: str) -> str:
    if not text:
        return text
    return re.sub(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF]", "", text).strip()


def _truncate(text: str, max_len: int) -> str:
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def _build_seo_fields(title: str, description: str, tags: list[str]) -> dict[str, Any]:
    clean_title = _strip_emoji(title)
    clean_desc = " ".join((description or "").replace("\n", " ").split())
    seo_title = _truncate(clean_title or title, 60)
    seo_description = _truncate(clean_desc, 155)
    seo_keywords = ", ".join(tags[:10]) if tags else None
    return {
        "seo_title": seo_title or None,
        "seo_description": seo_description or None,
        "seo_keywords": seo_keywords or None,
    }


def build_draft_from_image(image_path: str) -> dict[str, Any]:
    vision_result = analyze_image_with_vision(image_path)
    raw_tags = normalize_tags(vision_result)
    tags_cz = translate_tags_to_czech(raw_tags)
    product_type = detect_product_type(tags_cz)
    combined_tags = list(dict.fromkeys(tags_cz))

    title, description = _get_title_and_description(product_type, combined_tags)
    if title and not _contains_emoji(title):
        title = f"{random_emoji()} {title}"

    suggested_price = suggest_price(product_type=product_type, combined_tags=combined_tags)
    seo_fields = _build_seo_fields(title, description, combined_tags)

    return {
        "title": title,
        "description": description,
        "product_type": product_type,
        "combined_tags": combined_tags,
        "suggested_price_czk": suggested_price,
        **seo_fields,
    }
