# -*- coding: utf-8 -*-
from typing import Dict, List, Any
import os

from google.cloud import vision


def analyze_image_with_vision(image_path: str) -> Dict[str, Any]:
    """
    Analýza obrázku pomocí Google Vision API.
    Čte data z response.label_annotations (bez to_dict()).
    Vrátí slovník: labels, scores.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Soubor nenalezen: {image_path}")

    client = vision.ImageAnnotatorClient()

    with open(image_path, "rb") as f:
        content = f.read()

    image = vision.Image(content=content)
    response = client.label_detection(image=image)

    labels: List[str] = []
    scores: List[float] = []
    for ann in response.label_annotations:
        labels.append(ann.description.lower() if ann.description else "")
        scores.append(float(ann.score) if ann.score is not None else 0.0)

    return {
        "labels": labels,
        "scores": scores,
    }


def normalize_tags(vision_result: Dict[str, Any]) -> List[str]:
    """
    Z Vision výsledku vybere labely a vrátí je jako seznam
    normalizovaných řetězců (strip, lower).
    """
    labels = vision_result.get("labels", [])
    return [str(t).strip().lower() for t in labels if t]
