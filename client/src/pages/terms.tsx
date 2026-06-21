import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LegalList, LegalPage, LegalSection } from '@/components/legal-page';

export function TermsPage() {
  useEffect(() => { document.title = 'Terms of Service | EntraSave'; }, []);
  return (
    <LegalPage
      title="Terms of Service"
      summary="These terms govern access to and use of EntraSave. By creating an account or using the service, you agree to them. If you do not agree, do not use the service."
    >
      <LegalSection title="The service">
        <p>EntraSave is a personal record-keeping tool for accounts, transactions, categories, budgets, and related summaries. It is not a bank, payment service, accountant, financial adviser, credit provider, or tax service.</p>
        <p>Outputs depend on the information you enter and may contain errors. Verify important figures against authoritative records before making decisions.</p>
      </LegalSection>

      <LegalSection title="Eligibility and accounts">
        <p>You must have legal capacity to accept these terms. You must provide accurate account information, keep access credentials confidential, and promptly report suspected misuse. You are responsible for activity performed through your account except to the extent caused by the operator&apos;s failure to use reasonable care.</p>
        <p>Google and Facebook Login are optional third-party sign-in methods. Their services and terms remain separate from EntraSave.</p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You must not:</p>
        <LegalList>
          <li>use EntraSave unlawfully, fraudulently, or to harm another person;</li>
          <li>access another user&apos;s information or bypass access controls;</li>
          <li>probe, disrupt, overload, scrape, or reverse engineer the service except where law expressly permits it;</li>
          <li>upload malicious code or content that infringes another person&apos;s rights; or</li>
          <li>use automated access without the operator&apos;s written permission.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Your content">
        <p>You retain ownership of information you enter. You grant the operator a limited permission to host, process, back up, and display that information only as needed to provide, secure, and maintain EntraSave and comply with law. You are responsible for having the right to enter the information you provide.</p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>The service may be changed, suspended, or unavailable for maintenance, security, legal, or operational reasons. Reasonable efforts may be made to provide notice of material changes, but uninterrupted or error-free operation is not guaranteed.</p>
      </LegalSection>

      <LegalSection title="Suspension and termination">
        <p>Access may be limited or suspended when reasonably necessary to protect users or the service, investigate misuse, comply with law, or address a material breach. You may stop using EntraSave at any time and may request deletion as described in the <Link to="/data-deletion" className="font-medium text-emerald-700 underline">Data Deletion Instructions</Link>.</p>
      </LegalSection>

      <LegalSection title="Disclaimers and liability">
        <p>Nothing in these terms excludes a guarantee, right, or remedy that cannot lawfully be excluded, including applicable rights under the Australian Consumer Law. Subject to those rights, EntraSave is provided on an “as available” basis and the operator is not responsible for losses caused by inaccurate user-entered data, independent third-party services, or events outside reasonable control.</p>
        <p>To the extent permitted by law, the operator is not liable for indirect or consequential loss, loss of opportunity, or decisions made in reliance on EntraSave calculations. You should maintain independent copies of records you cannot afford to lose.</p>
      </LegalSection>

      <LegalSection title="Privacy, changes, and governing law">
        <p>The <Link to="/privacy" className="font-medium text-emerald-700 underline">Privacy Policy</Link> explains how personal information is handled. These terms may be updated for legal, security, or service changes. The laws and courts applicable to the operator&apos;s establishment govern these terms, subject to any mandatory consumer protections that apply where you live.</p>
      </LegalSection>
    </LegalPage>
  );
}
