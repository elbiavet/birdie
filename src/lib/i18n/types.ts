export type SupportedLanguage = 'es' | 'en';

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['es', 'en'] as const;

export const DEFAULT_LANGUAGE: SupportedLanguage = 'es';

export const LANGUAGE_STORAGE_KEY = 'birdie_language_v1';

export function isValidLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && (value === 'es' || value === 'en');
}
