import type { EngineError } from '../contracts';
import type {
  AllocationScenario,
  AllocationStrategy,
  PagingAlgorithm,
  PagingScenario,
} from './types';

export const ALLOCATION_STRATEGIES: readonly AllocationStrategy[] = [
  'first-fit',
  'best-fit',
  'worst-fit',
];
export const PAGING_ALGORITHMS: readonly PagingAlgorithm[] = [
  'fifo',
  'lru',
  'optimal',
];
export type Issues = { path: string; message: string }[];
export function checkInteger(
  issues: Issues,
  value: number,
  min: number,
  max: number,
  path: string,
  label: string,
) {
  if (!Number.isInteger(value) || value < min || value > max)
    issues.push({
      path,
      message: `${label} must be a whole number from ${min} to ${max}.`,
    });
}
export function validationError(issues: Issues): EngineError | null {
  return issues.length
    ? {
        code: 'validation',
        message: 'Correct the scenario inputs before running.',
        issues,
      }
    : null;
}
export function validateAllocation(
  input: AllocationScenario,
): EngineError | null {
  const issues: Issues = [];
  if (input.kind !== 'allocation')
    issues.push({ path: 'kind', message: 'Choose an allocation scenario.' });
  if (!ALLOCATION_STRATEGIES.includes(input.strategy))
    issues.push({
      path: 'strategy',
      message: 'Choose First Fit, Best Fit, or Worst Fit.',
    });
  checkInteger(issues, input.totalKiB, 1, 65_536, 'totalKiB', 'Capacity');
  checkInteger(
    issues,
    input.operations.length,
    1,
    200,
    'operations',
    'Operation count',
  );
  input.operations.forEach((op, i) => {
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(op.id))
      issues.push({
        path: `operations.${i}.id`,
        message:
          'Use 1–24 letters, digits, underscores, or hyphens for the allocation ID.',
      });
    if (op.kind === 'allocate')
      checkInteger(
        issues,
        op.sizeKiB,
        1,
        input.totalKiB,
        `operations.${i}.sizeKiB`,
        'Size (KiB)',
      );
    else if (op.kind !== 'free')
      issues.push({
        path: `operations.${i}.kind`,
        message: 'Choose Allocate or Free.',
      });
  });
  return validationError(issues);
}
export function validatePaging(input: PagingScenario): EngineError | null {
  const issues: Issues = [];
  if (input.kind !== 'paging')
    issues.push({ path: 'kind', message: 'Choose a paging scenario.' });
  if (!PAGING_ALGORITHMS.includes(input.algorithm))
    issues.push({
      path: 'algorithm',
      message: 'Choose FIFO, LRU, or Optimal.',
    });
  checkInteger(issues, input.frames, 1, 12, 'frames', 'Frame count');
  checkInteger(
    issues,
    input.references.length,
    1,
    200,
    'references',
    'Reference count',
  );
  input.references.forEach((page, i) =>
    checkInteger(
      issues,
      page,
      0,
      9999,
      `references.${i}`,
      `Page at reference ${i + 1}`,
    ),
  );
  return validationError(issues);
}
