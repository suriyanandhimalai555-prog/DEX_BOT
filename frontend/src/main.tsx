import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { ThemedToaster } from './components/ui/ThemedToaster';
import './styles/tokens.css';
import './index.css';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { wagmiConfig } from './lib/wagmi.config';
import { ThemeProvider } from './theme/ThemeProvider';

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <WagmiProvider config={wagmiConfig}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <ThemeProvider>
            <AuthProvider>
              <App />
              <ThemedToaster />
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </WagmiProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
