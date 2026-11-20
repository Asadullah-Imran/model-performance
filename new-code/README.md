# Spatial Multi-Omics Benchmark (`new-code`) — Kaggle Setup & Run Guide

This directory contains the updated standalone training, evaluation, and visualization pipelines for **ARISE**, **SMART**, and **SpatialGlue**, with automatic dashboard/MongoDB ingestion (including per-seed runtime `durationSeconds`).

---

## 📁 Directory Structure

```text
new-code/
├── arise.py            # ARISE: Spatially-Regularized Dual Multimodal GCN
├── smart.py            # SMART: Multi-Modal Graph Autoencoder + MNN Triplets
├── spatialGlue.py      # SpatialGlue: Dual-Attention Spatial Multi-Omics GNN
├── visualizations.py   # Shared publication visualization suite
└── README.md           # This Kaggle setup guide
```

---

## 🚀 Kaggle Notebook Setup (Step-by-Step)

### 1. Configure Kaggle Notebook Settings
In the right-hand **Notebook Options** panel on Kaggle:
1. **Accelerator:** Select **GPU T4 x2** or **GPU P100** (recommended; scripts auto-detect CUDA).
2. **Internet:** Toggle **ON** (required for `pip install`, downloading benchmark datasets via `gdown`, installing R's `mclust` package, and pushing results to the dashboard API).
3. **Persistence:** Optional — outputs saved under `/kaggle/working/` are preserved in the notebook's Output tab when you click **Save Version**.

---

### 2. Get the Code into `/kaggle/working/`
Either upload the `new-code/` files as a Kaggle Dataset or clone your repository inside a Kaggle code cell:

```bash
%cd /kaggle/working
!git clone <YOUR_REPO_URL> model-performance
%cd /kaggle/working/model-performance/new-code
```

*(If you uploaded the 4 `.py` files directly to `/kaggle/input/new-code/`, copy them into `/kaggle/working/` so `visualizations.py` is importable and outputs are writable:)*

```bash
!cp /kaggle/input/new-code/*.py /kaggle/working/
%cd /kaggle/working
```

---

### 3. Install Python & R Dependencies
Run this in a Kaggle cell before executing any model script:

```bash
!pip install -q scanpy anndata muon torch_geometric gdown rpy2 numba scikit-learn scipy pandas matplotlib seaborn leidenalg python-igraph
```

> [!NOTE]
> `smart.py` and `spatialGlue.py` use `mclust` via `rpy2`. Kaggle images come with R pre-installed, and both scripts automatically install the R `mclust` package on first run if it is missing. You can also pre-install it in a cell:
> ```bash
> !Rscript -e 'if (!requireNamespace("mclust", quietly = TRUE)) install.packages("mclust", repos="https://cloud.r-project.org")'
> ```

---

### 4. Datasets (Automatic Download or Kaggle Input)
The scripts evaluate **6 datasets** by index (`0` to `5`):

| Index | Dataset ID | Modality |
| :--- | :--- | :--- |
| `0` | `10x_human_lymph_node_A1` | RNA + Protein (ADT) |
| `1` | `10x_human_lymph_node_D1` | RNA + Protein (ADT) |
| `2` | `Mouse_Brain_E11_S1` | RNA + ATAC |
| `3` | `Mouse_Brain_E13_S1` | RNA + ATAC |
| `4` | `Mouse_Brain_E15_S1` | RNA + ATAC |
| `5` | `Mouse_Brain_E18_S1` | RNA + ATAC |

- **Automatic download:** If `data/<dataset_name>` does not exist, the scripts automatically download it using `gdown`.
- **Using a pre-uploaded Kaggle Dataset (faster):** If you already uploaded the `data/` folder to `/kaggle/input/<your-dataset>/data`, symlink it into the working directory:
  ```bash
  !ln -s /kaggle/input/<your-dataset>/data /kaggle/working/data
  ```

---

### 5. Run the Models

Each script automatically:
- Measures wall-clock runtime (`durationSeconds`) per seed
- Evaluates `ARI`, `NMI`, `AMI`, `Homogeneity`, `V-measure`, `Silhouette`, `CHI`, and `DBI`
- Generates UMAP & spatial plots + publication visuals
- Saves local CSV/JSON/H5AD artifacts
- Pushes every seed run (metrics, embeddings, UMAP/spatial coordinates, and `durationSeconds`) to the dashboard MongoDB API (`--api_url`)

#### Run All Datasets & Default 9 Seeds
*(Default seeds: `42, 0, 7, 123, 1234, 2022, 2023, 2024, 1337`)*

```bash
!python arise.py
!python smart.py
!python spatialGlue.py
```

#### Run Specific Datasets or Seeds (Recommended for Testing / Split Kaggle Runs)
```bash
# Run ARISE on datasets 0 and 1 with seeds 42 and 2024
!python arise.py --dataset_indices 0 1 --seeds 42 2024

# Run SMART on dataset 2 with a single seed
!python smart.py --dataset 2 --seed 42

# Run SpatialGlue on datasets 0..5 with 3 seeds and custom output folder
!python spatialGlue.py --dataset_indices 0 1 2 3 4 5 --seeds 42 0 2024 --output_dir /kaggle/working/SpatialGlue_outputs
```

#### Common CLI Flags
| Flag | Description | Default |
| :--- | :--- | :--- |
| `--dataset` | Single dataset index (`0` to `5`) | `None` (runs all 6) |
| `--dataset_indices` | Space-separated dataset indices (e.g. `0 1 2`) | `[0, 1, 2, 3, 4, 5]` |
| `--seed` | Single random seed (e.g. `42`) | `None` |
| `--seeds` | Space-separated seeds (e.g. `42 0 7`) | `[42, 0, 7, 123, 1234, 2022, 2023, 2024, 1337]` |
| `--output_dir` | Output folder for results and visuals | `<MODEL>_outputs` |
| `--api_url` | Dashboard upload endpoint (set `""` to disable API upload) | `https://model-performance.vercel.app/api/experiments/upload` |

> [!TIP]
> **ARISE-only flags:** `arise.py` also accepts `--epochs` (default `350`), `--lr` (default `1e-3`), `--hidden_dim` (default `512`), `--out_dim` (default `64`), `--beta`, `--gamma`, `--delta`, and `--device`.

---

### 6. Outputs & Verification
After running, results are saved in `/kaggle/working/<MODEL>_outputs/`:
- `results/<MODEL>_benchmark_results.csv` — All seed runs with `ARI`, `NMI`, `AMI`, `Homogeneity`, `V-measure`, `Silhouette`, `CHI`, `DBI`, and `Duration`.
- `results/experiments/<MODEL>/<dataset>/seed_<seed>/metrics.json` — Standardized JSON including `durationSeconds`.
- `visuals/` — Seed UMAP/spatial plots and cross-dataset publication figures.

If `--api_url` is reachable, each seed prints:
```text
🚀 Sent ARISE (10x_human_lymph_node_A1, seed=42, 18.42s) to Dashboard API!
```
Once complete, refresh your dashboard — the new runs and their execution durations will appear in **Overview**, **Overall Performance**, **Statistical Stability**, and **Dataset Inspector**.
