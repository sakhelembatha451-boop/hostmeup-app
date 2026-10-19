/**
 * Utility functions for detecting and masking off-platform contact details
 * in pre-booking inquiry messages.
 */

/**
 * Checks if a string contains prohibited contact details.
 */
export function containsContactInfo(text: string): boolean {
  if (!text) return false;
  
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
  const phoneRegex = /(?:\+?27|0)[6-8][0-9][\s.-]?[0-9]{3}[\s.-]?[0-9]{4}|\b\d{7,}\b/;
  const socialRegex = /(@|instagram\.com\/|ig:|whatsapp:|wa\.me\/|telegram|t\.me\/|tiktok\.com\/)[a-zA-Z0-9_.]+/i;
  const urlRegex = /(https?:\/\/|www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[^\s]*)?/i;

  return (
    emailRegex.test(text) ||
    phoneRegex.test(text) ||
    socialRegex.test(text) ||
    urlRegex.test(text)
  );
}

/**
 * Automatically masks contact details inside a string.
 */
export function maskContactInfo(text: string | null | undefined): string {
  if (!text) return '';

  let maskedText = String(text);

  // 1. Mask Emails (fresh regex instance)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  maskedText = maskedText.replace(emailRegex, '[EMAIL HIDDEN UNTIL BOOKED]');

  // 2. Mask Social Handles & Links
  const socialRegex = /(@|instagram\.com\/|ig:|whatsapp:|wa\.me\/|telegram|t\.me\/|tiktok\.com\/)[a-zA-Z0-9_.]+/gi;
  maskedText = maskedText.replace(socialRegex, '[HANDLE HIDDEN UNTIL BOOKED]');

  const urlRegex = /(https?:\/\/|www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[^\s]*)?/gi;
  maskedText = maskedText.replace(urlRegex, '[LINK HIDDEN UNTIL BOOKED]');

  // 3. Mask Phone Numbers (Catters for 10-digit SA numbers, international +27, and any 7+ digit strings)
  const phoneRegex = /(\+?27|0)[6-8][0-9][\s.-]?[0-9]{3}[\s.-]?[0-9]{4}|\b\d{7,}\b/gi;
  maskedText = maskedText.replace(phoneRegex, '[PHONE HIDDEN UNTIL BOOKED]');

  return maskedText;
}
