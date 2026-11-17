# Distribution Shift: Detect, Trust, then Adapt

Research site for *Detect, Trust, then Adapt: Evidence-Weighted Test-Time Normalisation for Temporally Correlated
Traffic-Sign Streams*. The full report is served at `/report.pdf`.

- **Overview** (`/`): problem, the Detect → Trust → Adapt → Reset pipeline, dataset and model.
- **Demonstration** (`/demo`): upload or pick a traffic-sign image, apply tunnel darkness or fog at severity 1–3, and see how the trained ResNet-18 responds (class, confidence, entropy).
- **Results & Conclusions** (`/results`): held-out test results of the new system against the original gated TENT and
  the baselines, plus detector comparison, TENT decomposition, shuffled control, ablations and limitations.

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
| `backend/artifacts/resnet18_source.pt` | trained checkpoint (the extension's geometric-augmentation model) |
| `backend/artifacts/config.json` | thresholds, gate settings, normalisation and corruption settings |
| `backend/artifacts/reference_entropy.npy` | clean reference entropies for the KS detector |
| `backend/artifacts/test_pool.npz` | held-out test images (source of the sample images) |
| `backend/artifacts/*.csv` | the notebook's result files (served by `/experiments`) |
| `backend/artifacts/detect_trust_adapt/results.txt` | every result table of the extension (`out/results.txt` from its `aggregate.py`) |
| `backend/artifacts/detect_trust_adapt/frozen_cfg.json` | the validation-selected configuration (detector, gate m/k, adapter) |
| `lib/data/results.json` | `results.txt` parsed for the Overview and Results pages |
| `public/figures/fig_*.png`, `public/report.pdf` | figures and the revised report from the extension package |

`backend/scripts/export_data.py` downloads GTSRB into `backend/data/`. It also writes `test_pool.npz` and
`reference_entropy.npy` with the *original notebook's* split, so after it, run `export_dta_model.py` (below) again.
`python backend/scripts/build_results_json.py [results.txt]` regenerates `lib/data/results.json` from the extension's
results file. The original notebook CSVs in `backend/artifacts/*.csv` are still served by `/experiments`.

The backend model is the extension's `resnet18_original_geo_aug.pt`. `python backend/scripts/export_dta_model.py
<package folder>` installs it as `artifacts/resnet18_source.pt`, writes its normalisation into `config.json`, rebuilds
the extension's track-aware split (checked against `normalisation.npz`) to regenerate `test_pool.npz` and
`reference_entropy.npy`, and prints frame-level accuracy against the published static-robustness table. The tunnel and
fog code in `app/simulation/corruptions.py` follows the extension's `lib.py`. The unused stream simulator still runs
the original entropy-KS gate with TENT, and its thresholds in `config.json` are from the original notebook.

## Correctness check

`python backend/scripts/verify_notebook_match.py` replays the notebook's seed-0 streams through the backend's
detector, gate and TENT code. For E2 and E3 it gave identical gate decisions and per-window accuracies in all
166 windows; KS distances differ by at most 0.006 (CPU vs GPU rounding). That check was for the original notebook's
checkpoint, split and fog implementation, which have since been replaced.

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
