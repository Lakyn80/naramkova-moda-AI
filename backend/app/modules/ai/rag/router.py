from fastapi import APIRouter, HTTPException

from .seed_templates import seed_rag_templates_from_db
from .service import generate_drafts_for_session

router = APIRouter(prefix="/api/ai/rag", tags=["ai-rag"])


@router.post("/seed-templates")
def api_seed_rag_templates():
    """
    Načte z DB jeden reálný produkt pro každou kategorii (bracelet, candle, necklace, earrings, decor, other)
    a uloží ho jako šablonu do Chroma (template_<kategorie>).
    RAG určuje styl a strukturu, obsah vždy z Vision.
    """
    outcomes = seed_rag_templates_from_db()
    return {"status": "ok", "outcomes": outcomes}


@router.get("/drafts/{product_id}")
def api_get_draft(product_id: int):
    """
    Vygeneruje draft (název + popis) pro produkt podle obrázků: Vision → RAG šablona → LLM.
    product_id = ID produktu v DB (musí mít záznamy v product_media a soubory v backend/static/uploads).
    """
    try:
        draft = generate_drafts_for_session(product_id)
        return draft
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

