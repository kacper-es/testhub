import type {
  DeadlineType,
  TaskTemplate,
  TaskType,
  VersionStatus,
  VersionTask,
} from '@prisma/client'

export type ResolvedTask = {
  name: string
  description: string | null
  taskType: TaskType
  deadlineType: DeadlineType
  daysBeforeRelease: number | null
  sortOrder: number
}

// Jedyne źródło efektywnych wartości zadania (reguła 9). Wersja zamknięta czyta
// pola *Snapshot; otwarta — bieżące wartości z szablonu. Nigdy nie czytaj tych
// pól bezpośrednio w komponentach.
export function resolveTask(
  versionTask: VersionTask,
  template: TaskTemplate,
  versionStatus: VersionStatus,
): ResolvedTask {
  if (versionStatus !== 'IN_PROGRESS') {
    return {
      name: versionTask.nameSnapshot ?? template.name,
      description: versionTask.descriptionSnapshot ?? template.description,
      taskType: versionTask.taskTypeSnapshot ?? template.taskType,
      deadlineType: versionTask.deadlineTypeSnapshot ?? template.deadlineType,
      daysBeforeRelease:
        versionTask.daysBeforeReleaseSnapshot ?? template.daysBeforeRelease,
      sortOrder: versionTask.sortOrderSnapshot ?? template.sortOrder,
    }
  }

  return {
    name: template.name,
    description: template.description,
    taskType: template.taskType,
    deadlineType: template.deadlineType,
    daysBeforeRelease: template.daysBeforeRelease,
    sortOrder: template.sortOrder,
  }
}
