from __future__ import annotations

import logging
import os
import tempfile
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.paths import UPLOAD_DIR
from app.db.models import (
    MediaInboxItem,
    MediaSecondInboxItem,
    Product,
    ProductMedia,
    ProductVariant,
    ProductVariantMedia,
)
from app.db.session import get_db
from .ai_draft_service import generate_draft_for_inbox_image
from .inbox_repository import add_inbox_item, get_pending_items
from .webp_converter import convert_to_webp

router = APIRouter(prefix="/api/media-inbox", tags=["media-inbox"])
logger = logging.getLogger(__name__)


class AssignInboxItem(BaseModel):
    inbox_id: int
    assign_as: str
    parent_product_id: int | None = None


class AssignInboxRequest(BaseModel):
    items: list[AssignInboxItem]


class DeleteBatchRequest(BaseModel):
    ids: list[int]


class MoveBatchRequest(BaseModel):
    ids: list[int]


def _save_upload_to_temp(upload: UploadFile) -> str:
    suffix = os.path.splitext(upload.filename or "")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        for chunk in iter(lambda: upload.file.read(1024 * 1024), b""):
            tmp.write(chunk)
        return tmp.name


def _relative_upload_path(abs_path: str) -> str:
    p = Path(abs_path)
    try:
        rel = p.relative_to(UPLOAD_DIR)
        return rel.as_posix()
    except Exception:
        return p.name


def _abs_upload_path(webp_path: str) -> Path:
    rel = webp_path.replace("\\", "/")
    if rel.startswith("/static/uploads/"):
        rel = rel[len("/static/uploads/") :]
    if rel.startswith("static/uploads/"):
        rel = rel[len("static/uploads/") :]
    rel = rel.lstrip("/")
    return UPLOAD_DIR / rel


def _candidate_paths(webp_path: str) -> list[str]:
    if not webp_path:
        return []
    normalized = webp_path.lstrip("/")
    candidates = {
        webp_path,
        normalized,
        f"/static/uploads/{normalized}",
        f"static/uploads/{normalized}",
        Path(webp_path).name,
    }
    return [c for c in candidates if c]


def _is_file_referenced(db: Session, webp_path: str) -> bool:
    candidates = _candidate_paths(webp_path)
    if not candidates:
        return False
    return any(
        [
            db.query(Product.id).filter(or_(*[Product.image == c for c in candidates])).first(),
            db.query(ProductVariant.id)
            .filter(or_(*[ProductVariant.image == c for c in candidates]))
            .first(),
            db.query(ProductMedia.id)
            .filter(or_(*[ProductMedia.filename == c for c in candidates]))
            .first(),
            db.query(ProductVariantMedia.id)
            .filter(or_(*[ProductVariantMedia.filename == c for c in candidates]))
            .first(),
            db.query(MediaInboxItem.id)
            .filter(or_(*[MediaInboxItem.webp_path == c for c in candidates]))
            .first(),
            db.query(MediaSecondInboxItem.id)
            .filter(or_(*[MediaSecondInboxItem.webp_path == c for c in candidates]))
            .first(),
        ]
    )


def _delete_upload_file_if_unreferenced(db: Session, webp_path: str) -> None:
    if not webp_path:
        return
    if _is_file_referenced(db, webp_path):
        return
    path = _abs_upload_path(webp_path)
    try:
        if path.exists():
            path.unlink()
    except Exception:
        pass


def _resolve_existing_upload_path(webp_path: str) -> Path | None:
    for cand in _candidate_paths(webp_path):
        rel = cand.replace("\\", "/")
        if rel.startswith("/static/uploads/"):
            rel = rel[len("/static/uploads/") :]
        if rel.startswith("static/uploads/"):
            rel = rel[len("static/uploads/") :]
        rel = rel.lstrip("/")
        abs_path = UPLOAD_DIR / rel
        if abs_path.exists():
            return abs_path
    abs_path = Path(webp_path)
    if abs_path.is_absolute() and abs_path.exists():
        return abs_path
    return None


