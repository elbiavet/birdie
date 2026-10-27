import { describe, expect, it } from 'vitest';
import { resolveRuntimeEnvironment } from '../env';

describe('resolveRuntimeEnvironment', () => {
  it('devuelve valores por defecto seguros cuando no se definen variables', () => {
    const result = resolveRuntimeEnvironment({});
    expect(result).toEqual({
      clubId: 'demo-club',
      appEnv: 'staging',
    });
  });

  it('respeta el clubId y el entorno production cuando se configuran explícitamente', () => {
    const result = resolveRuntimeEnvironment({
      NEXT_PUBLIC_CLUB_ID: 'pinos-golf',
      NEXT_PUBLIC_APP_ENV: 'production',
    });
    expect(result).toEqual({
      clubId: 'pinos-golf',
      appEnv: 'production',
    });
  });
});
