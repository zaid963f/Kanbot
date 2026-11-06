import { translate } from '../i18n';
import type { TranslationKey } from '../i18n/translations';
import type { SprintStatus, TodoType, WorkflowKind, WorkflowOption } from '../types/api';

// Call these while rendering, so they follow the current language.
export const typeLabel = (type: TodoType) => translate(`type.${type}`);
export const sprintStatusLabel = (status: SprintStatus) => translate(`sprintStatus.${status}`);

/** The default (translated) name of a built-in status or priority. */
export function defaultOptionName(kind: WorkflowKind, id: string) {
  return translate(`${kind === 'statuses' ? 'status' : 'priority'}.${id}` as TranslationKey);
}

/** What to show for a status/priority: the user's name, or the translated default of a built-in. */
export function optionLabel(kind: WorkflowKind, option: WorkflowOption) {
  return option.name || (option.builtIn ? defaultOptionName(kind, option.id) : option.id);
}

// A small symbol next to built-in priorities, so colour is not the only signal.
const PRIORITY_ICONS: Record<string, string> = {
  low: '↓',
  medium: '=',
  high: '↑',
  urgent: '⇈',
};
export const priorityIcon = (id: string) => PRIORITY_ICONS[id] ?? '•';
