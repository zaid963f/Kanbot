import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';

// Light / dark button and English / Arabic button. Used in the sidebar and on the login pages.
export default function SettingsToggles() {
  const { theme, toggleTheme } = useTheme();
  const { t, toggleLanguage } = useI18n();
  const isDark = theme === 'dark';

  return (
    <div className="settings-toggles">
      <button
        type="button"
        className="toggle-button"
        onClick={toggleTheme}
        aria-label={isDark ? t('settings.switchToLight') : t('settings.switchToDark')}
        title={isDark ? t('settings.switchToLight') : t('settings.switchToDark')}
      >
        <span key={theme} className="toggle-icon">
          <Icon name={isDark ? 'sun' : 'moon'} />
        </span>
        <span className="toggle-text">{isDark ? t('settings.lightMode') : t('settings.darkMode')}</span>
      </button>
      <button
        type="button"
        className="toggle-button"
        onClick={toggleLanguage}
        aria-label={t('settings.switchLanguage')}
        title={t('settings.switchLanguage')}
      >
        <Icon name="globe" />
        <span className="toggle-text">{t('settings.language')}</span>
      </button>
    </div>
  );
}
