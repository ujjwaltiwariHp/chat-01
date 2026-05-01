export interface FAQEntry {
  patterns: RegExp[];
  answer: string;
  policyArea: string;
  priority?: number;
}

export const HR_FAQ: FAQEntry[] = [
  {
    patterns: [
      /working hours/i,
      /office timing/i,
      /office hours/i,
      /attendance/i,
    ],
    policyArea: "Working Hours and Attendance",
    answer: `Standard working time is **40 hours per week**. Typical timing is **10:00 AM to 7:00 PM** or **10:30 AM to 7:30 PM**, depending on assignment.`,
    priority: 3,
  },
  {
    patterns: [/paid leave/i, /pl balance/i, /leave balance/i, /annual leave/i],
    policyArea: "Leave Deduction and Salary",
    answer: `Paid Leave (PL) is **12 days per year**, earned at **1 day per month** after probation. Advance leave is not allowed when balance is zero.`,
    priority: 3,
  },
  {
    patterns: [/sick leave/i, /medical certificate/i, /doctor note/i],
    policyArea: "Working Hours and Attendance",
    answer: `Sick Leave (SL) is **9 days per year** and is allowed during probation. More than **2 consecutive sick leaves** require a medical certificate.`,
    priority: 3,
  },
  // 🔹 Leave edge cases (NOT full policy)
  {
    patterns: [
      /medical certificate/i,
      /doctor note/i,
      /sick leave.*certificate/i,
    ],
    policyArea: "Leave",
    answer: `If you take **more than 2 consecutive sick leaves**, a **medical certificate is mandatory**.`,
    priority: 4,
  },
  {
    patterns: [/how many.*leave.*at once/i, /10 leaves continuously/i, /consecutive leave limit/i],
    policyArea: "Leave Deduction and Salary",
    answer: `The policy defines your leave entitlement (**12 PL/year, 9 SL/year**) but does **not specify a fixed maximum consecutive leave limit**. In practice, approval depends on leave balance, manager approval, and work planning.`,
    priority: 5,
  },
  {
    patterns: [/carry.*leave/i, /leave carry/i, /unused leave.*year/i],
    policyArea: "Leave",
    answer: `Unused leaves **do NOT carry forward** and **cannot be encashed** at year-end.`,
    priority: 4,
  },

  // 🔹 Salary & deduction edge cases
  {
    patterns: [/no call no show/i, /ncns/i, /absent without informing/i],
    policyArea: "Salary",
    answer: `No Call No Show (NCNS) results in **double salary deduction per day** and is treated as a serious violation.`,
    priority: 4,
  },
  {
    patterns: [/leave without approval/i, /informed but no approval/i],
    policyArea: "Salary",
    answer: `If you take leave **without approval (even if informed)**, it is treated as **unpaid leave with salary deduction**.`,
    priority: 4,
  },
  {
    patterns: [/discuss salary/i, /share salary/i, /salary confidential/i],
    policyArea: "Salary",
    answer: `Salary details are **strictly confidential**. Sharing them may lead to **disciplinary action**.`,
    priority: 4,
  },

  // 🔹 Sandwich leave (quick clarification)
  {
    patterns: [
      /sandwich leave/i,
      /leave around weekend/i,
      /holiday between leave/i,
    ],
    policyArea: "Sandwich Leave",
    answer: `If you take leave **before and after a weekend/holiday**, the **entire period (including weekend/holiday)** is counted as leave.`,
    priority: 4,
  },
  {
    patterns: [/increment policy/i, /salary hike/i, /raise/i, /appraisal/i],
    policyArea: "Increment Policy",
    answer: `Increments are handled through the **Increment Policy** and are typically tied to performance review or management approval.`,
    priority: 3,
  },

  // 🔹 Notice / exit quick facts
  {
    patterns: [/fnf time/i, /full and final.*when/i, /settlement.*days/i],
    policyArea: "Notice Period",
    answer: `Full & Final (FNF) settlement is processed **within 40 days after your last working day**.`,
    priority: 4,
  },
  {
    patterns: [/absent.*7 days/i, /no show.*7 days/i],
    policyArea: "Notice Period",
    answer: `If you are absent **beyond 7 days without approval**, it may be treated as **voluntary termination**.`,
    priority: 4,
  },
  {
    patterns: [/notice period/i, /resign/i, /termination/i, /relieving/i],
    policyArea: "Notice Period and Termination",
    answer: `Notice period and exit handling are covered under the **Notice Period and Termination** policy. If you want, I can summarize the specific clause you need.`,
    priority: 3,
  },

  // 🔹 Device & behavior quick rules
  {
    patterns: [/use company device.*personal/i, /personal use.*office laptop/i],
    policyArea: "IT Security",
    answer: `Company devices are **strictly for work use only**. Personal usage is not allowed.`,
    priority: 4,
  },
  {
    patterns: [/mobile device use/i, /what is not allowed.*mobile/i, /not allowed.*mobile/i, /phone policy/i],
    policyArea: "Mobile Device Use",
    answer: `Under the **Mobile Device Use Policy**, not allowed actions include non-work use during work time (movies, videos, social media browsing, games) and endorsing third-party products without company approval.`,
    priority: 5,
  },
  {
    patterns: [/security/i, /password/i, /mfa/i, /vpn/i, /breach/i],
    policyArea: "IT Security",
    answer: `IT security includes **access control, strong passwords, MFA, encryption, antivirus, and incident reporting**.`,
    priority: 2,
  },

  // 🔹 Reporting / help
  {
    patterns: [/contact hr/i, /hr email/i, /who to ask.*policy/i],
    policyArea: "General",
    answer: `For any policy clarification, contact **hr@hangingpanda.com** or your manager.`,
    priority: 3,
  },
  {
    patterns: [/remote work/i, /work from home/i, /wfh/i],
    policyArea: "Remote Work",
    answer: `Remote work may be allowed based on **role, performance, management decision, and company-approved communication/security rules**.`,
    priority: 3,
  },
  {
    patterns: [/all policies/i, /show all policies/i, /what hr policies exist/i, /policy list/i, /i want to know all the policy/i],
    policyArea: "Policy Index",
    answer: `HangingPanda has 15 major HR policy areas: Recruitment and Hiring, Health and Safety, IT and Data Security, Anti-Fraud and Ethics, Remote Work, Disciplinary and Grievance, Working Hours and Attendance, Leave Deduction and Salary, Sandwich Leave, Increment, Sexual Harassment, Notice and Termination, Mobile Device Use, Social Media Use, and Policy Modification.`,
    priority: 5,
  },
];

export function matchFAQ(
  message: string,
  history: Array<{ role: string; content: string }> = [],
): FAQEntry | null {
  const lower = message.toLowerCase();
  const lastUserMessage = [...history]
    .reverse()
    .find((entry) => entry.role === "user" && entry.content)?.content;
  const joined = `${lastUserMessage || ""}\n${lower}`;

  let best: { entry: FAQEntry; score: number } | null = null;

  for (const entry of HR_FAQ) {
    const matches = entry.patterns.filter((pattern) => pattern.test(joined));
    if (!matches.length) continue;
    const score = matches.length * 10 + (entry.priority || 0);
    if (!best || score > best.score) {
      best = { entry, score };
    }
  }

  return best?.entry || null;
}
