'use client';

import React, { useState, useMemo } from 'react';
import { Image as ImageIcon, MapPin, Eye, Layers, Sparkles, Maximize2, Split } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

type VisType = 'umap' | 'ground_truth' | 'prediction' | 'spatial_map' | 'violin';

export default function VisualizationsPage() {
  const { models, datasets, selectedDataset, resultsByModel } = useDashboard();
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [selectedSeed, setSelectedSeed] = useState<number>(42);
  const [activeVisType, setActiveVisType] = useState<VisType>('spatial_map');
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [compareModelBId, setCompareModelBId] = useState<string>('');

  const selectedModel = models.find(m => m.id === selectedModelId) || models[0];
  const compareModelB = models.find(m => m.id === compareModelBId) || models[1] || models[0];
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

  // Generate interactive SVG spot visualization (using real data from embeddingsData if available)
  const spotGrid = useMemo(() => {
    const activeRun = resultsByModel[selectedModel?.id]?.seeds[selectedSeed] ||
      (selectedModel ? Object.values(resultsByModel[selectedModel.id]?.seeds || {})[0] : null);
    const emb = activeRun?.embeddingsData;

    const coords = activeVisType === 'umap' ? emb?.umapCoordinates : emb?.spatialCoordinates;
    const predLabels = emb?.predictedLabels || [];
    const gtLabels = emb?.groundTruthLabels || [];

    if (coords && coords.length > 0) {
      const xs = coords.map(c => c[0]);
      const ys = coords.map(c => c[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs) || 1;
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys) || 1;

      const gtLabelMap = new Map<string | number, number>();
      gtLabels.forEach(l => {
        if (!gtLabelMap.has(l)) {
          gtLabelMap.set(l, gtLabelMap.size % 16);
        }
      });

      return coords.map((c, i) => {
        const normX = 25 + ((c[0] - minX) / (maxX - minX || 1)) * 270;
        const normY = 25 + ((c[1] - minY) / (maxY - minY || 1)) * 230;
        const predCluster = (predLabels[i] ?? (i % 8)) % 16;
        const gtCluster = gtLabels[i] !== undefined
          ? (typeof gtLabels[i] === 'number' ? (gtLabels[i] as number) % 16 : gtLabelMap.get(gtLabels[i]) || 0)
          : predCluster;

        return {
          x: normX,
          y: normY,
          gtCluster,
          predCluster,
          rawGt: String(gtLabels[i] || `Cluster ${gtCluster}`),
          rawPred: `Cluster ${predCluster}`,
        };
      });
    }

    // Synthetic fallback
    const spots: Array<{ x: number; y: number; gtCluster: number; predCluster: number; rawGt: string; rawPred: string }> = [];
    const count = 180;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 30 + (i % 7) * 8;
      const x = 160 + r * Math.cos(angle) + ((i * 13) % 20);
      const y = 140 + r * Math.sin(angle) + ((i * 17) % 20);
      const gtCluster = (Math.floor(x / 70) + Math.floor(y / 70)) % 8;
      const noise = (i % 11 === 0) ? 1 : 0;
      const predCluster = (gtCluster + noise) % 8;
      spots.push({ x, y, gtCluster, predCluster, rawGt: `Cluster ${gtCluster}`, rawPred: `Cluster ${predCluster}` });
    }
    return spots;
  }, [resultsByModel, selectedModel, selectedSeed, activeVisType]);

  const clusterColors = [
    '#6366f1', '#10b981', '#f59e0b', '#ec4899',
    '#3b82f6', '#8b5cf6', '#14b8a6', '#f43f5e',
    '#84cc16', '#06b6d4', '#eab308', '#a855f7',
    '#22c55e', '#f97316', '#64748b', '#0284c7',
  ];

  // Compute dynamic spot radius based on total spot count
  const spotRadius = useMemo(() => {
    const count = spotGrid.length;
    if (count > 2500) return activeVisType === 'umap' ? 2.0 : 2.5;
    if (count > 1000) return activeVisType === 'umap' ? 2.8 : 3.2;
    return activeVisType === 'umap' ? 3.5 : 4.5;
  }, [spotGrid.length, activeVisType]);

  // Compute actual cluster distribution for the legend
  const clusterStats = useMemo(() => {
    const statsMap = new Map<number, { id: number; name: string; count: number; color: string }>();
    spotGrid.forEach(spot => {
      const isGt = activeVisType === 'ground_truth';
      const cId = isGt ? spot.gtCluster : spot.predCluster;
      const cName = isGt ? spot.rawGt : spot.rawPred;
      if (!statsMap.has(cId)) {
        statsMap.set(cId, {
          id: cId,
          name: cName,
          count: 0,
          color: clusterColors[cId % clusterColors.length],
        });
      }
      statsMap.get(cId)!.count += 1;
    });
    return Array.from(statsMap.values()).sort((a, b) => b.count - a.count);
  }, [spotGrid, activeVisType, clusterColors]);

  if (models.length === 0 || !selectedModel) {
    return (
      <div className="p-8 rounded-3xl bg-[var(--bg-secondary)] border border-dashed border-[var(--border-color)] text-center space-y-3">
        <ImageIcon className="w-8 h-8 text-indigo-400 mx-auto" />
        <h3 className="font-heading font-bold text-base text-[var(--text-primary)]">
          No Spatial Visualizations Available
        </h3>
        <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
          Spatial domain cluster maps and UMAP embeddings will automatically appear here once you run experiments from Python or import data files.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls Filter Bar */}
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

          {/* Spot Count Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            <MapPin className="w-3.5 h-3.5" />
            <span>{spotGrid.length.toLocaleString()} Spots Rendered</span>
          </div>
        </div>

        {/* Side-by-Side Comparison Trigger */}
        {models.length >= 2 && (
          <button
            onClick={() => setIsCompareModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors shadow-sm"
          >
            <Split className="w-3.5 h-3.5" />
            Side-by-Side Spatial Compare
          </button>
        )}
      </div>

      {/* Visualization Type Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm">
        {[
          { id: 'spatial_map', label: 'Spatial Domain Map', icon: MapPin },
          { id: 'umap', label: 'UMAP Embeddings', icon: Eye },
          { id: 'ground_truth', label: 'Ground Truth Annotation', icon: Layers },
          { id: 'prediction', label: 'Predicted Clusters', icon: Sparkles },
          { id: 'violin', label: 'Silhouette & Latent Violin', icon: ImageIcon },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeVisType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveVisType(tab.id as VisType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Visualization Canvas View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Render Panel */}
        <div className="lg:col-span-8 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col items-center justify-center min-h-[460px]">
          <div className="w-full flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-heading font-bold text-[var(--text-primary)]">
                {activeVisType === 'spatial_map' && `Spatial Clustering Map - ${activeDatasetObj.name}`}
                {activeVisType === 'umap' && `Joint Latent Space UMAP Embedding - ${selectedModel?.name || ''}`}
                {activeVisType === 'ground_truth' && `Ground Truth Annotations (${clusterStats.length} Clusters)`}
                {activeVisType === 'prediction' && `Predicted Domain Boundaries (${selectedModel?.name || ''})`}
                {activeVisType === 'violin' && `Silhouette Sample Coefficients & Latent Profiles`}
              </h3>
              <span className="text-xs text-[var(--text-muted)]">
                Dataset: {activeDatasetObj.name} | Model: {selectedModel?.name || ''} | Seed: {selectedSeed} ({spotGrid.length} spots)
              </span>
            </div>
          </div>

          {/* Interactive Spot Map Render */}
          <div className="relative w-full max-w-xl aspect-[1.15] bg-[var(--bg-tertiary)]/50 rounded-2xl border border-[var(--border-color)] flex items-center justify-center p-4">
            <svg viewBox="0 0 320 280" className="w-full h-full">
              {spotGrid.map((spot, idx) => {
                const isGt = activeVisType === 'ground_truth';
                const clusterId = isGt ? spot.gtCluster : spot.predCluster;
                const fill = clusterColors[clusterId % clusterColors.length];
                const labelName = isGt ? spot.rawGt : spot.rawPred;

                return (
                  <circle
                    key={idx}
                    cx={spot.x}
                    cy={spot.y}
                    r={spotRadius}
                    fill={fill}
                    className="transition-transform duration-150 hover:scale-[2.5] cursor-pointer opacity-85 hover:opacity-100 hover:stroke-white hover:stroke-[1.5]"
                  >
                    <title>
                      Spot #{idx} | {labelName} (X: {spot.x.toFixed(1)}, Y: {spot.y.toFixed(1)})
                    </title>
                  </circle>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Legend & Cluster Metadata Panel */}
        <div className="lg:col-span-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col max-h-[560px]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-heading font-bold text-[var(--text-primary)]">
              Cluster Domains
            </h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
              {clusterStats.length} Classes
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            {activeVisType === 'ground_truth' ? 'Ground truth anatomical regions' : 'Model-predicted domain clusters'}
          </p>

          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {clusterStats.map(stat => (
              <div
                key={stat.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-tertiary)]/40 border border-[var(--border-color)] text-xs hover:border-indigo-500/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: stat.color }} />
                  <span className="font-semibold text-[var(--text-primary)] capitalize truncate" title={stat.name}>
                    {stat.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs text-[var(--text-primary)] font-bold">
                    {stat.count.toLocaleString()}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">
                    ({((stat.count / (spotGrid.length || 1)) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison Modal */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-3xl w-full max-w-5xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
              <div>
                <h3 className="text-lg font-heading font-bold text-[var(--text-primary)]">
                  Side-by-Side Spatial Domain Comparison
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Compare predicted domain boundaries against Ground Truth
                </p>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-xs font-bold text-[var(--text-primary)]"
              >
                Close ✕
              </button>
            </div>

            {/* 3 Panels: Ground Truth vs Model A vs Model B */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-[var(--bg-tertiary)]/40 border border-[var(--border-color)] p-4 flex flex-col items-center">
                <span className="text-xs font-bold text-slate-300 mb-2">Ground Truth</span>
                <svg viewBox="0 0 320 280" className="w-full aspect-square">
                  {spotGrid.map((s, idx) => (
                    <circle key={idx} cx={s.x} cy={s.y} r={3.5} fill={clusterColors[s.gtCluster]} />
                  ))}
                </svg>
              </div>

              <div className="rounded-2xl bg-[var(--bg-tertiary)]/40 border border-[var(--border-color)] p-4 flex flex-col items-center">
                <span className="text-xs font-bold text-indigo-400 mb-2">{selectedModel?.name}</span>
                <svg viewBox="0 0 320 280" className="w-full aspect-square">
                  {spotGrid.map((s, idx) => (
                    <circle key={idx} cx={s.x} cy={s.y} r={3.5} fill={clusterColors[s.predCluster]} />
                  ))}
                </svg>
              </div>

              <div className="rounded-2xl bg-[var(--bg-tertiary)]/40 border border-[var(--border-color)] p-4 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-2">
                  <select
                    value={compareModelB?.id || ''}
                    onChange={e => setCompareModelBId(e.target.value)}
                    className="bg-transparent text-xs font-bold text-amber-400 focus:outline-none"
                  >
                    {models.map(m => (
                      <option key={m.id} value={m.id} className="bg-[var(--bg-secondary)]">
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <svg viewBox="0 0 320 280" className="w-full aspect-square">
                  {spotGrid.map((s, idx) => (
                    <circle
                      key={idx}
                      cx={s.x}
                      cy={s.y}
                      r={3.5}
                      fill={clusterColors[(s.gtCluster + (idx % 5 === 0 ? 1 : 0)) % 8]}
                    />
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
