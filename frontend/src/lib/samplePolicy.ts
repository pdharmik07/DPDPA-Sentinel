export const SAMPLE_POLICY_FILENAME = 'Sample-Ecommerce-Privacy-Policy.txt';

/**
 * A realistic mid-quality privacy policy used for demos. It deliberately contains
 * a mix of solid clauses, hedged commitments and outright gaps (no breach clause,
 * no nomination right, no children's data section) so a scan produces a
 * genuinely mixed, interesting result rather than a perfect score.
 */
export const SAMPLE_POLICY_TEXT = `SHOPSPHERE RETAIL PRIVATE LIMITED
PRIVACY POLICY

Last updated: 12 March 2025

1. INTRODUCTION

This Privacy Policy describes how ShopSphere Retail Private Limited ("ShopSphere", "we", "us")
collects, uses, stores and shares your personal data when you use our website and mobile
application. Please read this policy carefully before using our services.

2. INFORMATION WE COLLECT

We collect the following categories of personal data from you:

Account information such as your name, email address, mobile number and password.
Delivery information such as your postal address, PIN code and alternate contact number.
Payment information such as card details, UPI identifiers and billing address.
Usage information such as your device identifier, IP address, browser type and pages viewed.
Communication records such as chat transcripts and emails sent to our support team.

We collect this information directly from you when you register an account, place an order,
contact our support team, or interact with our website.

3. PURPOSE OF PROCESSING

We process your personal data only for the specific purposes listed below:

To create and manage your account.
To process, fulfil and deliver your orders.
To process payments and issue invoices.
To respond to your support queries and complaints.
To send you order updates and, where you have opted in, promotional communications.
To detect and prevent fraud and to secure our platform.

We will not use your personal data for any other purpose without giving you a fresh notice
and obtaining your consent for that purpose.

4. CONSENT

We process your personal data on the basis of your consent. Consent is obtained through a
clear affirmative action: an unticked checkbox presented alongside this notice at the time
of registration. We seek consent separately for promotional communications, and declining
it will not prevent you from placing orders on our platform.

You may withdraw your consent at any time by writing to us at the address given below. We
may stop processing your personal data following such a withdrawal, subject to our internal
review process.

5. SHARING OF YOUR INFORMATION

We share your personal data with the following categories of recipients:

Payment gateways, in order to process your payments.
Logistics and courier partners, in order to deliver your orders.
Cloud hosting providers, in order to store platform data.
Analytics providers, in order to measure how our services are used.

Each of these recipients is engaged under a written contract that requires them to process
personal data only on our instructions and to maintain equivalent security safeguards. We do
not sell your personal data to any third party.

We may also disclose personal data where required to do so by law, by a court order, or in
response to a valid request from a law enforcement or regulatory authority.

6. DATA STORAGE AND TRANSFER

Your personal data is stored on servers located in India. Some of our service providers may
process limited data on infrastructure located outside India, including in Singapore and the
United States. We take reasonable contractual measures to protect data in such transfers.

7. RETENTION

We retain your personal data for as long as your account remains active and for such further
period as may be necessary for our business purposes. Transaction records are retained in
accordance with applicable tax and accounting law.

8. SECURITY

We take the security of your personal data seriously. We use industry-standard measures to
protect your information from unauthorised access, disclosure, alteration and loss. All data
transmitted between your device and our servers is encrypted using TLS. Access to production
systems is restricted to authorised personnel.

9. YOUR RIGHTS

You have the following rights in relation to your personal data:

Right to access: you may request a summary of the personal data we hold about you and the
processing activities we carry out.

Right to correction: you may request that we correct inaccurate or incomplete personal data.
Most details can be updated directly from your account profile page.

Right to erasure: you may request that we delete your personal data. We will consider such
requests in accordance with applicable law and our retention obligations.

To exercise any of these rights, please contact us using the details in Section 11.

10. COOKIES

We use cookies and similar technologies to keep you signed in, remember your preferences and
measure usage of our services. You can control cookies through your browser settings.

11. CONTACT US

If you have any questions about this Privacy Policy or about how we handle your personal
data, you may contact us at:

ShopSphere Retail Private Limited
4th Floor, Orbit Business Park, S.G. Highway
Ahmedabad, Gujarat 380015
Email: privacy@shopsphere.in
Phone: +91 79 4000 1200

12. CHANGES TO THIS POLICY

We may update this Privacy Policy from time to time. Where we make changes, the revised
policy will be posted on this page with an updated revision date. We encourage you to review
this page periodically.
`;

export function buildSamplePolicyFile(): File {
  return new File([SAMPLE_POLICY_TEXT], SAMPLE_POLICY_FILENAME, { type: 'text/plain' });
}
