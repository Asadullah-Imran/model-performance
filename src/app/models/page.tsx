'use client';

import React, { useState } from 'react';
import { Layers, Cpu, Settings, Code, PlusCircle, CheckCircle2, FileJson, Sparkles } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

export default function ModelsPage() {
  const { models } = useDashboard();
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  const activeModelId = selectedModelId || (models[0]?.id ?? '');
  const selectedModel = models.find(m => m.id === activeModelId);

  return (
    <div className="space-y-6">
      {/* Model Cards Grid */}
      {models.length === 0 ? (
        <div className="p-8 rounded-3xl bg-[var(--bg-secondary)] border border-dashed border-[var(--border-color)] text-center space-y-2">
          <Layers className="w-8 h-8 text-indigo-400 mx-auto" />
          <h3 className="font-heading font-bold text-base text-[var(--text-primary)]">
            No Models Registered in Database Yet
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
            Models will automatically register here with their architecture parameters and custom colors as you run experiments from Python or import JSONs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {models.map(model => {
            const isSelected = model.id === selectedModel?.id;
            return (
              <div
                key={model.id}
                onClick={() => setSelectedModelId(model.id)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all duration-300 ${
                  isSelected
                    ? 'bg-indigo-600/10 border-indigo-500/40 shadow-lg scale-[1.02]'
                    : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-indigo-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: model.colorTheme?.baseColor || '#6366f1' }}
                    />
                    <h3 className="font-heading font-bold text-base text-[var(--text-primary)]">
                      {model.name}
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                    {model.version || 'v1.0'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-3">
                  {model.description}
                </p>
                <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-3">
                  <span>Params: {model.numParameters || 'N/A'}</span>
                  <span className="text-indigo-400 font-semibold">{model.architecture}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Model Details & Hyperparameter Spec */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Model Spec Card */}
        {selectedModel ? (
          <div className="lg:col-span-7 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
              <div>
                <h2 className="text-lg font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  {selectedModel.name} Specification
                </h2>
                <span className="text-xs text-[var(--text-muted)]">{selectedModel.architecture}</span>
              </div>
              <span
                className="w-4 h-4 rounded-full shadow-md"
                style={{ backgroundColor: selectedModel.colorTheme?.baseColor || '#6366f1' }}
              />
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Architecture Description
              </h4>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {selectedModel.description}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                Hyperparameters & Training Configuration
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(selectedModel.hyperparameters || {}).map(([key, val]) => (
                  <div key={key} className="p-3 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)]">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono block uppercase">
                      {key}
                    </span>
                    <span className="text-xs font-bold text-[var(--text-primary)] font-mono">
                      {val?.toString() ?? ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-7 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex items-center justify-center text-center text-xs text-[var(--text-muted)]">
            Select or register a model to view architecture specifications
          </div>
        )}

        {/* Extensibility Guide */}
        <div className="lg:col-span-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm space-y-4">
          <h3 className="text-base font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            Automatic Model Registration
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Models are automatically registered in MongoDB when experiment outputs are sent from Python:
          </p>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)]">
              <span className="font-bold text-[var(--text-primary)] block mb-1">1. Python Training Export</span>
              <code className="text-[11px] text-indigo-400 font-mono">
                python AriseSpatialGlue_4Encoder_1Layer.py
              </code>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)]">
              <span className="font-bold text-[var(--text-primary)] block mb-1">2. Direct API Ingestion</span>
              <p className="text-[var(--text-muted)]">
                The script calls <code className="text-indigo-400">POST /api/experiments/upload</code> with model name, metrics, and parameters.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)]">
              <span className="font-bold text-[var(--text-primary)] block mb-1">3. Live Dashboard Display</span>
              <p className="text-[var(--text-muted)]">
                Leaderboard cards, training curves, and spatial plots instantly display the new model with a unique color theme.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
