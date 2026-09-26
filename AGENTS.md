# AGENTS.md: Development & Architecture Guidelines

This file serves as the canonical guideline and reference for AI agents and developers working on the **Model Performance & Spatial Multi-Omics Research Dashboard** repository.

---

## 🎯 Project Overview & Objective

This project is a modern **Next.js research analytics dashboard** designed for deep-learning and spatial multi-omics clustering models (e.g., Arise, SpatialGlue, CAGE, Smart). 

It replaces and significantly extends the legacy static `index.html` with:
1. **Dynamic Model & Experiment Registry:** Fully data-driven, schema-backed system supporting any number of ML models, datasets, seeds, and epochs without hardcoding.
2. **Multi-Metric Statistical Analysis:** Direction-aware evaluation (higher-is-better vs. lower-is-better), paired $t$-test significance testing, standard error ($\pm\text{SEM}$) bounds, and custom preference weighting ablation.
3. **Training Dynamics & Multi-Loss Breakdown:** Per-epoch clustering metric curves and loss component decompositions.
4. **Spatial Multi-Omics & Embedding Visualizations:** UMAP embeddings, ground truth vs. predicted spatial domain maps, and violin cluster profiles.
5. **Python Pipeline Integration:** Direct export hooks from PyTorch/PyG training pipelines into dashboard-compatible JSON and asset artifacts.

---

## 🛠️ Technology Stack & Standards

| Layer | Technology | Guidelines |
| :--- | :--- | :--- |
| **Framework** | Next.js 14+ (App Router) | React Server & Client Components (`'use client'` where interactive). Clean routing structure. |
| **Language** | TypeScript | Strict typing (`strict: true`), no `any` where avoidable. All domain entities typed in `src/types/`. |
| **Styling** | Tailwind CSS + CSS Variables | Maintain tokenized palette from `index.css` (e.g., `--smart-color`, `--cage-color`, `--arise-color`, `--spatialglue-color`, glassmorphism, glowing badges). |
| **Charts** | Chart.js / ApexCharts | Responsive, interactive tooltips, confidence/SEM bands, toggleable multi-seed traces. |
| **Icons** | Lucide React | Standardized Lucide icon components. |
| **Data Engine** | JSON & Static Assets | Dynamically loaded from `public/data/experiments/` with client-side fallback and CSV compatibility. |

---

## 📐 Core Architecture & Directory Structure

```text
src/
├── app/                              # Next.js App Router routes
│   ├── layout.tsx                    # Root shell (Sidebar, Header, Context Providers)
│   ├── page.tsx                      # Overview Dashboard (Summary Cards, Leaderboard, Radar)
│   ├── analytics/page.tsx            # Detailed Analytics (Boxplots, Seed Curves, Mean±SEM)
│   ├── curves/page.tsx               # Training Curves (ARI/Silhouette vs Epoch, Loss Decomposition)
│   ├── comparison/page.tsx           # Head-to-Head (Delta Cards, Paired P-Values, Diff Bars)
│   ├── ablation/page.tsx             # Preference Sliders, Weighted Score Leaderboard, Heatmap
│   ├── stability/page.tsx            # Statistical Stability Table (Mean, SD, CV%, Min, Max)
│   ├── visualizations/page.tsx       # Spatial Maps, UMAPs, Violin Profiles & Modal Compare
│   └── inspector/page.tsx            # Raw Data Explorer with Search, Sort, and CSV Export
├── components/
│   ├── layout/                       # Sidebar, Top Header, FilterBar
│   ├── overview/                     # Summary cards, Leaderboard, Radar
│   ├── analytics/                    # Boxplots, Seed curves, Error bar charts
│   ├── curves/                       # Epoch dynamics, Loss curves with SEM
│   ├── comparison/                   # H2H tables, delta charts
│   ├── ablation/                     # Weight sliders, custom ranking, heatmap
│   ├── visualizations/               # UMAP/Spatial viewers, side-by-side modal
│   └── ui/                           # Badges, dropdowns, buttons, modals, toasts
├── context/
│   └── DashboardContext.tsx          # Global active dataset, models, metrics, theme state
├── lib/
│   ├── data-loader.ts                # Experiment ingestion and manifest reader
│   ├── statistics.ts                 # Math utils: Mean, Median, SD, SEM, P-Value, CV%, Correlation
│   └── registry.ts                   # Metric configs, loss configs, color palettes
└── types/
    └── index.ts                      # Full TypeScript interfaces
```

---

## 📜 Key Engineering Rules for Agents

### 1. No Hardcoded Models or Metrics
- Never hardcode model names (e.g., `["Smart", "CAGE", ...]`) or metric names directly inside component UI logic.
- Always retrieve available models and metrics dynamically from `useDashboard()` context or `data-loader.ts`.

### 2. Metric Direction Awareness
- Different metrics have different optimization directions:
  - Higher is better: `ARI`, `NMI`, `AMI`, `Silhouette`, `Homogeneity`, `V-measure`, `CHI`.
  - Lower is better: `DBI` (Davies-Bouldin Index), loss functions.
- All ranking, leaderboard, and delta calculations must check `metric.direction === 'higher_is_better'` to properly compute ranks and winner margins.

### 3. Visual & Aesthetic Excellence
- Preserve the rich aesthetics established in `index.css`:
  - Dark mode by default with light mode support.
  - Glassmorphic panels (`backdrop-blur-md`, subtle border glows).
  - Model-specific distinct color accents and badges.
  - Smooth micro-interactions and hover animations.

### 4. Statistical Rigor
- When aggregating across seeds:
  - $\text{Mean} = \frac{1}{N}\sum x_i$
  - $\text{Std Dev } \sigma = \sqrt{\frac{\sum (x_i - \bar{x})^2}{N - 1}}$
  - $\text{Standard Error (SEM)} = \frac{\sigma}{\sqrt{N}}$
  - $\text{Coefficient of Variation } CV\% = \frac{\sigma}{\bar{x}} \times 100$
  - Paired comparison $p$-value computed via standard two-tailed Student's $t$-test / normal approximation.

### 5. Standardized Python Training Script Export
- Python scripts (e.g., `AriseSpatialGlue_4Encoder_1Layer.py`) must output structured artifacts:
  - `metrics.json` containing final scalar metrics and best epoch numbers.
  - `curves.json` containing array of per-epoch loss components and clustering scores.
  - Saved PNG/SVG visualization artifacts in designated `assets/` folders.

---

## 🧪 Verification & Quality Checklist

Before marking tasks complete, agents must verify:
- [ ] Next.js app builds cleanly (`npm run build` or `next build`) with zero TypeScript or linting errors.
- [ ] Global dataset selector updates all dashboard tabs synchronously.
- [ ] Metric selection changes properly recompute boxplots, seed curves, bar charts, and leaderboards.
- [ ] Head-to-Head view properly calculates paired score deltas and statistical significance.
- [ ] Custom metric weight sliders dynamically re-rank models in real-time.
- [ ] Loss curves support multiple decomposition components (Total, Recon, Spatial, Reg).
- [ ] Visualizations tab loads UMAPs, spatial ground truth, and predicted domain maps correctly.
- [ ] Raw data table supports search filtering and CSV export.
