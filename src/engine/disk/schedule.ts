import {
  TRACE_EVENT_BUDGET,
  type EngineResponse,
  type ReplayFrame,
} from '../contracts';
import type {
  DiskDirection,
  DiskEvent,
  DiskMove,
  DiskRequest,
  DiskResult,
  DiskScenario,
  DiskSnapshot,
} from './types';
import { DISK_ALGORITHMS, validateDisk } from './validation';
const freeze = <T>(values: readonly T[]) => Object.freeze([...values]);
export function scheduleDisk(
  input: DiskScenario,
  budget = TRACE_EVENT_BUDGET,
): EngineResponse<DiskResult> {
  const error = validateDisk(input);
  if (error) return { ok: false, error };
  const scenario: DiskScenario = Object.freeze({
    ...input,
    requests: freeze(input.requests.map((r) => Object.freeze({ ...r }))),
  });
  const events: DiskEvent[] = [],
    moves: DiskMove[] = [];
  let head = scenario.initialHead,
    direction = scenario.direction;
  const pending = [...scenario.requests];
  function move(
    target: DiskMove,
    reason: string,
    after: DiskDirection = direction,
    candidates: DiskEvent['candidates'] = [],
  ) {
    moves.push(Object.freeze(target));
    events.push(
      Object.freeze({
        ...target,
        seq: events.length,
        explanationKey: `disk.${target.kind}`,
        directionBefore: direction,
        directionAfter: after,
        reason,
        candidates: freeze(candidates.map((c) => Object.freeze({ ...c }))),
      }),
    );
    head = target.to;
    direction = after;
  }
  function service(
    request: DiskRequest,
    reason: string,
    candidates: DiskEvent['candidates'] = [],
  ) {
    move(
      {
        kind: 'service',
        requestId: request.id,
        from: head,
        to: request.cylinder,
        distance: Math.abs(head - request.cylinder),
      },
      reason,
      direction,
      candidates,
    );
    pending.splice(
      pending.findIndex((p) => p.id === request.id),
      1,
    );
  }
  if (scenario.algorithm === 'fcfs') {
    scenario.requests.forEach((r, i) =>
      service(
        r,
        `${r.id} is next in input order (row ${i + 1}). Move from ${head} to ${r.cylinder}: ${Math.abs(head - r.cylinder)} cylinders. FCFS does not promote a later request already at the head.`,
      ),
    );
  } else if (scenario.algorithm === 'sstf') {
    while (pending.length) {
      const ranked = pending
        .map((r, i) => ({
          ...r,
          index: i,
          distance: Math.abs(head - r.cylinder),
        }))
        .sort(
          (a, b) =>
            a.distance - b.distance ||
            a.cylinder - b.cylinder ||
            a.index - b.index,
        );
      const r = ranked[0]!;
      const ties = ranked.filter((c) => c.distance === r.distance);
      service(
        r,
        `${r.id} at cylinder ${r.cylinder} is closest to head ${head}, ${r.distance} cylinders away. ${ties.length > 1 ? `Equal-distance candidates: ${ties.map((c) => c.id).join(', ')}. Smaller cylinder wins, then original input order for duplicates.` : 'It is the unique closest request.'}`,
        ranked.map(({ id, cylinder, distance }) => ({
          id,
          cylinder,
          distance,
        })),
      );
    }
  } else {
    const sign = scenario.direction === 'higher' ? 1 : -1;
    const sorted = (requests: readonly DiskRequest[], ascending: boolean) =>
      requests
        .map((r, i) => ({ r, i }))
        .sort(
          (a, b) =>
            (ascending ? 1 : -1) * (a.r.cylinder - b.r.cylinder) || a.i - b.i,
        )
        .map(({ r }) => r);
    const atHead = pending.filter((r) => r.cylinder === scenario.initialHead);
    atHead.forEach((r) =>
      service(
        r,
        `${r.id} is already at initial head ${head}. Serve it with zero movement before the sweep; duplicates retain input order.`,
      ),
    );
    const first = sorted(
      pending.filter((r) => sign * (r.cylinder - scenario.initialHead) > 0),
      sign === 1,
    );
    const opposite = sorted(
      pending.filter((r) => sign * (r.cylinder - scenario.initialHead) < 0),
      scenario.algorithm === 'cscan' ? sign === 1 : sign !== 1,
    );
    const sweep = (r: DiskRequest) =>
      service(
        r,
        `${r.id} at ${r.cylinder} is next in the ${direction}-cylinder sweep from ${head}. Move ${Math.abs(head - r.cylinder)} cylinders; equal-cylinder requests keep input order.`,
      );
    first.forEach(sweep);
    if (opposite.length) {
      const endpoint = sign === 1 ? scenario.maxCylinder : 0;
      const reverse: DiskDirection = sign === 1 ? 'lower' : 'higher';
      move(
        {
          kind: 'endpoint',
          requestId: null,
          from: head,
          to: endpoint,
          distance: Math.abs(endpoint - head),
        },
        `Opposite-side requests remain. ${head === endpoint ? `The head is already at physical endpoint ${endpoint}; this endpoint decision adds zero cylinders.` : `Reach physical endpoint ${endpoint} from ${head}, adding ${Math.abs(endpoint - head)} cylinders.`} ${scenario.algorithm === 'scan' ? `Reverse to ${reverse} cylinders here.` : 'Continue with a circular wrap; endpoint travel counts.'} This is not a request service.`,
        scenario.algorithm === 'scan' ? reverse : direction,
      );
      if (scenario.algorithm === 'cscan') {
        const other = sign === 1 ? 0 : scenario.maxCylinder;
        move(
          {
            kind: 'wrap',
            requestId: null,
            from: head,
            to: other,
            distance: scenario.maxCylinder,
          },
          `Wrap from physical endpoint ${head} to ${other} without servicing requests along the wrap. All ${scenario.maxCylinder} cylinders count toward movement. Resume the ${direction}-cylinder sweep.`,
        );
      }
      opposite.forEach(sweep);
    }
  }
  if (
    !Number.isInteger(budget) ||
    budget < events.length ||
    budget > TRACE_EVENT_BUDGET
  )
    return {
      ok: false,
      error: {
        code: 'limit-exceeded',
        message: `This run requires ${events.length} moves. Increase the trace budget or reduce requests; no partial result was returned.`,
        issues: [],
      },
    };
  const frames: ReplayFrame<DiskEvent, DiskSnapshot>[] = [];
  let totalMovement = 0,
    endpointMovement = 0,
    wrapMovement = 0;
  const serviceOrder: string[] = [];
  const snapshot = (
    step: number,
    currentHead: number,
    activeDirection: DiskDirection,
  ): DiskSnapshot =>
    Object.freeze({
      step,
      head: currentHead,
      direction: activeDirection,
      serviceOrder: freeze(serviceOrder),
      pendingIds: freeze(
        scenario.requests
          .filter((r) => !serviceOrder.includes(r.id))
          .map((r) => r.id),
      ),
      totalMovement,
      averageMovement: serviceOrder.length
        ? totalMovement / serviceOrder.length
        : null,
      endpointMovement,
      wrapMovement,
      status:
        serviceOrder.length === scenario.requests.length
          ? 'completed'
          : step === 0
            ? 'ready'
            : 'in-progress',
    });
  frames.push(
    Object.freeze({
      index: 0,
      event: null,
      snapshot: snapshot(0, scenario.initialHead, scenario.direction),
    }),
  );
  events.forEach((event, i) => {
    totalMovement += event.distance;
    if (event.kind === 'service') serviceOrder.push(event.requestId);
    if (event.kind === 'endpoint') endpointMovement += event.distance;
    if (event.kind === 'wrap') wrapMovement += event.distance;
    frames.push(
      Object.freeze({
        index: i + 1,
        event,
        snapshot: snapshot(i + 1, event.to, event.directionAfter),
      }),
    );
  });
  return {
    ok: true,
    result: Object.freeze({
      engineVersion: '0.6.0',
      scenario,
      events: freeze(events),
      moves: freeze(moves),
      frames: freeze(frames),
      summary: frames[frames.length - 1]!.snapshot,
      headPath: freeze([scenario.initialHead, ...moves.map((m) => m.to)]),
      outcome: 'completed',
    }),
  };
}
export function compareDisk(
  input: DiskScenario,
): EngineResponse<readonly DiskResult[]> {
  const results: DiskResult[] = [];
  for (const algorithm of DISK_ALGORITHMS) {
    const response = scheduleDisk({ ...input, algorithm });
    if (!response.ok) return response;
    results.push(response.result);
  }
  return { ok: true, result: freeze(results) };
}
