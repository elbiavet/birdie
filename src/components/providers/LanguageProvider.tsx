'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LANGUAGE,
  getTranslation,
  isValidLanguage,
  LANGUAGE_STORAGE_KEY,
  resolveInitialLanguage,
  TRANSLATIONS,
  type SupportedLanguage,
  type TranslationDictionary,
} from '@/lib/i18n';

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (keyPath: string, fallback?: string) => string;
  dictionary: TranslationDictionary;
  isEs: boolean;
  isEn: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage?: SupportedLanguage;
}) {
  // Inicialización determinista e idéntica en SSR y en la hidratación inicial del cliente
  const [language, setLanguageState] = useState<SupportedLanguage>(
    initialLanguage && isValidLanguage(initialLanguage) ? initialLanguage : DEFAULT_LANGUAGE
  );

  // Al montar en el cliente (post-hidratación), sincronizar con localStorage o preferencias del navegador
  useEffect(() => {
    const resolved = resolveInitialLanguage();
    if (resolved !== DEFAULT_LANGUAGE) {
      setLanguageState(resolved);
    }
  }, []);

  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    const targetLang = isValidLanguage(newLang) ? newLang : DEFAULT_LANGUAGE;
    setLanguageState(targetLang);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, targetLang);
      } catch (err) {
        console.warn('[Birdie i18n] Error guardando preferencia de idioma:', err);
      }
    }
  }, []);

  const t = useCallback(
    (keyPath: string, fallback?: string): string => {
      return getTranslation(language, keyPath, fallback);
    },
    [language]
  );

  const dictionary = useMemo(() => {
    return TRANSLATIONS[language] ?? TRANSLATIONS[DEFAULT_LANGUAGE];
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t,
      dictionary,
      isEs: language === 'es',
      isEn: language === 'en',
    }),
    [language, setLanguage, t, dictionary]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback elegante si se invoca fuera de LanguageProvider (SSR o tests aislados)
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      t: (keyPath: string, fallback?: string) => getTranslation(DEFAULT_LANGUAGE, keyPath, fallback),
      dictionary: TRANSLATIONS[DEFAULT_LANGUAGE],
      isEs: true,
      isEn: false,
    };
  }
  return context;
}

export const useLanguage = useTranslation;
