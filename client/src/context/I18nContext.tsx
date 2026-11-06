import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getLanguage, setCurrentLanguage, translate } from '../i18n';
import type { Language } from '../i18n/translations';

function applyToDocument(language: Language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
}

interface I18nContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: typeof translate;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getLanguage);

  useEffect(() => {
    applyToDocument(language);
  }, [language]);

  function setLanguage(next: Language) {
    setCurrentLanguage(next);
    setLanguageState(next);
  }

  const value: I18nContextType = {
    language,
    setLanguage,
    toggleLanguage: () => setLanguage(language === 'en' ? 'ar' : 'en'),
    // a new function per language, so components that use `t` re-render on switch
    t: (key, vars) => translate(key, vars),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
