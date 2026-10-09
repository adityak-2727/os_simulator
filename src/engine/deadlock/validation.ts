import type { EngineError } from '../contracts';
import {
  checkInteger,
  validationError,
  type Issues,
} from '../memory/validation';
import type { BankerScenario, GraphScenario } from './types';
function ids(
  issues: Issues,
  values: readonly string[],
  path: string,
  limit: number,
) {
  checkInteger(
    issues,
    values.length,
    1,
    limit,
    path,
    path === 'processIds' ? 'Process count' : 'Resource count',
  );
  const seen = new Set<string>();
  values.forEach((id, i) => {
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(id))
      issues.push({
        path: `${path}.${i}`,
        message:
          'Use 1–24 letters, digits, underscores, or hyphens for the ID.',
      });
    if (seen.has(id))
      issues.push({
        path: `${path}.${i}`,
        message: `ID ${id} is duplicated in this scope.`,
      });
    seen.add(id);
  });
}
export function validateGraph(input: GraphScenario): EngineError | null {
  const issues: Issues = [];
  ids(issues, input.processIds, 'processIds', 12);
  ids(issues, input.resourceIds, 'resourceIds', 12);
  const owners = new Set<string>();
  for (const key of ['allocations', 'requests'] as const) {
    const seen = new Set<string>();
    input[key].forEach((edge, i) => {
      if (!input.processIds.includes(edge.processId))
        issues.push({
          path: `${key}.${i}`,
          message: `Unknown process ${edge.processId} in ${key}.`,
        });
      if (!input.resourceIds.includes(edge.resourceId))
        issues.push({
          path: `${key}.${i}`,
          message: `Unknown resource ${edge.resourceId} in ${key}.`,
        });
      const identity = `${edge.processId}:${edge.resourceId}`;
      if (seen.has(identity))
        issues.push({
          path: `${key}.${i}`,
          message: `Duplicate ${key === 'requests' ? 'request' : 'allocation'} edge ${edge.processId}/${edge.resourceId}.`,
        });
      seen.add(identity);
      if (key === 'allocations') {
        if (owners.has(edge.resourceId))
          issues.push({
            path: `${key}.${i}`,
            message: `${edge.resourceId} has multiple owners. Graph mode allows one instance and at most one owner.`,
          });
        owners.add(edge.resourceId);
      }
    });
  }
  return validationError(issues);
}
export function validateBanker(input: BankerScenario): EngineError | null {
  const issues: Issues = [];
  ids(issues, input.processIds, 'processIds', 10);
  ids(issues, input.resourceIds, 'resourceIds', 8);
  const rows = input.processIds.length,
    columns = input.resourceIds.length;
  if (input.total.length !== columns)
    issues.push({
      path: 'total',
      message: 'Total must have one entry per resource.',
    });
  input.total.forEach((n, j) =>
    checkInteger(issues, n, 0, 1000, `total.${j}`, 'Total instances'),
  );
  for (const key of ['allocation', 'max'] as const) {
    if (input[key].length !== rows)
      issues.push({
        path: key,
        message: `${key === 'max' ? 'Max' : 'Allocation'} must have one row per process.`,
      });
    input[key].forEach((row, i) => {
      if (row.length !== columns)
        issues.push({
          path: `${key}.${i}`,
          message: `Row ${i + 1} must have one entry per resource.`,
        });
      row.forEach((value, j) => {
        checkInteger(
          issues,
          value,
          0,
          1000,
          `${key}.${i}.${j}`,
          `${key === 'max' ? 'Max' : 'Allocation'} instances`,
        );
        if (
          key === 'max' &&
          Number.isInteger(input.total[j]) &&
          value > (input.total[j] ?? 0)
        )
          issues.push({
            path: `${key}.${i}.${j}`,
            message: `Max ${input.processIds[i]}/${input.resourceIds[j]} cannot exceed Total ${input.total[j]}.`,
          });
        if (
          key === 'allocation' &&
          Number.isInteger(input.max[i]?.[j]) &&
          value > (input.max[i]?.[j] ?? 0)
        )
          issues.push({
            path: `${key}.${i}.${j}`,
            message: `Allocation ${input.processIds[i]}/${input.resourceIds[j]} cannot exceed Max ${input.max[i]?.[j]}.`,
          });
      });
    });
  }
  input.total.forEach((total, j) => {
    const sum = input.allocation.reduce((n, row) => n + (row[j] ?? 0), 0);
    if (sum > total)
      issues.push({
        path: `total.${j}`,
        message: `Allocated ${input.resourceIds[j]} instances (${sum}) exceed Total (${total}).`,
      });
  });
  return validationError(issues);
}
