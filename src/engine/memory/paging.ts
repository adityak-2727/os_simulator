import {
  TRACE_EVENT_BUDGET,
  type EngineResponse,
  type ReplayFrame,
} from '../contracts';
import type {
  PageCandidate,
  PagingEvent,
  PagingResult,
  PagingScenario,
  PagingSnapshot,
} from './types';
import { PAGING_ALGORITHMS, validatePaging } from './validation';

export function replacePages(
  input: PagingScenario,
  budget = TRACE_EVENT_BUDGET,
): EngineResponse<PagingResult> {
  const error = validatePaging(input);
  if (error) return { ok: false, error };
  if (
    !Number.isInteger(budget) ||
    budget < input.references.length ||
    budget > TRACE_EVENT_BUDGET
  )
    return {
      ok: false,
      error: {
        code: 'limit-exceeded',
        message:
          'The reference sequence exceeds the trace budget. Reduce references.',
        issues: [],
      },
    };
  const scenario = Object.freeze({
    ...input,
    references: Object.freeze([...input.references]),
  });
  const pages: (number | null)[] = Array.from(
    { length: input.frames },
    () => null,
  );
  const insertedAt = [...pages],
    lastAccess = [...pages];
  let hits = 0,
    faults = 0;
  const events: PagingEvent[] = [];
  const frames: ReplayFrame<PagingEvent, PagingSnapshot>[] = [];
  const snapshot = (step: number): PagingSnapshot =>
    Object.freeze({
      step,
      pages: Object.freeze([...pages]),
      insertedAt: Object.freeze([...insertedAt]),
      lastAccess: Object.freeze([...lastAccess]),
      hits,
      faults,
      processed: step,
      hitRatio: step ? hits / step : null,
      faultRatio: step ? faults / step : null,
    });
  frames.push(Object.freeze({ index: 0, event: null, snapshot: snapshot(0) }));
  for (const [referenceIndex, page] of scenario.references.entries()) {
    let frameIndex = pages.indexOf(page);
    const hit = frameIndex >= 0;
    let evicted: number | null = null,
      reason: string;
    const candidates: PageCandidate[] = [];
    if (hit) {
      hits++;
      reason = `Page ${page} is already in frame ${frameIndex}: hit. Frame contents are unchanged. Last access becomes reference #${referenceIndex + 1}; FIFO insertion order is unchanged.`;
    } else {
      faults++;
      frameIndex = pages.indexOf(null);
      if (frameIndex >= 0)
        reason = `Page ${page} faults. Fill frame ${frameIndex}, the lowest-index empty frame; no page is evicted.`;
      else {
        pages.forEach((resident, index) => {
          if (resident === null) return;
          const next = scenario.references.indexOf(
            resident,
            referenceIndex + 1,
          );
          candidates.push(
            Object.freeze({
              frameIndex: index,
              page: resident,
              insertedAt: insertedAt[index] ?? 0,
              lastAccess: lastAccess[index] ?? 0,
              nextUse: next < 0 ? null : next,
            }),
          );
        });
        const ranked = [...candidates].sort((a, b) => {
          if (scenario.algorithm === 'fifo')
            return a.insertedAt - b.insertedAt || a.frameIndex - b.frameIndex;
          if (scenario.algorithm === 'lru')
            return a.lastAccess - b.lastAccess || a.frameIndex - b.frameIndex;
          const an = a.nextUse ?? Infinity,
            bn = b.nextUse ?? Infinity;
          return an === bn ? a.frameIndex - b.frameIndex : an > bn ? -1 : 1;
        });
        const victim = ranked[0];
        if (!victim)
          return {
            ok: false,
            error: {
              code: 'validation',
              message: 'No eviction candidate exists for this frame set.',
              issues: [],
            },
          };
        frameIndex = victim.frameIndex;
        evicted = victim.page;
        const rule =
          scenario.algorithm === 'fifo'
            ? `oldest insertion at reference #${victim.insertedAt + 1}; hits do not reorder FIFO`
            : scenario.algorithm === 'lru'
              ? `oldest last access at reference #${victim.lastAccess + 1}`
              : victim.nextUse === null
                ? 'no future use (infinity); lowest frame index breaks ties'
                : `farthest next use at reference #${victim.nextUse + 1}`;
        reason = `Page ${page} faults. Evict page ${evicted} from frame ${frameIndex}: ${rule}.`;
      }
      pages[frameIndex] = page;
      insertedAt[frameIndex] = referenceIndex;
    }
    lastAccess[frameIndex] = referenceIndex;
    const nextSnapshot = snapshot(referenceIndex + 1);
    const event: PagingEvent = Object.freeze({
      seq: referenceIndex,
      kind: hit ? 'page-hit' : 'page-fault',
      explanationKey: hit ? 'paging.hit' : 'paging.fault',
      referenceIndex,
      page,
      hit,
      frameIndex,
      evicted,
      frames: nextSnapshot.pages,
      candidates: Object.freeze(candidates),
      reason,
    });
    events.push(event);
    frames.push(
      Object.freeze({
        index: referenceIndex + 1,
        event,
        snapshot: nextSnapshot,
      }),
    );
  }
  return {
    ok: true,
    result: Object.freeze({
      engineVersion: '0.3.0',
      scenario,
      events: Object.freeze(events),
      frames: Object.freeze(frames),
      summary: snapshot(events.length),
      outcome: 'completed',
    }),
  };
}
export function comparePaging(
  input: PagingScenario,
): EngineResponse<readonly PagingResult[]> {
  const results: PagingResult[] = [];
  for (const algorithm of PAGING_ALGORITHMS) {
    const response = replacePages({ ...input, algorithm });
    if (!response.ok) return response;
    results.push(response.result);
  }
  return { ok: true, result: Object.freeze(results) };
}
