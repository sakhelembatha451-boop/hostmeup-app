import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";

// Resend API Client
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Setup CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentInvoicePayload {
  paymentType: "deposit" | "balance";
  amountPaid: number;
  remainingBalance: number;
  booking: {
    id: string;
    event_name: string;
    event_date: string;
    total_amount: number;
    verification_pin?: string;
    verification_token?: string;
  };
  host: {
    full_name: string;
    email: string;
  };
  artist: {
    full_name: string;
    email: string;
    stage_name?: string;
  };
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: PaymentInvoicePayload = await req.json();
    const { paymentType, amountPaid, remainingBalance, booking, host, artist } = payload;

    const formattedAmount = new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amountPaid);

    const formattedRemaining = new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(remainingBalance);

    const formattedTotal = new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(booking.total_amount);

    const paymentTitle = paymentType === "deposit" ? "40% Deposit Received" : "Final Balance Paid";
    const artistName = artist.stage_name || artist.full_name;

    // Direct QR Code generator URL using public API
    const qrToken = booking.verification_token || booking.id;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrToken)}`;
    const verificationPin = booking.verification_pin || "N/A";

    // Production verified sender email
    const senderEmail = "HostMeUp Payments <receipts@hostmeuphost.co.za>";

    // HTML Email Template
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
        <div style="background-color: #0F172A; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 700;">HostMeUp</h1>
          <p style="color: #94A3B8; margin: 6px 0 0 0; font-size: 14px;">Official Payment Receipt & Verification Pass</p>
        </div>
        
        <div style="border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; padding: 32px; background-color: #FFFFFF;">
          <h2 style="color: #0F172A; margin-top: 0; font-size: 20px;">${paymentTitle}</h2>
          <p style="color: #475569; font-size: 15px;">
            A payment of <strong>${formattedAmount}</strong> has been successfully processed for booking <strong>#${booking.id.slice(0, 8)}</strong>.
          </p>

          <!-- Talent On-Site Verification Pass Section -->
          <div style="background-color: #F1F5F9; border: 2px dashed #CBD5E1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: #475569;">
              On-Site Verification Pass
            </p>
            <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748B;">
              Provide this QR code or PIN to ${artistName} upon arrival at the venue.
            </p>
            
            <div style="display: inline-block; background: #FFFFFF; padding: 12px; border-radius: 8px; border: 1px solid #E2E8F0; margin-bottom: 12px;">
              <img src="${qrCodeUrl}" alt="Verification QR Code" width="160" height="160" style="display: block;" />
            </div>

            <div style="margin-top: 8px;">
              <span style="font-size: 12px; color: #64748B; display: block; margin-bottom: 4px;">4-Digit PIN Code</span>
              <span style="font-family: monospace; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #0F172A; background: #FFFFFF; padding: 6px 16px; border-radius: 6px; border: 1px solid #CBD5E1; display: inline-block;">
                ${verificationPin}
              </span>
            </div>
          </div>

          <div style="background-color: #F8FAFC; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid #E2E8F0;">
            <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; color: #64748B; letter-spacing: 0.05em;">Booking Summary</h3>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748B;">Event Name:</td>
                <td style="padding: 6px 0; font-weight: 600; text-align: right;">${booking.event_name}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748B;">Event Date:</td>
                <td style="padding: 6px 0; font-weight: 600; text-align: right;">${booking.event_date}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748B;">Talent Provider:</td>
                <td style="padding: 6px 0; font-weight: 600; text-align: right;">${artistName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748B;">Host:</td>
                <td style="padding: 6px 0; font-weight: 600; text-align: right;">${host.full_name}</td>
              </tr>
              <tr style="border-top: 1px solid #E2E8F0;">
                <td style="padding: 12px 0 6px 0; color: #64748B;">Total Amount:</td>
                <td style="padding: 12px 0 6px 0; font-weight: 600; text-align: right;">${formattedTotal}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #16A34A; font-weight: 600;">Amount Paid:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #16A34A; text-align: right;">${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748B;">Remaining Balance:</td>
                <td style="padding: 6px 0; font-weight: 600; text-align: right;">${formattedRemaining}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 13px; color: #94A3B8; text-align: center; margin-bottom: 0;">
            Thank you for using HostMeUp! If you have any questions regarding this invoice, please reach out to support.
          </p>
        </div>
      </div>
    `;

    // Send emails in parallel to both host and artist
    const emailPromises = [];

    if (host.email) {
      emailPromises.push(
        resend.emails.send({
          from: senderEmail,
          to: [host.email],
          subject: `Receipt & Entry Pass: ${paymentTitle} - ${booking.event_name}`,
          html: emailHtml,
        })
      );
    }

    if (artist.email) {
      emailPromises.push(
        resend.emails.send({
          from: senderEmail,
          to: [artist.email],
          subject: `Payment Notification: ${paymentTitle} - ${booking.event_name}`,
          html: emailHtml,
        })
      );
    }

    const results = await Promise.all(emailPromises);

    return new Response(
      JSON.stringify({ success: true, results }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
