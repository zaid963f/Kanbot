import { useState } from 'react';
import { summarizeSprint } from '../api/ai';
import { getErrorMessage } from '../api/client';
import { completeSprint } from '../api/sprints';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { DONE_STATUS } from '../types/api';
import type { Sprint, Todo } from '../types/api';
import { sumPoints } from '../utils/format';
import Modal from './Modal';

interface Props {
  sprint: Sprint;
  sprintTodos: Todo[];
  plannedSprints: Sprint[];
  onClose: () => void;
  onCompleted: () => void;
}

export default function CompleteSprintModal({ sprint, sprintTodos, plannedSprints, onClose, onCompleted }: Props) {
  const [moveTo, setMoveTo] = useState('backlog'); // "backlog" or a planned sprint id
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [withSummary, setWithSummary] = useState(false);
  const [step, setStep] = useState<'completing' | 'summarizing'>('completing');
  const toast = useToast();
  const { t } = useI18n();

  const doneTodos = sprintTodos.filter((todo) => todo.status === DONE_STATUS);
  const notDoneCount = sprintTodos.length - doneTodos.length;

  async function handleComplete() {
    setSaving(true);
    setStep('completing');
    try {
      await completeSprint(sprint.id, { moveUnfinishedTo: moveTo });
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
      return;
    }
    // The sprint is completed now. A failed summary must not undo that: it can be regenerated on the sprint page.
    if (withSummary) {
      setStep('summarizing');
      try {
        await summarizeSprint(sprint.id);
      } catch (err) {
        toast.showError(t('complete.summaryFailed', { error: getErrorMessage(err) }));
      }
    }
    onCompleted();
  }

  return (
    <Modal title={t('complete.title', { name: sprint.name })} onClose={onClose}>
      <div className="modal-body">
        {error && <p className="error-box">{error}</p>}
        <p className="big-text">
          {t('complete.summary', { done: doneTodos.length, notDone: notDoneCount })}
        </p>
        <p className="muted">
          {t('complete.points', { done: sumPoints(doneTodos), total: sumPoints(sprintTodos) })}
        </p>

        {notDoneCount > 0 && (
          <fieldset className="radio-group">
            <legend>{t('complete.moveTo')}</legend>
            <label>
              <input type="radio" name="moveTo" checked={moveTo === 'backlog'} onChange={() => setMoveTo('backlog')} />
              {t('common.backlog')}
            </label>
            {plannedSprints.map((planned) => (
              <label key={planned.id}>
                <input type="radio" name="moveTo" checked={moveTo === planned.id} onChange={() => setMoveTo(planned.id)} />
                {planned.name}
              </label>
            ))}
          </fieldset>
        )}

        <label className="checkbox-label">
          <input type="checkbox" checked={withSummary} onChange={(e) => setWithSummary(e.target.checked)} disabled={saving} />
          {t('complete.withSummary')}
        </label>
      </div>
      <div className="modal-footer">
        <button type="button" className="button" onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </button>
        <button type="button" className="button button-primary" onClick={handleComplete} disabled={saving}>
          {saving ? (step === 'summarizing' ? t('complete.writing') : t('complete.completing')) : t('complete.submit')}
        </button>
      </div>
    </Modal>
  );
}
