import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LegalList, LegalPage, LegalSection } from '@/components/legal-page';

export function TermsPage() {
  useEffect(() => {
    document.title = 'Terms of Service | EntraSave';
  }, []);

  return (
    <LegalPage
      title="Terms of Service"
      summary="By creating an account or using EntraSave, you agree to these Terms of Service. Last updated: July 1, 2026."
    >
      <LegalSection title="1. Acceptance of Terms">
        <p>
          These Terms of Service govern your use of EntraSave. By creating an account,
          accessing, or using the service, you agree to these terms. If you do not
          agree, you should not use EntraSave.
        </p>
      </LegalSection>

      <LegalSection title="2. Description of the Service">
        <p>
          EntraSave is a personal finance tracking platform that helps users record,
          organize, and review financial information.
        </p>

        <LegalList>
          <li>Income tracking</li>
          <li>Expense tracking</li>
          <li>Budget management</li>
          <li>Savings tracking</li>
          <li>Financial goals</li>
          <li>Reports, charts, and summaries</li>
          <li>Account and category management</li>
        </LegalList>

        <p>
          EntraSave is not a bank, financial institution, accountant, tax adviser,
          investment adviser, or financial adviser.
        </p>
      </LegalSection>

      <LegalSection title="3. Eligibility">
        <p>
          You must be at least 18 years old or the legal age in your country to use
          EntraSave.
        </p>

        <p>By using the service, you confirm that:</p>

        <LegalList>
          <li>You are legally allowed to use the service.</li>
          <li>The information you provide is accurate.</li>
          <li>You will use the service only for lawful purposes.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="4. User Accounts">
        <p>
          To use EntraSave, you may create an account or sign in using supported
          authentication providers such as Google.
        </p>

        <p>You are responsible for:</p>

        <LegalList>
          <li>Keeping your login credentials secure.</li>
          <li>Maintaining accurate account information.</li>
          <li>All activity performed using your account.</li>
          <li>Reporting unauthorized access immediately.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Your Financial Data">
        <p>
          You may enter financial information including income, expenses, savings,
          budgets, goals, notes, categories, and transaction records.
        </p>

        <p>
          You remain responsible for the accuracy of the information you enter.
          EntraSave does not guarantee that reports, summaries, or calculations are
          suitable for tax, accounting, investment, or legal purposes.
        </p>
      </LegalSection>

      <LegalSection title="6. No Financial Advice">
        <p>
          EntraSave does not provide financial, investment, tax, accounting, or legal
          advice.
        </p>

        <p>
          Reports, charts, calculations, and summaries are provided for informational
          and organizational purposes only.
        </p>

        <p>
          You should consult qualified professionals before making important financial,
          investment, tax, or legal decisions.
        </p>
      </LegalSection>

      <LegalSection title="7. Acceptable Use">
        <p>You agree not to:</p>

        <LegalList>
          <li>Use EntraSave for illegal or harmful activities.</li>
          <li>Access another user's account or information.</li>
          <li>Upload malicious code, viruses, or harmful software.</li>
          <li>Interfere with the security or operation of the service.</li>
          <li>Reverse engineer or misuse the platform.</li>
          <li>Use automated tools to abuse the system.</li>
          <li>Provide false or misleading information.</li>
        </LegalList>

        <p>Violation of these terms may result in account suspension or termination.</p>
      </LegalSection>

      <LegalSection title="8. Privacy and Data Protection">
        <p>
          Your use of EntraSave is also governed by our{' '}
          <Link
            to="/privacy"
            className="font-medium text-emerald-700 underline"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <p>
          The Privacy Policy explains how we collect, use, protect, and process your
          information.
        </p>
      </LegalSection>

      <LegalSection title="9. Third-Party Services">
        <p>EntraSave may rely on third-party services including:</p>

        <LegalList>
          <li>Authentication providers</li>
          <li>Cloud hosting providers</li>
          <li>Email providers</li>
          <li>Analytics providers</li>
          <li>Payment processors</li>
        </LegalList>

        <p>
          These services operate under their own terms and privacy policies.
        </p>
      </LegalSection>

      <LegalSection title="10. Payments and Subscriptions">
        <p>
          EntraSave may offer free and paid features. If paid plans become available,
          you agree to pay applicable fees.
        </p>

        <LegalList>
          <li>Fees may be charged in advance.</li>
          <li>Payments may be non-refundable unless required by law.</li>
          <li>Subscriptions may automatically renew.</li>
          <li>You are responsible for cancelling subscriptions if desired.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="11. Service Availability">
        <p>
          We aim to keep EntraSave available and reliable, but we do not guarantee
          uninterrupted service.
        </p>

        <p>Service interruptions may occur because of:</p>

        <LegalList>
          <li>Maintenance</li>
          <li>Software updates</li>
          <li>Server outages</li>
          <li>Internet issues</li>
          <li>Security incidents</li>
          <li>Third-party service failures</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="12. Data Backup">
        <p>
          While backups may be maintained for recovery purposes, users should keep
          their own copies of important financial records.
        </p>

        <p>
          EntraSave is not responsible for data loss unless required by law.
        </p>
      </LegalSection>

      <LegalSection title="13. Account Suspension and Termination">
        <p>You may stop using EntraSave at any time.</p>

        <p>We may suspend or terminate accounts if:</p>

        <LegalList>
          <li>You violate these Terms.</li>
          <li>You misuse the service.</li>
          <li>Your activity creates security or legal risks.</li>
          <li>We are required to do so by law.</li>
          <li>The service is discontinued.</li>
        </LegalList>

        <p>
          Account deletion requests may be made through the{' '}
          <Link
            to="/data-deletion"
            className="font-medium text-emerald-700 underline"
          >
            Data Deletion Instructions
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="14. Intellectual Property">
        <p>
          EntraSave, including its software, branding, design, logos, and features,
          remains the property of EntraSave and its licensors.
        </p>

        <p>
          You may not copy, distribute, modify, or reverse engineer the service
          without permission.
        </p>
      </LegalSection>

      <LegalSection title="15. User Content">
        <p>
          You retain ownership of the financial information you enter into EntraSave.
        </p>

        <p>
          You grant us permission to store, process, back up, and display your data
          only as necessary to provide and maintain the service.
        </p>
      </LegalSection>

      <LegalSection title="16. Disclaimers">
        <p>
          EntraSave is provided on an &quot;as is&quot; and &quot;as available&quot;
          basis.
        </p>

        <p>We do not guarantee that:</p>

        <LegalList>
          <li>The service will always be available.</li>
          <li>The service will always be error-free.</li>
          <li>Reports and calculations will always be accurate.</li>
          <li>The service will meet all user requirements.</li>
          <li>Data will never be lost.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="17. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, EntraSave will not be liable for:
        </p>

        <LegalList>
          <li>Lost profits.</li>
          <li>Lost savings.</li>
          <li>Lost data.</li>
          <li>Financial losses.</li>
          <li>Business interruption.</li>
          <li>Indirect or consequential damages.</li>
        </LegalList>

        <p>
          Our total liability shall not exceed the amount you paid to EntraSave during
          the previous 12 months, or AUD $100, whichever is greater.
        </p>
      </LegalSection>

      <LegalSection title="18. Indemnification">
        <p>
          You agree to indemnify and hold EntraSave harmless against claims,
          liabilities, damages, and expenses resulting from your use of the service or
          violation of these Terms.
        </p>
      </LegalSection>

      <LegalSection title="19. Changes to the Terms">
        <p>
          We may update these Terms from time to time. Material changes may be
          communicated through the website, email, or application notifications.
        </p>

        <p>
          Continued use of EntraSave after changes are published means you accept the
          revised Terms.
        </p>
      </LegalSection>

      <LegalSection title="20. Governing Law">
        <p>
          These Terms are governed by the laws of Victoria, Australia, subject to any
          applicable consumer protection laws.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions regarding these Terms may be sent to your support email address or
          through your official support channels.
        </p>
      </LegalSection>
    </LegalPage>
  );
}