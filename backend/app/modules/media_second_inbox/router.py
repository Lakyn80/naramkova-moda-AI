from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.paths import UPLOAD_DIR
from app.db.models import MediaSecondInboxItem, Product, ProductMedia, ProductVariant, ProductVariantMedia
from app.db.session import get_db
from .inbox_repository import add_inbox_item, get_pending_items
from .webp_converter import convert_to_webp

router = APIRouter(prefix="/api/media-second", tags=["media-second-inbox"])


class AssignSecondInboxRequest(BaseModel):
    inbox_item_id: int
    product_id: int | None = None
    variant_id: int | None = None


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


@router.post("/upload")
async def upload_media_second_inbox(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    imported = 0

    for upload in files:
        if not upload or not upload.filename:
            continue
        temp_path = _save_upload_to_temp(upload)
        webp_abs_path = convert_to_webp(temp_path)
        webp_rel = _relative_upload_path(webp_abs_path)

        add_inbox_item(db, webp_path=webp_rel)
        imported += 1

    pending_count = len(get_pending_items(db))
    return {"imported": imported, "pending_items": pending_count}


@router.get("/pending")
async def list_pending_media_second_inbox(db: Session = Depends(get_db)) -> dict[str, Any]:
    items = get_pending_items(db)
    return {
        "items": [
            {
                "id": i.id,
                "filename": Path(i.webp_path).name if i.webp_path else None,
                "webp_path": i.webp_path,
                "status": i.status,
            }
            for i in items
        ]
    }


@router.post("/assign")
async def assign_media_second_inbox(
    payload: AssignSecondInboxRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        inbox_item = db.get(MediaSecondInboxItem, payload.inbox_item_id)
        if not inbox_item:
            raise HTTPException(status_code=404, detail=f"Second inbox item {payload.inbox_item_id} not found")

        if payload.product_id and payload.variant_id:
            raise HTTPException(status_code=400, detail="Provide product_id or variant_id, not both")

        if payload.product_id:
            product = db.get(Product, payload.product_id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {payload.product_id} not found")

            db.add(
                ProductMedia(
                    product_id=product.id,
                    filename=inbox_item.webp_path,
                    media_type="image",
                )
            )
            inbox_item.status = "assigned"
            db.commit()
            return {"assigned": 1, "product_id": product.id}

        if payload.variant_id:
            variant = db.get(ProductVariant, payload.variant_id)
            if not variant:
                raise HTTPException(status_code=404, detail=f"Variant {payload.variant_id} not found")

            db.add(
                ProductVariantMedia(
                    variant_id=variant.id,
                    filename=inbox_item.webp_path,
                )
            )
            inbox_item.status = "assigned"
            db.commit()
            return {"assigned": 1, "variant_id": variant.id}

        raise HTTPException(status_code=400, detail="product_id or variant_id is required")
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
