import { useEffect } from 'react';
import { LegalList, LegalPage, LegalSection } from '@/components/legal-page';

export function CookiesPage() {
  useEffect(() => { document.title = 'Cookie Policy | EntraSave'; }, []);
  return (
    <LegalPage
      title="Cookie Policy"
      summary="EntraSave currently uses only storage needed for authentication, security, and your selected appearance. It does not currently use advertising or analytics cookies."
    >
      <LegalSection title="Essential cookies">
        <LegalList>
          <li><strong>Session cookie:</strong> a signed, HttpOnly cookie keeps you authenticated. JavaScript cannot read it, and it expires according to the deployment&apos;s session policy.</li>
          <li><strong>OAuth flow cookies:</strong> short-lived, HttpOnly cookies protect Google and Facebook sign-in against request forgery and replay. They are removed or expire after the login flow.</li>
        </LegalList>
        <p>These cookies are necessary to provide requested login and security functions. Blocking them prevents account sign-in from working correctly.</p>
      </LegalSection>

      <LegalSection title="Browser storage">
        <p>Your light, dark, or system theme choice is stored in browser local storage. It is not an authentication credential and is not used to track you across websites. You can remove it using your browser&apos;s site-data controls.</p>
      </LegalSection>

      <LegalSection title="Third-party login">
        <p>When you choose Google or Facebook Login, the provider may set its own cookies on its domains under its own policies. EntraSave does not control those provider cookies.</p>
      </LegalSection>

      <LegalSection title="Future changes">
        <p>If optional analytics or other non-essential tracking is introduced, this policy and any consent controls will be updated before that technology is enabled where consent is required.</p>
      </LegalSection>
    </LegalPage>
  );
}
