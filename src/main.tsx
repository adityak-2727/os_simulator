import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { LabProvider } from './app/LabProvider';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { CpuProvider } from './features/cpu/CpuProvider';
import { MemoryProvider } from './features/memory/MemoryProvider';
import { DeadlockProvider } from './features/deadlock/DeadlockProvider';
import { SyncProvider } from './features/synchronization/SyncProvider';
import { DiskProvider } from './features/disk/DiskProvider';
import { SystemProvider } from './features/system/SystemProvider';
import { ExperimentProvider } from './experiments/ExperimentProvider';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
createRoot(root).render(
  <StrictMode>
    <LabProvider>
      <CpuProvider>
        <MemoryProvider>
          <DeadlockProvider>
            <SyncProvider>
              <DiskProvider>
                <SystemProvider>
                  <ExperimentProvider>
                    <AppErrorBoundary>
                      <App />
                    </AppErrorBoundary>
                  </ExperimentProvider>
                </SystemProvider>
              </DiskProvider>
            </SyncProvider>
          </DeadlockProvider>
        </MemoryProvider>
      </CpuProvider>
    </LabProvider>
  </StrictMode>,
);
