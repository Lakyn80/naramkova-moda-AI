from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session, selectinload

from app.db.models import Category, Product, ProductVariant
from app.modules.products.service import _product_dict


def _cat_to_dict(category: Category) -> dict[str, Any]:
    return {
        "id": category.id,
        "name": category.name,
        "description": getattr(category, "description", None),
        "slug": getattr(category, "slug", None),
        "group": getattr(category, "group", None),
        "category": getattr(category, "group", None),
    }


def list_categories(db: Session, group: Optional[str]) -> list[dict[str, Any]]:
    q = db.query(Category)
    if group:
        q = q.filter(Category.group == group)
    items = q.order_by(Category.name.asc()).all()
    return [_cat_to_dict(c) for c in items]


def get_category_by_id(db: Session, category_id: int) -> dict[str, Any] | None:
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        return None
    return _cat_to_dict(cat)


def get_category_by_slug(db: Session, slug: str, wrist_size: Optional[str]) -> dict[str, Any] | None:
    cat = db.query(Category).filter(Category.slug == str(slug).strip()).first()
    if not cat:
        return None

    products_q = (
        db.query(Product)
        .options(
            selectinload(Product.media),
            selectinload(Product.category),
            selectinload(Product.variants).selectinload(ProductVariant.media),
        )
        .filter(Product.category_id == cat.id, Product.stock > 0)
    )

    if wrist_size:
        products_q = (
            products_q.join(ProductVariant, ProductVariant.product_id == Product.id)
            .filter(ProductVariant.wrist_size == wrist_size)
            .distinct()
        )

    products = products_q.order_by(Product.id.desc()).all()

    return {
        "category": _cat_to_dict(cat),
        "products": [_product_dict(p) for p in products],
    }
