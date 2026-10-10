import type { CpuScenario } from './contracts';
import type { AllocationScenario, PagingScenario } from './memory/types';
import type { BankerScenario, GraphScenario } from './deadlock/types';
import type { SyncScenario } from './synchronization/types';
import type { DiskScenario } from './disk/types';
export type Scenario =
  | CpuScenario
  | AllocationScenario
  | PagingScenario
  | BankerScenario
  | GraphScenario
  | SyncScenario
  | DiskScenario;
