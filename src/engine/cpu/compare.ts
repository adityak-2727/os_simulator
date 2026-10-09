import type { CpuScenario, EngineResponse } from '../contracts';
import { scheduleCpu } from './schedule';
import type { CpuResult } from './types';
import { CPU_ALGORITHMS } from './validation';

export function compareCpu(
  scenario: CpuScenario,
): EngineResponse<readonly CpuResult[]> {
  const results: CpuResult[] = [];
  for (const algorithm of CPU_ALGORITHMS) {
    const response = scheduleCpu({ ...scenario, algorithm });
    if (!response.ok) return response;
    results.push(response.result);
  }
  return { ok: true, result: Object.freeze(results) };
}
