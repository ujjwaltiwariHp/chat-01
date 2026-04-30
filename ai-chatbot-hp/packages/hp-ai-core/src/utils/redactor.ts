const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_REGEX =
  /(\+?\d{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
const NAME_CONTEXT_PATTERNS = [
  /(\bmy name is\s+)([A-Za-z][A-Za-z' -]{1,60})/gi,
  /(\b(?:i am|i'm|this is)\s+)([A-Za-z][A-Za-z' -]{1,60})/gi,
  /(\b(?:name|full name|contact name)\s*[:=]\s*)([A-Za-z][A-Za-z' -]{1,60})/gi,
];

const EMAIL_FIELDS = new Set(["email", "emailaddress", "contactemail"]);
const PHONE_FIELDS = new Set([
  "phone",
  "phonenumber",
  "mobile",
  "mobilenumber",
  "contactphone",
]);
const NAME_FIELDS = new Set([
  "name",
  "fullname",
  "firstname",
  "lastname",
  "contactname",
  "enteredbyname",
  "sendername",
]);
const SKIP_FIELDS = new Set([
  "id",
  "tenantid",
  "externalid",
  "requestid",
  "jobid",
  "icpprofileid",
  "analysisid",
]);

type TokenType = "EMAIL" | "PHONE" | "NAME";

interface RedactionState {
  counters: Record<TokenType, number>;
  tokenMap: Record<string, string>;
}

export interface RedactionResult {
  redactedText: string;
  tokenMap: Record<string, string>;
}

export interface StructuredRedactionResult<T> {
  redactedData: T;
  tokenMap: Record<string, string>;
}

const createRedactionState = (): RedactionState => ({
  counters: {
    EMAIL: 0,
    PHONE: 0,
    NAME: 0,
  },
  tokenMap: {},
});

const nextToken = (
  type: TokenType,
  original: string,
  state: RedactionState,
): string => {
  const token = `{{PII_${type}_${++state.counters[type]}}}`;
  state.tokenMap[token] = original;
  return token;
};

const normalizeFieldName = (fieldName?: string | null) => {
  return (fieldName || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
};

const redactFieldValue = (
  value: string,
  type: TokenType,
  state: RedactionState,
) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  return nextToken(type, trimmed, state);
};

const redactFreeText = (text: string, state: RedactionState) => {
  let redactedText = text
    .replace(EMAIL_REGEX, (match) => nextToken("EMAIL", match, state))
    .replace(PHONE_REGEX, (match) => nextToken("PHONE", match, state));

  for (const pattern of NAME_CONTEXT_PATTERNS) {
    redactedText = redactedText.replace(
      pattern,
      (_match, prefix: string, name: string) => {
        return `${prefix}${nextToken("NAME", name.trim(), state)}`;
      },
    );
  }

  return redactedText;
};

const redactStructuredValue = <T>(
  value: T,
  state: RedactionState,
  fieldName?: string,
): T => {
  if (typeof value === "string") {
    const normalizedFieldName = normalizeFieldName(fieldName);

    if (EMAIL_FIELDS.has(normalizedFieldName)) {
      return redactFieldValue(value, "EMAIL", state) as T;
    }

    if (PHONE_FIELDS.has(normalizedFieldName)) {
      return redactFieldValue(value, "PHONE", state) as T;
    }

    if (NAME_FIELDS.has(normalizedFieldName)) {
      return redactFieldValue(value, "NAME", state) as T;
    }

    if (SKIP_FIELDS.has(normalizedFieldName)) {
      return value;
    }

    return redactFreeText(value, state) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactStructuredValue(item, state)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([key, nestedValue]) => [
          key,
          redactStructuredValue(nestedValue, state, key),
        ],
      ),
    ) as T;
  }

  return value;
};

const restoreStructuredValue = <T>(
  value: T,
  tokenMap: Record<string, string>,
): T => {
  if (typeof value === "string") {
    return Redactor.restore(value, tokenMap) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => restoreStructuredValue(item, tokenMap)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([key, nestedValue]) => [
          key,
          restoreStructuredValue(nestedValue, tokenMap),
        ],
      ),
    ) as T;
  }

  return value;
};

/**
 * Generic reversible PII redactor for AI-bound content.
 */
export class Redactor {
  static redact(text: string): RedactionResult {
    const state = createRedactionState();
    const redactedText = redactFreeText(text, state);

    return { redactedText, tokenMap: state.tokenMap };
  }

  static redactStructuredData<T>(value: T): StructuredRedactionResult<T> {
    const state = createRedactionState();

    return {
      redactedData: redactStructuredValue(value, state),
      tokenMap: state.tokenMap,
    };
  }

  static restore(
    redactedText: string,
    tokenMap: Record<string, string>,
  ): string {
    let restored = redactedText;

    for (const [token, original] of Object.entries(tokenMap)) {
      restored = restored.replace(
        new RegExp(token.replace(/[{}]/g, "\\$&"), "g"),
        original,
      );
    }

    return restored;
  }

  static restoreStructuredData<T>(
    value: T,
    tokenMap: Record<string, string>,
  ): T {
    return restoreStructuredValue(value, tokenMap);
  }
}
