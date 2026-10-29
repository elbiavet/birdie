'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useClub } from '@/components/providers/ClubProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import {
  getVisibleAdminChatRooms,
  INITIAL_ADMIN_CHAT_ROOMS,
  isClubAdminOrSuperadminRole,
  loadAdminChatRooms,
  sendAdminChatMessage,
  subscribeToAdminChatRealtime,
  type AdminChatMessageItem,
  type AdminChatRoomItem,
} from '@/lib/community';
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  MessageSquare,
  Radio,
  Search,
  Send,
  Shield,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';

export default function AdminChatPage() {
  const { club, profile } = useClub();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [rooms, setRooms] = useState<AdminChatRoomItem[]>(INITIAL_ADMIN_CHAT_ROOMS);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

  const isAdmin = isClubAdminOrSuperadminRole(profile.role);

  // Carga inicial y suscripción Realtime
  useEffect(() => {
    let active = true;
    loadAdminChatRooms({ id: profile.id, role: profile.role, name: profile.fullName })
      .then(({ rooms: loadedRooms }) => {
        if (!active || loadedRooms.length === 0) return;
        setRooms(loadedRooms);
        if (!activeRoomId && loadedRooms.length > 0) {
          setActiveRoomId(loadedRooms[0].id);
        }
      })
      .catch(() => {
        // Mantiene salas locales si no hay conexión
      });

    const unsubscribe = subscribeToAdminChatRealtime({
      channelName: `admin_chat_channel_${club.clubId}`,
      onMessageReceived: () => {
        loadAdminChatRooms({ id: profile.id, role: profile.role, name: profile.fullName })
          .then(({ rooms: reloaded }) => {
            if (active && reloaded.length > 0) setRooms(reloaded);
          })
          .catch(() => {});
      },
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [club.clubId, profile.id, profile.role, profile.fullName, activeRoomId]);

  // Filtrado estricto por privacidad: un player solo ve sus salas; admins ven todas
  const visibleRooms = useMemo(
    () =>
      getVisibleAdminChatRooms(rooms, {
        id: profile.id,
        role: profile.role,
        name: profile.fullName,
      }),
    [rooms, profile.id, profile.role, profile.fullName]
  );

  const filteredRoomsForAdmin = useMemo(() => {
    if (!isAdmin) return visibleRooms;
    const q = searchFilter.trim().toLowerCase();
    if (!q) return visibleRooms;
    return visibleRooms.filter(
      (r) =>
        r.playerName.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        (r.playerLicense && r.playerLicense.toLowerCase().includes(q))
    );
  }, [visibleRooms, isAdmin, searchFilter]);

  const activeRoom = useMemo(() => {
    if (visibleRooms.length === 0) return null;
    if (activeRoomId) {
      const found = visibleRooms.find((r) => r.id === activeRoomId);
      if (found) return found;
    }
    return visibleRooms[0];
  }, [visibleRooms, activeRoomId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;

    try {
      const { updatedRooms, meta } = await sendAdminChatMessage(rooms, {
        roomId: activeRoom.id,
        senderId: profile.id,
        senderName: profile.fullName || (isAdmin ? 'Administración' : 'Socio'),
        senderRole: profile.role,
        body: messageText,
      });

      setRooms(updatedRooms);
      setMessageText('');
      setFeedback({
        type: 'ok',
        message: meta.persistedToBackend
          ? 'Mensaje entregado en el servidor.'
          : 'Mensaje enviado en modo demo local.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al enviar el mensaje.',
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
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
            fill="url(#adminchat-hero-gold)"
          />
          <defs>
            <linearGradient id="adminchat-hero-gold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9AD74" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#E6D4A7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#BA9C61" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-3 py-1 text-xs font-semibold text-[var(--theme-accent)]">
                <Lock className="h-3.5 w-3.5" />
                Canal Privado 1-a-1 · {club.name}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-2.5 py-1 text-xs font-medium text-[var(--theme-text-primary)]">
                <Radio className="h-3 w-3 animate-pulse text-[var(--theme-accent)]" />
                Tiempo Real
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-[var(--theme-text-primary)] sm:text-3xl">
              {isAdmin ? 'Bandeja de Consultas de Socios' : 'Chat con Administración'}
            </h1>
            <p className="mt-1 text-sm text-[var(--theme-text-secondary)]">
              {isAdmin
                ? 'Panel de atención y resolución directa de consultas, licencias y solicitudes de socios.'
                : 'Comunícate directamente con el comité y la secretaría del club para cualquier gestión deportiva o administrativa.'}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-4 py-2 text-xs">
            <User className="h-4 w-4 text-[var(--theme-accent)]" />
            <div>
              <p className="font-bold text-[var(--theme-text-primary)]">{profile.fullName}</p>
              <p className="text-[11px] capitalize text-[var(--theme-text-secondary)]">{profile.role}</p>
            </div>
          </div>
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
      </div>

      {/* Contenedor de Chat */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna lateral de salas: visible para administradores con múltiples socios */}
        {isAdmin && (
          <div className="card-luxury space-y-3 rounded-2xl border p-4 shadow-sm lg:col-span-1">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-sm font-bold text-[var(--theme-text-primary)]">
                Conversaciones ({visibleRooms.length})
              </h2>
              <span className="rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-2 py-0.5 text-[11px] font-semibold text-[var(--theme-accent)]">
                Admin View
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--theme-text-secondary)]" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar socio o asunto..."
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] py-1.5 pl-8 pr-3 text-xs text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-secondary)] focus:border-[var(--theme-accent)] focus:outline-none"
              />
            </div>

            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
              {filteredRoomsForAdmin.length === 0 ? (
                <p className="p-4 text-center text-xs text-[var(--theme-text-secondary)]">
                  No se encontraron conversaciones.
                </p>
              ) : (
                filteredRoomsForAdmin.map((r) => {
                  const isSelected = activeRoom?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setActiveRoomId(r.id)}
                      style={
                        isSelected
                          ? {
                              background: isDark
                                ? 'linear-gradient(135deg, #064334 0%, #0D3028 100%)'
                                : 'linear-gradient(135deg, #F2ECE0 0%, #DECBA4 100%)',
                              borderColor: isDark ? '#C9AD74' : '#A98A55',
                            }
                          : undefined
                      }
                      className={`w-full rounded-2xl border p-3 text-left transition cursor-pointer ${
                        isSelected
                          ? 'shadow-xs font-bold'
                          : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] hover:border-[var(--theme-accent)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[var(--theme-text-primary)]">
                          {r.playerName}
                        </span>
                        {r.unreadCount > 0 && (
                          <span
                            style={{
                              background: isDark
                                ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                                : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                              color: '#0B0C10',
                              borderColor: isDark ? '#DFCB9E' : '#CCB88E',
                            }}
                            className="rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-xs"
                          >
                            {r.unreadCount} nuevo
                          </span>
                        )}
                      </div>
                      {r.playerLicense && (
                        <p className="text-[11px] font-mono text-[var(--theme-text-secondary)]">
                          {r.playerLicense}
                        </p>
                      )}
                      <p className="mt-1 line-clamp-1 text-xs text-[var(--theme-text-secondary)]">
                        {r.subject}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Panel de Conversación Activa */}
        <div
          className={`card-luxury flex flex-col rounded-2xl border shadow-sm ${
            isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'
          }`}
        >
          {/* Cabecera de la sala activa */}
          {activeRoom ? (
            <div className="border-b border-[var(--theme-border)] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[var(--theme-text-primary)]">
                    {activeRoom.subject}
                  </h3>
                  <p className="text-xs text-[var(--theme-text-secondary)]">
                    Socio titular: <span className="font-semibold text-[var(--theme-text-primary)]">{activeRoom.playerName}</span>
                    {activeRoom.playerLicense ? ` (${activeRoom.playerLicense})` : ''}
                  </p>
                </div>
                <span
                  style={{
                    background: activeRoom.status === 'open'
                      ? (isDark
                          ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                          : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)')
                      : undefined,
                    color: activeRoom.status === 'open' ? '#0B0C10' : undefined,
                    borderColor: isDark ? '#DFCB9E' : '#CCB88E',
                  }}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    activeRoom.status === 'open'
                      ? 'shadow-xs font-bold'
                      : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-secondary)]'
                  }`}
                >
                  {activeRoom.status === 'open' ? 'En trámite' : 'Resuelta'}
                </span>
              </div>
            </div>
          ) : (
            <div className="border-b border-[var(--theme-border)] p-4">
              <h3 className="text-sm font-bold text-[var(--theme-text-primary)]">
                Conversación Privada
              </h3>
            </div>
          )}

          {/* Lista de Mensajes */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6 min-h-[350px] max-h-[500px]">
            {!activeRoom || activeRoom.messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-8 w-8 text-[var(--theme-accent)]" />
                <p className="mt-2 text-sm font-bold text-[var(--theme-text-primary)]">
                  No hay mensajes todavía
                </p>
                <p className="mt-1 text-xs text-[var(--theme-text-secondary)]">
                  Escribe tu consulta a continuación para contactar con secretaría o el comité de competición.
                </p>
              </div>
            ) : (
              activeRoom.messages.map((msg) => {
                const isMine = msg.senderId === profile.id;
                const isAdminSender = isClubAdminOrSuperadminRole(msg.senderRole);

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 px-1 pb-1 text-[11px] text-[var(--theme-text-secondary)]">
                      <span>{msg.senderName}</span>
                      {isAdminSender && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] px-1.5 py-0.2 text-[9px] font-bold text-[var(--theme-accent)]">
                          <ShieldCheck className="h-2.5 w-2.5" />
                          Comité
                        </span>
                      )}
                      <span>·</span>
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div
                      style={
                        isMine
                          ? {
                              background: isDark
                                ? 'linear-gradient(135deg, #064334 0%, #0D3028 100%)'
                                : 'linear-gradient(135deg, #0A3A2A 0%, #164D3A 100%)',
                              color: isDark ? '#E4D3AC' : '#FFFFFF',
                              borderColor: isDark ? 'rgba(201, 173, 116, 0.3)' : 'rgba(169, 138, 85, 0.4)',
                            }
                          : undefined
                      }
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs border ${
                        isMine
                          ? ''
                          : 'border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)]'
                      }`}
                    >
                      {msg.body}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Formulario de envío */}
          <form
            onSubmit={handleSendMessage}
            className="border-t border-[var(--theme-border)] p-4"
          >
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Escribe tu mensaje a administración..."
                className="flex-1 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] px-4 py-2.5 text-sm text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-secondary)] focus:border-[var(--theme-accent)] focus:outline-none"
              />
              <button
                type="submit"
                className="btn-gold-gradient inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-bold shadow-sm transition cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
