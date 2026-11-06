import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../context/I18nContext';
import Icon from './Icon';
import SettingsToggles from './SettingsToggles';

const FEATURES = ['auth.feature1', 'auth.feature2', 'auth.feature3'] as const;

interface Props {
  title: string;
  subtitle: string;
  switchText: string;
  switchLabel: string;
  switchTo: string;
  children: ReactNode;
}

// Decorative mini board on the brand panel.
function BoardPreview() {
  const { t } = useI18n();
  const columns = [
    { name: t('auth.previewTodo'), tone: 'gray', cards: [70, 45] },
    { name: t('auth.previewProgress'), tone: 'blue', cards: [85] },
    { name: t('auth.previewDone'), tone: 'green', cards: [60, 75] },
  ];
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview-head">
        <span className="preview-dot" />
        <span className="preview-dot" />
        <span className="preview-dot" />
      </div>
      <div className="preview-progress">
        <span />
      </div>
      <div className="preview-board">
        {columns.map((col) => (
          <div key={col.name} className="preview-col">
            <span className={`preview-col-name tone-${col.tone}`}>{col.name}</span>
            {col.cards.map((width, i) => (
              <div key={i} className="preview-card">
                <span className="preview-line" style={{ width: `${width}%` }} />
                <span className="preview-meta">
                  <span className={`preview-chip tone-${col.tone}`} />
                  <span className="preview-pts" />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Split screen for login / register: brand panel on the left, form on the right.
export default function AuthShell({ title, subtitle, switchText, switchLabel, switchTo, children }: Props) {
  const { t } = useI18n();
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="auth-logo">
          <img src="/favicon.svg" alt="" width={36} height={36} />
          Kanbot
        </div>
        <div className="auth-pitch">
          <h2>{t('auth.pitchTitle')}</h2>
          <p>{t('auth.pitchText')}</p>
          <BoardPreview />
          <ul>
            {FEATURES.map((feature) => (
              <li key={feature}>
                <span className="auth-check">
                  <Icon name="check" size={14} />
                </span>
                {t(feature)}
              </li>
            ))}
          </ul>
        </div>
        <p className="auth-footnote">© {new Date().getFullYear()} Kanbot</p>
      </aside>

      <main className="auth-main">
        <header className="auth-topbar">
          <div className="auth-logo auth-logo-mobile">
            <img src="/favicon.svg" alt="" width={30} height={30} />
            Kanbot
          </div>
          <span className="spacer" />
          <SettingsToggles />
          <span className="auth-topbar-text">{switchText}</span>
          <Link to={switchTo} className="button button-small">
            {switchLabel}
          </Link>
        </header>

        <div className="auth-center">
          <div className="auth-card">
            <div className="auth-card-icon">
              <img src="/favicon.svg" alt="" width={44} height={44} />
            </div>
            <h1>{title}</h1>
            <p className="auth-subtitle">{subtitle}</p>
            {children}
          </div>
        </div>

        <footer className="auth-bottom">{t('auth.tagline')}</footer>
      </main>
    </div>
  );
}
