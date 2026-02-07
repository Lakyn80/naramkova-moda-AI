from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any, Iterable

from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import UploadFile
from sqlalchemy.orm import Session, selectinload

from app.core.paths import UPLOAD_DIR
from app.db.models import Product, ProductMedia, ProductVariant, ProductVariantMedia


def _ensure_uploads_dir() -> Path:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return UPLOAD_DIR


def _safe_uuid_name(filename: str | None) -> str:
    ext = ""
    if filename:
        _, ext = os.path.splitext(filename)
    if not ext:
        ext = ".bin"
    return f"{uuid.uuid4().hex}{ext.lower()}"


def _normalize_upload_filename(value: str | None) -> str | None:
    if not value:
        return None
    v = str(value).replace("\\", "/").strip()
    if "/static/uploads/" in v:
        v = v.split("/static/uploads/")[-1]
    if "static/uploads/" in v:
        v = v.split("static/uploads/")[-1]
    v = v.lstrip("/")
    while v.startswith("uploads/"):
        v = v[len("uploads/"):]
    return v or None


def _ensure_webp_filename(filename: str | None) -> str | None:
    if not filename:
        return None
    lower = filename.lower()
    if lower.endswith(".webp"):
        return filename
    base, ext = os.path.splitext(filename)
    if not base:
        return None
    src_path = UPLOAD_DIR / filename
    webp_name = f"{base}.webp"
    webp_path = UPLOAD_DIR / webp_name
    if webp_path.exists():
        return webp_name
    if not src_path.exists():
        return None

    try:
        webp_path.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(src_path) as img:
            img = ImageOps.exif_transpose(img)

            if img.mode in ("I;16", "I", "F"):
                img = img.convert("RGB")
            elif img.mode in ("P", "LA"):
                img = img.convert("RGBA")
            elif img.mode == "CMYK":
                img = img.convert("RGB")

            save_kwargs: dict[str, Any] = {
                "format": "WEBP",
                "method": 6,
                "optimize": True,
            }
            icc = img.info.get("icc_profile")
            if icc:
                save_kwargs["icc_profile"] = icc
            try:
                exif = img.getexif()
                if exif:
                    save_kwargs["exif"] = exif.tobytes()
            except Exception:
                pass

            ext = ext.lower()
            if ext in (".jpg", ".jpeg", ".heic", ".heif"):
                save_kwargs["lossless"] = False
                save_kwargs["quality"] = 72
            elif ext == ".png":
                if img.mode in ("RGBA", "LA"):
                    save_kwargs["lossless"] = True
                else:
                    save_kwargs["lossless"] = True
                    save_kwargs["quality"] = 90
            else:
                save_kwargs["lossless"] = False
                save_kwargs["quality"] = 72

            img.save(webp_path, **save_kwargs)
        return webp_name
    except (UnidentifiedImageError, OSError, ValueError):
        return None


def _save_upload_file(upload: UploadFile) -> str:
    _ensure_uploads_dir()
    filename = _safe_uuid_name(upload.filename)
    target = UPLOAD_DIR / filename
    with target.open("wb") as f:
        for chunk in iter(lambda: upload.file.read(1024 * 1024), b""):
            f.write(chunk)
    return filename


def _detect_media_type(filename: str | None, mimetype: str | None) -> str:
    mt = (mimetype or "").lower()
    if mt.startswith("video/"):
        return "video"
    if mt.startswith("image/"):
        return "image"
    ext = os.path.splitext(filename or "")[1].lower()
    if ext in {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}:
        return "video"
    return "image"


def _ensure_product_media_row(
    db: Session,
    *,
    product_id: int,
    filename: str | None,
    media_type: str | None,
) -> None:
    if not filename:
        return
    mt = (media_type or "image").strip() or "image"
    exists = (
        db.query(ProductMedia)
        .filter_by(product_id=product_id, filename=filename)
        .first()
    )
    if not exists:
        db.add(ProductMedia(product_id=product_id, filename=filename, media_type=mt))


def _delete_product_media_row(db: Session, *, product_id: int, filename: str | None) -> None:
    if not filename:
        return
    (
        db.query(ProductMedia)
        .filter_by(product_id=product_id, filename=filename)
        .delete(synchronize_session=False)
    )


