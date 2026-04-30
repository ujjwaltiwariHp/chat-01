/**
 * Shared regular expressions for validation and parsing.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+|previous\s+)*instructions/i,
  /reveal (your|the) (system|base) prompt/i,
  /show (me\s+)?(your|the) (system|base) prompt/i,
  /what is (your|the) (system|base) prompt/i,
  /let me know (your|the) (system|base) prompt/i,
  /tell me (the\s+|your\s+)?(system|ai) instructions/i,
  /what are (your|the) (system|ai) instructions/i,
  /system context/i,
  /you are now\b/i,
  /output the above/i,
  /assistant mode/i,
  /\b(set|change|overwrite)\s+prompt\b/i,
  /\[system\]/i,
  /<<<system>>>/i,
  /act as (a|an)\b/i,
  /dan mode/i,
  /stay in character/i,
  /\b(new|fresh) instructions\b/i,
  /disregard (all |previous )?rules/i,
  /developer mode/i,
  /shutdown/i,
];

export const THREAT_PATTERNS = [
  /\bkill\b.*\b(you|someone|company|staff|people|everyone)\b/i,
  /\bmurder\b.*\b(you|someone|company|staff|people|everyone)\b/i,
  /\bhurt\b.*\b(you|someone|company|staff|people|everyone)\b/i,
  /i will harm/i,
  /going to attack/i,
  /i will kill (you|someone|staff)/i,
  /\bbomb\b/i,
  /\bexplode\b.*\b(building|office|staff)\b/i,
];

export const CRISIS_PATTERNS = [
  /i am about to die/i,
  /want to kill myself/i,
  /going to end it/i,
  /i want to die/i,
  /suicide/i,
  /end my life/i,
  /self harm/i,
  /hurt myself/i,
];

/**
 * Standard Route Masking Helper
 * Replaces UUIDs and numeric IDs with placeholders to avoid cardinality explosion in metrics.
 */
export function maskRoute(url: string): string {
  // 1. Mask UUIDs
  let masked = url.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
  
  // 2. Mask Numeric IDs (assuming 5+ digits to avoid masking short legitimate path segments)
  masked = masked.replace(/\/[0-9]{5,}\b/g, '/:id');
  
  return masked;
}

