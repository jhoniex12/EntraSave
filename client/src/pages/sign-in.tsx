import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { AuthForm } from '@/components/auth-form';

export function SignInPage() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <AuthForm mode="sign-in" />
    </div>
  );
}
