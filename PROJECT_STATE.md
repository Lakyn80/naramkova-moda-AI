
## Admin UI – Product List (Admin)
- Added admin product list page at /admin/products.
- Uses GET /api/products.
- New admin helper: frontend/admin/lib/api.ts and Product type in frontend/admin/lib/types.ts.


## Admin UI – Product Creation (Manual)
- New admin route: /admin/products/new
- API endpoints used: GET /api/categories, POST /api/products
- Fields sent: name, description, price_czk, stock, category_id, image (multipart/form-data)
- Files changed:
  - frontend/admin/app/admin/products/new/page.tsx
  - frontend/admin/app/admin/products/page.tsx
  - frontend/admin/lib/api.ts
  - frontend/admin/lib/types.ts


## Admin UI – AI Description (Frontend-only)
- Added AI-assisted description generation on /admin/products/new.
- Endpoints used: POST /api/ai/vision/analyze, POST /api/ai/deepseek/generate.
- Data flow: image file -> vision attributes (labels, colors, objects) -> context text -> deepseek -> description injected into textarea.
- No auto-save; user still submits Create product.
- Files changed:
  - frontend/admin/app/admin/products/new/page.tsx
  - frontend/admin/lib/api.ts
  - frontend/admin/lib/types.ts

---

## STATUS UPDATE

Step 6B — RAG description memory  
✅ DONE

---

## ACTIVE ENDPOINTS (FASTAPI V2)

- POST /api/ai/rag/ingest

---

## SAFETY STATUS

- no DB schema changes
- no migrations
- no legacy DB access
- FAISS-only persistence

---

## NEXT STEP

Step 6C — AI “Create product fully”
---

## STATUS UPDATE

Step 6C — AI “Create product fully”  
✅ DONE

---

## ACTIVE ENDPOINTS (FASTAPI V2)

- POST /api/ai/vision/analyze
- POST /api/ai/deepseek/generate
- POST /api/ai/rag/search

---

## SAFETY STATUS

- frontend-only implementation
- no backend changes
- no DB writes
- no migrations
- no schema changes

---

## NEXT STEP

Step 6D — AI product refinement tools
---

## STATUS UPDATE

Step 6D — AI product refinement tools  
✅ DONE

---

## ACTIVE ENDPOINTS (FASTAPI V2)

- POST /api/ai/deepseek/generate
- POST /api/ai/rag/search

---

## SAFETY STATUS

- frontend-only implementation
- no backend changes
- no DB writes
- no migrations
- no schema changes

---

## NEXT STEP

Step 7A — Client shop frontend (Next.js)
---

## STATUS UPDATE

Step 7A — Testing, CI/CD foundation  
✅ DONE

---

## TESTING STACK

- pytest (CI only, runs when tests exist)
- fastapi TestClient (planned)
- dependency overrides (planned)
- SQLite test database (planned)
- full endpoint coverage (planned)

---

## CI STATUS

- GitHub Actions enabled
- tests executed on push and PR
- Python 3.12
- single-command verification

---

## SAFETY STATUS

- no production DB access
- no filesystem writes
- no external services called
- all side effects mocked (planned)

---

## NEXT STEP

Step 7B — Docker build & deploy pipeline (CD)
