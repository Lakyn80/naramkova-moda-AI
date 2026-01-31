from __future__ import annotations

import io
import os
from pathlib import Path
from datetime import datetime
from decimal import Decimal

from app.db.models import Payment


def _to_float(v) -> float:
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, Decimal):
        return float(v)
    try:
        s = str(v).strip().replace(",", ".")
        return float(s) if s else 0.0
    except Exception:
        return 0.0


def _get_first_attr(obj, *names):
    for n in names:
        if hasattr(obj, n):
            val = getattr(obj, n)
            if val not in (None, ""):
                return val
    return None


def _qty(sp) -> float:
    q = _to_float(_get_first_attr(sp, "quantity", "qty", "count", "pieces"))
    return q if q > 0 else 1.0


def _unit_price(sp) -> float:
    cand = _get_first_attr(
        sp,
        "unit_price_czk", "price_czk",
        "unit_price", "price",
        "final_price_czk", "sold_unit_price_czk",
    )
    return round(_to_float(cand), 2)


def _total(sp) -> float:
    cand = _get_first_attr(sp, "total_czk", "total_price_czk", "amount_czk", "amount")
    val = round(_to_float(cand), 2)
    if val > 0:
        return val
    return round(_unit_price(sp) * _qty(sp), 2)


def _sold_dt(sp):
    return _get_first_attr(sp, "sold_at", "created_at")


def _register_cz_fonts(static_root: Path) -> tuple[str, str]:
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except Exception:
        return "Helvetica", "Helvetica-Bold"

    candidates = [
        (
            static_root / "fonts" / "DejaVuSans.ttf",
            static_root / "fonts" / "DejaVuSans-Bold.ttf",
            "DejaVuSans",
            "DejaVuSans-Bold",
        ),
        (
            static_root / "fonts" / "NotoSans-Regular.ttf",
            static_root / "fonts" / "NotoSans-Bold.ttf",
            "NotoSans",
            "NotoSans-Bold",
        ),
        (
            Path("C:/Windows/Fonts/arial.ttf"),
            Path("C:/Windows/Fonts/arialbd.ttf"),
            "ArialTT",
            "ArialTT-Bold",
        ),
    ]

    for reg_path, bold_path, reg_name, bold_name in candidates:
        if reg_path.is_file():
            try:
                pdfmetrics.registerFont(TTFont(reg_name, str(reg_path)))
                if bold_path.is_file():
                    pdfmetrics.registerFont(TTFont(bold_name, str(bold_path)))
                else:
                    bold_name = reg_name
                try:
                    pdfmetrics.registerFontFamily(
                        reg_name,
                        normal=reg_name,
                        bold=bold_name,
                        italic=reg_name,
                        boldItalic=bold_name,
                    )
                except Exception:
                    pass
                return reg_name, bold_name
            except Exception:
                continue

    return "Helvetica", "Helvetica-Bold"


def _guess_vs(sp, db):
    vs = _get_first_attr(sp, "vs", "variable_symbol", "payment_vs")
    if vs:
        return vs

    order_id = _get_first_attr(sp, "order_id", "orderId")
    if order_id:
        try:
            p = (
                db.query(Payment)
                .filter(Payment.reference.ilike(f"%Objednávka #{order_id}%"))
                .order_by(Payment.id.desc())
                .first()
            )
            if p and getattr(p, "vs", None):
                return p.vs
        except Exception:
            pass

    return None


