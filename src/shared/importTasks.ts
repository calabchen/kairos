import { randomUUID } from "node:crypto";
import type { ImportChoice, ImportConflict, ImportResult } from "./ipc";
import { taskFileSchema, type TaskInstance } from "./task";

export function taskContentKey(task: TaskInstance): string {
  return JSON.stringify([task.title.trim().toLocaleLowerCase(), task.dueAt, task.important, task.urgent, task.reminder, task.recurrence]);
}

export function findImportConflicts(current: TaskInstance[], incoming: TaskInstance[]): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  for (const task of incoming) {
    const byId = current.find((candidate) => candidate.id === task.id);
    if (byId) {
      conflicts.push({ key: `id:${task.id}`, reason: "id", current: byId, incoming: task });
      continue;
    }
    const byContent = current.find((candidate) => taskContentKey(candidate) === taskContentKey(task));
    if (byContent) conflicts.push({ key: `content:${task.id}`, reason: "content", current: byContent, incoming: task });
  }
  return conflicts;
}

export function mergeImportedTasks(
  current: TaskInstance[],
  incoming: TaskInstance[],
  choices: Record<string, ImportChoice>,
  idFactory: () => string = randomUUID,
): { tasks: TaskInstance[]; result: ImportResult } {
  const conflicts = findImportConflicts(current, incoming);
  const conflictsByIncomingId = new Map(conflicts.map((conflict) => [conflict.incoming.id, conflict]));
  const tasksById = new Map(current.map((task) => [task.id, task]));
  const duplicateSeries = new Set<string>();
  const replacementSeries = new Map<string, string>();
  let overwritten = 0;
  let kept = 0;
  let duplicated = 0;
  let added = 0;

  for (const conflict of conflicts) {
    const choice = choices[conflict.key] ?? "keep-current";
    if (choice === "overwrite") {
      tasksById.set(conflict.current.id, { ...conflict.incoming, id: conflict.current.id });
      overwritten += 1;
    } else if (choice === "duplicate") {
      duplicateSeries.add(conflict.incoming.seriesId ?? conflict.incoming.id);
      duplicated += 1;
    } else {
      kept += 1;
    }
  }

  for (const task of incoming) {
    const conflict = conflictsByIncomingId.get(task.id);
    const choice = conflict ? choices[conflict.key] ?? "keep-current" : undefined;
    if (conflict && choice !== "duplicate") continue;

    let id = task.id;
    if (choice === "duplicate") {
      do id = idFactory(); while (tasksById.has(id));
    } else {
      added += 1;
    }
    const originalSeriesId = task.seriesId ?? task.id;
    let seriesId = task.recurrence.type === "none" ? undefined : originalSeriesId;
    if (seriesId && duplicateSeries.has(originalSeriesId)) {
      const replacement = replacementSeries.get(originalSeriesId) ?? idFactory();
      replacementSeries.set(originalSeriesId, replacement);
      seriesId = replacement;
    }
    tasksById.set(id, { ...task, id, seriesId });
  }

  return {
    tasks: taskFileSchema.parse({ version: 1, tasks: [...tasksById.values()] }).tasks,
    result: { canceled: false, added, overwritten, kept, skipped: kept, duplicated },
  };
}
