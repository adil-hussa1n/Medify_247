/**
 * Normalize phone to E.164-style string for validation and storage.
 */
export const normalizePhoneE164 = (value) => {
  if (!value || typeof value !== 'string') return value;

  let p = value.trim().replace(/[\s\-()]/g, '');
  if (!p) return p;

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

export const isValidE164Phone = (value) =>
  typeof value === 'string' && /^\+[1-9]\d{9,14}$/.test(value);
