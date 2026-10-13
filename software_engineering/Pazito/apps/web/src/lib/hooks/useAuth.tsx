import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getApiClient, ApiRequestError, setApiAccessToken } from '../api';
import { setOfflineUserScope } from '../offline';
import type { User, Session, RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest } from '../api/types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  startDemoSession: () => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (data: ForgotPasswordRequest) => Promise<void>;
  resetPassword: (data: ResetPasswordRequest) => Promise<void>;
  changePassword: (data: ChangePasswordRequest) => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const validationFieldLabels: Record<string, string> = {
  email: 'Correo electrónico',
  password: 'Contraseña',
  name: 'Nombre',
  body: 'Datos',
  rememberMe: 'Mantener sesión',
};

function readableAuthError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiRequestError)) return fallback;
  const details = error.details;
  if (!details || !Object.keys(details).length) return error.message;
  const descriptions = Object.entries(details).flatMap(([field, messages]) =>
    messages.map(message => `${validationFieldLabels[field] ?? field}: ${message}`)
  );
  return descriptions.length ? `${error.message}. ${descriptions.join('. ')}` : error.message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = getApiClient();

  const clearError = useCallback(() => setError(null), []);

  const setAuth = useCallback((newSession: Session) => {
    setSession(newSession);
    setUser(newSession.user);
    setApiAccessToken(newSession.accessToken || null);
    setOfflineUserScope(newSession.user.id);
  }, []);

  const clearAuth = useCallback(() => {
    setSession(null);
    setUser(null);
    setApiAccessToken(null);
    setOfflineUserScope(null);
  }, []);

  // Clear the in-memory session when any API request receives HTTP 401.
  useEffect(() => {
    const handleUnauthorized = () => clearAuth();
    window.addEventListener('pazito:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('pazito:unauthorized', handleUnauthorized);
  }, [clearAuth]);

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await api.getCurrentUser();
        setUser(currentUser);
        setOfflineUserScope(currentUser.id);
        // Note: In a real app, you'd validate the session/token here
      } catch (err) {
        // Not authenticated, clear any stale state
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [api, clearAuth]);

  const login = useCallback(async (data: LoginRequest) => {
    setError(null);
    setIsLoading(true);
    try {
      const newSession = await api.login(data);
      setAuth(newSession);
    } catch (err) {
      setError(readableAuthError(err, 'Error al iniciar sesión. Intenta de nuevo.'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [api, setAuth]);

  const register = useCallback(async (data: RegisterRequest) => {
    setError(null);
    setIsLoading(true);
    try {
      const newSession = await api.register(data);
      setAuth(newSession);
    } catch (err) {
      setError(readableAuthError(err, 'Error al crear la cuenta. Intenta de nuevo.'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [api, setAuth]);

  const startDemoSession = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const demoSession = await api.startDemoSession();
      setAuth(demoSession);
    } catch (err) {
      setError(readableAuthError(err, 'No se pudo iniciar la demostración. Intenta de nuevo.'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [api, setAuth]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    } finally {
      clearAuth();
      setIsLoading(false);
    }
  }, [api, clearAuth]);

  const forgotPassword = useCallback(async (data: ForgotPasswordRequest) => {
    setError(null);
    try {
      await api.forgotPassword(data);
    } catch (err) {
      setError(readableAuthError(err, 'Error al solicitar restablecimiento. Intenta de nuevo.'));
      throw err;
    }
  }, [api]);

  const resetPassword = useCallback(async (data: ResetPasswordRequest) => {
    setError(null);
    try {
      await api.resetPassword(data);
    } catch (err) {
      setError(readableAuthError(err, 'Error al restablecer la contraseña. Intenta de nuevo.'));
      throw err;
    }
  }, [api]);

  const changePassword = useCallback(async (data: ChangePasswordRequest) => {
    setError(null);
    try {
      await api.changePassword(data);
    } catch (err) {
      setError(readableAuthError(err, 'Error al cambiar la contraseña. Intenta de nuevo.'));
      throw err;
    }
  }, [api]);

  const updateUser = useCallback((userData: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...userData } : null));
    setSession((prev) => (prev ? { ...prev, user: { ...prev.user, ...userData } } : null));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        startDemoSession,
        logout,
        forgotPassword,
        resetPassword,
        changePassword,
        updateUser,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}