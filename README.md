# Naramkova Moda v2

This is the new FastAPI + Next.js project. Only the FastAPI skeleton is created so far.

## Backend (FastAPI)

From  backend:

1) Create a virtualenv and install deps
`
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
`

2) Run the API
`
uvicorn app.main:app --reload
`

## Notes
- Invoice API is disabled by default. Set NMM_EXPOSE_INVOICE_API=true to enable.
