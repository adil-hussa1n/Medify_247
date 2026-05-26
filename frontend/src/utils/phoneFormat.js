/**
 * Format phone input for Bangladesh (+88 prefix) while typing.
 */
export const formatPhoneNumber = (value) => {
  if (!value || value.trim() === '') {
    return '+88';
  }

  let cleaned = value.replace(/[^\d+]/g, '');

  if (!cleaned.startsWith('+88')) {
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.startsWith('88')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+88' + cleaned;
    }
  }

  if (cleaned.length < 3 || !cleaned.startsWith('+88')) {
    return '+88';
  }

  return cleaned;
};

/**
 * Normalize phone for API (E.164). Handles 01XXXXXXXXX and 880XXXXXXXXX.
 */
export const normalizePhoneForApi = (value) => {
  if (!value || typeof value !== 'string') return '';

  let p = value.trim().replace(/[\s\-()]/g, '');
  if (!p) return '';

  if (p.startsWith('00')) {
    p = '+' + p.slice(2);
  } else if (p.startsWith('0')) {
    p = '+880' + p.slice(1);
  } else if (/^880\d+$/.test(p)) {
    p = '+' + p;
  } else if (/^88\d+$/.test(p)) {
    p = '+' + p;
  } else if (!p.startsWith('+')) {
    p = '+880' + p;
  }

  return p;
};

export const isValidApiPhone = (phone) => /^\+[1-9]\d{9,14}$/.test(phone);
