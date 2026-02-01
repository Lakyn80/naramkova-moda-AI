
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

---

## STATUS UPDATE

Step 7C — Frontend build stabilization  
✅ DONE

---

## FIXES APPLIED

- resolved ESM vs CommonJS conflict
- unified frontend config format
- admin build successful
- client build successful

---

## SAFETY STATUS

- frontend-only changes
- no backend modifications
- no API changes
- no DB changes
- no Docker changes

---

## NEXT STEP

Step 7D — Production deploy (Docker + VPS)

---

## STATUS UPDATE

Step 7C — Docker frontend build fix  
✅ DONE

---

## FIX SUMMARY

- resolved SWC win32 vs linux conflict
- Docker builds now platform-agnostic
- package-lock.json excluded from container builds
- local Windows development unchanged

---

## SAFETY STATUS

- Dockerfile-only change
- frontend runtime unchanged
- no backend changes
- no dependency changes
- no DB changes
- no API changes

---

## FINAL STEP

After applying fixes, run:

docker compose down -v
docker compose build --no-cache
docker compose up

---

## STATUS UPDATE

Frontend config hotfix  
✅ DONE

---

## FIX SUMMARY

- switched Tailwind/PostCSS configs to .cjs
- restored CommonJS exports to match Node resolution
- prevents "module is not defined" during CSS build

---

## STATUS UPDATE

Step 7C — Linux Docker SWC fix (exception approved)  
✅ DONE

---

## FIX SUMMARY

- removed @next/swc-win32-x64-msvc from frontend dependencies
- Linux Docker builds no longer require Windows-only SWC binary
- Docker install now resolves correct platform package

---

## SAFETY STATUS

- frontend dependency cleanup only (exception approved)
- no backend changes
- no API changes
- no DB changes
- no Docker changes

---

## STATUS UPDATE

Step 7E — Frontend routing rebuild  
✅ DONE

---

## FIX SUMMARY

- rebuilt Next.js App Router structure
- restored layout.tsx in admin and client
- fixed nested routing
- removed placeholder pages
- verified all routes

---

## SAFETY STATUS

- frontend-only changes
- no backend changes
- no Docker changes
- no API changes
- no DB changes

---

## NEXT STEP

Step 7F — Client checkout & payments

---

## STATUS UPDATE

Admin UI parity alignment (legacy templates → React)  
✅ DONE

---

## CHANGES

- admin products list now mirrors legacy filters + table (client-side filtering)
- admin product create form styled to match legacy add.html + modernized UI
- admin categories list styled after legacy template (client-side filter)
- added `.env.local` in admin + client for NEXT_PUBLIC_API_BASE

---

## SAFETY STATUS

- frontend-only changes
- no backend changes
- no Docker changes
- no API changes
- no DB changes

---

## STATUS UPDATE

CORS + čeština ve frontend UI  
✅ DONE

---

## FIX SUMMARY

- přidán Next.js rewrite proxy na /api a /static (CORS odstraněn)
- NEXT_PUBLIC_API_BASE vyprázdněn, backend URL přes NMM_BACKEND_URL
- všechny UI hlášky a tlačítka přepnuty do češtiny
- API helpery používají trailing slash pro legacy endpointy

---

## SAFETY STATUS

- frontend-only změny
- žádné změny backendu
- žádné změny Dockeru
- žádné změny API
- žádné změny DB

---

## STATUS UPDATE

Step 8A — Admin CRUD backend parity  
✅ DONE

---

## ACTIVE ENDPOINTS (FASTAPI V2)

Products:
- POST   /api/products
- PUT    /api/products/{id}
- DELETE /api/products/{id}

Categories:
- POST   /api/categories
- PUT    /api/categories/{id}
- DELETE /api/categories/{id}

---

## SAFETY STATUS

- legacy DB preserved
- no schema changes
- no migrations
- transactional writes
- filesystem-safe media handling

---

## NEXT STEP

Step 8B — Admin payments & invoice actions parity

---

## STATUS UPDATE

Backend response extension for media IDs  
✅ DONE

---

## CHANGE SUMMARY

- GET /api/products now includes media_items with id/filename/media_type/url
- legacy media array preserved for backward compatibility
- no new endpoints, no delete logic changes

---

## SAFETY STATUS

- schema unchanged
- no migrations
- backward-compatible response extension only

---

## STATUS UPDATE

Step 8B — Admin UI CRUD parity  
✅ DONE

---

## SAFETY STATUS

- frontend-only changes
- backend unchanged
- database unchanged
- no Docker changes

---

## NEXT STEP

Step 8C — Admin dashboard (orders, payments, sold)
