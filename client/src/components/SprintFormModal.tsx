import { useState, type FormEvent } from 'react';
import { ApiError, getErrorMessage, getFieldErrors } from '../api/client';
import { createSprint, updateSprint } from '../api/sprints';
import { useI18n } from '../context/I18nContext';
import type { Sprint } from '../types/api';
import Modal from './Modal';

interface Props {
  projectId: string;
  sprint?: Sprint; // if given we edit it, otherwise we create a new one
  onClose: () => void;
  onSaved: () => void;
}

export default function SprintFormModal({ projectId, sprint, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(sprint?.name ?? '');
  const [goal, setGoal] = useState(sprint?.goal ?? '');
  const [startDate, setStartDate] = useState(sprint?.startDate ?? '');
  const [endDate, setEndDate] = useState(sprint?.endDate ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // "YYYY-MM-DD" strings can be compared as text
    if (startDate && endDate && endDate < startDate) {
      setErrors({ endDate: t('common.endAfterStart') });
      return;
    }

    const body = {
      ...(name.trim() ? { name: name.trim() } : {}), // empty = server picks "Sprint N"
      goal: goal.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
    };

    setSaving(true);
    try {
      if (sprint) {
        await updateSprint(sprint.id, body);
      } else {
        await createSprint(projectId, body);
      }
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setErrors(getFieldErrors(error));
      } else {
        setErrors({ form: getErrorMessage(error) });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={sprint ? t('sprintForm.edit', { name: sprint.name }) : t('sprintForm.create')} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          {errors.form && <p className="error-box">{errors.form}</p>}

          <label htmlFor="sprint-name">
            {t('sprintForm.name')} {!sprint && t('common.optional')}
          </label>
          <input id="sprint-name" className="input" placeholder="Sprint 1" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          {errors.name && <p className="field-error">{errors.name}</p>}

          <label htmlFor="sprint-goal">{t('sprintForm.goal')}</label>
          <textarea id="sprint-goal" className="input" rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} />

          <div className="two-columns">
            <div>
              <label htmlFor="sprint-start">{t('common.startDate')}</label>
              <input id="sprint-start" type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="sprint-end">{t('common.endDate')}</label>
              <input id="sprint-end" type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {errors.endDate && <p className="field-error">{errors.endDate}</p>}
        </div>

        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? t('common.saving') : sprint ? t('common.save') : t('sprintForm.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
