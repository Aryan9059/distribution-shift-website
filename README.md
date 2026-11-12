# Distribution Shift: Detect, then Adapt

Research demo for *Shift-Gated Test-Time Adaptation for Traffic-Sign Recognition under Tunnel Darkness and Fog*.

- **Overview** (`/`): problem, pipeline, dataset and model.
- **Demonstration** (`/demo`): upload or pick a traffic-sign image, apply tunnel darkness or fog at severity 1–3, and see how the trained ResNet-18 responds (class, confidence, entropy).
- **Results & Conclusions** (`/results`): the notebook's actual results, including the negative findings.

```
app/, components/, lib/   Next.js 16 frontend (TypeScript, Tailwind, Recharts)
backend/                  FastAPI + PyTorch service (loads the trained ResNet-18)
```

## Run locally

**Backend** (Python 3.10+), needed for the Demonstration page:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

The backend is ready when it prints `Application startup complete`; `http://localhost:8000/health` should answer.

**Frontend:**

```bash
npm install
cp .env.example .env.local        # Windows: copy .env.example .env.local
npm run dev                        # http://localhost:3000
```

The Overview and Results pages work without the backend.

## What is where

| File | Purpose |
|---|---|
| `backend/artifacts/resnet18_source.pt` | trained checkpoint from the notebook |
| `backend/artifacts/config.json` | thresholds, gate settings, normalisation and corruption settings |
| `backend/artifacts/reference_entropy.npy` | clean reference entropies for the KS detector |
| `backend/artifacts/test_pool.npz` | held-out test images (source of the sample images) |
| `backend/artifacts/*.csv` | the notebook's result files (served by `/experiments`) |
| `lib/data/results.json` | the CSVs aggregated for the Results page |

`reference_entropy.npy` and `test_pool.npz` were not exported by the notebook. `backend/scripts/export_data.py`
rebuilds them with the notebook's split and asserts the 15,990 / 2,970 / 2,310 / 5,370 image counts.
`backend/scripts/build_results_json.py <csv folder>` regenerates `lib/data/results.json`.

## Correctness check

`python backend/scripts/verify_notebook_match.py` replays the notebook's seed-0 streams through the backend's
detector, gate and TENT code. For E2 and E3 it gave identical gate decisions and per-window accuracies in all
166 windows; KS distances differ by at most 0.006 (CPU vs GPU rounding).

## API

Used by the Demonstration page: `GET /samples` · `POST /predict` · `POST /corrupt`.

Also available: `GET /health` · `GET /experiments` · `GET /experiments/{id}` (stored notebook results) and the
stream-simulation endpoints `GET /simulation/scenarios` · `POST /simulation/start` · `POST /simulation/{id}/step`
· `GET /simulation/{id}/status` · `POST /simulation/{id}/reset`. The simulation endpoints run the notebook's
streams window by window through the detector, gate and TENT, with a separate model state per session. The current
website does not use them (`components/StreamDemo.tsx` is an unused component); add it back to `app/demo/page.tsx`
to re-enable the live stream demo.

## Deploying

Frontend on Vercel (set `NEXT_PUBLIC_API_URL` to the backend URL). Backend on Render or a Hugging Face Space, with
`ALLOWED_ORIGINS` set to the frontend URL. The backend needs about 1 GB of RAM (PyTorch); free tiers with 512 MB
may not be enough. The included `backend/Dockerfile` has not been tested.
