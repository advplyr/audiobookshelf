import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { AuthProvider } from './auth/AuthProvider'
import { ErrorBoundary, ToastProvider } from './components/ui'
import { ThemeProvider } from './theme/ThemeProvider'
import './index.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            {/* Built app lives at /audiobookshelf/web/ (vite.config.ts base); dev runs at / */}
            <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <AuthProvider>
                <App />
              </AuthProvider>
            </BrowserRouter>
          </ToastProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>
)
