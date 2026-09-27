#!/usr/bin/env python3
"""
================================================================================
🧬 ARISE: Spatially-Regularized Deep Multimodal Graph Clustering with Consistency
================================================================================
Deep Learning Spatial Multi-Omics Clustering Pipeline based on ARISE:
  • Dual-stream Graph Convolutional Network (GCN) for multimodal spatial representation
  • Expression Cosine Similarity Graph + Spatial Proximity Graph + Overlapping Common Graph
  • Dual-stage Cross-Modal Linear & Latent Feature Fusion
  • Multi-target joint decoders (RNA, Protein/ATAC, and Combined reconstruction)
  • Spatial Regularization Loss (local smoothness + contrastive neighbor separation)
  • L1 / L2 Parameter Regularization
  • Comprehensive Evaluation: ARI, NMI, AMI, Silhouette, Homogeneity, V-measure, FMI, CHI, DBI
  • Multi-loss trajectory tracking: Total Loss, Recon Loss, Spatial Loss, Reg Loss, Silhouette, and ARI
  • Full Spatial & UMAP Embeddings export (100% of spots)
  • Direct Dashboard API Integration: Automatically pushes structured JSONs & metrics to MongoDB / Next.js
================================================================================
"""

import os
import sys
import copy
import json
import time
import random
import argparse
import warnings
import urllib.request
import urllib.error
from typing import Optional, Tuple, Dict, List, Union

# Suppress non-critical warnings
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

# Setup R environment paths if available
if 'R_HOME' not in os.environ and os.path.exists('/usr/lib/R'):
    os.environ['R_HOME'] = '/usr/lib/R'
    os.environ['PATH'] = '/usr/lib/R/bin:' + os.environ.get('PATH', '')

import numpy as np
import pandas as pd
import scipy
import scipy.sparse as sp
from scipy.spatial.distance import cdist

import sklearn
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.neighbors import NearestNeighbors, kneighbors_graph
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    adjusted_rand_score,
    normalized_mutual_info_score,
    adjusted_mutual_info_score,
    homogeneity_score,
    v_measure_score,
    fowlkes_mallows_score,
    silhouette_score,
    silhouette_samples,
    calinski_harabasz_score,
    davies_bouldin_score
)

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.backends import cudnn
from torch_geometric.data import Data
from torch_geometric.nn import GCNConv

import scanpy as sc
import anndata as ad
import matplotlib.pyplot as plt
import seaborn as sns


# ==============================================================================
# 1. Dataset Registry & Global Settings
# ==============================================================================

CHOICES = [
    ("10x_human_lymph_node_A1", "https://drive.google.com/drive/folders/10z1N4MwW8Y49o8GlkYGBKVx1N7fiMuyC"),
    ("10x_human_lymph_node_D1", "https://drive.google.com/drive/folders/1-g_Ca2XMaMXF-MisuVY-wobWDX86O6zz"),
    ("Mouse_Brain_E11_S1", "https://drive.google.com/drive/folders/1zRwDJrYnks0LRzlAVRqPU7jE_OcStgPo"),
    ("Mouse_Brain_E13_S1", "https://drive.google.com/drive/folders/1GOufwIRjjfcd9Bi2GKtebzKoPCg2jVud"),
    ("Mouse_Brain_E15_S1", "https://drive.google.com/drive/folders/1rHkTL5OF5qPsEERypRGMS51SjUQ69tdD"),
    ("Mouse_Brain_E18_S1", "https://drive.google.com/drive/folders/1Xj1LNIAY93biS6JIMKNRODn5GvtCKADB"),
]

DATASET_REGISTRY = {
    "10x_human_lymph_node_A1": {
        "index": 0,
        "url": "https://drive.google.com/drive/folders/10z1N4MwW8Y49o8GlkYGBKVx1N7fiMuyC",
        "type": "10x",
        "gt_col": "manual-anno",
        "other_file": "adata_ADT.h5ad",
        "anno_file": "annotation.csv",
        "default_epochs": 350,
        "hvg_genes": 3000,
    },
    "10x_human_lymph_node_D1": {
        "index": 1,
        "url": "https://drive.google.com/drive/folders/1-g_Ca2XMaMXF-MisuVY-wobWDX86O6zz",
        "type": "10x",
        "gt_col": "manual-anno",
        "other_file": "adata_ADT.h5ad",
        "anno_file": "annotation.csv",
        "default_epochs": 350,
        "hvg_genes": 3000,
    },
    "Mouse_Brain_E11_S1": {
        "index": 2,
        "url": "https://drive.google.com/drive/folders/1zRwDJrYnks0LRzlAVRqPU7jE_OcStgPo",
        "type": "Spatial-epigenome-transcriptome",
        "gt_col": "cluster",
        "other_file": "adata_ATAC.h5ad",
        "anno_file": "anno.csv",
        "default_epochs": 350,
        "hvg_genes": 3000,
    },
    "Mouse_Brain_E13_S1": {
        "index": 3,
        "url": "https://drive.google.com/drive/folders/1GOufwIRjjfcd9Bi2GKtebzKoPCg2jVud",
        "type": "Spatial-epigenome-transcriptome",
        "gt_col": "cluster",
        "other_file": "adata_ATAC.h5ad",
        "anno_file": "anno.csv",
        "default_epochs": 350,
        "hvg_genes": 3000,
    },
    "Mouse_Brain_E15_S1": {
        "index": 4,
        "url": "https://drive.google.com/drive/folders/1rHkTL5OF5qPsEERypRGMS51SjUQ69tdD",
        "type": "Spatial-epigenome-transcriptome",
        "gt_col": "cluster",
        "other_file": "adata_ATAC.h5ad",
        "anno_file": "anno.csv",
        "default_epochs": 350,
        "hvg_genes": 3000,
    },
    "Mouse_Brain_E18_S1": {
        "index": 5,
        "url": "https://drive.google.com/drive/folders/1Xj1LNIAY93biS6JIMKNRODn5GvtCKADB",
        "type": "Spatial-epigenome-transcriptome",
        "gt_col": "cluster",
        "other_file": "adata_ATAC.h5ad",
        "anno_file": "anno.csv",
        "default_epochs": 350,
        "hvg_genes": 3000,
    },
}

