import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { getErrorMessage } from '../api/client';
import AuthField from '../components/AuthField';
import AuthShell from '../components/AuthShell';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const sessionExpired = searchParams.get('expired') === '1';

  function validate() {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) newErrors.email = t('common.emailRequired');
    else if (!email.includes('@')) newErrors.email = t('common.emailInvalid');
    if (!password) newErrors.password = t('common.passwordRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setServerError('');
    try {
      await login(email.trim(), password);
      const redirect = searchParams.get('redirect');
      navigate(redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/projects', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthShell
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      switchText={t('login.switchText')}
      switchLabel={t('login.switchLabel')}
      switchTo="/register"
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {sessionExpired && !serverError && <p className="info-box">{t('login.expired')}</p>}
        {serverError && (
          <p className="error-box" role="alert">
            {serverError}
          </p>
        )}

        <AuthField
          id="email"
          label={t('auth.email')}
          icon="mail"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
        />
        <AuthField
          id="password"
          label={t('auth.password')}
          icon="lock"
          type="password"
          placeholder={t('auth.enterPassword')}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
        />

        <button type="submit" className="button button-primary button-full" disabled={saving}>
          {saving ? t('login.submitting') : t('login.submit')}
          {!saving && <Icon name="arrowRight" />}
        </button>

        <p className="auth-switch">
          {t('login.noAccount')} <Link to="/register">{t('login.createOne')}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
