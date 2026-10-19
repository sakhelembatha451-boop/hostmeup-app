/**
 * Utility functions for detecting and masking off-platform contact details
 * in pre-booking inquiry messages.
 */

export function containsContactInfo(text: string): boolean {
  if (!text) return false;
  return /(@|[0-9]{7,}|whatsapp|wa\.me|instagram|tg:|t\.me)/i.test(text);
}

export function maskContactInfo(text: string | null | undefined): string {
  if (!text) return '';

  let maskedText = String(text);

  // 1. Mask any email address
  maskedText = maskedText.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[EMAIL HIDDEN UNTIL BOOKED]');

  // 2. Mask South African / International phone numbers (any sequence of 7+ digits, spaces, or plus signs)
  maskedText = maskedText.replace(/(\+?27|0)[6-8][0-9][\s.-]?[0-9]{3}[\s.-]?[0-9]{4}|\b\d{7,}\b/g, '[PHONE HIDDEN UNTIL BOOKED]');

  // 3. Mask social handles & links
  maskedText = maskedText.replace(/(@|instagram\.com\/|ig:|whatsapp:|wa\.me\/|telegram|t\.me\/|tiktok\.com\/)[a-zA-Z0-9_.]+/gi, '[HANDLE HIDDEN UNTIL BOOKED]');
  maskedText = maskedText.replace(/(https?:\/\/|www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[^\s]*)?/gi, '[LINK HIDDEN UNTIL BOOKED]');

  return maskedText;
}