def build_invoice_pdf_bytes(sold_product, db) -> bytes:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
    except ImportError as e:
        raise RuntimeError("ReportLab není nainstalován. Spusť: pip install reportlab") from e

    static_root = Path(__file__).resolve().parents[4] / "static"
    reg_font, bold_font = _register_cz_fonts(static_root)

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    c.setFont(bold_font, 16)
    c.drawString(20 * mm, h - 18 * mm, "FAKTURA")

    c.setFont(reg_font, 10)
    c.drawString(20 * mm, h - 26 * mm, "Dodavatel:")
    c.setFont(bold_font, 10)
    c.drawString(20 * mm, h - 31 * mm, "Marie Anna Stojaníková")
    c.setFont(reg_font, 10)
    c.drawString(20 * mm, h - 36 * mm, "Pod Svahy 990, 686 01 Uherské Hradiště")
    c.drawString(20 * mm, h - 41 * mm, "IČO: 14425505")
    c.drawString(20 * mm, h - 46 * mm, "Neplátce DPH")

    company_email = os.getenv("COMPANY_EMAIL", "")
    if company_email:
        c.drawString(20 * mm, h - 51 * mm, f"E-mail: {company_email}")

    num = _get_first_attr(sold_product, "id", "order_id", "order_code") or "-"
    dt_issue = _get_first_attr(sold_product, "created_at")
    dt_supply = _sold_dt(sold_product)

    def _fmt_dt(dt):
        return dt.strftime("%Y-%m-%d") if isinstance(dt, datetime) else "-"

    c.setFont(reg_font, 10)
    c.drawRightString(w - 20 * mm, h - 26 * mm, f"Číslo dokladu: {num}")
    c.drawRightString(w - 20 * mm, h - 31 * mm, f"Datum vystavení: {_fmt_dt(dt_issue)}")
    c.drawRightString(w - 20 * mm, h - 36 * mm, f"Datum plnění: {_fmt_dt(dt_supply)}")

    buyer_name = _get_first_attr(sold_product, "customer_name", "buyer_name", "full_name")
    if not buyer_name:
        first = _get_first_attr(sold_product, "first_name", "firstname")
        last = _get_first_attr(sold_product, "last_name", "lastname", "surname")
        buyer_name = " ".join([x for x in [first, last] if x]) or "-"
    buyer_email = _get_first_attr(sold_product, "customer_email", "email") or ""
    buyer_addr = _get_first_attr(sold_product, "customer_address", "address") or ""

    y = h - 65 * mm
    c.setFont(bold_font, 11)
    c.drawString(20 * mm, y, "Odběratel")
    y -= 6 * mm
    c.setFont(reg_font, 10)
    c.drawString(20 * mm, y, buyer_name)
    y -= 5 * mm
    if buyer_addr:
        c.drawString(20 * mm, y, str(buyer_addr)[:95])
        y -= 5 * mm
    if buyer_email:
        c.drawString(20 * mm, y, buyer_email)
        y -= 8 * mm
    else:
        y -= 3 * mm

    c.setFont(bold_font, 10)
    c.drawString(20 * mm, y, "Položka")
    c.drawRightString(120 * mm, y, "Množ.")
    c.drawRightString(155 * mm, y, "Cena/ks (CZK)")
    c.drawRightString(190 * mm, y, "Celkem (CZK)")
    y -= 5 * mm
    c.line(20 * mm, y, 190 * mm, y)
    y -= 6 * mm
    c.setFont(reg_font, 10)

    name = _get_first_attr(sold_product, "product_name", "name") or "Položka"
    qty = _qty(sold_product)
    unit = _unit_price(sold_product)
    line_total = _total(sold_product)

    c.drawString(20 * mm, y, str(name)[:60])
    c.drawRightString(120 * mm, y, f"{qty:g}")
    c.drawRightString(155 * mm, y, f"{unit:.2f}")
    c.drawRightString(190 * mm, y, f"{line_total:.2f}")
    y -= 8 * mm

    shipping = 89.00
    c.drawString(20 * mm, y, "Poštovné")
    c.drawRightString(120 * mm, y, "1")
    c.drawRightString(155 * mm, y, f"{shipping:.2f}")
    c.drawRightString(190 * mm, y, f"{shipping:.2f}")
    y -= 10 * mm

    grand_total = line_total + shipping

    c.setFont(bold_font, 11)
    c.drawRightString(155 * mm, y, "CELKEM K ÚHRADĚ:")
    c.drawRightString(190 * mm, y, f"{grand_total:.2f} CZK")
    y -= 12 * mm

    iban = os.getenv("MERCHANT_IBAN", "")
    vs = _guess_vs(sold_product, db)
    c.setFont(bold_font, 10)
    c.drawString(20 * mm, y, "Platební údaje")
    y -= 6 * mm
    c.setFont(reg_font, 10)
    if iban:
        c.drawString(20 * mm, y, f"IBAN: {iban}")
        y -= 5 * mm
    if vs:
        c.drawString(20 * mm, y, f"Variabilní symbol: {vs}")
        y -= 5 * mm
    c.drawString(20 * mm, y, "Způsob úhrady: převodem (doporučeno uvést VS).")
    y -= 10 * mm

    note = _get_first_attr(sold_product, "note", "customer_note") or ""
    if note:
        c.setFont(bold_font, 10)
        c.drawString(20 * mm, y, "Poznámka")
        y -= 6 * mm
        c.setFont(reg_font, 9)
        c.drawString(20 * mm, y, str(note)[:120])
        y -= 8 * mm

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.getvalue()
