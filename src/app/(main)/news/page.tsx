'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import {
  filterNewsArticles,
  INITIAL_NEWS_ARTICLES,
  isClubAdminOrSuperadminRole,
  loadNewsArticles,
  publishNewsArticle,
  type NewsArticleItem,
} from '@/lib/community';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Newspaper,
  Pin,
  PlusCircle,
  Search,
  ShieldCheck,
} from 'lucide-react';

export default function ClubNewsPage() {
  const { club, profile } = useClub();
  const [articles, setArticles] = useState<NewsArticleItem[]>(
    INITIAL_NEWS_ARTICLES
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyPinned, setOnlyPinned] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

  const isAdmin = isClubAdminOrSuperadminRole(profile.role);

  useEffect(() => {
    let active = true;
    loadNewsArticles(profile.role)
      .then(({ articles: remoteArticles }) => {
        if (!active || remoteArticles.length === 0) return;
        setArticles(remoteArticles);
      })
      .catch(() => {
        // Conserva artículos semilla si no hay conexión
      });
    return () => {
      active = false;
    };
  }, [profile.role]);

  const visibleArticles = useMemo(
    () =>
      filterNewsArticles(articles, {
        searchQuery,
        onlyPinned,
        viewerRole: profile.role,
        includeUnpublished: isAdmin,
      }),
    [articles, searchQuery, onlyPinned, profile.role, isAdmin]
  );

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { updatedArticles, createdArticle, meta } =
        await publishNewsArticle(articles, {
          title,
          summary,
          content,
          isPinned,
          isPublished: true,
          authorId: profile.id,
          actorRole: profile.role,
        });
      setArticles(updatedArticles);
      setTitle('');
      setSummary('');
      setContent('');
      setIsPinned(false);
      setFeedback({
        type: 'ok',
        message: `Noticia "${createdArticle.title}" publicada. ${meta.notice}`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'No se pudo publicar la noticia.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-accent)]/15 px-3 py-1 text-xs font-semibold text-[var(--theme-accent)]">
              <Newspaper className="h-3.5 w-3.5" />
              Comunicados Oficiales y Estado del Campo
            </span>
            <h2 className="mt-2 text-2xl font-bold text-[var(--theme-text-primary)]">
              Noticias de {club.name}
            </h2>
            <p className="text-sm font-normal text-[var(--theme-text-secondary)]">
              Avisos de Greenkeeping, crónicas de torneos y comunicados del
              Comité de Competición.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyPinned((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                onlyPinned
                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white shadow-sm'
                  : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)]'
              }`}
            >
              <Pin className="h-3.5 w-3.5" />
              {onlyPinned ? 'Mostrando solo Fijadas' : 'Filtrar Fijadas'}
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--theme-text-secondary)]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar comunicados por título o palabra clave (ej. greens, Match Play)..."
            aria-label="Buscar noticias del club"
            className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] py-2.5 pl-10 pr-4 text-sm font-normal text-[var(--theme-text-primary)] placeholder-[var(--theme-text-secondary)] focus:border-[var(--theme-accent)] focus:outline-none"
          />
        </div>

        {feedback && (
          <div
            role="status"
            className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${
              feedback.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Listado de Noticias */}
        <section
          className={`space-y-4 ${
            isAdmin ? 'lg:col-span-7' : 'lg:col-span-12'
          }`}
        >
          {visibleArticles.map((article) => (
            <article
              key={article.id}
              className={`rounded-2xl border p-6 shadow-sm transition ${
                article.isPinned
                  ? 'border-[var(--theme-accent)]/50 bg-[var(--theme-surface-subtle)]'
                  : 'border-[var(--theme-border)] bg-[var(--theme-surface)]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {article.isPinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-accent)]/20 px-2.5 py-0.5 text-xs font-semibold text-[var(--theme-accent)]">
                      <Pin className="h-3 w-3" />
                      Comunicado Fijado
                    </span>
                  )}
                  {!article.isPublished && (
                    <span className="rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-2.5 py-0.5 text-xs font-medium text-[var(--theme-text-secondary)]">
                      Borrador Interno
                    </span>
                  )}
                </div>

                <span className="inline-flex items-center gap-1 text-xs font-normal text-[var(--theme-text-secondary)]">
                  <Calendar className="h-3.5 w-3.5" />
                  {article.publishedAt.slice(0, 10)}
                </span>
              </div>

              <h3 className="mt-2.5 text-lg font-bold text-[var(--theme-text-primary)]">
                {article.title}
              </h3>
              <p className="mt-1.5 text-xs font-semibold text-[var(--theme-accent)]">
                {article.summary}
              </p>
              <p className="mt-3 text-sm font-normal leading-relaxed text-[var(--theme-text-secondary)]">
                {article.content}
              </p>
            </article>
          ))}
        </section>

        {/* Formulario de Publicación exclusivo para club_admin / superadmin */}
        {isAdmin && (
          <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-sm lg:col-span-5">
            <div className="flex items-center gap-2 border-b border-[var(--theme-border)] pb-4">
              <ShieldCheck className="h-5 w-5 text-[var(--theme-accent)]" />
              <div>
                <h3 className="text-base font-bold text-[var(--theme-text-primary)]">
                  Publicar Comunicado Oficial
                </h3>
                <p className="text-xs font-normal text-[var(--theme-text-secondary)]">
                  Exclusivo Comité / Administración ({profile.role})
                </p>
              </div>
            </div>

            <form onSubmit={handlePublish} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                  Título de la Noticia
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Horarios especiales Torneo Aniversario"
                  className="mt-1.5 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3.5 py-2 text-sm font-normal text-[var(--theme-text-primary)] placeholder-[var(--theme-text-secondary)] focus:border-[var(--theme-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                  Resumen Ejecutivo
                </label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Subtítulo breve para la tarjeta de portada"
                  className="mt-1.5 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3.5 py-2 text-sm font-normal text-[var(--theme-text-primary)] placeholder-[var(--theme-text-secondary)] focus:border-[var(--theme-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                  Contenido Completo
                </label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Redacta el comunicado completo para los socios..."
                  className="mt-1.5 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3.5 py-2 text-sm font-normal text-[var(--theme-text-primary)] placeholder-[var(--theme-text-secondary)] focus:border-[var(--theme-accent)] focus:outline-none"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-3 text-xs font-semibold text-[var(--theme-text-primary)]">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="h-4 w-4 rounded accent-[var(--theme-accent)]"
                />
                <span>Fijar comunicado en la parte superior</span>
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-club-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
              >
                <PlusCircle className="h-4 w-4" />
                Publicar Noticia
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
