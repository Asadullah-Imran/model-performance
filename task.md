## Task: Build a Next.js Model Performance & Research Analysis Dashboard

First, carefully inspect the **two provided files**:

1. The existing `index.html` (./index.html and ./index.css)
2. The sample Python file (./AriseSpatialGlue_4Encoder_1Layer.py)

Do **not** start coding immediately. First understand how the existing `index.html` works, what data it currently displays, and how the Python file generates or stores the model results.

---

# 1. Main Goal

I want to convert/recreate the existing `index.html` as a modern **Next.js application**, while significantly extending its functionality.

The existing dashboard functionality should remain conceptually the same, including:

* Overview Dashboard
* Overall Performance Rank
* Detailed Analytics
* Seed-by-Seed Performance Curve
* Mean Performance & Standard Error
* Head-to-Head Comparison

However, the new Next.js application should additionally support **model-specific experimental data and research visualizations**.

The application should function as a central dashboard for storing, comparing, and analyzing multiple ML/deep-learning models and their experimental results.

---

# 2. Additional Model Data to Support

For every model, I want to be able to store and display:

### Model Information

* Model name
* Model version
* Description
* Architecture
* Dataset
* Number of parameters
* Training configuration
* Hyperparameters
* Encoder/module information
* Loss-function configuration
* Training epochs
* Learning rate
* Other relevant metadata

### Performance Metrics

At minimum:

* ARI
* NMI
* AMI
* Silhouette Score
* CHI
* DBI

If additional metrics already exist in the provided files, preserve them.

---

# 3. Training Curves

For each model and each experiment/seed, I want to visualize training progress over epochs.

The dashboard should support curves for:

### Clustering Metrics

* ARI vs Epoch
* NMI vs Epoch
* AMI vs Epoch
* Silhouette vs Epoch

### Loss Curves

* Total Loss vs Epoch
* Reconstruction Loss vs Epoch
* Contrastive Loss vs Epoch
* Spatial Loss vs Epoch
* Sinkhorn / OT Loss vs Epoch
* DEC Loss
* Any other individual loss components used by the model

The system should be flexible enough that I can add new loss components later without changing the entire frontend architecture.

---

# 4. Spatial / Embedding Visualizations

For each model/experiment, I also want to display:

* UMAP embedding
* Ground Truth cluster visualization
* Predicted cluster visualization
* Spatial Map
* Any other generated visualization relevant to spatial multi-omics clustering

These should ideally be selectable from the dashboard.

For example:

```text
Visualizations

[ UMAP ] [ Ground Truth ] [ Prediction ] [ Spatial Map ]
```

If there are multiple UMAPs or spatial maps, the UI should allow selecting the corresponding experiment/seed/epoch.

---

# 5. Existing Dashboard Features

The existing functionality from `index.html` should be preserved.

The following sections should continue to work:

## Overview Dashboard

Show a high-level summary of all available models.

Example:

```text
Models: 8
Datasets: 4
Experiments: 32
Seeds: 5
```

Include summary metric cards and useful visualizations.

---

## Overall Performance Rank

Show model-level aggregate performance.

However, do NOT hard-code a single metric.

The user should be able to select:

```text
Metric:
[ ARI ▼ ]
[ NMI ]
[ Silhouette ]
[ AMI ]
[ CHI ]
[ DBI ]
```

For metrics where higher is better:

* ARI
* NMI
* AMI
* Homogeneity
* V-measure
* Silhouette
* CHI

For metrics where lower is better:

* DBI

Make this direction configurable rather than hard-coded throughout the application.

---

## Detailed Analytics

Allow the user to select:

```text
Model
Dataset
Seed
Metric
```

Then show detailed results.

Include:

* Final metric
* Mean metric
* Standard deviation
* Standard error
* Best epoch
* Best score
* Final score
* Training duration if available

---

## Seed-by-Seed Performance Curve

For a selected model:

```text
Seed 42
Seed 1234
Seed 2024
...
```

Display the performance curve across epochs.

The user should be able to toggle individual seeds on/off.

---

## Mean Performance & Standard Error

For multiple seeds, calculate and display:

```text
Mean Performance
± Standard Error
```

The graph should ideally display:

```text
Mean curve
+
Shaded standard-error region
```

This should work for:

* ARI
* NMI
* Silhouette
* Losses
* Other numerical training metrics

---

## Head-to-Head Comparison

Allow comparison between two or more models.

Example:

```text
Model A vs Model B vs Model C
```

Compare:

* Final ARI
* Best ARI
* NMI
* Silhouette
* AMI
* CHI
* DBI
* Training loss
* Training curves
* UMAP
* Spatial maps

The comparison UI should make it easy to understand how models differ.

---

# 6. Experiment Structure

Please design the data structure around the concept of an **Experiment**.

A possible hierarchy is:

```text
Model
 └── Dataset
      └── Experiment
           └── Seed
                ├── Epoch Metrics
                ├── Final Metrics
                ├── Loss History
                ├── UMAP
                ├── Ground Truth
                ├── Prediction
                └── Spatial Map
```

Do not blindly follow this structure if the provided files suggest a better architecture.

First inspect the existing data and determine the most scalable structure.

---

# 7. What Input Is Required to Create a Model?

One of the most important tasks is to determine exactly what data I need to provide when adding a new model.

Please create a clear specification for this.

For example:

### Required

```text
Model Name
Dataset
Seed
Epoch
ARI
NMI
AMI
Silhouette
Total Loss
```

### Optional

```text
Model Description
Architecture
Hyperparameters
Number of Parameters
Training Time
Additional Losses
UMAP
Ground Truth
Prediction
Spatial Map
```

