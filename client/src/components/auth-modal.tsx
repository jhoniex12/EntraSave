import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthForm } from '@/components/auth-form';

/**
 * Renders the credential/OAuth form as a centered dialog over the page behind
 * it (the landing page). The `/sign-in` and `/sign-up` routes still exist, so
 * deep links and the AppLayout redirect keep working — this only changes the
 * presentation from a full page to a popup. Closing returns to the landing page.
 */
export function AuthModal({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  function close() {
    const returnTo = params.get('returnTo');
    navigate(returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/', { replace: true });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    // Prevent the page behind the modal from scrolling while it is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'sign-in' ? 'Sign in' : 'Create your account'}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-neutral-900/50 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div className="relative my-8 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <AuthForm mode={mode} />
      </div>
    </div>
  );
}
