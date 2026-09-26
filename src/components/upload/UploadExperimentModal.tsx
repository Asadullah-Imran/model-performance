'use client';

import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, FileText, Sparkles, X, Database } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UploadExperimentModal({ isOpen, onClose, onSuccess }: Props) {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');

  if (!isOpen) return null;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setStatusMessage(null);

      const text = await file.text();
      setPreviewContent(text.slice(0, 500) + (text.length > 500 ? '...' : ''));

      const json = JSON.parse(text);

      const response = await fetch('/api/experiments/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload experiment data.');
      }

      setStatusMessage({
        type: 'success',
        text: data.message || 'Experiment successfully imported into MongoDB!',
      });

      if (onSuccess) {
        setTimeout(onSuccess, 1500);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Invalid JSON format or network error.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-6">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-heading font-bold text-[var(--text-primary)] leading-none">
                Import Model Experiment to MongoDB
              </h3>
              <span className="text-xs text-[var(--text-muted)]">
                Upload results JSON from Python training or local benchmark
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dropzone */}
        <div className="border-2 border-dashed border-[var(--border-color)] hover:border-indigo-500/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-[var(--bg-tertiary)]/20 transition-all">
          <UploadCloud className="w-12 h-12 text-indigo-400 mb-3 animate-bounce" />
          <h4 className="text-sm font-heading font-bold text-[var(--text-primary)] mb-1">
            Choose a JSON Experiment File
          </h4>
          <p className="text-xs text-[var(--text-muted)] mb-4 max-w-xs">
            Upload single seed <code className="text-indigo-400">metrics.json</code> or an array of model benchmark runs.
          </p>

          <label className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-md transition-colors">
            Select JSON File
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Payload Format Hint */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-tertiary)]/40 border border-[var(--border-color)] text-xs text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-primary)] block mb-1">
            Sample Expected JSON Structure:
          </span>
          <pre className="font-mono text-[10px] text-indigo-300 overflow-x-auto p-2 bg-[var(--bg-primary)] rounded-lg">
{`{
  "modelId": "Arise-4Encoder-1Layer",
  "datasetId": "10x_human_lymph_node_A1",
  "seed": 42,
  "bestEpoch": 210,
  "finalMetrics": { "ARI": 0.78, "Silhouette": 0.44, "NMI": 0.76 },
  "history": [{ "epoch": 1, "metrics": {...}, "losses": {...} }]
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
