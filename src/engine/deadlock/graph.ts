import {
  TRACE_EVENT_BUDGET,
  type EngineResponse,
  type ReplayFrame,
} from '../contracts';
import type {
  GraphCommand,
  GraphEdge,
  GraphEvent,
  GraphNode,
  GraphResult,
  GraphScenario,
  GraphSnapshot,
} from './types';
import { validateGraph } from './validation';
export const nodeKey = (node: GraphNode) => `${node.kind}:${node.id}`;
function freezeGraph(input: GraphScenario): GraphScenario {
  return Object.freeze({
    ...input,
    processIds: Object.freeze([...input.processIds]),
    resourceIds: Object.freeze([...input.resourceIds]),
    allocations: Object.freeze(
      input.allocations.map((e) => Object.freeze({ ...e })),
    ),
    requests: Object.freeze(input.requests.map((e) => Object.freeze({ ...e }))),
  });
}
export function graphEdges(input: GraphScenario): readonly GraphEdge[] {
  const node = (kind: GraphNode['kind'], id: string): GraphNode =>
    Object.freeze({ kind, id });
  return Object.freeze([
    ...input.requests.map((e) =>
      Object.freeze({
        kind: 'request' as const,
        source: node('process', e.processId),
        target: node('resource', e.resourceId),
      }),
    ),
    ...input.allocations.map((e) =>
      Object.freeze({
        kind: 'allocation' as const,
        source: node('resource', e.resourceId),
        target: node('process', e.processId),
      }),
    ),
  ]);
}
export function editGraph(
  input: GraphScenario,
  command: GraphCommand,
): EngineResponse<GraphScenario> {
  const error = validateGraph(input);
  if (error) return { ok: false, error };
  const { processId, resourceId } = command;
  const fail = (message: string): EngineResponse<GraphScenario> => ({
    ok: false,
    error: {
      code: 'validation',
      message,
      issues: [{ path: 'command', message }],
    },
  });
  if (
    !input.processIds.includes(processId) ||
    !input.resourceIds.includes(resourceId)
  )
    return fail('Choose an existing process and resource.');
  const owner = input.allocations.find((e) => e.resourceId === resourceId);
  const matches = (e: { processId: string; resourceId: string }) =>
    e.processId === processId && e.resourceId === resourceId;
  if (command.type === 'grant') {
    if (owner)
      return fail(
        `${resourceId} is owned by ${owner.processId}. Release it before granting it.`,
      );
    return {
      ok: true,
      result: freezeGraph({
        ...input,
        allocations: [...input.allocations, { processId, resourceId }],
        requests: input.requests.filter((e) => !matches(e)),
      }),
    };
  }
  if (command.type === 'release') {
    if (owner?.processId !== processId)
      return fail(`${processId} does not own ${resourceId}.`);
    return {
      ok: true,
      result: freezeGraph({
        ...input,
        allocations: input.allocations.filter((e) => !matches(e)),
      }),
    };
  }
  const pending = input.requests.some(matches);
  if (command.type === 'request') {
    if (pending) return fail(`${processId} already requests ${resourceId}.`);
    return {
      ok: true,
      result: freezeGraph({
        ...input,
        requests: [...input.requests, { processId, resourceId }],
      }),
    };
  }
  if (!pending)
    return fail(`${processId} has no pending request for ${resourceId}.`);
  return {
    ok: true,
    result: freezeGraph({
      ...input,
      requests: input.requests.filter((e) => !matches(e)),
    }),
  };
}
export function analyzeGraph(
  input: GraphScenario,
  budget = TRACE_EVENT_BUDGET,
): EngineResponse<GraphResult> {
  const error = validateGraph(input);
  if (error) return { ok: false, error };
  const maxEvents =
    2 * (input.processIds.length + input.resourceIds.length) + 1;
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
          'The graph exceeds the trace budget. Reduce nodes or use the standard budget.',
        issues: [],
      },
    };
  const scenario = freezeGraph(input),
    edges = graphEdges(scenario);
  const nodes: readonly GraphNode[] = [
    ...scenario.processIds.map((id) =>
      Object.freeze({ kind: 'process' as const, id }),
    ),
    ...scenario.resourceIds.map((id) =>
      Object.freeze({ kind: 'resource' as const, id }),
    ),
  ];
  const visited: GraphNode[] = [],
    path: GraphNode[] = [],
    completed = new Set<string>();
  let cycle: readonly GraphNode[] = Object.freeze([]),
    status: GraphSnapshot['status'] = 'checking';
  const events: GraphEvent[] = [],
    frames: ReplayFrame<GraphEvent, GraphSnapshot>[] = [];
  const snapshot = (): GraphSnapshot =>
    Object.freeze({
      graph: scenario,
      step: events.length,
      visited: Object.freeze([...visited]),
      path: Object.freeze([...path]),
      cycle,
      blockedProcessIds: Object.freeze([
        ...new Set(cycle.filter((n) => n.kind === 'process').map((n) => n.id)),
      ]),
      status,
    });
  frames.push(Object.freeze({ index: 0, event: null, snapshot: snapshot() }));
  function emit(
    kind: GraphEvent['kind'],
    node: GraphNode | null,
    reason: string,
  ) {
    const event = Object.freeze({
      seq: events.length,
      kind,
      explanationKey: `graph.${kind}`,
      node,
      reason,
    });
    events.push(event);
    frames.push(
      Object.freeze({ index: events.length, event, snapshot: snapshot() }),
    );
  }
  function visit(node: GraphNode): boolean {
    visited.push(node);
    path.push(node);
    emit(
      'graph-visit',
      node,
      `Visit ${node.kind} ${node.id}. Follow outgoing ${node.kind === 'process' ? 'request arrows (process → resource)' : 'allocation arrows (resource → process)'} in input order.`,
    );
    for (const edge of edges.filter(
      (e) => nodeKey(e.source) === nodeKey(node),
    )) {
      const at = path.findIndex((n) => nodeKey(n) === nodeKey(edge.target));
      if (at >= 0) {
        cycle = Object.freeze([...path.slice(at), edge.target]);
        status = 'deadlocked';
        emit(
          'graph-cycle',
          edge.target,
          `Directed cycle: ${cycle.map((n) => n.id).join(' → ')}. Every resource has one instance, so the cycle proves deadlock. Cycle processes cannot obtain the resources held within the cycle.`,
        );
        return true;
      }
      if (!completed.has(nodeKey(edge.target)) && visit(edge.target))
        return true;
    }
    path.pop();
    completed.add(nodeKey(node));
    emit(
      'graph-backtrack',
      node,
      `No cycle closes through ${node.id} on this search path. Backtrack and continue from the next unfinished input node.`,
    );
    return false;
  }
  for (const node of nodes)
    if (!completed.has(nodeKey(node)) && visit(node)) break;
  if (status === 'checking') {
    status = 'no-cycle';
    emit(
      'graph-no-cycle',
      null,
      'No directed cycle exists in this single-instance graph. Pending requests may still wait; this graph does not prove deadlock.',
    );
  }
  return {
    ok: true,
    result: Object.freeze({
      engineVersion: '0.4.0',
      scenario,
      edges,
      events: Object.freeze(events),
      frames: Object.freeze(frames),
      summary: snapshot(),
      outcome: cycle.length > 0 ? 'deadlocked' : 'completed',
    }),
  };
}
