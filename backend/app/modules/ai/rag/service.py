# -*- coding: utf-8 -*-
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Union

from .media_repository import get_media_assets_by_session
from .vision_client import analyze_image_with_vision, normalize_tags
from .templates import get_fallback_template

logger = logging.getLogger(__name__)

EMOJI_POOL = [
    "💚","🌿","🍀","✨","💎","🕯️","🐾","🦋","🌸","💖",
    "⭐","🌙","🌊","🔥","🧿","🎁","🧵","🧩","🌈","🤍"
]

def random_emoji() -> str:
    import random
    return random.choice(EMOJI_POOL)

def _contains_emoji(text: str) -> bool:
    return bool(re.search(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF]", text or ""))

TAG_CZ = {
    "natural material": "přírodní materiál",
    "metal": "kov",
    "silver": "stříbrná",
    "gold": "zlatá",
    "gemstone": "drahokam",
    "crystal": "křišťál",
    "glass": "sklo",
    "wood": "dřevo",
    "wax": "vosk",

    "butterfly": "motýl",
    "butterflies": "motýli",

    "bead": "korálek",
    "beads": "korálky",
    "beaded": "korálkový",

    "bracelet": "náramek",
    "wristband": "náramek",
    "anklet": "náramek na nohu",
    "necklace": "náhrdelník",
    "pendant": "přívěsek",
    "charm": "přívěsek",
    "keychain": "klíčenka",
    "key ring": "klíčenka",
    "lanyard": "šňůrka na telefon",
    "phone strap": "šňůrka na telefon",
    "car pendant": "přívěsek do auta",
    "car charm": "přívěsek do auta",
    "earring": "náušnice",
    "earrings": "náušnice",
    "jewelry": "šperk",
    "jewellery": "šperk",
    "jewelry set": "šperkový set",

    "candle": "svíčka",
    "candles": "svíčky",
    "decor": "dekorace",
    "decoration": "dekorace",
    "ornament": "dekorace",
    "gnome": "skřítek",

    "sticker": "samolepka",
    "stickers": "samolepky",
    "decal": "samolepka",
    "decals": "samolepky",
    "adhesive": "samolepka",
    "sheet": "arch",
    "set": "sada",
    "pack": "sada",
    "gift card": "dárková kartička",
    "greeting card": "dárková kartička",
    "voucher": "dárkový poukaz",
    "gift voucher": "dárkový poukaz",

    "pacifier clip": "provázek na dudlík",
    "teether clip": "provázek na kousátko",
    "diy kit": "kreativní sada",
    "craft kit": "kreativní sada",

    "handmade": "ruční tvorba",
    "craft": "ruční tvorba",
    "creative arts": "ruční tvorba",

    "blue": "modrá",
    "green": "zelená",
    "black": "černá",
    "white": "bílá",
    "red": "červená",
    "yellow": "žlutá",
    "brown": "hnědá",
    "pink": "růžová",
    "purple": "fialová",
    "orange": "oranžová",
    "gray": "šedá",

    "flower": "květ",
    "flowers": "květy",
    "floral": "květinový",
    "leaf": "list",
    "leaves": "listy",
    "heart": "srdce",
    "hearts": "srdce",
    "star": "hvězda",
    "stars": "hvězdy",
    "moon": "měsíc",
    "sun": "slunce",
    "hologram": "hologram",
    "glitter": "třpyt",
    "sparkle": "třpyt",
    "pearl": "perla",
    "pearls": "perly",
    "stone": "kámen",
    "stones": "kameny",
    "ribbon": "stuha",
    "string": "šňůrka",
    "thread": "nit",
    "wooden": "dřevěný",
    "bone": "kost",
    "dog collar": "obojek pro psa",
    "collar": "obojek",
    "paw": "tlapka",
    "love": "láska",
    "jewelry making": "výroba šperků",
    "plastic": "plast",
}

_CZECH_CHARS = "ěščřžýáíéúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ"


def _looks_czech(tag: str) -> bool:
    if not tag:
        return False
    if any(ch in _CZECH_CHARS for ch in tag):
        return True
    if tag.lower().startswith("rozměr "):
        return True
    return False


def _fallback_translate(tag: str) -> str:
    clean = (tag or "").strip()
    if not clean:
        return clean
    if _looks_czech(clean):
        return clean
    if clean.lower().endswith("(en)"):
        return clean
    return f"{clean} (EN)"


def translate_tags_to_czech(tags: List[str]) -> List[str]:
    """
    Vrátí seznam českých tagů ve stejném pořadí a počtu jako vstup.
    Neznámé tagy NEZAHOZUJE, ale označí fallbackem.
    """
    translated: List[str] = []
    for t in tags or []:
        t_low = (t or "").lower().strip()
        if t_low in TAG_CZ:
            translated.append(TAG_CZ[t_low])
        else:
            translated.append(_fallback_translate(t))
    return translated

VISION_TO_PRODUCT_TYPE = {
    "náramek": "bracelet",
    "náramky": "bracelet",
    "náramek na nohu": "bracelet",
    "šperk": "bracelet",
    "šperk na tělo": "bracelet",
    "svíčka": "candle",
    "svíčky": "candle",
    "náhrdelník": "necklace",
    "náhrdelníky": "necklace",
    "přívěsek": "necklace",
    "náušnice": "earrings",
    "dekorace": "decor",
    "klíčenka": "keychain",
    "samolepka": "sticker",
    "dárková kartička": "gift card",
    "dárkový poukaz": "gift voucher",
}

def detect_product_type(tags: List[str]) -> str:
    if not tags:
        return "other"
    normalized = [t.lower() for t in tags]
    for tag in normalized:
        if tag in VISION_TO_PRODUCT_TYPE:
            return VISION_TO_PRODUCT_TYPE[tag]
    return "other"


_GENERIC_TAGS = {
    "ruční tvorba",
    "ruční práce",
    "ruční zpracování",
    "jemný design",
    "příjemná barva",
    "precizní detail",
    "klidná atmosféra",
}

_COLOR_TAGS = {
    "modrá",
    "zelená",
    "černá",
    "bílá",
    "červená",
    "žlutá",
    "hnědá",
    "růžová",
    "fialová",
    "oranžová",
    "šedá",
    "stříbrná",
    "zlatá",
}

_MATERIAL_TAGS = {
    "přírodní materiál",
    "kov",
    "stříbrná",
    "zlatá",
    "drahokam",
    "křišťál",
    "sklo",
    "dřevo",
    "dřevěný",
    "vosk",
    "kámen",
    "kameny",
    "perla",
    "perly",
}

_STYLE_ADJ_BY_TAG = {
    "kov": "kovový",
    "stříbrná": "stříbrný",
    "zlatá": "zlatý",
    "sklo": "skleněný",
    "dřevo": "dřevěný",
    "dřevěný": "dřevěný",
    "vosk": "voskový",
    "křišťál": "křišťálový",
    "drahokam": "drahokamový",
    "perla": "perlový",
    "perly": "perlový",
    "kámen": "kamenný",
    "kameny": "kamenný",
    "korálky": "korálkový",
    "korálek": "korálkový",
    "motýl": "motýlí",
    "motýli": "motýlí",
    "květ": "květinový",
    "květy": "květinový",
    "list": "listový",
    "listy": "listový",
    "srdce": "srdcový",
    "hvězda": "hvězdný",
    "hvězdy": "hvězdný",
}

_ARTICLE_BY_TYPE = {
    "bracelet": "náramek",
    "candle": "svíčka",
    "necklace": "náhrdelník",
    "earrings": "náušnice",
    "decor": "dekorace",
    "keychain": "klíčenka",
    "sticker": "samolepka",
    "gift card": "dárková kartička",
    "gift voucher": "dárkový poukaz",
    "other": "dekorace",
}

# Povinná šablona struktury, když RAG nemá shodu – LLM i fallback ji musí dodržet
MANDATORY_STRUCTURE_TEMPLATE = """🦋 Zeleno-modří motýli – dekorace

✨ Popis produktu:
- Jemné papírové motýlky v modrých a zelených tónech
- Detailní kresba žilek na křídlech
- Lehké, tenké provedení vhodné k nalepení

💎 Styl: přírodní, svěží, hravý"""

# Emoji podle motivu – název musí obsahovat emoji vhodné k produktu (měnit podle obrázku)
EMOJI_BY_MOTIF = [
    ("motýl", "🦋"), ("motýli", "🦋"), ("butterfly", "🦋"),
    ("květ", "🌸"), ("květy", "🌸"), ("květina", "🌸"), ("květiny", "🌸"),
    ("flower", "🌸"), ("flowers", "🌸"), ("růže", "🌷"), ("tulipán", "🌷"),
    ("sedmikráska", "🌼"), ("pampeliška", "🌼"),
    ("list", "🍃"), ("listy", "🍃"), ("příroda", "🌿"), ("přírodní", "🌿"),
    ("leaf", "🍃"), ("leaves", "🍃"), ("bylina", "🌿"), ("bylinky", "🌿"),
    ("srdce", "💖"), ("hearts", "💖"), ("láska", "💖"), ("love", "❤️"),
    ("kočka", "🐱"), ("kočky", "🐱"), ("cat", "🐱"),
    ("tlapka", "🐾"), ("paw", "🐾"), ("paws", "🐾"),
    ("náramek", "💎"), ("šperk", "💎"), ("náhrdelník", "📿"), ("jewelry", "💎"),
    ("svíčka", "🕯️"), ("svíčky", "🕯️"), ("candle", "🕯️"),
    ("přívěsek", "🔗"), ("pendant", "🔗"), ("charm", "🔗"),
    ("hvězda", "⭐"), ("hvězdy", "⭐"), ("star", "⭐"), ("stars", "⭐"),
    ("třpyt", "✨"), ("sparkle", "✨"),
    ("anděl", "👼"), ("andělé", "👼"), ("angel", "👼"),
    ("perla", "🤍"), ("perly", "🤍"), ("pearl", "🤍"), ("pearls", "🤍"),
    ("strom", "🌳"), ("stromy", "🌳"), ("tree", "🌳"), ("dřevo", "🌳"),
    ("moře", "🌊"), ("oceán", "🌊"), ("sea", "🌊"), ("ocean", "🌊"),
    ("slunce", "☀️"), ("sun", "☀️"),
    ("měsíc", "🌙"), ("moon", "🌙"),
    ("kůň", "🐴"), ("horse", "🐴"), ("hřebec", "🐴"),
    ("skřítek", "🧙‍♂️"), ("skřítci", "🧙‍♂️"), ("gnome", "🧙‍♂️"),
    ("lesní skřítek", "🧚"), ("lesní", "🍄"), ("houba", "🍄"), ("mushroom", "🍄"),
    ("elf", "🧝‍♂️"), ("elfové", "🧝‍♂️"),
    ("víla", "🧚"), ("víly", "🧚"), ("fairy", "🧚"),
]
EMOJI_DEFAULT_POOL = [
    "🦋", "🌸", "🍃", "💖", "🐱", "🐾", "💎", "🌙", "⭐", "🌊",
    "🌿", "🌼", "🕯️", "🔗", "🧙‍♂️", "🧚", "🤍", "☀️", "📿", "✨",
]


def _dedupe(items: List[str]) -> List[str]:
    seen: set[str] = set()
    result: List[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def _pick_emoji_by_motif(tags: List[str]) -> str:
    """Vrátí emoji vhodné k motivu (podle tagů); jinak náhodné z EMOJI_DEFAULT_POOL."""
    tags_low = [str(t).lower().strip() for t in (tags or []) if t]
    for keyword, emoji in EMOJI_BY_MOTIF:
        for tag in tags_low:
            if keyword in tag:
                return emoji
    import random
    return random.choice(EMOJI_DEFAULT_POOL) if EMOJI_DEFAULT_POOL else "✨"


def build_required_structure_from_vision(product_type: str, combined_tags: List[str]) -> tuple[str, str]:
    """
    Jediný povolený fallback: vždy vrátí text ve POVINNÉ struktuře (✨ Popis produktu, 💎 Styl).
    Nikdy ne „Na fotografii je…“ ani výčet tagů jako odstavec. Vision vždy něco přečte – vždy vznikne text.
    """
    tags = _filter_tags(combined_tags or [])
    tags = [re.sub(r"\s*\(en\)\s*$", "", t, flags=re.I).strip() for t in tags if t and "(EN)" not in t]
    tags = _dedupe([t for t in tags if t])
    article = _pick_article(product_type, tags)
    emoji = _pick_emoji_by_motif(tags)
    first_detail = (tags[0].capitalize() if tags else article.capitalize())
    title = f"{emoji} {first_detail} – {article}"
    bullets = [f"- {t}" for t in tags[:5]] if tags else [f"- {article} z fotografie"]
    style_words = tags[2:5] if len(tags) >= 3 else (tags[:2] or ["přírodní", "jemný"])
    style_str = ", ".join(style_words[:3])
    description = "✨ Popis produktu:\n" + "\n".join(bullets) + "\n\n💎 Styl: " + style_str
    return title, description


def _filter_tags(tags: List[str]) -> List[str]:
    cleaned: List[str] = []
    for tag in tags or []:
        raw = str(tag or "").strip()
        if not raw:
            continue
        low = raw.lower()
        if low in _GENERIC_TAGS:
            continue
        cleaned.append(raw)
    return _dedupe(cleaned)


def _pick_article(product_type: str, tags: List[str]) -> str:
    if product_type in _ARTICLE_BY_TYPE:
        return _ARTICLE_BY_TYPE[product_type]
    for tag in tags:
        if tag in _COLOR_TAGS or tag in _MATERIAL_TAGS:
            continue
        return tag
    return "dekorace"


def build_structured_fallback(product_type: str, combined_tags: List[str]) -> tuple[str, str]:
    tags = _filter_tags(combined_tags or [])
    tags = [t for t in tags if "(EN)" not in t]
    article = _pick_article(product_type, tags)

    colors = [t for t in tags if t in _COLOR_TAGS]
    materials = [t for t in tags if t in _MATERIAL_TAGS]
    product_words = [t for t in tags if t in VISION_TO_PRODUCT_TYPE]
    others = [t for t in tags if t not in colors and t not in materials and t not in product_words]

    def _display(tag: str) -> str:
        return re.sub(r"\s*\(en\)\s*$", "", tag, flags=re.I).strip()

    colors = [_display(t) for t in colors if _display(t)]
    materials = [_display(t) for t in materials if _display(t)]
    others = [_display(t) for t in others if _display(t)]

    emoji = random_emoji()
    if others:
        detail = ", ".join((colors[:1] + materials[:1])) if (colors or materials) else ""
        if detail:
            title = f"{others[0].capitalize()} – {article}, {detail} {emoji}"
        else:
            title = f"{others[0].capitalize()} – {article} {emoji}"
    elif colors or materials:
        key = ", ".join((colors[:2] or materials[:2]))
        title = f"{article.capitalize()} – {key} {emoji}"
    else:
        title = f"{article.capitalize()} {emoji}"

    sentences: List[str] = []
    if others:
        chunk = ", ".join(others[:3])
        sentences.append(f"Na fotografii je {article} s motivem {chunk}.")
    else:
        sentences.append(f"Na fotografii je {article}.")

    if colors and materials:
        sentences.append(f"Vynikají tóny {', '.join(colors[:2])} a materiál {', '.join(materials[:2])}.")
    elif colors:
        sentences.append(f"Převažují tóny {', '.join(colors[:2])}.")
    elif materials:
        sentences.append(f"Materiál působí jako {', '.join(materials[:2])}.")

    if len(sentences) < 2 and product_words:
        sentences.append(f"Motiv odpovídá typu: {', '.join(product_words[:1])}.")

    description = " ".join(sentences).strip()
    return title, description

def _fill_template(tpl: str, tags: List[str]) -> str:
    if not tpl:
        return tpl
    replacements = {
        "hlavni_atribut": (tags[0] if tags else "viditelný detail"),
        "barva": (tags[1] if len(tags) > 1 else "barevný prvek"),
        "motiv": (tags[2] if len(tags) > 2 else "motiv z fotografie"),
        "atmosfera": (tags[0] if tags else "vizuální dojem"),
        "klíčový_detail": (tags[0] if tags else "detail z fotografie"),
    }
    out = tpl
    for key, val in replacements.items():
        out = out.replace("{" + key + "}", str(val))
    out = re.sub(r"\{[^}]+\}", "detail z fotografie", out)
    return out

def _get_rag_template(product_type: str) -> str:
    fallback = get_fallback_template(product_type)
    t1 = fallback.get("title_template", "")
    t2 = fallback.get("description_template", "")
    return f"{t1}\n\n{t2}" if t1 or t2 else f"Vzor pro {product_type} – použij strukturu a styl."

RAG_DISTANCE_THRESHOLD = 0.25
FALLBACK_EMBEDDING_DIM = 384


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _build_query_text(
    product_type: str,
    combined_tags: List[str],
    raw_tags: List[str] | None = None,
) -> str:
    tags = [t.strip() for t in (combined_tags or []) if t and str(t).strip()]
    tags = list(dict.fromkeys(tags))
    if not tags and raw_tags:
        raw = [t.strip() for t in raw_tags if t and str(t).strip()]
        tags = list(dict.fromkeys(raw))
    if tags:
        return f"{product_type} | " + ", ".join(tags)
    return product_type


def _find_similar_rag_template(
    product_type: str,
    combined_tags: List[str],
    raw_tags: List[str] | None = None,
) -> tuple[str | None, float | None, str, List[float]]:
    query_text = _build_query_text(product_type, combined_tags, raw_tags)
    try:
        from .embeddings import embed_text
        from .chroma_client import search
    except Exception:
        return None, None, query_text, []

    try:
        query_embedding = embed_text(query_text)
    except Exception:
        return None, None, query_text, []
    if not query_embedding:
        return None, None, query_text, []

    try:
        result = search(
            query_embedding=query_embedding,
            n_results=5,
            where={"product_type": product_type},
        )
    except Exception:
        return None, None, query_text, query_embedding

    docs = (result or {}).get("documents") or []
    dists = (result or {}).get("distances") or []
    doc_list = docs[0] if docs else []
    dist_list = dists[0] if dists else []

    best_template = None
    best_distance = None
    for doc, dist in zip(doc_list, dist_list):
        if not doc or dist is None:
            continue
        try:
            dist_val = float(dist)
        except (TypeError, ValueError):
            continue
        if best_distance is None or dist_val < best_distance:
            best_distance = dist_val
            best_template = str(doc).strip()

    return best_template, best_distance, query_text, query_embedding


def _save_rag_template(
    *,
    product_type: str,
    title: str,
    description: str,
    query_embedding: List[float],
    query_text: str,
    combined_tags: List[str],
    raw_tags: List[str] | None = None,
    vision_tags_cz: List[str] | None = None,
) -> bool:
    embedding = query_embedding or ([0.0] * FALLBACK_EMBEDDING_DIM)
    text = f"{title}\n\n{description}".strip()
    if not text:
        return False
    try:
        from .chroma_client import add_document
        add_document(
            doc_id=f"auto_{product_type}_{uuid.uuid4().hex}",
            text=text,
            embedding=embedding,
            metadata={
                "product_type": product_type,
                "timestamp": _utc_now_iso(),
                "raw_tags": raw_tags or [],
                "vision_tags_cz": vision_tags_cz or [],
                "source": "auto",
                "query_text": query_text,
                "tags": ", ".join(combined_tags or []),
            },
        )
        return True
    except Exception:
        return False


def _get_title_and_description(
    product_type: str,
    combined_tags: List[str],
    raw_tags: List[str] | None = None,
    vision_tags_cz: List[str] | None = None,
    ai_template_text: str | None = None,
) -> tuple:
    if ai_template_text is None:
        try:
            from app.modules.ai.templates.service import load_ai_template_from_db
            ai_template_text = load_ai_template_from_db(
                product_type=product_type,
                combined_tags=combined_tags,
            )
        except Exception:
            ai_template_text = None

    similar_template, distance, query_text, query_embedding = _find_similar_rag_template(
        product_type, combined_tags, raw_tags
    )
    has_match = bool(similar_template) and distance is not None and distance <= RAG_DISTANCE_THRESHOLD
    if has_match and similar_template:
        rag_template = similar_template
    elif ai_template_text:
        rag_template = ai_template_text
    else:
        rag_template = MANDATORY_STRUCTURE_TEMPLATE
    if not rag_template or not rag_template.strip():
        rag_template = MANDATORY_STRUCTURE_TEMPLATE

    rag_meta = {
        "rag_matched": bool(has_match),
        "rag_distance": distance,
        "rag_threshold": RAG_DISTANCE_THRESHOLD,
        "rag_status": "adapted" if has_match else "new_saved",
        "rag_saved": False,
    }

    if has_match:
        logger.info("RAG match product_type=%s distance=%.4f", product_type, float(distance))
    else:
        logger.info("RAG new template product_type=%s distance=%s", product_type, distance)
    try:
        from .llm_client import generate_product_description
        llm_tags = vision_tags_cz if vision_tags_cz is not None else combined_tags
        result = generate_product_description(
            vision_tags_cz=llm_tags,
            product_type=product_type,
            rag_template=rag_template,
            prefer_vision_title=not has_match,
            vision_raw_tags=raw_tags,
            use_mandatory_structure=not has_match,
        )
        if result and result[0] and result[1]:
            if not has_match:
                saved = _save_rag_template(
                    product_type=product_type,
                    title=result[0],
                    description=result[1],
                    query_embedding=query_embedding,
                    query_text=query_text,
                    combined_tags=combined_tags,
                    raw_tags=raw_tags,
                    vision_tags_cz=vision_tags_cz,
                )
                rag_meta["rag_saved"] = bool(saved)
                rag_meta["rag_status"] = "new_saved" if saved else "new_failed"
            return result[0], result[1], rag_meta
    except Exception:
        pass
    title, description = build_required_structure_from_vision(product_type, combined_tags)
    if not has_match:
        saved = _save_rag_template(
            product_type=product_type,
            title=title,
            description=description,
            query_embedding=query_embedding,
            query_text=query_text,
            combined_tags=combined_tags,
            raw_tags=raw_tags,
            vision_tags_cz=vision_tags_cz,
        )
        rag_meta["rag_saved"] = bool(saved)
        rag_meta["rag_status"] = "new_saved" if saved else "new_failed"
    return title, description, rag_meta

def generate_drafts_for_session(product_id: Union[int, str]) -> Dict[str, Any]:
    media_assets = get_media_assets_by_session(product_id)
    all_tags: List[str] = []
    all_raw_tags: List[str] = []
    all_vision_tags_cz: List[str] = []
    for asset in media_assets:
        try:
            vision_result = analyze_image_with_vision(asset.path_original)
            raw_tags = normalize_tags(vision_result)
            print(f"[VISION RAW TAGS] product_id={product_id}, file={asset.path_original}: {raw_tags}")
            tags_cz_full = translate_tags_to_czech(raw_tags)
            asset.tags = tags_cz_full
            all_tags.extend(tags_cz_full)
            all_vision_tags_cz.extend(tags_cz_full)
            all_raw_tags.extend(raw_tags or [])
        except Exception as e:
            print(f"[VISION ERROR] {asset.path_original}: {e}")
    product_type = detect_product_type(all_tags)
    combined_tags = list(dict.fromkeys(all_tags))
    title, description, rag_meta = _get_title_and_description(
        product_type,
        combined_tags,
        raw_tags=all_raw_tags,
        vision_tags_cz=all_vision_tags_cz,
    )
    if title and not _contains_emoji(title):
        title = f"{random_emoji()} {title}"
    suggested_price = None
    seo_title = None
    seo_description = None
    seo_keywords = None
    try:
        from app.modules.ai.templates.service import suggest_price

        suggested_price = suggest_price(product_type=product_type, combined_tags=combined_tags)
    except Exception:
        suggested_price = None
    try:
        clean_title = re.sub(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF]", "", title or "").strip()
        clean_desc = " ".join((description or "").replace("\n", " ").split())
        seo_title = (clean_title or title or None)
        seo_description = clean_desc[:155] + ("…" if clean_desc and len(clean_desc) > 155 else "")
        seo_keywords = ", ".join(combined_tags[:10]) if combined_tags else None
    except Exception:
        pass
    return {
        "session_id": str(product_id),
        "product_type": product_type,
        "image_count": len(media_assets),
        "combined_tags": combined_tags,
        "title": title,
        "description": description,
        "suggested_price_czk": suggested_price,
        "seo_title": seo_title,
        "seo_description": seo_description,
        "seo_keywords": seo_keywords,
        **rag_meta,
    }

def generate_drafts_for_variant(variant_id: Union[int, str]) -> Dict[str, Any]:
    from .media_repository import get_media_assets_for_variant
    media_assets = get_media_assets_for_variant(variant_id)
    all_tags: List[str] = []
    all_raw_tags: List[str] = []
    all_vision_tags_cz: List[str] = []
    for asset in media_assets:
        try:
            vision_result = analyze_image_with_vision(asset.path_original)
            raw_tags = normalize_tags(vision_result)
            print(f"[VISION RAW TAGS] variant_id={variant_id}, file={asset.path_original}: {raw_tags}")
            tags_cz_full = translate_tags_to_czech(raw_tags)
            asset.tags = tags_cz_full
            all_tags.extend(tags_cz_full)
            all_vision_tags_cz.extend(tags_cz_full)
            all_raw_tags.extend(raw_tags or [])
        except Exception as e:
            print(f"[VISION ERROR] {asset.path_original}: {e}")
    product_type = detect_product_type(all_tags)
    combined_tags = list(dict.fromkeys(all_tags))
    title, description, rag_meta = _get_title_and_description(
        product_type,
        combined_tags,
        raw_tags=all_raw_tags,
        vision_tags_cz=all_vision_tags_cz,
    )
    if title and not _contains_emoji(title):
        title = f"{random_emoji()} {title}"
    suggested_price = None
    seo_title = None
    seo_description = None
    seo_keywords = None
    try:
        from app.modules.ai.templates.service import suggest_price

        suggested_price = suggest_price(product_type=product_type, combined_tags=combined_tags)
    except Exception:
        suggested_price = None
    try:
        clean_title = re.sub(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF]", "", title or "").strip()
        clean_desc = " ".join((description or "").replace("\n", " ").split())
        seo_title = (clean_title or title or None)
        seo_description = clean_desc[:155] + ("…" if clean_desc and len(clean_desc) > 155 else "")
        seo_keywords = ", ".join(combined_tags[:10]) if combined_tags else None
    except Exception:
        pass
    return {
        "session_id": str(variant_id),
        "product_type": product_type,
        "image_count": len(media_assets),
        "combined_tags": combined_tags,
        "title": title,
        "description": description,
        "suggested_variant_price_czk": suggested_price,
        "seo_title": seo_title,
        "seo_description": seo_description,
        "seo_keywords": seo_keywords,
        **rag_meta,
    }
