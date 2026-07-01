import { useEffect } from 'react';
import { LegalList, LegalPage, LegalSection } from '@/components/legal-page';

export function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy | EntraSave';
  }, []);

  return (
    <LegalPage
      title="Privacy Policy"
      summary="Last updated: July 1, 2026"
    >
      <LegalSection title="Overview">
        <p>
          EntraSave (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the EntraSave website and services.
          This Privacy Policy explains how we collect, use, store, and protect your information when you use our
          personal finance tracking platform.
        </p>
      </LegalSection>

      <LegalSection title="Information We Collect">
        <h3>Account Information</h3>
        <p>When you create an account or sign in using Google or email authentication, we may collect:</p>
        <LegalList>
          <li>Name</li>
          <li>Email address</li>
          <li>Profile picture, if provided by your authentication provider</li>
          <li>Authentication identifiers</li>
        </LegalList>
        <p>This information is used to create and manage your account.</p>

        <h3>Financial Information</h3>
        <p>When you use EntraSave, you may voluntarily provide:</p>
        <LegalList>
          <li>Income records</li>
          <li>Expenses and spending categories</li>
          <li>Savings information</li>
          <li>Budget data</li>
          <li>Financial goals</li>
          <li>Transaction descriptions and notes</li>
          <li>Custom financial categories and tags</li>
        </LegalList>
        <p>This information is used solely to provide personal finance tracking and reporting features.</p>

        <h3>Device and Usage Information</h3>
        <p>We may automatically collect:</p>
        <LegalList>
          <li>Browser type and version</li>
          <li>Device information</li>
          <li>Operating system</li>
          <li>IP address</li>
          <li>Date and time of access</li>
          <li>Application logs and error reports</li>
          <li>Session information</li>
        </LegalList>
        <p>This information helps us maintain service reliability, security, and performance.</p>

        <h3>Authentication Information</h3>
        <p>If you sign in using Google, we only access the information necessary to authenticate your account, such as:</p>
        <LegalList>
          <li>Email address</li>
          <li>Name</li>
          <li>Profile image</li>
        </LegalList>
        <p>
          We do not access your Google Drive, Gmail, contacts, or other Google account data unless you explicitly
          authorize additional permissions.
        </p>
      </LegalSection>

      <LegalSection title="Information We Do Not Collect">
        <p>EntraSave does not:</p>
        <LegalList>
          <li>Access your bank accounts.</li>
          <li>Access your online banking credentials.</li>
          <li>Monitor your browsing activity.</li>
          <li>Read your emails or messages.</li>
          <li>Sell your personal information.</li>
          <li>Use your financial information for advertising purposes.</li>
          <li>Share your financial data with advertisers.</li>
        </LegalList>
        <p>Your financial records remain private and are used only to provide the services you request.</p>
      </LegalSection>

      <LegalSection title="How We Use Your Information">
        <p>We use your information to:</p>
        <LegalList>
          <li>Provide and maintain your account.</li>
          <li>Store and display your financial records.</li>
          <li>Generate reports, charts, and summaries.</li>
          <li>Improve application performance and reliability.</li>
          <li>Detect fraud, abuse, or unauthorized access.</li>
          <li>Respond to support requests.</li>
          <li>Send important account or security notifications.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Cookies and Analytics">
        <p>EntraSave may use cookies and similar technologies to:</p>
        <LegalList>
          <li>Keep you signed in.</li>
          <li>Remember your preferences.</li>
          <li>Improve website performance.</li>
          <li>Analyze application usage.</li>
        </LegalList>
        <p>Analytics data is collected in aggregate form and is used to improve the user experience.</p>
      </LegalSection>

      <LegalSection title="Data Security">
        <p>We implement industry-standard security measures, including:</p>
        <LegalList>
          <li>HTTPS and TLS encryption.</li>
          <li>Secure authentication and session management.</li>
          <li>Password hashing and secure token storage.</li>
          <li>Access controls and authorization checks.</li>
          <li>Server monitoring and logging.</li>
          <li>Regular security updates.</li>
        </LegalList>
        <p>
          While we work to protect your information, no method of electronic storage or internet transmission is
          completely secure.
        </p>
      </LegalSection>

      <LegalSection title="Data Sharing">
        <p>We do not sell or rent your personal information.</p>
        <p>We may share information with trusted service providers that help us operate EntraSave, such as:</p>
        <LegalList>
          <li>Cloud hosting providers</li>
          <li>Email delivery providers</li>
          <li>Authentication providers</li>
          <li>Payment processors, if premium services are offered</li>
        </LegalList>
        <p>These providers only receive information necessary to perform their services.</p>
      </LegalSection>

      <LegalSection title="Data Retention">
        <p>Your account information and financial records are retained while your account remains active.</p>
        <p>If you delete your account, we may retain certain information for:</p>
        <LegalList>
          <li>Security and fraud prevention</li>
          <li>Legal compliance</li>
          <li>System backups</li>
          <li>Financial record requirements</li>
        </LegalList>
        <p>
          Personal information will be deleted or anonymized within a reasonable period after account deletion, except
          where retention is required by law.
        </p>
      </LegalSection>

      <LegalSection title="Your Rights">
        <p>Depending on your location, you may have the right to:</p>
        <LegalList>
          <li>Access your personal information.</li>
          <li>Correct inaccurate information.</li>
          <li>Request deletion of your account.</li>
          <li>Request a copy of your data.</li>
          <li>Withdraw consent where applicable.</li>
        </LegalList>
        <p>To exercise these rights, please contact us.</p>
      </LegalSection>

      <LegalSection title="Third-Party Services">
        <p>EntraSave may use third-party services for:</p>
        <LegalList>
          <li>Authentication</li>
          <li>Email delivery</li>
          <li>Cloud hosting</li>
          <li>Analytics</li>
          <li>Payment processing</li>
        </LegalList>
        <p>These services maintain their own privacy policies and security practices.</p>
      </LegalSection>

      <LegalSection title="Children&apos;s Privacy">
        <p>
          EntraSave is not intended for children under the age of 18. We do not knowingly collect personal information
          from children.
        </p>
      </LegalSection>

      <LegalSection title="Changes to This Privacy Policy">
        <p>
          We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated
          revision date.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>If you have questions about this Privacy Policy, please contact us:</p>
        <p>
          <strong>Email:</strong>{' '}
          <a href="mailto:support@entrasave.com" className="font-medium text-emerald-700 underline">
            support@entrasave.com
          </a>
        </p>
        <p>
          <strong>Website:</strong> https://entrasave.com
        </p>
      </LegalSection>
    </LegalPage>
  );
}