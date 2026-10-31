'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  UserPlus,
  Award,
} from 'lucide-react';
import {
  resolveAuthorizedDemoProfile,
  useClub,
} from '@/components/providers/ClubProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useTranslation } from '@/components/providers/LanguageProvider';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { PlayerProfile } from '@/types/database';

export interface AuthAccessViewProps {
  onSuccess?: (profile: PlayerProfile) => void;
  defaultMode?: 'login' | 'register';
  showDemoAccounts?: boolean;
}

export function AuthAccessView({
  onSuccess,
  defaultMode = 'login',
  showDemoAccounts = true,
}: AuthAccessViewProps) {
  const router = useRouter();
  const { club, loginWithDemo, setAuthenticatedProfile } = useClub();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();

  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [logoError, setLogoError] = useState(false);

  // Campos de Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Campos de Registro
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regLicense, setRegLicense] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Estados de interfaz
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEmailConfirmationPending, setIsEmailConfirmationPending] = useState(false);

  const isDark = resolvedTheme === 'dark';
  const supabaseReady = isSupabaseConfigured();

  const validateEmail = (val: string) => {
    return /\S+@\S+\.\S+/.test(val.trim());
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const emailTrimmed = loginEmail.trim();
    if (!emailTrimmed) {
      setErrorMessage(t('auth.emailInvalid'));
      return;
    }
    if (!validateEmail(emailTrimmed)) {
      setErrorMessage(t('auth.emailInvalid'));
      return;
    }
    if (!loginPassword && !resolveAuthorizedDemoProfile(emailTrimmed)) {
      setErrorMessage(t('auth.passwordRequired'));
      return;
    }

    setIsLoading(true);

    try {
      // 1. Si coincide con una cuenta demo autorizada y no hay Supabase o se usa demo
      const demoCandidate = resolveAuthorizedDemoProfile(emailTrimmed);
      if (demoCandidate && (!supabaseReady || !loginPassword)) {
        const res = loginWithDemo(emailTrimmed, loginPassword);
        if (res.success && res.profile) {
          setSuccessMessage(
            `Sesión iniciada como ${res.profile.fullName} (${res.profile.role}). Redirigiendo...`
          );
          if (onSuccess) {
            onSuccess(res.profile);
          } else {
            router.push('/');
          }
          return;
        }
      }

      // 2. Si Supabase está configurado con credenciales reales
      if (supabaseReady) {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setErrorMessage('Error: el cliente de Supabase no está disponible.');
          return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailTrimmed,
          password: loginPassword,
        });

        if (error) {
          // Mensaje amigable en español
          if (error.message.includes('Invalid login credentials')) {
            setErrorMessage('Credenciales de acceso no válidas. Revisa tu correo y contraseña.');
          } else if (error.message.includes('Email not confirmed')) {
            setErrorMessage(
              'Tu correo electrónico aún no ha sido confirmado. Por favor, revisa tu bandeja de entrada.'
            );
          } else {
            setErrorMessage(`Error de autenticación: ${error.message}`);
          }
          return;
        }

        if (data.user) {
          // Obtener perfil de la BD
          const { data: dbProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          const resolvedProfile: PlayerProfile = dbProfile
            ? {
                id: dbProfile.id,
                email: dbProfile.email || data.user.email || '',
                fullName: dbProfile.full_name || '',
                federationLicense: dbProfile.federation_license || '',
                handicapIndex: Number(dbProfile.handicap_index) || 0,
                role: dbProfile.role || 'player',
                phone: dbProfile.phone || '',
                bio: dbProfile.bio || '',
                avatarUrl: dbProfile.avatar_url,
                isDirectoryVisible: Boolean(dbProfile.is_directory_visible),
                updatedAt: dbProfile.updated_at || new Date().toISOString(),
              }
            : {
                id: data.user.id,
                email: data.user.email || '',
                fullName: data.user.user_metadata?.full_name || 'Jugador',
                federationLicense: '',
                handicapIndex: 36.0,
                role: 'player',
                isDirectoryVisible: true,
                updatedAt: new Date().toISOString(),
              };

          setAuthenticatedProfile(resolvedProfile);
          setSuccessMessage('¡Autenticación completada con éxito! Redirigiendo...');

          if (onSuccess) {
            onSuccess(resolvedProfile);
          } else {
            router.push('/');
          }
          return;
        }
      }

      // 3. Si no hay Supabase y el correo no es de demo
      setErrorMessage(
        'Credenciales no reconocidas. En modo local puedes usar ops@birdie.app, comite@rcgvalleverde.es o carlos.mendoza@socio.es.'
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error inesperado durante el inicio de sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsEmailConfirmationPending(false);

    // Validaciones de cliente
    const nameTrimmed = regFullName.trim();
    const emailTrimmed = regEmail.trim();

    if (!nameTrimmed || nameTrimmed.length < 3) {
      setErrorMessage(t('auth.nameRequired'));
      return;
    }
    if (!emailTrimmed || !validateEmail(emailTrimmed)) {
      setErrorMessage(t('auth.emailInvalid'));
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMessage(t('auth.passwordMinLength'));
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage(t('auth.passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);

    try {
      if (!supabaseReady) {
        // Entorno local sin Supabase: simular registro educativo sin auto-autenticar falsamente
        setIsEmailConfirmationPending(true);
        setSuccessMessage(
          `Registro recibido para ${nameTrimmed} (${emailTrimmed}). En modo demostración local sin Supabase activo, este registro no persiste en el servidor. Puedes utilizar las cuentas demo autorizadas.`
        );
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        setErrorMessage('Error: el cliente de Supabase no está disponible.');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: emailTrimmed,
        password: regPassword,
        options: {
          data: {
            full_name: nameTrimmed,
            federation_license: regLicense.trim() || undefined,
            role: 'player',
          },
        },
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          setErrorMessage('Este correo electrónico ya está registrado. Por favor, inicia sesión.');
        } else {
          setErrorMessage(`Error al crear la cuenta: ${error.message}`);
        }
        return;
      }

      // Comprobar si requiere confirmación por correo según Supabase
      if (data.user && !data.session) {
        // El backend requiere confirmación por email
        setIsEmailConfirmationPending(true);
        setSuccessMessage(
          `¡Registro completado! Hemos enviado un correo de confirmación a ${emailTrimmed}. Por favor, revisa tu bandeja de entrada y confirma tu cuenta antes de iniciar sesión.`
        );
        // NO autenticamos automáticamente porque el backend no lo ha confirmado
        return;
      }

      if (data.session && data.user) {
        // Si Supabase tiene desactivada la confirmación por correo y devolvió sesión inmediata
        const newProfile: PlayerProfile = {
          id: data.user.id,
          email: data.user.email || emailTrimmed,
          fullName: nameTrimmed,
          federationLicense: regLicense.trim() || '',
          handicapIndex: 36.0,
          role: 'player',
          isDirectoryVisible: true,
          updatedAt: new Date().toISOString(),
        };

        setAuthenticatedProfile(newProfile);
        setSuccessMessage('¡Cuenta creada y autenticada con éxito! Redirigiendo...');

        if (onSuccess) {
          onSuccess(newProfile);
        } else {
          router.push('/');
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error inesperado durante el registro.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = (email: string) => {
    setLoginEmail(email);
    setMode('login');
    const res = loginWithDemo(email);
    if (res.success && res.profile) {
      setSuccessMessage(
        `Sesión iniciada como ${res.profile.fullName} (${res.profile.role}). Redirigiendo...`
      );
      if (onSuccess) {
        onSuccess(res.profile);
      } else {
        router.push('/');
      }
    } else {
      setErrorMessage(res.error || 'Error al iniciar sesión demo.');
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6" data-testid="auth-access-container">
      {/* 1. Cabecera White-Label del Club Activo con Estilo de Lujo */}
      <div className="hero-banner-luxury relative overflow-hidden rounded-3xl border p-6 md:p-8 shadow-sm transition-colors">
        {/* Curvas lineales decorativas doradas */}
        <svg
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-25 dark:opacity-20"
          viewBox="0 0 400 200"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 200 C 150 180, 250 80, 400 0 L 400 200 Z"
            fill="url(#access-hero-gold)"
          />
          <defs>
            <linearGradient id="access-hero-gold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9AD74" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#E6D4A7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#BA9C61" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          {/* Logo del Club Activo con Estado de Reserva Claro */}
          <div className="relative shrink-0">
            {!logoError ? (
              <div
                style={{
                  borderColor: isDark ? 'rgba(201, 173, 116, 0.4)' : '#CCB88E',
                  boxShadow: isDark
                    ? '0 4px 16px rgba(0, 0, 0, 0.4)'
                    : '0 4px 16px rgba(169, 138, 85, 0.2)',
                }}
                className="w-16 h-16 rounded-2xl bg-white border border-[var(--theme-border)] p-2 flex items-center justify-center overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/club-logo.svg"
                  alt={`Logo oficial de ${club.name}`}
                  className="w-full h-full object-contain"
                  onError={() => setLogoError(true)}
                  data-testid="club-logo-image"
                />
              </div>
            ) : (
              /* Estado de Reserva Claro y Explícito cuando no hay logo o falla */
              <div
                data-testid="club-logo-fallback"
                aria-label={`Emblema oficial de reserva de ${club.name}`}
                style={{
                  background: isDark
                    ? 'linear-gradient(135deg, #064334 0%, #0D3028 100%)'
                    : 'linear-gradient(135deg, #F2ECE0 0%, #DECBA4 100%)',
                  borderColor: isDark ? '#C9AD74' : '#A98A55',
                  boxShadow: isDark
                    ? '0 4px 16px rgba(201, 173, 116, 0.25)'
                    : '0 4px 16px rgba(169, 138, 85, 0.2)',
                }}
                className="w-16 h-16 rounded-2xl border flex flex-col items-center justify-center p-1"
              >
                <div className="font-extrabold text-sm tracking-wider text-[var(--theme-accent)]">
                  {club.shortName.slice(0, 3).toUpperCase()}
                </div>
                <span className="text-[8px] font-semibold uppercase tracking-tighter opacity-80 text-[var(--theme-text-secondary)]">
                  {t('auth.clubLogoFallback', 'Club')}
                </span>
              </div>
            )}
          </div>

          {/* Nombre y Metadatos del Club */}
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[10px] font-semibold text-[var(--theme-accent)] tracking-wider uppercase">
              <Shield className="w-3 h-3" />
              <span>Portal de Acceso · {club.clubId}</span>
            </div>
            <h1
              data-testid="club-name"
              className="text-2xl font-bold tracking-tight text-[var(--theme-text-primary)]"
            >
              {t('auth.loginTitle')} — {club.name}
            </h1>
            <p className="text-xs text-[var(--theme-text-secondary)]">
              {club.tagline || 'Plataforma oficial para socios y jugadores'}
            </p>
          </div>
        </div>

        {/* Estado actual de la sesión */}
        <div className="relative z-10 mt-5 p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--theme-text-secondary)]" />
            <div>
              <p className="font-semibold text-[var(--theme-text-primary)]">
                {t('common.notAuthenticated', 'Sin sesión activa')}
              </p>
              <p className="text-[11px] text-[var(--theme-text-secondary)]">
                Inicia sesión con tus credenciales o mediante un perfil demo autorizado.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Selector de Modo: Iniciar Sesión vs Registrarse */}
        <div className="relative z-10 mt-6 pt-5 border-t border-[var(--theme-border)]">
          <div
            role="tablist"
            aria-label="Opciones de acceso"
            className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--theme-surface-subtle)] border border-[var(--theme-border)] text-xs font-bold"
          >
            <button
              type="button"
              role="tab"
              id="tab-login"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              style={
                mode === 'login'
                  ? {
                      background: isDark
                        ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                        : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                      color: '#0B0C10',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    }
                  : undefined
              }
              className={`py-2 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'login'
                  ? 'font-bold'
                  : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] font-medium'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{t('auth.loginTab', 'Iniciar Sesión')}</span>
            </button>

            <button
              type="button"
              role="tab"
              id="tab-register"
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              style={
                mode === 'register'
                  ? {
                      background: isDark
                        ? 'linear-gradient(135deg, #D4BA80 0%, #E6D4A7 32%, #C9AD74 68%, #BA9C61 100%)'
                        : 'linear-gradient(135deg, #BEA16D 0%, #D4BE92 32%, #AC8E58 68%, #9C7E4A 100%)',
                      color: '#0B0C10',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    }
                  : undefined
              }
              className={`py-2 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'register'
                  ? 'font-bold'
                  : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] font-medium'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t('auth.registerTab', 'Registrarse')}</span>
            </button>
          </div>
        </div>

        {/* Mensajes de Resultado y Feedback */}
        {errorMessage && (
          <div
            data-testid="auth-error-message"
            className="relative z-10 mt-4 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs flex items-center gap-2.5 animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            data-testid="auth-success-message"
            className="relative z-10 mt-4 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs flex items-start gap-2.5 animate-fadeIn"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>{successMessage}</p>
              {isEmailConfirmationPending && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setIsEmailConfirmationPending(false);
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 font-bold underline cursor-pointer hover:text-emerald-300"
                >
                  {t('auth.haveAccount', 'Volver a Iniciar Sesión')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3. Formulario de Inicio de Sesión */}
        {mode === 'login' ? (
          <form
            onSubmit={handleLoginSubmit}
            data-testid="login-form"
            className="relative z-10 mt-5 space-y-4"
          >
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-[var(--theme-text-primary)] mb-1.5"
              >
                {t('auth.emailLabel', 'Correo Electrónico')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--theme-text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  required
                  disabled={isLoading}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ejemplo@socio.es"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] text-sm focus:outline-none focus:border-[var(--theme-accent)] transition disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[var(--theme-text-primary)] mb-1.5"
              >
                {t('auth.passwordLabel', 'Contraseña')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--theme-text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type="password"
                  required
                  disabled={isLoading}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] text-sm focus:outline-none focus:border-[var(--theme-accent)] transition disabled:opacity-60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              data-testid="login-submit-button"
              className="btn-gold-gradient w-full py-3 rounded-xl font-bold text-sm shadow-sm transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" />
              <span>
                {isLoading
                  ? t('auth.authenticating', 'Iniciando sesión...')
                  : t('auth.loginButton', 'Iniciar Sesión')}
              </span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-xs text-[var(--theme-text-secondary)] hover:text-[var(--theme-accent)] transition cursor-pointer"
              >
                {t('auth.needAccount', '¿Aún no tienes cuenta? Regístrate aquí')}
              </button>
            </div>
          </form>
        ) : (
          /* 4. Formulario de Registro */
          <form
            onSubmit={handleRegisterSubmit}
            data-testid="register-form"
            className="relative z-10 mt-5 space-y-4"
          >
            <div>
              <label
                htmlFor="register-fullname"
                className="block text-xs font-semibold text-[var(--theme-text-primary)] mb-1.5"
              >
                {t('auth.fullNameLabel', 'Nombre y Apellidos')}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[var(--theme-text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="register-fullname"
                  type="text"
                  required
                  disabled={isLoading}
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="Carlos Mendoza"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] text-sm focus:outline-none focus:border-[var(--theme-accent)] transition disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="block text-xs font-semibold text-[var(--theme-text-primary)] mb-1.5"
              >
                {t('auth.emailLabel', 'Correo Electrónico')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--theme-text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="register-email"
                  type="email"
                  required
                  disabled={isLoading}
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="carlos@socio.es"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] text-sm focus:outline-none focus:border-[var(--theme-accent)] transition disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="register-license"
                className="block text-xs font-semibold text-[var(--theme-text-primary)] mb-1.5"
              >
                {t('auth.federationLicenseLabel', 'Licencia Federativa (opcional)')}
              </label>
              <div className="relative">
                <Award className="w-4 h-4 text-[var(--theme-text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="register-license"
                  type="text"
                  disabled={isLoading}
                  value={regLicense}
                  onChange={(e) => setRegLicense(e.target.value)}
                  placeholder="AM-284910"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] text-sm focus:outline-none focus:border-[var(--theme-accent)] transition disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="register-password"
                  className="block text-xs font-semibold text-[var(--theme-text-primary)] mb-1.5"
                >
                  {t('auth.passwordLabel', 'Contraseña')}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--theme-text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="register-password"
                    type="password"
                    required
                    minLength={6}
                    disabled={isLoading}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mín. 6 caracteres"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] text-sm focus:outline-none focus:border-[var(--theme-accent)] transition disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="register-confirm-password"
                  className="block text-xs font-semibold text-[var(--theme-text-primary)] mb-1.5"
                >
                  {t('auth.confirmPasswordLabel', 'Confirmar')}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--theme-text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="register-confirm-password"
                    type="password"
                    required
                    minLength={6}
                    disabled={isLoading}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repite contraseña"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-[var(--theme-text-primary)] text-sm focus:outline-none focus:border-[var(--theme-accent)] transition disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              data-testid="register-submit-button"
              className="btn-gold-gradient w-full py-3 rounded-xl font-bold text-sm shadow-sm transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {isLoading
                  ? t('auth.registering', 'Creando cuenta...')
                  : t('auth.registerButton', 'Crear Cuenta')}
              </span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs text-[var(--theme-text-secondary)] hover:text-[var(--theme-accent)] transition cursor-pointer"
              >
                {t('auth.haveAccount', '¿Ya tienes una cuenta? Inicia sesión aquí')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 5. Cuentas de Acceso Rápido para Entornos Demo/Staging */}
      {showDemoAccounts && (
        <div
          data-testid="demo-accounts-panel"
          className="card-luxury rounded-2xl border p-5 space-y-3 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--theme-accent)]" />
            <h2 className="text-xs font-bold text-[var(--theme-text-primary)]">
              Acceso Rápido con Perfiles Demo Autorizados (1 Clic)
            </h2>
          </div>
          <p className="text-[11px] text-[var(--theme-text-secondary)]">
            Para pruebas locales y de desarrollo, pulsa directamente sobre cualquier cuenta autorizada para acceder:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
            {/* Superadmin */}
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('ops@birdie.app')}
              className="p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-left hover:border-[var(--theme-accent)] transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5 font-bold text-[var(--theme-accent)]">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Superadmin</span>
              </div>
              <div className="text-[10px] text-[var(--theme-text-secondary)] mt-0.5 truncate">
                ops@birdie.app
              </div>
              <div className="text-[9px] mt-1 text-emerald-400 font-semibold">
                ★ Simulador completo
              </div>
            </button>

            {/* Admin Club */}
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('comite@rcgvalleverde.es')}
              className="p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-left hover:border-[var(--theme-accent)] transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5 font-bold text-[var(--theme-text-primary)]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Club</span>
              </div>
              <div className="text-[10px] text-[var(--theme-text-secondary)] mt-0.5 truncate">
                comite@rcgvalleverde.es
              </div>
              <div className="text-[9px] mt-1 text-[var(--theme-text-secondary)]">
                Gestión y torneos
              </div>
            </button>

            {/* Jugador */}
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('carlos.mendoza@socio.es')}
              className="p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-subtle)] text-left hover:border-[var(--theme-accent)] transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5 font-bold text-[var(--theme-text-primary)]">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Jugador</span>
              </div>
              <div className="text-[10px] text-[var(--theme-text-secondary)] mt-0.5 truncate">
                carlos.mendoza@socio.es
              </div>
              <div className="text-[9px] mt-1 text-[var(--theme-text-secondary)]">
                Marcador y reservas
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
