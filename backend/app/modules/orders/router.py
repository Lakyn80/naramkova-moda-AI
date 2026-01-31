from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from .schemas import OrderClientCreateResponse, OrderCreateIn, OrderCreateResponse, OrderGetResponse
from .service import create_order, create_order_client

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.post("", response_model=OrderCreateResponse, status_code=201)
async def create_order_endpoint(
    payload: Optional[OrderCreateIn] = Body(default=None),
    db: Session = Depends(get_db),
) -> OrderCreateResponse:
    """Legacy: POST /api/orders."""
    status_code, data = create_order(db, (payload or {}).model_dump() if payload else {})
    return JSONResponse(status_code=status_code, content=data)


@router.get("/{order_id}", response_model=OrderGetResponse)
async def get_order(order_id: int) -> OrderGetResponse:
    """Legacy: GET /api/orders/<int:order_id>."""
    _ = order_id
    return JSONResponse(status_code=501, content={"detail": "Not implemented"})


@router.get("/by-vs/{vs}", response_model=OrderGetResponse)
async def get_order_by_vs(vs: str) -> OrderGetResponse:
    """Legacy: GET /api/orders/by-vs/<vs>."""
    _ = vs
    return JSONResponse(status_code=501, content={"detail": "Not implemented"})


@router.post("/client", response_model=OrderClientCreateResponse, status_code=201)
async def create_order_client_endpoint(
    payload: Optional[OrderCreateIn] = Body(default=None),
    db: Session = Depends(get_db),
) -> OrderClientCreateResponse:
    """Legacy: POST /api/orders/client (compat endpoint)."""
    status_code, data = create_order_client(db, (payload or {}).model_dump() if payload else {})
    return JSONResponse(status_code=status_code, content=data)
