from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.paths import UPLOAD_DIR
from app.db.models import MediaInboxItem, Product, ProductMedia, ProductVariant
from app.db.session import get_db
from .ai_draft_service import generate_draft_for_inbox_image
from .inbox_repository import add_inbox_item, get_pending_items
from .webp_converter import convert_to_webp

router = APIRouter(prefix="/api/media-inbox", tags=["media-inbox"])


class AssignInboxRequest(BaseModel):
    inbox_item_id: int
    create_product: bool = False
    product_id: int | None = None


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
async def upload_media_inbox(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    imported = 0

    for upload in files:
        if not upload or not upload.filename:
            continue
        temp_path = _save_upload_to_temp(upload)
        webp_abs_path = convert_to_webp(temp_path)
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


@router.post("/assign")
async def assign_media_inbox(
    payload: AssignInboxRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        inbox_item = db.get(MediaInboxItem, payload.inbox_item_id)
        if not inbox_item:
            raise HTTPException(status_code=404, detail=f"Inbox item {payload.inbox_item_id} not found")

        if payload.create_product:
            product = Product(
                name=(inbox_item.draft_title or "Untitled"),
                description=inbox_item.draft_description,
                price_czk=0,
                stock=0,
                image=inbox_item.webp_path,
            )
            db.add(product)
            db.flush()

            if product.image:
                db.add(
                    ProductMedia(
                        product_id=product.id,
                        filename=product.image,
                        media_type="image",
                    )
                )

            inbox_item.status = "assigned"
            inbox_item.assigned_product_id = product.id
            inbox_item.assigned_variant_id = None

            db.commit()
            return {"assigned": 1, "product_id": product.id}

        if not payload.product_id:
            raise HTTPException(status_code=400, detail="product_id is required when create_product is false")

        parent = db.get(Product, payload.product_id)
        if not parent:
            raise HTTPException(status_code=404, detail=f"Product {payload.product_id} not found")

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

        db.commit()
        return {"assigned": 1, "variant_id": variant.id}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