def _listify(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _to_int(val, default=None):
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _to_price(val):
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _to_bool(val, default=None):
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    if s in ("1", "true", "t", "yes", "y", "on"):
        return True
    if s in ("0", "false", "f", "no", "n", "off"):
        return False
    return default


def _parse_variants_from_form(
    form: dict[str, Any],
    files: dict[str, list[UploadFile]],
    *,
    is_add_request: bool,
) -> tuple[list[dict[str, Any]], bool]:
    variants: list[dict[str, Any]] = []
    explicit = False

    raw_form_variants = form.get("variants")
    if raw_form_variants is not None:
        try:
            parsed = json.loads(raw_form_variants) or []
            if isinstance(parsed, list):
                explicit = True
                for v in parsed:
                    if not isinstance(v, dict):
                        continue
                    variants.append(
                        {
                            "variant_name": (v.get("variant_name") or v.get("name") or "").strip() or None,
                            "wrist_size": (v.get("wrist_size") or "").strip() or None,
                            "description": (v.get("description") or "").strip() or None,
                            "price_czk": _to_price(v.get("price_czk") or v.get("price")),
                            "stock": _to_int(v.get("stock"), default=0),
                            "image": (v.get("image") or "").strip() or None,
                        }
                    )
        except Exception:
            pass

    names = _listify(form.get("variant_name[]"))
    wrists = _listify(form.get("variant_wrist_size[]"))
    stocks = _listify(form.get("variant_stock[]"))
    descriptions = _listify(form.get("variant_description[]"))
    prices = _listify(form.get("variant_price[]"))
    main_files = _listify(files.get("variant_image[]"))

    if any([names, wrists, stocks, descriptions, prices, main_files]):
        explicit = True

    max_len = max(len(names), len(wrists), len(stocks), len(descriptions), len(prices))
    if max_len == 0 and main_files:
        max_len = len(main_files)

    existing_main = [] if is_add_request else _listify(form.get("variant_image_existing[]"))

    for i in range(max_len):
        n = names[i] if i < len(names) else ""
        w = wrists[i] if i < len(wrists) else ""
        s_raw = stocks[i] if i < len(stocks) else None
        s_val = _to_int(s_raw, default=0)
        desc = descriptions[i] if i < len(descriptions) else None
        price_val = prices[i] if i < len(prices) else None
        f = main_files[i] if i < len(main_files) else None
        has_file = bool(f and getattr(f, "filename", None))
        existing = existing_main[i] if i < len(existing_main) else None

        extra_files = _listify(files.get(f"variant_image_multi_{i}[]"))
        extra_existing = [] if is_add_request else _listify(form.get(f"variant_image_existing_multi_{i}[]"))

        if not (n or w or has_file or existing or price_val):
            continue

        variants.append(
            {
                "variant_name": (n or None),
                "wrist_size": (w or None),
                "description": (desc or None),
                "price_czk": _to_price(price_val),
                "stock": s_val if s_val is not None else 0,
                "image_file": f if has_file else None,
                "existing_image": None if is_add_request else (existing or None),
                "extra_files": [ef for ef in extra_files if getattr(ef, "filename", None)],
                "existing_extra": [] if is_add_request else [ee for ee in extra_existing if ee],
            }
        )

    return variants, explicit


def _parse_variants_from_json(payload: dict[str, Any]) -> tuple[list[dict[str, Any]], bool]:
    variants: list[dict[str, Any]] = []
    explicit = False

    raw_list = payload.get("variants") or []
    if isinstance(raw_list, list):
        explicit = True
        for v in raw_list:
            if not isinstance(v, dict):
                continue
            variants.append(
                {
                    "variant_name": (v.get("variant_name") or v.get("name") or "").strip() or None,
                    "wrist_size": (v.get("wrist_size") or "").strip() or None,
                    "description": (v.get("description") or "").strip() or None,
                    "price_czk": _to_price(v.get("price_czk") or v.get("price")),
                    "stock": _to_int(v.get("stock"), default=0),
                    "image": (v.get("image") or "").strip() or None,
                }
            )

    return variants, explicit


def _dedupe_variants(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple] = set()
    result: list[dict[str, Any]] = []
    for v in items:
        key = (
            (v.get("variant_name") or "").strip().lower(),
            (v.get("wrist_size") or "").strip().lower(),
            (v.get("description") or "").strip().lower(),
            float(v["price_czk"]) if v.get("price_czk") is not None else None,
            int(v.get("stock")) if v.get("stock") is not None else None,
            (v.get("existing_image") or v.get("image") or "").strip().lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(v)
    return result


def _variant_media_dict(media: ProductVariantMedia) -> dict[str, Any]:
    webp_name = _ensure_webp_filename(media.filename)
    return {
        "id": media.id,
        "image": media.filename,
        "image_url": f"/static/uploads/{webp_name}" if webp_name else None,
    }


def _variant_dict(variant: ProductVariant) -> dict[str, Any]:
    webp_image = _ensure_webp_filename(variant.image)
    return {
        "id": variant.id,
        "variant_name": variant.variant_name,
        "wrist_size": variant.wrist_size,
        "description": variant.description,
        "price_czk": float(variant.price_czk) if variant.price_czk is not None else None,
        "stock": variant.stock,
        "image": variant.image,
        "image_url": f"/static/uploads/{webp_image}" if webp_image else None,
        "media": [_variant_media_dict(m) for m in (variant.media or [])],
    }


def _product_dict(product: Product) -> dict[str, Any]:
    category_name = product.category.name if product.category else None
    category_group = product.category.group if product.category else None
    webp_image = _ensure_webp_filename(product.image)

    return {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "seo_title": product.seo_title,
        "seo_description": product.seo_description,
        "seo_keywords": product.seo_keywords,
        "price": float(product.price_czk) if product.price_czk is not None else None,
        "stock": product.stock,
        "active": bool(getattr(product, "active", True)),
        "category_id": product.category_id,
        "category_name": category_name,
        "category_slug": getattr(product.category, "slug", None),
        "wrist_size": product.wrist_size,
        "image_url": f"/static/uploads/{webp_image}" if webp_image else None,
        "media": [
            f"/static/uploads/{webp_name}"
            for m in (product.media or [])
            for webp_name in (_ensure_webp_filename(m.filename),)
            if webp_name
        ],
        "media_items": [
            {
                "id": m.id,
                "filename": m.filename,
                "media_type": m.media_type,
                "url": f"/static/uploads/{webp_name}" if webp_name else None,
            }
            for m in (product.media or [])
            for webp_name in (_ensure_webp_filename(m.filename),)
        ],
        "categories": ([category_name] if category_name else []),
        "category_group": category_group,
        "variants": [_variant_dict(v) for v in (product.variants or [])],
    }


def list_products(db: Session, *, include_inactive: bool = False) -> list[dict[str, Any]]:
    q = (
        db.query(Product)
        .options(
            selectinload(Product.media),
            selectinload(Product.category),
            selectinload(Product.variants).selectinload(ProductVariant.media),
        )
    )
    if not include_inactive and hasattr(Product, "active"):
        q = q.filter(Product.active.is_(True))

    items = q.order_by(Product.id.desc()).all()
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


def create_product(
    db: Session,
    *,
    payload: dict[str, Any],
    form: dict[str, Any] | None,
    files: dict[str, list[UploadFile]] | None,
) -> dict[str, Any]:
    data = payload or {}
    form = form or {}
    files = files or {}

    name = (data.get("name") or form.get("name") or "").strip()
    description = (data.get("description") or form.get("description") or "").strip()
    seo_title = (data.get("seo_title") or form.get("seo_title") or "").strip()
    seo_description = (data.get("seo_description") or form.get("seo_description") or "").strip()
    seo_keywords = (data.get("seo_keywords") or form.get("seo_keywords") or "").strip()
    price_raw = str(
        data.get("price")
        or data.get("price_czk")
        or form.get("price")
        or form.get("price_czk")
        or ""
    ).strip()
    stock_raw = str(data.get("stock") or form.get("stock") or "").strip()
    active_raw = data.get("active") if "active" in data else form.get("active")
    category_id = data.get("category_id") or form.get("category_id")
    wrist_size_raw = (
        data.get("wrist_size")
        or data.get("wrist_sizes")
        or form.get("wrist_size")
        or form.get("wrist_sizes")
        or ""
    ).strip()

    if not name or not price_raw or not category_id:
        raise ValueError("Missing required fields")

    try:
        price = float(price_raw)
    except ValueError as exc:
        raise ValueError("Invalid price") from exc

    try:
        stock = int(stock_raw) if stock_raw else 1
        if stock < 0:
            raise ValueError
    except ValueError as exc:
        raise ValueError("Invalid stock") from exc

    try:
        category_id_int = int(category_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid category_id") from exc

    product = Product(
        name=name,
        description=(description or None),
        seo_title=(seo_title or None),
        seo_description=(seo_description or None),
        seo_keywords=(seo_keywords or None),
        price_czk=price,
        stock=stock,
        active=_to_bool(active_raw, default=True),
        category_id=category_id_int,
        wrist_size=wrist_size_raw or None,
    )

    main_image_media_type: str | None = None
    image_file = (files.get("image") or [None])[0]
    if image_file and image_file.filename:
        product.image = _save_upload_file(image_file)
        main_image_media_type = _detect_media_type(product.image, getattr(image_file, "content_type", None))

    variants_payload, explicit_variants = _parse_variants_from_json(data)
    if form:
        form_variants, explicit_form = _parse_variants_from_form(form, files, is_add_request=True)
        if explicit_form:
            variants_payload = form_variants
            explicit_variants = True

    variants_payload = _dedupe_variants(variants_payload)

    try:
        db.add(product)
        db.flush()

        if product.image:
            _ensure_product_media_row(
                db,
                product_id=product.id,
                filename=product.image,
                media_type=main_image_media_type or "image",
            )

        for variant in variants_payload:
            img_name = _normalize_upload_filename(variant.get("image") or None)
            if variant.get("image_file"):
                img_name = _save_upload_file(variant["image_file"])

            if not (
                variant.get("variant_name")
                or variant.get("wrist_size")
                or img_name
                or variant.get("price_czk") is not None
            ):
                continue

            v_obj = ProductVariant(
                product_id=product.id,
                variant_name=variant.get("variant_name"),
                wrist_size=variant.get("wrist_size"),
                description=variant.get("description"),
                price_czk=variant.get("price_czk"),
                stock=variant.get("stock") or 0,
                image=img_name,
            )
            db.add(v_obj)

            for ef in variant.get("extra_files") or []:
                saved = _save_upload_file(ef)
                db.add(ProductVariantMedia(variant=v_obj, filename=saved))

        for mf in files.get("media", []):
            if not mf or not mf.filename:
                continue
            media_type = _detect_media_type(mf.filename, getattr(mf, "content_type", None))
            saved_name = _save_upload_file(mf)
            db.add(ProductMedia(product_id=product.id, filename=saved_name, media_type=media_type))

        db.commit()
        db.refresh(product)
        return get_product(db, product.id) or _product_dict(product)
    except Exception:
        db.rollback()
        raise


def _collect_variant_files(variants: Iterable[ProductVariant]) -> set[str]:
    files: set[str] = set()
    for variant in variants:
        if variant.image:
            files.add(variant.image)
        for media in list(variant.media or []):
            if media.filename:
                files.add(media.filename)
    return files


def _remove_files(filenames: Iterable[str]) -> None:
    for fname in filenames:
        if not fname:
            continue
        try:
            path = UPLOAD_DIR / fname
            if path.exists():
                path.unlink()
        except Exception:
            pass


def update_product(
    db: Session,
    *,
    product_id: int,
    payload: dict[str, Any],
    form: dict[str, Any] | None,
    files: dict[str, list[UploadFile]] | None,
) -> dict[str, Any] | None:
    product = (
        db.query(Product)
        .options(
            selectinload(Product.media),
            selectinload(Product.variants).selectinload(ProductVariant.media),
        )
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        return None

    data = payload or {}
    form = form or {}
    files = files or {}

    clear_variants_flag = str(form.get("clear_variants") or data.get("clear_variants") or "").strip() == "1"
    delete_image_flag = str(form.get("delete_image") or data.get("delete_image") or "").strip() == "1"

    name = (data.get("name") or form.get("name") or "").strip()
    description = (data.get("description") or form.get("description") or "").strip()
    seo_title = (data.get("seo_title") or form.get("seo_title") or "").strip()
    seo_description = (data.get("seo_description") or form.get("seo_description") or "").strip()
    seo_keywords = (data.get("seo_keywords") or form.get("seo_keywords") or "").strip()
    price_raw = str(
        data.get("price")
        or data.get("price_czk")
        or form.get("price")
        or form.get("price_czk")
        or ""
    ).strip()
    stock_raw = str(data.get("stock") or form.get("stock") or "").strip()
    active_raw = data.get("active") if "active" in data else form.get("active")
    category_id = data.get("category_id") or form.get("category_id")
    wrist_size_raw = (
        data.get("wrist_size")
        or data.get("wrist_sizes")
        or form.get("wrist_size")
        or form.get("wrist_sizes")
        or ""
    ).strip()
    wrist_size_present = any(key in data or key in form for key in ("wrist_size", "wrist_sizes"))

    variants_payload, variants_explicit = _parse_variants_from_json(data)
    if form:
        form_variants, explicit_form = _parse_variants_from_form(form, files, is_add_request=False)
        if explicit_form:
            variants_payload = form_variants
            variants_explicit = True

    if clear_variants_flag:
        variants_payload = []
        variants_explicit = True

    variants_payload = _dedupe_variants(variants_payload)

    try:
        if name:
            product.name = name
        if description or "description" in data or "description" in form:
            product.description = description or None
        if "seo_title" in data or "seo_title" in form:
            product.seo_title = seo_title or None
        if "seo_description" in data or "seo_description" in form:
            product.seo_description = seo_description or None
        if "seo_keywords" in data or "seo_keywords" in form:
            product.seo_keywords = seo_keywords or None
        if wrist_size_present:
            product.wrist_size = wrist_size_raw or None
        if price_raw:
            try:
                product.price_czk = float(price_raw)
            except ValueError as exc:
                raise ValueError("Invalid price") from exc
        if stock_raw:
            try:
                stock = int(stock_raw)
                if stock < 0:
                    raise ValueError
                product.stock = stock
            except ValueError as exc:
                raise ValueError("Invalid stock") from exc
        if "active" in data or "active" in form:
            active_val = _to_bool(active_raw, default=None)
            if active_val is not None:
                product.active = active_val
        if category_id:
            try:
                product.category_id = int(category_id)
            except (TypeError, ValueError) as exc:
                raise ValueError("Invalid category_id") from exc

        if delete_image_flag and product.image:
            old_image = product.image
            _remove_files([old_image])
            _delete_product_media_row(db, product_id=product.id, filename=old_image)
            product.image = None

        image_file = (files.get("image") or [None])[0]
        if image_file and image_file.filename:
            old_image = product.image
            new_image = _save_upload_file(image_file)
            product.image = new_image

            _ensure_product_media_row(
                db,
                product_id=product.id,
                filename=new_image,
                media_type=_detect_media_type(new_image, getattr(image_file, "content_type", None)),
            )

            if old_image and old_image != new_image:
                _remove_files([old_image])
                _delete_product_media_row(db, product_id=product.id, filename=old_image)

        if variants_explicit:
            old_variants = list(product.variants or [])
            existing_files = _collect_variant_files(old_variants)

            product.variants.clear()
            new_files: set[str] = set()

            for variant in variants_payload:
                img_name = _normalize_upload_filename(
                    variant.get("image") or variant.get("existing_image") or None
                )
                if variant.get("image_file"):
                    img_name = _save_upload_file(variant["image_file"])

                if not (
                    variant.get("variant_name")
                    or variant.get("wrist_size")
                    or img_name
                    or variant.get("price_czk") is not None
                ):
                    continue

                if img_name:
                    new_files.add(img_name)

                extra_existing = [
                    v for v in (
                        _normalize_upload_filename(ee) for ee in (variant.get("existing_extra") or [])
                    )
                    if v
                ]
                extra_saved: list[str] = []
                for ef in variant.get("extra_files") or []:
                    saved = _save_upload_file(ef)
                    extra_saved.append(saved)

                new_files.update(extra_existing)
                new_files.update(extra_saved)

                v_obj = ProductVariant(
                    product_id=product.id,
                    variant_name=variant.get("variant_name"),
                    wrist_size=variant.get("wrist_size"),
                    description=variant.get("description"),
                    price_czk=variant.get("price_czk"),
                    stock=variant.get("stock") or 0,
                    image=img_name,
                )
                db.add(v_obj)

                for fn in extra_existing:
                    db.add(ProductVariantMedia(variant=v_obj, filename=fn))
                for fn in extra_saved:
                    db.add(ProductVariantMedia(variant=v_obj, filename=fn))

            _remove_files(existing_files - new_files)

        for mf in files.get("media", []):
            if not mf or not mf.filename:
                continue
            media_type = _detect_media_type(mf.filename, getattr(mf, "content_type", None))
            saved_name = _save_upload_file(mf)
            db.add(ProductMedia(product_id=product.id, filename=saved_name, media_type=media_type))

        db.commit()
        db.refresh(product)
        return get_product(db, product.id) or _product_dict(product)
    except Exception:
        db.rollback()
        raise


def delete_product(db: Session, product_id: int, *, commit: bool = True) -> bool:
    product = (
        db.query(Product)
        .options(
            selectinload(Product.media),
            selectinload(Product.variants).selectinload(ProductVariant.media),
        )
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        return False

    try:
        files_to_remove: set[str] = set()
        if product.image:
            files_to_remove.add(product.image)

        for media in list(product.media or []):
            if media.filename:
                files_to_remove.add(media.filename)
            db.delete(media)

        for variant in list(product.variants or []):
            if variant.image:
                files_to_remove.add(variant.image)
            for vm in list(variant.media or []):
                if vm.filename:
                    files_to_remove.add(vm.filename)
                db.delete(vm)
            db.delete(variant)

        db.delete(product)
        if commit:
            db.commit()

        _remove_files(files_to_remove)
        return True
    except Exception:
        db.rollback()
        raise
