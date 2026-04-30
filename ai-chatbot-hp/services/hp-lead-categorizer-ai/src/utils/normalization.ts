export const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const normalizeEmail = (value: unknown) => normalizeOptionalString(value)?.toLowerCase() || null;

export const normalizePhone = (value: unknown) => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }

  const digits = normalized.replace(/[^\d+]/g, '');
  return digits.length >= 7 ? digits : null;
};

export const normalizeComparable = (value: unknown) => normalizeOptionalString(value)?.toLowerCase() || null;

export const now = () => new Date();
