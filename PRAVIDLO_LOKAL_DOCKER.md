# Pravidlo: Stejné prostředí lokálně i v Dockeru

**Všechna data a závislosti musí být sdílené tak, aby lokální běh a Docker používaly totéž.**

## Závislosti (knihovny)

- **Jediný zdroj:** `backend/requirements.txt`
- Lokál: `pip install -r backend/requirements.txt`
- Docker: v `backend.Dockerfile` se instaluje ze stejného `requirements.txt`
- **Žádné** ruční instalace jen v kontejneru – přidáš knihovnu vždy do `requirements.txt` a znovu buildni image.

## Data (DB, uploady, Chroma, …)

- **Vše v adresářích projektu** – Docker používá **bind mount** na tytéž složky jako lokál:

| Účel        | Složka v projektu                              | V Dockeru (cesta v kontejneru)           |
|-------------|-------------------------------------------------|-------------------------------------------|
| Databáze    | `./data`                                       | `/app/data`                               |
| Obrázky     | `./backend/static/uploads`                     | `/app/static/uploads`                     |
| Chroma RAG  | `./backend/app/modules/ai/rag/chroma_db`       | `/app/app/modules/ai/rag/chroma_db`       |

- Důsledek: co nahraješ nebo naseeduješ **lokálně**, vidíš i v **Dockeru** a naopak. Žádné oddělené úložiště jen pro Docker.

## Pravidlo při změnách

1. Novou Python knihovnu přidat **jen** do `backend/requirements.txt`.
2. Nová data / cache ukládat **jen** do složek v projektu, které jsou v Dockeru namountované (ne do named volume, které není bind mount).
3. Konfigurace cest: lokál vs. Docker řeší `RUNNING_IN_DOCKER` (např. v `backend/app/core/paths.py`); fyzické soubory zůstávají ve stejných složkách na disku.
