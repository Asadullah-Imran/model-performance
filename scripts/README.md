# Python Training & Benchmarking Scripts

This directory houses the standalone deep-learning model training pipelines for spatial multi-omics benchmarks.

## 📁 Directory Structure
```text
scripts/
├── AriseSpatialGlue_4Encoder_1Layer.py   # 4-Encoder 1-Layer GCN with RNA PCA
└── ... (add future model training scripts here)
```

## 🚀 Running Scripts

From the repository root:

```bash
# Test run (5 epochs, 2 datasets, 2 seeds)
python scripts/AriseSpatialGlue_4Encoder_1Layer.py \
  --datasets 0 1 \
  --seeds 42 2024 \
  --epochs 5 \
  --api_url https://model-performance.vercel.app/api/experiments/upload
```

For full production run:
```bash
python scripts/AriseSpatialGlue_4Encoder_1Layer.py \
  --datasets 0 1 \
  --seeds 42 2024 \
  --epochs 350 \
  --api_url https://model-performance.vercel.app/api/experiments/upload
```

## 🧩 Adding a New Model Script
When adding a new model script:
1. Extract final metrics (`ARI`, `NMI`, `Silhouette`, `AMI`, `CHI`, `DBI`).
2. Collect epoch loss & clustering history.
3. Call `export_dashboard_experiment(...)` at the end of each seed to push to MongoDB / local JSONs.
