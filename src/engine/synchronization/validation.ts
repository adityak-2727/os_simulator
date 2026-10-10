import type { EngineError } from '../contracts';
import {
  checkInteger,
  validationError,
  type Issues,
} from '../memory/validation';
import type { SyncScenario } from './types';
const validId = (id: string) => /^[A-Za-z0-9_-]{1,24}$/.test(id);
export function validateSync(input: SyncScenario): EngineError | null {
  const issues: Issues = [];
  if (
    input.kind !== 'synchronization' ||
    !['counter-race', 'counter-mutex', 'producer-consumer'].includes(
      input.preset,
    )
  )
    issues.push({
      path: 'preset',
      message: 'Choose a synchronization preset.',
    });
  checkInteger(
    issues,
    input.processes.length,
    2,
    4,
    'processes',
    'Process count',
  );
  checkInteger(issues, input.capacity, 1, 10, 'capacity', 'Buffer capacity');
  checkInteger(
    issues,
    input.schedule.length,
    0,
    1000,
    'schedule',
    'Scheduled choice count',
  );
  if (!Number.isSafeInteger(input.initialCounter))
    issues.push({
      path: 'initialCounter',
      message: 'Initial counter must be a safe integer.',
    });
  function ids(values: readonly string[], path: string) {
    const seen = new Set<string>();
    values.forEach((id, i) => {
      if (!validId(id))
        issues.push({
          path: `${path}.${i}`,
          message: 'IDs use 1–24 letters, digits, underscores or hyphens.',
        });
      if (seen.has(id))
        issues.push({
          path: `${path}.${i}`,
          message: `Duplicate ID ${id} in ${path}.`,
        });
      seen.add(id);
    });
  }
  ids(
    input.processes.map((p) => p.id),
    'processes',
  );
  ids(input.mutexIds, 'mutexIds');
  ids(
    input.semaphores.map((s) => s.id),
    'semaphores',
  );
  checkInteger(issues, input.mutexIds.length, 0, 8, 'mutexIds', 'Mutex count');
  checkInteger(
    issues,
    input.semaphores.length,
    0,
    8,
    'semaphores',
    'Semaphore count',
  );
  input.semaphores.forEach((s, i) =>
    checkInteger(
      issues,
      s.initial,
      0,
      1000,
      `semaphores.${i}.initial`,
      'Initial permits',
    ),
  );
  input.schedule.forEach((id, i) => {
    if (!input.processes.some((p) => p.id === id))
      issues.push({
        path: `schedule.${i}`,
        message: `Choice ${i + 1} references unknown process ${id}.`,
      });
  });
  input.processes.forEach((p, i) => {
    checkInteger(
      issues,
      p.instructions.length,
      1,
      100,
      `processes.${i}.instructions`,
      'Instruction count',
    );
    p.instructions.forEach((instruction, j) => {
      const path = `processes.${i}.instructions.${j}`;
      if ('register' in instruction && !validId(instruction.register))
        issues.push({
          path,
          message:
            'Registers use 1–24 letters, digits, underscores or hyphens.',
        });
      switch (instruction.op) {
        case 'lock':
        case 'unlock':
          if (!input.mutexIds.includes(instruction.mutex))
            issues.push({
              path,
              message: `Unknown mutex ${instruction.mutex}.`,
            });
          break;
        case 'wait':
        case 'signal':
          if (!input.semaphores.some((s) => s.id === instruction.semaphore))
            issues.push({
              path,
              message: `Unknown semaphore ${instruction.semaphore}.`,
            });
          break;
        case 'add-local':
          if (!Number.isSafeInteger(instruction.value))
            issues.push({
              path,
              message: 'Local addend must be a safe integer.',
            });
          break;
        case 'enqueue':
          if (!instruction.value.trim() || instruction.value.length > 24)
            issues.push({
              path,
              message: 'Buffer values need 1–24 characters.',
            });
          break;
        case 'read-counter':
        case 'write-counter':
        case 'dequeue':
          break;
        default:
          issues.push({ path, message: 'Unknown instruction operation.' });
      }
      if (
        (instruction.op === 'enqueue' || instruction.op === 'dequeue') &&
        !input.mutexIds.includes('m')
      )
        issues.push({
          path,
          message: 'Buffer operations require the buffer mutex m.',
        });
    });
  });
  return validationError(issues);
}
