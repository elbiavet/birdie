'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useClub } from '@/components/providers/ClubProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import {
  canAccessAdminPanel,
  computeAdminDashboardStats,
  loadAdminDashboardStats,
  type AdminDashboardStats,
} from '@/lib/community';
import {
  sendClubPushNotification,
  type SendPushNotificationResult,
} from '@/lib/push';
import {
  Bell,
  BookOpen,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Lock,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Radio,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { club, profile, setRole } = useClub();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const isAdmin = canAccessAdminPanel(profile.role);

  const [stats, setStats] = useState<AdminDashboardStats>(() =>
    computeAdminDashboardStats()
  );

  // Consola de Notificaciones Push Masivas
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushTargetUrl, setPushTargetUrl] = useState('/news');
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState<SendPushNotificationResult | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushBody.trim()) {
      setPushError('El título y mensaje de la notificación son obligatorios.');
      return;
    }

    try {
      setPushSending(true);
      setPushError(null);
      const res = await sendClubPushNotification(
        {
          clubId: club.clubId,
          title: pushTitle.trim(),
          body: pushBody.trim(),
          targetUrl: pushTargetUrl,
        },
        profile.role
      );

      setPushResult(res);
      setPushTitle('');
      setPushBody('');
      setTimeout(() => setPushResult(null), 6000);
    } catch (err) {
      setPushError(
        err instanceof Error ? err.message : 'Error al emitir notificación push.'
      );
    } finally {
      setPushSending(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;

    loadAdminDashboardStats(profile.role)
      .then(({ stats: loaded }) => {
        if (active) setStats(loaded);
      })
      .catch(() => {
        // Conserva estadísticas computadas en modo demo
      });

    return () => {
      active = false;
    };
  }, [isAdmin, profile.role]);

  // Si no es administrador, renderiza pantalla de acceso restringido (403)
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="card-luxury rounded-3xl border border-rose-500/30 p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-500">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <span className="mt-4 inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-400">
            Error 403 · Permiso Denegado
          </span>

          <h1 className="mt-3 text-2xl font-bold text-[var(--theme-text-primary)] sm:text-3xl">
            Acceso Exclusivo para Administración
          </h1>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[var(--theme-text-secondary)]">
            El Panel de Administración de <span className="font-semibold text-[var(--theme-text-primary)]">{club.name}</span> está restringido a usuarios con rol <code className="rounded-md bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-1.5 py-0.5 font-mono text-xs text-rose-400">club_admin</code> o <code className="rounded-md bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-1.5 py-0.5 font-mono text-xs text-rose-400">superadmin</code>. Tu rol actual es <strong className="capitalize text-[var(--theme-text-primary)]">{profile.role}</strong>.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--theme-text-primary)] shadow-xs hover:border-[var(--theme-accent)] transition"
            >
              Volver al Inicio
            </Link>

            {/* En modo demo, facilitamos conmutar de rol para probar la consola */}
            <button
              type="button"
              onClick={() => setRole('club_admin')}
              className="btn-gold-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm cursor-pointer transition"
            >
              <ShieldCheck className="h-4 w-4" />
              Probar como Club Admin (Demo)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Cabecera Admin */}
      <div className="hero-banner-luxury relative overflow-hidden rounded-2xl border p-6 shadow-sm">
        {/* Curvas sutiles de fondo */}
        <svg
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-20 dark:opacity-15"
          viewBox="0 0 400 200"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0 200 C 150 180, 250 80, 400 0 L 400 200 Z"
            fill="url(#admin-hero-gold)"
          />
          <defs>
            <linearGradient id="admin-hero-gold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9AD74" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#E6D4A7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#BA9C61" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3 py-1 text-xs font-semibold text-[var(--theme-accent)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Gestión Integral · {club.name}
            </span>
            <h1 className="mt-2 text-2xl font-bold text-[var(--theme-text-primary)] sm:text-3xl">
              Panel de Administración del Club
            </h1>
            <p className="mt-1 text-sm text-[var(--theme-text-secondary)]">
              Consola de supervisión de socios, gestión de contenidos, moderación de foros y atención privada.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-4 py-2 text-xs">
            <Shield className="h-4 w-4 text-[var(--theme-accent)]" />
            <div>
              <p className="font-bold text-[var(--theme-text-primary)]">{profile.fullName}</p>
              <p className="text-[11px] capitalize text-[var(--theme-text-secondary)]">
                Rol: {profile.role}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de KPIs / Indicadores Principales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Socios */}
        <Link
          href="/players"
          className="card-luxury group rounded-2xl border p-5 shadow-sm transition hover:border-[var(--theme-accent)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--theme-text-secondary)]">
              Directorio de Socios
            </span>
            <div
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                  : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                color: '#0B0C10',
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl shadow-xs"
            >
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[var(--theme-text-primary)]">
            {stats.totalMembers}
          </p>
          <p className="mt-1 text-xs text-[var(--theme-text-secondary)]">
            Perfiles activos registrados
          </p>
        </Link>

        {/* Noticias */}
        <Link
          href="/news"
          className="card-luxury group rounded-2xl border p-5 shadow-sm transition hover:border-[var(--theme-accent)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--theme-text-secondary)]">
              Noticias y Avisos
            </span>
            <div
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                  : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                color: '#0B0C10',
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl shadow-xs"
            >
              <Newspaper className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[var(--theme-text-primary)]">
            {stats.publishedNewsCount}
          </p>
          <p className="mt-1 text-xs text-[var(--theme-text-secondary)]">
            Publicadas ({stats.draftNewsCount} en borrador)
          </p>
        </Link>

        {/* Foro */}
        <Link
          href="/forum"
          className="card-luxury group rounded-2xl border p-5 shadow-sm transition hover:border-[var(--theme-accent)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--theme-text-secondary)]">
              Foros y Comunidad
            </span>
            <div
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                  : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                color: '#0B0C10',
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl shadow-xs"
            >
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[var(--theme-text-primary)]">
            {stats.openForumThreadsCount}
          </p>
          <p className="mt-1 text-xs text-[var(--theme-text-secondary)]">
            Debates abiertos ({stats.lockedForumThreadsCount} cerrados)
          </p>
        </Link>

        {/* Atención y Consultas */}
        <Link
          href="/admin-chat"
          className="card-luxury group rounded-2xl border p-5 shadow-sm transition hover:border-[var(--theme-accent)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--theme-text-secondary)]">
              Atención al Socio
            </span>
            <div
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                  : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                color: '#0B0C10',
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl shadow-xs"
            >
              <MessageCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[var(--theme-text-primary)]">
            {stats.openAdminChatRoomsCount}
          </p>
          <p className="mt-1 text-xs text-[var(--theme-text-secondary)]">
            Salas activas ({stats.resolvedAdminChatRoomsCount} resueltas)
          </p>
        </Link>
      </div>

      {/* Operaciones Rápidas de Administración */}
      <div className="card-luxury rounded-2xl border p-6 shadow-sm">
        <h2 className="text-base font-bold text-[var(--theme-text-primary)]">
          Operaciones y Accesos de Gestión
        </h2>
        <p className="mt-0.5 text-xs text-[var(--theme-text-secondary)]">
          Accesos directos a las áreas de gestión del club configuradas en la plataforma white-label.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/news"
            className="flex items-start gap-3.5 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-4 transition hover:border-[var(--theme-accent)]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-surface)] text-[var(--theme-accent)] border border-[var(--theme-border)]">
              <Newspaper className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--theme-text-primary)]">
                Publicar Comunicado Oficial
              </h3>
              <p className="mt-1 text-xs text-[var(--theme-text-secondary)] leading-relaxed">
                Redactar y fijar noticias sobre mantenimiento, torneos y acuerdos del club.
              </p>
            </div>
          </Link>

          <Link
            href="/info"
            className="flex items-start gap-3.5 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-4 transition hover:border-[var(--theme-accent)]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-surface)] text-[var(--theme-accent)] border border-[var(--theme-border)]">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--theme-text-primary)]">
                Editar Información del Club
              </h3>
              <p className="mt-1 text-xs text-[var(--theme-text-secondary)] leading-relaxed">
                Actualizar reglas locales, tarifas de invitados, correspondencias y horarios.
              </p>
            </div>
          </Link>

          <Link
            href="/forum"
            className="flex items-start gap-3.5 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-4 transition hover:border-[var(--theme-accent)]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-surface)] text-[var(--theme-accent)] border border-[var(--theme-border)]">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--theme-text-primary)]">
                Moderar Foros del Club
              </h3>
              <p className="mt-1 text-xs text-[var(--theme-text-secondary)] leading-relaxed">
                Fijar avisos del comité y bloquear debates cerrados para evitar spam.
              </p>
            </div>
          </Link>

          <Link
            href="/admin-chat"
            className="flex items-start gap-3.5 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-4 transition hover:border-[var(--theme-accent)]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-surface)] text-[var(--theme-accent)] border border-[var(--theme-border)]">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--theme-text-primary)]">
                Atender Consultas Privadas
              </h3>
              <p className="mt-1 text-xs text-[var(--theme-text-secondary)] leading-relaxed">
                Responder individualmente a las consultas de hándicap, taquillas y licencias.
              </p>
            </div>
          </Link>

          <Link
            href="/bookings"
            className="flex items-start gap-3.5 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-4 transition hover:border-[var(--theme-accent)]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-surface)] text-[var(--theme-accent)] border border-[var(--theme-border)]">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--theme-text-primary)]">
                Gestión de Tee Times
              </h3>
              <p className="mt-1 text-xs text-[var(--theme-text-secondary)] leading-relaxed">
                Supervisar la ocupación del campo, bloqueos por mantenimiento y salidas.
              </p>
            </div>
          </Link>

          <Link
            href="/tournaments"
            className="flex items-start gap-3.5 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-4 transition hover:border-[var(--theme-accent)]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-surface)] text-[var(--theme-accent)] border border-[var(--theme-border)]">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--theme-text-primary)]">
                Torneos y Competición
              </h3>
              <p className="mt-1 text-xs text-[var(--theme-text-secondary)] leading-relaxed">
                Consultar listas de inscritos, clasificaciones y calendario oficial.
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Consola de Notificaciones Push Masivas (FCM / APNs) */}
      <div className="card-luxury rounded-2xl border p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--theme-border)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--theme-surface-subtle)] text-[var(--theme-accent)] border border-[var(--theme-border)]">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--theme-text-primary)]">
                Emisión de Notificaciones Push (FCM / APNs)
              </h2>
              <p className="text-xs text-[var(--theme-text-secondary)]">
                Envía alertas prioritarias a los dispositivos de los socios registrados en el club.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            <Radio className="h-3 w-3 animate-pulse" />
            Canal Activo · {club.name}
          </span>
        </div>

        {pushError && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            {pushError}
          </div>
        )}

        {pushResult && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-400 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                Notificación emitida exitosamente a <strong>{pushResult.sentCount}</strong> dispositivo(s)
                {pushResult.status === 'simulated' ? ' (Modo simulación / staging)' : ''}.
              </span>
            </div>
            <div className="flex gap-2 text-[11px] opacity-90">
              <span>Android: {pushResult.platforms.android}</span>·
              <span>iOS: {pushResult.platforms.ios}</span>·
              <span>Web: {pushResult.platforms.web}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSendPush} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-[var(--theme-text-primary)]">
                Título del Aviso *
              </label>
              <input
                type="text"
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                placeholder="Ej. Torneo Social de Primavera / Cierre temporal hoyo 4"
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3.5 py-2 text-xs text-[var(--theme-text-primary)] placeholder-[var(--theme-text-secondary)]/50 focus:border-[var(--theme-accent)] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--theme-text-primary)]">
                Ruta de Destino (Deep-link)
              </label>
              <select
                value={pushTargetUrl}
                onChange={(e) => setPushTargetUrl(e.target.value)}
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3.5 py-2 text-xs text-[var(--theme-text-primary)] focus:border-[var(--theme-accent)] focus:outline-none"
              >
                <option value="/news">Noticias (/news)</option>
                <option value="/tournaments">Torneos (/tournaments)</option>
                <option value="/bookings">Tee Times (/bookings)</option>
                <option value="/forum">Foro del Club (/forum)</option>
                <option value="/info">Información (/info)</option>
                <option value="/">Inicio (/)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--theme-text-primary)]">
              Mensaje de la Notificación *
            </label>
            <textarea
              rows={3}
              value={pushBody}
              onChange={(e) => setPushBody(e.target.value)}
              placeholder="Escribe el texto de la alerta que recibirán los socios en su móvil..."
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3.5 py-2 text-xs text-[var(--theme-text-primary)] placeholder-[var(--theme-text-secondary)]/50 focus:border-[var(--theme-accent)] focus:outline-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={pushSending}
              className="btn-gold-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {pushSending ? 'Transmitiendo...' : 'Transmitir Notificación Push'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
