import type { EngineError } from '../contracts';
import {
  checkInteger,
  validationError,
  type Issues,
} from '../memory/validation';
import type { DiskAlgorithm, DiskScenario } from './types';
export const DISK_ALGORITHMS: readonly DiskAlgorithm[] = [
  'fcfs',
  'sstf',
  'scan',
  'cscan',
];
export function validateDisk(input: DiskScenario): EngineError | null {
  const issues: Issues = [];
  if (input.kind !== 'disk')
    issues.push({ path: 'kind', message: 'Choose a disk scenario.' });
  if (input.minCylinder !== 0)
    issues.push({
      path: 'minCylinder',
      message: 'The minimum cylinder is 0 in this model.',
    });
  checkInteger(
    issues,
    input.maxCylinder,
    1,
    100_000,
    'maxCylinder',
    'Maximum cylinder',
  );
  checkInteger(
    issues,
    input.initialHead,
    0,
    input.maxCylinder,
    'initialHead',
    'Initial head',
  );
  if (!DISK_ALGORITHMS.includes(input.algorithm))
    issues.push({
      path: 'algorithm',
      message: 'Choose FCFS, SSTF, SCAN, or C-SCAN.',
    });
  if (input.direction !== 'higher' && input.direction !== 'lower')
    issues.push({
      path: 'direction',
      message: 'Choose higher or lower cylinders.',
    });
  checkInteger(
    issues,
    input.requests.length,
    1,
    100,
    'requests',
    'Request count',
  );
  const seen = new Set<string>();
  input.requests.forEach((r, i) => {
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(r.id))
      issues.push({
        path: `requests.${i}.id`,
        message:
          'Use 1–24 letters, digits, underscores or hyphens for the request ID.',
      });
    if (seen.has(r.id))
      issues.push({
        path: `requests.${i}.id`,
        message: `Duplicate request ID ${r.id}. Cylinder values may repeat, IDs must be unique.`,
      });
    seen.add(r.id);
    checkInteger(
      issues,
      r.cylinder,
      0,
      input.maxCylinder,
      `requests.${i}.cylinder`,
      'Request cylinder',
    );
  });
  return validationError(issues);
}