DATASET_LIST = list(DATASET_REGISTRY.keys())

DEFAULT_SEEDS = [
    13, 2560, 641, 1892, 1173, 69, 2024, 231, 1971, 2497,
    338, 3127, 2001, 2022, 574, 2428, 999, 1187, 42, 3999
]


# ==============================================================================
# 2. Hardware & Reproducibility Utilities
# ==============================================================================

def set_seed(seed: int = 2024):
    """Set random seed for reproducibility across Python, NumPy, PyTorch, and CUDA."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    cudnn.deterministic = True
    cudnn.benchmark = False
    os.environ['PYTHONHASHSEED'] = str(seed)


def get_compute_device(device_arg: Optional[str] = None) -> torch.device:
    """Detect and configure compute device."""
    if device_arg and str(device_arg).lower() != "auto":
        dev = torch.device(device_arg)
    elif torch.cuda.is_available():
        dev = torch.device('cuda:0')
    elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        dev = torch.device('mps')
    else:
        dev = torch.device('cpu')

    print(f"[Device] Using compute engine: {dev}")
    if dev.type == 'cuda':
        gpu_name = torch.cuda.get_device_name(0)
        vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        print(f"[GPU] Model: {gpu_name} | VRAM: {vram_gb:.2f} GB")
    return dev


# ==============================================================================
# 3. Data Preprocessing & Dual Graph Construction
# ==============================================================================

def clr_normalize_each_cell(adata, inplace=True):
    """Perform CLR (Centered Log-Ratio) normalization on protein (ADT) data per cell."""
    def seurat_clr(x):
        s = np.sum(np.log1p(x[x > 0]))
        exp = np.exp(s / (len(x) if len(x) > 0 else 1))
        return np.log1p(x / (exp if exp > 0 else 1))

    if not inplace:
        adata = adata.copy()

    X_mat = adata.X.toarray() if sp.issparse(adata.X) else np.array(adata.X)
    adata.X = np.apply_along_axis(seurat_clr, 1, X_mat)
    return adata


def pca_reduction(adata, n_comps: int = 60, use_reps: Optional[str] = None):
    """Perform PCA on input AnnData object."""
    pca_model = PCA(n_components=n_comps)
    if use_reps is not None and use_reps in adata.obsm:
        feat_pca = pca_model.fit_transform(adata.obsm[use_reps])
    else:
        X_mat = adata.X.toarray() if sp.issparse(adata.X) else np.array(adata.X)
        feat_pca = pca_model.fit_transform(X_mat)
    return feat_pca


def tfidf_normalize(X):
    """Compute TF-IDF matrix for ATAC count matrix."""
    idf = X.shape[0] / (X.sum(axis=0) + 1e-12)
    if sp.issparse(X):
        tf = X.multiply(1 / (X.sum(axis=1) + 1e-12))
        return sp.csr_matrix(tf.multiply(idf))
    else:
        tf = X / (X.sum(axis=1, keepdims=True) + 1e-12)
        return tf * idf


def preprocess_universal(adata_RNA, adata_omics2, dataset_name: str, hvg_genes: int = 3000):
    """Generic preprocessing pipeline for RNA + ADT/Protein or ATAC."""
    # 1. Preprocess RNA
    sc.pp.filter_genes(adata_RNA, min_cells=10)
    sc.pp.highly_variable_genes(adata_RNA, flavor="seurat_v3", n_top_genes=hvg_genes)
    sc.pp.normalize_total(adata_RNA, target_sum=1e4)
    sc.pp.log1p(adata_RNA)
    sc.pp.scale(adata_RNA)

    RNA_expression = adata_RNA[:, adata_RNA.var['highly_variable']].X
    if sp.issparse(RNA_expression):
        RNA_expression = RNA_expression.toarray()

    # 2. Preprocess Second Modality (ADT or ATAC)
    if dataset_name.startswith("10x"):
        adata_omics2 = adata_omics2[adata_RNA.obs_names].copy()
        adata_omics2 = clr_normalize_each_cell(adata_omics2)
        sc.pp.scale(adata_omics2)
        ADT_expression = adata_omics2.X
    else:
        adata_omics2 = adata_omics2[adata_RNA.obs_names].copy()
        adata_omics2.X = tfidf_normalize(adata_omics2.X)
        sc.pp.normalize_per_cell(adata_omics2, counts_per_cell_after=1e4)
        sc.pp.log1p(adata_omics2)
        n_comps = min(60, adata_omics2.shape[1] - 1)
        adata_omics2.obsm['feat'] = pca_reduction(adata_omics2, n_comps=n_comps)
        ADT_expression = adata_omics2.obsm['feat']

    if sp.issparse(ADT_expression):
        ADT_expression = ADT_expression.toarray()

    return np.asarray(RNA_expression, dtype=np.float32), np.asarray(ADT_expression, dtype=np.float32)


class DualGraphData(Data):
    """Custom PyTorch Geometric Data structure for Dual Graph Learning."""
    def __init__(self, x_RNA, x_ADT, sim_edge_index, sim_edge_weight,
                 dist_edge_index, dist_edge_weight, common_edge_index, common_edge_weight):
        super().__init__()
        self.x_RNA = x_RNA
        self.x_ADT = x_ADT
        self.sim_edge_index = sim_edge_index
        self.sim_edge_weight = sim_edge_weight
        self.dist_edge_index = dist_edge_index
        self.dist_edge_weight = dist_edge_weight
        self.common_edge_index = common_edge_index
        self.common_edge_weight = common_edge_weight


def build_dual_graph(RNA_expression, ADT_expression, cell_positions, device=torch.device('cpu'), num_neighbors: int = 15):
    """
    Build dual graph based on expression cosine similarity and spatial proximity.
    """
    # 1. Similarity Graph (RNA Cosine Distance)
    similarity_matrix = cosine_similarity(RNA_expression)

    nbrs = NearestNeighbors(n_neighbors=num_neighbors + 1, metric='cosine').fit(RNA_expression)
    distances, indices = nbrs.kneighbors(RNA_expression)

    adjacency_matrix = np.zeros_like(similarity_matrix, dtype=int)
    for i in range(len(RNA_expression)):
        for j in indices[i][1:]:
            adjacency_matrix[i, j] = 1
            adjacency_matrix[j, i] = 1

    sim_edge_index = torch.tensor(np.array(np.nonzero(adjacency_matrix)), dtype=torch.long).to(device)
    sim_edge_weight = torch.tensor(similarity_matrix[adjacency_matrix > 0], dtype=torch.float).to(device)

    # 2. Spatial Graph (Euclidean Coordinates)
    knn_graph = kneighbors_graph(cell_positions, n_neighbors=num_neighbors, mode='distance', include_self=False)
    knn_graph = knn_graph.maximum(knn_graph.T)

    dist_edge_index = torch.tensor(knn_graph.nonzero(), dtype=torch.long).to(device)
    dist_edge_weight = torch.tensor(knn_graph.data, dtype=torch.float).to(device)

    # 3. Common Overlapping Graph
    sim_edges = set(zip(sim_edge_index[0].tolist(), sim_edge_index[1].tolist()))
    dist_edges = set(zip(dist_edge_index[0].tolist(), dist_edge_index[1].tolist()))
    common_edges = sim_edges.intersection(dist_edges)

    if len(common_edges) > 0:
        common_edge_index = torch.tensor(list(zip(*common_edges)), dtype=torch.long).to(device)
        common_edge_weight = torch.ones(common_edge_index.shape[1], dtype=torch.float).to(device)
    else:
        # Fallback to similarity edges if no overlap
        common_edge_index = sim_edge_index
        common_edge_weight = sim_edge_weight

    x_RNA = torch.tensor(RNA_expression, dtype=torch.float).to(device)
    x_ADT = torch.tensor(ADT_expression, dtype=torch.float).to(device)

    return DualGraphData(
        x_RNA=x_RNA,
        x_ADT=x_ADT,
        sim_edge_index=sim_edge_index,
        sim_edge_weight=sim_edge_weight,
        dist_edge_index=dist_edge_index,
        dist_edge_weight=dist_edge_weight,
        common_edge_index=common_edge_index,
        common_edge_weight=common_edge_weight
    )


# ==============================================================================
# 4. ARISE Dual GCN Neural Network Model
# ==============================================================================

class DualGCN(nn.Module):
    """
    Dual-stream Graph Convolutional Network for multimodal spatial representation learning.
    """
    def __init__(self, in_channels: int, hidden_channels: int, out_channels: int, q: int, dropout: float = 0.0):
        super(DualGCN, self).__init__()

        # RNA stream: similarity-based and distance-based GCN branches
        self.x_RNA1 = GCNConv(in_channels, hidden_channels)
        self.x_RNA2 = GCNConv(in_channels, hidden_channels)

        # ADT/ATAC stream: initial embedding
        self.protein3 = GCNConv(q, out_channels)

        # Project RNA branches to latent embedding space
        self.sim_conv = GCNConv(hidden_channels, out_channels)
        self.dist_conv = GCNConv(hidden_channels, out_channels)

        # Fusion layers
        self.fusion_layer1 = nn.Sequential(nn.Linear(2 * out_channels, out_channels))
        self.fusion_layer2 = nn.Sequential(nn.Linear(2 * out_channels, out_channels))

        # Decoder layers for multi-target reconstruction
        self.dropout = dropout
        self.deconv1 = nn.Linear(out_channels, hidden_channels)
        self.deconv2 = nn.Linear(hidden_channels, in_channels)
        self.deconv4 = nn.Linear(hidden_channels, q)
        self.deconv5 = nn.Linear(hidden_channels, q + in_channels)

    def forward(self, x_RNA, x_ADT, sim_edge_index, sim_edge_weight,
                dist_edge_index, dist_edge_weight, common_edge_index, common_edge_weight):
        """
        Forward pass for dual GCN.
        Returns:
            x_sim: RNA similarity embedding
            x_dist: RNA spatial distance embedding
            fused: Fused RNA embedding
            fused_pro: Multimodal joint embedding (RNA + ADT/ATAC)
            pro: Second modality embedding
        """
        xs = F.relu(self.x_RNA1(x_RNA, sim_edge_index, sim_edge_weight))
        if self.dropout > 0:
            xs = F.dropout(xs, self.dropout, training=self.training)

        xd = F.relu(self.x_RNA2(x_RNA, dist_edge_index, dist_edge_weight))
        if self.dropout > 0:
            xd = F.dropout(xd, self.dropout, training=self.training)

        x_sim = self.sim_conv(xs, sim_edge_index, sim_edge_weight)
        x_dist = self.dist_conv(xd, dist_edge_index, dist_edge_weight)
        pro = self.protein3(x_ADT, common_edge_index, common_edge_weight)

        # Fusion 1: Concatenate RNA similarity & spatial representations
        combined_rna = torch.cat([x_sim, x_dist], dim=1)
        fused = self.fusion_layer1(combined_rna)

        # Fusion 2: Concatenate Fused RNA with Second Modality representation
        combined_protein = torch.cat([fused, pro], dim=1)
        fused_pro = self.fusion_layer2(combined_protein)

        return x_sim, x_dist, fused, fused_pro, pro

    def reconstruct(self, z):
        """RNA feature reconstruction from latent embedding."""
        x_recon = F.relu(self.deconv1(z))
        return self.deconv2(x_recon)

    def reconstruct2(self, z):
        """ADT/ATAC feature reconstruction from latent embedding."""
        x_recon = F.relu(self.deconv1(z))
        return self.deconv4(x_recon)

    def reconstruct3(self, z):
        """Joint Multimodal reconstruction (RNA + ADT/ATAC) from joint embedding."""
        x_recon = F.relu(self.deconv1(z))
        return self.deconv5(x_recon)


class Dual(nn.Module):
    """
    ARISE Model Container with Multi-Loss Optimization.
    """
    def __init__(self, in_channels: int, hidden_channels: int, out_channels: int, q: int, num_clusters: int,
                 beta: float = 25.0, gamma: float = 10.0, delta: float = 1.0, dropout: float = 0.0,
                 l1_lambda: float = 1e-4, l2_lambda: float = 1e-3):
        super(Dual, self).__init__()
        self.gcn = DualGCN(in_channels, hidden_channels, out_channels, q, dropout=dropout)
        self.cluster_layer = nn.Parameter(torch.Tensor(num_clusters, out_channels))
        self.num_clusters = num_clusters
        self.beta = beta
        self.gamma = gamma
        self.delta = delta
        self.l1_lambda = l1_lambda
        self.l2_lambda = l2_lambda
        self.init_weights()

    def init_weights(self):
        nn.init.xavier_uniform_(self.cluster_layer.data)

    def forward(self, x_RNA, x_ADT, sim_edge_index, sim_edge_weight,
                dist_edge_index, dist_edge_weight, common_edge_index, common_edge_weight):
        return self.gcn(x_RNA, x_ADT, sim_edge_index, sim_edge_weight,
                        dist_edge_index, dist_edge_weight, common_edge_index, common_edge_weight)

    def compute_regularization_loss(self):
        """L1 and L2 parameter regularization."""
        l1_loss = sum(torch.sum(torch.abs(p)) for p in self.parameters())
        l2_loss = sum(torch.sum(p ** 2) for p in self.parameters())
        return self.l1_lambda * l1_loss + self.l2_lambda * l2_loss

    def cosine_similarity_matrix(self, emb):
        """Compute pairwise cosine similarity matrix on embeddings."""
        norm = torch.norm(emb, p=2, dim=1, keepdim=True) + 1e-8
        emb_norm = emb / norm
        mat = torch.matmul(emb_norm, emb_norm.T)
        mat = mat - torch.diag_embed(torch.diag(mat))
        return mat

    def spatial_regularization_loss(self, emb, dist_edge_index, dist_edge_weight):
        """Spatial regularization to encourage local smoothness and contrastive neighbor separation."""
        num_nodes = emb.size(0)
        # Create sparse-to-dense adjacency matrix
        indices = dist_edge_index
        values = torch.ones(dist_edge_index.size(1), device=emb.device)
        graph_nei = torch.sparse_coo_tensor(indices, values, size=(num_nodes, num_nodes)).to_dense()
        graph_neg = 1.0 - graph_nei

        sim_mat = torch.sigmoid(self.cosine_similarity_matrix(emb))

        neigh_loss = torch.mul(graph_nei, torch.log(sim_mat + 1e-10)).mean()
        neg_loss = torch.mul(graph_neg, torch.log(1.0 - sim_mat + 1e-10)).mean()

        return -(neigh_loss + neg_loss) / 2.0

    def compute_losses(self, x_RNA, x_ADT, sim_z, dist_z, fused_z, fused_pro, combined_raw, pro, dist_edge_index, dist_edge_weight):
        """
        Compute total multimodal loss decomposition.
        """
        l_rec = F.mse_loss(combined_raw, self.gcn.reconstruct3(fused_pro))
        l_sim = F.mse_loss(x_RNA, self.gcn.reconstruct(sim_z))
        l_dist = F.mse_loss(x_RNA, self.gcn.reconstruct(dist_z))
        l_adt = F.mse_loss(x_ADT, self.gcn.reconstruct2(pro))

        recon_total = l_rec + l_sim + l_dist + l_adt

        l_spatial = self.spatial_regularization_loss(fused_z, dist_edge_index, dist_edge_weight)
        reg_loss = self.compute_regularization_loss()

        total_loss = self.beta * recon_total + self.gamma * l_spatial + self.delta * reg_loss

        return total_loss, recon_total, l_spatial, reg_loss


# ==============================================================================
# 5. Clustering Engine (mclust & KMeans)
# ==============================================================================

def mclust_clustering(features: np.ndarray, num_clusters: int, seed: int = 42) -> np.ndarray:
    """Run mclust clustering via rpy2 if available, with automatic KMeans fallback."""
    try:
        import rpy2.robjects as robjects
        from rpy2.robjects.packages import importr
        import rpy2.robjects.numpy2ri

        rpy2.robjects.numpy2ri.activate()
        r_stats = importr('stats')
        r_mclust = importr('mclust')

        robjects.r(f'set.seed({seed})')
        res = r_mclust.Mclust(features, G=num_clusters, modelNames='EEE', verbose=False)
        labels = np.array(res.rx2('classification'), dtype=int) - 1
        rpy2.robjects.numpy2ri.deactivate()
        return labels
    except Exception:
        # Robust fallback to KMeans if R or mclust is missing
        km = KMeans(n_clusters=num_clusters, n_init=10, random_state=seed)
        return km.fit_predict(features)


def perform_clustering(embeddings: np.ndarray, num_clusters: int, tool: str = 'mclust', seed: int = 42) -> np.ndarray:
    """Cluster embeddings using specified algorithm."""
    if tool.lower() == 'kmeans':
        km = KMeans(n_clusters=num_clusters, n_init=10, random_state=seed)
        return km.fit_predict(embeddings)
    return mclust_clustering(embeddings, num_clusters, seed=seed)


def evaluate_clustering_metrics(y_true, y_pred, embeddings: np.ndarray) -> Dict[str, float]:
    """Compute comprehensive clustering benchmark metrics."""
    # Convert true labels to numeric or string representations
    le = LabelEncoder()
    y_true_enc = le.fit_transform(np.asarray(y_true).astype(str))
    y_pred_arr = np.asarray(y_pred)

    ari = float(adjusted_rand_score(y_true_enc, y_pred_arr))
    nmi = float(normalized_mutual_info_score(y_true_enc, y_pred_arr))
    ami = float(adjusted_mutual_info_score(y_true_enc, y_pred_arr))
    homo = float(homogeneity_score(y_true_enc, y_pred_arr))
    v_meas = float(v_measure_score(y_true_enc, y_pred_arr))
    fmi = float(fowlkes_mallows_score(y_true_enc, y_pred_arr))

    # Unsupervised geometry metrics
    try:
        sil = float(silhouette_score(embeddings, y_pred_arr))
    except Exception:
        sil = 0.0

    try:
        chi = float(calinski_harabasz_score(embeddings, y_pred_arr))
    except Exception:
        chi = 0.0

    try:
        dbi = float(davies_bouldin_score(embeddings, y_pred_arr))
    except Exception:
        dbi = 0.0

    return {
        "ARI": ari,
        "NMI": nmi,
        "AMI": ami,
        "Silhouette": sil,
        "Homogeneity": homo,
        "V-measure": v_meas,
        "FMI": fmi,
        "CHI": chi,
        "DBI": dbi,
    }


# ==============================================================================
# 6. Model Training Loop & Trajectory Tracking
# ==============================================================================

def train_arise_model(
    model: Dual,
    data: DualGraphData,
    y_true,
    epochs: int = 350,
    lr: float = 1e-3,
    tool: str = 'mclust',
    seed: int = 42,
    verbose: bool = True
) -> Tuple[Dual, np.ndarray, np.ndarray, Dict[str, Any]]:
    """
    Train ARISE model with per-epoch trajectory tracking and checkpoint selection.
    """
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    combined_raw = torch.cat([data.x_RNA, data.x_ADT], dim=1)

    loss_history = []
    recon_history = []
    spatial_loss_history = []
    reg_loss_history = []
    epoch_sil_history = []
    epoch_ari_history = []
    epoch_nmi_history = []

    best_sil = -1.0
    best_embeddings = None
    best_labels = None
    best_epoch = 0

    start_time = time.time()

    for epoch in range(epochs):
        model.train()
        optimizer.zero_grad()

        sim_z, dist_z, fused_z, fused_pro, pro = model(
            data.x_RNA, data.x_ADT,
            data.sim_edge_index, data.sim_edge_weight,
            data.dist_edge_index, data.dist_edge_weight,
            data.common_edge_index, data.common_edge_weight
        )

        total_loss, recon_loss, spatial_loss, reg_loss = model.compute_losses(
            data.x_RNA, data.x_ADT,
            sim_z, dist_z, fused_z, fused_pro, combined_raw, pro,
            data.dist_edge_index, data.dist_edge_weight
        )

        total_loss.backward()
        optimizer.step()

        # Log losses
        loss_val = float(total_loss.item())
        recon_val = float(recon_loss.item())
        spatial_val = float(spatial_loss.item())
        reg_val = float(reg_loss.item())

        loss_history.append(loss_val)
        recon_history.append(recon_val)
        spatial_loss_history.append(spatial_val)
        reg_loss_history.append(reg_val)

        # Per-epoch evaluation on fused embeddings
        model.eval()
        with torch.no_grad():
            _, _, _, fused_pro_eval, _ = model(
                data.x_RNA, data.x_ADT,
                data.sim_edge_index, data.sim_edge_weight,
                data.dist_edge_index, data.dist_edge_weight,
                data.common_edge_index, data.common_edge_weight
            )
            embeddings_np = fused_pro_eval.cpu().numpy()

        # Fast clustering for progress tracking
        epoch_labels = perform_clustering(embeddings_np, model.num_clusters, tool=tool, seed=seed)

        try:
            cur_sil = float(silhouette_score(embeddings_np, epoch_labels))
        except Exception:
            cur_sil = 0.0

        cur_metrics = evaluate_clustering_metrics(y_true, epoch_labels, embeddings_np)
        cur_ari = cur_metrics["ARI"]
        cur_nmi = cur_metrics["NMI"]

        epoch_sil_history.append(cur_sil)
        epoch_ari_history.append(cur_ari)
        epoch_nmi_history.append(cur_nmi)

        if cur_sil > best_sil:
            best_sil = cur_sil
            best_epoch = epoch + 1
            best_embeddings = embeddings_np.copy()
            best_labels = epoch_labels.copy()

        if verbose and ((epoch + 1) % 50 == 0 or epoch == 0 or epoch == epochs - 1):
            print(f"   Epoch [{epoch+1:3d}/{epochs:3d}] | Loss: {loss_val:.4f} (Recon: {recon_val:.4f}) | Sil: {cur_sil:.4f} | ARI: {cur_ari:.4f}")

    duration = time.time() - start_time

    if best_embeddings is None:
        best_embeddings = embeddings_np
        best_labels = epoch_labels
        best_epoch = epochs

    training_results = {
        "loss_history": loss_history,
        "recon_loss_history": recon_history,
        "spatial_loss_history": spatial_loss_history,
        "reg_loss_history": reg_loss_history,
        "epoch_sil_history": epoch_sil_history,
        "epoch_ari_history": epoch_ari_history,
        "epoch_nmi_history": epoch_nmi_history,
        "best_epoch": best_epoch,
        "best_sil": best_sil,
        "duration_seconds": duration,
    }

    return model, best_embeddings, best_labels, training_results


# ==============================================================================
# 7. Dashboard JSON & REST API Export
# ==============================================================================

def make_json_serializable(obj):
    """Recursively converts NumPy types, tensors, and arrays into native JSON-serializable Python types."""
    if obj is None:
        return None
    if isinstance(obj, np.ndarray):
        return [make_json_serializable(x) for x in obj.tolist()]
    if isinstance(obj, (np.floating, np.float32, np.float64, np.float16)):
        return float(obj)
    if isinstance(obj, (np.integer, np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    if isinstance(obj, dict):
        return {str(k): make_json_serializable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [make_json_serializable(item) for item in obj]
    return obj


def export_dashboard_experiment(
    model_id: str,
    model_name: str,
    dataset_name: str,
    seed: int,
    metrics_dict: dict,
    training_results: dict,
    hyperparameters: dict,
    embeddings_data: Optional[dict] = None,
    output_dir: str = "results",
    api_url: Optional[str] = "https://model-performance.vercel.app/api/experiments/upload"
):
    """Export standardized JSON artifacts and send directly to Dashboard via API."""
    exp_dir = os.path.join(output_dir, "experiments", model_id, dataset_name, f"seed_{seed}")
    os.makedirs(exp_dir, exist_ok=True)

    # 1. Format Curves History
    loss_hist = training_results.get("loss_history", [])
    recon_hist = training_results.get("recon_loss_history", [])
    spatial_hist = training_results.get("spatial_loss_history", [])
    reg_hist = training_results.get("reg_loss_history", [])
    sil_hist = training_results.get("epoch_sil_history", [])
    ari_hist = training_results.get("epoch_ari_history", [])
    nmi_hist = training_results.get("epoch_nmi_history", [])

    history_points = []
    for ep in range(len(loss_hist)):
        history_points.append({
            "epoch": ep + 1,
            "losses": {
                "total_loss": float(loss_hist[ep]) if ep < len(loss_hist) else 0.0,
                "reconstruction_loss": float(recon_hist[ep]) if ep < len(recon_hist) else 0.0,
                "spatial_loss": float(spatial_hist[ep]) if ep < len(spatial_hist) else 0.0,
                "reg_loss": float(reg_hist[ep]) if ep < len(reg_hist) else 0.0,
            },
            "metrics": {
                "Silhouette": float(sil_hist[ep]) if ep < len(sil_hist) else 0.0,
                "ARI": float(ari_hist[ep]) if ep < len(ari_hist) else 0.0,
                "NMI": float(nmi_hist[ep]) if ep < len(nmi_hist) else 0.0,
            },
            "total_loss": float(loss_hist[ep]) if ep < len(loss_hist) else None,
            "silhouette": float(sil_hist[ep]) if ep < len(sil_hist) else None,
            "ari": float(ari_hist[ep]) if ep < len(ari_hist) else None,
        })

    safe_metrics = make_json_serializable(metrics_dict)
    safe_hyperparameters = make_json_serializable(hyperparameters)
    safe_history = make_json_serializable(history_points)
    safe_embeddings = make_json_serializable(embeddings_data or {})

    best_epoch = int(training_results.get("best_epoch", len(loss_hist)))
    best_score = float(training_results.get("best_sil", metrics_dict.get("Silhouette", 0.0)))
    duration = float(training_results.get("duration_seconds", 0.0))

    # 2. Local JSON Files Save
    with open(os.path.join(exp_dir, "metrics.json"), "w") as f:
        json.dump({
            "model_id": model_id,
            "dataset": dataset_name,
            "seed": int(seed),
            "final_epoch": len(loss_hist),
            "best_epoch": best_epoch,
            "best_score": best_score,
            "durationSeconds": duration,
            "metrics": safe_metrics
        }, f, indent=2)

    with open(os.path.join(exp_dir, "curves.json"), "w") as f:
        json.dump({"history": safe_history}, f, indent=2)

    with open(os.path.join(exp_dir, "metadata.json"), "w") as f:
        json.dump({
            "model_name": model_name,
            "dataset": dataset_name,
            "seed": int(seed),
            "hyperparameters": safe_hyperparameters
        }, f, indent=2)

    print(f"📦 Standardized Dashboard JSONs saved to: {exp_dir}")

    # 3. Direct API Call to Next.js / MongoDB Dashboard
    if api_url:
        try:
            payload = {
                "modelId": model_id,
                "modelName": model_name,
                "datasetId": dataset_name,
                "datasetName": dataset_name.replace("_", " ").title(),
                "seed": int(seed),
                "bestEpoch": best_epoch,
                "bestScore": best_score,
                "durationSeconds": duration,
                "finalMetrics": safe_metrics,
                "history": safe_history,
                "embeddingsData": safe_embeddings,
                "modelMetadata": {
                    "architecture": "Spatially-Regularized Dual Multimodal Graph Autoencoder (ARISE)",
                    "hyperparameters": safe_hyperparameters,
                    "colorTheme": {
                        "baseColor": "hsl(343, 90%, 60%)",
                        "glowColor": "hsla(343, 90%, 60%, 0.2)",
                        "bgSoft": "hsla(343, 90%, 60%, 0.1)",
                        "borderClass": "border-rose-500/40",
                        "badgeClass": "bg-rose-500/10 text-rose-400 border-rose-500/20",
                        "textClass": "text-rose-400",
                    }
                }
            }

            req = urllib.request.Request(
                api_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    print(f"🚀 Successfully pushed experiment results to Dashboard API ({api_url})!")
        except Exception as e:
            print(f"ℹ️ Direct API push skipped (dashboard server offline or unreachable: {e}). Data is safely stored in JSON files.")


# ==============================================================================
# 8. Dataset Resolver & Auto-Downloader
# ==============================================================================

def resolve_dataset_files(dataset_name: str, folder_url: str, data_dir: str = "data"):
    """Find local dataset files or automatically download using gdown."""
    candidate_dirs = [
        os.path.join(data_dir, dataset_name),
        f"data/{dataset_name}",
        f"/content/data/{dataset_name}",
        f"/content/drive/MyDrive/Colab/data/{dataset_name}",
    ]
    base_dir = None
    for c_dir in candidate_dirs:
        if os.path.exists(c_dir):
            base_dir = c_dir
            break

    if base_dir is None:
        base_dir = os.path.join(data_dir, dataset_name)
        os.makedirs(base_dir, exist_ok=True)
        print(f"Downloading dataset {dataset_name} using gdown...")
        gdown_cmd = ".venv/bin/gdown" if os.path.exists(".venv/bin/gdown") else "gdown"
        os.system(f'{gdown_cmd} --folder "{folder_url}" --output "{base_dir}"')

    return base_dir


# ==============================================================================
# 9. Main Pipeline Execution Runner
# ==============================================================================

def run_experiment(
    datasets: Union[str, int, List[Union[str, int]]] = "all",
    seeds: Optional[List[int]] = None,
    n_seeds: Optional[int] = None,
    epochs: Optional[int] = None,
    lr: float = 1e-3,
    hidden_dim: int = 512,
    out_dim: int = 64,
    beta: float = 25.0,
    gamma: float = 10.0,
    delta: float = 1.0,
    dropout: float = 0.0,
    tool: str = 'mclust',
    device: Optional[str] = None,
    visualize: bool = True,
    show_plots: bool = False,
    output_dir: str = "results",
    data_dir: str = "data",
    api_url: Optional[str] = "https://model-performance.vercel.app/api/experiments/upload"
):
    """
    Main execution pipeline for ARISE benchmarking across multi-omics datasets and random seeds.
    """
    dev = get_compute_device(device)
    os.makedirs(output_dir, exist_ok=True)

    if seeds is None or seeds == "all" or (isinstance(seeds, (list, tuple)) and len(seeds) > 0 and str(seeds[0]).lower() == "all"):
        run_seeds = DEFAULT_SEEDS
    else:
        run_seeds = [int(s) for s in seeds if isinstance(s, int) or (isinstance(s, str) and s.isdigit())]

    if n_seeds is not None and n_seeds > 0:
        run_seeds = run_seeds[:n_seeds]

    if datasets == "all" or (isinstance(datasets, (list, tuple)) and datasets and datasets[0] == "all"):
        dataset_names = [c[0] for c in CHOICES]
    else:
        dataset_names = []
        for d in (datasets if isinstance(datasets, (list, tuple)) else [datasets]):
            if isinstance(d, int) or (isinstance(d, str) and d.isdigit()):
                idx = int(d)
                if 0 <= idx < len(CHOICES):
                    dataset_names.append(CHOICES[idx][0])
            else:
                dataset_names.append(str(d))

    print("\n" + "="*80)
    print(" 🚀 STARTING ARISE MULTI-OMICS EXPERIMENT ".center(80, "="))
    print("="*80)
    print(f" • Datasets     : {dataset_names}")
    print(f" • Seeds ({len(run_seeds):2d})   : {run_seeds}")
    print(f" • Clustering   : {tool}")
    print(f" • Latent Dim   : {out_dim} | Hidden Dim: {hidden_dim} | LR: {lr}")
    print(f" • Weights      : Beta(Recon)={beta} | Gamma(Spatial)={gamma} | Delta(Reg)={delta}")
    print(f" • Device       : {dev}")
    print("="*80 + "\n")

    all_dataset_records = []

    for d_name in dataset_names:
        if d_name not in DATASET_REGISTRY:
            print(f"⚠️ Warning: Dataset '{d_name}' not found in registry. Skipping.")
            continue

        d_meta = DATASET_REGISTRY[d_name]
        print("\n" + "#"*80)
        print(f" DATASET: {d_name} ".center(80, "#"))
        print("#"*80)

        base_dir = resolve_dataset_files(d_name, d_meta["url"], data_dir=data_dir)
        rna_path = os.path.join(base_dir, "adata_RNA.h5ad")
        other_path = os.path.join(base_dir, d_meta["other_file"])
        anno_path = os.path.join(base_dir, d_meta["anno_file"])

        if not os.path.exists(rna_path) or not os.path.exists(other_path):
            print(f"❌ Error: Required files for {d_name} not found in {base_dir}. Skipping.")
            continue

        # Load AnnData
        adata_omics1 = sc.read_h5ad(rna_path)
        adata_omics2 = sc.read_h5ad(other_path)
        adata_omics1.var_names_make_unique()
        adata_omics2.var_names_make_unique()

        # Load Ground Truth
        anno_df = pd.read_csv(anno_path, index_col=0)
        gt_col = d_meta["gt_col"]
        adata_omics1.obs['ground_truth'] = anno_df[gt_col]
        adata_omics2.obs['ground_truth'] = anno_df[gt_col]

        y_true_labels = adata_omics1.obs['ground_truth']
        num_classes = len(y_true_labels.unique())
        print(f"📊 Dataset Info: {adata_omics1.n_obs} spots | {num_classes} Ground Truth Classes")

        # Preprocess features
        RNA_data, ADT_data = preprocess_universal(
            adata_omics1, adata_omics2, d_name, hvg_genes=d_meta.get("hvg_genes", 3000)
        )

        cell_positions = adata_omics1.obsm['spatial']
        graph_data = build_dual_graph(RNA_data, ADT_data, cell_positions, device=dev, num_neighbors=15)

        cur_epochs = epochs if epochs is not None else d_meta.get("default_epochs", 350)
        dataset_seed_records = []

        for seed in run_seeds:
            print(f"\n--- [ARISE] Dataset: {d_name} | Seed: {seed} ---")
            set_seed(seed)

            # Initialize Model
            model = Dual(
                in_channels=RNA_data.shape[1],
                hidden_channels=hidden_dim,
                out_channels=out_dim,
                q=ADT_data.shape[1],
                num_clusters=num_classes,
                beta=beta,
                gamma=gamma,
                delta=delta,
                dropout=dropout
            ).to(dev)

            # Train Model
            model, final_embeddings, final_labels, training_results = train_arise_model(
                model=model,
                data=graph_data,
                y_true=y_true_labels,
                epochs=cur_epochs,
                lr=lr,
                tool=tool,
                seed=seed,
                verbose=True
            )

            # Final Metric Evaluation
            final_metrics = evaluate_clustering_metrics(y_true_labels, final_labels, final_embeddings)

            print(f"✨ Seed {seed} Results: ARI={final_metrics['ARI']:.4f} | Sil={final_metrics['Silhouette']:.4f} | NMI={final_metrics['NMI']:.4f} (Best Epoch: {training_results['best_epoch']})")

            # UMAP & Spatial Embeddings Extraction
            adata_eval = adata_omics1.copy()
            adata_eval.obsm['X_arise'] = final_embeddings
            adata_eval.obs['predicted_cluster'] = final_labels.astype(str)

            sc.pp.neighbors(adata_eval, use_rep='X_arise', n_neighbors=15)
            sc.tl.umap(adata_eval)
            umap_coords = adata_eval.obsm['X_umap'].tolist()

            try:
                sample_sil = silhouette_samples(final_embeddings, final_labels).tolist()
            except Exception:
                sample_sil = [0.0] * len(final_labels)

            embeddings_payload = {
                "umapCoordinates": umap_coords,
                "spatialCoordinates": cell_positions.tolist() if isinstance(cell_positions, np.ndarray) else cell_positions,
                "predictedLabels": final_labels.tolist() if isinstance(final_labels, np.ndarray) else list(final_labels),
                "groundTruthLabels": y_true_labels.astype(str).tolist(),
                "sampleSilhouettes": sample_sil,
            }

            hyperparams = {
                "hidden_dim": hidden_dim,
                "out_dim": out_dim,
                "epochs": cur_epochs,
                "lr": lr,
                "beta": beta,
                "gamma": gamma,
                "delta": delta,
                "dropout": dropout,
                "tool": tool,
            }

            # Export to Dashboard and Local JSONs
            export_dashboard_experiment(
                model_id="Arise",
                model_name="ARISE",
                dataset_name=d_name,
                seed=seed,
                metrics_dict=final_metrics,
                training_results=training_results,
                hyperparameters=hyperparams,
                embeddings_data=embeddings_payload,
                output_dir=output_dir,
                api_url=api_url
            )

            # Save Visualizations
            if visualize:
                plot_dir = os.path.join(output_dir, "plots", "Arise", d_name)
                os.makedirs(plot_dir, exist_ok=True)
                fig, axes = plt.subplots(1, 3, figsize=(13, 3.8))

                # 1. Ground Truth
                sc.pl.embedding(adata_eval, basis='spatial', color='ground_truth', ax=axes[0], show=False, title=f"{d_name} Ground Truth", s=25)
                # 2. Predicted Domains
                sc.pl.embedding(adata_eval, basis='spatial', color='predicted_cluster', ax=axes[1], show=False, title=f"ARISE (ARI: {final_metrics['ARI']:.3f})", s=25)
                # 3. UMAP
                sc.pl.umap(adata_eval, color='predicted_cluster', ax=axes[2], show=False, title=f"ARISE Latent UMAP (Sil: {final_metrics['Silhouette']:.3f})", s=25)

                plt.tight_layout()
                plt.savefig(os.path.join(plot_dir, f"umap_seed_{seed}.png"), dpi=150)
                if show_plots:
                    plt.show()
                plt.close(fig)

            record = {
                "dataset": d_name,
                "seed": seed,
                "best_epoch": training_results["best_epoch"],
                "duration_sec": training_results["duration_seconds"],
                **final_metrics
            }
            dataset_seed_records.append(record)
            all_dataset_records.append(record)

        # Dataset Summary Table
        if dataset_seed_records:
            df_ds = pd.DataFrame(dataset_seed_records)
            ds_res_dir = os.path.join(output_dir, "Arise", d_name)
            os.makedirs(ds_res_dir, exist_ok=True)
            df_ds.to_csv(os.path.join(ds_res_dir, f"metrics_{d_name}.csv"), index=False)

            print("\n" + "="*80)
            print(f" DATASET SUMMARY: {d_name} (ARISE) ".center(80, "="))
            print("="*80)
            print(df_ds[['seed', 'best_epoch', 'ARI', 'Silhouette', 'NMI', 'AMI', 'Homogeneity', 'V-measure']].to_string(index=False))
            print("-" * 80)
            mean_ari = df_ds['ARI'].mean()
            std_ari = df_ds['ARI'].std()
            mean_sil = df_ds['Silhouette'].mean()
            std_sil = df_ds['Silhouette'].std()
            print(f"⭐️ Mean ARI: {mean_ari:.4f} ± {std_ari:.4f} | Mean Silhouette: {mean_sil:.4f} ± {std_sil:.4f}")
            print("="*80 + "\n")

    # Global Benchmark Summary
    if all_dataset_records:
        df_all = pd.DataFrame(all_dataset_records)
        df_all.to_csv(os.path.join(output_dir, "arise_benchmark_summary.csv"), index=False)
        print("\n" + "="*80)
        print(" 🏆 GLOBAL BENCHMARK SUMMARY (ARISE) ".center(80, "="))
        print("="*80)
        summary_table = df_all.groupby('dataset')[['ARI', 'Silhouette', 'NMI', 'AMI', 'Homogeneity', 'V-measure']].agg(['mean', 'std'])
        print(summary_table)
        print("="*80)


# ==============================================================================
# 10. Command-Line Entry Point
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Run ARISE Spatially-Regularized Graph Neural Network for Spatial Multi-Omics Clustering."
    )
    parser.add_argument(
        "--datasets", nargs="+", default=["all"],
        help="Datasets to evaluate: 'all', integer index (0-5), or dataset names."
    )
    parser.add_argument(
        "--seeds", nargs="+", default=["all"],
        help="Seeds to run: 'all', specific numbers like 42 2024, or list of integers."
    )
    parser.add_argument("--n_seeds", type=int, default=None, help="Limit number of seeds to execute.")
    parser.add_argument("--epochs", type=int, default=None, help="Number of training epochs (default: 350).")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate (default: 1e-3).")
    parser.add_argument("--hidden_dim", type=int, default=512, help="Hidden dimension for GCN (default: 512).")
    parser.add_argument("--out_dim", type=int, default=64, help="Output embedding dimension (default: 64).")
    parser.add_argument("--beta", type=float, default=25.0, help="Reconstruction loss weight (default: 25.0).")
    parser.add_argument("--gamma", type=float, default=10.0, help="Spatial regularization weight (default: 10.0).")
    parser.add_argument("--delta", type=float, default=1.0, help="L1/L2 parameter regularization weight (default: 1.0).")
    parser.add_argument("--dropout", type=float, default=0.0, help="GCN Dropout rate (default: 0.0).")
    parser.add_argument("--tool", type=str, default="mclust", choices=["mclust", "kmeans"], help="Clustering tool.")
    parser.add_argument("--device", type=str, default=None, help="Compute device: 'cuda', 'cuda:0', 'cpu', 'mps'.")
    parser.add_argument("--visualize", action="store_true", default=True, help="Save spatial & UMAP comparison plots.")
    parser.add_argument("--show_plots", action="store_true", default=False, help="Display plots interactively.")
    parser.add_argument("--output_dir", type=str, default="results", help="Directory to save artifacts.")
    parser.add_argument("--data_dir", type=str, default="data", help="Directory where data is located/downloaded.")
    parser.add_argument(
        "--api_url", type=str, default="https://model-performance.vercel.app/api/experiments/upload",
        help="Next.js / MongoDB upload endpoint."
    )

    args = parser.parse_args()

    # Resolve datasets
    if len(args.datasets) == 1 and args.datasets[0].lower() == "all":
        selected_datasets = "all"
    else:
        selected_datasets = args.datasets

    # Resolve seeds
    if len(args.seeds) == 1 and str(args.seeds[0]).lower() == "all":
        selected_seeds = "all"
    else:
        selected_seeds = [int(s) for s in args.seeds if str(s).isdigit()]

    run_experiment(
        datasets=selected_datasets,
        seeds=selected_seeds,
        n_seeds=args.n_seeds,
        epochs=args.epochs,
        lr=args.lr,
        hidden_dim=args.hidden_dim,
        out_dim=args.out_dim,
        beta=args.beta,
        gamma=args.gamma,
        delta=args.delta,
        dropout=args.dropout,
        tool=args.tool,
        device=args.device,
        visualize=args.visualize,
        show_plots=args.show_plots,
        output_dir=args.output_dir,
        data_dir=args.data_dir,
        api_url=args.api_url,
    )


if __name__ == "__main__":
    main()
