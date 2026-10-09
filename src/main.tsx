import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { LabProvider } from './app/LabProvider';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { CpuProvider } from './features/cpu/CpuProvider';
import { MemoryProvider } from './features/memory/MemoryProvider';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
createRoot(root).render(
  <StrictMode>
    <LabProvider>
      <CpuProvider>
        <MemoryProvider>
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </MemoryProvider>
      </CpuProvider>
    </LabProvider>
  </StrictMode>,
);
