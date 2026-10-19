/**
 * Utility functions for detecting and masking off-platform contact details
 * in pre-booking inquiry messages.
 */

// Regex patterns for sensitive contact patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
const URL_REGEX = /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
const SOCIAL_HANDLES_REGEX = /(@|instagram\.com\/|ig:|whatsapp:|wa\.me\/|telegram|tiktok\.com\/)[a-zA-Z0-9_.]+/gi;

// Spell-out detection for evasion (e.g., "zero eight two", "zero 8 two", "call me at")
const SPELLED_NUMBERS_REGEX = /\b(zero|one|two|three|four|five|six|seven|eight|nine)\b[\s.-]*\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/gi;

/**
 * Checks if a string contains prohibited contact details.
 */
export function containsContactInfo(text: string): boolean {
  return (
    EMAIL_REGEX.test(text) ||
    PHONE_REGEX.test(text) ||
    URL_REGEX.test(text) ||
    SOCIAL_HANDLES_REGEX.test(text) ||
    SPELLED_NUMBERS_REGEX.test(text)
  );
}

/**
 * Automatically masks contact details inside a string.
 */
export function maskContactInfo(text: string): string {
  if (!text) return text;

  let maskedText = text;

  // Replace emails
  maskedText = maskedText.replace(EMAIL_REGEX, '[EMAIL HIDDEN UNTIL BOOKED]');

  // Replace social handles / handles
  maskedText = maskedText.replace(SOCIAL_HANDLES_REGEX, '[HANDLE HIDDEN UNTIL BOOKED]');

  // Replace web links
  maskedText = maskedText.replace(URL_REGEX, '[LINK HIDDEN UNTIL BOOKED]');

  // Replace phone numbers
  maskedText = maskedText.replace(PHONE_REGEX, (match) => {
    // Only mask if length of digits is >= 7 to avoid masking short quantities/dates
    const digitsOnly = match.replace(/\D/g, '');
    if (digitsOnly.length >= 7) {
      return '[PHONE HIDDEN UNTIL BOOKED]';
    }
    return match;
  });

  // Replace spelled-out number sequences
  maskedText = maskedText.replace(SPELLED_NUMBERS_REGEX, '[CONTACT DETAILS HIDDEN]');

  return maskedText;
}
