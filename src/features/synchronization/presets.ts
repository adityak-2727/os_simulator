import type {
  SyncInstruction,
  SyncScenario,
} from '../../engine/synchronization/types';
export const PRESETS = [
  { id: 'counter-race', name: 'Shared-counter race' },
  { id: 'counter-mutex', name: 'Mutex-protected counter' },
  { id: 'producer-consumer', name: 'Bounded producer-consumer' },
] as const;
export function syncExample(preset: SyncScenario['preset']): SyncScenario {
  const increment: readonly SyncInstruction[] = [
    { op: 'read-counter', register: 'r' },
    { op: 'add-local', register: 'r', value: 1 },
    { op: 'write-counter', register: 'r' },
  ];
  if (preset !== 'producer-consumer') {
    const instructions: readonly SyncInstruction[] =
      preset === 'counter-mutex'
        ? [
            { op: 'lock', mutex: 'm' },
            ...increment,
            { op: 'unlock', mutex: 'm' },
          ]
        : increment;
    return {
      kind: 'synchronization',
      preset,
      initialCounter: 0,
      capacity: 2,
      mutexIds: preset === 'counter-mutex' ? ['m'] : [],
      semaphores: [],
      processes: [
        { id: 'P1', instructions },
        { id: 'P2', instructions },
      ],
      schedule:
        preset === 'counter-mutex'
          ? ['P1', 'P2', 'P1', 'P1', 'P1', 'P1', 'P2', 'P2', 'P2', 'P2']
          : ['P1', 'P2', 'P1', 'P2', 'P1', 'P2'],
    };
  }
  const produce = (value: string): SyncInstruction[] => [
    { op: 'wait', semaphore: 'empty' },
    { op: 'lock', mutex: 'm' },
    { op: 'enqueue', value },
    { op: 'unlock', mutex: 'm' },
    { op: 'signal', semaphore: 'full' },
  ];
  const consume: SyncInstruction[] = [
    { op: 'wait', semaphore: 'full' },
    { op: 'lock', mutex: 'm' },
    { op: 'dequeue', register: 'item' },
    { op: 'unlock', mutex: 'm' },
    { op: 'signal', semaphore: 'empty' },
  ];
  return {
    kind: 'synchronization',
    preset,
    initialCounter: 0,
    capacity: 2,
    mutexIds: ['m'],
    semaphores: [
      { id: 'empty', initial: 2 },
      { id: 'full', initial: 0 },
    ],
    processes: [
      { id: 'Producer', instructions: [...produce('A'), ...produce('B')] },
      { id: 'Consumer', instructions: [...consume, ...consume] },
    ],
    schedule: [
      ...Array.from({ length: 10 }, () => 'Producer'),
      ...Array.from({ length: 10 }, () => 'Consumer'),
    ],
  };
}
export function instructionText(instruction: SyncInstruction): string {
  switch (instruction.op) {
    case 'read-counter':
    case 'write-counter':
    case 'dequeue':
      return `${instruction.op} ${instruction.register}`;
    case 'add-local':
      return `add-local ${instruction.register} ${instruction.value}`;
    case 'lock':
    case 'unlock':
      return `${instruction.op} ${instruction.mutex}`;
    case 'wait':
    case 'signal':
      return `${instruction.op} ${instruction.semaphore}`;
    case 'enqueue':
      return `enqueue ${instruction.value}`;
  }
}
