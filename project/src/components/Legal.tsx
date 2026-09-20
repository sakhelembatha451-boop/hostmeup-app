import React from 'react';

export default function Legal() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif', lineHeight: '1.6' }}>
      <h1>Legal Policies & Terms</h1>
      <hr style={{ margin: '20px 0' }} />

      {/* Terms & Conditions */}
      <section id="terms" style={{ marginBottom: '40px' }}>
        <h2>Terms & Conditions</h2>
        <p>
          Welcome to Host-Me-Up. These Terms and Conditions govern your use of our platform, website, and booking services. By accessing or using Host-Me-Up, you agree to comply with and be bound by these terms.
        </p>
        <p>
          Host-Me-Up operates as an online directory and booking marketplace connecting clients with third-party service providers, including artists, performers, venues, and event organizers. Host-Me-Up facilitates bookings and payment collection but is not the direct provider of the event services listed by third parties.
        </p>
        <p>
          Users must provide accurate and complete details when creating an account or placing a booking request. A booking is considered confirmed only once payment has been successfully processed through our payment gateway.
        </p>
        <p>
          All payments are processed in South African Rand (ZAR) via secure third-party payment gateways. Host-Me-Up collects upfront payments from clients for confirmed bookings and holds these funds centrally until service fulfillment. Host-Me-Up retains a service commission and administrative booking fee from each transaction prior to disbursing payouts to listed service providers.
        </p>
        <p>
          Listed service providers are independent contractors responsible for delivering their agreed services on the event date in a professional manner. Host-Me-Up is not liable for service defaults, cancellations, or misconduct by third-party providers.
        </p>
        <p>
          Host-Me-Up shall not be held liable for any direct, indirect, incidental, or consequential damages resulting from event cancellations, personal injury, property damage, or disputes between clients and third-party service providers.
        </p>
        <p>
          These Terms and Conditions are governed by and construed in accordance with the laws of the Republic of South Africa.
        </p>
      </section>

      {/* Privacy Policy */}
      <section id="privacy" style={{ marginBottom: '40px' }}>
        <h2>Privacy Policy</h2>
        <p>
          Host-Me-Up collects personal information necessary to operate our booking platform, including:
        </p>
        <ul>
          <li>Personal identification details (Full name, ID number)</li>
          <li>Contact details (Email address, phone number, physical address)</li>
          <li>Billing and bank account details for processing payments and payouts</li>
          <li>Event booking specifics (Dates, venue locations, special requests)</li>
        </ul>
        <p>
          We use collected personal information in compliance with the Protection of Personal Information Act (POPIA) to process bookings, facilitate payment collection and service provider payouts, communicate booking updates, maintain platform security, and satisfy legal compliance requirements (FICA).
        </p>
        <p>
          We do not sell or rent personal data to third parties. Necessary booking information is shared only with the relevant assigned service provider to execute the booking. Payment processing is handled securely by accredited gateway providers (Payfast); Host-Me-Up does not store full credit card details on its servers.
        </p>
        <p>
          Users have the right to request access to, correction of, or deletion of their personal information held by Host-Me-Up by contacting us at <strong>sakhelembatha451@gmail.com</strong>.
        </p>
      </section>

      {/* Refund & Cancellation Policy */}
      <section id="refunds" style={{ marginBottom: '40px' }}>
        <h2>Refund & Cancellation Policy</h2>
        <h3>Client Cancellations</h3>
        <ul>
          <li><strong>More than 14 days before the event:</strong> Eligible for a full refund, minus standard non-refundable platform administration fees.</li>
          <li><strong>Between 7 to 14 days before the event:</strong> Eligible for a 50% refund of the total booking fee.</li>
          <li><strong>Less than 7 days before the event:</strong> Non-refundable, as funds are committed to securing the service provider's schedule.</li>
        </ul>
        <h3>Service Provider Cancellations</h3>
        <p>
          If a listed service provider or artist cancels a confirmed booking, Host-Me-Up will first attempt to provide a suitable replacement of equal quality. If no replacement can be agreed upon, the client will receive a 100% full refund of all fees paid for that booking.
        </p>
        <h3>Refund Processing</h3>
        <p>
          All approved refunds will be processed back to the original bank account or payment card used during checkout within 5 to 10 business days. Refund requests must be formally submitted in writing to <strong>sakhelembatha451@gmail.com</strong> with the corresponding booking reference ID.
        </p>
      </section>

      {/* Contact Details */}
      <section id="contact" style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #ccc' }}>
        <h3>Business Contact Details</h3>
        <p><strong>Business Name:</strong> Host-Me-Up</p>
        <p><strong>Contact Name:</strong> Sakhele Mbatha</p>
        <p><strong>Address:</strong> Rise Student Living, Cape Town, Western Cape, 8001</p>
        <p><strong>Email:</strong> sakhelembatha451@gmail.com</p>
        <p><strong>Website:</strong> https://hostmeuphost.co.za</p>
      </section>
    </div>
  );
}
