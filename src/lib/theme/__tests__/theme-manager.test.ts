import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  THEME_PALETTES,
  THEME_STORAGE_KEY,
  getSavedThemeMode,
  persistThemeMode,
  resolveThemeMode,
  applyThemeToElement,
} from '@/lib/theme';

describe('Módulo de Gestión de Temas (Dark / Light)', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};

    const storageMock: Storage = {
      length: 0,
      key: () => null,
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    // @ts-ignore mock window in Node test runner
    globalThis.window = {
      localStorage: storageMock,
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    };
  });

  afterEach(() => {
    // @ts-ignore cleanup
    delete globalThis.window;
  });

  it('define paletas Dark y Light con los códigos hexadecimales exactos especificados', () => {
    // Modo Dark
    expect(THEME_PALETTES.dark.bg).toBe('#0B0C10');
    expect(THEME_PALETTES.dark.surface).toBe('#202127');
    expect(THEME_PALETTES.dark.surfaceSubtle).toBe('#19191E');
    expect(THEME_PALETTES.dark.accentPrimary).toBe('#C9AD74');
    expect(THEME_PALETTES.dark.accentSecondary).toBe('#064334');
    expect(THEME_PALETTES.dark.textPrimary).toBe('#E4D3AC');
    expect(THEME_PALETTES.dark.textSecondary).toBe('#92A99E');

    // Modo Light
    expect(THEME_PALETTES.light.bg).toBe('#F7F3EA');
    expect(THEME_PALETTES.light.surface).toBe('#FCFAF5');
    expect(THEME_PALETTES.light.surfaceSubtle).toBe('#FFFDF6');
    expect(THEME_PALETTES.light.accentPrimary).toBe('#A98A55');
    expect(THEME_PALETTES.light.accentSecondary).toBe('#0A3A2A');
    expect(THEME_PALETTES.light.textPrimary).toBe('#0A3A2A');
    expect(THEME_PALETTES.light.textSecondary).toBe('#52665B');
  });

  it('guarda y recupera la preferencia en localStorage con la clave correcta', () => {
    expect(getSavedThemeMode()).toBe('dark'); // Por defecto 'dark'

    persistThemeMode('light');
    expect(mockStorage[THEME_STORAGE_KEY]).toBe('light');
    expect(getSavedThemeMode()).toBe('light');

    persistThemeMode('dark');
    expect(mockStorage[THEME_STORAGE_KEY]).toBe('dark');
    expect(getSavedThemeMode()).toBe('dark');
  });

  it('resuelve modos directos y preferencia del sistema', () => {
    expect(resolveThemeMode('dark')).toBe('dark');
    expect(resolveThemeMode('light')).toBe('light');

    // Modo system con mock de matchMedia
    expect(resolveThemeMode('system')).toBe('dark');
  });

  it('aplica las variables CSS y clases data-theme correctamente a un elemento destino', () => {
    const classList = new Set<string>();
    const attributes: Record<string, string> = {};
    const styles: Record<string, string> = {};

    const mockElement = {
      setAttribute: (key: string, val: string) => {
        attributes[key] = val;
      },
      getAttribute: (key: string) => attributes[key] || null,
      classList: {
        add: (cls: string) => classList.add(cls),
        remove: (cls: string) => classList.delete(cls),
        contains: (cls: string) => classList.has(cls),
      },
      style: {
        setProperty: (key: string, val: string) => {
          styles[key] = val;
        },
        getPropertyValue: (key: string) => styles[key] || '',
      },
    } as unknown as HTMLElement;

    applyThemeToElement(mockElement, 'dark');
    expect(mockElement.getAttribute('data-theme')).toBe('dark');
    expect(mockElement.classList.contains('dark')).toBe(true);
    expect(mockElement.classList.contains('light')).toBe(false);
    expect(mockElement.style.getPropertyValue('--theme-bg')).toBe('#0B0C10');
    expect(mockElement.style.getPropertyValue('--theme-surface')).toBe('#202127');
    expect(mockElement.style.getPropertyValue('--theme-surface-subtle')).toBe('#19191E');

    applyThemeToElement(mockElement, 'light');
    expect(mockElement.getAttribute('data-theme')).toBe('light');
    expect(mockElement.classList.contains('light')).toBe(true);
    expect(mockElement.classList.contains('dark')).toBe(false);
    expect(mockElement.style.getPropertyValue('--theme-bg')).toBe('#F7F3EA');
    expect(mockElement.style.getPropertyValue('--theme-surface')).toBe('#FCFAF5');
    expect(mockElement.style.getPropertyValue('--theme-surface-subtle')).toBe('#FFFDF6');
  });
});
