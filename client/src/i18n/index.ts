// Plain (non-React) translation helpers: usable in utils, the API client, and components.
import { translations, type Language, type TranslationKey } from './translations';

const STORAGE_KEY = 'language';

type Vars = Record<string, string | number>;

function readSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // storage blocked: fall through
  }
  return navigator.language?.startsWith('ar') ? 'ar' : 'en';
}

// The current language also lives here, so plain helpers (dates, API errors) can use it outside React.
let currentLanguage: Language = readSavedLanguage();

export function getLanguage() {
  return currentLanguage;
}

export function setCurrentLanguage(language: Language) {
  currentLanguage = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // not saved, still switches for this visit
  }
}

// Locale for Intl date formatting. Arabic uses 0-9 digits so dates match the other numbers on the page.
export function getLocale() {
  return currentLanguage === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
}

// translate("common.todos", { count: 3 }) -> "3 todos"
export function translate(key: TranslationKey, vars?: Vars) {
  const dict = translations[currentLanguage];
  const oneKey = `${key}_one` as TranslationKey;
  let text = vars?.count === 1 && dict[oneKey] ? dict[oneKey] : dict[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

