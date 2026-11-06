import { useState } from 'react';
import { useI18n } from '../context/I18nContext';
import Icon, { type IconName } from './Icon';

interface Props {
  id: string;
  label: string;
  icon: IconName;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
  autoComplete?: string;
}

// Input with a leading icon and, for passwords, a show / hide toggle.
export default function AuthField({ id, label, icon, value, onChange, error, type = 'text', placeholder, autoComplete }: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const errorId = `${id}-error`;

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className={error ? 'input-group has-error' : 'input-group'}>
        <Icon name={icon} className="input-group-icon" />
        <input
          id={id}
          type={isPassword && visible ? 'text' : type}
          className="input"
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {isPassword && (
          <button
            type="button"
            className="input-group-toggle"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
            aria-pressed={visible}
          >
            <Icon name={visible ? 'eyeOff' : 'eye'} />
          </button>
        )}
      </div>
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
