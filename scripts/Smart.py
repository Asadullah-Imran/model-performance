#!/usr/bin/env python3
"""
================================================================================
🧠 SMART: Spatial Multi-Modal Graph Neural Network with Mutual Nearest Neighbors
================================================================================
Deep Learning Spatial Multi-Omics Clustering Pipeline based on SMART:
  • Multi-modal Graph Autoencoder with SAGEConv / GCN / GAT encoders & decoders
  • Cross-modality Mutual Nearest Neighbors (MNN) triplet loss representation learning
  • Self-supervised reconstruction + optional spatial Laplacian smoothness regularization
  • Comprehensive Evaluation: ARI, NMI, AMI, Silhouette, Homogeneity, V-measure, FMI, CHI, DBI
  • Multi-loss trajectory tracking: Total Loss, Recon Loss, Triplet Loss, Silhouette, and ARI
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
from scipy import stats

import sklearn
from sklearn.metrics.pairwise import pairwise_distances
from sklearn.neighbors import NearestNeighbors, kneighbors_graph, radius_neighbors_graph
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.mixture import GaussianMixture
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
from torch.nn import Parameter
from torch.backends import cudnn
from torch_geometric.nn import SAGEConv, GCNConv, GATConv, GraphConv

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
        "default_epochs": 300,
        "rna_pca_comps": 30,
        "aux_pca_comps": 30,
    },
    "10x_human_lymph_node_D1": {
        "index": 1,
        "url": "https://drive.google.com/drive/folders/1-g_Ca2XMaMXF-MisuVY-wobWDX86O6zz",
        "type": "10x",
        "gt_col": "manual-anno",
        "other_file": "adata_ADT.h5ad",
        "anno_file": "annotation.csv",
        "default_epochs": 300,
        "rna_pca_comps": 30,
        "aux_pca_comps": 30,
    },
    "Mouse_Brain_E11_S1": {
        "index": 2,
        "url": "https://drive.google.com/drive/folders/1zRwDJrYnks0LRzlAVRqPU7jE_OcStgPo",
        "type": "Spatial-epigenome-transcriptome",
        "gt_col": "cluster",
        "other_file": "adata_ATAC.h5ad",
        "anno_file": "anno.csv",
        "default_epochs": 300,
        "rna_pca_comps": 30,
        "aux_pca_comps": 60,
    },
    "Mouse_Brain_E13_S1": {
        "index": 3,
        "url": "https://drive.google.com/drive/folders/1GOufwIRjjfcd9Bi2GKtebzKoPCg2jVud",
        "type": "Spatial-epigenome-transcriptome",
        "gt_col": "cluster",
        "other_file": "adata_ATAC.h5ad",
        "anno_file": "anno.csv",
        "default_epochs": 300,
        "rna_pca_comps": 30,
        "aux_pca_comps": 60,
    },
    "Mouse_Brain_E15_S1": {
        "index": 4,
        "url": "https://drive.google.com/drive/folders/1rHkTL5OF5qPsEERypRGMS51SjUQ69tdD",
        "type": "Spatial-epigenome-transcriptome",
        "gt_col": "cluster",
        "other_file": "adata_ATAC.h5ad",
        "anno_file": "anno.csv",
        "default_epochs": 300,
        "rna_pca_comps": 30,
        "aux_pca_comps": 60,
    },
    "Mouse_Brain_E18_S1": {
        "index": 5,
        "url": "https://drive.google.com/drive/folders/1Xj1LNIAY93biS6JIMKNRODn5GvtCKADB",
        "type": "Spatial-epigenome-transcriptome",
        "gt_col": "cluster",
        "other_file": "adata_ATAC.h5ad",
        "anno_file": "anno.csv",
        "default_epochs": 300,
        "rna_pca_comps": 30,
        "aux_pca_comps": 60,
    },
}

DATASET_LIST = list(DATASET_REGISTRY.keys())

DEFAULT_SEEDS = [
    13, 2560, 641, 1892, 1173, 69, 2024, 231, 1971, 2497,
    338, 3127, 2001, 2022, 574, 2428, 999, 1187, 42, 3999
]


# ==============================================================================
# 2. Reproducibility & Device Configuration
# ==============================================================================

def set_seed(seed: int = 2024):
    """Set random seed across Python, NumPy, PyTorch, and CUDA for deterministic runs."""
    os.environ['PYTHONHASHSEED'] = str(seed)
    os.environ['CUBLAS_WORKSPACE_CONFIG'] = ':4096:8'
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
        cudnn.deterministic = True
        cudnn.benchmark = False


def get_compute_device(requested_device: Optional[str] = None) -> torch.device:
    if requested_device:
        return torch.device(requested_device)
    dev = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
    print(f"[Device] Using compute engine: {dev}")
    if torch.cuda.is_available():
        print(f"[GPU] Model: {torch.cuda.get_device_name(0)} | VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
    return dev


# ==============================================================================
# 3. Preprocessing Functions
# ==============================================================================

def clr_normalize_each_cell(adata, inplace=True):
    """Normalize count vector for each cell using Centered Log-Ratio (CLR)."""
    def seurat_clr(x):
        s = np.sum(np.log1p(x[x > 0]))
        exp = np.exp(s / len(x)) if len(x) > 0 else 1.0
        return np.log1p(x / (exp + 1e-12))

    if not inplace:
        adata = adata.copy()

    X = adata.X.toarray() if sp.issparse(adata.X) else np.array(adata.X)
    adata.X = np.apply_along_axis(seurat_clr, 1, X)
    return adata


def pca(adata, use_reps=None, n_comps=10):
    """Dimensionality reduction using PCA algorithm."""
    from sklearn.decomposition import PCA
    pca_model = PCA(n_components=n_comps)
    if use_reps is not None:
        feat_pca = pca_model.fit_transform(adata.obsm[use_reps])
    else:
        feat_pca = pca_model.fit_transform(adata.X.toarray() if sp.issparse(adata.X) else adata.X)
    return feat_pca


def tfidf(X):
    """TF-IDF normalization following standard Seurat approach."""
    idf = X.shape[0] / (X.sum(axis=0) + 1e-12)
    if sp.issparse(X):
        tf = X.multiply(1.0 / (X.sum(axis=1) + 1e-12))
        return sp.csr_matrix(tf.multiply(idf))
    else:
        tf = X / (X.sum(axis=1, keepdims=True) + 1e-12)
        return tf * idf


# ==============================================================================
# 4. Spatial Graph Construction & Mutual Nearest Neighbors (MNN)
# ==============================================================================

def Cal_Spatial_Net(adata, radius=None, n_neighbors=6, model='KNN', verbose=False, include_self=False):
    """Construct spatial neighbor graph from spot spatial coordinates."""
    spatial = adata.obsm['spatial']
    if model == 'KNN':
        adata.uns['adj'] = kneighbors_graph(spatial, n_neighbors=n_neighbors, mode='connectivity', include_self=include_self)
    elif model == 'Radius':
        adata.uns['adj'] = radius_neighbors_graph(spatial, radius=radius, mode='connectivity', include_self=include_self)

    edgeList = np.nonzero(adata.uns['adj'])
    adata.uns['edgeList'] = np.array([edgeList[0], edgeList[1]])

    if verbose:
        print('The graph contains %d edges, %d cells.' % (adata.uns['edgeList'].shape[1], adata.n_obs))
        print('%.4f neighbors per cell on average.' % (adata.uns['edgeList'].shape[1] / adata.n_obs))


def Mutual_Nearest_Neighbors(adata, key=None, n_nearest_neighbors=3, farthest_ratio=0.6, max_samples=20000):
    """
    Find mutual nearest neighbors (MNNs) and construct triplets for self-supervised contrastive loss.
    """
    original_indices = np.arange(adata.shape[0])
    l = adata.shape[0]

    if l > max_samples:
        np.random.seed(42)
        sample_idx = np.random.choice(l, max_samples, replace=False)
        adata_sampled = adata[sample_idx].copy()
        original_indices = original_indices[sample_idx]
        l = max_samples
    else:
        adata_sampled = adata.copy()

    X = adata_sampled.X if key is None else adata_sampled.obsm[key]
    if sp.issparse(X):
        X = X.toarray()

    distances = pairwise_distances(X)
    same_count = (distances == 0).sum(axis=1)

    # Sort distances
    sorted_neighbors_index = np.argsort(distances, axis=1)

    nearest_neighbors_index = []
    farthest_neighbors_index = []

    for i, j in enumerate(same_count):
        nearest_neighbors_index.append(sorted_neighbors_index[i, j:j + n_nearest_neighbors])
        farthest_neighbors_index.append(
            sorted_neighbors_index[i, np.random.choice(
                np.arange(-max(1, int((l - j) * farthest_ratio)), 0),
                n_nearest_neighbors ** 2
            )]
        )

    nn_dict = {i: set(nearest_neighbors_index[i]) for i in range(l)}

    anchors, positives, negatives = [], [], []
    for i, (nearest_neighbors, farthest_neighbors) in enumerate(zip(nearest_neighbors_index, farthest_neighbors_index)):
        if not np.all(X[i] == 0):
            for j in nearest_neighbors:
                if i in nn_dict.get(j, set()):
                    anchors.append(original_indices[i])
                    positives.append(original_indices[j])
                    negatives.append(original_indices[np.random.choice(farthest_neighbors, 1)[0]])

    if len(anchors) == 0:
        # Fallback to standard KNN pairs if MNN intersection is empty
        for i, nearest_neighbors in enumerate(nearest_neighbors_index):
            for j in nearest_neighbors:
                anchors.append(original_indices[i])
                positives.append(original_indices[j])
                negatives.append(original_indices[np.random.choice(farthest_neighbors_index[i], 1)[0]])

    return anchors, positives, negatives


# ==============================================================================
# 5. Graph Neural Network Modules (Encoders & Decoders)
# ==============================================================================

class SAGEConv_Encoder(nn.Module):
    """Encoder based on 2-layer GraphSAGE convolution."""
    def __init__(self, in_channels, out_channels):
        super(SAGEConv_Encoder, self).__init__()
        self.conv1 = SAGEConv(in_channels, out_channels, normalize=True)
        self.conv2 = SAGEConv(out_channels, out_channels, normalize=True)

    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        x = self.conv2(x, edge_index)
        return x


class SAGEConv_Decoder(nn.Module):
    """Decoder based on 2-layer GraphSAGE convolution for reconstruction."""
    def __init__(self, in_channels, out_channels):
        super(SAGEConv_Decoder, self).__init__()
        self.conv1 = SAGEConv(in_channels, in_channels, normalize=True)
        self.conv2 = SAGEConv(in_channels, out_channels, normalize=True)

    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        x = self.conv2(x, edge_index)
        return x


class GCNConv_Encoder(nn.Module):
    """Encoder based on 2-layer GCN convolution."""
    def __init__(self, in_channels, out_channels):
        super(GCNConv_Encoder, self).__init__()
        self.conv1 = GCNConv(in_channels, out_channels, normalize=True)
        self.conv2 = GCNConv(out_channels, out_channels, normalize=True)

    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        x = self.conv2(x, edge_index)
        return x


class GCNConv_Decoder(nn.Module):
    """Decoder based on 2-layer GCN convolution."""
    def __init__(self, in_channels, out_channels):
        super(GCNConv_Decoder, self).__init__()
        self.conv1 = GCNConv(in_channels, in_channels, normalize=True)
        self.conv2 = GCNConv(in_channels, out_channels, normalize=True)

    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        x = self.conv2(x, edge_index)
        return x


class GATConv_Encoder(nn.Module):
    """Encoder based on Graph Attention Networks (GAT)."""
    def __init__(self, in_channels, out_channels):
        super(GATConv_Encoder, self).__init__()
        self.conv1 = GATConv(in_channels, out_channels, heads=2, concat=False)
        self.conv2 = GATConv(out_channels, out_channels, heads=2, concat=False)

    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        x = self.conv2(x, edge_index)
        return x


class GATConv_Decoder(nn.Module):
    """Decoder based on GAT convolution."""
    def __init__(self, in_channels, out_channels):
        super(GATConv_Decoder, self).__init__()
        self.conv1 = GATConv(in_channels, in_channels, heads=2, concat=False)
        self.conv2 = GATConv(in_channels, out_channels, heads=2, concat=False)

    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        x = self.conv2(x, edge_index)
        return x


class GraphConv_Encoder(nn.Module):
    """Encoder based on GraphConv."""
    def __init__(self, in_channels, out_channels):
        super(GraphConv_Encoder, self).__init__()
        self.conv1 = GraphConv(in_channels, out_channels)
        self.conv2 = GraphConv(out_channels, out_channels)

    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        x = self.conv2(x, edge_index)
        return x


class GraphConv_Decoder(nn.Module):
    """Decoder based on GraphConv."""
    def __init__(self, in_channels, out_channels):
        super(GraphConv_Decoder, self).__init__()
        self.conv1 = GraphConv(in_channels, in_channels)
        self.conv2 = GraphConv(in_channels, out_channels)

    def forward(self, x, edge_index):
        x = F.relu(self.conv1(x, edge_index))
        x = self.conv2(x, edge_index)
        return x


# Encoder / Decoder registry
CONV_REGISTRY = {
    'SAGEConv': (SAGEConv_Encoder, SAGEConv_Decoder),
    'GCNConv': (GCNConv_Encoder, GCNConv_Decoder),
    'GATConv': (GATConv_Encoder, GATConv_Decoder),
    'GraphConv': (GraphConv_Encoder, GraphConv_Decoder),
}


# ==============================================================================
# 6. SMART Neural Architecture
# ==============================================================================

class SMART(nn.Module):
    """
    SMART: Multi-Modal Spatial Graph Autoencoder Architecture.
    Encodes each omics stream with graph convolutions, fuses via linear projection,
    and reconstructs each modality back to feature space.
    """
    def __init__(self, hidden_dims, device, Conv_Encoder=SAGEConv_Encoder, Conv_Decoder=SAGEConv_Decoder):
        super(SMART, self).__init__()
        out_dim = hidden_dims[-1]
        self.encoders = nn.ModuleList([Conv_Encoder(in_dim, out_dim).to(device) for in_dim in hidden_dims[:-1]])
        self.fc = nn.Linear((len(hidden_dims) - 1) * out_dim, out_dim)
        self.decoders = nn.ModuleList([Conv_Decoder(out_dim, in_dim).to(device) for in_dim in hidden_dims[:-1]])

    def forward(self, features, edge_indexs):
        x = [encoder(feature, edge_index) for encoder, feature, edge_index in zip(self.encoders, features, edge_indexs)]
        if len(x) == 1:
            z = self.fc(x[0])
        else:
            z = self.fc(torch.cat(x, dim=1))
        x_rec = [decoder(z, edge_index) for decoder, edge_index in zip(self.decoders, edge_indexs)]
        return z, x_rec


def laplacian_regularization(x, edge_index):
    """Compute Laplacian regularization loss: enforce smoothness across neighbor nodes."""
    row, col = edge_index
    diff = x[row] - x[col]
    loss = (diff ** 2).sum(dim=1).mean()
    return loss


# ==============================================================================
# 7. SMART Training Engine
# ==============================================================================

def train_SMART(
    features,
    edges,
    triplet_samples_list,
    weights=None,
    emb_dim=64,
    n_epochs=300,
    lr=5e-3,
    weight_decay=1e-6,
    device=torch.device('cuda:0' if torch.cuda.is_available() else 'cpu'),
    window_size=10,
    slope=1e-4,
    Conv_Encoder=SAGEConv_Encoder,
    Conv_Decoder=SAGEConv_Decoder,
    margin=0.5,
    laplacian_alpha=0.0,
    true_labels=None,
    num_clusters=10,
    random_seed=2024,
    eval_interval=10,
    verbose=True
):
    """Train the SMART model tracking multi-loss trajectories and clustering performance."""
    if weights is None:
        weights = [1.0, 1.0, 1.0, 1.0]

    hidden_dims = [x.shape[1] for x in features] + [emb_dim]
    model = SMART(hidden_dims=hidden_dims, device=device, Conv_Encoder=Conv_Encoder, Conv_Decoder=Conv_Decoder)

    features = [x.to(device) for x in features]
    edges = [edge.to(device) for edge in edges]
    model.to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=weight_decay)
    triplet_loss_fn = nn.TripletMarginLoss(margin=margin, p=2, reduction='mean')

    loss_history = []
    recon_loss_history = []
    triplet_loss_history = []
    epoch_sil_history = []
    epoch_ari_history = []
    epoch_nmi_history = []

    best_sil = -float('inf')
    best_epoch = 1
    best_emb = None

    print(f"Training SMART for {n_epochs} epochs (LR: {lr}, Dim: {emb_dim}, Weights: {weights})...")

    for epoch in range(1, n_epochs + 1):
        model.train()
        optimizer.zero_grad()

        z, x_rec = model(features, edges)

        # 1. Triplet Loss
        tri_loss = torch.tensor(0.0, device=device)
        for i, (anchors, positives, negatives) in enumerate(triplet_samples_list):
            if len(anchors) > 0:
                anchor_arr = z[anchors]
                positive_arr = z[positives]
                negative_arr = z[negatives]
                w = weights[len(weights) // 2 + i] if (len(weights) // 2 + i) < len(weights) else 1.0
                tri_loss = tri_loss + w * triplet_loss_fn(anchor_arr, positive_arr, negative_arr)

        # 2. Reconstruction Loss
        rec_loss = torch.tensor(0.0, device=device)
        for i, (feature, x_r) in enumerate(zip(features, x_rec)):
            w = weights[i] if i < len(weights) else 1.0
            rec_loss = rec_loss + w * F.mse_loss(feature, x_r)

        # 3. Total Loss
        loss = rec_loss + tri_loss
        if laplacian_alpha > 0:
            loss = loss + laplacian_alpha * laplacian_regularization(z, edges[0])

        loss.backward()
        optimizer.step()

        loss_history.append(loss.item())
        recon_loss_history.append(rec_loss.item())
        triplet_loss_history.append(tri_loss.item())

        # Intermediate evaluation
        is_eval_epoch = (epoch % eval_interval == 0) or (epoch == n_epochs) or (epoch == 1)
        if is_eval_epoch:
            with torch.no_grad():
                model.eval()
                z_eval, _ = model(features, edges)
                emb_np = z_eval.cpu().detach().numpy()

            try:
                km_preds = KMeans(n_clusters=num_clusters, n_init=5, random_state=random_seed).fit_predict(emb_np)
                curr_sil = float(silhouette_score(emb_np, km_preds))
            except Exception:
                curr_sil = 0.0

            curr_ari = 0.0
            curr_nmi = 0.0
            if true_labels is not None:
                try:
                    curr_ari = float(adjusted_rand_score(true_labels, km_preds))
                    curr_nmi = float(normalized_mutual_info_score(true_labels, km_preds))
                except Exception:
                    pass

            epoch_sil_history.append(curr_sil)
            epoch_ari_history.append(curr_ari)
            epoch_nmi_history.append(curr_nmi)

            if curr_sil > best_sil:
                best_sil = curr_sil
                best_epoch = epoch
                best_emb = emb_np.copy()

            if verbose and ((epoch % 50 == 0) or epoch == 1 or epoch == n_epochs):
                ari_str = f" | ARI: {curr_ari:.4f}" if true_labels is not None else ""
                print(f"Epoch {epoch:4d}/{n_epochs} | Total Loss: {loss.item():.4f} | Recon: {rec_loss.item():.4f} | Triplet: {tri_loss.item():.4f} | Sil: {curr_sil:.4f}{ari_str}")
        else:
            epoch_sil_history.append(epoch_sil_history[-1] if epoch_sil_history else 0.0)
            epoch_ari_history.append(epoch_ari_history[-1] if epoch_ari_history else 0.0)
            epoch_nmi_history.append(epoch_nmi_history[-1] if epoch_nmi_history else 0.0)

    print(f"SMART training finished! Final Loss: {loss.item():.4f} | Best Silhouette: {best_sil:.4f} (Epoch {best_epoch})\n")

    with torch.no_grad():
        model.eval()
        z_final, _ = model(features, edges)
        final_emb = z_final.cpu().detach().numpy()

    output = {
        'model': model,
        'final_embeddings': final_emb,
        'best_embeddings': best_emb if best_emb is not None else final_emb,
        'best_epoch': best_epoch,
        'best_sil': best_sil,
        'loss_history': loss_history,
        'recon_loss_history': recon_loss_history,
        'triplet_loss_history': triplet_loss_history,
        'epoch_sil_history': epoch_sil_history,
        'epoch_ari_history': epoch_ari_history,
        'epoch_nmi_history': epoch_nmi_history,
    }
    return output


# ==============================================================================
# 8. Clustering Support (mclust, KMeans, Leiden, Louvain, GMM)
# ==============================================================================

def mclust_R(adata, num_cluster, modelNames='EEE', used_obsm='emb_pca', random_seed=2020):
    """Clustering using R package mclust via rpy2 with robust automatic installation and fallback."""
    try:
        import rpy2.robjects as robjects
        from rpy2.robjects import pandas2ri, default_converter
        from rpy2.robjects.conversion import localconverter
        import rpy2.robjects.conversion as cv

        cv.set_conversion(default_converter + pandas2ri.converter)
        robjects.r.options(warn=-1)

        robjects.r("""
        if (!requireNamespace("mclust", quietly = TRUE)) {
            install.packages("mclust", repos="https://cloud.r-project.org", quiet=TRUE)
        }
        library(mclust)
        """)

        np.random.seed(random_seed)
        r_random_seed = robjects.r["set.seed"]
        r_random_seed(random_seed)
        rmclust = robjects.r["Mclust"]

        X = np.array(adata.obsm[used_obsm], dtype=np.float64)
        df = pd.DataFrame(X, columns=[f'PC{i+1}' for i in range(X.shape[1])])

        subset_size = min(300, X.shape[0])
        subset_indices = robjects.IntVector(list(np.random.choice(range(1, X.shape[0] + 1), subset_size, replace=False)))
        init_list = robjects.ListVector({'subset': subset_indices})

        with localconverter(default_converter + pandas2ri.converter):
            res = rmclust(df, G=num_cluster, modelNames=modelNames, initialization=init_list)

        if hasattr(res, 'rx2'):
            mclust_res = np.array(res.rx2('classification'))
        elif hasattr(res, 'getbyname'):
            mclust_res = np.array(res.getbyname('classification'))
        else:
            mclust_res = np.array(res['classification'])

        adata.obs['mclust'] = mclust_res
        adata.obs['mclust'] = adata.obs['mclust'].astype('int').astype('str').astype('category')
        return adata
    except Exception as e:
        print(f"[Warning] mclust via rpy2 not available ({e}). Falling back to KMeans clustering.")
        X = np.array(adata.obsm[used_obsm], dtype=np.float64)
        km = KMeans(n_clusters=num_cluster, n_init=10, random_state=random_seed).fit_predict(X)
        adata.obs['mclust'] = pd.Categorical(km.astype(str))
        return adata


def search_res(adata, n_clusters, method='leiden', use_rep='emb', start=0.1, end=3.0, increment=0.02):
    """Search corresponding resolution for Leiden or Louvain according to target number of clusters."""
    sc.pp.neighbors(adata, n_neighbors=50, use_rep=use_rep)
    best_res = start
    min_diff = 999
    for res in sorted(list(np.arange(start, end, increment)), reverse=True):
        if method == 'leiden':
            sc.tl.leiden(adata, random_state=0, resolution=res)
            count_unique = len(pd.DataFrame(adata.obs['leiden']).leiden.unique())
        else:
            sc.tl.louvain(adata, random_state=0, resolution=res)
            count_unique = len(pd.DataFrame(adata.obs['louvain']).louvain.unique())

        if count_unique == n_clusters:
            return res
        if abs(count_unique - n_clusters) < min_diff:
            min_diff = abs(count_unique - n_clusters)
            best_res = res
    return best_res


def clustering(adata, n_clusters=7, key='emb', add_key='SMART', method='mclust', start=0.1, end=3.0, increment=0.02, use_pca=False, n_comps=20, random_seed=2020):
    """Perform clustering on latent representations."""
    used_key = key
    if use_pca:
        adata.obsm[key + '_pca'] = pca(adata, use_reps=key, n_comps=min(n_comps, adata.obsm[key].shape[1] - 1))
        used_key = key + '_pca'

    if method == 'mclust':
        adata = mclust_R(adata, used_obsm=used_key, num_cluster=n_clusters, random_seed=random_seed)
        adata.obs[add_key] = adata.obs['mclust']
    elif method == 'kmeans':
        X = adata.obsm[used_key]
        km = KMeans(n_clusters=n_clusters, n_init=10, random_state=random_seed).fit_predict(X)
        adata.obs[add_key] = pd.Categorical(km.astype(str))
    elif method == 'gmm':
        X = adata.obsm[used_key]
        gmm = GaussianMixture(n_components=n_clusters, random_state=random_seed)
        adata.obs[add_key] = pd.Categorical(gmm.fit_predict(X).astype(str))
    elif method == 'leiden':
        res = search_res(adata, n_clusters, use_rep=used_key, method=method, start=start, end=end, increment=increment)
        sc.tl.leiden(adata, random_state=random_seed, resolution=res)
        adata.obs[add_key] = adata.obs['leiden']
    elif method == 'louvain':
        res = search_res(adata, n_clusters, use_rep=used_key, method=method, start=start, end=end, increment=increment)
        sc.tl.louvain(adata, random_state=random_seed, resolution=res)
        adata.obs[add_key] = adata.obs['louvain']


# ==============================================================================
# 9. Visualizations & Standard Plotting
# ==============================================================================

def plot_training_curves(training_results: dict, dataset_name="Dataset", save_path=None, show=False):
    """Plot Loss decomposition, Silhouette Score curve, and ARI curve across training epochs."""
    epochs_range = range(1, len(training_results['loss_history']) + 1)
    has_ari = len(training_results.get('epoch_ari_history', [])) > 0

    fig, axes = plt.subplots(1, 3 if has_ari else 2, figsize=(18 if has_ari else 12, 4.5), dpi=150)
    if not isinstance(axes, (list, np.ndarray)):
        axes = [axes]

    # 1. Loss Decomposition Curves
    axes[0].plot(epochs_range, training_results['loss_history'], color='#1f77b4', linewidth=2.5, label='Total Loss')
    if 'recon_loss_history' in training_results and len(training_results['recon_loss_history']) == len(epochs_range):
        axes[0].plot(epochs_range, training_results['recon_loss_history'], color='#3b82f6', linewidth=1.5, linestyle='--', label='Recon Loss')
    if 'triplet_loss_history' in training_results and len(training_results['triplet_loss_history']) == len(epochs_range):
        axes[0].plot(epochs_range, training_results['triplet_loss_history'], color='#f59e0b', linewidth=1.5, linestyle='-.', label='Triplet Loss')

    axes[0].set_title(f'Loss Curves - {dataset_name}', fontsize=12, fontweight='bold', pad=10)
    axes[0].set_xlabel('Epoch', fontsize=11)
    axes[0].set_ylabel('Loss Value', fontsize=11)
    axes[0].grid(True, linestyle='--', alpha=0.5)
    axes[0].legend(frameon=True, fontsize='small', loc='upper right')

    # 2. Silhouette Score Curve
    best_epoch = training_results.get('best_epoch', len(epochs_range))
    best_sil = training_results.get('best_sil', training_results['epoch_sil_history'][-1] if training_results.get('epoch_sil_history') else 0.0)
    axes[1].plot(epochs_range, training_results['epoch_sil_history'], color='#2ca02c', linewidth=2.0, label='Silhouette Score')
    axes[1].scatter([best_epoch], [best_sil], color='#e11d48', s=50, zorder=5, label=f'Best Sil (Ep {best_epoch}): {best_sil:.4f}')
    axes[1].set_title(f'Silhouette Score Curve - {dataset_name}', fontsize=12, fontweight='bold', pad=10)
    axes[1].set_xlabel('Epoch', fontsize=11)
    axes[1].set_ylabel('Silhouette Score', fontsize=11)
    axes[1].grid(True, linestyle='--', alpha=0.5)
    axes[1].legend(frameon=True, loc='lower right')

    # 3. ARI Curve
    if has_ari:
        best_ep_idx = min(max(0, best_epoch - 1), len(training_results['epoch_ari_history']) - 1)
        best_ep_ari = training_results['epoch_ari_history'][best_ep_idx] if training_results.get('epoch_ari_history') else 0.0
        axes[2].plot(epochs_range, training_results['epoch_ari_history'], color='#ff7f0e', linewidth=2.0, label='Epoch ARI')
        axes[2].scatter([best_epoch], [best_ep_ari], color='#e11d48', s=50, zorder=5, label=f'ARI at Best Sil (Ep {best_epoch}): {best_ep_ari:.4f}')
        axes[2].set_title(f'ARI Curve - {dataset_name}', fontsize=12, fontweight='bold', pad=10)
        axes[2].set_xlabel('Epoch', fontsize=11)
        axes[2].set_ylabel('Adjusted Rand Index (ARI)', fontsize=11)
        axes[2].grid(True, linestyle='--', alpha=0.5)
        axes[2].legend(frameon=True, loc='lower right')

    plt.tight_layout()
    if save_path:
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
    if show:
        plt.show()
    else:
        plt.close()


def plot_all_visualizations(
    adata_RNA,
    final_embeddings: np.ndarray,
    final_labels: np.ndarray,
    sil: float,
    ari: float,
    training_results: dict,
    dataset_name="Dataset",
    seed=42,
    true_labels=None,
    output_dir="results",
    show=False
):
    """Generate and save complete visualizations (Curves, Spatial, UMAP, Violin)."""
    plots_dir = os.path.join(output_dir, "plots")
    os.makedirs(os.path.join(plots_dir, "curves"), exist_ok=True)
    os.makedirs(os.path.join(plots_dir, "spatial"), exist_ok=True)
    os.makedirs(os.path.join(plots_dir, "umap"), exist_ok=True)
    os.makedirs(os.path.join(plots_dir, "violin"), exist_ok=True)

    if true_labels is not None:
        adata_RNA.obs['ground_truth'] = pd.Categorical(true_labels)
    elif 'ground_truth' not in adata_RNA.obs:
        adata_RNA.obs['ground_truth'] = pd.Categorical(final_labels.astype(str))

    adata_RNA.obsm['SMART_Emb'] = final_embeddings
    adata_RNA.obs['predicted_domain'] = pd.Categorical(final_labels.astype(str))

    # 1. Training Curves
    curve_path = os.path.join(plots_dir, "curves", f"{dataset_name}_seed{seed}_training_curves.png")
    plot_training_curves(training_results, dataset_name=f"{dataset_name} (Seed {seed})", save_path=curve_path, show=show)

    # 2. Spatial Domains Side-by-Side Comparison
    spatial_coords = adata_RNA.obsm.get('spatial', None)
    if spatial_coords is not None:
        fig, axes = plt.subplots(1, 2, figsize=(15, 6.5))
        gt_cats = pd.Categorical(adata_RNA.obs['ground_truth'])
        pred_cats = pd.Categorical(adata_RNA.obs['predicted_domain'])
        axes[0].scatter(spatial_coords[:, 0], spatial_coords[:, 1], c=gt_cats.codes, cmap='tab20', s=10, alpha=0.9)
        axes[0].set_title(f'Ground Truth ({dataset_name})', fontsize=12, fontweight='bold')
        axes[0].set_xlabel('Spatial X')
        axes[0].set_ylabel('Spatial Y')

        axes[1].scatter(spatial_coords[:, 0], spatial_coords[:, 1], c=pred_cats.codes, cmap='tab20', s=10, alpha=0.9)
        axes[1].set_title(f'SMART Domains (ARI: {ari:.4f})', fontsize=12, fontweight='bold')
        axes[1].set_xlabel('Spatial X')
        axes[1].set_ylabel('Spatial Y')

        plt.suptitle(f"Spatial Domains Comparison - {dataset_name} (Seed {seed})", fontsize=14, fontweight='bold', y=1.02)
        plt.tight_layout()
        plt.savefig(os.path.join(plots_dir, "spatial", f"{dataset_name}_seed{seed}_spatial.png"), dpi=300, bbox_inches='tight')
        if show:
            plt.show()
        else:
            plt.close()

    # 3. UMAP Representation
    sc.pp.neighbors(adata_RNA, use_rep='SMART_Emb')
    sc.tl.umap(adata_RNA)
    fig, axes = plt.subplots(1, 2, figsize=(15, 6))
    sc.pl.umap(adata_RNA, color='ground_truth', ax=axes[0], show=False, title='UMAP: Ground Truth Annotation')
    sc.pl.umap(adata_RNA, color='predicted_domain', ax=axes[1], show=False, title=f'UMAP: Predicted Domains (Sil: {sil:.4f})')
    plt.suptitle(f"UMAP Joint Representation - {dataset_name} (Seed {seed})", fontsize=14, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.savefig(os.path.join(plots_dir, "umap", f"{dataset_name}_seed{seed}_umap.png"), dpi=300, bbox_inches='tight')
    if show:
        plt.show()
    else:
        plt.close()

    # 4. Violin Plots: Silhouette & Latent Profiles
    try:
        sample_sil_values = silhouette_samples(final_embeddings, final_labels)
        adata_RNA.obs['silhouette_coefficient'] = sample_sil_values
        adata_RNA.obs['Latent_Dim_1'] = final_embeddings[:, 0]
        fig, axes = plt.subplots(1, 2, figsize=(16, 5.5))
        sns.violinplot(
            data=adata_RNA.obs,
            x='predicted_domain',
            y='silhouette_coefficient',
            hue='predicted_domain',
            palette='Set2',
            legend=False,
            inner='quartile',
            ax=axes[0]
        )
        axes[0].axhline(sil, color='red', linestyle='--', label=f'Mean Sil: {sil:.4f}')
        axes[0].set_title("Silhouette Coefficient per Predicted Domain", fontsize=12, fontweight='bold')
        sns.violinplot(
            data=adata_RNA.obs,
            x='predicted_domain',
            y='Latent_Dim_1',
            hue='predicted_domain',
            palette='tab10',
            legend=False,
            inner='box',
            ax=axes[1]
        )
        axes[1].set_title("Latent Dimension 1 Distribution per Domain", fontsize=12, fontweight='bold')
        plt.suptitle(f"Violin Plots: Cluster Profiles - {dataset_name} (Seed {seed})", fontsize=14, fontweight='bold', y=1.02)
        plt.tight_layout()
        plt.savefig(os.path.join(plots_dir, "violin", f"{dataset_name}_seed{seed}_violin.png"), dpi=300, bbox_inches='tight')
        if show:
            plt.show()
        else:
            plt.close()
    except Exception as e:
        print(f"Skipping Violin plots due to error: {e}")


# ==============================================================================
# 10. Standardized Dashboard Result Exporter & Live API Pusher
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

    # 1. Curves History
    loss_hist = training_results.get("loss_history", [])
    recon_hist = training_results.get("recon_loss_history", [])
    triplet_hist = training_results.get("triplet_loss_history", [])
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
                "spatial_loss": float(triplet_hist[ep]) if ep < len(triplet_hist) else 0.0,
                "reg_loss": 0.0,
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

    # 2. Local JSON Files Save
    with open(os.path.join(exp_dir, "metrics.json"), "w") as f:
        json.dump({
            "model_id": model_id,
            "dataset": dataset_name,
            "seed": int(seed),
            "final_epoch": len(loss_hist),
            "best_epoch": best_epoch,
            "best_score": best_score,
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
                "finalMetrics": safe_metrics,
                "history": safe_history,
                "embeddingsData": safe_embeddings,
                "modelMetadata": {
                    "architecture": "Multi-Modal Graph Autoencoder with Mutual Nearest Neighbors (SMART)",
                    "hyperparameters": safe_hyperparameters,
                }
            }

            req = urllib.request.Request(
                api_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    print(f"🚀 Successfully sent experiment results directly to Dashboard via API ({api_url})!")
        except Exception as e:
            print(f"ℹ️ Direct API push skipped (dashboard server offline or unreachable: {e}). Data is safely stored in JSON files.")


# ==============================================================================
# 11. Dataset Resolver & Auto-Downloader
# ==============================================================================

def resolve_dataset_files(dataset_name: str, folder_url: str, data_dir: str = "data"):
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

    rna_path = os.path.join(base_dir, "adata_RNA.h5ad")
    if dataset_name.startswith("10x"):
        aux_path = os.path.join(base_dir, "adata_ADT.h5ad")
        anno_path = os.path.join(base_dir, "annotation.csv")
        gt_col = "manual-anno"
        data_type = '10x'
    else:
        aux_path = os.path.join(base_dir, "adata_ATAC.h5ad")
        anno_path = os.path.join(base_dir, "anno.csv")
        gt_col = "cluster"
        data_type = 'Spatial-epigenome-transcriptome'

    if not (os.path.exists(rna_path) and os.path.exists(aux_path) and os.path.exists(anno_path)):
        print(f"Re-downloading {dataset_name}...")
        gdown_cmd = ".venv/bin/gdown" if os.path.exists(".venv/bin/gdown") else "gdown"
        os.system(f'{gdown_cmd} --folder "{folder_url}" --output "{base_dir}"')

    return rna_path, aux_path, anno_path, gt_col, data_type


# ==============================================================================
# 12. Experiment Execution Engine
# ==============================================================================

def run_experiment(
    datasets: Union[str, int, List[Union[str, int]]] = "all",
    seeds: Optional[List[int]] = None,
    n_seeds: Optional[int] = None,
    epochs: Optional[int] = None,
    lr: float = 5e-3,
    weight_decay: float = 1e-6,
    emb_dim: int = 64,
    encoder: str = 'SAGEConv',
    weights: Optional[List[float]] = None,
    laplacian_alpha: float = 0.0,
    tool: str = 'mclust',
    device: Optional[str] = None,
    visualize: bool = True,
    show_plots: bool = False,
    output_dir: str = "results",
    data_dir: str = "data",
    api_url: Optional[str] = "https://model-performance.vercel.app/api/experiments/upload"
):
    dev = get_compute_device(device)
    os.makedirs(output_dir, exist_ok=True)

    if seeds is None:
        run_seeds = DEFAULT_SEEDS
    else:
        run_seeds = list(seeds)

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

    Conv_Enc, Conv_Dec = CONV_REGISTRY.get(encoder, (SAGEConv_Encoder, SAGEConv_Decoder))

    total_runs = len(dataset_names) * len(run_seeds)
    print("\n" + "=" * 80)
    print(" 🚀 STARTING SMART MULTI-OMICS EXPERIMENT ".center(80, "="))
    print("=" * 80)
    print(f"• Datasets     : {dataset_names}")
    print(f"• Seeds ({len(run_seeds)})   : {run_seeds}")
    print(f"• Architecture : {encoder} Autoencoder | Emb Dim: {emb_dim}")
    print(f"• Clustering   : {tool}")
    print(f"• Learning Rate: {lr} | Weight Decay: {weight_decay}")
    print(f"• Device       : {dev}")
    print("=" * 80 + "\n")

    all_results = []

    for d_idx, dataset_name in enumerate(dataset_names, 1):
        folder_url = next((c[1] for c in CHOICES if c[0] == dataset_name), None)
        if not folder_url:
            print(f"Dataset {dataset_name} not found in registry. Skipping.")
            continue

        print("\n" + "#" * 80)
        print(f" DATASET: {dataset_name} ".center(80, "#"))
        print("#" * 80)

        rna_path, aux_path, anno_path, gt_col, data_type = resolve_dataset_files(dataset_name, folder_url, data_dir=data_dir)
        adata_omics1 = sc.read_h5ad(rna_path)
        adata_omics2 = sc.read_h5ad(aux_path)

        adata_omics1.var_names_make_unique()
        adata_omics2.var_names_make_unique()

        anno_df = pd.read_csv(anno_path, index_col=0)
        gt_values = anno_df[gt_col] if isinstance(anno_df[gt_col], pd.Series) else anno_df[gt_col].iloc[:, 0]
        adata_omics1.obs['ground_truth'] = gt_values.values
        adata_omics2.obs['ground_truth'] = gt_values.values

        # ------------------ Preprocessing ------------------
        sc.pp.filter_genes(adata_omics1, min_cells=10)
        sc.pp.highly_variable_genes(adata_omics1, flavor="seurat_v3", n_top_genes=3000)
        sc.pp.normalize_total(adata_omics1, target_sum=1e4)
        sc.pp.log1p(adata_omics1)
        sc.pp.scale(adata_omics1)

        adata_omics1_high = adata_omics1[:, adata_omics1.var['highly_variable']]
        cfg = DATASET_REGISTRY.get(dataset_name, {})
        rna_comps = cfg.get("rna_pca_comps", 30)
        aux_comps = cfg.get("aux_pca_comps", 30 if dataset_name.startswith("10x") else 60)

        adata_omics1.obsm['feat'] = pca(adata_omics1_high, n_comps=min(rna_comps, adata_omics1_high.n_vars - 1))

        if dataset_name.startswith("10x"):
            adata_omics2 = adata_omics2[adata_omics1.obs_names].copy()
            adata_omics2 = clr_normalize_each_cell(adata_omics2)
            sc.pp.scale(adata_omics2)
            adata_omics2.obsm['feat'] = pca(adata_omics2, n_comps=min(aux_comps, adata_omics2.n_vars - 1))
        else:
            adata_omics2 = adata_omics2[adata_omics1.obs_names].copy()
            adata_omics2.X = tfidf(adata_omics2.X)
            sc.pp.normalize_per_cell(adata_omics2, counts_per_cell_after=1e4)
            sc.pp.log1p(adata_omics2)
            adata_omics2.obsm['feat'] = pca(adata_omics2, n_comps=min(aux_comps, adata_omics2.shape[1] - 1))

        # Construct spatial neighbor graphs
        Cal_Spatial_Net(adata_omics1, model="KNN", n_neighbors=6)
        Cal_Spatial_Net(adata_omics2, model="KNN", n_neighbors=6)

        adata_list = [adata_omics1, adata_omics2]
        x = [torch.FloatTensor(adata.obsm["feat"]).to(dev) for adata in adata_list]
        edges = [torch.LongTensor(adata.uns["edgeList"]).to(dev) for adata in adata_list]

        n_ground_truth = int(adata_omics1.obs["ground_truth"].dropna().nunique())
        n_cluster = n_ground_truth
        print(f"Number of ground truth classes: {n_ground_truth}")

        run_epochs = epochs if epochs is not None else cfg.get("default_epochs", 300)
        run_weights = weights if weights is not None else [1.0, 1.0, 1.0, 1.0]

        dataset_results = []

        for s_idx, seed in enumerate(run_seeds, 1):
            run_num = (d_idx - 1) * len(run_seeds) + s_idx
            print(f"\n[{run_num}/{total_runs}] Running SMART on {dataset_name} | Seed: {seed}...")
            set_seed(seed)

            # Compute Triplet Samples
            triplet_samples_list = [
                Mutual_Nearest_Neighbors(adata, key="feat", n_nearest_neighbors=3, farthest_ratio=0.6)
                for adata in adata_list
            ]

            gt_labels_array = adata_omics1.obs['ground_truth'].astype(str).values
            start_time = time.time()

            # Train SMART model
            output = train_SMART(
                features=x,
                edges=edges,
                triplet_samples_list=triplet_samples_list,
                weights=run_weights,
                emb_dim=emb_dim,
                n_epochs=run_epochs,
                lr=lr,
                weight_decay=weight_decay,
                device=dev,
                Conv_Encoder=Conv_Enc,
                Conv_Decoder=Conv_Dec,
                laplacian_alpha=laplacian_alpha,
                true_labels=gt_labels_array,
                num_clusters=n_cluster,
                random_seed=seed,
                verbose=True
            )
            duration = time.time() - start_time

            final_emb = output['final_embeddings']
            adata_eval = adata_omics1.copy()
            adata_eval.obsm['SMART'] = final_emb

            # Clustering
            clustering(
                adata_eval,
                key='SMART',
                add_key='SMART',
                n_clusters=n_cluster,
                method=tool,
                use_pca=True,
                random_seed=seed
            )

            y_true = adata_eval.obs['ground_truth'].astype(str).values
            y_pred = adata_eval.obs['SMART'].astype(str).values

            # Metric Calculations
            ari = float(adjusted_rand_score(y_true, y_pred))
            nmi = float(normalized_mutual_info_score(y_true, y_pred))
            ami = float(adjusted_mutual_info_score(y_true, y_pred))
            homo = float(homogeneity_score(y_true, y_pred))
            v_meas = float(v_measure_score(y_true, y_pred))
            fmi = float(fowlkes_mallows_score(y_true, y_pred))

            le = LabelEncoder()
            y_pred_int = le.fit_transform(y_pred)
            sil_score = float(silhouette_score(final_emb, y_pred_int))
            chi_score = float(calinski_harabasz_score(final_emb, y_pred_int))
            dbi_score = float(davies_bouldin_score(final_emb, y_pred_int))

            print(f"\n✨ Evaluation Results for {dataset_name} | Seed: {seed}:")
            print(f"  • Silhouette : {sil_score:.4f}")
            print(f"  • ARI        : {ari:.4f} | NMI: {nmi:.4f} | AMI: {ami:.4f}")
            print(f"  • Homogeneity: {homo:.4f} | V-measure: {v_meas:.4f} | FMI: {fmi:.4f}")
            print(f"  • CHI        : {chi_score:.2f} | DBI: {dbi_score:.4f}")
            print(f"  • Duration   : {duration:.2f}s")

            # Visualization Plots
            if visualize:
                plot_all_visualizations(
                    adata_RNA=adata_eval,
                    final_embeddings=final_emb,
                    final_labels=y_pred,
                    sil=sil_score,
                    ari=ari,
                    training_results=output,
                    dataset_name=dataset_name,
                    seed=seed,
                    true_labels=y_true,
                    output_dir=output_dir,
                    show=show_plots
                )

            # Compute UMAP coordinates on full spots
            umap_obj = sc.pp.neighbors(adata_eval, use_rep='SMART', copy=True)
            sc.tl.umap(umap_obj)
            umap_coords = umap_obj.obsm['X_umap']
            spatial_coords = adata_eval.obsm.get('spatial', None)

            embeddings_data = {
                "umapCoordinates": umap_coords.tolist(),
                "spatialCoordinates": spatial_coords.tolist() if spatial_coords is not None else [],
                "predictedLabels": y_pred.tolist(),
                "groundTruthLabels": y_true.tolist(),
                "sampleSilhouettes": silhouette_samples(final_emb, y_pred_int).tolist(),
            }

            metrics_dict = {
                "ARI": ari,
                "NMI": nmi,
                "Silhouette": sil_score,
                "AMI": ami,
                "CHI": chi_score,
                "DBI": dbi_score,
                "Homogeneity": homo,
                "V-measure": v_meas,
                "FMI": fmi,
            }

            hyperparameters = {
                "epochs": run_epochs,
                "lr": lr,
                "weight_decay": weight_decay,
                "emb_dim": emb_dim,
                "encoder": encoder,
                "weights": run_weights,
                "clustering_tool": tool,
            }

            # Export to Dashboard API & local JSONs
            export_dashboard_experiment(
                model_id="Smart",
                model_name="SMART",
                dataset_name=dataset_name,
                seed=seed,
                metrics_dict=metrics_dict,
                training_results=output,
                hyperparameters=hyperparameters,
                embeddings_data=embeddings_data,
                output_dir=output_dir,
                api_url=api_url
            )

            res_dict = {
                'dataset': dataset_name,
                'seed': seed,
                'best_epoch': output.get('best_epoch', run_epochs),
                'ARI': ari,
                'NMI': nmi,
                'AMI': ami,
                'Silhouette': sil_score,
                'CHI': chi_score,
                'DBI': dbi_score,
                'Homogeneity': homo,
                'V-measure': v_meas,
                'FMI': fmi,
                'no_cluster': n_cluster,
                'Duration_s': round(duration, 2)
            }
            dataset_results.append(res_dict)
            all_results.append(res_dict)

        # Save per-dataset CSV results
        df_ds = pd.DataFrame(dataset_results)
        df_ds.to_csv(os.path.join(output_dir, f"Smart_{dataset_name}_results.csv"), index=False)

    # Save overall summary CSV
    df_all = pd.DataFrame(all_results)
    df_all.to_csv(os.path.join(output_dir, "Smart_all_results.csv"), index=False)

    summary_cols = ['ARI', 'Silhouette', 'NMI', 'AMI', 'CHI', 'DBI']
    print("\n" + "=" * 88)
    print(" ALL SMART EXPERIMENTS COMPLETED ".center(88, "="))
    print("=" * 88)
    print(df_all.groupby('dataset')[summary_cols].mean().to_string())
    print("-" * 88)
    print(" OVERALL MEAN ACROSS ALL DATASETS & SEEDS ".center(88, "-"))
    print(df_all[summary_cols].mean().to_frame().T.to_string(index=False))
    print("=" * 88 + "\n")

    return df_all


# ==============================================================================
# 13. Command-Line Interface (CLI)
# ==============================================================================

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="SMART Multi-Modal Spatial Model CLI & Live Dashboard Integration",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )

    parser.add_argument(
        '--datasets', nargs='+', default=['all'],
        help="Datasets to run. Can be index (0 to 5), name (e.g. 10x_human_lymph_node_A1), or 'all'."
    )
    parser.add_argument(
        '--seeds', nargs='+', type=int, default=None,
        help="List of random seeds to evaluate (e.g. --seeds 42 2024 13)."
    )
    parser.add_argument(
        '--n_seeds', type=int, default=None,
        help="Use first N seeds from default seed list."
    )
    parser.add_argument(
        '--epochs', type=int, default=None,
        help="Number of epochs to train. If not set, dataset-specific default is used (300)."
    )
    parser.add_argument('--lr', type=float, default=5e-3, help="Learning rate")
    parser.add_argument('--weight_decay', type=float, default=1e-6, help="Weight decay for optimizer")
    parser.add_argument('--emb_dim', type=int, default=64, help="Dimension of output latent representation")
    parser.add_argument('--encoder', type=str, default='SAGEConv', choices=['SAGEConv', 'GCNConv', 'GATConv', 'GraphConv'], help="GNN Encoder Architecture")
    parser.add_argument('--weights', nargs='+', type=float, default=[1.0, 1.0, 1.0, 1.0], help="Reconstruction & Triplet loss weights")
    parser.add_argument('--laplacian_alpha', type=float, default=0.0, help="Laplacian smoothness regularization weight")
    parser.add_argument('--tool', type=str, default='mclust', choices=['mclust', 'kmeans', 'gmm', 'leiden', 'louvain'], help="Clustering method")
    parser.add_argument('--device', type=str, default=None, help="Compute device ('cuda', 'cuda:0', or 'cpu')")
    parser.add_argument('--visualize', action='store_true', default=True, help="Generate and save all plots (Curves, Spatial, UMAP, Violin)")
    parser.add_argument('--show_plots', action='store_true', default=False, help="Display matplotlib interactive plots")
    parser.add_argument('--output_dir', type=str, default='results', help="Directory to save CSV results and plots")
    parser.add_argument('--data_dir', type=str, default='data', help="Directory to save/load datasets")
    parser.add_argument('--api_url', type=str, default="https://model-performance.vercel.app/api/experiments/upload", help="Live Dashboard endpoint URL")

    cli_args = parser.parse_args()

    run_experiment(
        datasets=cli_args.datasets if len(cli_args.datasets) > 1 or cli_args.datasets[0] != 'all' else 'all',
        seeds=cli_args.seeds,
        n_seeds=cli_args.n_seeds,
        epochs=cli_args.epochs,
        lr=cli_args.lr,
        weight_decay=cli_args.weight_decay,
        emb_dim=cli_args.emb_dim,
        encoder=cli_args.encoder,
        weights=cli_args.weights,
        laplacian_alpha=cli_args.laplacian_alpha,
        tool=cli_args.tool,
        device=cli_args.device,
        visualize=cli_args.visualize,
        show_plots=cli_args.show_plots,
        output_dir=cli_args.output_dir,
        data_dir=cli_args.data_dir,
        api_url=cli_args.api_url
    )
