import { useState, type FormEvent } from 'react';
import { ApiError, getErrorMessage, getFieldErrors } from '../api/client';
import { createProject, updateProject } from '../api/projects';
import { useI18n } from '../context/I18nContext';
import type { Project } from '../types/api';
import Modal from './Modal';

interface Props {
  project?: Project; // if given we edit it, otherwise we create a new one
  onClose: () => void;
  onSaved: (project: Project) => void;
}

type Errors = { name?: string; key?: string; description?: string; form?: string };

export default function ProjectFormModal({ project, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(project?.name ?? '');
  const [key, setKey] = useState(project?.key ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  function validate() {
    const newErrors: Errors = {};
    if (!name.trim()) newErrors.name = t('common.nameRequired');
    if (key && (key.length < 2 || key.length > 6)) newErrors.key = t('projectForm.keyInvalid');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    const body = {
      name: name.trim(),
      description: description.trim(),
      // only send the key if the user typed one (or changed it)
      ...(key && key !== project?.key ? { key } : {}),
    };

    setSaving(true);
    try {
      const saved = project ? await updateProject(project.id, body) : await createProject(body);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ key: t('projectForm.keyTaken') });
      } else if (error instanceof ApiError && error.status === 400) {
        setErrors(getFieldErrors(error));
      } else {
        setErrors({ form: getErrorMessage(error) });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={project ? t('projectForm.edit') : t('projectForm.new')} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          {errors.form && <p className="error-box">{errors.form}</p>}

          <label htmlFor="project-name">{t('projectForm.name')}</label>
          <input id="project-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          {errors.name && <p className="field-error">{errors.name}</p>}

          <label htmlFor="project-key">{t('projectForm.key')}</label>
          <input
            id="project-key"
            className="input input-short"
            placeholder="KAN"
            maxLength={6}
            value={key}
            // letters only, always uppercase
            onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
          {errors.key ? (
            <p className="field-error">{errors.key}</p>
          ) : (
            <p className="hint">
              {project
                ? t('projectForm.keyHintEdit')
                : t('projectForm.keyHintNew')}
            </p>
          )}

          <label htmlFor="project-description">{t('projectForm.description')}</label>
          <textarea id="project-description" className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? t('common.saving') : project ? t('common.save') : t('projectForm.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
