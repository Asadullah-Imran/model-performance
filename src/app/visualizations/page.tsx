'use client';

import React, { useState, useMemo } from 'react';
import { Image as ImageIcon, MapPin, Eye, Layers, Sparkles, Split, ZoomIn, RefreshCw } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

type VisMode = 'spatial_dual' | 'umap_dual' | 'spatial_single' | 'umap_single';

// Categorical palette matching Scanpy / Spatial multi-omics standards
const CATEGORICAL_PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
  '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
];

export default function VisualizationsPage() {
  const { models, datasets, selectedDataset, resultsByModel } = useDashboard();
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [selectedSeed, setSelectedSeed] = useState<number>(42);
  const [visMode, setVisMode] = useState<VisMode>('spatial_dual');
  const [hoveredSpot, setHoveredSpot] = useState<{ idx: number; gt: string; pred: string; x: number; y: number } | null>(null);
  const [dynamicEmbeddings, setDynamicEmbeddings] = useState<any>(null);
  const [isFetchingEmb, setIsFetchingEmb] = useState<boolean>(false);

  const selectedModel = models.find(m => m.id === selectedModelId) || models[0];
  const activeDatasetObj = datasets.find(d => d.id === selectedDataset) || datasets[0];

  // Available seeds for the selected model
  const availableSeeds = useMemo(() => {
    if (!selectedModel || !resultsByModel[selectedModel.id]) return [42, 2024];
    const seeds = Object.keys(resultsByModel[selectedModel.id].seeds).map(Number);
    return seeds.length > 0 ? seeds : [42, 2024];
  }, [selectedModel, resultsByModel]);

  // Sync selectedSeed if current seed not in availableSeeds
  React.useEffect(() => {
    if (availableSeeds.length > 0 && !availableSeeds.includes(selectedSeed)) {
      setSelectedSeed(availableSeeds[0]);
    }
  }, [availableSeeds, selectedSeed]);

  // Active seed run data
  const activeRun = useMemo(() => {
    if (!selectedModel) return null;
    return (
      resultsByModel[selectedModel.id]?.seeds[selectedSeed] ||
      Object.values(resultsByModel[selectedModel.id]?.seeds || {})[0] ||
      null
    );
  }, [selectedModel, resultsByModel, selectedSeed]);

  // On-demand fetch of spot coordinates and embeddings for the selected seed
  React.useEffect(() => {
    if (!selectedModel) return;
    const targetDataset = selectedDataset === 'all' ? (activeRun?.datasetId || '10x_human_lymph_node_A1') : selectedDataset;
    
    if (activeRun?.embeddingsData?.spatialCoordinates?.length) {
      setDynamicEmbeddings(activeRun.embeddingsData);
      return;
    }

    setIsFetchingEmb(true);
    fetch(`/api/experiments/embeddings?modelId=${selectedModel.id}&datasetId=${targetDataset}&seed=${selectedSeed}`)
      .then(res => res.json())
      .then(data => {
        if (data?.embeddingsData && Object.keys(data.embeddingsData).length > 0) {
          setDynamicEmbeddings(data.embeddingsData);
        } else {
          setDynamicEmbeddings(null);
        }
      })
      .catch(err => {
        console.error('Failed to load seed embeddings:', err);
      })
      .finally(() => setIsFetchingEmb(false));
  }, [selectedModel?.id, selectedDataset, selectedSeed, activeRun]);

  const finalMetrics = activeRun?.finalMetrics || {};
  const currentAri = finalMetrics.ARI ?? finalMetrics.ari ?? 0;
  const currentSil = finalMetrics.Silhouette ?? finalMetrics.silhouette ?? 0;

  // Prepare normalized spot data for both Spatial and UMAP
  const { spatialSpots, umapSpots, gtClasses, predClasses } = useMemo(() => {
    const emb = dynamicEmbeddings || activeRun?.embeddingsData;

    const sCoords = emb?.spatialCoordinates;
    const uCoords = emb?.umapCoordinates;
    const predLabels = emb?.predictedLabels || [];
    const gtLabels = emb?.groundTruthLabels || [];

    // Map ground truth labels to distinct indices and names
    const gtMap = new Map<string, number>();
    const gtList: Array<{ id: number; name: string; color: string; count: number }> = [];
    gtLabels.forEach((l: string | number) => {
      const s = String(l);
      if (!gtMap.has(s)) {
        const id = gtMap.size;
        gtMap.set(s, id);
        gtList.push({ id, name: s, color: CATEGORICAL_PALETTE[id % CATEGORICAL_PALETTE.length], count: 0 });
      }
      const idx = gtMap.get(s)!;
      gtList[idx].count += 1;
    });

    // Map predicted cluster labels to distinct indices and names
    const predMap = new Map<string, number>();
    const predList: Array<{ id: number; name: string; color: string; count: number }> = [];
    predLabels.forEach((l: string | number) => {
      const s = String(l);
      if (!predMap.has(s)) {
        const id = predMap.size;
        predMap.set(s, id);
        predList.push({ id, name: `Domain ${s}`, color: CATEGORICAL_PALETTE[id % CATEGORICAL_PALETTE.length], count: 0 });
      }
      const idx = predMap.get(s)!;
      predList[idx].count += 1;
    });

    // Helper to normalize coordinates to SVG viewBox (360 x 300)
    const normalizeCoords = (coords: number[][]) => {
      if (!coords || coords.length === 0) return [];
      const xs = coords.map(c => c[0]);
      const ys = coords.map(c => c[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs) || 1;
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys) || 1;

      return coords.map((c, i) => {
        const normX = 20 + ((c[0] - minX) / (maxX - minX || 1)) * 320;
        // Invert Y for spatial maps so orientation matches tissue slides
        const normY = 20 + ((c[1] - minY) / (maxY - minY || 1)) * 260;
        const gtIdx = gtLabels[i] !== undefined ? gtMap.get(String(gtLabels[i])) || 0 : (i % 8);
        const predIdx = predLabels[i] !== undefined ? predMap.get(String(predLabels[i])) || 0 : (i % 8);

        return {
          idx: i,
          x: normX,
          y: normY,
          origX: c[0],
          origY: c[1],
          gtIdx,
          predIdx,
          gtName: String(gtLabels[i] ?? `Cluster ${gtIdx}`),
          predName: `Domain ${predLabels[i] ?? predIdx}`,
          gtColor: CATEGORICAL_PALETTE[gtIdx % CATEGORICAL_PALETTE.length],
          predColor: CATEGORICAL_PALETTE[predIdx % CATEGORICAL_PALETTE.length],
        };
      });
    };

    const normSpatial = sCoords && sCoords.length > 0 ? normalizeCoords(sCoords) : [];
    const normUmap = uCoords && uCoords.length > 0 ? normalizeCoords(uCoords) : [];

    // Synthetic fallback if no data uploaded yet
    if (normSpatial.length === 0) {
      const count = 240;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const r = 40 + (i % 8) * 9;
        const x = 180 + r * Math.cos(angle) + ((i * 11) % 25);
        const y = 150 + r * Math.sin(angle) + ((i * 13) % 25);
        const gtIdx = (Math.floor(x / 75) + Math.floor(y / 75)) % 6;
        const predIdx = (gtIdx + (i % 13 === 0 ? 1 : 0)) % 6;
        normSpatial.push({
          idx: i,
          x,
          y,
          origX: x,
          origY: y,
          gtIdx,
          predIdx,
          gtName: `Region ${gtIdx + 1}`,
          predName: `Domain ${predIdx}`,
          gtColor: CATEGORICAL_PALETTE[gtIdx % CATEGORICAL_PALETTE.length],
          predColor: CATEGORICAL_PALETTE[predIdx % CATEGORICAL_PALETTE.length],
        });
      }
    }

    return {
      spatialSpots: normSpatial,
      umapSpots: normUmap.length > 0 ? normUmap : normSpatial,
      gtClasses: gtList.sort((a, b) => b.count - a.count),
      predClasses: predList.sort((a, b) => a.id - b.id),
    };
  }, [activeRun]);

  const totalSpots = spatialSpots.length;
  const spotRadius = totalSpots > 3000 ? 1.8 : totalSpots > 1000 ? 2.5 : 3.5;

  if (models.length === 0 || !selectedModel) {
    return (
      <div className="p-8 rounded-3xl bg-[var(--bg-secondary)] border border-dashed border-[var(--border-color)] text-center space-y-3">
        <ImageIcon className="w-8 h-8 text-indigo-400 mx-auto" />
        <h3 className="font-heading font-bold text-base text-[var(--text-primary)]">
          No Spatial Visualizations Available
        </h3>
        <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
          Spatial domain cluster maps and UMAP embeddings will automatically appear here once you run experiments from Python.
        </p>
      </div>
    );
  }

  const isDualSpatial = visMode === 'spatial_dual';
  const isDualUmap = visMode === 'umap_dual';
  const isSpatialSingle = visMode === 'spatial_single';
  const isUmapSingle = visMode === 'umap_single';

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Model Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Model:</span>
            <select
              value={selectedModel?.id || ''}
              onChange={e => setSelectedModelId(e.target.value)}
              className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Seed Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Seed:</span>
            <select
              value={selectedSeed}
              onChange={e => setSelectedSeed(Number(e.target.value))}
              className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
            >
              {availableSeeds.map(s => (
                <option key={s} value={s}>
                  Seed {s}
                </option>
              ))}
            </select>
          </div>

          {/* Total Spot Count Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            {isFetchingEmb ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Loading coordinates...</span>
              </>
            ) : (
              <>
                <MapPin className="w-3.5 h-3.5" />
                <span>{totalSpots.toLocaleString()} Spots (100% Full Tissue)</span>
              </>
            )}
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] p-1 rounded-xl border border-[var(--border-color)]">
          <button
            onClick={() => setVisMode('spatial_dual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isDualSpatial
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Split className="w-3.5 h-3.5" />
            Spatial Domains (Side-by-Side)
          </button>
          <button
            onClick={() => setVisMode('umap_dual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isDualUmap
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            UMAP Embeddings (Side-by-Side)
          </button>
        </div>
      </div>

      {/* Main Dual Graphs Grid */}
      {(isDualSpatial || isDualUmap) && (
        <div className="space-y-4">
          {/* Main Title Banner */}
          <div className="text-center py-2">
            <h2 className="text-lg font-heading font-bold text-[var(--text-primary)]">
              {isDualSpatial
                ? `Spatial Domains Comparison - ${activeDatasetObj.name} (Seed ${selectedSeed})`
                : `UMAP Joint Representation - ${activeDatasetObj.name} (Seed ${selectedSeed})`}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {isDualSpatial
                ? 'Ground Truth biological anatomical regions (Left) vs Model predicted spatial clustering (Right)'
                : 'UMAP colored by Ground Truth annotation (Left) vs Model predicted latent domains (Right)'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Graph: Ground Truth */}
            <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-5 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-3 border-b border-[var(--border-color)]/60 pb-3">
                <div>
                  <h3 className="text-sm font-heading font-bold text-[var(--text-primary)]">
                    {isDualSpatial
                      ? `Ground Truth (${activeDatasetObj.id})`
                      : `UMAP: Ground Truth Annotation`}
                  </h3>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {gtClasses.length} Anatomical Classes
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                  Reference GT
                </span>
              </div>

              {/* Spot Canvas */}
              <div className="relative w-full aspect-[1.15] bg-[var(--bg-tertiary)]/30 rounded-xl border border-[var(--border-color)] flex items-center justify-center p-2">
                <svg viewBox="0 0 360 300" className="w-full h-full">
                  {(isDualSpatial ? spatialSpots : umapSpots).map(spot => (
                    <circle
                      key={spot.idx}
                      cx={spot.x}
                      cy={spot.y}
                      r={spotRadius}
                      fill={spot.gtColor}
                      className="transition-transform duration-100 hover:scale-[3] cursor-pointer opacity-90 hover:opacity-100 hover:stroke-white hover:stroke-[1.5]"
                      onMouseEnter={() =>
                        setHoveredSpot({
                          idx: spot.idx,
                          gt: spot.gtName,
                          pred: spot.predName,
                          x: spot.origX,
                          y: spot.origY,
                        })
                      }
                      onMouseLeave={() => setHoveredSpot(null)}
                    >
                      <title>{`Spot #${spot.idx} | ${spot.gtName}`}</title>
                    </circle>
                  ))}
                </svg>
              </div>

              {/* Bottom Ground Truth Legend Pills */}
              <div className="mt-4 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {gtClasses.map(cls => (
                  <div
                    key={cls.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[11px] font-medium border border-[var(--border-color)]"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                    <span className="text-[var(--text-primary)] truncate max-w-[120px]">{cls.name}</span>
                    <span className="text-[var(--text-muted)] font-mono text-[10px]">({cls.count})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Graph: Predicted Domains */}
            <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-5 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-3 border-b border-[var(--border-color)]/60 pb-3">
                <div>
                  <h3 className="text-sm font-heading font-bold text-[var(--text-primary)]">
                    {isDualSpatial
                      ? `${selectedModel?.name} Domains (ARI: ${currentAri.toFixed(4)})`
                      : `UMAP: Predicted Domains (Silhouette: ${currentSil.toFixed(4)})`}
                  </h3>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {predClasses.length} Predicted Clusters
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
                  {isDualSpatial ? `ARI: ${currentAri.toFixed(4)}` : `Sil: ${currentSil.toFixed(4)}`}
                </span>
              </div>

              {/* Spot Canvas */}
              <div className="relative w-full aspect-[1.15] bg-[var(--bg-tertiary)]/30 rounded-xl border border-[var(--border-color)] flex items-center justify-center p-2">
                <svg viewBox="0 0 360 300" className="w-full h-full">
                  {(isDualSpatial ? spatialSpots : umapSpots).map(spot => (
                    <circle
                      key={spot.idx}
                      cx={spot.x}
                      cy={spot.y}
                      r={spotRadius}
                      fill={spot.predColor}
                      className="transition-transform duration-100 hover:scale-[3] cursor-pointer opacity-90 hover:opacity-100 hover:stroke-white hover:stroke-[1.5]"
                      onMouseEnter={() =>
                        setHoveredSpot({
                          idx: spot.idx,
                          gt: spot.gtName,
                          pred: spot.predName,
                          x: spot.origX,
                          y: spot.origY,
                        })
                      }
                      onMouseLeave={() => setHoveredSpot(null)}
                    >
                      <title>{`Spot #${spot.idx} | ${spot.predName}`}</title>
                    </circle>
                  ))}
                </svg>
              </div>

              {/* Bottom Predicted Domains Legend Pills */}
              <div className="mt-4 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {predClasses.map(cls => (
                  <div
                    key={cls.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[11px] font-medium border border-[var(--border-color)]"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                    <span className="text-[var(--text-primary)]">{cls.name}</span>
                    <span className="text-[var(--text-muted)] font-mono text-[10px]">({cls.count})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spot Inspector Sticky Badge on Hover */}
      {hoveredSpot && (
        <div className="fixed bottom-6 right-6 z-40 bg-[var(--bg-secondary)] border border-indigo-500/40 p-3 rounded-2xl shadow-xl backdrop-blur-md text-xs space-y-1">
          <div className="font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ZoomIn className="w-3.5 h-3.5 text-indigo-400" />
            Spot #{hoveredSpot.idx}
          </div>
          <div className="text-[var(--text-muted)]">
            Ground Truth: <span className="font-semibold text-emerald-400">{hoveredSpot.gt}</span>
          </div>
          <div className="text-[var(--text-muted)]">
            Predicted: <span className="font-semibold text-indigo-400">{hoveredSpot.pred}</span>
          </div>
          <div className="font-mono text-[10px] text-slate-400">
            Coord: ({hoveredSpot.x.toFixed(1)}, {hoveredSpot.y.toFixed(1)})
          </div>
        </div>
      )}
    </div>
  );
}

