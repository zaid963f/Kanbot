import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '../api/client';
import { startSprint } from '../api/sprints';
import { useI18n } from '../context/I18nContext';
import type { Sprint } from '../types/api';
import { addDays, today } from '../utils/format';
import Modal from './Modal';

interface Props {
  sprint: Sprint;
  onClose: () => void;
  onStarted: () => void;
}

export default function StartSprintModal({ sprint, onClose, onStarted }: Props) {
  const { t } = useI18n();
  // Default: today until 14 days later
  const [startDate, setStartDate] = useState(sprint.startDate ?? today());
  const [endDate, setEndDate] = useState(sprint.endDate ?? addDays(sprint.startDate ?? today(), 14));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!startDate || !endDate) {
      setError(t('startSprint.pickDates'));
      return;
    }
    if (endDate < startDate) {
      setError(t('common.endAfterStart'));
      return;
    }

    setSaving(true);
    try {
      await startSprint(sprint.id, { startDate, endDate });
      onStarted();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t('startSprint.title', { name: sprint.name })} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          {error && <p className="error-box">{error}</p>}
          <div className="two-columns">
            <div>
              <label htmlFor="start-date">{t('common.startDate')}</label>
              <input id="start-date" type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="end-date">{t('common.endDate')}</label>
              <input id="end-date" type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? t('startSprint.starting') : t('startSprint.start')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
