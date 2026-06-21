import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { AuthModal } from '@/components/auth-modal';
import { LandingPage } from '@/pages/landing';

export function SignInPage() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <>
      <LandingPage />
      <AuthModal mode="sign-in" />
    </>
  );
}
