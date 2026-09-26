#!/usr/bin/env python3
"""
================================================================================
🚀 ASTRA: Spot-Adaptive Gated Attention Fusion & Spatial Potts DEC Pipeline
================================================================================
Deep Multi-Omics Spatial Clustering Pipeline for Spatial Transcriptomics & Epigenomics/Proteomics.
Fully integrated with the Next.js Model Performance Benchmark Dashboard.

Key Features:
  • Two-Stage Training: Gated GCN Pretraining (Stage 1) + Spatial Potts Consensus DEC (Stage 2)
  • Comprehensive Evaluation: ARI, NMI, AMI, Silhouette, Homogeneity, V-measure, FMI, CHI, DBI
  • Multi-Loss Trajectory Tracking: Total Loss, Recon Loss, Spatial Loss, Reg Loss, and KL Divergence
  • Full Spatial & UMAP Embeddings: 100% of all spots exported for tissue domain visualization
  • Direct Dashboard API Integration: Automatically pushes structured JSONs & metrics to MongoDB
================================================================================
"""

import os
import sys
import copy
import json
import time
import random
import argparse
import urllib.request
import urllib.error
from typing import Optional, Tuple, Dict, List, Union

import numpy as np
import pandas as pd
import scipy.sparse as sp

import sklearn
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.neighbors import NearestNeighbors, kneighbors_graph
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
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
from torch_geometric.data import Data
from torch_geometric.nn import GCNConv

import scanpy as sc
import anndata as ad
import matplotlib.pyplot as plt
import seaborn as sns


# ==============================================================================
# 1. Environment & Reproducibility Setup
# ==============================================================================

def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
    os.environ['PYTHONHASHSEED'] = str(seed)


