import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LegalList, LegalPage, LegalSection } from '@/components/legal-page';

export function PrivacyPage() {
  useEffect(() => { document.title = 'Privacy Policy | EntraSave'; }, []);
  return (
    <LegalPage
      title="Privacy Policy"
      summary="This policy explains what personal information EntraSave handles, why it is used, and the choices available to you. It applies to this EntraSave deployment and its personal-finance features."
    >
      <LegalSection title="Who is responsible">
        <p>The operator of the EntraSave deployment you use is responsible for the personal information handled by that deployment. If no support address is published, contact the administrator who provided your access.</p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <LegalList>
          <li>Account information, including email address, display name, profile image, login method, and provider identifiers.</li>
          <li>Financial records you enter, including accounts, balances, transactions, categories, budgets, currencies, and notes.</li>
          <li>Security and operational information, including IP address, user agent, request identifiers, timestamps, authentication events, and redacted audit records.</li>
          <li>Preferences stored by the service or your browser, such as base currency and light, dark, or system theme.</li>
        </LegalList>
        <p>When you choose Google or Facebook Login, we receive the identity details authorised by you, such as your provider account ID, email address, name, and profile image. EntraSave does not receive your Google or Facebook password.</p>
      </LegalSection>

      <LegalSection title="How information is used">
        <LegalList>
          <li>Provide, secure, maintain, and troubleshoot your account and finance records.</li>
          <li>Authenticate you, link authorised login methods, prevent abuse, and investigate security events.</li>
          <li>Calculate balances, summaries, and budget status requested through the service.</li>
          <li>Comply with applicable law and enforce the <Link to="/terms" className="font-medium text-emerald-700 underline">Terms of Service</Link>.</li>
        </LegalList>
        <p>EntraSave does not sell personal information or use your financial records for third-party advertising.</p>
      </LegalSection>

      <LegalSection title="Disclosure and overseas processing">
        <p>Information may be processed by infrastructure providers used to host the application, database, logs, and backups. Google or Meta processes information when you use its login flow under its own privacy terms. Information may also be disclosed when required by law, to protect users or the service, or as part of a properly managed business transfer.</p>
        <p>The countries in which information is processed depend on the deployment&apos;s hosting location and the providers you choose. Ask your deployment administrator for its current hosting and subprocessors.</p>
      </LegalSection>

      <LegalSection title="Retention and deletion">
        <p>Information is retained while needed to provide and secure the service and for applicable legal, dispute, backup, and audit requirements. Deletion from active systems may not immediately remove encrypted backups or security records that must be retained for a limited period.</p>
        <p>See the <Link to="/data-deletion" className="font-medium text-emerald-700 underline">Data Deletion Instructions</Link> to request deletion. Disconnecting Google or Facebook alone does not delete your EntraSave records.</p>
      </LegalSection>

      <LegalSection title="Security">
        <p>EntraSave uses access controls, per-user data scoping, password hashing, signed HttpOnly session cookies, input validation, and audit logging. No internet service can guarantee absolute security. Keep your credentials secure and report suspected unauthorised access promptly.</p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <p>Depending on applicable law, you may request access to, correction of, or deletion of personal information, object to certain processing, or complain about how information is handled. The operator may need to verify your identity before acting on a request. Australian users may also have rights under the Privacy Act 1988 and may contact the Office of the Australian Information Commissioner after first raising a complaint with the operator.</p>
      </LegalSection>

      <LegalSection title="Children and changes">
        <p>EntraSave is not directed to children who cannot legally consent to use of the service. This policy may be updated when practices or legal obligations change. Material changes will be communicated through the service or another reasonable channel.</p>
      </LegalSection>
    </LegalPage>
  );
}
