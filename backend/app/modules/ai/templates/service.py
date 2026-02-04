# -*- coding: utf-8 -*-
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional
import uuid

from app.db.models import Product
from app.modules.ai.rag.seed_templates import _get_product_type_from_category

from .repository import add_template, list_templates, search_templates

PRICE_DISTANCE_THRESHOLD = float(os.getenv("TEMPLATE_PRICE_DISTANCE_THRESHOLD", "0.6"))


def _build_template_text(
    *,
    title: str,
    description: str,
    product_type: str,
    price_czk: Optional[float],
) -> str:
    return (
        f"TITLE: {title}\n"
        f"DESCRIPTION: {description}\n"
        f"PRODUCT_TYPE: {product_type}\n"
        f"PRICE_CZK: {price_czk if price_czk is not None else 'N/A'}"
    )


def store_template_for_product(db, product_id: int) -> dict[str, Any]:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ValueError("Product not found")

    title = (product.name or "").strip()
    description = (product.description or "").strip()
    if not title or not description:
        raise ValueError("Product must have name and description")

    product_type = (
        _get_product_type_from_category(getattr(product, "category", None))
        if getattr(product, "category", None)
        else "other"
    )
    price_czk = float(product.price_czk) if product.price_czk is not None else None

    created_at = datetime.now(timezone.utc).isoformat()
    doc_id = f"tpl_{product.id}_{uuid.uuid4().hex[:8]}"
    text = _build_template_text(
        title=title,
        description=description,
        product_type=product_type,
        price_czk=price_czk,
    )
    metadata = {
        "product_id": product.id,
        "title": title,
        "product_type": product_type,
        "price_czk": price_czk,
        "created_at": created_at,
    }

    add_template(doc_id, text, metadata)
    return {"id": doc_id, **metadata}


def list_template_items() -> list[dict[str, Any]]:
    items = list_templates()
    # drop document field in response to keep payload light
    for item in items:
        item.pop("document", None)
    return items


def suggest_price(
    *,
    product_type: str,
    combined_tags: list[str],
) -> Optional[float]:
    query_text = f"{product_type}\n{', '.join(combined_tags or [])}".strip()
    result = search_templates(query_text, product_type=product_type, n_results=1)
    if not result:
        return None
    distances = result.get("distances") or []
    metadatas = result.get("metadatas") or []
    if not distances or not metadatas or not distances[0] or not metadatas[0]:
        return None
    distance = distances[0][0] if distances[0] else None
    meta = metadatas[0][0] if metadatas[0] else None
    if distance is None or meta is None:
        return None
    if distance > PRICE_DISTANCE_THRESHOLD:
        return None
    price = meta.get("price_czk") if isinstance(meta, dict) else None
    try:
        return float(price) if price is not None else None
    except (TypeError, ValueError):
        return None
