import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { Button, Input, FormField } from '../../ui';
import { useAuth } from '../../../lib/hooks';
import { cn } from '../../../lib/utils';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
}

type FormFieldName = keyof FormData;

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
  general?: string;
}

export default function AuthForm({ mode = 'login' }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const { login, register, forgotPassword, resetPassword, isLoading: authLoading, error: authError, clearError } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const isLoading = authLoading || isSubmitting;

  // Clear auth error when user starts typing
  useEffect(() => {
    if (authError) clearError();
  }, [formData, authError, clearError]);

  const validateField = (name: FormFieldName, value: string): string | undefined => {
    switch (name) {
      case 'email':
        if (!value) return 'El correo es obligatorio';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Formato de correo inválido';
        break;
      case 'password':
        if (mode === 'login' || mode === 'register' || mode === 'reset') {
          if (!value) return 'La contraseña es obligatoria';
          if ((mode === 'register' || mode === 'reset') && value.length < 12) {
            return 'Mínimo 12 caracteres';
          }
        }
        break;
      case 'confirmPassword':
        if (mode === 'register' || mode === 'reset') {
          if (!value) return 'Confirma tu contraseña';
          if (value !== formData.password) return 'Las contraseñas no coinciden';
        }
        break;
      case 'name':
        if (mode === 'register' && !value.trim()) return 'El nombre es obligatorio';
        if (mode === 'register' && value.trim().length < 2) return 'Mínimo 2 caracteres';
        break;
    }
    return undefined;
  };

  const handleChange = (name: FormFieldName, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleBlur = (name: FormFieldName) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, formData[name]);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    const fieldsToValidate: FormFieldName[] = [];
    if (mode !== 'reset') fieldsToValidate.push('email');
    if (mode === 'login' || mode === 'register' || mode === 'reset') fieldsToValidate.push('password');
    if (mode === 'register' || mode === 'reset') fieldsToValidate.push('confirmPassword');
    if (mode === 'register') fieldsToValidate.push('name');

    fieldsToValidate.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    setTouched(fieldsToValidate.reduce((acc, field) => ({ ...acc, [field]: true }), {}));
    return isValid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors((prev) => ({ ...prev, general: undefined }));

    try {
      switch (mode) {
        case 'login':
          await login({ email: formData.email, password: formData.password });
          navigate('/dashboard');
          break;
        case 'register':
          await register({ email: formData.email, password: formData.password, name: formData.name.trim() });
          navigate('/dashboard');
          break;
        case 'forgot':
          await forgotPassword({ email: formData.email });
          setSubmitSuccess(true);
          break;
        case 'reset':
          const hashQuery = window.location.hash.includes('?') ? window.location.hash.slice(window.location.hash.indexOf('?') + 1) : '';
          const token = new URLSearchParams(window.location.search).get('token') || new URLSearchParams(hashQuery).get('token');
          if (!token) throw new Error('Token inválido');
          await resetPassword({ token, password: formData.password });
          setSubmitSuccess(true);
          setTimeout(() => navigate('/auth/login'), 3000);
          break;
      }
    } catch (err) {
      // Error handled by auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  const config = {
    login: {
      title: 'Iniciar sesión',
      description: 'Accede a tu cuenta para gestionar tus gastos compartidos',
      submitLabel: 'Entrar',
      footer: '¿No tienes cuenta? <a href="/app/#/auth/register" className="text-brand-600 hover:underline font-medium">Regístrate gratis</a>',
    },
    register: {
      title: 'Crear cuenta',
      description: 'Regístrate gratis y empieza a organizar tus cuentas compartidas',
      submitLabel: 'Crear cuenta',
      footer: '¿Ya tienes cuenta? <a href="/app/#/auth/login" className="text-brand-600 hover:underline font-medium">Inicia sesión</a>',
    },
    forgot: {
      title: 'Recuperar contraseña',
      description: 'Te enviaremos un enlace para restablecer tu contraseña',
      submitLabel: 'Enviar enlace',
      footer: '<a href="/app/#/auth/login" className="text-brand-600 hover:underline font-medium">Volver al inicio de sesión</a>',
    },
    reset: {
      title: 'Nueva contraseña',
      description: 'Introduce tu nueva contraseña (mínimo 12 caracteres)',
      submitLabel: 'Guardar contraseña',
      footer: '<a href="/app/#/auth/login" className="text-brand-600 hover:underline font-medium">Volver al inicio de sesión</a>',
    },
  }[mode];

  if (submitSuccess) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-md card p-8 text-center animate-in slide-in-from-bottom">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-100 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-success-600" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            {mode === 'forgot' ? 'Revisa tu correo' : 'Contraseña actualizada'}
          </h1>
          <p className="text-text-secondary mb-6">
            {mode === 'forgot'
              ? 'Si el correo existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña en unos minutos.'
              : 'Tu contraseña se ha actualizado correctamente. Redirigiendo al inicio de sesión...'}
          </p>
          <Button variant="secondary" onClick={() => navigate('/auth/login')}>
            Ir a iniciar sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-2 mb-6" aria-label="Pazito - Inicio">
            <svg className="w-10 h-10 text-brand-600" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="currentColor" />
              <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xl font-bold text-text-primary">Pazito</span>
          </a>
          <h1 className="text-2xl font-bold text-text-primary">{config.title}</h1>
          <p className="mt-2 text-text-secondary">{config.description}</p>
        </div>

        <form className="card p-6 sm:p-8 space-y-6" onSubmit={handleSubmit} noValidate>
          {(authError || errors.general) && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-error-50 border border-error-200" role="alert">
              <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-error-700">{authError || errors.general}</p>
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <FormField
              label="Correo electrónico"
              required
              error={touched.email ? errors.email : undefined}
            >
              <Input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                placeholder="tu@correo.com"
                disabled={isLoading}
                autoFocus
              />
            </FormField>
          )}

          {mode === 'register' && (
            <FormField
              label="Nombre"
              required
              error={touched.name ? errors.name : undefined}
            >
              <Input
                type="text"
                id="name"
                name="name"
                autoComplete="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                onBlur={() => handleBlur('name')}
                placeholder="Tu nombre"
                disabled={isLoading}
              />
            </FormField>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <FormField
              label={mode === 'reset' ? 'Nueva contraseña' : 'Contraseña'}
              required
              error={touched.password ? errors.password : undefined}
            >
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  onBlur={() => handleBlur('password')}
                  placeholder={mode === 'reset' || mode === 'register' ? 'Mínimo 12 caracteres' : '••••••••'}
                  disabled={isLoading}
                  className="pr-12"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-hidden="true"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </FormField>
          )}

          {(mode === 'register' || mode === 'reset') && (
            <FormField
              label="Confirmar contraseña"
              required
              error={touched.confirmPassword ? errors.confirmPassword : undefined}
            >
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  onBlur={() => handleBlur('confirmPassword')}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="pr-12"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-hidden="true"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </FormField>
          )}

          <Button type="submit" fullWidth loading={isLoading} className="mt-2">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {config.submitLabel}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          <span dangerouslySetInnerHTML={{ __html: config.footer }} />
        </p>

        {mode === 'login' && (
          <div className="mt-6 text-center">
            <a href="/app/#/auth/forgot" className="text-sm text-brand-600 hover:underline font-medium">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-text-tertiary">
          <p>Al continuar, aceptas nuestros <a href="#" className="underline hover:text-brand-600">Términos</a> y <a href="#" className="underline hover:text-brand-600">Privacidad</a>.</p>
        </div>
      </div>
    </div>
  );
}