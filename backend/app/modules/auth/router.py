from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.session import get_db
from app.modules.email.service import send_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _check_password(hashed: str, plain: str) -> bool:
    try:
        from passlib.context import CryptContext
        ctx = CryptContext(schemes=["bcrypt", "plaintext"], deprecated="auto")
        return ctx.verify(plain, hashed)
    except Exception:
        pass
    try:
        from werkzeug.security import check_password_hash
        return check_password_hash(hashed, plain)
    except Exception:
        return False


def _hash_password(plain: str) -> str:
    from passlib.context import CryptContext

    ctx = CryptContext(schemes=["bcrypt", "plaintext"], deprecated="auto")
    return ctx.hash(plain)


def _reset_secret() -> bytes | None:
    salt = os.getenv("PASSWORD_RESET_SALT")
    if not salt:
        return None
    return salt.encode("utf-8")


def _token_ttl_seconds() -> int:
    raw = os.getenv("PASSWORD_RESET_TTL_HOURS", "24")
    try:
        hours = int(raw)
        return max(hours, 1) * 3600
    except Exception:
        return 24 * 3600


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _make_reset_token(user: User) -> str:
    secret = _reset_secret()
    if not secret:
        raise RuntimeError("PASSWORD_RESET_SALT není nastaven.")
    payload = {
        "uid": user.id,
        "email": user.email,
        "exp": int(time.time()) + _token_ttl_seconds(),
    }
    payload_b = _b64url_encode(json.dumps(payload).encode("utf-8"))
    signature = hmac.new(secret, payload_b.encode("utf-8"), hashlib.sha256).digest()
    sig_b = _b64url_encode(signature)
    return f"{payload_b}.{sig_b}"


def _verify_reset_token(token: str) -> dict | None:
    secret = _reset_secret()
    if not secret:
        return None
    if not token or "." not in token:
        return None
    payload_b, sig_b = token.split(".", 1)
    try:
        payload_raw = _b64url_decode(payload_b)
    except Exception:
        return None
    expected_sig = hmac.new(secret, payload_b.encode("utf-8"), hashlib.sha256).digest()
    try:
        provided_sig = _b64url_decode(sig_b)
    except Exception:
        return None
    if not hmac.compare_digest(expected_sig, provided_sig):
        return None
    try:
        payload = json.loads(payload_raw.decode("utf-8"))
    except Exception:
        return None
    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(time.time()):
        return None
    return payload


class LoginRequest(BaseModel):
    username: str
    password: str


class ForgotRequest(BaseModel):
    email: str


class ResetRequest(BaseModel):
    token: str
    password: str
    password2: str


@router.post("/login")
async def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> dict:
    user = db.query(User).filter(User.username == payload.username.strip()).first()
    if not user or not _check_password(user.password_hash, payload.password):
        raise HTTPException(status_code=401, detail="Neplatné přihlašovací údaje")
    return {"ok": True, "username": user.username}


@router.post("/logout")
async def logout() -> dict:
    return {"ok": True}


@router.post("/forgot")
async def forgot(
    payload: ForgotRequest,
    db: Session = Depends(get_db),
) -> dict:
    user = db.query(User).filter(User.email == payload.email.strip()).first()
    if user:
        try:
            token = _make_reset_token(user)
            admin_base = (
                os.getenv("ADMIN_BASE_URL")
                or os.getenv("PUBLIC_ADMIN_URL")
                or "http://localhost:3012"
            ).rstrip("/")
            reset_link = f"{admin_base}/admin/reset?token={token}"
            subject = os.getenv("PASSWORD_RESET_SUBJECT") or "Obnova hesla"
            body = "\n".join(
                [
                    "Dobrý den,",
                    "",
                    "požádali jste o obnovu hesla.",
                    "Klikněte na odkaz níže a nastavte nové heslo:",
                    reset_link,
                    "",
                    "Pokud jste si obnovu nevyžádali, tento e-mail ignorujte.",
                ]
            )
            send_email(subject=subject, recipients=[user.email], body=body)
        except Exception:
            # Neprozrazujeme detaily – bezpečnostní důvod
            pass
    return {"ok": True, "message": "Pokud účet existuje, byl odeslán e-mail."}


@router.post("/reset")
async def reset(
    payload: ResetRequest,
    db: Session = Depends(get_db),
) -> dict:
    if payload.password != payload.password2:
        raise HTTPException(status_code=400, detail="Hesla se neshodují")
    data = _verify_reset_token(payload.token)
    if not data:
        raise HTTPException(status_code=400, detail="Neplatný nebo expirovaný token")
    user_id = data.get("uid")
    email = data.get("email")
    user = None
    if user_id is not None:
        user = db.query(User).filter(User.id == int(user_id)).first()
    if not user and email:
        user = db.query(User).filter(User.email == str(email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Uživatel nenalezen")
    user.password_hash = _hash_password(payload.password)
    db.commit()
    return {"ok": True}