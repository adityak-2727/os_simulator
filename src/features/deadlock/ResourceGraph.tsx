import {
  ReactFlow,
  Controls,
  MarkerType,
  Position,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeKey } from '../../engine/deadlock/graph';
import type { GraphResult, GraphSnapshot } from '../../engine/deadlock/types';
import { processColor } from '../cpu/presentation';
export function ResourceGraph({
  result,
  snapshot,
}: {
  result: GraphResult;
  snapshot: GraphSnapshot;
}) {
  const cycle = snapshot.cycle.map(nodeKey),
    path = snapshot.path.map(nodeKey);
  const nodes: Node[] = [
    ...result.scenario.processIds.map((id, i) => ({
      id: `process:${id}`,
      position: { x: 30, y: i * 100 + 25 },
      sourcePosition: Position.Right,
      targetPosition: Position.Right,
      data: { label: id },
      style: {
        width: 66,
        height: 66,
        borderRadius: '50%',
        border: `2px solid ${cycle.includes(`process:${id}`) ? '#a32b32' : processColor(i)}`,
        background: path.includes(`process:${id}`) ? '#eaf1f9' : '#fff',
        fontWeight: 600,
        color: processColor(i),
      },
    })),
    ...result.scenario.resourceIds.map((id, i) => ({
      id: `resource:${id}`,
      position: { x: 300, y: i * 100 + 30 },
      sourcePosition: Position.Left,
      targetPosition: Position.Left,
      data: {
        label: (
          <>
            <strong>{id}</strong>
            <br />
            <small>1 instance</small>
          </>
        ),
      },
      style: {
        width: 90,
        height: 56,
        border: `${path.includes(`resource:${id}`) ? 2 : 1}px solid ${cycle.includes(`resource:${id}`) ? '#a32b32' : '#87929e'}`,
        borderRadius: 3,
        background: '#fff',
      },
    })),
  ];
  const edges: Edge[] = result.edges.map((e) => {
    const source = nodeKey(e.source),
      target = nodeKey(e.target),
      at = cycle.indexOf(source),
      cyclic = at >= 0 && cycle[at + 1] === target,
      color = cyclic ? '#a32b32' : e.kind === 'request' ? '#3a70a5' : '#687480';
    return {
      id: `${e.kind}:${source}:${target}`,
      source,
      target,
      type: 'default',
      // Crossing request arrows share a midpoint; the dashed-arrow legend and
      // equivalent edge table identify them without overlapping SVG labels.
      label: e.kind === 'allocation' ? 'allocation' : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
      style: {
        stroke: color,
        strokeWidth: cyclic ? 2.5 : 1.6,
        ...(e.kind === 'request' ? { strokeDasharray: '5 4' } : {}),
      },
      labelStyle: { fill: color, fontSize: 12 },
      ariaLabel: `${e.kind}: ${e.source.id} to ${e.target.id}`,
    };
  });
  return (
    <div
      className="resource-graph"
      role="region"
      aria-label="Resource graph visualization"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.15}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: false }}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
