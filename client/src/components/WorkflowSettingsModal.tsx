import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, getErrorMessage, getFieldErrors } from '../api/client';
import { updateProject } from '../api/projects';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { refreshProjectData, useTodos } from '../hooks/useProjectData';
import { useWorkflow } from '../hooks/useWorkflow';
import { OPTION_COLORS, WORKFLOW_LIMITS, type OptionColor, type WorkflowKind, type WorkflowOptionInput } from '../types/api';
import { defaultOptionName, priorityIcon } from '../utils/labels';
import Icon from './Icon';
import Modal from './Modal';

interface Props {
  projectId: string;
  initialTab?: WorkflowKind;
  onClose: () => void;
}

// One row of the form. `key` is a local React key; `id` is missing for new options.
interface Row {
  key: string;
  id?: string;
  builtIn: boolean;
  name: string;
  color: OptionColor;
}

let nextKey = 1;

// Edit the statuses (board columns) and priorities of a project:
// rename, recolour and reorder the built-in ones, add and delete custom ones.
export default function WorkflowSettingsModal({ projectId, initialTab = 'statuses', onClose }: Props) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const workflow = useWorkflow(projectId);
  const todos = useTodos(projectId).data ?? [];

  const toRows = (kind: WorkflowKind): Row[] =>
    workflow[kind].map((o) => ({ key: o.id, id: o.id, builtIn: o.builtIn, name: o.name, color: o.color }));
  const [start] = useState(() => ({ statuses: toRows('statuses'), priorities: toRows('priorities') }));
  const [lists, setLists] = useState(start);
  const [tab, setTab] = useState<WorkflowKind>(initialTab);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const rows = lists[tab];
  const hasChanges = JSON.stringify(lists) !== JSON.stringify(start);
  const isFull = rows.length >= WORKFLOW_LIMITS.maxOptions;

  function setRows(next: Row[]) {
    setLists({ ...lists, [tab]: next });
  }

  function updateRow(index: number, changes: Partial<Row>) {
    setRows(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  function moveRow(index: number, by: -1 | 1) {
    const next = [...rows];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setRows(next);
  }

  function addRow() {
    const used = new Set(rows.map((r) => r.color));
    const color = OPTION_COLORS.find((c) => !used.has(c)) ?? 'gray';
    setRows([...rows, { key: `new-${nextKey++}`, builtIn: false, name: '', color }]);
    // Focus the new name field once it is rendered.
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.workflow-row input[type="text"]');
      inputs[inputs.length - 1]?.focus();
    });
  }

  // How many todos use an option (only saved options can be in use).
  function usageOf(kind: WorkflowKind, id: string | undefined) {
    if (!id) return 0;
    return todos.filter((todo) => (kind === 'statuses' ? todo.status : todo.priority) === id).length;
  }

  function removeRow(index: number) {
    setRows(rows.filter((_, i) => i !== index));
  }

  function handleClose() {
    if (hasChanges && !window.confirm(t('todo.discard'))) return;
    onClose();
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();

    // Client-side check: custom options need a name.
    for (const kind of ['statuses', 'priorities'] as const) {
      const index = lists[kind].findIndex((row) => !row.builtIn && !row.name.trim());
      if (index !== -1) {
        setTab(kind);
        setErrors({ [`${kind}.${index}.name`]: t('common.nameRequired') });
        return;
      }
    }

    // Warn when deleted options are still used by todos.
    const moved = (['statuses', 'priorities'] as const).flatMap((kind) =>
      start[kind]
        .filter((old) => !lists[kind].some((row) => row.id === old.id))
        .map((old) => ({ kind, count: usageOf(kind, old.id) }))
        .filter((x) => x.count > 0),
    );
    const movedStatus = moved.filter((m) => m.kind === 'statuses').reduce((n, m) => n + m.count, 0);
    const movedPriority = moved.filter((m) => m.kind === 'priorities').reduce((n, m) => n + m.count, 0);
    if (movedStatus && !window.confirm(t('workflow.confirmStatus', { count: movedStatus, name: defaultOptionName('statuses', 'todo') }))) return;
    if (movedPriority && !window.confirm(t('workflow.confirmPriority', { count: movedPriority, name: defaultOptionName('priorities', 'medium') }))) return;

    const toInput = (row: Row): WorkflowOptionInput => ({ ...(row.id ? { id: row.id } : {}), name: row.name.trim(), color: row.color });
    setSaving(true);
    setErrors({});
    try {
      await updateProject(projectId, { statuses: lists.statuses.map(toInput), priorities: lists.priorities.map(toInput) });
      await refreshProjectData(queryClient, projectId);
      toast.showSuccess(t('workflow.saved'));
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && error.details.length) {
        const fieldErrors = getFieldErrors(error);
        const first = Object.keys(fieldErrors)[0] ?? '';
        if (first.startsWith('priorities')) setTab('priorities');
        if (first.startsWith('statuses')) setTab('statuses');
        setErrors({ ...fieldErrors, form: error.message });
      } else {
        setErrors({ form: getErrorMessage(error) });
      }
    } finally {
      setSaving(false);
    }
  }

  const colorName = (color: OptionColor) => t(`color.${color}`);

  return (
    <Modal title={t('workflow.title')} onClose={handleClose} wide>
      <form onSubmit={handleSave} noValidate>
        <div className="modal-body">
          <div className="segmented workflow-tabs" role="tablist" aria-label={t('workflow.title')}>
            {(['statuses', 'priorities'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                role="tab"
                id={`workflow-tab-${kind}`}
                aria-selected={tab === kind}
                aria-controls="workflow-panel"
                className={tab === kind ? 'active' : ''}
                onClick={() => setTab(kind)}
              >
                {t(`workflow.tab.${kind}`)}
                <span className="count">{lists[kind].length}</span>
              </button>
            ))}
          </div>

          <div id="workflow-panel" role="tabpanel" aria-labelledby={`workflow-tab-${tab}`}>
            <p className="hint">{t(`workflow.hint.${tab}`)}</p>
            {errors.form && <p className="error-box">{errors.form}</p>}
            {errors[tab] && <p className="field-error">{errors[tab]}</p>}

            <ol className="workflow-list">
              {rows.map((row, index) => {
                const label = row.name.trim() || (row.builtIn && row.id ? defaultOptionName(tab, row.id) : t('workflow.unnamed'));
                const error = errors[`${tab}.${index}.name`];
                const inUse = usageOf(tab, row.id);
                return (
                  <li key={row.key} className={`workflow-row tone-${row.color}`}>
                    <span className="workflow-order">
                      <button
                        type="button"
                        className="icon-button ghost"
                        disabled={index === 0}
                        onClick={() => moveRow(index, -1)}
                        aria-label={t('workflow.moveUp', { name: label })}
                        title={t('workflow.moveUp', { name: label })}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-button ghost"
                        disabled={index === rows.length - 1}
                        onClick={() => moveRow(index, 1)}
                        aria-label={t('workflow.moveDown', { name: label })}
                        title={t('workflow.moveDown', { name: label })}
                      >
                        ↓
                      </button>
                    </span>

                    <span className="workflow-preview" aria-hidden="true">
                      {tab === 'statuses' ? <span className="column-dot" /> : <span className="workflow-icon">{priorityIcon(row.id ?? '')}</span>}
                    </span>

                    <div className="workflow-name">
                      <input
                        type="text"
                        className="input"
                        value={row.name}
                        maxLength={WORKFLOW_LIMITS.nameMax}
                        placeholder={row.builtIn && row.id ? defaultOptionName(tab, row.id) : t('workflow.namePlaceholder')}
                        aria-label={t('workflow.nameOf', { n: index + 1 })}
                        aria-invalid={Boolean(error)}
                        onChange={(e) => updateRow(index, { name: e.target.value })}
                      />
                      {error && <p className="field-error">{error}</p>}
                    </div>

                    <div className="swatches" role="radiogroup" aria-label={t('workflow.colorOf', { name: label })}>
                      {OPTION_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          role="radio"
                          aria-checked={row.color === color}
                          className={`swatch tone-${color}`}
                          title={colorName(color)}
                          aria-label={colorName(color)}
                          onClick={() => updateRow(index, { color })}
                        />
                      ))}
                    </div>

                    <span className="workflow-end">
                      {row.builtIn ? (
                        <span className="pill" title={t('workflow.builtInHint')}>
                          {t('workflow.builtIn')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="icon-button ghost danger"
                          onClick={() => removeRow(index)}
                          aria-label={t('common.deleteItem', { name: label })}
                          title={inUse ? t('workflow.inUse', { count: inUse }) : t('common.delete')}
                        >
                          <Icon name="trash" />
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>

            <button type="button" className="button" onClick={addRow} disabled={isFull}>
              <Icon name="plus" />
              {t(`workflow.add.${tab}`)}
            </button>
            {isFull && <p className="hint">{t('workflow.full', { n: WORKFLOW_LIMITS.maxOptions })}</p>}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="button" onClick={handleClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="button button-primary" disabled={saving || !hasChanges}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
