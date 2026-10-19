/**
 * Utility functions for detecting and masking off-platform contact details
 * in pre-booking inquiry messages.
 */

// Global pattern definitions
const SENSITIVE_PATTERNS = {
  // Matches local SA numbers (079..., 082...), +27 numbers, and general 7-15 digit formats
  PHONE: /(\+?27|0)[6-8][0-9][\s.-]?[0-9]{3}[\s.-]?[0-9]{4}|(\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g,
  
  // Standard email regex
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Social handles & messaging apps
  SOCIAL: /(@|instagram\.com\/|ig:|whatsapp:|wa\.me\/|telegram|tiktok\.com\/)[a-zA-Z0-9_.]+/gi,

  // Web links (must have explicit protocol or www/domain extension)
  URL: /(https?:\/\/|www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[^\s]*)?/gi,

  // Evasion: spelled-out number pairs
  SPELLED_NUMBERS: /\b(zero|one|two|three|four|five|six|seven|eight|nine)\b[\s.-]*\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/gi
};

/**
 * Checks if a string contains prohibited contact details.
 */
export function containsContactInfo(text: string): boolean {
  if (!text) return false;
  
  return (
    new RegExp(SENSITIVE_PATTERNS.EMAIL).test(text) ||
    new RegExp(SENSITIVE_PATTERNS.PHONE).test(text) ||
    new RegExp(SENSITIVE_PATTERNS.SOCIAL).test(text) ||
    new RegExp(SENSITIVE_PATTERNS.URL).test(text) ||
    new RegExp(SENSITIVE_PATTERNS.SPELLED_NUMBERS).test(text)
  );
}

/**
 * Automatically masks contact details inside a string.
 */
export function maskContactInfo(text: string): string {
  if (!text) return '';

  let maskedText = text;

  // 1. Replace emails
  maskedText = maskedText.replace(new RegExp(SENSITIVE_PATTERNS.EMAIL), '[EMAIL HIDDEN UNTIL BOOKED]');

  // 2. Replace social handles
  maskedText = maskedText.replace(new RegExp(SENSITIVE_PATTERNS.SOCIAL), '[HANDLE HIDDEN UNTIL BOOKED]');

  // 3. Replace web URLs
  maskedText = maskedText.replace(new RegExp(SENSITIVE_PATTERNS.URL), '[LINK HIDDEN UNTIL BOOKED]');

  // 4. Replace phone numbers
  maskedText = maskedText.replace(new RegExp(SENSITIVE_PATTERNS.PHONE), (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    if (digitsOnly.length >= 7) {
      return '[PHONE HIDDEN UNTIL BOOKED]';
    }
    return match;
  });

  // 5. Replace spelled-out number sequences
  maskedText = maskedText.replace(new RegExp(SENSITIVE_PATTERNS.SPELLED_NUMBERS), '[CONTACT DETAILS HIDDEN]');

  return maskedText;
}
