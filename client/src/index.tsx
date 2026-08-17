import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import RoutesComponent from './app.tsx';
import './index.css';
import { createPortal } from 'react-dom';
import { Toaster } from '@client/src/components/ui/sonner';
import { AuthProvider } from '@client/src/hooks/useAuth';

const CLIENT_BASE_PATH = process.env.CLIENT_BASE_PATH || '/';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const RootErrorFallback = ({
  error,
  resetErrorBoundary,
}: {
  error: unknown;
  resetErrorBoundary: () => void;
}) => (
  <main className="min-h-screen bg-background flex items-center justify-center p-6">
    <section className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-foreground">页面暂时无法显示</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {error instanceof Error ? error.message : '发生了未知错误，请重新加载。'}
      </p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        重新加载
      </button>
    </section>
  </main>
);

const MainApp = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={CLIENT_BASE_PATH}>
        <AuthProvider>
          <ErrorBoundary
            fallbackRender={RootErrorFallback}
          >
            <RoutesComponent />
            {createPortal(<Toaster />, document.body)}
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

createRoot(document.getElementById('root')!).render(<MainApp />);
