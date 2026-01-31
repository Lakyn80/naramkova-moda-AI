from __future__ import annotations

import os
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Order, OrderItem, Payment, Product, VsRegistry


def _to_decimal(val: Any, field: str = "") -> Decimal:
    try:
        return Decimal(str(val))
    except Exception:
        raise InvalidOperation(f"Neplatná hodnota {field or 'čísla'}")


def _shipping_fee() -> Decimal:
    raw = os.getenv("SHIPPING_FEE_CZK")
    if raw is None:
        raw = "89.00"
    try:
        return _to_decimal(raw, "shipping_fee")
    except InvalidOperation:
        return Decimal("89.00")


def _sanitize_vs(vs: Optional[str]) -> Optional[str]:
    if not vs:
        return None
    s = "".join(ch for ch in str(vs) if ch.isdigit())[:10]
    return s if s else None


def _reserve_exact_vs(db: Session, vs: str) -> None:
    db.add(VsRegistry(vs=vs))
    db.flush()


def _reserve_unique_vs(db: Session, max_tries: int = 50) -> str:
    from app.modules.orders.utils import generate_vs

    tries = 0
    while tries < max_tries:
        vs = generate_vs()
        try:
            _reserve_exact_vs(db, vs)
            return vs
        except IntegrityError:
            db.rollback()
            tries += 1
            continue
    raise RuntimeError("Nepodařilo se zarezervovat unikátní VS (zkus znovu).")


