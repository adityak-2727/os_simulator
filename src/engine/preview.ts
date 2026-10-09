import {
  TRACE_EVENT_BUDGET,
  type EngineResponse,
  type EventBase,
  type TraceResult,
  type ReplayFrame,
} from './contracts';

export interface PreviewInput {
  readonly firstDuration: number;
  readonly secondDuration: number;
}
export type PreviewProcess = 'P1' | 'P2';
export type PreviewEvent =
  | (EventBase<'fixture-queued'> & {
      readonly processIds: readonly PreviewProcess[];
    })
  | (EventBase<'fixture-started'> & { readonly processId: PreviewProcess })
  | (EventBase<'fixture-finished'> & {
      readonly processId: PreviewProcess;
      readonly duration: number;
    });
export interface PreviewSegment {
  readonly processId: PreviewProcess;
  readonly start: number;
  readonly end: number;
}
export interface PreviewSnapshot {
  readonly simTime: number;
  readonly ready: readonly PreviewProcess[];
  readonly running: PreviewProcess | null;
  readonly completed: readonly PreviewProcess[];
  readonly segments: readonly PreviewSegment[];
}
export type PreviewResult = TraceResult<PreviewEvent, PreviewSnapshot> & {
  readonly input: PreviewInput;
  readonly duration: number;
};

/** Scripted P1 then P2 transitions for infrastructure verification; not a scheduler. */
export function createPreview(
  input: PreviewInput,
  budget = TRACE_EVENT_BUDGET,
): EngineResponse<PreviewResult> {
  const issues = (['firstDuration', 'secondDuration'] as const).flatMap(
    (path) =>
      Number.isInteger(input[path]) && input[path] >= 1 && input[path] <= 20
        ? []
        : [{ path, message: 'Enter a whole number from 1 to 20 time units.' }],
  );
  if (issues.length)
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'Check the fixture durations.',
        issues,
      },
    };
  if (budget < 5)
    return {
      ok: false,
      error: {
        code: 'limit-exceeded',
        message: 'This preview requires a budget of at least 5 events.',
        issues: [],
      },
    };
  const duration = input.firstDuration + input.secondDuration;
  const events: readonly PreviewEvent[] = Object.freeze([
    Object.freeze({
      seq: 0,
      kind: 'fixture-queued',
      simTime: 0,
      explanationKey: 'preview.queued',
      processIds: Object.freeze(['P1', 'P2'] as const),
    }),
    Object.freeze({
      seq: 1,
      kind: 'fixture-started',
      simTime: 0,
      explanationKey: 'preview.started',
      processId: 'P1',
    }),
    Object.freeze({
      seq: 2,
      kind: 'fixture-finished',
      simTime: input.firstDuration,
      explanationKey: 'preview.finished',
      processId: 'P1',
      duration: input.firstDuration,
    }),
    Object.freeze({
      seq: 3,
      kind: 'fixture-started',
      simTime: input.firstDuration,
      explanationKey: 'preview.started',
      processId: 'P2',
    }),
    Object.freeze({
      seq: 4,
      kind: 'fixture-finished',
      simTime: duration,
      explanationKey: 'preview.finished',
      processId: 'P2',
      duration: input.secondDuration,
    }),
  ]);
  let snapshot: PreviewSnapshot = Object.freeze({
    simTime: 0,
    ready: Object.freeze([]),
    running: null,
    completed: Object.freeze([]),
    segments: Object.freeze([]),
  });
  const frames: ReplayFrame<PreviewEvent, PreviewSnapshot>[] = [
    Object.freeze({ index: 0, event: null, snapshot }),
  ];
  for (const event of events) {
    switch (event.kind) {
      case 'fixture-queued':
        snapshot = { ...snapshot, ready: event.processIds };
        break;
      case 'fixture-started':
        snapshot = {
          ...snapshot,
          running: event.processId,
          ready: Object.freeze(
            snapshot.ready.filter((id) => id !== event.processId),
          ),
        };
        break;
      case 'fixture-finished':
        snapshot = {
          ...snapshot,
          running: null,
          completed: Object.freeze([...snapshot.completed, event.processId]),
          segments: Object.freeze([
            ...snapshot.segments,
            Object.freeze({
              processId: event.processId,
              start: (event.simTime ?? 0) - event.duration,
              end: event.simTime ?? 0,
            }),
          ]),
        };
        break;
    }
    snapshot = Object.freeze({
      ...snapshot,
      simTime: event.simTime ?? snapshot.simTime,
    });
    frames.push(Object.freeze({ index: event.seq + 1, event, snapshot }));
  }
  return {
    ok: true,
    result: Object.freeze({
      engineVersion: '0.1.0-preview',
      input: Object.freeze({ ...input }),
      duration,
      events,
      frames: Object.freeze(frames),
      outcome: 'completed',
    }),
  };
}
