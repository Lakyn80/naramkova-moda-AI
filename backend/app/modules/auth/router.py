from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.session import get_db

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
        # TODO: generate token, send email
        pass
    return {"ok": True, "message": "Pokud účet existuje, byl odeslán e-mail."}


@router.post("/reset")
async def reset(
    payload: ResetRequest,
    db: Session = Depends(get_db),
) -> dict:
    if payload.password != payload.password2:
        raise HTTPException(status_code=400, detail="Hesla se neshodují")
    # TODO: verify token, update password
    raise HTTPException(status_code=501, detail="Reset hesla zatím není implementován")