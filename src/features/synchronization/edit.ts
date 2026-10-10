import type { EngineResponse } from '../../engine/contracts';
import type {
  SyncInstruction,
  SyncScenario,
} from '../../engine/synchronization/types';
import { validateSync } from '../../engine/synchronization/validation';
import { instructionText } from './presets';
export interface SyncDraft {
  preset: SyncScenario['preset'];
  initialCounter: string;
  capacity: string;
  mutexIds: string;
  semaphores: string;
  processes: readonly { id: string; code: string }[];
  schedule: string;
}
export const numberField = (text: string) =>
  /^-?\d+$/.test(text.trim()) ? Number(text) : NaN;
const ids = (text: string) => (text.trim() ? text.trim().split(/[\s,]+/) : []);
export function draftFrom(scenario: SyncScenario): SyncDraft {
  return {
    preset: scenario.preset,
    initialCounter: String(scenario.initialCounter),
    capacity: String(scenario.capacity),
    mutexIds: scenario.mutexIds.join(', '),
    semaphores: scenario.semaphores
      .map((s) => `${s.id} ${s.initial}`)
      .join('\n'),
    processes: scenario.processes.map((p) => ({
      id: p.id,
      code: p.instructions.map(instructionText).join('\n'),
    })),
    schedule: scenario.schedule.join(', '),
  };
}
export function parseSync(draft: SyncDraft): EngineResponse<SyncScenario> {
  const issues: { path: string; message: string }[] = [];
  const processes = draft.processes.map((p, i) => {
    const instructions: SyncInstruction[] = [];
    p.code.split('\n').forEach((line, j) => {
      if (!line.trim()) return;
      const [op, a, b, ...rest] = line.trim().split(/\s+/);
      let instruction: SyncInstruction | null = null;
      if (a && b === undefined) {
        switch (op) {
          case 'read-counter':
          case 'write-counter':
          case 'dequeue':
            instruction = { op, register: a };
            break;
          case 'lock':
          case 'unlock':
            instruction = { op, mutex: a };
            break;
          case 'wait':
          case 'signal':
            instruction = { op, semaphore: a };
            break;
        }
      }
      if (op === 'add-local' && a && b && rest.length === 0)
        instruction = { op, register: a, value: numberField(b) };
      if (op === 'enqueue' && a)
        instruction = { op, value: [a, ...(b ? [b] : []), ...rest].join(' ') };
      if (instruction) instructions.push(instruction);
      else
        issues.push({
          path: `processes.${i}.code`,
          message: `${p.id} line ${j + 1}: unknown instruction or wrong arguments. Use the instruction reference below.`,
        });
    });
    return { id: p.id, instructions };
  });
  const semaphores = draft.semaphores
    .split('\n')
    .filter((l) => l.trim())
    .map((line, i) => {
      const [id, initial, ...rest] = line.trim().split(/\s+/);
      if (!id || !initial || rest.length)
        issues.push({
          path: 'semaphores',
          message: `Semaphore line ${i + 1} needs an ID and integer count.`,
        });
      return { id: id ?? '', initial: numberField(initial ?? '') };
    });
  const result: SyncScenario = {
    kind: 'synchronization',
    preset: draft.preset,
    initialCounter: numberField(draft.initialCounter),
    capacity: numberField(draft.capacity),
    mutexIds: ids(draft.mutexIds),
    semaphores,
    processes,
    schedule: ids(draft.schedule),
  };
  if (issues.length)
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'Correct the instruction syntax before running.',
        issues,
      },
    };
  const error = validateSync(result);
  return error ? { ok: false, error } : { ok: true, result };
}