def _move_upload_file(src_path: Path, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / src_path.name
    if dest_path.exists():
        dest_path = dest_dir / f"{uuid.uuid4().hex}{src_path.suffix}"
    src_path.replace(dest_path)
    return dest_path


@router.post("/upload")
async def upload_media_inbox(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    imported = 0

    for upload in files:
        if not upload or not upload.filename:
            continue
        temp_path = _save_upload_to_temp(upload)
        try:
            webp_abs_path = convert_to_webp(temp_path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"{upload.filename}: {exc}") from exc
        draft = generate_draft_for_inbox_image(webp_abs_path)
        webp_rel = _relative_upload_path(webp_abs_path)

        add_inbox_item(db, filename=upload.filename or "", webp_path=webp_rel, draft=draft)
        imported += 1

    pending_count = len(get_pending_items(db))
    return {"imported": imported, "pending_items": pending_count}


@router.get("/pending")
async def list_pending_media_inbox(db: Session = Depends(get_db)) -> dict[str, Any]:
    items = get_pending_items(db)
    return {
        "items": [
            {
                "id": i.id,
                "filename": i.filename,
                "webp_path": i.webp_path,
                "product_type": i.product_type,
                "status": i.status,
            }
            for i in items
            if i is not None and i.id is not None
        ]
    }


@router.post("/delete-batch")
async def delete_media_inbox_batch(
    payload: DeleteBatchRequest, db: Session = Depends(get_db)
) -> dict[str, Any]:
    deleted: list[int] = []
    errors: list[dict[str, Any]] = []
    file_paths: list[str] = []

    for item_id in payload.ids:
        item = db.get(MediaInboxItem, item_id)
        if not item:
            errors.append({"id": item_id, "error": "not found"})
            continue
        file_paths.append(item.webp_path)
        db.delete(item)
        deleted.append(item_id)

    db.commit()

    for path in file_paths:
        _delete_upload_file_if_unreferenced(db, path)

    return {"deleted": deleted, "errors": errors}


@router.delete("/all")
async def delete_media_inbox_all(db: Session = Depends(get_db)) -> dict[str, Any]:
    items = db.query(MediaInboxItem).all()
    file_paths = [item.webp_path for item in items if item.webp_path]

    db.query(MediaInboxItem).delete(synchronize_session=False)
    db.commit()

    for path in file_paths:
        _delete_upload_file_if_unreferenced(db, path)

    inbox_dir = UPLOAD_DIR / "inbox_webp"
    if inbox_dir.exists():
        for path in inbox_dir.rglob("*"):
            if path.is_file():
                rel_path = _relative_upload_path(str(path))
                _delete_upload_file_if_unreferenced(db, rel_path)

    return {"deleted": len(items)}


@router.delete("/{item_id}")
async def delete_media_inbox_item(item_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    item = db.get(MediaInboxItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="not found")
    webp_path = item.webp_path
    db.delete(item)
    db.commit()
    _delete_upload_file_if_unreferenced(db, webp_path)
    return {"deleted_id": item_id}


@router.post("/move-to-second")
async def move_media_inbox_to_second(
    payload: MoveBatchRequest, db: Session = Depends(get_db)
) -> dict[str, Any]:
    moved: list[dict[str, int]] = []
    errors: list[dict[str, Any]] = []

    for item_id in payload.ids:
        src_path: Path | None = None
        dest_path: Path | None = None
        try:
            with db.begin_nested():
                item = db.get(MediaInboxItem, item_id)
                if not item:
                    raise ValueError("not found")
                if item.status != "pending":
                    raise ValueError("item is not pending")

                src_path = _resolve_existing_upload_path(item.webp_path)
                if not src_path:
                    raise ValueError("file not found on disk")

                dest_path = _move_upload_file(src_path, UPLOAD_DIR / "second_inbox_webp")
                new_rel = _relative_upload_path(str(dest_path))

                second_item = MediaSecondInboxItem(
                    filename=item.filename,
                    webp_path=new_rel,
                    draft_title=item.draft_title,
                    draft_description=item.draft_description,
                    product_type=item.product_type,
                    combined_tags=item.combined_tags,
                    status="pending",
                )
                db.add(second_item)
                db.flush()
                db.delete(item)
                moved.append({"from": item_id, "to": second_item.id})
        except Exception as exc:
            if dest_path and src_path and dest_path.exists() and not src_path.exists():
                try:
                    dest_path.replace(src_path)
                except Exception:
                    pass
            errors.append({"id": item_id, "error": str(exc)})
            continue

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))

    if errors:
        logger.warning("media-inbox move-to-second errors: %s", errors)

    return {"moved": moved, "errors": errors}


@router.post("/assign")
async def assign_media_inbox(
    payload: AssignInboxRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        if not payload.items:
            raise HTTPException(status_code=400, detail="items must not be empty")

        created_products: list[int] = []
        created_variants: list[int] = []
        errors: list[dict[str, Any]] = []

        for item in payload.items:
            try:
                with db.begin_nested():
                    assign_as = (item.assign_as or "").strip().lower()
                    if assign_as not in {"product", "variant"}:
                        raise ValueError(
                            f"Invalid assign_as for inbox_id {item.inbox_id}. Use 'product' or 'variant'."
                        )

                    inbox_item = db.get(MediaInboxItem, item.inbox_id)
                    if not inbox_item:
                        raise ValueError(f"Inbox item {item.inbox_id} not found")

                    if assign_as == "product":
                        product = Product(
                            name=(inbox_item.draft_title or "Untitled"),
                            description=inbox_item.draft_description,
                            price_czk=0,
                            stock=0,
                            image=inbox_item.webp_path,
                        )
                        db.add(product)
                        db.flush()

                        inbox_item.status = "assigned"
                        inbox_item.assigned_product_id = product.id
                        inbox_item.assigned_variant_id = None
                        created_products.append(product.id)
                        continue

                    if not item.parent_product_id:
                        raise ValueError(
                            f"parent_product_id is required for inbox_id {item.inbox_id} when assign_as='variant'"
                        )

                    parent = db.get(Product, item.parent_product_id)
                    if not parent:
                        raise ValueError(
                            f"Product {item.parent_product_id} not found for inbox_id {item.inbox_id}"
                        )

                    variant = ProductVariant(
                        product_id=parent.id,
                        variant_name=inbox_item.draft_title,
                        description=inbox_item.draft_description,
                        image=inbox_item.webp_path,
                        stock=0,
                    )
                    db.add(variant)
                    db.flush()

                    inbox_item.status = "assigned"
                    inbox_item.assigned_variant_id = variant.id
                    inbox_item.assigned_product_id = None
                    created_variants.append(variant.id)
            except Exception as exc:
                errors.append({"inbox_id": item.inbox_id, "error": str(exc)})
                continue

        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(exc))

        return {
            "assigned": len(created_products) + len(created_variants),
            "product_ids": created_products,
            "variant_ids": created_variants,
            "errors": errors,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
