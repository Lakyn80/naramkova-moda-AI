# -*- coding: utf-8 -*-
import re
from typing import Dict, Any, List, Union

from .media_repository import get_media_assets_by_session
from .vision_client import analyze_image_with_vision, normalize_tags
from .templates import get_fallback_template

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
}

def translate_tags_to_czech(tags: List[str]) -> List[str]:
    translated = []
    for t in tags:
        t_low = t.lower().strip()
        if t_low in TAG_CZ:
            translated.append(TAG_CZ[t_low])
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

def _fill_template(tpl: str, tags: List[str]) -> str:
    if not tpl:
        return tpl
    replacements = {
        "hlavni_atribut": (tags[0] if tags else "jemný design"),
        "barva": (tags[1] if len(tags) > 1 else "příjemná barva"),
        "motiv": (tags[2] if len(tags) > 2 else "ruční práce"),
        "atmosfera": (tags[0] if tags else "klidná atmosféra"),
        "klíčový_detail": (tags[0] if tags else "precizní detail"),
    }
    out = tpl
    for key, val in replacements.items():
        out = out.replace("{" + key + "}", str(val))
    out = re.sub(r"\{[^}]+\}", "ruční zpracování", out)
    return out

def _get_rag_template(product_type: str) -> str:
    try:
        from .chroma_client import get_template_by_id
        doc_id = f"template_{product_type}"
        text = get_template_by_id(doc_id)
        if text and text.strip():
            return text.strip()
    except Exception:
        pass
    fallback = get_fallback_template(product_type)
    t1 = fallback.get("title_template", "")
    t2 = fallback.get("description_template", "")
    return f"{t1}\n\n{t2}" if t1 or t2 else f"Vzor pro {product_type} – použij strukturu a styl."

def _get_title_and_description(product_type: str, combined_tags: List[str]) -> tuple:
    rag_template = _get_rag_template(product_type)
    try:
        from .llm_client import generate_product_description
        result = generate_product_description(
            vision_tags_cz=combined_tags,
            product_type=product_type,
            rag_template=rag_template,
        )
        if result and result[0] and result[1]:
            return result[0], result[1]
    except Exception:
        pass
    fallback = get_fallback_template(product_type)
    title_tpl = fallback.get("title_template", "")
    desc_tpl = fallback.get("description_template", "")
    parts = rag_template.split("\n\n", 1)
    if len(parts) >= 2 and (not title_tpl or not desc_tpl):
        title_tpl = title_tpl or parts[0].strip()
        desc_tpl = desc_tpl or parts[1].strip()
    title = _fill_template(title_tpl or "Produkt", combined_tags)
    description = _fill_template(desc_tpl or "", combined_tags)
    return title, description

def generate_drafts_for_session(product_id: Union[int, str]) -> Dict[str, Any]:
    media_assets = get_media_assets_by_session(product_id)
    all_tags: List[str] = []
    for asset in media_assets:
        try:
            vision_result = analyze_image_with_vision(asset.path_original)
            raw_tags = normalize_tags(vision_result)
            print(f"[VISION RAW TAGS] product_id={product_id}, file={asset.path_original}: {raw_tags}")
            tags_cz = translate_tags_to_czech(raw_tags)
            asset.tags = tags_cz
            all_tags.extend(tags_cz)
        except Exception as e:
            print(f"[VISION ERROR] {asset.path_original}: {e}")
    product_type = detect_product_type(all_tags)
    combined_tags = list(dict.fromkeys(all_tags))
    title, description = _get_title_and_description(product_type, combined_tags)
    if title and not _contains_emoji(title):
        title = f"{random_emoji()} {title}"
    return {
        "session_id": str(product_id),
        "product_type": product_type,
        "image_count": len(media_assets),
        "combined_tags": combined_tags,
        "title": title,
        "description": description,
    }

def generate_drafts_for_variant(variant_id: Union[int, str]) -> Dict[str, Any]:
    from .media_repository import get_media_assets_for_variant
    media_assets = get_media_assets_for_variant(variant_id)
    all_tags: List[str] = []
    for asset in media_assets:
        try:
            vision_result = analyze_image_with_vision(asset.path_original)
            raw_tags = normalize_tags(vision_result)
            print(f"[VISION RAW TAGS] variant_id={variant_id}, file={asset.path_original}: {raw_tags}")
            tags_cz = translate_tags_to_czech(raw_tags)
            asset.tags = tags_cz
            all_tags.extend(tags_cz)
        except Exception as e:
            print(f"[VISION ERROR] {asset.path_original}: {e}")
    product_type = detect_product_type(all_tags)
    combined_tags = list(dict.fromkeys(all_tags))
    title, description = _get_title_and_description(product_type, combined_tags)
    if title and not _contains_emoji(title):
        title = f"{random_emoji()} {title}"
    return {
        "session_id": str(variant_id),
        "product_type": product_type,
        "image_count": len(media_assets),
        "combined_tags": combined_tags,
        "title": title,
        "description": description,
    }
