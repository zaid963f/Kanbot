import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, getErrorMessage, getFieldErrors } from '../api/client';
import AuthField from '../components/AuthField';
import AuthShell from '../components/AuthShell';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

type Errors = { name?: string; email?: string; password?: string; confirm?: string };

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  function validate() {
    const newErrors: Errors = {};
    if (!name.trim()) newErrors.name = t('common.nameRequired');
    if (!email.trim()) newErrors.email = t('common.emailRequired');
    else if (!email.includes('@')) newErrors.email = t('common.emailInvalid');
    if (password.length < 8) newErrors.password = t('register.passwordShort');
    if (confirm !== password) newErrors.confirm = t('register.passwordMismatch');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setServerError('');
    try {
      await register(name.trim(), email.trim(), password);
      navigate('/projects', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ email: t('register.emailTaken') });
      } else if (error instanceof ApiError && error.status === 400) {
        setErrors(getFieldErrors(error)); // shows the server message under the right field
      } else {
        setServerError(getErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthShell
      title={t('register.title')}
      subtitle={t('register.subtitle')}
      switchText={t('register.switchText')}
      switchLabel={t('register.switchLabel')}
      switchTo="/login"
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && (
          <p className="error-box" role="alert">
            {serverError}
          </p>
        )}

        <AuthField
          id="name"
          label={t('auth.fullName')}
          icon="user"
          placeholder="Zaid Fotaena"
          autoComplete="name"
          value={name}
          onChange={setName}
          error={errors.name}
        />
        <AuthField
          id="email"
          label={t('auth.workEmail')}
          icon="mail"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
        />
        <div className="two-columns">
          <AuthField
            id="password"
            label={t('auth.password')}
            icon="lock"
            type="password"
            placeholder={t('auth.password')}
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            error={errors.password}
          />
          <AuthField
            id="confirm"
            label={t('auth.confirm')}
            icon="lock"
            type="password"
            placeholder={t('auth.repeat')}
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
            error={errors.confirm}
          />
        </div>

        <button type="submit" className="button button-primary button-full" disabled={saving}>
          {saving ? t('register.submitting') : t('register.submit')}
          {!saving && <Icon name="arrowRight" />}
        </button>

        <p className="auth-switch">
          {t('register.switchText')} <Link to="/login">{t('register.switchLabel')}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
