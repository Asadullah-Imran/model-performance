// ==============================================================================
// Math & Statistical Analysis Utilities
// ==============================================================================

export function calculateMean(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + (isNaN(val) ? 0 : val), 0);
  return sum / values.length;
}

export function calculateMedian(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].filter(v => !isNaN(v)).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calculateStdDev(values: number[]): number {
  if (!values || values.length <= 1) return 0;
  const valid = values.filter(v => !isNaN(v));
  if (valid.length <= 1) return 0;
  const mean = calculateMean(valid);
  const sumSquares = valid.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
  return Math.sqrt(sumSquares / (valid.length - 1));
}

export function calculateSEM(values: number[]): number {
  if (!values || values.length <= 1) return 0;
  const std = calculateStdDev(values);
  return std / Math.sqrt(values.length);
}

export function calculateCV(values: number[]): number {
  const mean = calculateMean(values);
  if (Math.abs(mean) < 1e-9) return 0;
  const std = calculateStdDev(values);
  return Math.abs((std / mean) * 100);
}

export function calculateQuartiles(values: number[]): {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
} {
  if (!values || values.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  }
  const sorted = [...values].filter(v => !isNaN(v)).sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = calculateMedian(sorted);

  const mid = Math.floor(sorted.length / 2);
  const lowerHalf = sorted.length % 2 === 0 ? sorted.slice(0, mid) : sorted.slice(0, mid);
  const upperHalf = sorted.length % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1);

  const q1 = lowerHalf.length > 0 ? calculateMedian(lowerHalf) : min;
  const q3 = upperHalf.length > 0 ? calculateMedian(upperHalf) : max;

  return { min, q1, median, q3, max };
}

/**
 * Computes two-tailed paired t-test p-value between two paired numerical arrays.
 */
export function calculatePairedTTestPValue(sampleA: number[], sampleB: number[]): number {
  const minLen = Math.min(sampleA.length, sampleB.length);
  if (minLen < 2) return 1.0;

  const diffs: number[] = [];
  for (let i = 0; i < minLen; i++) {
    if (!isNaN(sampleA[i]) && !isNaN(sampleB[i])) {
      diffs.push(sampleB[i] - sampleA[i]);
    }
  }

  const n = diffs.length;
  if (n < 2) return 1.0;

  const meanDiff = calculateMean(diffs);
  const stdDiff = calculateStdDev(diffs);

  if (stdDiff === 0) return meanDiff === 0 ? 1.0 : 0.0001;

  const tStat = meanDiff / (stdDiff / Math.sqrt(n));
  const df = n - 1;

  // Approximate two-tailed p-value using standard normal / t distribution approximation
  const x = Math.abs(tStat);
  const z = x / Math.sqrt(1 + Math.pow(x, 2) / (2 * df));
  // Complementary error function approx
  const t = 1.0 / (1.0 + 0.2316419 * z);
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const pOneTail = (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
  const pTwoTail = Math.min(1.0, Math.max(0.0001, 2 * pOneTail));

  return pTwoTail;
}

/**
 * Calculates Pearson Correlation Coefficient Matrix between metrics across data records.
 */
export function calculateCorrelationMatrix(
  metrics: string[],
  records: Array<Record<string, number>>
): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};

  metrics.forEach(m1 => {
    matrix[m1] = {};
    metrics.forEach(m2 => {
      if (m1 === m2) {
        matrix[m1][m2] = 1.0;
        return;
      }

      const pairs: Array<[number, number]> = [];
      records.forEach(r => {
        if (typeof r[m1] === 'number' && typeof r[m2] === 'number' && !isNaN(r[m1]) && !isNaN(r[m2])) {
          pairs.push([r[m1], r[m2]]);
        }
      });

      if (pairs.length < 2) {
        matrix[m1][m2] = 0;
        return;
      }

      const x = pairs.map(p => p[0]);
      const y = pairs.map(p => p[1]);
      const meanX = calculateMean(x);
      const meanY = calculateMean(y);

      let num = 0;
      let denX = 0;
      let denY = 0;

      for (let i = 0; i < pairs.length; i++) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }

      const den = Math.sqrt(denX * denY);
      matrix[m1][m2] = den === 0 ? 0 : Number((num / den).toFixed(4));
    });
  });

  return matrix;
}
