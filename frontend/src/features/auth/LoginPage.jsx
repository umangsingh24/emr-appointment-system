import { zodResolver } from '@hookform/resolvers/zod';
import { Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Input } from '../../components/ui/Field.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getErrorMessage } from '../../lib/errors.js';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required'),
});

const DEMO_ACCOUNTS = [
  { label: 'Super Admin', email: 'admin@emr.local' },
  { label: 'Receptionist', email: 'reception@emr.local' },
  { label: 'Doctor', email: 'arjun.mehta@emr.local' },
];

export default function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  if (status === 'loading') return <PageLoader label="Restoring your session…" />;
  if (status === 'authenticated') return <Navigate to="/" replace />;

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await login(values);
      navigate(location.state?.from?.pathname ?? '/', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error, 'Unable to sign in.'));
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm">
            <Stethoscope className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">EMR Appointment Management</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          {serverError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {serverError}
            </p>
          )}

          <Field label="Email" error={errors.email?.message}>
            {(aria) => (
              <Input type="email" autoComplete="username" autoFocus error={errors.email} {...aria} {...register('email')} />
            )}
          </Field>

          <Field label="Password" error={errors.password?.message}>
            {(aria) => (
              <Input
                type="password"
                autoComplete="current-password"
                error={errors.password}
                {...aria}
                {...register('password')}
              />
            )}
          </Field>

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Sign in
          </Button>
        </form>

        {import.meta.env.DEV && (
          <div className="mt-6 rounded-xl bg-white/70 p-4 text-xs text-slate-600 ring-1 ring-slate-200">
            <p className="font-medium text-slate-700">Seeded demo accounts</p>
            <p className="mt-0.5">Password for all: the value of SEED_PASSWORD (default in README).</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200"
                  onClick={() => setValue('email', account.email, { shouldValidate: true })}
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
