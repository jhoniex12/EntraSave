import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LegalList, LegalPage, LegalSection } from '@/components/legal-page';

export function DataDeletionPage() {
  useEffect(() => { document.title = 'Data Deletion Instructions | EntraSave'; }, []);
  return (
    <LegalPage
      title="Data Deletion Instructions"
      summary="You can request deletion of your EntraSave account and locally stored information, including information associated with Google or Facebook Login."
    >
      <LegalSection title="Request deletion">
        <LegalList>
          <li>Contact the administrator or support channel for the EntraSave deployment that provided your account.</li>
          <li>Send the request from your registered email address and state that you want your EntraSave account deleted.</li>
          <li>Do not send your password, OAuth token, financial records, or identity documents unless the operator provides a secure verification method.</li>
          <li>The operator may ask you to verify control of the account before deletion.</li>
        </LegalList>
        <p>If your deployment publishes no support address, contact the person or organisation that gave you access. Self-service account deletion is not currently available in the application.</p>
      </LegalSection>

      <LegalSection title="What deletion covers">
        <p>Once a verified request is approved, the operator should remove or de-identify the active user account and associated finance records, subject to legal obligations, security records, dispute needs, and limited backup retention. The operator should confirm completion or explain any information that must be retained.</p>
      </LegalSection>

      <LegalSection title="Disconnect Google or Facebook">
        <p>You may separately revoke EntraSave&apos;s access in your Google Account or Facebook Apps and Websites settings. Revocation stops future provider access but does not by itself delete information already stored in EntraSave. Submit the local deletion request above as well.</p>
      </LegalSection>

      <LegalSection title="Questions">
        <p>For details about collection, retention, and your rights, read the <Link to="/privacy" className="font-medium text-emerald-700 underline">Privacy Policy</Link>.</p>
      </LegalSection>
    </LegalPage>
  );
}
