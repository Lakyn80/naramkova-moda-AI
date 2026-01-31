from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from .schemas import CategoryCreateIn, CategoryOut, CategoryUpdateIn, CategoryWithProductsOut
from .service import get_category_by_id, get_category_by_slug, list_categories

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryOut])
async def list_categories_endpoint(
    group: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> list[CategoryOut]:
    """Legacy: GET /api/categories/ (optional filter by group/category query)."""
    group_val = group or category
    return list_categories(db, group_val)


@router.get("/{category_id}", response_model=CategoryOut)
async def get_category_endpoint(category_id: int, db: Session = Depends(get_db)) -> CategoryOut:
    """Legacy: GET /api/categories/<int:category_id>."""
    data = get_category_by_id(db, category_id)
    if not data:
        raise HTTPException(status_code=404, detail="Not found")
    return data


@router.get("/{slug}", response_model=CategoryWithProductsOut)
async def get_category_by_slug_endpoint(
    slug: str,
    wrist_size: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> CategoryWithProductsOut:
    """Legacy: GET /api/categories/<slug> (includes products list)."""
    data = get_category_by_slug(db, slug, wrist_size)
    if not data:
        return JSONResponse(status_code=404, content={"error": "Category not found"})
    return data


@router.post("/", response_model=CategoryOut, status_code=201)
async def create_category(payload: Optional[CategoryCreateIn] = Body(default=None)) -> CategoryOut:
    """Legacy: POST /api/categories/."""
    _ = payload
    raise HTTPException(status_code=501, detail="Not implemented")


@router.put("/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: int,
    payload: Optional[CategoryUpdateIn] = Body(default=None),
) -> CategoryOut:
    """Legacy: PUT /api/categories/<int:category_id>."""
    _ = category_id
    _ = payload
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/{category_id}")
async def delete_category(category_id: int) -> dict[str, Any]:
    """Legacy: DELETE /api/categories/<int:category_id>."""
    _ = category_id
    raise HTTPException(status_code=501, detail="Not implemented")
