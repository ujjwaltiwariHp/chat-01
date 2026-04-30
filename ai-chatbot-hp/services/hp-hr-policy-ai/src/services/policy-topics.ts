const POLICY_TOPIC_KEYWORDS: Array<{ name: string; keywords: string[] }> = [
  {
    name: "Recruitment and Hiring",
    keywords: [
      "recruit",
      "hiring",
      "hire",
      "interview",
      "onboard",
      "joining",
      "candidate",
      "job posting",
    ],
  },
  {
    name: "Health and Safety",
    keywords: [
      "health",
      "safety",
      "ergonomics",
      "mental health",
      "wellbeing",
      "workplace safety",
    ],
  },
  {
    name: "IT and Data Security",
    keywords: [
      "it",
      "security",
      "data security",
      "password",
      "access",
      "cybersecurity",
      "breach",
      "mfa",
      "vpn",
      "encryption",
    ],
  },
  {
    name: "Anti-Fraud and Ethics",
    keywords: [
      "fraud",
      "ethics",
      "misconduct",
      "compliance",
      "integrity",
      "whistleblower",
    ],
  },
  {
    name: "Remote Work",
    keywords: ["remote", "work from home", "wfh", "home office", "virtual"],
  },
  {
    name: "Disciplinary Action and Grievance",
    keywords: [
      "disciplinary",
      "grievance",
      "complaint",
      "appeal",
      "warning",
      "suspension",
      "misconduct",
    ],
  },
  {
    name: "Working Hours and Attendance",
    keywords: [
      "working hours",
      "attendance",
      "office hours",
      "biometric",
      "standup",
      "eod",
      "hours",
    ],
  },
  {
    name: "Leave Deduction and Salary",
    keywords: [
      "leave deduction",
      "salary deduction",
      "unpaid leave",
      "ncns",
      "leave balance",
      "leave",
    ],
  },
  {
    name: "Sandwich Leave",
    keywords: ["sandwich leave", "holiday", "weekend", "consecutive leave"],
  },
  {
    name: "Increment Policy",
    keywords: [
      "increment",
      "salary hike",
      "appraisal",
      "review",
      "raise",
      "revision",
    ],
  },
  {
    name: "Sexual Harassment",
    keywords: ["sexual harassment", "harassment", "posh", "unwelcome behavior"],
  },
  {
    name: "Notice Period and Termination",
    keywords: [
      "notice period",
      "termination",
      "resignation",
      "fnf",
      "relieving",
      "exit",
      "absconding",
    ],
  },
  {
    name: "Mobile Device Use",
    keywords: ["mobile", "phone", "device", "silent mode"],
  },
  {
    name: "Social Media Use",
    keywords: [
      "social media",
      "linkedin",
      "posting",
      "endorsement",
      "reputation",
    ],
  },
  {
    name: "Policy Modification",
    keywords: [
      "policy change",
      "update",
      "modification",
      "amendment",
      "review",
      "acknowledgment",
    ],
  },
];

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "about",
  "what",
  "is",
  "are",
  "was",
  "were",
  "i",
  "you",
  "we",
  "they",
  "can",
  "could",
  "should",
  "please",
  "tell",
  "me",
  "my",
  "your",
  "this",
  "that",
  "it",
  "policy",
  "help",
  "need",
  "want",
  "do",
  "does",
  "did",
  "how",
  "when",
  "where",
  "why",
  "which",
  "who",
  "if",
  "from",
  "under",
  "into",
  "at",
  "by",
  "be",
  "as",
  "up",
  "out",
  "more",
  "less",
  "then",
  "there",
  "their",
  "our",
  "his",
  "her",
  "its",
  "all",
  "any",
  "per",
  "day",
  "days",
  "month",
  "year",
  "years",
]);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

export function resolvePolicyTopicMatches(message: string): string[] {
  const normalized = normalizeText(message);
  const tokens = tokenize(message);
  const matches = new Set<string>();

  for (const topic of POLICY_TOPIC_KEYWORDS) {
    const hit = topic.keywords.some(
      (keyword) => normalized.includes(keyword) || tokens.includes(keyword),
    );
    if (hit) {
      matches.add(topic.name);
    }
  }

  return Array.from(matches);
}

export function buildPolicyClarification(matches: string[]): string {
  if (matches.length === 0) {
    return "I can help with HangingPanda HR policies. Please rephrase your question with a policy topic like leave, attendance, increment, notice period, or security.";
  }

  if (matches.length === 1) {
    return `I can help with the **${matches[0]}** policy. Please ask a specific question about its rules, eligibility, exceptions, or process.`;
  }

  return `Are you asking about: ${matches.map((topic, index) => `${index + 1}. ${topic}`).join("  ")}?`;
}
