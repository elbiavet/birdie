'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import {
  createForumThread,
  filterForumThreads,
  INITIAL_FORUM_THREADS,
  isClubAdminOrSuperadminRole,
  loadForumThreads,
  replyToForumThread,
  subscribeToForumRealtime,
  toggleForumThreadLock,
  type ForumCategory,
  type ForumThreadItem,
} from '@/lib/community';
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  MessageCircle,
  MessageSquare,
  Pin,
  PlusCircle,
  Radio,
  Search,
  ShieldCheck,
  Unlock,
  User,
  Users,
} from 'lucide-react';

const CATEGORY_LABELS: Record<ForumCategory, string> = {
  general: 'General',
  find_partner: 'Buscar Compañero',
  rules: 'Reglas y Normativa',
  equipment: 'Material y Fitting',
  competitions: 'Torneos y Competición',
};

const CATEGORIES: Array<{ id: ForumCategory | 'all'; label: string }> = [
  { id: 'all', label: 'Todos los debates' },
  { id: 'general', label: 'General' },
  { id: 'find_partner', label: 'Buscar Compañero' },
  { id: 'rules', label: 'Reglas y Normativa' },
  { id: 'equipment', label: 'Material y Fitting' },
  { id: 'competitions', label: 'Torneos y Competición' },
];

