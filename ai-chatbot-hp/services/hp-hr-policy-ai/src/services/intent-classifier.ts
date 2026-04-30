const GREETING_PATTERNS =
  /^\s*(hi+|hii+|hiiii*|hai|heya|heyy+|yo|sup|wassup|hello+|hey+|good\s+(morning|afternoon|evening)|howdy|namaste|hola|greetings)\s*[!?.]*\s*$/i;
const THANKS_PATTERNS =
  /^\s*(thanks|thank\s+you|thx|ty|ok|okay|got\s+it|understood|sure|alright|great|perfect|noted|nice|cool|awesome|sounds good|makes sense|i see|i understand)\s*[!?.]*\s*$/i;
const HELP_PATTERNS =
  /^\s*(help|what can you do|what do you (know|cover)|how can you help|your capabilities|what (are you|topics))\s*\??\s*$/i;

export type IntentType = "greeting" | "thanks" | "help" | "policy_query";

export function classifyIntent(message: string): IntentType {
  const trimmed = message.trim();
  if (GREETING_PATTERNS.test(trimmed)) return "greeting";
  if (THANKS_PATTERNS.test(trimmed)) return "thanks";
  if (HELP_PATTERNS.test(trimmed)) return "help";
  return "policy_query";
}

export const STATIC_RESPONSES: Record<
  Exclude<IntentType, "policy_query">,
  string
> = {
  greeting: `Hello! I'm the HangingPanda Assistant. I can help you with questions about our HR policies including:\n\n• Leave & attendance\n• Working hours\n• Increment & appraisal\n• Notice period & termination\n• Disciplinary procedures\n• And much more!\n\nWhat would you like to know?`,
  thanks: `You're welcome! Feel free to ask if you have more questions about our HR policies.`,
  help: `I'm your HR Policy Assistant. I can answer questions about:\n\n1. **Leave policies** (paid, sick, sandwich rule)\n2. **Working hours & attendance**\n3. **Salary & increments**\n4. **Notice period & termination**\n5. **Disciplinary procedures**\n6. **Remote work policies**\n7. **And all 15 HangingPanda HR policies**\n\nJust ask your question!`,
};
