import type { Metadata } from 'next';
import './globals.css';
import { AppLayout } from '@/components/layout/AppLayout';

export const metadata: Metadata = {
  title: 'Spatial Multi-Omics Model Performance & Research Dashboard',
  description: 'Deep-learning spatial multi-omics benchmark dashboard, ablation, training dynamics, and spatial domain visualizations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="dark-theme antialiased overflow-hidden flex h-screen w-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
