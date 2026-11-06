import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { getErrorMessage } from '../api/client';
import { deleteProject } from '../api/projects';
import Icon from '../components/Icon';
import ProjectFormModal from '../components/ProjectFormModal';
import { EmptyState, ErrorMessage, Loading } from '../components/States';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useProjects } from '../hooks/useProjectData';
import type { Project, ProjectWithStats } from '../types/api';

export default function ProjectsPage() {
  const projects = useProjects();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useI18n();

  const [showCreate, setShowCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  async function handleDelete(project: ProjectWithStats) {
    const ok = window.confirm(t('projects.confirmDelete', { name: project.name }));
    if (!ok) return;
    try {
      await deleteProject(project.id);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.showSuccess(t('projects.deleted', { name: project.name }));
    } catch (error) {
      toast.showError(getErrorMessage(error));
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('projects.title')}</h1>
          <p className="page-subtitle">{t('projects.subtitle')}</p>
        </div>
        <span className="spacer" />
        <button type="button" className="button button-primary" onClick={() => setShowCreate(true)}>
          <Icon name="plus" />
          {t('projects.new')}
        </button>
      </div>

      {projects.isPending && <Loading />}
      {projects.isError && <ErrorMessage error={projects.error} onRetry={() => projects.refetch()} />}

      {projects.data && projects.data.length === 0 && (
        <EmptyState title={t('projects.emptyTitle')} text={t('projects.emptyText')} icon="projects">
          <button type="button" className="button button-primary" onClick={() => setShowCreate(true)}>
            {t('projects.createFirst')}
          </button>
        </EmptyState>
      )}

      {projects.data && projects.data.length > 0 && (
        <div className="project-grid">
          {projects.data.map((project) => (
            <div key={project.id} className="card project-card">
              <div className="project-card-head">
                <span className="project-avatar" aria-hidden="true">
                  {project.key.slice(0, 2)}
                </span>
                <div className="project-card-title">
                  <Link to={`/projects/${project.id}/backlog`} className="project-title">
                    {project.name}
                  </Link>
                  <span className="key-badge">{project.key}</span>
                </div>
              </div>
              <p className="project-description">{project.description || t('projects.noDescription')}</p>
              <div className="project-stats">
                <div>
                  <small>{t('projects.backlog')}</small>
                  <strong>{project.stats.backlogCount}</strong>
                </div>
                <div>
                  <small>{t('projects.sprint')}</small>
                  {project.stats.activeSprint ? (
                    <span className="pill pill-active">
                      <span className="dot" />
                      {project.stats.activeSprint.name}
                    </span>
                  ) : (
                    <span className="pill">{t('projects.idle')}</span>
                  )}
                </div>
              </div>
              <div className="card-actions">
                <Link to={`/projects/${project.id}/backlog`} className="button button-small">
                  {t('projects.open')}
                  <Icon name="arrowRight" size={14} />
                </Link>
                <span className="spacer" />
                <button
                  type="button"
                  className="icon-button ghost"
                  onClick={() => setEditingProject(project)}
                  aria-label={t('common.editItem', { name: project.name })}
                  title={t('common.edit')}
                >
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  className="icon-button ghost danger"
                  onClick={() => handleDelete(project)}
                  aria-label={t('common.deleteItem', { name: project.name })}
                  title={t('common.delete')}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <ProjectFormModal
          onClose={() => setShowCreate(false)}
          onSaved={(project) => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            toast.showSuccess(t('projects.created', { key: project.key }));
            navigate(`/projects/${project.id}/backlog`);
          }}
        />
      )}

      {editingProject && (
        <ProjectFormModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSaved={() => {
            setEditingProject(null);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            toast.showSuccess(t('projects.saved'));
          }}
        />
      )}
    </>
  );
}
