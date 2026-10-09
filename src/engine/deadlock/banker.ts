import {
  TRACE_EVENT_BUDGET,
  type EngineResponse,
  type ReplayFrame,
} from '../contracts';
import type {
  BankerEvent,
  BankerResult,
  BankerScenario,
  BankerSnapshot,
  BankerState,
  BankerStatus,
  UnsatisfiedProcess,
} from './types';
import { validateBanker } from './validation';
const vector = (values: readonly number[]) => Object.freeze([...values]);
const matrix = (values: readonly (readonly number[])[]) =>
  Object.freeze(values.map(vector));
export function deriveBanker(input: BankerScenario): BankerState {
  return Object.freeze({
    total: vector(input.total),
    allocation: matrix(input.allocation),
    max: matrix(input.max),
    available: vector(
      input.total.map(
        (n, j) =>
          n - input.allocation.reduce((sum, row) => sum + (row[j] ?? 0), 0),
      ),
    ),
    need: matrix(
      input.max.map((row, i) =>
        row.map((n, j) => n - (input.allocation[i]?.[j] ?? 0)),
      ),
    ),
  });
}
export function runBanker(
  input: BankerScenario,
  budget = TRACE_EVENT_BUDGET,
): EngineResponse<BankerResult> {
  const error = validateBanker(input);
  if (error) return { ok: false, error };
  const maxEvents = input.processIds.length + (input.request ? 3 : 1);
  if (
    !Number.isInteger(budget) ||
    budget < maxEvents ||
    budget > TRACE_EVENT_BUDGET
  )
    return {
      ok: false,
      error: {
        code: 'limit-exceeded',
        message:
          'The analysis exceeds the trace budget. Reduce processes or use the standard budget.',
        issues: [],
      },
    };
  const scenario: BankerScenario = Object.freeze({
    ...input,
    processIds: Object.freeze([...input.processIds]),
    resourceIds: Object.freeze([...input.resourceIds]),
    total: vector(input.total),
    allocation: matrix(input.allocation),
    max: matrix(input.max),
    ...(input.request
      ? {
          request: Object.freeze({
            processId: input.request.processId,
            amount: vector(input.request.amount),
          }),
        }
      : {}),
  });
  const initialState = deriveBanker(scenario);
  let actual = initialState,
    analyzed = initialState,
    work: readonly number[] = initialState.available;
  const finish = scenario.processIds.map(() => false),
    sequence: string[] = [];
  let status: BankerStatus = 'checking',
    stage: BankerSnapshot['stage'] = 'initial',
    unsatisfied: readonly UnsatisfiedProcess[] = Object.freeze([]);
  const events: BankerEvent[] = [],
    frames: ReplayFrame<BankerEvent, BankerSnapshot>[] = [];
  const snapshot = (): BankerSnapshot =>
    Object.freeze({
      step: events.length,
      stage,
      actual,
      analyzed,
      work,
      finish: Object.freeze([...finish]),
      sequence: Object.freeze([...sequence]),
      unsatisfied,
      status,
    });
  function emit(
    kind: BankerEvent['kind'],
    reason: string,
    processId: string | null = null,
    workBefore: readonly number[] = work,
    eligible: readonly string[] = [],
  ) {
    const event: BankerEvent = Object.freeze({
      seq: events.length,
      kind,
      explanationKey: `banker.${kind}`,
      reason,
      processId,
      workBefore,
      workAfter: work,
      eligible: Object.freeze([...eligible]),
    });
    events.push(event);
    frames.push(
      Object.freeze({ index: events.length, event, snapshot: snapshot() }),
    );
  }
  const result = (): EngineResponse<BankerResult> => ({
    ok: true,
    result: Object.freeze({
      engineVersion: '0.4.0',
      scenario,
      initialState,
      finalState: actual,
      events: Object.freeze(events),
      frames: Object.freeze(frames),
      summary: snapshot(),
      outcome:
        status === 'unsafe'
          ? 'unsafe'
          : status === 'wait-for-availability' || status === 'wait-for-safety'
            ? 'blocked'
            : 'completed',
    }),
  });
  frames.push(Object.freeze({ index: 0, event: null, snapshot: snapshot() }));
  const request = scenario.request;
  if (request) {
    const row = scenario.processIds.indexOf(request.processId);
    const invalid =
      row < 0 ||
      request.amount.length !== scenario.resourceIds.length ||
      request.amount.some((n) => !Number.isInteger(n) || n < 0);
    const beyond =
      row >= 0
        ? request.amount.findIndex(
            (n, j) => n > (initialState.need[row]?.[j] ?? 0),
          )
        : -1;
    if (invalid || beyond >= 0) {
      status = 'invalid';
      stage = 'decision';
      emit(
        'request-decision',
        invalid
          ? 'Invalid request: choose a known process and one nonnegative integer amount per resource. Actual state is unchanged.'
          : `Invalid request: ${request.processId} requests ${request.amount[beyond]} ${scenario.resourceIds[beyond]}, exceeding remaining Need ${initialState.need[row]?.[beyond]}. Actual state is unchanged.`,
        request.processId,
      );
      return result();
    }
    const unavailable = request.amount.findIndex(
      (n, j) => n > (initialState.available[j] ?? 0),
    );
    if (unavailable >= 0) {
      status = 'wait-for-availability';
      stage = 'decision';
      emit(
        'request-decision',
        `Wait for availability: ${request.processId} requests ${request.amount[unavailable]} ${scenario.resourceIds[unavailable]}, but only ${initialState.available[unavailable]} is available. No tentative allocation was made; actual state is unchanged.`,
        request.processId,
      );
      return result();
    }
    const tentativeAllocation = scenario.allocation.map((values, i) =>
      i === row ? values.map((n, j) => n + (request.amount[j] ?? 0)) : values,
    );
    analyzed = deriveBanker({ ...scenario, allocation: tentativeAllocation });
    work = analyzed.available;
    stage = 'tentative';
    emit(
      'request-tentative',
      `Tentatively allocate [${request.amount.join(', ')}] to ${request.processId}. Available becomes [${work.join(', ')}]; actual allocation remains unchanged while safety is checked.`,
      request.processId,
      initialState.available,
    );
  }
  stage = 'safety';
  while (sequence.length < scenario.processIds.length) {
    const eligibleIndices = scenario.processIds
      .map((_, i) => i)
      .filter(
        (i) =>
          !finish[i] && analyzed.need[i]?.every((n, j) => n <= (work[j] ?? 0)),
      );
    const chosen = eligibleIndices[0];
    if (chosen === undefined) {
      unsatisfied = Object.freeze(
        scenario.processIds.flatMap((processId, i) =>
          finish[i]
            ? []
            : [
                Object.freeze({
                  processId,
                  shortfalls: Object.freeze(
                    (analyzed.need[i] ?? []).flatMap((need, j) =>
                      need > (work[j] ?? 0)
                        ? [
                            Object.freeze({
                              resourceId: scenario.resourceIds[j] ?? '',
                              need,
                              work: work[j] ?? 0,
                            }),
                          ]
                        : [],
                    ),
                  ),
                }),
              ],
        ),
      );
      status = 'unsafe';
      emit(
        'banker-unsafe',
        `No unfinished process has Need ≤ Work [${work.join(', ')}]. Unfinished: ${unsatisfied.map((p) => p.processId).join(', ')}. This is unsafe, which does not establish current deadlock.`,
      );
      break;
    }
    const workBefore = work,
      processId = scenario.processIds[chosen] ?? '';
    work = vector(
      work.map((n, j) => n + (analyzed.allocation[chosen]?.[j] ?? 0)),
    );
    finish[chosen] = true;
    sequence.push(processId);
    emit(
      'banker-select',
      `${processId} is the lowest input-index unfinished eligible process: Need [${analyzed.need[chosen]?.join(', ')}] ≤ Work [${workBefore.join(', ')}]. Simulated completion releases Allocation [${analyzed.allocation[chosen]?.join(', ')}], so Work becomes [${work.join(', ')}]. Actual allocation is unchanged. Restart selection from the first input row.`,
      processId,
      workBefore,
      eligibleIndices.map((i) => scenario.processIds[i] ?? ''),
    );
  }
  if (sequence.length === scenario.processIds.length) {
    status = 'safe';
    emit(
      'banker-safe',
      `All processes can finish in order ${sequence.join(' → ')}. This is a potential safe sequence; actual allocations have not been released.`,
    );
  }
  if (request) {
    stage = 'decision';
    if (status === 'safe') {
      actual = analyzed;
      status = 'granted';
      emit(
        'request-decision',
        `Granted: the tentative state is safe. Commit ${request.processId}'s request atomically. Actual Available is [${actual.available.join(', ')}]; safe sequence ${sequence.join(' → ')}.`,
        request.processId,
      );
    } else {
      actual = initialState;
      status = 'wait-for-safety';
      emit(
        'request-decision',
        `Wait for safety: the tentative state has no safe sequence. Restore the exact original Allocation, Need, and Available [${actual.available.join(', ')}]. No resource grant is committed; this is not a deadlock conclusion.`,
        request.processId,
      );
    }
  }
  return result();
}