export default function ForumPage() {
  const { club, profile } = useClub();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [threads, setThreads] = useState<ForumThreadItem[]>(INITIAL_FORUM_THREADS);
  const [selectedCategory, setSelectedCategory] = useState<ForumCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);

  // Formulario nuevo debate
  const [showNewThreadForm, setShowNewThreadForm] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<ForumCategory>('general');
  const [newBody, setNewBody] = useState<string>('');
  const [newPinned, setNewPinned] = useState<boolean>(false);

  // Formulario respuesta
  const [replyBody, setReplyBody] = useState<string>('');

  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

  const isAdmin = profile ? isClubAdminOrSuperadminRole(profile.role) : false;

  // Carga inicial y suscripción Realtime
  useEffect(() => {
    let active = true;
    loadForumThreads()
      .then(({ threads: remoteThreads }) => {
        if (!active || remoteThreads.length === 0) return;
        setThreads(remoteThreads);
      })
      .catch(() => {
        // Mantiene datos locales si no hay conexión
      });

    const unsubscribe = subscribeToForumRealtime({
      channelName: `forum_channel_${club.clubId}`,
      onThreadChange: () => {
        loadForumThreads()
          .then(({ threads: reloaded }) => {
            if (active && reloaded.length > 0) setThreads(reloaded);
          })
          .catch(() => {});
      },
      onPostChange: () => {
        loadForumThreads()
          .then(({ threads: reloaded }) => {
            if (active && reloaded.length > 0) setThreads(reloaded);
          })
          .catch(() => {});
      },
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [club.clubId]);

  const filteredThreads = useMemo(
    () =>
      filterForumThreads(threads, {
        category: selectedCategory,
        searchQuery,
      }),
    [threads, selectedCategory, searchQuery]
  );

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { updatedThreads, createdThread, meta } = await createForumThread(threads, {
        authorId: profile?.id ?? 'guest',
        authorName: profile?.fullName || 'Socio del Club',
        actorRole: profile?.role ?? 'player',
        category: newCategory,
        title: newTitle,
        body: newBody,
        isPinned: isAdmin ? newPinned : false,
      });

      setThreads(updatedThreads);
      setNewTitle('');
      setNewBody('');
      setNewPinned(false);
      setShowNewThreadForm(false);
      setExpandedThreadId(createdThread.id);
      setFeedback({
        type: 'ok',
        message: meta.persistedToBackend
          ? 'Debate abierto con éxito en el servidor.'
          : 'Debate abierto en modo demo local.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al abrir el debate.',
      });
    }
  };

  const handleReply = async (threadId: string, e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { updatedThreads, meta } = await replyToForumThread(threads, {
        threadId,
        authorId: profile?.id ?? 'guest',
        authorName: profile?.fullName || 'Socio del Club',
        actorRole: profile?.role ?? 'player',
        body: replyBody,
      });

      setThreads(updatedThreads);
      setReplyBody('');
      setFeedback({
        type: 'ok',
        message: meta.persistedToBackend
          ? 'Respuesta publicada en el servidor.'
          : 'Respuesta añadida en modo demo local.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al responder al debate.',
      });
    }
  };

  const handleToggleLock = async (threadId: string, currentLockState: boolean) => {
    try {
      const { updatedThreads, meta } = await toggleForumThreadLock(threads, {
        threadId,
        actorRole: profile?.role ?? 'player',
        isLocked: !currentLockState,
      });

      setThreads(updatedThreads);
      setFeedback({
        type: 'ok',
        message: meta.persistedToBackend
          ? `Debate ${!currentLockState ? 'bloqueado' : 'desbloqueado'} con éxito en el servidor.`
          : `Debate ${!currentLockState ? 'bloqueado' : 'desbloqueado'} en modo demo local.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al cambiar bloqueo del debate.',
      });
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Cabecera */}
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
            fill="url(#forum-hero-gold)"
          />
          <defs>
            <linearGradient id="forum-hero-gold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9AD74" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#E6D4A7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#BA9C61" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3 py-1 text-xs font-semibold text-[var(--theme-accent)]">
                <MessageSquare className="h-3.5 w-3.5" />
                Comunidad Oficial · {club.name}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-2.5 py-1 text-xs font-medium text-[var(--theme-text-primary)]">
                <Radio className="h-3 w-3 animate-pulse text-[var(--theme-accent)]" />
                Tiempo Real
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-[var(--theme-text-primary)] sm:text-3xl">
              Foro del Club
            </h1>
            <p className="mt-1 text-sm text-[var(--theme-text-secondary)]">
              Punto de encuentro para organizar partidas, consultar reglas, comentar material o debatir sobre el club.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewThreadForm((prev) => !prev)}
            className="btn-gold-gradient inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            {showNewThreadForm ? 'Cancelar' : 'Abrir Debate'}
          </button>
        </div>

        {/* Feedback visual */}
        {feedback && (
          <div
            className={`relative z-10 mt-4 flex items-center justify-between gap-2 rounded-2xl p-3.5 text-xs font-medium ${
              feedback.type === 'ok'
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border border-rose-500/30 bg-rose-500/10 text-rose-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-bold underline hover:opacity-80"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Formulario para abrir nuevo debate */}
        {showNewThreadForm && (
          <form
            onSubmit={handleCreateThread}
            className="card-luxury relative z-10 mt-6 rounded-2xl border p-5"
          >
            <h3 className="text-base font-bold text-[var(--theme-text-primary)]">
              Nuevo Debate en el Foro
            </h3>
            <p className="mt-0.5 text-xs text-[var(--theme-text-secondary)]">
              Participando como: <span className="font-semibold text-[var(--theme-text-primary)]">{profile?.fullName ?? 'Invitado'}</span> ({profile?.role ?? 'sin sesión'})
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[var(--theme-text-primary)]">
                  Título del Debate
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ej: Busco jugador para Fourball este domingo"
                  className="mt-1 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3 py-2 text-sm text-[var(--theme-text-primary)] focus:border-[var(--theme-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--theme-text-primary)]">
                  Categoría
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ForumCategory)}
                  className="mt-1 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3 py-2 text-sm text-[var(--theme-text-primary)] focus:border-[var(--theme-accent)] focus:outline-none"
                >
                  <option value="general" className="bg-[var(--theme-surface)] text-[var(--theme-text-primary)]">General</option>
                  <option value="find_partner" className="bg-[var(--theme-surface)] text-[var(--theme-text-primary)]">Buscar Compañero</option>
                  <option value="rules" className="bg-[var(--theme-surface)] text-[var(--theme-text-primary)]">Reglas y Normativa</option>
                  <option value="equipment" className="bg-[var(--theme-surface)] text-[var(--theme-text-primary)]">Material y Fitting</option>
                  <option value="competitions" className="bg-[var(--theme-surface)] text-[var(--theme-text-primary)]">Torneos y Competición</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold text-[var(--theme-text-primary)]">
                Mensaje inicial
              </label>
              <textarea
                required
                rows={4}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Escribe los detalles de tu consulta, propuesta de partida o comentario..."
                className="mt-1 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-3 text-sm text-[var(--theme-text-primary)] focus:border-[var(--theme-accent)] focus:outline-none"
              />
            </div>

            {isAdmin && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pinThread"
                  checked={newPinned}
                  onChange={(e) => setNewPinned(e.target.checked)}
                  className="h-4 w-4 rounded accent-[var(--theme-accent)]"
                />
                <label htmlFor="pinThread" className="text-xs font-medium text-[var(--theme-text-secondary)]">
                  Fijar en la parte superior del foro (privilegio de administración)
                </label>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewThreadForm(false)}
                className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--theme-text-secondary)] hover:border-[var(--theme-accent)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-gold-gradient rounded-xl px-4 py-2 text-xs font-bold shadow-sm cursor-pointer"
              >
                Publicar Debate
              </button>
            </div>
          </form>
        )}

        {/* Buscador y Pestañas de Categoría */}
        <div className="relative z-10 mt-6 flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--theme-text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, contenido o autor..."
              className="w-full rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] py-2.5 pl-10 pr-4 text-sm text-[var(--theme-text-primary)] placeholder-[var(--theme-text-secondary)] focus:border-[var(--theme-accent)] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={
                  selectedCategory === cat.id
                    ? {
                        background: isDark
                          ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                          : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                        color: '#0B0C10',
                        borderColor: isDark ? '#DFCB9E' : '#CCB88E',
                      }
                    : undefined
                }
                className={`rounded-xl border px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'shadow-xs font-bold'
                    : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-secondary)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-text-primary)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Listado de Hilos */}
      <div className="space-y-4">
        {filteredThreads.length === 0 ? (
          <div className="card-luxury rounded-2xl border p-8 text-center">
            <MessageCircle className="mx-auto h-8 w-8 text-[var(--theme-accent)]" />
            <h3 className="mt-2 text-sm font-bold text-[var(--theme-text-primary)]">
              No hay debates en esta categoría
            </h3>
            <p className="mt-1 text-xs text-[var(--theme-text-secondary)]">
              Sé el primero en abrir una conversación pulsando el botón &quot;Abrir Debate&quot;.
            </p>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const isExpanded = expandedThreadId === thread.id;
            return (
              <article
                key={thread.id}
                className={`card-luxury rounded-2xl border transition shadow-sm ${
                  thread.isPinned
                    ? 'border-[var(--theme-accent)]/60'
                    : ''
                }`}
              >
                <div className="p-5 sm:p-6">
                  {/* Badges superiores y moderación */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-2.5 py-0.5 text-xs font-semibold text-[var(--theme-text-primary)]">
                        {CATEGORY_LABELS[thread.category]}
                      </span>
                      {thread.isPinned && (
                        <span
                          style={{
                            background: isDark
                              ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                              : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                            color: '#0B0C10',
                            borderColor: isDark ? '#DFCB9E' : '#CCB88E',
                          }}
                          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold shadow-xs"
                        >
                          <Pin className="h-3 w-3" />
                          Fijado
                        </span>
                      )}
                      {thread.isLocked && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-400">
                          <Lock className="h-3 w-3" />
                          Cerrado
                        </span>
                      )}
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleToggleLock(thread.id, thread.isLocked)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition cursor-pointer ${
                          thread.isLocked
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                        }`}
                      >
                        {thread.isLocked ? (
                          <>
                            <Unlock className="h-3.5 w-3.5" />
                            Desbloquear debate
                          </>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5" />
                            Bloquear debate
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Título y cuerpo */}
                  <h2 className="mt-3 text-lg font-bold text-[var(--theme-text-primary)] sm:text-xl">
                    {thread.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--theme-text-secondary)]">
                    {thread.body}
                  </p>

                  {/* Metadatos autor y botón de respuestas */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--theme-border)] pt-3 text-xs text-[var(--theme-text-secondary)]">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                      <span>{thread.authorName}</span>
                      <span>·</span>
                      <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedThreadId(isExpanded ? null : thread.id)
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3 py-1.5 font-bold text-[var(--theme-text-primary)] transition hover:border-[var(--theme-accent)] cursor-pointer"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
                      <span>
                        {thread.postsCount}{' '}
                        {thread.postsCount === 1 ? 'respuesta' : 'respuestas'}
                      </span>
                      <span>·</span>
                      <span className="text-[var(--theme-accent)] underline">
                        {isExpanded ? 'Ocultar' : 'Ver y responder'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Zona expandida de respuestas */}
                {isExpanded && (
                  <div className="border-t border-[var(--theme-border)] bg-[var(--theme-surface-subtle)]/60 p-5 sm:p-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                      Respuestas ({thread.posts?.length ?? 0})
                    </h4>

                    {/* Lista de respuestas */}
                    <div className="mt-3 space-y-3">
                      {(thread.posts ?? []).length === 0 ? (
                        <p className="text-xs text-[var(--theme-text-secondary)]">
                          Aún no hay respuestas en este debate.
                        </p>
                      ) : (
                        thread.posts?.map((post) => (
                          <div
                            key={post.id}
                            className="card-luxury rounded-2xl border p-3.5 shadow-xs"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs text-[var(--theme-text-secondary)]">
                              <div className="flex items-center gap-1.5 font-semibold text-[var(--theme-text-primary)]">
                                <span>{post.authorName}</span>
                                {post.authorRole &&
                                  isClubAdminOrSuperadminRole(post.authorRole) && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--theme-accent)]">
                                      <ShieldCheck className="h-2.5 w-2.5" />
                                      Comité
                                    </span>
                                  )}
                              </div>
                              <span className="text-[11px]">
                                {new Date(post.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs leading-relaxed text-[var(--theme-text-secondary)]">
                              {post.body}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Formulario para responder o aviso de bloqueo */}
                    <div className="mt-5 border-t border-[var(--theme-border)] pt-4">
                      {thread.isLocked && !isAdmin ? (
                        <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
                          <Lock className="h-4 w-4 shrink-0 text-rose-500" />
                          <span>
                            Este debate ha sido cerrado por la administración. No admite nuevas respuestas de socios.
                          </span>
                        </div>
                      ) : (
                        <form onSubmit={(e) => handleReply(thread.id, e)} className="space-y-3">
                          {thread.isLocked && isAdmin && (
                            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400">
                              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                              <span>
                                Estás respondiendo como Administrador en un debate bloqueado.
                              </span>
                            </div>
                          )}
                          <textarea
                            required
                            rows={3}
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            placeholder="Añadir una respuesta al debate..."
                            className="w-full rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-3 text-xs text-[var(--theme-text-primary)] placeholder-[var(--theme-text-secondary)] focus:border-[var(--theme-accent)] focus:outline-none"
                          />
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              className="btn-gold-gradient rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
                            >
                              Publicar Respuesta
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
