'use client';

import React from 'react';

export function Skeleton({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[var(--bg-tertiary)]/70 ${className}`}
      {...props}
    />
  );
}

export function ModelCardSkeleton() {
  return (
    <div className="rounded-2xl p-5 bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-3 h-3 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="w-24 h-4 rounded-md" />
            <Skeleton className="w-16 h-2.5 rounded-md" />
          </div>
        </div>
        <Skeleton className="w-12 h-4 rounded-md" />
      </div>

      <div className="grid grid-cols-3 gap-2 py-3 border-y border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 rounded-xl px-3 my-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="w-10 h-2 rounded" />
            <Skeleton className="w-14 h-5 rounded" />
            <Skeleton className="w-10 h-2 rounded" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="w-20 h-3 rounded" />
        <Skeleton className="w-12 h-3 rounded" />
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="w-44 h-5 rounded-lg" />
          <Skeleton className="w-64 h-3 rounded" />
        </div>
        <Skeleton className="w-28 h-8 rounded-lg" />
      </div>

      <div className="space-y-3 pt-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <Skeleton className="w-7 h-7 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="w-32 h-4 rounded" />
                <Skeleton className="w-20 h-2.5 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <Skeleton className="w-16 h-6 rounded" />
              <Skeleton className="w-14 h-6 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RadarSkeleton() {
  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm space-y-4 h-full flex flex-col justify-between">
      <div className="space-y-1.5">
        <Skeleton className="w-40 h-5 rounded-lg" />
        <Skeleton className="w-56 h-3 rounded" />
      </div>

      <div className="w-full aspect-square max-h-[300px] flex items-center justify-center">
        <div className="w-48 h-48 rounded-full border-4 border-dashed border-[var(--border-color)] animate-spin-slow flex items-center justify-center">
          <Skeleton className="w-24 h-24 rounded-full" />
        </div>
      </div>

      <div className="flex justify-center gap-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="w-16 h-4 rounded-full" />
        ))}
      </div>
    </div>
  );
}
