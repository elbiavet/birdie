/**
 * Módulo de Gestión y Tokens de Identidad Visual (Temas Dark & Light) para Birdie.
 */

export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export interface ThemePalette {
  name: string;
  bg: string;
  surface: string;
  surfaceSubtle: string;
  accentPrimary: string;
  accentSecondary: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  borderStrong: string;
}

export const THEME_PALETTES: Record<ResolvedTheme, ThemePalette> = {
  dark: {
    name: 'Birdie Dark (Carbon, Forest Green & Gold)',
    bg: '#0B0C10',
    surface: '#202127',
    surfaceSubtle: '#19191E',
    accentPrimary: '#C9AD74', // Dorado cálido
    accentSecondary: '#064334', // Verde bosque
    textPrimary: '#E4D3AC', // Texto destacado
    textSecondary: '#92A99E', // Texto secundario
    border: 'rgba(201, 173, 116, 0.25)',
    borderStrong: '#C9AD74',
  },
  light: {
    name: 'Birdie Light (Warm Ivory, Sage & Bronze)',
    bg: '#F7F3EA',
    surface: '#FCFAF5',
    surfaceSubtle: '#FFFDF6',
    accentPrimary: '#A98A55', // Dorado / bronce
    accentSecondary: '#0A3A2A', // Verde corporativo
    textPrimary: '#0A3A2A',
    textSecondary: '#52665B',
    border: '#D8DFD9',
    borderStrong: '#A98A55',
  },
};

export const THEME_STORAGE_KEY = 'birdie_theme_mode_v1';

/**
 * Obtiene el modo de tema guardado o el valor por defecto.
 */
export function getSavedThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      return saved;
    }
  } catch {
    // Entorno restringido o sin localStorage
  }
  return 'dark';
}

/**
 * Resuelve un ThemeMode a 'dark' o 'light' evaluando la preferencia del sistema operativo si es necesario.
 */
export function resolveThemeMode(mode: ThemeMode): ResolvedTheme {
  if (mode === 'dark' || mode === 'light') {
    return mode;
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? 'dark' : 'light';
  }
  return 'dark';
}

/**
 * Guarda el modo de tema en localStorage.
 */
export function persistThemeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore error
  }
}

/**
 * Inyecta las variables CSS y atributos del tema en el elemento raíz del documento.
 */
export function applyThemeToElement(
  target: HTMLElement,
  resolved: ResolvedTheme
): void {
  const palette = THEME_PALETTES[resolved];

  target.setAttribute('data-theme', resolved);
  if (resolved === 'dark') {
    target.classList.add('dark');
    target.classList.remove('light');
  } else {
    target.classList.add('light');
    target.classList.remove('dark');
  }

  // Asignar variables CSS semánticas
  target.style.setProperty('--theme-bg', palette.bg);
  target.style.setProperty('--theme-surface', palette.surface);
  target.style.setProperty('--theme-surface-subtle', palette.surfaceSubtle);
  target.style.setProperty('--theme-accent', palette.accentPrimary);
  target.style.setProperty('--theme-accent-corp', palette.accentSecondary);
  target.style.setProperty('--theme-text-primary', palette.textPrimary);
  target.style.setProperty('--theme-text-secondary', palette.textSecondary);
  target.style.setProperty('--theme-border', palette.border);
  target.style.setProperty('--theme-border-strong', palette.borderStrong);
}
