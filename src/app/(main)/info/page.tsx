'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import {
  filterClubInfoPages,
  INITIAL_CLUB_INFO_PAGES,
  isClubAdminOrSuperadminRole,
  loadClubInfoPages,
  updateClubInfoPage,
  type ClubInfoCategory,
  type ClubInfoPageItem,
} from '@/lib/community';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Globe,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
} from 'lucide-react';

const INFO_CATEGORIES: Array<{
  id: ClubInfoCategory | 'all';
  label: string;
}> = [
  { id: 'all', label: 'Todas las Secciones' },
  { id: 'normativa', label: 'Reglas Locales y Etiqueta' },
  { id: 'servicios', label: 'Horarios y Tarifas' },
  { id: 'correspondencias', label: 'Correspondencias' },
];

export default function ClubInfoPage() {
  const { club, profile } = useClub();
  const [pages, setPages] = useState<ClubInfoPageItem[]>(
    INITIAL_CLUB_INFO_PAGES
  );
  const [selectedCategory, setSelectedCategory] = useState<
    ClubInfoCategory | 'all'
  >('all');
  const [editingSlug, setEditingSlug] = useState<string>('reglas-locales');
  const [editTitle, setEditTitle] = useState<string>(
    INITIAL_CLUB_INFO_PAGES[0].title
  );
  const [editCategory, setEditCategory] =
    useState<ClubInfoCategory>('normativa');
  const [editMarkdown, setEditMarkdown] = useState<string>(
    INITIAL_CLUB_INFO_PAGES[0].contentMarkdown
  );
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

  const isAdmin = isClubAdminOrSuperadminRole(profile.role);

  useEffect(() => {
    let active = true;
    loadClubInfoPages()
      .then(({ pages: remotePages }) => {
        if (!active || remotePages.length === 0) return;
        setPages(remotePages);
        setEditingSlug(remotePages[0].slug);
        setEditTitle(remotePages[0].title);
        setEditCategory(remotePages[0].category);
        setEditMarkdown(remotePages[0].contentMarkdown);
      })
      .catch(() => {
        // Conserva páginas semilla si no hay conexión
      });
    return () => {
      active = false;
    };
  }, []);

  const visiblePages = useMemo(
    () => filterClubInfoPages(pages, selectedCategory),
    [pages, selectedCategory]
  );

  const handleSelectPageForEdit = (page: ClubInfoPageItem) => {
    setEditingSlug(page.slug);
    setEditTitle(page.title);
    setEditCategory(page.category);
    setEditMarkdown(page.contentMarkdown);
  };

  const handleSaveInfoPage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { updatedPages, savedPage, meta } = await updateClubInfoPage(
        pages,
        {
          slug: editingSlug,
          title: editTitle,
          category: editCategory,
          contentMarkdown: editMarkdown,
          actorUserId: profile.id,
          actorRole: profile.role,
        }
      );
      setPages(updatedPages);
      setFeedback({
        type: 'ok',
        message: `Sección "${savedPage.title}" actualizada. ${meta.notice}`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'No se pudo actualizar la sección.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera + Datos de Contacto White-Label del Club */}
      <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-accent)]/15 px-3 py-1 text-xs font-semibold text-[var(--theme-accent)]">
              <BookOpen className="h-3.5 w-3.5" />
              Guía del Socio · Normativa, Tarifas y Contacto Oficial
            </span>
            <h2 className="mt-2 text-2xl font-bold text-[var(--theme-text-primary)]">
              Información de Interés — {club.name}
            </h2>
            <p className="text-sm font-normal text-[var(--theme-text-secondary)]">{club.tagline}</p>
          </div>

          <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] p-4 text-xs text-[var(--theme-text-secondary)] sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
              <span className="font-semibold text-[var(--theme-text-primary)]">{club.contact?.phone ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
              <span className="font-semibold text-[var(--theme-text-primary)]">{club.contact?.email ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
              <span className="font-normal text-[var(--theme-text-primary)]">{club.contact?.address ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
              <span className="font-normal text-[var(--theme-text-primary)]">{club.contact?.website ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* Pestañas de Categoría */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {INFO_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                selectedCategory === cat.id
                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white shadow-sm'
                  : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
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
        {/* Tarjetas de Información */}
        <section
          className={`space-y-4 ${
            isAdmin ? 'lg:col-span-7' : 'lg:col-span-12'
          }`}
        >
          {visiblePages.map((page) => (
            <article
              key={page.id}
              onClick={() => isAdmin && handleSelectPageForEdit(page)}
              className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-sm cursor-pointer transition hover:border-[var(--theme-accent)]/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-[var(--theme-accent)]/15 px-3 py-1 text-xs font-semibold uppercase text-[var(--theme-accent)]">
                  {page.category}
                </span>
                <span className="text-xs font-normal text-[var(--theme-text-secondary)]">
                  Actualizado: {page.updatedAt.slice(0, 10)}
                </span>
              </div>

              <h3 className="mt-3 text-lg font-bold text-[var(--theme-text-primary)]">
                {page.title}
              </h3>

              <div className="mt-3 whitespace-pre-line text-sm font-normal leading-relaxed text-[var(--theme-text-secondary)]">
                {page.contentMarkdown}
              </div>
            </article>
          ))}
        </section>

        {/* Editor exclusivo para club_admin / superadmin */}
        {isAdmin && (
          <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-sm lg:col-span-5">
            <div className="flex items-center gap-2 border-b border-[var(--theme-border)] pb-4">
              <ShieldCheck className="h-5 w-5 text-[var(--theme-accent)]" />
              <div>
                <h3 className="text-base font-bold text-[var(--theme-text-primary)]">
                  Editar Información del Club
                </h3>
                <p className="text-xs font-normal text-[var(--theme-text-secondary)]">
                  Haz clic en una tarjeta o edita el contenido oficial
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveInfoPage} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                  Sección (Slug)
                </label>
                <input
                  type="text"
                  value={editingSlug}
                  onChange={(e) => setEditingSlug(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3.5 py-2 font-mono text-xs text-[var(--theme-text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                  Título
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3.5 py-2 text-sm font-normal text-[var(--theme-text-primary)] placeholder-[var(--theme-text-secondary)] focus:border-[var(--theme-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                  Categoría
                </label>
                <select
                  value={editCategory}
                  onChange={(e) =>
                    setEditCategory(e.target.value as ClubInfoCategory)
                  }
                  className="mt-1.5 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3.5 py-2 text-sm font-normal text-[var(--theme-text-primary)] focus:border-[var(--theme-accent)] focus:outline-none"
                >
                  <option value="normativa" className="bg-[var(--theme-surface)] text-[var(--theme-text-primary)]">Normativa y Reglas Locales</option>
                  <option value="servicios" className="bg-[var(--theme-surface)] text-[var(--theme-text-primary)]">Horarios y Servicios</option>
                  <option value="correspondencias" className="bg-[var(--theme-surface)] text-[var(--theme-text-primary)]">Correspondencias</option>
                  <option value="general" className="bg-[var(--theme-surface)] text-[var(--theme-text-primary)]">General</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-secondary)]">
                  Contenido (Markdown)
                </label>
                <textarea
                  rows={5}
                  value={editMarkdown}
                  onChange={(e) => setEditMarkdown(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-3.5 py-2 text-sm font-normal text-[var(--theme-text-primary)] placeholder-[var(--theme-text-secondary)] focus:border-[var(--theme-accent)] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-club-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
              >
                <Save className="h-4 w-4" />
                Guardar Cambios Oficiales
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
