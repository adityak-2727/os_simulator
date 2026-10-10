import type { EngineResponse } from '../engine/contracts';
import type { Scenario } from '../engine/scenarios';
import { validateCpuScenario } from '../engine/cpu/validation';
import {
  validateAllocation,
  validatePaging,
} from '../engine/memory/validation';
import { validateGraph, validateBanker } from '../engine/deadlock/validation';
import { validateSync } from '../engine/synchronization/validation';
import { validateDisk } from '../engine/disk/validation';
import { validateSystem } from '../engine/system/validation';
import type { SystemInstruction } from '../engine/system/types';
import type { SyncInstruction } from '../engine/synchronization/types';
export interface ExperimentV1 {
  readonly format: 'os-lab-simulator';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly engineVersion: string;
  readonly scenario: Scenario;
}
export const MAX_JSON_BYTES = 1048576;
export const ENGINE_VERSIONS: Readonly<Record<Scenario['kind'], string>> = {
  cpu: '0.2.0',
  allocation: '0.3.0',
  paging: '0.3.0',
  deadlock: '0.4.0',
  synchronization: '0.5.0',
  disk: '0.6.0',
  system: '1.0.0',
};
class InputError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(message);
  }
}
const fail = (path: string, message: string): never => {
  throw new InputError(path, message);
};
function object(v: unknown, path: string): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail(path, 'Expected an object.');
}
function text(v: unknown, path: string) {
  return typeof v === 'string' ? v : fail(path, 'Expected text.');
}
function number(v: unknown, path: string) {
  return typeof v === 'number' && Number.isFinite(v) && !Object.is(v, -0)
    ? v
    : fail(
        path,
        'Expected a finite number (numeric strings are not accepted).',
      );
}
function list(v: unknown, path: string): unknown[] {
  return Array.isArray(v) ? v : fail(path, 'Expected an array.');
}
function choice<const T extends string>(
  v: unknown,
  values: readonly T[],
  path: string,
): T {
  return (
    values.find((x) => x === v) ?? fail(path, `Choose ${values.join(', ')}.`)
  );
}
function strings(v: unknown, p: string) {
  return list(v, p).map((x, i) => text(x, `${p}.${i}`));
}
function numbers(v: unknown, p: string) {
  return list(v, p).map((x, i) => number(x, `${p}.${i}`));
}
function systemInstruction(v: unknown, p: string): SystemInstruction {
  const x = object(v, p),
    op = choice(x.op, ['cpu', 'acquire', 'release'], `${p}.op`);
  return op === 'cpu'
    ? { op, duration: number(x.duration, `${p}.duration`) }
    : { op, resourceId: text(x.resourceId, `${p}.resourceId`) };
}
function syncInstruction(v: unknown, p: string): SyncInstruction {
  const x = object(v, p),
    op = choice(
      x.op,
      [
        'read-counter',
        'write-counter',
        'add-local',
        'lock',
        'unlock',
        'wait',
        'signal',
        'enqueue',
        'dequeue',
      ],
      `${p}.op`,
    );
  switch (op) {
    case 'read-counter':
    case 'write-counter':
    case 'dequeue':
      return { op, register: text(x.register, `${p}.register`) };
    case 'add-local':
      return {
        op,
        register: text(x.register, `${p}.register`),
        value: number(x.value, `${p}.value`),
      };
    case 'lock':
    case 'unlock':
      return { op, mutex: text(x.mutex, `${p}.mutex`) };
    case 'wait':
    case 'signal':
      return { op, semaphore: text(x.semaphore, `${p}.semaphore`) };
    case 'enqueue':
      return { op, value: text(x.value, `${p}.value`) };
  }
}
function readScenario(v: unknown): Scenario {
  const x = object(v, 'scenario'),
    kind = choice(
      x.kind,
      [
        'cpu',
        'allocation',
        'paging',
        'deadlock',
        'synchronization',
        'disk',
        'system',
      ],
      'scenario.kind',
    );
  switch (kind) {
    case 'cpu':
      return {
        kind,
        algorithm: choice(
          x.algorithm,
          ['fcfs', 'sjf', 'priority', 'rr'],
          'algorithm',
        ),
        quantum: number(x.quantum, 'quantum'),
        contextSwitchCost:
          x.contextSwitchCost === 0
            ? 0
            : fail('contextSwitchCost', 'Use zero context-switch cost.'),
        processes: list(x.processes, 'processes').map((v, i) => {
          const p = object(v, `processes.${i}`);
          return {
            id: text(p.id, `processes.${i}.id`),
            arrival: number(p.arrival, `processes.${i}.arrival`),
            burst: number(p.burst, `processes.${i}.burst`),
            priority: number(p.priority, `processes.${i}.priority`),
          };
        }),
      };
    case 'allocation':
      return {
        kind,
        totalKiB: number(x.totalKiB, 'totalKiB'),
        strategy: choice(
          x.strategy,
          ['first-fit', 'best-fit', 'worst-fit'],
          'strategy',
        ),
        operations: list(x.operations, 'operations').map((v, i) => {
          const o = object(v, `operations.${i}`),
            kind = choice(o.kind, ['allocate', 'free'], `operations.${i}.kind`),
            id = text(o.id, `operations.${i}.id`);
          return kind === 'free'
            ? { kind, id }
            : {
                kind,
                id,
                sizeKiB: number(o.sizeKiB, `operations.${i}.sizeKiB`),
              };
        }),
      };
    case 'paging':
      return {
        kind,
        frames: number(x.frames, 'frames'),
        algorithm: choice(x.algorithm, ['fifo', 'lru', 'optimal'], 'algorithm'),
        references: numbers(x.references, 'references'),
      };
    case 'disk':
      return {
        kind,
        minCylinder:
          x.minCylinder === 0
            ? 0
            : fail('minCylinder', 'Minimum cylinder must be zero.'),
        maxCylinder: number(x.maxCylinder, 'maxCylinder'),
        initialHead: number(x.initialHead, 'initialHead'),
        direction: choice(x.direction, ['higher', 'lower'], 'direction'),
        algorithm: choice(
          x.algorithm,
          ['fcfs', 'sstf', 'scan', 'cscan'],
          'algorithm',
        ),
        requests: list(x.requests, 'requests').map((v, i) => {
          const r = object(v, `requests.${i}`);
          return {
            id: text(r.id, `requests.${i}.id`),
            cylinder: number(r.cylinder, `requests.${i}.cylinder`),
          };
        }),
      };
    case 'system':
      return {
        kind,
        algorithm: choice(x.algorithm, ['rr'], 'algorithm'),
        totalKiB: number(x.totalKiB, 'totalKiB'),
        quantum: number(x.quantum, 'quantum'),
        resources: list(x.resources, 'resources').map((v, i) => {
          const r = object(v, `resources.${i}`);
          return {
            id: text(r.id, `resources.${i}.id`),
            instances:
              r.instances === 1
                ? 1
                : fail(`resources.${i}.instances`, 'Use one instance.'),
          };
        }),
        processes: list(x.processes, 'processes').map((v, i) => {
          const p = object(v, `processes.${i}`);
          return {
            id: text(p.id, `processes.${i}.id`),
            arrival: number(p.arrival, `processes.${i}.arrival`),
            memoryKiB: number(p.memoryKiB, `processes.${i}.memoryKiB`),
            program: list(p.program, `processes.${i}.program`).map((a, j) =>
              systemInstruction(a, `processes.${i}.program.${j}`),
            ),
          };
        }),
      };
    case 'synchronization':
      return {
        kind,
        preset: choice(
          x.preset,
          ['counter-race', 'counter-mutex', 'producer-consumer'],
          'preset',
        ),
        initialCounter: number(x.initialCounter, 'initialCounter'),
        capacity: number(x.capacity, 'capacity'),
        mutexIds: strings(x.mutexIds, 'mutexIds'),
        semaphores: list(x.semaphores, 'semaphores').map((v, i) => {
          const s = object(v, `semaphores.${i}`);
          return {
            id: text(s.id, `semaphores.${i}.id`),
            initial: number(s.initial, `semaphores.${i}.initial`),
          };
        }),
        schedule: strings(x.schedule, 'schedule'),
        processes: list(x.processes, 'processes').map((v, i) => {
          const p = object(v, `processes.${i}`);
          return {
            id: text(p.id, `processes.${i}.id`),
            instructions: list(
              p.instructions,
              `processes.${i}.instructions`,
            ).map((a, j) =>
              syncInstruction(a, `processes.${i}.instructions.${j}`),
            ),
          };
        }),
      };
    case 'deadlock': {
      const mode = choice(x.mode, ['graph', 'banker'], 'mode'),
        processIds = strings(x.processIds, 'processIds'),
        resourceIds = strings(x.resourceIds, 'resourceIds');
      if (mode === 'graph') {
        const bindings = (v: unknown, p: string) =>
          list(v, p).map((v, i) => {
            const b = object(v, `${p}.${i}`);
            return {
              processId: text(b.processId, `${p}.${i}.processId`),
              resourceId: text(b.resourceId, `${p}.${i}.resourceId`),
            };
          });
        return {
          kind,
          mode,
          processIds,
          resourceIds,
          allocations: bindings(x.allocations, 'allocations'),
          requests: bindings(x.requests, 'requests'),
        };
      }
      const matrix = (v: unknown, p: string) =>
        list(v, p).map((row, i) => numbers(row, `${p}.${i}`));
      const request =
        x.request === undefined ? undefined : object(x.request, 'request');
      return {
        kind,
        mode,
        processIds,
        resourceIds,
        total: numbers(x.total, 'total'),
        allocation: matrix(x.allocation, 'allocation'),
        max: matrix(x.max, 'max'),
        ...(request
          ? {
              request: {
                processId: text(request.processId, 'request.processId'),
                amount: numbers(request.amount, 'request.amount'),
              },
            }
          : {}),
      };
    }
  }
}
export function validateScenario(v: unknown): EngineResponse<Scenario> {
  try {
    const result = readScenario(v);
    let error;
    switch (result.kind) {
      case 'cpu':
        error = validateCpuScenario(result);
        if (
          !Number.isInteger(result.quantum) ||
          result.quantum < 1 ||
          result.quantum > 1000
        )
          fail('quantum', 'Stored quantum must be an integer from 1 to 1000.');
        break;
      case 'allocation':
        error = validateAllocation(result);
        break;
      case 'paging':
        error = validatePaging(result);
        break;
      case 'deadlock':
        error =
          result.mode === 'graph'
            ? validateGraph(result)
            : validateBanker(result);
        if (result.mode === 'banker' && result.request) {
          if (
            !result.processIds.includes(result.request.processId) ||
            result.request.amount.length !== result.resourceIds.length ||
            result.request.amount.some(
              (n) => !Number.isInteger(n) || n < 0 || n > 1000,
            )
          )
            fail(
              'request',
              'Request needs a known process and one nonnegative integer per resource (0–1000).',
            );
        }
        break;
      case 'synchronization':
        error = validateSync(result);
        break;
      case 'disk':
        error = validateDisk(result);
        break;
      case 'system':
        error = validateSystem(result);
        break;
    }
    return error ? { ok: false, error } : { ok: true, result };
  } catch (e) {
    if (e instanceof InputError)
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'Invalid scenario.',
          issues: [{ path: e.path, message: e.message }],
        },
      };
    throw e;
  }
}
export function validateExperiment(v: unknown): EngineResponse<ExperimentV1> {
  try {
    const x = object(v, 'experiment');
    if (x.format !== 'os-lab-simulator')
      fail(
        'format',
        'Use an OS Lab Simulator experiment, not a fixture oracle.',
      );
    if (x.schemaVersion !== 1)
      fail(
        'schemaVersion',
        'Only schema version 1 is supported. Export from a compatible version.',
      );
    const id = text(x.id, 'id'),
      name = text(x.name, 'name').trim(),
      createdAt = text(x.createdAt, 'createdAt'),
      updatedAt = text(x.updatedAt, 'updatedAt'),
      engineVersion = text(x.engineVersion, 'engineVersion');
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id))
      fail(
        'id',
        'Experiment ID must use 1–80 letters, digits, underscores or hyphens.',
      );
    if (!name || name.length > 80)
      fail('name', 'Name must contain 1–80 characters.');
    for (const [p, t] of [
      ['createdAt', createdAt],
      ['updatedAt', updatedAt],
    ])
      if (
        !t ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(t) ||
        !Number.isFinite(Date.parse(t)) ||
        new Date(t).toISOString().slice(0, 19) !== t.slice(0, 19)
      )
        fail(p ?? 'date', 'Use a valid UTC ISO timestamp.');
    if (!/^\d+\.\d+\.\d+$/.test(engineVersion))
      fail('engineVersion', 'Use an engine semantic version.');
    const scenario = validateScenario(x.scenario);
    return scenario.ok
      ? {
          ok: true,
          result: {
            format: 'os-lab-simulator',
            schemaVersion: 1,
            id,
            name,
            createdAt,
            updatedAt,
            engineVersion,
            scenario: scenario.result,
          },
        }
      : scenario;
  } catch (e) {
    if (e instanceof InputError)
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'Invalid experiment envelope.',
          issues: [{ path: e.path, message: e.message }],
        },
      };
    throw e;
  }
}
export function parseExperiment(json: string): EngineResponse<ExperimentV1> {
  if (new TextEncoder().encode(json).length > MAX_JSON_BYTES)
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'JSON exceeds the 1 MiB import limit.',
        issues: [],
      },
    };
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'Malformed JSON. Choose a valid experiment JSON file.',
        issues: [],
      },
    };
  }
  return validateExperiment(v);
}
export function csv(
  rows: readonly (readonly (string | number | null)[])[],
): string {
  return (
    rows
      .map((row) =>
        row
          .map((v) => {
            let s = v === null ? '' : String(v);
            if (/^\s*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = `'${s}`;
            return `"${s.replaceAll('"', '""')}"`;
          })
          .join(','),
      )
      .join('\r\n') + '\r\n'
  );
}
