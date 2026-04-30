export interface FAQEntry {
  patterns: RegExp[];
  answer: string;
  policyArea: string;
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
  },
  {
    patterns: [/paid leave/i, /pl balance/i, /leave balance/i, /annual leave/i],
    policyArea: "Leave Deduction and Salary",
    answer: `Paid Leave (PL) is **12 days per year**, earned at **1 day per month** after probation. Advance leave is not allowed when balance is zero.`,
  },
  {
    patterns: [/sick leave/i, /medical certificate/i, /doctor note/i],
    policyArea: "Working Hours and Attendance",
    answer: `Sick Leave (SL) is **9 days per year** and is allowed during probation. More than **2 consecutive sick leaves** require a medical certificate.`,
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
  },
  {
    patterns: [/carry.*leave/i, /leave carry/i, /unused leave.*year/i],
    policyArea: "Leave",
    answer: `Unused leaves **do NOT carry forward** and **cannot be encashed** at year-end.`,
  },

  // 🔹 Salary & deduction edge cases
  {
    patterns: [/no call no show/i, /ncns/i, /absent without informing/i],
    policyArea: "Salary",
    answer: `No Call No Show (NCNS) results in **double salary deduction per day** and is treated as a serious violation.`,
  },
  {
    patterns: [/leave without approval/i, /informed but no approval/i],
    policyArea: "Salary",
    answer: `If you take leave **without approval (even if informed)**, it is treated as **unpaid leave with salary deduction**.`,
  },
  {
    patterns: [/discuss salary/i, /share salary/i, /salary confidential/i],
    policyArea: "Salary",
    answer: `Salary details are **strictly confidential**. Sharing them may lead to **disciplinary action**.`,
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
  },
  {
    patterns: [/increment policy/i, /salary hike/i, /raise/i, /appraisal/i],
    policyArea: "Increment Policy",
    answer: `Increments are handled through the **Increment Policy** and are typically tied to performance review or management approval.`,
  },

  // 🔹 Notice / exit quick facts
  {
    patterns: [/fnf time/i, /full and final.*when/i, /settlement.*days/i],
    policyArea: "Notice Period",
    answer: `Full & Final (FNF) settlement is processed **within 40 days after your last working day**.`,
  },
  {
    patterns: [/absent.*7 days/i, /no show.*7 days/i],
    policyArea: "Notice Period",
    answer: `If you are absent **beyond 7 days without approval**, it may be treated as **voluntary termination**.`,
  },
  {
    patterns: [/notice period/i, /resign/i, /termination/i, /relieving/i],
    policyArea: "Notice Period and Termination",
    answer: `Notice period and exit handling are covered under the **Notice Period and Termination** policy. If you want, I can summarize the specific clause you need.`,
  },

  // 🔹 Device & behavior quick rules
  {
    patterns: [/use company device.*personal/i, /personal use.*office laptop/i],
    policyArea: "IT Security",
    answer: `Company devices are **strictly for work use only**. Personal usage is not allowed.`,
  },
  {
    patterns: [/security/i, /password/i, /mfa/i, /vpn/i, /breach/i],
    policyArea: "IT Security",
    answer: `IT security includes **access control, strong passwords, MFA, encryption, antivirus, and incident reporting**.`,
  },

  // 🔹 Reporting / help
  {
    patterns: [/contact hr/i, /hr email/i, /who to ask.*policy/i],
    policyArea: "General",
    answer: `For any policy clarification, contact **hr@hangingpanda.com** or your manager.`,
  },
  {
    patterns: [/remote work/i, /work from home/i, /wfh/i],
    policyArea: "Remote Work",
    answer: `Remote work may be allowed based on **role, performance, management decision, and company-approved communication/security rules**.`,
  },
];

export function matchFAQ(message: string): FAQEntry | null {
  const lower = message.toLowerCase();

  return (
    HR_FAQ.find((entry) =>
      entry.patterns.some((pattern) => pattern.test(lower)),
    ) || null
  );
}
