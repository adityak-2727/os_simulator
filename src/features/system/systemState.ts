import {
  initialReplay,
  replayReducer,
  type ReplayState,
  type ReplayAction,
} from '../../app/replay';
import type { EngineError, EngineResponse } from '../../engine/contracts';
import type {
  SystemScenario,
  SystemInstruction,
  SystemResult,
} from '../../engine/system/types';
import { validateSystem } from '../../engine/system/validation';
import { runSystem } from '../../engine/system/schedule';
export interface SystemDraft {
  readonly name: string;
  readonly capacity: string;
  readonly quantum: string;
  readonly resources: string;
  readonly processes: readonly {
    readonly id: string;
    readonly arrival: string;
    readonly memory: string;
    readonly code: string;
  }[];
}
export function systemExample(
  kind: 'reference' | 'cycle' | 'idle' = 'reference',
): SystemScenario {
  if (kind === 'cycle')
    return {
      kind: 'system',
      totalKiB: 64,
      algorithm: 'rr',
      quantum: 1,
      resources: [
        { id: 'R1', instances: 1 },
        { id: 'R2', instances: 1 },
      ],
      processes: [
        {
          id: 'P1',
          arrival: 0,
          memoryKiB: 32,
          program: [
            { op: 'acquire', resourceId: 'R1' },
            { op: 'cpu', duration: 2 },
            { op: 'acquire', resourceId: 'R2' },
            { op: 'cpu', duration: 1 },
          ],
        },
        {
          id: 'P2',
          arrival: 0,
          memoryKiB: 32,
          program: [
            { op: 'acquire', resourceId: 'R2' },
            { op: 'cpu', duration: 2 },
            { op: 'acquire', resourceId: 'R1' },
            { op: 'cpu', duration: 1 },
          ],
        },
      ],
    };
  if (kind === 'idle')
    return {
      kind: 'system',
      totalKiB: 32,
      algorithm: 'rr',
      quantum: 2,
      resources: [],
      processes: [
        {
          id: 'P1',
          arrival: 3,
          memoryKiB: 32,
          program: [{ op: 'cpu', duration: 2 }],
        },
        {
          id: 'P2',
          arrival: 8,
          memoryKiB: 16,
          program: [{ op: 'cpu', duration: 1 }],
        },
      ],
    };
  return {
    kind: 'system',
    totalKiB: 96,
    algorithm: 'rr',
    quantum: 2,
    resources: [{ id: 'R1', instances: 1 }],
    processes: [
      {
        id: 'P1',
        arrival: 0,
        memoryKiB: 64,
        program: [
          { op: 'acquire', resourceId: 'R1' },
          { op: 'cpu', duration: 4 },
          { op: 'release', resourceId: 'R1' },
          { op: 'cpu', duration: 1 },
        ],
      },
      {
        id: 'P2',
        arrival: 1,
        memoryKiB: 32,
        program: [
          { op: 'acquire', resourceId: 'R1' },
          { op: 'cpu', duration: 2 },
          { op: 'release', resourceId: 'R1' },
        ],
      },
      {
        id: 'P3',
        arrival: 2,
        memoryKiB: 32,
        program: [{ op: 'cpu', duration: 1 }],
      },
    ],
  };
}
export function systemDraft(
  s: SystemScenario,
  name = 'CPU, memory and resource contention',
): SystemDraft {
  return {
    name,
    capacity: String(s.totalKiB),
    quantum: String(s.quantum),
    resources: s.resources.map((r) => r.id).join(', '),
    processes: s.processes.map((p) => ({
      id: p.id,
      arrival: String(p.arrival),
      memory: String(p.memoryKiB),
      code: p.program
        .map((x) =>
          x.op === 'cpu' ? `cpu ${x.duration}` : `${x.op} ${x.resourceId}`,
        )
        .join('\n'),
    })),
  };
}
const number = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);
export function parseSystem(d: SystemDraft): EngineResponse<SystemScenario> {
  const issues: { path: string; message: string }[] = [];
  if (!d.name.trim() || d.name.trim().length > 80)
    issues.push({
      path: 'name',
      message: 'Name must contain 1–80 characters.',
    });
  const processes = d.processes.map((p, i) => {
    const program: SystemInstruction[] = [];
    p.code.split('\n').forEach((line, j) => {
      if (!line.trim()) return;
      const [op, arg, ...rest] = line.trim().split(/\s+/);
      if (arg && !rest.length && op === 'cpu')
        program.push({ op, duration: number(arg) });
      else if (arg && !rest.length && (op === 'acquire' || op === 'release'))
        program.push({ op, resourceId: arg });
      else
        issues.push({
          path: `processes.${i}.program`,
          message: `${p.id} line ${j + 1}: use cpu <duration>, acquire <resource> or release <resource>.`,
        });
    });
    return {
      id: p.id,
      arrival: number(p.arrival),
      memoryKiB: number(p.memory),
      program,
    };
  });
  const result: SystemScenario = {
    kind: 'system',
    algorithm: 'rr',
    totalKiB: number(d.capacity),
    quantum: number(d.quantum),
    resources: (d.resources.trim()
      ? d.resources.trim().split(/[\s,]+/)
      : []
    ).map((id) => ({ id, instances: 1 })),
    processes,
  };
  issues.push(...(validateSystem(result)?.issues ?? []));
  return issues.length
    ? {
        ok: false,
        error: {
          code: 'validation',
          message: 'Correct the integrated inputs before running.',
          issues,
        },
      }
    : { ok: true, result };
}
export interface SystemState {
  readonly draft: SystemDraft;
  readonly result: SystemResult | null;
  readonly replay: ReplayState;
  readonly changed: boolean;
  readonly error: EngineError | null;
}
export type SystemAction =
  | { type: 'edit'; draft: SystemDraft }
  | { type: 'load'; scenario: SystemScenario; name: string }
  | { type: 'run' }
  | { type: 'replay'; action: ReplayAction };
export function createSystemState(): SystemState {
  const draft = systemDraft(systemExample()),
    r = runSystem(systemExample());
  return {
    draft,
    result: r.ok ? r.result : null,
    error: r.ok ? null : r.error,
    replay: initialReplay,
    changed: false,
  };
}
export function systemReducer(s: SystemState, a: SystemAction): SystemState {
  switch (a.type) {
    case 'edit':
      return {
        ...s,
        draft: a.draft,
        result: null,
        error: null,
        changed: true,
        replay: { ...s.replay, cursor: 0, playing: false },
      };
    case 'load':
      return systemReducer(s, {
        type: 'edit',
        draft: systemDraft(a.scenario, a.name),
      });
    case 'replay':
      return {
        ...s,
        replay: replayReducer(s.replay, a.action, s.result?.frames.length ?? 0),
      };
    case 'run': {
      const parsed = parseSystem(s.draft),
        r = s.result
          ? { ok: true as const, result: s.result }
          : parsed.ok
            ? runSystem(parsed.result)
            : parsed;
      if (!r.ok)
        return {
          ...s,
          error: r.error,
          replay: { ...s.replay, playing: false },
        };
      return {
        ...s,
        result: r.result,
        error: null,
        changed: false,
        replay: replayReducer(
          s.replay,
          { type: 'play' },
          r.result.frames.length,
        ),
      };
    }
  }
}
