from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from .schemas import ProductCreateIn, ProductOut, ProductUpdateIn
from .service import get_product, list_products

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/", response_model=list[ProductOut])
async def list_products_endpoint(db: Session = Depends(get_db)) -> list[ProductOut]:
    """Legacy: GET /api/products/ (returns only products with stock > 0)."""
    return list_products(db)


@router.get("/{product_id}", response_model=ProductOut)
async def get_product_endpoint(product_id: int, db: Session = Depends(get_db)) -> ProductOut:
    """Legacy: GET /api/products/<int:product_id>."""
    data = get_product(db, product_id)
    if not data:
        raise HTTPException(status_code=404, detail="Not found")
    return data


@router.post("/", response_model=ProductOut, status_code=201)
async def add_product(
    request: Request,
    payload: Optional[ProductCreateIn] = Body(default=None),
) -> ProductOut:
    """
    Legacy: POST /api/products/.
    Accepts JSON or form-data (multipart), including files and variant payloads.
    """
    _ = request
    _ = payload
    raise HTTPException(status_code=501, detail="Not implemented")


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    request: Request,
    payload: Optional[ProductUpdateIn] = Body(default=None),
) -> ProductOut:
    """
    Legacy: PUT /api/products/<int:product_id>.
    Accepts JSON or form-data (multipart), including files and variant payloads.
    """
    _ = request
    _ = payload
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/{product_id}")
async def delete_product(product_id: int) -> dict[str, Any]:
    """Legacy: DELETE /api/products/<int:product_id>."""
    _ = product_id
    raise HTTPException(status_code=501, detail="Not implemented")
