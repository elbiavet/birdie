import { es, type TranslationDictionary } from './translations/es';
import { en } from './translations/en';
import {
  DEFAULT_LANGUAGE,
  isValidLanguage,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from './types';

export * from './types';
export type { TranslationDictionary };
export { es } from './translations/es';
export { en } from './translations/en';

export const TRANSLATIONS: Record<SupportedLanguage, TranslationDictionary> = {
  es,
  en,
};

/**
 * Obtiene el valor traducido navegando por la ruta de propiedades con punto (ej. 'nav.course').
 * Si la clave no existe en el idioma objetivo, hace fallback automático a 'es', y si
 * tampoco existe, devuelve el fallback explícito o la clave buscada.
 */
export function getTranslation(
  lang: SupportedLanguage,
  keyPath: string,
  fallback?: string
): string {
  const parts = keyPath.split('.');
  
  // Buscar en el idioma objetivo
  let current: any = TRANSLATIONS[lang] ?? TRANSLATIONS[DEFAULT_LANGUAGE];
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      current = undefined;
      break;
    }
  }

  if (typeof current === 'string') {
    return current;
  }

  // Fallback a 'es' si el idioma objetivo era otro
  if (lang !== DEFAULT_LANGUAGE) {
    let fallbackCurrent: any = TRANSLATIONS[DEFAULT_LANGUAGE];
    for (const part of parts) {
      if (fallbackCurrent && typeof fallbackCurrent === 'object' && part in fallbackCurrent) {
        fallbackCurrent = fallbackCurrent[part];
      } else {
        fallbackCurrent = undefined;
        break;
      }
    }
    if (typeof fallbackCurrent === 'string') {
      return fallbackCurrent;
    }
  }

  return fallback ?? keyPath;
}

/**
 * Resuelve el idioma inicial de forma segura:
 * 1. Storage persistido (`birdie_language_v1`) si es válido.
 * 2. Lenguaje del navegador si empieza por 'en'.
 * 3. Fallback por defecto ('es').
 */
export function resolveInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && isValidLanguage(stored)) {
      return stored;
    }
  } catch {
    // Entornos con localStorage bloqueado
  }

  try {
    const browserLang = window.navigator?.language?.toLowerCase() || '';
    if (browserLang.startsWith('en')) {
      return 'en';
    }
  } catch {
    // Ignore
  }

  return DEFAULT_LANGUAGE;
}