def _build_items_list(items_in: list[dict[str, Any]]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for it in items_in:
        items.append({
            "id": it.get("id"),
            "name": it.get("name"),
            "quantity": it.get("quantity", 1),
            "price": it.get("price", "0"),
        })
    return items


def create_order(db: Session, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    try:
        vs = str(payload.get("vs", "")).strip()
        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip()
        address = str(payload.get("address", "")).strip()
        note = str(payload.get("note", "") or "")

        if not (vs and name and email and address):
            return 400, {"ok": False, "error": "Chybí povinná pole (vs, name, email, address)."}

        if db.query(Order).filter_by(vs=vs).first():
            return 409, {"ok": False, "error": "Objednávka s tímto VS už existuje."}

        items_in = payload.get("items") or []
        if not isinstance(items_in, list) or not items_in:
            return 400, {"ok": False, "error": "Chybí položky objednávky (items)."}

        subtotal = Decimal("0.00")
        for it in items_in:
            qty = int(it.get("quantity", 1))
            price = _to_decimal(it.get("price", "0"), "price")
            if qty <= 0 or price <= 0:
                return 400, {"ok": False, "error": "Položka musí mít quantity>0 a price>0."}
            subtotal += price * qty

        shipping_fee = _shipping_fee()
        total_czk = (subtotal + shipping_fee).quantize(Decimal("0.01"))
        if total_czk <= 0:
            return 400, {"ok": False, "error": "Částka musí být > 0."}

        decremented: list[dict[str, Any]] = []
        for it in items_in:
            pid = int(it.get("id"))
            qty = int(it.get("quantity", 1))

            product = db.get(Product, pid)
            if not product:
                return 404, {"ok": False, "error": f"Produkt {pid} neexistuje"}

            current_stock = int(product.stock or 0)
            if current_stock < qty:
                return 400, {"ok": False, "error": f"Na skladě zbývá jen {current_stock} ks pro {product.name}"}

            updated = db.execute(
                text("UPDATE product SET stock = stock - :qty WHERE id = :pid AND stock >= :qty"),
                {"qty": qty, "pid": pid},
            )
            if updated.rowcount == 0:
                latest = db.get(Product, pid)
                left = int(latest.stock or 0) if latest else 0
                return 400, {"ok": False, "error": f"Na skladě zbývá jen {left} ks pro {product.name}"}

            latest = db.get(Product, pid)
            decremented.append({
                "id": pid,
                "taken_qty": qty,
                "remaining_stock": int(latest.stock or 0) if latest else 0,
            })

        order = Order(
            vs=vs,
            customer_name=name,
            customer_email=email,
            customer_address=address,
            note=note,
            total_czk=total_czk,
            status="awaiting_payment",
        )
        db.add(order)
        db.flush()

        for it in items_in:
            db.add(OrderItem(
                order_id=order.id,
                product_name=str(it.get("name") or "").strip(),
                quantity=int(it.get("quantity", 1)),
                price=_to_decimal(it.get("price"), "price"),
            ))

        if not db.query(Payment).filter_by(vs=vs).first():
            db.add(Payment(
                vs=vs,
                amount_czk=total_czk,
                status="pending",
                reference=f"Objednávka #{order.id}",
            ))

        db.commit()

        return 201, {
            "ok": True,
            "orderId": order.id,
            "vs": vs,
            "status": order.status,
            "decremented_items": decremented,
        }

    except Exception as e:
        db.rollback()
        return 500, {"ok": False, "error": str(e)}


def create_order_client(db: Session, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    try:
        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip()
        address = str(payload.get("address", "")).strip()
        note = str(payload.get("note", "") or "")

        if not (name and email and address):
            return 400, {"ok": False, "error": "Chybí povinná pole (name, email, address)."}

        items_in = payload.get("items") or []
        if not isinstance(items_in, list) or not items_in:
            return 400, {"ok": False, "error": "Chybí položky objednávky (items)."}

        client_vs = _sanitize_vs(payload.get("vs"))
        try:
            if client_vs:
                _reserve_exact_vs(db, client_vs)
                vs = client_vs
            else:
                vs = _reserve_unique_vs(db)
        except IntegrityError:
            db.rollback()
            return 409, {"ok": False, "error": "Objednávka s tímto VS už existuje, zkuste znovu."}

        if db.query(Order).filter_by(vs=vs).first():
            return 409, {"ok": False, "error": "Objednávka s tímto VS už existuje."}

        subtotal = Decimal("0.00")
        for it in items_in:
            qty = int(it.get("quantity", 1))
            price = _to_decimal(it.get("price", "0"), "price")
            if qty <= 0 or price <= 0:
                return 400, {"ok": False, "error": "Položka musí mít quantity>0 a price>0."}
            subtotal += price * qty

        shipping_fee = _shipping_fee()
        total_czk = (subtotal + shipping_fee).quantize(Decimal("0.01"))
        if total_czk <= 0:
            return 400, {"ok": False, "error": "Částka musí být > 0."}

        decremented: list[dict[str, Any]] = []
        for it in items_in:
            pid = int(it.get("id"))
            qty = int(it.get("quantity", 1))

            product = db.get(Product, pid)
            if not product:
                return 404, {"ok": False, "error": f"Produkt {pid} neexistuje"}

            current_stock = int(product.stock or 0)
            if current_stock < qty:
                return 400, {"ok": False, "error": f"Na skladě zbývá jen {current_stock} ks pro {product.name}"}

            updated = db.execute(
                text("UPDATE product SET stock = stock - :qty WHERE id = :pid AND stock >= :qty"),
                {"qty": qty, "pid": pid},
            )
            if updated.rowcount == 0:
                latest = db.get(Product, pid)
                left = int(latest.stock or 0) if latest else 0
                return 400, {"ok": False, "error": f"Na skladě zbývá jen {left} ks pro {product.name}"}

            latest = db.get(Product, pid)
            decremented.append({
                "id": pid,
                "taken_qty": qty,
                "remaining_stock": int(latest.stock or 0) if latest else 0,
            })

        order = Order(
            vs=vs,
            customer_name=name,
            customer_email=email,
            customer_address=address,
            note=note,
            total_czk=total_czk,
            status="awaiting_payment",
            created_at=datetime.utcnow(),
        )
        db.add(order)
        db.flush()

        for it in items_in:
            db.add(OrderItem(
                order_id=order.id,
                product_name=str(it.get("name") or "").strip(),
                quantity=int(it.get("quantity", 1)),
                price=_to_decimal(it.get("price"), "price"),
            ))

        existing_p = db.query(Payment).filter_by(vs=vs).first()
        if not existing_p:
            db.add(Payment(
                vs=vs,
                amount_czk=total_czk,
                status="pending",
                reference=f"Order #{order.id} created",
            ))

        db.commit()

        return 201, {
            "ok": True,
            "orderId": order.id,
            "vs": vs,
            "status": order.status,
            "decremented_items": decremented,
        }

    except Exception as e:
        db.rollback()
        return 500, {"ok": False, "error": str(e)}
