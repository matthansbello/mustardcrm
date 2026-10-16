import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: `Terms of Service — ${LEGAL.productName}`,
  description: `The terms that govern use of ${LEGAL.productName}.`,
};

const { productName, companyName, companyAddress, contactEmail, governingLaw } = LEGAL;

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of {productName} (the
          &quot;Service&quot;), operated by {companyName} (&quot;we&quot;, &quot;us&quot;). By creating an account or
          using the Service you agree to these Terms. If you use the Service on behalf of an organisation, you confirm
          you are authorised to accept these Terms for it, and &quot;you&quot; includes that organisation.
        </p>
      }
    >
      <h2 id="service">1. The Service</h2>
      <p>
        {productName} is a CRM and email outreach tool. It lets your team store and manage contacts, companies and
        deals, import contacts from spreadsheets, and send scheduled email sequences from connected Gmail accounts with
        open, click and reply tracking. We may change, add or remove features over time.
      </p>

      <h2 id="accounts">2. Accounts and sign-in</h2>
      <ul>
        <li>
          You may sign in with a supported provider (such as Google, Microsoft, Apple or GitHub) or with an email
          address. You must provide accurate information and keep your sign-in credentials secure.
        </li>
        <li>You are responsible for all activity under your account. Tell us promptly about any unauthorised use.</li>
        <li>You must be at least 16 years old and able to form a binding contract to use the Service.</li>
      </ul>

      <h2 id="workspace">3. Shared workspace</h2>
      <p>
        The Service is a shared team workspace: every member can view and edit all contacts, companies, deals and
        sequences in it, regardless of who added them. Workspace admins can invite, change the role of, and deactivate
        members. You are responsible for deciding who has access and for only adding data your teammates are permitted
        to see.
      </p>

      <h2 id="your-data">4. Your data</h2>
      <ul>
        <li>
          You keep all rights to the data you put into the Service (&quot;Customer Data&quot;), including contact lists
          and email content. You grant us a limited licence to host, process and transmit Customer Data only as needed
          to provide and secure the Service, and as described in our <Link href="/privacy">Privacy Policy</Link>.
        </li>
        <li>
          You are responsible for Customer Data, and you confirm you have the rights, notices and lawful basis required
          to upload it and to contact the people in it.
        </li>
        <li>
          Where we process personal data in Customer Data on your behalf, we do so as your processor, following your
          instructions given through the Service. If you need a data processing agreement, contact us.
        </li>
      </ul>

      <h2 id="email">5. Email sending and compliance</h2>
      <p>
        You are the sender of every email you send through the Service, and you are solely responsible for complying
        with all laws that apply to your outreach, including (where applicable) CAN-SPAM, the GDPR and UK GDPR, the
        Privacy and Electronic Communications Regulations (PECR), the ePrivacy Directive, and Canada&apos;s Anti-Spam
        Legislation (CASL). In particular, you agree to:
      </p>
      <ul>
        <li>only email people you have a lawful basis to contact;</li>
        <li>identify yourself accurately and never use false or misleading headers or subject lines;</li>
        <li>
          include a valid physical postal address and a working way to opt out, and honour opt-out requests promptly;
        </li>
        <li>stop contacting anyone who asks you to, and remove them from future sequences;</li>
        <li>
          comply with Google&apos;s{' '}
          <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </a>
          ,{' '}
          <a href="https://support.google.com/mail/answer/81126" target="_blank" rel="noopener noreferrer">
            Gmail sender guidelines
          </a>{' '}
          and sending limits.
        </li>
      </ul>
      <p>
        The Service applies daily sending caps to protect deliverability. We do not guarantee that any email will be
        delivered, opened, or not marked as spam. Open and click tracking is approximate and may be blocked by
        recipients&apos; email clients.
      </p>

      <h2 id="acceptable-use">6. Acceptable use</h2>
      <p>You must not use the Service to:</p>
      <ul>
        <li>send spam, bulk unsolicited email to purchased or scraped lists, or phishing, malware or fraudulent content;</li>
        <li>harass, threaten, or discriminate against anyone, or send unlawful, defamatory or infringing content;</li>
        <li>upload data you do not have the right to use, or sensitive categories of personal data you do not need;</li>
        <li>
          interfere with, probe, or attempt to bypass the security or sending limits of the Service, or access other
          workspaces&apos; data;
        </li>
        <li>reverse engineer the Service, or resell or provide it to third parties without our written permission;</li>
        <li>use the Service in a way that could damage the reputation of our sending infrastructure or of Google.</li>
      </ul>
      <p>
        We may investigate suspected violations and suspend sending or accounts where needed to protect recipients,
        other users, or the Service.
      </p>

      <h2 id="third-party">7. Third-party services</h2>
      <p>
        The Service relies on third-party services, including Google (Gmail, Firebase and Google Cloud), Netlify, and
        your chosen sign-in provider. Your use of those services is governed by their own terms. We are not responsible
        for third-party services, and features that depend on them may stop working if they change or you revoke our
        access.
      </p>

      <h2 id="ip">8. Our intellectual property</h2>
      <p>
        We own the Service, including its software, design and branding. Subject to these Terms, we grant you a
        limited, non-exclusive, non-transferable right to use the Service for your internal business purposes. If you
        send us feedback, we may use it without obligation to you.
      </p>

      <h2 id="fees">9. Fees</h2>
      <p>
        If you use a paid plan, you agree to pay the fees shown when you subscribe. Unless stated otherwise, fees are
        non-refundable except where required by law. We will give reasonable notice of any price changes.
      </p>

      <h2 id="termination">10. Suspension and termination</h2>
      <ul>
        <li>You may stop using the Service and ask us to close your account at any time.</li>
        <li>
          We may suspend or terminate your access if you breach these Terms, if required by law, or to prevent harm to
          the Service, other users or email recipients. Where reasonable, we will give notice first.
        </li>
        <li>
          After termination you may request an export of your Customer Data within 30 days, after which we may delete
          it as described in our Privacy Policy.
        </li>
      </ul>

      <h2 id="disclaimers">11. Disclaimers</h2>
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;. To the fullest extent permitted by
        law, we disclaim all warranties, express or implied, including merchantability, fitness for a particular
        purpose and non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or that
        data will never be lost — keep your own copies of important data.
      </p>

      <h2 id="liability">12. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, neither party will be liable for any indirect, incidental, special,
        consequential or punitive damages, or for lost profits, revenue, data or goodwill. Our total liability arising
        out of or relating to the Service will not exceed the greater of the amount you paid us in the 12 months before
        the claim and 100 US dollars (or the equivalent in your currency). Nothing in these Terms limits liability that
        cannot be limited by law, such as liability for fraud or for death or personal injury caused by negligence.
      </p>

      <h2 id="indemnity">13. Indemnity</h2>
      <p>
        You will defend and indemnify us against claims, fines and costs arising from your Customer Data, the emails
        you send through the Service, or your breach of these Terms or applicable law.
      </p>

      <h2 id="law">14. Governing law</h2>
      <p>
        These Terms are governed by the laws of {governingLaw}, and the courts of that jurisdiction have exclusive
        jurisdiction over any dispute, except that either party may seek urgent injunctive relief in any competent
        court. If you are a consumer, you also keep any protections given by the mandatory laws of your country of
        residence.
      </p>

      <h2 id="changes">15. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. We will change the &quot;Last updated&quot; date above and, for
        material changes, notify you by email or in the Service at least 14 days before they take effect. Continuing
        to use the Service after changes take effect means you accept them.
      </p>

      <h2 id="general">16. General</h2>
      <p>
        These Terms, together with our Privacy Policy, are the entire agreement between you and us about the Service.
        If any provision is unenforceable, the rest remain in effect. Our failure to enforce a provision is not a
        waiver. You may not assign these Terms without our consent; we may assign them in connection with a merger,
        acquisition or sale of assets.
      </p>

      <h2 id="contact">17. Contact</h2>
      <p>
        {companyName}
        <br />
        {companyAddress}
        <br />
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </p>
    </LegalPage>
  );
}