But do not assume these fields are correct.

Analyze the existing `index.html` and Python file and determine the actual required fields.

---

# 8. Recommended Data Format

Please determine whether the application should use:

* JSON
* CSV
* database
* static files
* API
* or a combination

For the first version, prefer a simple architecture that is easy to maintain and deploy.

The system should make it easy to add a new experiment without manually editing many frontend files.

For example, ideally I should be able to add something like:

```text
experiments/
  model-a/
    dataset-a/
      seed-42/
        metrics.json
        curves.json
        umap.png
        ground-truth.png
        spatial-map.png
```

or an equivalent structured format.

Please recommend the best structure after inspecting the provided files.

---

# 9. Analyze the Sample Python File

The provided Python file is extremely important.

Please inspect it carefully and answer:

### What should be kept?

Identify code responsible for:

* calculating metrics
* storing epoch-level metrics
* storing loss values
* generating UMAP
* generating ground-truth plots
* generating spatial maps
* saving experiment results
* seed handling
* model metadata

### What should be removed?

Identify code that is:

* unnecessary for the dashboard
* duplicated
* hard-coded
* only useful for model training
* unsuitable for the Next.js application
* producing output that the frontend does not need

### What should be modified?

Identify code that should be changed so that the Python training pipeline produces dashboard-compatible output.

---

# 10. Python → Next.js Data Pipeline

Design a clean pipeline:

```text
Python Training
      ↓
Experiment Results
      ↓
Structured JSON / Images
      ↓
Next.js
      ↓
Dashboard
```

The Python side should ideally export a standardized result format.

For example:

```json
{
  "model": "ModelA",
  "dataset": "Human_Lymph_A1",
  "seed": 42,

  "final_metrics": {
    "ari": 0.72,
    "nmi": 0.68,
    "silhouette": 0.31
  },

  "training_history": [
    {
      "epoch": 1,
      "ari": 0.21,
      "silhouette": 0.08,
      "total_loss": 120.4,
      "reconstruction_loss": 5.2,
      "contrastive_loss": 1.4
    }
  ],

  "visualizations": {
    "umap": "...",
    "ground_truth": "...",
    "prediction": "...",
    "spatial_map": "..."
  }
}
```

This is only an example. Design the final schema based on the actual files.

---

# 11. Next.js Architecture

Create a clean and scalable Next.js architecture.

Suggested conceptual structure:

```text
Dashboard
│
├── Overview
│
├── Models
│   ├── Model List
│   └── Model Details
│
├── Performance
│   ├── Overall Ranking
│   ├── Detailed Analytics
│   ├── Seed Comparison
│   └── Head-to-Head
│
├── Training Analysis
│   ├── Metric Curves
│   └── Loss Curves
│
├── Visualizations
│   ├── UMAP
│   ├── Ground Truth
│   ├── Prediction
│   └── Spatial Map
│
└── Experiments
    ├── Dataset
    ├── Seed
    └── Experiment Details
```

Use reusable components rather than putting everything into one page.

---

# 12. Important UI Requirements

The dashboard should be research-oriented and easy to analyze.

Include filters such as:

```text
Model
Dataset
Seed
Metric
Experiment
```

Changing a filter should update the relevant charts and visualizations.

Use interactive charts where appropriate.

For example:

* hover over epoch → show exact metric/loss
* toggle seeds
* toggle models
* select metric
* zoom into curves
* compare models
* switch visualization types

---

# 13. Avoid Hard-Coding

Do NOT hard-code things like:

```text
Model A
Model B
Model C
ARI
NMI
Loss
```

throughout the application.

Instead, create a data-driven architecture where models, metrics, losses, datasets, seeds, and experiments are dynamically loaded.

The system should support adding a new model without rewriting the dashboard.

---

# 14. First Phase: Analysis Before Coding

Before implementing the Next.js application, provide me with a short technical analysis containing:

### A. Existing `index.html`

* What it currently does
* What components/features it contains
* What should be preserved
* What should be redesigned

### B. Sample Python File

* What it currently does
* What outputs it produces
* What should be preserved
* What should be removed
* What should be added

### C. Required Data Schema

Clearly define:

```text
Model
Dataset
Experiment
Seed
Epoch
Metrics
Losses
Visualizations
Metadata
```

### D. Python Output Specification

Tell me exactly what the Python training script should generate.

### E. Next.js Architecture

Recommend:

* folder structure
* components
* data-loading approach
* chart library
* image/visualization handling
* state management if needed

---

# 15. Implementation

After the analysis, implement the Next.js project.

Requirements:

* Clean TypeScript
* Reusable components
* Responsive UI
* Research-dashboard style
* No unnecessary complexity
* Data-driven architecture
* Easy experiment/model addition
* Preserve the existing dashboard functionality
* Add the new training/loss/visualization functionality

Do not delete the existing functionality simply because the new system is being introduced.

The final application should effectively become:

```text
Existing Model Comparison Dashboard
                 +
      Experiment Management
                 +
       Training Analysis
                 +
       Loss Visualization
                 +
       Embedding Analysis
                 +
       Spatial Visualization
                 =
      Research Model Dashboard
```

---

# 16. Final Deliverables

After implementation, provide:

1. Complete Next.js project structure
2. Data schema
3. Example model/experiment data
4. Updated Python output format
5. Explanation of how to add a new model
6. Explanation of how to add a new seed
7. Explanation of how to add a new dataset
8. Explanation of how to add new metrics/losses
9. Explanation of how visualization files are connected
10. List of all changes made to the sample Python file
11. List of all changes made compared with the original `index.html`

Most importantly, make the system **generalized and extensible** rather than building a dashboard specifically around the current sample model.