def get_compute_device(requested_device: Optional[str] = None) -> torch.device:
    if requested_device:
        return torch.device(requested_device)
    dev = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"[Device] Using compute engine: {dev}")
    if torch.cuda.is_available():
        print(f"[GPU] Model: {torch.cuda.get_device_name(0)} | VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
    return dev


# ==============================================================================
# 2. Universal Preprocessing Engine
# ==============================================================================

def clr_normalize_each_cell(adata, inplace=True):
    def seurat_clr(x):
        s = np.sum(np.log1p(x[x > 0]))
        exp = np.exp(s / len(x)) if len(x) > 0 else 1.0
        return np.log1p(x / (exp + 1e-12))

    if not inplace:
        adata = adata.copy()

    X = adata.X.toarray() if sp.issparse(adata.X) else np.array(adata.X)
    adata.X = np.apply_along_axis(seurat_clr, 1, X)
    return adata


def tfidf(X):
    idf = X.shape[0] / (X.sum(axis=0) + 1e-12)
    if sp.issparse(X):
        tf = X.multiply(1.0 / (X.sum(axis=1) + 1e-12))
        return sp.csr_matrix(tf.multiply(idf))
    else:
        tf = X / (X.sum(axis=1, keepdims=True) + 1e-12)
        return tf * idf


def preprocess_universal(adata_RNA, adata_omics2, dataset_name: str, n_hvg: int = 3000):
    sc.pp.filter_genes(adata_RNA, min_cells=10)
    try:
        sc.pp.highly_variable_genes(adata_RNA, flavor="seurat_v3", n_top_genes=n_hvg)
    except Exception:
        sc.pp.normalize_total(adata_RNA, target_sum=1e4)
        sc.pp.log1p(adata_RNA)
        sc.pp.highly_variable_genes(adata_RNA, flavor="seurat", n_top_genes=n_hvg)

    if 'log1p' not in adata_RNA.uns:
        sc.pp.normalize_total(adata_RNA, target_sum=1e4)
        sc.pp.log1p(adata_RNA)
    sc.pp.scale(adata_RNA)

    RNA_expression = adata_RNA[:, adata_RNA.var['highly_variable']].X
    if sp.issparse(RNA_expression):
        RNA_expression = RNA_expression.toarray()

    # Second Modality Preprocessing (ADT protein or ATAC epigenomics)
    if dataset_name.startswith("10x"):
        adata_omics2 = clr_normalize_each_cell(adata_omics2)
        sc.pp.scale(adata_omics2)
        ADT_expression = adata_omics2.X.toarray() if sp.issparse(adata_omics2.X) else np.array(adata_omics2.X)
    else:
        adata_omics2.X = tfidf(adata_omics2.X)
        sc.pp.normalize_per_cell(adata_omics2, counts_per_cell_after=1e4)
        sc.pp.log1p(adata_omics2)
        n_comps = min(50, adata_omics2.shape[1])
        pca_model = PCA(n_components=n_comps, random_state=42)
        X_atac = adata_omics2.X.toarray() if sp.issparse(adata_omics2.X) else adata_omics2.X
        ADT_expression = pca_model.fit_transform(X_atac)

    return RNA_expression, ADT_expression, adata_RNA, adata_omics2


# ==============================================================================
# 3. Dual-Graph Topology & Spatial Adjacency Construction
# ==============================================================================

class DualGraphData(Data):
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


def build_dual_graph(RNA_expression, ADT_expression, cell_positions, device='cpu', num_neighbors: int = 15):
    # 1. Cosine Feature Similarity KNN Graph
    similarity_matrix = cosine_similarity(RNA_expression)
    nbrs = NearestNeighbors(n_neighbors=num_neighbors + 1, metric='cosine').fit(RNA_expression)
    _, indices = nbrs.kneighbors(RNA_expression)

    adjacency_matrix = np.zeros_like(similarity_matrix, dtype=int)
    for i in range(len(RNA_expression)):
        for j in indices[i][1:]:
            adjacency_matrix[i, j] = 1
            adjacency_matrix[j, i] = 1

    sim_edge_index = torch.tensor(np.array(np.nonzero(adjacency_matrix)), dtype=torch.long).to(device)
    sim_edge_weight = torch.tensor(similarity_matrix[adjacency_matrix > 0], dtype=torch.float).to(device)

    # 2. Spatial Distance KNN Graph
    knn_graph = kneighbors_graph(cell_positions, n_neighbors=num_neighbors, mode='distance', include_self=False)
    knn_graph = knn_graph.maximum(knn_graph.T)
    dist_edge_index = torch.tensor(np.array(knn_graph.nonzero()), dtype=torch.long).to(device)
    dist_edge_weight = torch.tensor(knn_graph.data, dtype=torch.float).to(device)

    # 3. Common Edge Pure Intersection (Consensus)
    sim_edges = set(zip(sim_edge_index[0].tolist(), sim_edge_index[1].tolist()))
    dist_edges = set(zip(dist_edge_index[0].tolist(), dist_edge_index[1].tolist()))
    common_edges = sim_edges.intersection(dist_edges)

    common_edge_index = torch.tensor(list(zip(*common_edges)), dtype=torch.long).to(device)
    common_edge_weight = torch.ones(common_edge_index.size(1), dtype=torch.float).to(device)

    x_RNA = torch.tensor(RNA_expression, dtype=torch.float).to(device)
    x_ADT = torch.tensor(ADT_expression, dtype=torch.float).to(device)

    return DualGraphData(
        x_RNA, x_ADT,
        sim_edge_index, sim_edge_weight,
        dist_edge_index, dist_edge_weight,
        common_edge_index, common_edge_weight
    )


def compute_spatial_adj_norm(dist_edge_index, num_nodes: int, device='cpu'):
    """Construct row-normalized spatial adjacency matrix for Potts MRF consensus."""
    adj = torch.sparse_coo_tensor(dist_edge_index, torch.ones(dist_edge_index.size(1), device=device), size=(num_nodes, num_nodes)).to_dense()
    adj = adj + torch.eye(num_nodes, device=device)
    deg = adj.sum(dim=1, keepdim=True)
    adj_norm = adj / (deg + 1e-12)
    return adj_norm


# ==============================================================================
# 4. Neural Architecture & Gated Attention Fusion Modules
# ==============================================================================

class GatedAttentionFusion(nn.Module):
    """
    Spot-Adaptive Gated Attention Fusion Module.
    Computes a learned, per-spot, feature-wise attention gate g in (0, 1)^d:
        g = Sigmoid(W_g [z1 || z2] + b_g)
        z_fused = g ⊙ z1 + (1 - g) ⊙ z2
    Followed by an output projection layer to refine the fused manifold.
    """
    def __init__(self, dim: int = 64):
        super().__init__()
        self.gate_net = nn.Sequential(
            nn.Linear(2 * dim, dim),
            nn.Sigmoid()
        )
        self.out_proj = nn.Linear(dim, dim)

    def forward(self, z1: torch.Tensor, z2: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        combined = torch.cat([z1, z2], dim=1)
        gate = self.gate_net(combined)
        fused = gate * z1 + (1.0 - gate) * z2
        fused = self.out_proj(fused)
        return fused, gate


class SpatialPottsDEC(nn.Module):
    """
    Spatial Potts Markov Random Field Consensus Deep Embedding Clustering (DEC).
    Smooths target distribution P using spatial neighborhood consensus to suppress salt-and-pepper noise
    while preserving transcriptomic cluster boundaries.
    """
    def __init__(self, num_clusters: int, latent_dim: int = 64, alpha: float = 1.0, lambda_spatial: float = 0.15):
        super().__init__()
        self.num_clusters = num_clusters
        self.latent_dim = latent_dim
        self.alpha = alpha
        self.lambda_spatial = lambda_spatial
        self.cluster_centers = nn.Parameter(torch.Tensor(num_clusters, latent_dim))
        nn.init.xavier_uniform_(self.cluster_centers)

    def compute_q(self, z: torch.Tensor) -> torch.Tensor:
        dist = torch.sum((z.unsqueeze(1) - self.cluster_centers.unsqueeze(0)) ** 2, dim=2)
        q = 1.0 / (1.0 + dist / self.alpha)
        q = q ** ((self.alpha + 1.0) / 2.0)
        q = q / (torch.sum(q, dim=1, keepdim=True) + 1e-12)
        return q

    def compute_spatial_target_p(self, q: torch.Tensor, spatial_adj_norm: torch.Tensor) -> torch.Tensor:
        weight = q ** 2 / (torch.sum(q, dim=0, keepdim=True) + 1e-12)
        p_dec = weight / (torch.sum(weight, dim=1, keepdim=True) + 1e-12)

        # Spatial Potts neighborhood consensus
        spatial_consensus = torch.mm(spatial_adj_norm, q)

        # Potts modulated target
        p_spatial = p_dec * torch.exp(self.lambda_spatial * spatial_consensus)
        p_final = p_spatial / (torch.sum(p_spatial, dim=1, keepdim=True) + 1e-12)
        return p_final

    def forward(self, z: torch.Tensor, p_target: Optional[torch.Tensor] = None):
        q = self.compute_q(z)
        if p_target is not None:
            kl_loss = F.kl_div(q.log(), p_target, reduction='batchmean')
        else:
            kl_loss = torch.tensor(0.0, device=z.device)
        return q, kl_loss


class DualGCN_Gated(nn.Module):
    def __init__(self, in_channels, hidden_channels, out_channels, q_dim, dropout=0.0):
        super(DualGCN_Gated, self).__init__()
        self.x_RNA1 = GCNConv(in_channels, hidden_channels)
        self.x_RNA2 = GCNConv(in_channels, hidden_channels)
        self.protein3 = GCNConv(q_dim, out_channels)

        self.sim_conv = GCNConv(hidden_channels, out_channels)
        self.dist_conv = GCNConv(hidden_channels, out_channels)

        # Spot-Adaptive Gated Attention Fusion Modules
        self.fusion_layer1 = GatedAttentionFusion(dim=out_channels)
        self.fusion_layer2 = GatedAttentionFusion(dim=out_channels)

        # Decoupled Multi-Task Decoders
        self.dropout = dropout
        self.deconv1 = nn.Linear(out_channels, hidden_channels)
        self.deconv2 = nn.Linear(hidden_channels, in_channels)
        self.deconv4 = nn.Linear(hidden_channels, q_dim)
        self.deconv5 = nn.Linear(hidden_channels, in_channels + q_dim)

    def forward(self, x_RNA, x_ADT, sim_edge_index, sim_edge_weight,
                dist_edge_index, dist_edge_weight, common_edge_index, common_edge_weight):
        xs = F.relu(self.x_RNA1(x_RNA, sim_edge_index, sim_edge_weight))
        xs = F.dropout(xs, self.dropout, training=self.training)

        xd = F.relu(self.x_RNA2(x_RNA, dist_edge_index, dist_edge_weight))
        xd = F.dropout(xd, self.dropout, training=self.training)

        x_sim = self.sim_conv(xs, sim_edge_index, sim_edge_weight)
        x_dist = self.dist_conv(xd, dist_edge_index, dist_edge_weight)
        pro = self.protein3(x_ADT, common_edge_index, common_edge_weight)

        # Dynamic Gated Fusion
        fused, gate_spatial = self.fusion_layer1(x_sim, x_dist)
        fused_pro, gate_modality = self.fusion_layer2(fused, pro)
        return x_sim, x_dist, fused, fused_pro, pro, gate_spatial, gate_modality

    def reconstruct_joint(self, z):
        return self.deconv5(F.relu(self.deconv1(z)))

    def reconstruct_rna(self, z):
        return self.deconv2(F.relu(self.deconv1(z)))

    def reconstruct_aux(self, z):
        return self.deconv4(F.relu(self.deconv1(z)))


class ASTRA_v1_DEC_Gated(nn.Module):
    def __init__(self, in_channels, hidden_channels, out_channels, q_dim, num_clusters,
                 beta=25.0, gamma=10.0, delta=1.0, lambda_dec=1.0, lambda_spatial=0.15, dropout=0.0):
        super(ASTRA_v1_DEC_Gated, self).__init__()
        self.gcn = DualGCN_Gated(in_channels, hidden_channels, out_channels, q_dim, dropout=dropout)
        self.dec = SpatialPottsDEC(num_clusters=num_clusters, latent_dim=out_channels, lambda_spatial=lambda_spatial)
        self.beta = beta
        self.gamma = gamma
        self.delta = delta
        self.lambda_dec = lambda_dec
        self.l1_lambda = 1e-4
        self.l2_lambda = 1e-3

    def init_cluster_centers(self, centers_numpy):
        self.dec.cluster_centers.data.copy_(torch.tensor(centers_numpy, dtype=torch.float32, device=self.dec.cluster_centers.device))

    def forward(self, data, compute_dec=False, p_target=None):
        x_sim, x_dist, fused, fused_pro, pro, gate_sp, gate_mod = self.gcn(
            data.x_RNA, data.x_ADT,
            data.sim_edge_index, data.sim_edge_weight,
            data.dist_edge_index, data.dist_edge_weight,
            data.common_edge_index, data.common_edge_weight
        )
        if compute_dec:
            q, kl_loss = self.dec(fused_pro, p_target)
            return x_sim, x_dist, fused, fused_pro, pro, q, kl_loss, gate_sp, gate_mod
        return x_sim, x_dist, fused, fused_pro, pro, gate_sp, gate_mod

    def cosine_similarity(self, emb):
        mat = torch.matmul(emb, emb.T)
        norm = torch.norm(emb, p=2, dim=1).reshape((emb.shape[0], 1))
        mat = torch.div(mat, torch.matmul(norm, norm.T) + 1e-12)
        mat = torch.where(torch.isnan(mat), torch.zeros_like(mat), mat)
        mat = mat - torch.diag_embed(torch.diag(mat))
        return mat

    def spatial_regularization_loss(self, emb, dist_edge_index, dist_edge_weight):
        num_nodes = emb.size(0)
        graph_nei = torch.sparse_coo_tensor(
            dist_edge_index,
            torch.ones_like(dist_edge_weight),
            size=(num_nodes, num_nodes)
        ).to_dense()
        graph_neg = 1.0 - graph_nei
        sim_mat = torch.sigmoid(self.cosine_similarity(emb))
        neigh_loss = torch.mul(graph_nei, torch.log(sim_mat + 1e-10)).mean()
        neg_loss = torch.mul(graph_neg, torch.log(1.0 - sim_mat + 1e-10)).mean()
        return -(neigh_loss + neg_loss) / 2.0

    def compute_losses(self, data, sim_z, dist_z, fused_z, fused_pro, pro, kl_loss=None, stage=1):
        combined_raw = torch.cat([data.x_RNA, data.x_ADT], dim=1)
        l_rec = F.mse_loss(combined_raw, self.gcn.reconstruct_joint(fused_pro))
        l_sim = F.mse_loss(data.x_RNA, self.gcn.reconstruct_rna(sim_z))
        l_dist = F.mse_loss(data.x_RNA, self.gcn.reconstruct_rna(dist_z))
        l_aux = F.mse_loss(data.x_ADT, self.gcn.reconstruct_aux(pro))

        l_spatial = self.spatial_regularization_loss(fused_z, data.dist_edge_index, data.dist_edge_weight)

        l1_reg = sum(torch.sum(torch.abs(p)) for p in self.parameters())
        l2_reg = sum(torch.sum(p ** 2) for p in self.parameters())
        reg_loss = self.l1_lambda * l1_reg + self.l2_lambda * l2_reg

        # In Stage 2, moderate reconstruction weight so DEC KL divergence actively sharpens clusters
        beta_curr = self.beta if stage == 1 else (self.beta * 0.2)
        l_rec_term = beta_curr * (l_rec + l_sim + l_dist + l_aux)
        l_spatial_term = self.gamma * l_spatial
        l_reg_term = self.delta * reg_loss

        total_loss = l_rec_term + l_spatial_term + l_reg_term
        kl_val = 0.0
        if stage == 2 and kl_loss is not None:
            kl_val = kl_loss.item() if isinstance(kl_loss, torch.Tensor) else float(kl_loss)
            total_loss = total_loss + self.lambda_dec * kl_loss

        return total_loss, l_rec_term, l_spatial_term, l_reg_term, kl_val


# ==============================================================================
# 5. Clustering & Two-Stage Training Engine
# ==============================================================================

def cluster_embeddings(embeddings, num_clusters: int, method: str = 'kmeans', random_seed: int = 42):
    return KMeans(n_clusters=num_clusters, n_init=10, random_state=random_seed).fit_predict(embeddings)


def evaluate_clustering(embeddings: np.ndarray, labels: np.ndarray, gt_labels: Optional[np.ndarray] = None) -> Dict[str, float]:
    """Calculate all standard clustering metrics on final representations."""
    metrics = {}
    try:
        metrics['Silhouette'] = float(silhouette_score(embeddings, labels))
    except Exception:
        metrics['Silhouette'] = 0.0

    try:
        metrics['CHI'] = float(calinski_harabasz_score(embeddings, labels))
    except Exception:
        metrics['CHI'] = 0.0

    try:
        metrics['DBI'] = float(davies_bouldin_score(embeddings, labels))
    except Exception:
        metrics['DBI'] = 0.0

    if gt_labels is not None:
        try:
            metrics['ARI'] = float(adjusted_rand_score(gt_labels, labels))
            metrics['NMI'] = float(normalized_mutual_info_score(gt_labels, labels))
            metrics['AMI'] = float(adjusted_mutual_info_score(gt_labels, labels))
            metrics['Homogeneity'] = float(homogeneity_score(gt_labels, labels))
            metrics['V-measure'] = float(v_measure_score(gt_labels, labels))
            metrics['FMI'] = float(fowlkes_mallows_score(gt_labels, labels))
        except Exception as e:
            print(f"[Warning] Error computing supervised metrics: {e}")
            metrics['ARI'] = 0.0
            metrics['NMI'] = 0.0
            metrics['AMI'] = 0.0
            metrics['Homogeneity'] = 0.0
            metrics['V-measure'] = 0.0
            metrics['FMI'] = 0.0
    else:
        metrics['ARI'] = 0.0
        metrics['NMI'] = 0.0
        metrics['AMI'] = 0.0
        metrics['Homogeneity'] = 0.0
        metrics['V-measure'] = 0.0
        metrics['FMI'] = 0.0

    return metrics


def train_model_dec(
    model: ASTRA_v1_DEC_Gated,
    data: DualGraphData,
    spatial_adj_norm: torch.Tensor,
    gt_labels: Optional[np.ndarray] = None,
    pretrain_epochs: int = 250,
    finetune_epochs: int = 150,
    lr: float = 1e-3,
    num_clusters: int = 10,
    tool: str = 'kmeans',
    seed: int = 42,
    p_update_interval: int = 5
):
    optimizer_stage1 = torch.optim.Adam(model.parameters(), lr=lr)

    loss_history = []
    recon_loss_history = []
    spatial_loss_history = []
    reg_loss_history = []
    kl_loss_history = []
    epoch_sil_history = []
    epoch_ari_history = []
    epoch_nmi_history = []

    print(f"\n{'='*75}\n[Stage 1/2] Gated Fusion Pre-training ({pretrain_epochs} Epochs)\n{'='*75}")
    for epoch in range(pretrain_epochs):
        model.train()
        optimizer_stage1.zero_grad()
        sim_z, dist_z, fused_z, fused_pro, pro, g_sp, g_mod = model(data, compute_dec=False)

        loss, l_rec_val, l_sp_val, l_reg_val, kl_val = model.compute_losses(data, sim_z, dist_z, fused_z, fused_pro, pro, stage=1)
        loss.backward()
        optimizer_stage1.step()

        model.eval()
        with torch.no_grad():
            sim_z_eval, dist_z_eval, fused_z_eval, fused_pro_eval, pro_eval, g_sp_eval, g_mod_eval = model(data, compute_dec=False)
            epoch_emb = fused_pro_eval.cpu().numpy()

        epoch_labels = cluster_embeddings(epoch_emb, num_clusters, method=tool, random_seed=seed)
        try:
            sil = float(silhouette_score(epoch_emb, epoch_labels))
        except Exception:
            sil = 0.0

        ari = 0.0
        nmi = 0.0
        if gt_labels is not None:
            ari = float(adjusted_rand_score(gt_labels, epoch_labels))
            nmi = float(normalized_mutual_info_score(gt_labels, epoch_labels))

        loss_history.append(loss.item())
        recon_loss_history.append(l_rec_val.item())
        spatial_loss_history.append(l_sp_val.item())
        reg_loss_history.append(l_reg_val.item())
        kl_loss_history.append(0.0)
        epoch_sil_history.append(sil)
        epoch_ari_history.append(ari)
        epoch_nmi_history.append(nmi)

        if (epoch + 1) % 25 == 0 or epoch == 0 or (epoch + 1) == pretrain_epochs:
            print(f"Pretrain Ep {epoch+1:3d}/{pretrain_epochs} | Tot: {loss.item():.4f} | Rec: {l_rec_val.item():.4f} | Spat: {l_sp_val.item():.4f} | Sil: {sil:.4f} | ARI: {ari:.4f}")

    # Initialize DEC Prototypes
    model.eval()
    with torch.no_grad():
        _, _, _, fused_pro_best, _, _, _ = model(data, compute_dec=False)
        best_emb_aligned = fused_pro_best.cpu().numpy()

    kmeans_init = KMeans(n_clusters=num_clusters, n_init=20, random_state=seed)
    kmeans_init.fit(best_emb_aligned)
    model.init_cluster_centers(kmeans_init.cluster_centers_)
    print("DEC Cluster Prototypes successfully initialized in aligned latent space!")

    lr_stage2 = lr * 0.1
    optimizer_stage2 = torch.optim.Adam(model.parameters(), lr=lr_stage2)
    p_target = None

    print(f"\n{'='*75}\n[Stage 2/2] Gated Spatial Potts Consensus DEC Fine-Tuning ({finetune_epochs} Epochs | lr={lr_stage2:.1e})\n{'='*75}")
    for epoch in range(finetune_epochs):
        curr_epoch = pretrain_epochs + epoch + 1
        model.train()

        if epoch % p_update_interval == 0 or p_target is None:
            with torch.no_grad():
                _, _, _, f_pro_curr, _, _, _ = model(data, compute_dec=False)
                q_curr = model.dec.compute_q(f_pro_curr)
                p_target = model.dec.compute_spatial_target_p(q_curr, spatial_adj_norm)

        optimizer_stage2.zero_grad()
        sim_z, dist_z, fused_z, fused_pro, pro, q, kl_loss, g_sp, g_mod = model(data, compute_dec=True, p_target=p_target)

        loss, l_rec_val, l_sp_val, l_reg_val, kl_val = model.compute_losses(data, sim_z, dist_z, fused_z, fused_pro, pro, kl_loss=kl_loss, stage=2)
        loss.backward()
        optimizer_stage2.step()

        model.eval()
        with torch.no_grad():
            sim_z_eval, dist_z_eval, fused_z_eval, fused_pro_eval, pro_eval, g_sp_eval, g_mod_eval = model(data, compute_dec=False)
            q_eval = model.dec.compute_q(fused_pro_eval)
            epoch_emb = fused_pro_eval.cpu().numpy()
            preds_q = q_eval.argmax(dim=1).cpu().numpy()

        n_unique_q = len(np.unique(preds_q))
        if n_unique_q >= 2:
            try:
                sil_q = float(silhouette_score(epoch_emb, preds_q))
            except Exception:
                sil_q = -1.0
        else:
            sil_q = -1.0

        try:
            km_preds = KMeans(n_clusters=num_clusters, n_init=5, random_state=seed).fit_predict(epoch_emb)
            sil_km = float(silhouette_score(epoch_emb, km_preds))
        except Exception:
            sil_km = -1.0

        if sil_q >= sil_km and n_unique_q >= 2:
            sil = sil_q
            epoch_labels = preds_q
        else:
            sil = sil_km
            epoch_labels = km_preds

        ari = 0.0
        nmi = 0.0
        if gt_labels is not None:
            ari = float(adjusted_rand_score(gt_labels, epoch_labels))
            nmi = float(normalized_mutual_info_score(gt_labels, epoch_labels))

        loss_history.append(loss.item())
        recon_loss_history.append(l_rec_val.item())
        spatial_loss_history.append(l_sp_val.item())
        reg_loss_history.append(l_reg_val.item())
        kl_loss_history.append(kl_val)
        epoch_sil_history.append(sil)
        epoch_ari_history.append(ari)
        epoch_nmi_history.append(nmi)

        if (epoch + 1) % 25 == 0 or epoch == 0 or (epoch + 1) == finetune_epochs:
            print(f"DEC Ep {epoch+1:3d}/{finetune_epochs} (Total {curr_epoch:3d}) | Tot: {loss.item():.4f} | Rec: {l_rec_val.item():.4f} | Spat: {l_sp_val.item():.4f} | KL: {kl_val:.4f} | Sil: {sil:.4f} | ARI: {ari:.4f}")

    # Final representations from last epoch
    final_embeddings = epoch_emb.copy()
    final_labels = epoch_labels.copy()

    total_epochs = pretrain_epochs + finetune_epochs
    training_results = {
        'total_epochs': total_epochs,
        'loss_history': loss_history,
        'recon_loss_history': recon_loss_history,
        'spatial_loss_history': spatial_loss_history,
        'reg_loss_history': reg_loss_history,
        'kl_loss_history': kl_loss_history,
        'epoch_sil_history': epoch_sil_history,
        'epoch_ari_history': epoch_ari_history,
        'epoch_nmi_history': epoch_nmi_history,
    }

    return final_embeddings, final_labels, training_results


# ==============================================================================
# 6. Visualizations & Standard Plotting
# ==============================================================================

def plot_training_curves(training_results: dict, dataset_name="Dataset", save_path=None, show=False):
    epochs_range = range(1, len(training_results['loss_history']) + 1)
    has_ari = len(training_results.get('epoch_ari_history', [])) > 0

    fig, axes = plt.subplots(1, 3 if has_ari else 2, figsize=(18 if has_ari else 12, 4.5), dpi=150)
    if not isinstance(axes, (list, np.ndarray)):
        axes = [axes]

    # 1. Loss Decomposition Curves
    axes[0].plot(epochs_range, training_results['loss_history'], color='#1f77b4', linewidth=2.5, label='Total Loss')
    axes[0].plot(epochs_range, training_results['recon_loss_history'], color='#3b82f6', linewidth=1.5, linestyle='--', label='Recon Loss')
    axes[0].plot(epochs_range, training_results['spatial_loss_history'], color='#10b981', linewidth=1.5, linestyle='-.', label='Spatial Loss')
    axes[0].plot(epochs_range, training_results['reg_loss_history'], color='#f59e0b', linewidth=1.2, linestyle=':', label='Reg Loss')
    if any(k > 0 for k in training_results.get('kl_loss_history', [])):
        axes[0].plot(epochs_range, training_results['kl_loss_history'], color='#ec4899', linewidth=1.2, label='KL Loss')

    axes[0].set_title(f'Loss Curves - {dataset_name}', fontsize=12, fontweight='bold', pad=10)
    axes[0].set_xlabel('Epoch', fontsize=11)
    axes[0].set_ylabel('Loss Value', fontsize=11)
    axes[0].grid(True, linestyle='--', alpha=0.5)
    axes[0].legend(frameon=True, fontsize='small', loc='upper right')

    # 2. Silhouette Score Curve
    final_sil = training_results['epoch_sil_history'][-1] if training_results['epoch_sil_history'] else 0.0
    axes[1].plot(epochs_range, training_results['epoch_sil_history'], color='#2ca02c', linewidth=2.0, label='Silhouette Score')
    axes[1].scatter([len(epochs_range)], [final_sil], color='#2ca02c', s=40, zorder=5, label=f'Final Sil: {final_sil:.4f}')
    axes[1].set_title(f'Silhouette Score Curve - {dataset_name}', fontsize=12, fontweight='bold', pad=10)
    axes[1].set_xlabel('Epoch', fontsize=11)
    axes[1].set_ylabel('Silhouette Score', fontsize=11)
    axes[1].grid(True, linestyle='--', alpha=0.5)
    axes[1].legend(frameon=True, loc='lower right')

    # 3. ARI Curve
    if has_ari:
        final_ari = training_results['epoch_ari_history'][-1] if training_results['epoch_ari_history'] else 0.0
        axes[2].plot(epochs_range, training_results['epoch_ari_history'], color='#ff7f0e', linewidth=2.0, label='Epoch ARI')
        axes[2].scatter([len(epochs_range)], [final_ari], color='#ff7f0e', s=40, zorder=5, label=f'Final ARI: {final_ari:.4f}')
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
    final_embeddings,
    final_labels,
    sil: float,
    ari: float,
    training_results: dict,
    dataset_name="Dataset",
    seed=42,
    true_labels=None,
    output_dir="results",
    show=False
):
    plots_dir = os.path.join(output_dir, "plots")
    os.makedirs(os.path.join(plots_dir, "curves"), exist_ok=True)
    os.makedirs(os.path.join(plots_dir, "spatial"), exist_ok=True)
    os.makedirs(os.path.join(plots_dir, "umap"), exist_ok=True)
    os.makedirs(os.path.join(plots_dir, "violin"), exist_ok=True)

    if true_labels is not None:
        adata_RNA.obs['ground_truth'] = pd.Categorical(true_labels)
    elif 'ground_truth' not in adata_RNA.obs:
        adata_RNA.obs['ground_truth'] = pd.Categorical(final_labels.astype(str))

    adata_RNA.obsm['ASTRA_Emb'] = final_embeddings
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
        axes[1].set_title(f'ASTRA Domains (ARI: {ari:.4f})', fontsize=12, fontweight='bold')
        axes[1].set_xlabel('Spatial X')
        axes[1].set_ylabel('Spatial Y')

        plt.suptitle(f"Spatial Domains Comparison - {dataset_name} (Seed {seed})", fontsize=14, fontweight='bold', y=1.02)
        plt.tight_layout()
        plt.savefig(os.path.join(plots_dir, "spatial", f"{dataset_name}_seed{seed}_spatial.png"), dpi=300, bbox_inches='tight')
        if show: plt.show()
        else: plt.close()

    # 3. UMAP Joint Representation
    sc.pp.neighbors(adata_RNA, use_rep='ASTRA_Emb')
    sc.tl.umap(adata_RNA)
    fig, axes = plt.subplots(1, 2, figsize=(15, 6))
    sc.pl.umap(adata_RNA, color='ground_truth', ax=axes[0], show=False, title='UMAP: Ground Truth Annotation')
    sc.pl.umap(adata_RNA, color='predicted_domain', ax=axes[1], show=False, title=f'UMAP: Predicted Domains (Sil: {sil:.4f})')
    plt.suptitle(f"UMAP Joint Representation - {dataset_name} (Seed {seed})", fontsize=14, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.savefig(os.path.join(plots_dir, "umap", f"{dataset_name}_seed{seed}_umap.png"), dpi=300, bbox_inches='tight')
    if show: plt.show()
    else: plt.close()

    # 4. Violin Plots: Silhouette & Latent profiles
    try:
        sample_sil_values = silhouette_samples(final_embeddings, final_labels)
        adata_RNA.obs['silhouette_coefficient'] = sample_sil_values
        adata_RNA.obs['Latent_Dim_1'] = final_embeddings[:, 0]
        fig, axes = plt.subplots(1, 2, figsize=(16, 5.5))
        sns.violinplot(data=adata_RNA.obs, x='predicted_domain', y='silhouette_coefficient', palette='Set2', inner='quartile', ax=axes[0])
        axes[0].axhline(sil, color='red', linestyle='--', label=f'Mean Sil: {sil:.4f}')
        axes[0].set_title("Silhouette Coefficient per Predicted Domain", fontsize=12, fontweight='bold')
        sns.violinplot(data=adata_RNA.obs, x='predicted_domain', y='Latent_Dim_1', palette='tab10', inner='box', ax=axes[1])
        axes[1].set_title("Latent Dimension 1 Distribution per Domain", fontsize=12, fontweight='bold')
        plt.suptitle(f"Violin Plots: Cluster Profiles - {dataset_name} (Seed {seed})", fontsize=14, fontweight='bold', y=1.02)
        plt.tight_layout()
        plt.savefig(os.path.join(plots_dir, "violin", f"{dataset_name}_seed{seed}_violin.png"), dpi=300, bbox_inches='tight')
        if show: plt.show()
        else: plt.close()
    except Exception as e:
        print(f"Skipping Violin plots due to error: {e}")


# ==============================================================================
# 7. Standardized Dashboard Result Exporter & Live API Pusher
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
    spatial_hist = training_results.get("spatial_loss_history", [])
    reg_hist = training_results.get("reg_loss_history", [])
    kl_hist = training_results.get("kl_loss_history", [])
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
                "kl_loss": float(kl_hist[ep]) if ep < len(kl_hist) else 0.0,
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

    # 2. Local JSON Files Save
    with open(os.path.join(exp_dir, "metrics.json"), "w") as f:
        json.dump({
            "model_id": model_id,
            "dataset": dataset_name,
            "seed": int(seed),
            "final_epoch": int(training_results.get("total_epochs", 0)),
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
                "bestEpoch": int(training_results.get("total_epochs", 0)),
                "bestScore": float(metrics_dict.get("Silhouette", 0.0)),
                "finalMetrics": safe_metrics,
                "history": safe_history,
                "embeddingsData": safe_embeddings,
                "modelMetadata": {
                    "architecture": "Spot-Adaptive Gated Attention Fusion + Spatial Potts DEC",
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
# 8. Dataset Resolver
# ==============================================================================

CHOICES = [
    ("10x_human_lymph_node_A1", "https://drive.google.com/drive/folders/10z1N4MwW8Y49o8GlkYGBKVx1N7fiMuyC"),
    ("10x_human_lymph_node_D1", "https://drive.google.com/drive/folders/1-g_Ca2XMaMXF-MisuVY-wobWDX86O6zz"),
    ("Mouse_Brain_E11_S1", "https://drive.google.com/drive/folders/1zRwDJrYnks0LRzlAVRqPU7jE_OcStgPo"),
    ("Mouse_Brain_E13_S1", "https://drive.google.com/drive/folders/1GOufwIRjjfcd9Bi2GKtebzKoPCg2jVud"),
    ("Mouse_Brain_E15_S1", "https://drive.google.com/drive/folders/1rHkTL5OF5qPsEERypRGMS51SjUQ69tdD"),
    ("Mouse_Brain_E18_S1", "https://drive.google.com/drive/folders/1Xj1LNIAY93biS6JIMKNRODn5GvtCKADB"),
]

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
        os.system(f'gdown --folder "{folder_url}" --output "{base_dir}"')

    rna_path = os.path.join(base_dir, "adata_RNA.h5ad")
    if dataset_name.startswith("10x"):
        aux_path = os.path.join(base_dir, "adata_ADT.h5ad")
        anno_path = os.path.join(base_dir, "annotation.csv")
        gt_col = "manual-anno"
    else:
        aux_path = os.path.join(base_dir, "adata_ATAC.h5ad")
        anno_path = os.path.join(base_dir, "anno.csv")
        gt_col = "cluster"

    if not (os.path.exists(rna_path) and os.path.exists(aux_path) and os.path.exists(anno_path)):
        print(f"Re-downloading {dataset_name}...")
        os.system(f'gdown --folder "{folder_url}" --output "{base_dir}"')

    return rna_path, aux_path, anno_path, gt_col


# ==============================================================================
# 9. CLI and Experiment Execution
# ==============================================================================

def run_experiment(
    datasets: Union[str, int, List[Union[str, int]]] = "all",
    seeds: Optional[List[int]] = None,
    n_seeds: Optional[int] = None,
    pretrain_epochs: int = 250,
    finetune_epochs: int = 150,
    lr: float = 1e-3,
    beta: float = 25.0,
    gamma: float = 10.0,
    delta: float = 1.0,
    lambda_dec: float = 1.0,
    lambda_spatial: float = 0.15,
    hidden_dim: int = 512,
    out_dim: int = 64,
    dropout: float = 0.0,
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
        if n_seeds is not None and n_seeds > 0:
            default_candidates = [42, 2024, 1234, 7, 999, 100, 314, 555]
            seeds = default_candidates[:n_seeds]
        else:
            seeds = [42, 2024]

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

    total_runs = len(dataset_names) * len(seeds)
    print("\n" + "=" * 80)
    print(f"=========== 🚀 STARTING ASTRA (Gated GCN + Potts DEC) EXPERIMENT ============")
    print("=" * 80)
    print(f"• Datasets     : {dataset_names}")
    print(f"• Seeds ({len(seeds)})   : {seeds}")
    print(f"• Epochs       : Pretrain={pretrain_epochs}, Finetune={finetune_epochs} | LR={lr}")
    print(f"• Loss Weights : Beta={beta}, Gamma={gamma}, Delta={delta}, LambdaDEC={lambda_dec}")
    print(f"• Dimensions   : Hidden={hidden_dim}, Out={out_dim} | Device: {dev}")
    print("=" * 80 + "\n")

    all_summary = []

    for d_idx, dataset_name in enumerate(dataset_names, 1):
        folder_url = next((c[1] for c in CHOICES if c[0] == dataset_name), None)
        if not folder_url:
            print(f"Dataset {dataset_name} not found in CHOICES. Skipping.")
            continue

        print("\n" + "#" * 80)
        print(f"####################### DATASET: {dataset_name} #######################")
        print("#" * 80)

        rna_path, aux_path, anno_path, gt_col = resolve_dataset_files(dataset_name, folder_url, data_dir=data_dir)
        adata_RNA = sc.read_h5ad(rna_path)
        adata_aux = sc.read_h5ad(aux_path)
        anno_df = pd.read_csv(anno_path, index_col=0)

        gt_values = anno_df[gt_col] if isinstance(anno_df[gt_col], pd.Series) else anno_df[gt_col].iloc[:, 0]
        adata_RNA.obs['ground_truth'] = gt_values.values
        adata_aux.obs['ground_truth'] = gt_values.values

        RNA_data, ADT_data, adata_RNA, adata_aux = preprocess_universal(adata_RNA, adata_aux, dataset_name)
        cell_positions = adata_RNA.obsm['spatial']
        graph_data = build_dual_graph(RNA_data, ADT_data, cell_positions, device=dev)
        spatial_adj_norm = compute_spatial_adj_norm(graph_data.dist_edge_index, RNA_data.shape[0], device=dev)
        n_clusters = int(adata_RNA.obs['ground_truth'].dropna().nunique())

        for s_idx, seed in enumerate(seeds, 1):
            run_num = (d_idx - 1) * len(seeds) + s_idx
            print(f"\n[{run_num}/{total_runs}] Running ASTRA on {dataset_name} (Seed {seed})...")
            set_seed(seed)

            model = ASTRA_v1_DEC_Gated(
                in_channels=RNA_data.shape[1],
                hidden_channels=hidden_dim,
                out_channels=out_dim,
                q_dim=ADT_data.shape[1],
                num_clusters=n_clusters,
                beta=beta,
                gamma=gamma,
                delta=delta,
                lambda_dec=lambda_dec,
                lambda_spatial=lambda_spatial,
                dropout=dropout
            ).to(dev)

            gt_labels_array = adata_RNA.obs['ground_truth'].astype(str).values
            start_time = time.time()

            final_emb, final_labels, training_results = train_model_dec(
                model=model,
                data=graph_data,
                spatial_adj_norm=spatial_adj_norm,
                gt_labels=gt_labels_array,
                pretrain_epochs=pretrain_epochs,
                finetune_epochs=finetune_epochs,
                lr=lr,
                num_clusters=n_clusters,
                tool='kmeans',
                seed=seed
            )
            duration = time.time() - start_time

            metrics = evaluate_clustering(final_emb, final_labels, gt_labels_array)
            print(f"✨ Evaluation Results (Final Epoch):")
            print(f"  • ARI        : {metrics.get('ARI', 0.0):.4f}")
            print(f"  • Silhouette : {metrics.get('Silhouette', 0.0):.4f}")
            print(f"  • NMI        : {metrics.get('NMI', 0.0):.4f}")
            print(f"  • AMI        : {metrics.get('AMI', 0.0):.4f}")
            print(f"  • Homogeneity: {metrics.get('Homogeneity', 0.0):.4f}")
            print(f"  • Duration   : {duration:.2f}s")

            if visualize:
                plot_all_visualizations(
                    adata_RNA=adata_RNA,
                    final_embeddings=final_emb,
                    final_labels=final_labels,
                    sil=metrics.get('Silhouette', 0.0),
                    ari=metrics.get('ARI', 0.0),
                    training_results=training_results,
                    dataset_name=dataset_name,
                    seed=seed,
                    true_labels=gt_labels_array,
                    output_dir=output_dir,
                    show=show_plots
                )

            # Compute UMAP coordinates (100% full spots)
            umap_coords = sc.pp.neighbors(adata_RNA, use_rep='ASTRA_Emb', copy=True)
            sc.tl.umap(umap_coords)
            umap_2d = umap_coords.obsm['X_umap']

            embeddings_data = {
                "umapCoordinates": umap_2d.tolist(),
                "spatialCoordinates": cell_positions.tolist(),
                "predictedLabels": final_labels.tolist(),
                "groundTruthLabels": gt_labels_array.tolist(),
                "sampleSilhouettes": silhouette_samples(final_emb, final_labels).tolist() if len(np.unique(final_labels)) > 1 else [],
            }

            hyperparameters = {
                "pretrain_epochs": pretrain_epochs,
                "finetune_epochs": finetune_epochs,
                "lr": lr,
                "beta": beta,
                "gamma": gamma,
                "delta": delta,
                "lambda_dec": lambda_dec,
                "lambda_spatial": lambda_spatial,
                "hidden_dim": hidden_dim,
                "out_dim": out_dim,
                "dropout": dropout,
            }

            export_dashboard_experiment(
                model_id="ASTRA",
                model_name="ASTRA",
                dataset_name=dataset_name,
                seed=seed,
                metrics_dict=metrics,
                training_results=training_results,
                hyperparameters=hyperparameters,
                embeddings_data=embeddings_data,
                output_dir=output_dir,
                api_url=api_url
            )

            res_row = {
                'dataset': dataset_name,
                'seed': seed,
                'ARI': metrics.get('ARI', 0.0),
                'Silhouette': metrics.get('Silhouette', 0.0),
                'NMI': metrics.get('NMI', 0.0),
                'Duration_s': round(duration, 2)
            }
            all_summary.append(res_row)

    df_summary = pd.DataFrame(all_summary)
    summary_path = os.path.join(output_dir, "astra_experiments_summary.csv")
    df_summary.to_csv(summary_path, index=False)
    print("\n" + "=" * 80)
    print(f"🎉 All experiments completed! Summary CSV written to: {summary_path}")
    print("=" * 80)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="ASTRA Multi-Omics Model CLI & Dashboard Integration")
    parser.add_argument('--datasets', nargs='+', default=['10x_human_lymph_node_A1', '10x_human_lymph_node_D1'], help="Datasets to run (e.g. 10x_human_lymph_node_A1 or 'all')")
    parser.add_argument('--seeds', nargs='+', type=int, default=[42, 2024], help="Random seeds")
    parser.add_argument('--n_seeds', type=int, default=None, help="Number of seeds to run")
    parser.add_argument('--pretrain_epochs', type=int, default=250, help="Stage 1 Pre-training Epochs")
    parser.add_argument('--finetune_epochs', type=int, default=150, help="Stage 2 DEC Fine-tuning Epochs")
    parser.add_argument('--lr', type=float, default=1e-3, help="Learning rate")
    parser.add_argument('--beta', type=float, default=25.0, help="Reconstruction loss weight")
    parser.add_argument('--gamma', type=float, default=10.0, help="Spatial regularization weight")
    parser.add_argument('--delta', type=float, default=1.0, help="Weight decay regularization weight")
    parser.add_argument('--lambda_dec', type=float, default=1.0, help="DEC loss weight")
    parser.add_argument('--lambda_spatial', type=float, default=0.15, help="Spatial consensus weight")
    parser.add_argument('--hidden_dim', type=int, default=512, help="Hidden dimension")
    parser.add_argument('--out_dim', type=int, default=64, help="Embedding dimension")
    parser.add_argument('--dropout', type=float, default=0.0, help="Dropout rate")
    parser.add_argument('--device', type=str, default=None, help="Compute device ('cuda' or 'cpu')")
    parser.add_argument('--visualize', action='store_true', default=True, help="Generate and save plots")
    parser.add_argument('--show_plots', action='store_true', default=False, help="Display matplotlib interactive plots")
    parser.add_argument('--output_dir', type=str, default='results', help="Output directory for results & plots")
    parser.add_argument('--data_dir', type=str, default='data', help="Local dataset storage directory")
    parser.add_argument('--api_url', type=str, default="https://model-performance.vercel.app/api/experiments/upload", help="Dashboard API endpoint URL")

    args = parser.parse_args()

    run_experiment(
        datasets=args.datasets if args.datasets[0] != 'all' else 'all',
        seeds=args.seeds,
        n_seeds=args.n_seeds,
        pretrain_epochs=args.pretrain_epochs,
        finetune_epochs=args.finetune_epochs,
        lr=args.lr,
        beta=args.beta,
        gamma=args.gamma,
        delta=args.delta,
        lambda_dec=args.lambda_dec,
        lambda_spatial=args.lambda_spatial,
        hidden_dim=args.hidden_dim,
        out_dim=args.out_dim,
        dropout=args.dropout,
        device=args.device,
        visualize=args.visualize,
        show_plots=args.show_plots,
        output_dir=args.output_dir,
        data_dir=args.data_dir,
        api_url=args.api_url
    )
