import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: `Privacy Policy — ${LEGAL.productName}`,
  description: `How ${LEGAL.productName} collects, uses, and protects personal data, including Google user data.`,
};

const { productName, companyName, companyAddress, contactEmail } = LEGAL;

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          This Privacy Policy explains how {companyName} (&quot;we&quot;, &quot;us&quot;) collects, uses, shares and
          protects information when you use {productName}, a CRM and email outreach application (the
          &quot;Service&quot;). It also explains how we handle data we receive from Google APIs, including Gmail.
        </p>
      }
    >
      <h2 id="who-we-are">1. Who we are</h2>
      <p>
        The Service is operated by {companyName}, {companyAddress}. For any privacy question or request, contact us at{' '}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
      </p>
      <p>
        For your account information we act as a <strong>controller</strong>. For the contact records you and your
        team upload or create in the Service (your prospects and customers), we act as a <strong>processor</strong> on
        behalf of the workspace that owns them — that workspace decides why and how that data is used.
      </p>

      <h2 id="information-we-collect">2. Information we collect</h2>
      <h3>Account information</h3>
      <ul>
        <li>
          Your name, email address and profile photo, received from the sign-in method you choose (Google, Microsoft,
          Apple, GitHub, or email and password).
        </li>
        <li>
          Your role in the workspace (admin, manager or rep), account status, and timestamps such as when you joined.
        </li>
        <li>
          If you sign in with a password, the password is handled by Google Firebase Authentication; we never see or
          store it in plain text.
        </li>
      </ul>

      <h3>CRM data you provide</h3>
      <ul>
        <li>
          Contacts, companies, deals, notes, tags and custom fields that you add manually or import from CSV or Excel
          files. This typically includes names, email addresses, job titles, company names and phone numbers of your
          prospects.
        </li>
        <li>Email sequences you create (subject lines, message templates, schedules and sending settings).</li>
        <li>Import history, such as file names and row counts.</li>
      </ul>

      <h3>Email engagement data</h3>
      <p>
        When you send sequence emails through the Service, we record whether each email was sent, opened, clicked,
        replied to or bounced. Opens are detected with a small tracking image, and clicks by routing links through our
        servers before forwarding the recipient to the original destination. This records the time of the event and
        which email and contact it relates to.
      </p>

      <h3>Technical information</h3>
      <ul>
        <li>
          Cookies and browser storage needed to keep you signed in (see <a href="#cookies">Cookies</a>).
        </li>
        <li>Server logs containing IP addresses, browser type and request times, used for security and debugging.</li>
      </ul>

      <h2 id="google-user-data">3. Google user data and Gmail</h2>
      <p>
        If you sign in with Google or connect a Gmail inbox, we ask Google for permission to access specific data. We
        only request what the Service needs:
      </p>
      <ul>
        <li>
          <strong>Basic profile and email address</strong> (<code>userinfo.email</code>, <code>userinfo.profile</code>
          ) — to create your account and show your name and photo.
        </li>
        <li>
          <strong>Send email on your behalf</strong> (<code>gmail.send</code>) — to send the sequence emails you set
          up, from your own Gmail address, at the times you schedule.
        </li>
        <li>
          <strong>Read email</strong> (<code>gmail.readonly</code>) — solely to detect when a prospect replies to a
          sequence email, so the sequence can stop and the reply can be recorded. We read only message{' '}
          <strong>headers</strong> (sender, subject, and reply/thread references) of recent inbox messages. We do not
          read, store or analyse the body of your emails.
        </li>
      </ul>
      <p>
        Gmail access tokens are encrypted before they are stored and are only accessible to our servers. You can revoke
        the Service&apos;s access at any time from your{' '}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
          Google Account permissions
        </a>{' '}
        page; sending and reply detection stop immediately when you do.
      </p>
      <div className="callout">
        <p className="!mt-0">
          <strong>Limited Use disclosure.</strong> {productName}&apos;s use and transfer to any other app of information
          received from Google APIs will adhere to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <p>In particular, we:</p>
        <ul>
          <li>use Google user data only to provide and improve the user-facing features described above;</li>
          <li>do not sell Google user data, or use or transfer it for advertising, including personalised ads;</li>
          <li>do not use it to determine credit-worthiness or for lending purposes;</li>
          <li>
            do not use Google user data to develop, improve or train generalised artificial intelligence or machine
            learning models;
          </li>
          <li>
            do not allow humans to read it, unless you give us explicit permission for specific messages (for example,
            to resolve a support request), it is necessary for security purposes such as investigating abuse, to comply
            with applicable law, or the data has been aggregated and anonymised for internal operations.
          </li>
        </ul>
      </div>

      <h2 id="how-we-use">4. How we use information</h2>
      <ul>
        <li>To provide the Service: authenticate you, store your CRM data, and send and track your sequence emails.</li>
        <li>To enforce sending limits that protect your mailbox&apos;s deliverability and reputation.</li>
        <li>To secure the Service, prevent abuse, and debug problems.</li>
        <li>To communicate with you about your account, security, and changes to the Service or these terms.</li>
        <li>To comply with legal obligations.</li>
      </ul>
      <p>
        Where the GDPR or UK GDPR applies, our legal bases are: performance of our contract with you (providing the
        Service), our legitimate interests (security, preventing abuse, improving the Service), compliance with legal
        obligations, and your consent where we ask for it (for example, connecting Gmail).
      </p>

      <h2 id="shared-workspace">5. Shared workspace visibility</h2>
      <p>
        The Service operates as a shared team workspace. Everyone who is a member of the workspace can see and edit
        all contacts, companies, deals and sequences in it, regardless of who added them, and can see other
        members&apos; names, email addresses, roles and inbox connection status. Do not add information to the
        workspace that your teammates should not see.
      </p>

      <h2 id="sharing">6. How we share information</h2>
      <p>We do not sell personal information. We share it only with:</p>
      <ul>
        <li>
          <strong>Service providers</strong> that host and run the Service on our behalf, under contracts that require
          them to protect it: Google Cloud / Firebase (authentication, database, file storage, background processing),
          Netlify (web hosting), and the identity provider you choose to sign in with (Google, Microsoft, Apple or
          GitHub).
        </li>
        <li>
          <strong>Google</strong>, when you connect Gmail, to send email and detect replies as described above.
        </li>
        <li>
          <strong>Authorities or other parties</strong> when required by law, or to protect the rights, safety and
          security of our users, the public, or us.
        </li>
        <li>
          <strong>A successor</strong> in a merger, acquisition or sale of assets, subject to this policy.
        </li>
      </ul>

      <h2 id="cookies">7. Cookies and similar technologies</h2>
      <p>We use only what is needed for the Service to work. We do not use advertising or cross-site tracking cookies.</p>
      <ul>
        <li>
          <code>__session</code> — a secure, HTTP-only cookie that keeps you signed in (expires after 5 days).
        </li>
        <li>
          <code>__mustard_auth</code> — a small flag that lets the app route you to the right page while your session
          loads.
        </li>
        <li>
          Browser storage used by Firebase Authentication to remember your sign-in, and to remember your email address
          while you complete an email sign-in link.
        </li>
      </ul>

      <h2 id="retention">8. Data retention</h2>
      <ul>
        <li>Account information is kept while your account is active and deleted after you ask us to close it.</li>
        <li>
          CRM data is kept until a workspace member deletes it or the workspace is closed, after which it is deleted
          from our active systems within 30 days and from backups within 90 days.
        </li>
        <li>
          Gmail tokens are kept until you disconnect Gmail, revoke access in your Google Account, or close your
          account.
        </li>
        <li>Server logs are kept for up to 90 days unless needed longer to investigate a security incident.</li>
      </ul>

      <h2 id="security">9. Security</h2>
      <p>
        Data is encrypted in transit (HTTPS) and at rest by our hosting providers. Gmail tokens are additionally
        encrypted by us before storage and are never exposed to the browser. Access to workspace data is restricted by
        database security rules to signed-in workspace members. No system is perfectly secure, so we cannot guarantee
        absolute security; if we become aware of a breach affecting your personal data, we will notify you and
        regulators as required by law.
      </p>

      <h2 id="transfers">10. International transfers</h2>
      <p>
        Our providers may process data in countries other than yours, including the United States. Where required, we
        rely on appropriate safeguards such as the European Commission&apos;s Standard Contractual Clauses and the UK
        International Data Transfer Addendum.
      </p>

      <h2 id="your-rights">11. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, delete, or export your personal data,
        to object to or restrict certain processing, and to withdraw consent at any time. California residents have the
        right to know what personal information we collect and to request its deletion, and we do not sell or
        &quot;share&quot; personal information for cross-context behavioural advertising.
      </p>
      <p>
        To exercise any of these rights, email <a href={`mailto:${contactEmail}`}>{contactEmail}</a>. We will respond
        within the time required by law (usually 30 days). You also have the right to complain to your local data
        protection authority.
      </p>
      <p>
        <strong>If you are a recipient of an email sent through the Service:</strong> the sender (the workspace that
        contacted you) controls your data. You can ask them directly to stop contacting you or to delete your data, or
        write to us and we will pass your request to them.
      </p>

      <h2 id="children">12. Children</h2>
      <p>
        The Service is a business tool and is not directed to children under 16. We do not knowingly collect personal
        data from children.
      </p>

      <h2 id="changes">13. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. We will change the &quot;Last updated&quot; date above and, for
        significant changes, notify you by email or in the Service before they take effect.
      </p>

      <h2 id="contact">14. Contact</h2>
      <p>
        {companyName}
        <br />
        {companyAddress}
        <br />
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </p>
      <p>
        See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
