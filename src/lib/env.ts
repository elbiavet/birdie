export type AppEnvironment = 'staging' | 'production';

export interface RuntimeEnvironment {
  clubId: string;
  appEnv: AppEnvironment;
}

export function resolveRuntimeEnvironment(
  env: Record<string, string | undefined> = process.env
): RuntimeEnvironment {
  const rawClubId = env.NEXT_PUBLIC_CLUB_ID?.trim();
  const rawAppEnv = env.NEXT_PUBLIC_APP_ENV?.trim();

  return {
    clubId: rawClubId && rawClubId.length > 0 ? rawClubId : 'demo-club',
    appEnv: rawAppEnv === 'production' ? 'production' : 'staging',
  };
}
