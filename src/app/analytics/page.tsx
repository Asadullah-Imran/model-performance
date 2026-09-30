'use client';

import React from 'react';
import { ModelFilterBar } from '@/components/analytics/ModelFilterBar';
import { BoxplotChart } from '@/components/analytics/BoxplotChart';
import { SeedCurveChart } from '@/components/analytics/SeedCurveChart';
import { MeanErrorBarChart } from '@/components/analytics/MeanErrorBarChart';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <ModelFilterBar />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BoxplotChart />
        <SeedCurveChart />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <MeanErrorBarChart />
      </div>
    </div>
  );
}
