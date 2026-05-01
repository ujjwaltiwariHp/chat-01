const GREETING_PATTERNS =
  /^\s*(hi+|hii+|hiiii*|hai|heya|heyy+|yo|sup|wassup|hello+|hey+|good\s+(morning|afternoon|evening)|howdy|namaste|hola|greetings)\s*[!?.]*\s*$/i;
const THANKS_PATTERNS =
  /^\s*(thanks|thank\s+you|thx|ty|ok|okay|got\s+it|understood|sure|alright|great|perfect|noted|nice|cool|awesome|sounds good|makes sense|i see|i understand)\s*[!?.]*\s*$/i;
const HELP_PATTERNS =
  /^\s*(help|what can you do|what do you (know|cover)|how can you help|your capabilities|what (are you|topics))\s*\??\s*$/i;
const IDENTITY_PATTERNS =
  /^\s*(who are you|are you (a )?bot|are u (a )?bot|what are you|yes or no\??)\s*[!?.]*\s*$/i;
const WELLBEING_PATTERNS =
  /^\s*(how are you|how r you|how are u|how's it going|how is it going)\s*[!?.]*\s*$/i;
const CORRECTION_PATTERNS =
  /\b(you answered wrong|you reply wrong|that was wrong|wrong answer|you are wrong|why (did|do) you reply wrong)\b/i;

export type IntentType =
  | "greeting"
  | "thanks"
  | "help"
  | "identity"
  | "wellbeing"
  | "correction"
  | "policy_query";

export function classifyIntent(message: string): IntentType {
  const trimmed = message.trim();
  if (GREETING_PATTERNS.test(trimmed)) return "greeting";
  if (THANKS_PATTERNS.test(trimmed)) return "thanks";
  if (HELP_PATTERNS.test(trimmed)) return "help";
  if (IDENTITY_PATTERNS.test(trimmed)) return "identity";
  if (WELLBEING_PATTERNS.test(trimmed)) return "wellbeing";
  if (CORRECTION_PATTERNS.test(trimmed)) return "correction";
  return "policy_query";
}

export const STATIC_RESPONSES: Record<
  Exclude<IntentType, "policy_query">,
  string
> = {
  greeting: `Hi! I am the HangingPanda HR Policy Assistant. Ask me about leave, attendance, increment, notice period, remote work, or any other HR policy topic.`,
  thanks: `You're welcome! Feel free to ask if you have more questions about our HR policies.`,
  help: `I can help with all HangingPanda HR policy areas, including leave, attendance, salary deductions, increment, notice period, remote work, mobile and social media rules, grievance, and security. Tell me the topic and I will explain it clearly.`,
  identity: `Yes, I am an HR policy assistant bot for HangingPanda Pvt. Ltd. I am here to answer policy questions clearly and quickly.`,
  wellbeing: `I am doing well, thanks for asking. I am ready to help with any HR policy question you have.`,
  correction: `You're right to point that out. Sorry about the confusion. Please share the exact policy question again and I will answer it correctly and clearly.`,
};
