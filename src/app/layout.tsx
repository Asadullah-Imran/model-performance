import type { Metadata } from 'next';
import './globals.css';
import { DashboardProvider } from '@/context/DashboardContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

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
        <DashboardProvider>
          <div className="flex h-screen w-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                {children}
              </main>
            </div>
          </div>
        </DashboardProvider>
      </body>
    </html>
  );
}
