import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase/migrations');
const PGTAP_TESTS_DIR = path.resolve(process.cwd(), 'supabase/tests/database');

const EXPECTED_PUBLIC_TABLES = [
  // Migración 01
  'profiles',
  'handicap_history',
  'device_push_tokens',
  // Migración 02
  'courses',
  'course_tees',
  'course_holes',
  'hole_pois',
  // Migración 03
  'rounds',
  'round_players',
  'hole_scores',
  // Migración 04
  'tournaments',
  'tournament_registrations',
  'tournament_results',
  'matches_calendar',
  'tee_time_slots',
  'bookings',
  'booking_players',
  'special_events',
  'event_rsvps',
  // Migración 05
  'news_articles',
  'club_info_pages',
  'forum_threads',
  'forum_posts',
  'admin_chat_rooms',
  'admin_chat_messages',
] as const;

describe('Auditoría de Esquema Supabase, RLS y Suite pgTAP', () => {
  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const combinedMigrationsSql = migrationFiles
    .map((file) => fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8'))
    .join('\n');

  it('contiene las 5 migraciones ordenadas secuencialmente', () => {
    expect(migrationFiles).toEqual([
      '20261027000001_core_roles_and_profiles.sql',
      '20261027000002_courses_and_gps.sql',
      '20261027000003_scorecards_and_stats.sql',
      '20261027000004_tournaments_bookings_events.sql',
      '20261027000005_social_chat_news_push.sql',
    ]);
  });

  it('define las 25 tablas de los 13 módulos y activa ENABLE ROW LEVEL SECURITY en el 100% de ellas', () => {
    const createTableRegex = /CREATE TABLE IF NOT EXISTS public\.([a-z0-9_]+)/g;
    const discoveredTables = Array.from(
      combinedMigrationsSql.matchAll(createTableRegex),
      (m) => m[1]
    );

    expect(discoveredTables.sort()).toEqual([...EXPECTED_PUBLIC_TABLES].sort());

    for (const table of EXPECTED_PUBLIC_TABLES) {
      const rlsRegex = new RegExp(
        `ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`,
        'i'
      );
      expect(
        rlsRegex.test(combinedMigrationsSql),
        `Falta ENABLE ROW LEVEL SECURITY en public.${table}`
      ).toBe(true);

      const policyRegex = new RegExp(`ON public\\.${table}\\b`, 'i');
      expect(
        policyRegex.test(combinedMigrationsSql),
        `Falta CREATE POLICY para public.${table}`
      ).toBe(true);
    }
  });

  it('incluye los 3 roles oficiales (player, club_admin, superadmin) y funciones helper RLS', () => {
    expect(combinedMigrationsSql).toContain(
      "CREATE TYPE public.user_role AS ENUM ('player', 'club_admin', 'superadmin');"
    );
    expect(combinedMigrationsSql).toContain(
      'CREATE OR REPLACE FUNCTION public.current_user_role()'
    );
    expect(combinedMigrationsSql).toContain(
      'CREATE OR REPLACE FUNCTION public.is_club_admin_or_superadmin()'
    );
    expect(combinedMigrationsSql).toContain(
      'CREATE OR REPLACE FUNCTION public.is_superadmin()'
    );
  });

  it('verifica la consistencia de los 3 archivos de pruebas pgTAP (plan vs número de aserciones)', () => {
    const pgtapFiles = fs
      .readdirSync(PGTAP_TESTS_DIR)
      .filter((f) => f.endsWith('.test.sql'))
      .sort();

    expect(pgtapFiles).toEqual([
      '01_rls_roles.test.sql',
      '02_scorecards_and_tournaments.test.sql',
      '03_social_chat.test.sql',
    ]);

    for (const file of pgtapFiles) {
      const sql = fs.readFileSync(path.join(PGTAP_TESTS_DIR, file), 'utf-8');
      expect(sql).toContain('BEGIN;');
      expect(sql).toContain('SELECT * FROM finish();');
      expect(sql).toContain('ROLLBACK;');

      const planMatch = sql.match(/SELECT plan\((\d+)\);/);
      expect(planMatch, `Falta SELECT plan(N) en ${file}`).not.toBeNull();
      const plannedCount = Number(planMatch![1]);

      const assertions = sql.match(
        /SELECT\s+(is|is_empty|lives_ok|throws_ok|results_eq)\s*\(/g
      );
      expect(
        assertions?.length,
        `El número de aserciones en ${file} no coincide con SELECT plan(${plannedCount})`
      ).toBe(plannedCount);
    }
  });
});
