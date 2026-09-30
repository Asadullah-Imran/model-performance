'use client';

import React, { useState, useMemo } from 'react';
import { Box } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { calculateQuartiles } from '@/lib/statistics';

export function BoxplotChart() {
  const { models, filteredModels, resultsByModel, selectedMetric, theme } = useDashboard();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const displayModels = filteredModels.length > 0 ? filteredModels : models;

  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const strokeColor = isDark ? '#e2e8f0' : '#1e293b';

  // Compute stats for each filtered model
  const modelStats = useMemo(() => {
    return displayModels.map(model => {
      const values = resultsByModel[model.id]?.aggregatedMetrics?.[selectedMetric]?.values || [];
      const quartiles = calculateQuartiles(values);
      return {
        model,
        quartiles,
        count: values.length,
      };
    });
  }, [displayModels, resultsByModel, selectedMetric]);

  // Determine seed count for subtitle
  const maxSeeds = Math.max(...modelStats.map(s => s.count), 0);
  const seedCountLabel = maxSeeds > 0 ? maxSeeds : 20;

  // Compute Y-scale min, max, and step ticks
  const { yMin, yMax, ticks } = useMemo(() => {
    const allMins = modelStats.map(s => s.quartiles.min).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
    const allMaxs = modelStats.map(s => s.quartiles.max).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);

    let dataMin = allMins.length > 0 ? Math.min(...allMins) : 0.1;
    let dataMax = allMaxs.length > 0 ? Math.max(...allMaxs) : 0.35;

    if (dataMin >= dataMax) {
      dataMin = 0.1;
      dataMax = 0.4;
    }

    const span = dataMax - dataMin;
    // Neat boundaries with padding
    const rawMin = Math.max(0, dataMin - span * 0.25);
    const rawMax = dataMax + span * 0.25;

    // Round to nearest 0.05 step
    const stepSize = span > 0.4 ? 0.1 : 0.05;
    const computedMin = Math.floor(rawMin / stepSize) * stepSize;
    const computedMax = Math.ceil(rawMax / stepSize) * stepSize;

    const tickList: number[] = [];
    for (let v = computedMin; v <= computedMax + stepSize * 0.01; v += stepSize) {
      tickList.push(Number(v.toFixed(3)));
    }

    return {
      yMin: computedMin,
      yMax: computedMax,
      ticks: tickList,
    };
  }, [modelStats]);

  // SVG Dimension Constants
  const svgWidth = 720;
  const svgHeight = 360;
  const marginLeft = 65;
  const marginRight = 25;
  const marginTop = 25;
  const marginBottom = 50;

  const plotWidth = svgWidth - marginLeft - marginRight;
  const plotHeight = svgHeight - marginTop - marginBottom;

  const getYPix = (val: number) => {
    const ratio = (val - yMin) / (yMax - yMin || 1);
    return marginTop + (1 - ratio) * plotHeight;
  };

  const colWidth = displayModels.length > 0 ? plotWidth / displayModels.length : plotWidth;
  const boxWidth = Math.min(52, colWidth * 0.52);
  const capWidth = boxWidth * 0.65;

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-start gap-2.5 mb-4">
        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 mt-0.5">
          <Box className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-heading font-bold text-[var(--text-primary)]">
            Seed Score Distributions
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Spread of {selectedMetric} scores across {seedCountLabel} random seeds
          </p>
        </div>
      </div>

      {/* SVG Boxplot Chart */}
      <div className="flex-1 w-full min-h-[300px] flex items-center justify-center relative">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Horizontal Gridlines & Y-Axis Labels */}
          {ticks.map((tickVal) => {
            const yPix = getYPix(tickVal);
            return (
              <g key={`tick-${tickVal}`}>
                <line
                  x1={marginLeft}
                  y1={yPix}
                  x2={marginLeft + plotWidth}
                  y2={yPix}
                  stroke={gridColor}
                  strokeWidth="1"
                />
                <text
                  x={marginLeft - 12}
                  y={yPix + 4}
                  textAnchor="end"
                  fill={textColor}
                  fontSize="11"
                  fontFamily="Inter, sans-serif"
                >
                  {tickVal.toFixed(3)}
                </text>
              </g>
            );
          })}

          {/* Y-Axis Title */}
          <text
            transform={`rotate(-90)`}
            x={-(marginTop + plotHeight / 2)}
            y={18}
            textAnchor="middle"
            fill={textColor}
            fontSize="12"
            fontWeight="bold"
            fontFamily="Inter, sans-serif"
          >
            {selectedMetric}
          </text>

          {/* Model Box Plots */}
          {modelStats.map((item, idx) => {
            const { model, quartiles: q } = item;
            const xCenter = marginLeft + (idx + 0.5) * colWidth;

            const yMaxPix = getYPix(q.max);
            const yQ3Pix = getYPix(q.q3);
            const yMedPix = getYPix(q.median);
            const yQ1Pix = getYPix(q.q1);
            const yMinPix = getYPix(q.min);

            const isHovered = hoveredIndex === idx;

            // Heights
            const topBoxHeight = Math.max(1, yMedPix - yQ3Pix);
            const bottomBoxHeight = Math.max(1, yQ1Pix - yMedPix);
            const totalBoxHeight = Math.max(2, yQ1Pix - yQ3Pix);

            return (
              <g
                key={model.id}
                className="cursor-pointer transition-opacity duration-200"
                opacity={hoveredIndex === null || isHovered ? 1 : 0.4}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Transparent column hit-area for hover */}
                <rect
                  x={xCenter - colWidth / 2}
                  y={marginTop}
                  width={colWidth}
                  height={plotHeight + 35}
                  fill="transparent"
                />

                {/* Upper Whisker & Cap */}
                <line
                  x1={xCenter}
                  y1={yQ3Pix}
                  x2={xCenter}
                  y2={yMaxPix}
                  stroke={strokeColor}
                  strokeWidth={isHovered ? '2' : '1.5'}
                />
                <line
                  x1={xCenter - capWidth / 2}
                  y1={yMaxPix}
                  x2={xCenter + capWidth / 2}
                  y2={yMaxPix}
                  stroke={strokeColor}
                  strokeWidth={isHovered ? '2' : '1.5'}
                />

                {/* Lower Whisker & Cap */}
                <line
                  x1={xCenter}
                  y1={yQ1Pix}
                  x2={xCenter}
                  y2={yMinPix}
                  stroke={strokeColor}
                  strokeWidth={isHovered ? '2' : '1.5'}
                />
                <line
                  x1={xCenter - capWidth / 2}
                  y1={yMinPix}
                  x2={xCenter + capWidth / 2}
                  y2={yMinPix}
                  stroke={strokeColor}
                  strokeWidth={isHovered ? '2' : '1.5'}
                />

                {/* Top Half of Box: Purple (#9b7bf7) */}
                <rect
                  x={xCenter - boxWidth / 2}
                  y={yQ3Pix}
                  width={boxWidth}
                  height={topBoxHeight}
                  fill="#9b7bf7"
                />

                {/* Bottom Half of Box: Mint Emerald (#5cdbb5) */}
                <rect
                  x={xCenter - boxWidth / 2}
                  y={yMedPix}
                  width={boxWidth}
                  height={bottomBoxHeight}
                  fill="#5cdbb5"
                />

                {/* Outer Box Border */}
                <rect
                  x={xCenter - boxWidth / 2}
                  y={yQ3Pix}
                  width={boxWidth}
                  height={totalBoxHeight}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isHovered ? '2' : '1.5'}
                />

                {/* Median Dividing Line */}
                <line
                  x1={xCenter - boxWidth / 2}
                  y1={yMedPix}
                  x2={xCenter + boxWidth / 2}
                  y2={yMedPix}
                  stroke={strokeColor}
                  strokeWidth={isHovered ? '2.5' : '2'}
                />

                {/* X-Axis Model Name */}
                <text
                  x={xCenter}
                  y={marginTop + plotHeight + 24}
                  textAnchor="middle"
                  fill={isHovered ? 'var(--text-primary)' : textColor}
                  fontSize="12"
                  fontWeight={isHovered ? '700' : '600'}
                  fontFamily="Inter, sans-serif"
                >
                  {model.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip when hovering over a box */}
        {hoveredIndex !== null && modelStats[hoveredIndex] && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/90 dark:bg-slate-800/95 text-white backdrop-blur-md rounded-xl p-3 shadow-xl border border-slate-700/50 text-xs min-w-[170px] transition-all"
            style={{
              top: '15px',
              right: '15px',
            }}
          >
            <div className="font-bold text-sm mb-1.5 flex items-center gap-1.5 border-b border-slate-700/60 pb-1 text-slate-100">
              <span className="w-2.5 h-2.5 rounded-full bg-[#9b7bf7]"></span>
              {modelStats[hoveredIndex].model.name}
            </div>
            <div className="space-y-1 font-mono text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Max:</span>
                <span className="font-bold text-white">{modelStats[hoveredIndex].quartiles.max.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-300">Q3 (75%):</span>
                <span>{modelStats[hoveredIndex].quartiles.q3.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-300 font-bold">Median:</span>
                <span className="font-bold text-amber-300">{modelStats[hoveredIndex].quartiles.median.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-300">Q1 (25%):</span>
                <span>{modelStats[hoveredIndex].quartiles.q1.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Min:</span>
                <span className="font-bold text-white">{modelStats[hoveredIndex].quartiles.min.toFixed(4)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700/60 pt-1 text-[10px] text-slate-400">
                <span>IQR:</span>
                <span>{(modelStats[hoveredIndex].quartiles.q3 - modelStats[hoveredIndex].quartiles.q1).toFixed(4)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
