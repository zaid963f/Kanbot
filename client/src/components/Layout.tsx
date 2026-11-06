import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { AiProvider, useAi } from '../context/AiContext';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useProjects } from '../hooks/useProjectData';
import AiAssistantPanel from './AiAssistantPanel';
import GenerateTodosModal from './GenerateTodosModal';
import Icon from './Icon';
import PlanSprintModal from './PlanSprintModal';
import SettingsToggles from './SettingsToggles';

function initials(name: string | undefined) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// Sidebar + page content. Used by every page after login.
export default function Layout() {
  const { projectId = '' } = useParams();
  return (
    <AiProvider projectId={projectId}>
      <Shell />
    </AiProvider>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const { projectId } = useParams();
  const ai = useAi();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const projects = useProjects();
  const currentProject = projects.data?.find((p) => p.id === projectId);

  return (
    <div className="layout">
      <aside className="sidebar">
        <NavLink to="/projects" className="logo">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Kanbot</span>
        </NavLink>

        <div className="project-switcher">
          <label className="sidebar-label" htmlFor="project-switcher">
            {t('layout.workspace')}
          </label>
          <div className="switcher-box">
            <span className="project-avatar project-avatar-sm" aria-hidden="true">
              {currentProject ? currentProject.key.slice(0, 2) : '—'}
            </span>
            <select
              id="project-switcher"
              value={projectId ?? ''}
              onChange={(event) => navigate(`/projects/${event.target.value}/backlog`)}
            >
              <option value="" disabled>
                {t('layout.chooseProject')}
              </option>
              {projects.data?.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={14} className="switcher-chevron" />
          </div>
        </div>

        <nav className="nav">
          {projectId && (
            <>
              <span className="sidebar-label">{t('layout.planning')}</span>
              <NavLink to={`/projects/${projectId}/backlog`}>
                <Icon name="backlog" />
                {t('layout.backlog')}
              </NavLink>
              <NavLink to={`/projects/${projectId}/board`}>
                <Icon name="board" />
                {t('layout.activeSprint')}
              </NavLink>
              <NavLink to={`/projects/${projectId}/sprints`}>
                <Icon name="sprints" />
                {t('layout.sprints')}
              </NavLink>
            </>
          )}
          <span className="sidebar-label">{t('layout.general')}</span>
          <NavLink to="/projects" end>
            <Icon name="projects" />
            {t('layout.allProjects')}
          </NavLink>
        </nav>

        <SettingsToggles />

        <div className="user-box">
          <span className="avatar" aria-hidden="true">
            {initials(user?.name)}
          </span>
          <div className="user-info">
            <strong>{user?.name}</strong>
            <small>{user?.email}</small>
          </div>
          <button type="button" className="icon-button ghost" onClick={logout} aria-label={t('layout.logout')} title={t('layout.logout')}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <main className={ai.isPanelOpen ? 'content with-ai-panel' : 'content'}>
        {projectId && (
          <div className="topbar">
            <span className="topbar-project">
              {currentProject && (
                <>
                  <span className="todo-key">{currentProject.key}</span>
                  {currentProject.name}
                </>
              )}
            </span>
            <span className="spacer" />
            <button
              type="button"
              className={ai.isPanelOpen ? 'button button-ai active' : 'button button-ai'}
              onClick={ai.isPanelOpen ? ai.closePanel : ai.openPanel}
              aria-expanded={ai.isPanelOpen}
            >
              <Icon name="sparkles" />
              {t('layout.askAi')}
            </button>
          </div>
        )}
        {/* key = path: each page gets a fresh fade-in */}
        <div key={location.pathname} className="content-inner page-fade">
          <Outlet />
        </div>
      </main>

      {ai.isPanelOpen && <AiAssistantPanel />}

      {projectId && ai.dialog?.type === 'generate' && (
        <GenerateTodosModal projectId={projectId} initialPrompt={ai.dialog.prompt} onClose={ai.closeDialog} />
      )}
      {projectId && ai.dialog?.type === 'plan' && <PlanSprintModal projectId={projectId} onClose={ai.closeDialog} />}
    </div>
  );
}
