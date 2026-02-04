# -*- coding: utf-8 -*-
"""
LLM klient pro generování popisů produktů v češtině.

Vision určuje FAKTA (co je na obrázku).
RAG určuje STYL A STRUKTURU (jak formátovat text).
LLM kombinuje obojí – kopíruje strukturu z RAG, používá obsah z Vision.
"""

import os
from typing import List, Optional, Tuple


SYSTEM_PROMPT = """Jsi odborník na psaní e-shopových popisů produktů v češtině.
Tvým úkolem je vytvořit název a popis produktu podle těchto pravidel:

1. POUŽIJ POUZE ČESKÉ TEXTY – žádná angličtina ani cizí slova.
2. Obsah (materiály, barvy, motivy) VŽDY ber z dat z Vision – to jsou fakta o konkrétním produktu.
3. Strukturu a styl kopíruj z vzorového textu (RAG) – ale NEPŘEPISUJ fakta.
4. Výstup musí mít tuto strukturu:

NÁZEV (může obsahovat emoji, kreativní styl, pomlčku):
- Krátký, výstižný nadpis

POPIS:
- Úvodní odstavec (2–3 věty)
- Sekce: ✨ Popis produktu:
  – odrážky s materiálem, barvami, provedením
- Sekce: 💎 Styl: 2–3 přívlastky (např. elegantní, přírodní, letní)

Vždy piš pouze v češtině. Žádná anglická slova."""


def _get_llm_client():
    """Vrátí OpenAI-kompatibilní klienta (DeepSeek)."""
    api_key = os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        from openai import OpenAI
        base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
        model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
        return OpenAI(api_key=api_key, base_url=base_url), model
    except ImportError:
        return None


def generate_product_description(
    vision_tags_cz: List[str],
    product_type: str,
    rag_template: str,
) -> Optional[Tuple[str, str]]:
    """
    Vygeneruje název a popis produktu v češtině.

    - vision_tags_cz: fakta z Vision (materiály, barvy, motivy) v češtině
    - product_type: bracelet, candle, necklace, earrings, decor, other
    - rag_template: vzorový text z RAG (struktura a styl)

    Vrací (title, description) nebo None při chybě / chybějícím API klíči.
    """
    client_result = _get_llm_client()
    if not client_result:
        return None

    client, model = client_result
    tags_text = ", ".join(vision_tags_cz) if vision_tags_cz else "obecný produkt"

    user_content = f"""FAKTA Z VISION (co je na obrázku – POUŽIJ TYTO ÚDAJE):
{tags_text}

VZOROVÝ TEXT Z RAG (kopíruj STRUKTURU a STYL, ne obsah):
---
{rag_template}
---

Vytvoř název a popis produktu v češtině. Název na první řádek, prázdný řádek, pak popis. Pouze český text."""

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.5,
            max_tokens=800,
        )
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            return None

        parts = text.split("\n\n", 1)
        title = parts[0].strip() if parts else ""
        description = parts[1].strip() if len(parts) > 1 else text
        return title, description
    except Exception:
        return None
