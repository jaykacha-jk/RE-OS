import { ForgotPasswordForm } from './forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Forgot password</h1>
      <p className="mt-1 text-sm text-slate-600">
        We will send instructions if an account exists (email delivery is Phase 1 stub).
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
