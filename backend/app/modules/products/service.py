from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session, selectinload

from app.db.models import Product, ProductMedia, ProductVariant, ProductVariantMedia


def _variant_media_dict(media: ProductVariantMedia) -> dict[str, Any]:
    return {
        "id": media.id,
        "image": media.filename,
        "image_url": f"/static/uploads/{media.filename}" if media.filename else None,
    }


def _variant_dict(variant: ProductVariant) -> dict[str, Any]:
    return {
        "id": variant.id,
        "variant_name": variant.variant_name,
        "wrist_size": variant.wrist_size,
        "description": variant.description,
        "price_czk": float(variant.price_czk) if variant.price_czk is not None else None,
        "stock": variant.stock,
        "image": variant.image,
        "image_url": f"/static/uploads/{variant.image}" if variant.image else None,
        "media": [_variant_media_dict(m) for m in (variant.media or [])],
    }


def _product_dict(product: Product) -> dict[str, Any]:
    category_name = product.category.name if product.category else None
    category_group = product.category.group if product.category else None

    return {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "price": float(product.price_czk) if product.price_czk is not None else None,
        "stock": product.stock,
        "category_id": product.category_id,
        "category_name": category_name,
        "category_slug": getattr(product.category, "slug", None),
        "wrist_size": product.wrist_size,
        "image_url": f"/static/uploads/{product.image}" if product.image else None,
        "media": [f"/static/uploads/{m.filename}" for m in (product.media or [])],
        "categories": ([category_name] if category_name else []),
        "category_group": category_group,
        "variants": [_variant_dict(v) for v in (product.variants or [])],
    }


def list_products(db: Session) -> list[dict[str, Any]]:
    items = (
        db.query(Product)
        .options(
            selectinload(Product.media),
            selectinload(Product.category),
            selectinload(Product.variants).selectinload(ProductVariant.media),
        )
        .filter(Product.stock > 0)
        .order_by(Product.id.desc())
        .all()
    )
    return [_product_dict(p) for p in items]


def get_product(db: Session, product_id: int) -> dict[str, Any] | None:
    product = (
        db.query(Product)
        .options(
            selectinload(Product.media),
            selectinload(Product.category),
            selectinload(Product.variants).selectinload(ProductVariant.media),
        )
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        return None
    return _product_dict(product)
