# -*- coding: utf-8 -*-
# Výchozí systémové šablony (fallback)
# Použijí se pouze pokud nejsou žádné šablony v DB / Chroma.

bracelet_template = {
    "title_template": "Jemný náramek {hlavni_atribut}",
    "description_template": (
        "Ručně vyrobený náramek v jemném designu. "
        "Dominují mu tóny {barva} a detail {motiv}. "
        "Vhodný jako osobní dárek nebo elegantní doplněk pro každý den."
    ),
    "product_type": "bracelet",
    "style": "romantic",
    "tone": "jemný"
}

candle_template = {
    "title_template": "Svíčka {atmosfera}",
    "description_template": (
        "Dekorativní svíčka s příjemným vzhledem. "
        "Barevné ladění: {barva}. "
        "Skvěle doplní interiér nebo poslouží jako milý dárek."
    ),
    "product_type": "candle",
    "style": "minimalist",
    "tone": "klidný"
}

generic_template = {
    "title_template": "Designový produkt {hlavni_atribut}",
    "description_template": (
        "Stylový produkt s výraznými prvky {klíčový_detail}. "
        "Vhodný pro osobní použití i jako dárek."
    ),
    "product_type": "other",
    "style": "neutral",
    "tone": "informativní"
}


def get_fallback_template(product_type: str):
    """
    Vrátí fallback šablonu podle typu produktu.
    Pro bracelet/candle konkrétní šablonu, jinak generic.
    """
    if product_type == "bracelet":
        return bracelet_template
    if product_type == "candle":
        return candle_template
    return generic_template
