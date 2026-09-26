# Python Training & Benchmarking Scripts

This directory houses the standalone deep-learning model training pipelines for spatial multi-omics benchmarks.

## 📁 Directory Structure
```text
scripts/
├── AriseSpatialGlue_4Encoder_1Layer.py   # 4-Encoder 1-Layer GCN with RNA PCA
├── Astra.py                             # ASTRA: Spot-Adaptive Gated GCN + Spatial Potts DEC
└── README.md
```

## 🚀 Running Scripts

### 1. Running ARISE (4-Encoder 1-Layer):
```bash
python scripts/AriseSpatialGlue_4Encoder_1Layer.py \
  --datasets 0 1 \
  --seeds 42 2024 \
  --epochs 350 \
  --api_url https://model-performance.vercel.app/api/experiments/upload
```

### 2. Running ASTRA (Gated GCN + Potts DEC):
```bash
python scripts/Astra.py \
  --datasets 0 1 \
  --seeds 42 2024 \
  --pretrain_epochs 250 \
  --finetune_epochs 150 \
  --api_url https://model-performance.vercel.app/api/experiments/upload
```

## 🧩 Adding a New Model Script
When adding a new model script:
1. Extract final metrics (`ARI`, `NMI`, `Silhouette`, `AMI`, `Homogeneity`, `V-measure`, `CHI`, `DBI`).
2. Collect epoch loss decomposition (`total_loss`, `reconstruction_loss`, `spatial_loss`, `reg_loss`) & clustering metric history.
3. Export 100% of spatial and UMAP spot coordinates in `embeddingsData`.
4. Call `export_dashboard_experiment(...)` at the end of each seed to push to MongoDB / local JSONs.
