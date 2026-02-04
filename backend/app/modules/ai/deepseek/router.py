from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.modules.ai.rag.llm_client import _get_llm_client

router = APIRouter(prefix="/api/ai/deepseek", tags=["ai-deepseek"])


class GenerateRequest(BaseModel):
    context: str


@router.post("/generate")
def generate_text(payload: GenerateRequest) -> dict:
    context = (payload.context or "").strip()
    if not context:
        raise HTTPException(status_code=400, detail="Missing context")

    client_result = _get_llm_client()
    if not client_result:
        raise HTTPException(status_code=503, detail="LLM client not configured")

    client, model = client_result
    system_prompt = os.getenv(
        "DEEPSEEK_SYSTEM_PROMPT",
        "You are a helpful assistant. Follow the user's instructions precisely.",
    )

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": context},
            ],
            temperature=0.6,
            max_tokens=800,
        )
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            raise HTTPException(status_code=500, detail="Empty response")
        return {"text": text}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

