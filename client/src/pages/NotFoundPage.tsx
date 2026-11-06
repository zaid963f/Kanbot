import { Link } from 'react-router';
import { useI18n } from '../context/I18nContext';

export default function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="center-page">
      <div className="auth-card not-found">
        <h1>404</h1>
        <p>{t('notFound.text')}</p>
        <Link to="/projects" className="button button-primary">
          {t('notFound.home')}
        </Link>
      </div>
    </div>
  );
}
