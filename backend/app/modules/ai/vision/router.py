from __future__ import annotations

import os
import tempfile

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.modules.ai.rag.vision_client import analyze_image_with_vision

router = APIRouter(prefix="/api/ai/vision", tags=["ai-vision"])


def _save_upload_to_temp(upload: UploadFile) -> str:
    suffix = os.path.splitext(upload.filename or "")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        for chunk in iter(lambda: upload.file.read(1024 * 1024), b""):
            tmp.write(chunk)
        return tmp.name


@router.post("/analyze")
async def analyze_image(image: UploadFile = File(...)) -> dict:
    if not image or not image.filename:
        raise HTTPException(status_code=400, detail="Missing image")
    temp_path = _save_upload_to_temp(image)
    try:
        return analyze_image_with_vision(temp_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass

