import type { CpuAlgorithm, CpuScenario, EngineError } from '../contracts';

export const CPU_ALGORITHMS: readonly CpuAlgorithm[] = [
  'fcfs',
  'sjf',
  'priority',
  'rr',
];
export function isCpuAlgorithm(value: string): value is CpuAlgorithm {
  return CPU_ALGORITHMS.some((algorithm) => algorithm === value);
}
export function validateCpuScenario(scenario: CpuScenario): EngineError | null {
  const issues: { path: string; message: string }[] = [];
  const integer = (
    value: number,
    min: number,
    max: number,
    path: string,
    label: string,
  ) => {
    if (!Number.isInteger(value) || value < min || value > max)
      issues.push({
        path,
        message: `${label} must be a whole number from ${min} to ${max}.`,
      });
  };
  if (scenario.kind !== 'cpu')
    issues.push({ path: 'kind', message: 'Choose a CPU scenario.' });
  if (!isCpuAlgorithm(scenario.algorithm))
    issues.push({
      path: 'algorithm',
      message: 'Choose FCFS, SJF, Priority, or Round Robin.',
    });
  integer(scenario.processes.length, 1, 50, 'processes', 'Process count');
  const seen = new Set<string>();
  scenario.processes.forEach((process, index) => {
    const base = `processes.${index}`;
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(process.id))
      issues.push({
        path: `${base}.id`,
        message:
          'Use 1–24 letters, digits, underscores, or hyphens for the ID.',
      });
    if (seen.has(process.id))
      issues.push({
        path: `${base}.id`,
        message: `ID ${process.id} is duplicated. Each process needs a unique ID.`,
      });
    seen.add(process.id);
    integer(process.arrival, 0, 10_000, `${base}.arrival`, 'Arrival');
    integer(process.burst, 1, 1_000, `${base}.burst`, 'Burst');
    integer(process.priority, 0, 999, `${base}.priority`, 'Priority');
  });
  if (scenario.algorithm === 'rr')
    integer(scenario.quantum, 1, 1_000, 'quantum', 'Time quantum');
  if (scenario.contextSwitchCost !== 0)
    issues.push({
      path: 'contextSwitchCost',
      message: 'This model requires zero context-switch cost.',
    });
  return issues.length
    ? {
        code: 'validation',
        message: 'Correct the workload before running.',
        issues,
      }
    : null;
}
