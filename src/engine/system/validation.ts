import {
  checkInteger,
  validationError,
  type Issues,
} from '../memory/validation';
import type { SystemScenario } from './types';
export function validateSystem(input: SystemScenario) {
  const issues: Issues = [];
  if (input.kind !== 'system' || input.algorithm !== 'rr')
    issues.push({
      path: 'algorithm',
      message: 'Integrated runs use Round Robin.',
    });
  checkInteger(
    issues,
    input.totalKiB,
    1,
    65536,
    'totalKiB',
    'Memory capacity (KiB)',
  );
  checkInteger(issues, input.quantum, 1, 1000, 'quantum', 'Quantum (t)');
  checkInteger(
    issues,
    input.processes.length,
    1,
    20,
    'processes',
    'Process count',
  );
  checkInteger(
    issues,
    input.resources.length,
    0,
    8,
    'resources',
    'Resource count',
  );
  function ids(values: readonly string[], path: string) {
    const seen = new Set<string>();
    values.forEach((id, i) => {
      if (!/^[A-Za-z0-9_-]{1,24}$/.test(id) || seen.has(id))
        issues.push({
          path: `${path}.${i}.id`,
          message:
            'IDs must be unique and use 1–24 letters, digits, underscores or hyphens.',
        });
      seen.add(id);
    });
  }
  ids(
    input.processes.map((p) => p.id),
    'processes',
  );
  ids(
    input.resources.map((r) => r.id),
    'resources',
  );
  input.resources.forEach((r, i) => {
    if (r.instances !== 1)
      issues.push({
        path: `resources.${i}.instances`,
        message: 'Resources have exactly one reusable instance.',
      });
  });
  input.processes.forEach((p, i) => {
    const path = `processes.${i}`;
    checkInteger(issues, p.arrival, 0, 10000, `${path}.arrival`, 'Arrival (t)');
    checkInteger(
      issues,
      p.memoryKiB,
      1,
      input.totalKiB,
      `${path}.memoryKiB`,
      'Memory requirement (KiB)',
    );
    checkInteger(
      issues,
      p.program.length,
      1,
      100,
      `${path}.program`,
      'Instruction count',
    );
    if (!p.program.some((x) => x.op === 'cpu'))
      issues.push({
        path: `${path}.program`,
        message: 'Each process needs positive CPU work.',
      });
    p.program.forEach((x, j) => {
      if (x.op === 'cpu')
        checkInteger(
          issues,
          x.duration,
          1,
          1000,
          `${path}.program.${j}.duration`,
          'CPU duration (t)',
        );
      else if (
        (x.op !== 'acquire' && x.op !== 'release') ||
        !input.resources.some((r) => r.id === x.resourceId)
      )
        issues.push({
          path: `${path}.program.${j}`,
          message: 'Use cpu, acquire or release with a declared resource ID.',
        });
    });
  });
  return validationError(issues);
}
