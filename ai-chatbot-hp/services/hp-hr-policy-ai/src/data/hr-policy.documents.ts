import { PolicyDocumentInput } from "@/types/rag.js";

export const HR_POLICY_DOCUMENTS: PolicyDocumentInput[] = [
  {
    sourceKey: "hr-policy-overview",
    title: "Company Overview and Director Message",
    sourceUrl: "hr-policy.pdf",
    metadata: {
      documentType: "hr-policy",
      category: "overview",
      version: "v3",
    },
    content: `Keywords: overview, company, director, welcome, policies, index, HangingPanda, all policies, policy list

Welcome to HangingPanda Pvt. Ltd.

Director's Message:
At HangingPanda, we believe that a clear and consistent set of policies is essential for maintaining a healthy, productive, and inclusive workplace. Our policies are designed to provide guidance on the expectations, rights, and responsibilities of both the company and our employees. They help ensure that operations run smoothly while fostering an environment where everyone feels respected, valued, and empowered to do their best work.

Why Policies Matter:
Our policies are a reflection of our company values. By outlining clear guidelines, we aim to protect our employees, ensure compliance, promote fairness, and foster growth.

Employees are encouraged to communicate openly and to contact Human Resources or their manager if they need clarification on any policy.

Policy Index:
1. Recruitment and Hiring Policies
2. Health and Safety Policies
3. Information Technology (IT) and Data Security Policies
4. Anti-Fraud and Ethics Policies
5. Remote Work Policies
6. Disciplinary Action and Grievance Policies
7. Working Hours and Attendance Policies
8. Leave Deduction and Salary Policy
9. Sandwich Leave Policy
10. Annual or Performance-Based Increment Policy
11. Sexual Harassment Clause
12. Notice Period and Termination
13. Mobile Device Use Policy
14. Social Media Use Policy
15. Policy Modification

Escalation Contacts:
- HR: hr@hangingpanda.com
- Management: faisal@hangingpanda.com`,
  },
  {
    sourceKey: "hr-policy-recruitment-hiring",
    title: "Recruitment and Hiring Policies",
    sourceUrl: "hr-policy.pdf",
    metadata: {
      documentType: "hr-policy",
      category: "recruitment",
      version: "v3",
    },
    content: `Keywords: recruitment, hiring, hire, interview, onboarding, job posting, selection, candidate, application, joining process, new employee, recruitment policy, hiring policy

The Recruitment and Hiring Policy provides guidelines for attracting, evaluating, and selecting candidates in a fair and consistent manner. It ensures non-discrimination, equal opportunity, and compliance with legal requirements throughout the hiring process.

Key Elements:

Job Posting:
- Transparent internal and external job advertisements.

Application Process:
- Clear steps for submitting applications and screening candidates.

Interviews:
- Structured interviews to assess qualifications and cultural fit.

Selection and Offers:
- Hiring decisions based on merit, followed by formal job offers.

Onboarding:
- New hires complete documentation and receive orientation and training.

This policy ensures a fair, efficient, and legally compliant hiring process.`,
  },
  {
    sourceKey: "hr-policy-health-safety",
    title: "Health and Safety Policies",
    sourceUrl: "hr-policy.pdf",
    metadata: {
      documentType: "hr-policy",
      category: "health-safety",
      version: "v3",
    },
    content: `Keywords: health, safety, health and safety, ergonomics, mental health, wellbeing, emergency, workplace safety, fire drill, evacuation, cybersecurity, data protection, counseling, stress management, workstation, health policy, safety policy, safe workplace

The Health and Safety Policy focuses on ensuring a safe and healthy work environment for both office and remote settings.

Key Elements:

Ergonomics:
- Guidelines for proper workstation setup to prevent strain and injury.
- Covers seating position, screen positioning, and appropriate equipment use.

Mental Health:
- Support for stress management and mental well-being.
- Initiatives include counseling services and work-life balance programs.

Cybersecurity and Data Protection:
- Ensuring safe use of IT systems to prevent security breaches.

Emergency Procedures:
- Clear plans for fire drills, evacuations, and response to data security incidents.

This policy ensures a safe, productive, and secure environment for all employees.`,
  },
  {
    sourceKey: "hr-policy-it-data-security",
    title: "Information Technology and Data Security Policies",
    sourceUrl: "hr-policy.pdf",
    metadata: {
      documentType: "hr-policy",
      category: "it-security",
      version: "v3",
    },
    content: `Keywords: IT, IT policy, data security, data protection, access control, password, password policy, cybersecurity, encryption, antivirus, firewall, incident response, breach, security breach, multi-factor authentication, MFA, VPN, information technology, data security policy

The Information Technology (IT) and Data Security Policy protects the organization's digital assets and sensitive information.

Key Components:

Access Control:
- System access is restricted to authorized personnel only.

Data Protection:
- Secure handling, storage, and transmission of sensitive data is required.

Cybersecurity Measures:
- Firewalls, encryption, and antivirus software are implemented to protect against cyber threats.

Password Management:
- Strong password policies and multi-factor authentication are enforced.

Incident Response:
- Defined procedures for reporting and addressing security breaches or data loss.

This policy safeguards company information, minimizes security risks, and supports compliance with data protection regulations.`,
  },
  {
    sourceKey: "hr-policy-anti-fraud-ethics",
    title: "Anti-Fraud and Ethics Policies",
    sourceUrl: "hr-policy.pdf",
    metadata: { documentType: "hr-policy", category: "ethics", version: "v3" },
    content: `Keywords: fraud, anti-fraud, ethics, integrity, misconduct, reporting, compliance, data manipulation, intellectual property theft, retaliation, unethical behavior, whistleblower, fraud prevention, ethics policy, ethical IT, anti-fraud policy

The Anti-Fraud and Ethics Policy ensures transparency, integrity, and ethical behavior across company operations.

Key Elements:

Fraud Prevention:
- Measures to prevent internal and external fraud such as misreporting, data manipulation, and intellectual property theft.

Ethical IT Practices:
- Guidelines for responsible use of company resources, software licensing, and adherence to data privacy laws.

Reporting Channels:
- Confidential avenues for reporting fraud or unethical behavior, with protection from retaliation.

Investigation Procedures:
- Defined steps to investigate and address reports of fraud or misconduct.

Compliance:
- All employees are expected to follow legal regulations, ethical IT standards, and company policies.

This policy safeguards company assets, promotes ethical use of technology, and maintains trust within the organization.`,
  },
  {
    sourceKey: "hr-policy-remote-work",
    title: "Remote Work Policies",
    sourceUrl: "hr-policy.pdf",
    metadata: {
      documentType: "hr-policy",
      category: "remote-work",
      version: "v3",
    },
    content: `Keywords: remote work, work from home, WFH, home office, virtual work, remote employee, remote policy, remote eligibility, remote performance, remote tools, remote communication, VPN, home setup, remote attendance, remote working

The Remote Work Policy outlines expectations for employees working outside the office.

1. Eligibility Criteria:
- Qualifications: roles or employees may be eligible based on job responsibilities, performance, and management decision.
- Trial Period: a trial period may be used to assess the suitability of remote work for both the employee and the team.

2. Work Expectations:
- Productivity Standards: performance metrics, goals, and deadlines must be clearly defined.
- Availability: employees must follow expectations around working hours, meeting attendance, and responsiveness.

3. Communication Guidelines:
- Preferred Tools: company-approved tools should be used for email, chat, and video meetings.
- Reporting: employees should report progress, issues, and achievements in the defined manner.

4. Data Security and Compliance:
- Access Control: secure access to company systems must be maintained through VPNs or secure logins.
- Confidentiality: employees must protect sensitive information and avoid unsecured networks.

5. Work Environment:
- Home Office Setup: employees should create a safe, ergonomic, and distraction-free workspace.
- Health and Safety: employees are expected to follow health and safety practices while working remotely.

6. Equipment and Technology:
- Provision of Tools: the company may specify which equipment it provides and which items employees must arrange themselves.
- Technical Support: employees should follow the defined process for IT support and issue resolution.

7. Performance Evaluation:
- Assessment Methods: remote employees are evaluated through performance reviews and feedback mechanisms.
- Goal Setting: regular discussions should ensure alignment with team and company targets.`,
  },
  {
    sourceKey: "hr-policy-disciplinary-grievance",
    title: "Disciplinary Action and Grievance Policies",
    sourceUrl: "hr-policy.pdf",
    metadata: {
      documentType: "hr-policy",
      category: "discipline-grievance",
      version: "v3",
    },
    content: `Keywords: disciplinary action, disciplinary policy, grievance, grievance policy, misconduct, complaint, appeal, verbal warning, written warning, suspension, termination, progressive discipline, harassment, discrimination, bullying, fraud, theft, investigation, retaliation, unfair treatment, favoritism, right to appeal, grievance process, disciplinary process

The Disciplinary Action and Grievance Policies provide a structured framework for addressing employee misconduct and resolving workplace disputes in a fair, transparent, and consistent manner.

━━━ DISCIPLINARY ACTION POLICY ━━━

1. Purpose and Scope:
- Maintains a professional work environment.
- Applies to all employees of HangingPanda.

2. Types of Misconduct:
- Violations of company policies or procedures.
- Insubordination or refusal to follow reasonable directives.
- Harassment, discrimination, or bullying.
- Theft or fraud.
- Breach of data security or confidentiality.

3. Progressive Discipline Process:
1. Verbal Warning: initial informal discussion addressing the issue and expectations for improvement.
2. Written Warning: formal documentation outlining the misconduct, expected improvements, and potential consequences of continued violations.
3. Suspension: temporary removal from the workplace for severe violations or repeated misconduct.
4. Termination: dismissal from the company if the issue persists or in cases of serious misconduct.

4. Investigation Procedures:
- Allegations are investigated with confidentiality and fairness.
- HR and relevant parties are involved to gather facts and assess the situation.

5. Right to Appeal:
- Employees have the right to appeal disciplinary actions through a clearly defined escalation path to a higher authority.

━━━ GRIEVANCE POLICY ━━━

1. Purpose and Scope:
- Provides a mechanism for employees to raise workplace concerns or complaints.
- Fosters a positive and respectful work environment.

2. Types of Grievances:
- Workplace harassment or discrimination.
- Policy violations by colleagues or management.
- Unfair treatment or favoritism.
- Issues related to job performance evaluations.

3. Reporting Process:
- Informal Resolution: employees are encouraged to address issues directly with the involved parties where appropriate.
- Formal Complaint: submit a written grievance to HR at hr@hangingpanda.com or management at faisal@hangingpanda.com, outlining the issue and desired resolution.

4. Investigation and Resolution:
- Grievances are investigated in a timely, confidential, and impartial manner.
- HR will communicate findings and proposed resolutions to the involved parties.

5. Follow-Up and Monitoring:
- Regular follow-ups are conducted to ensure the resolution is effective.
- No retaliation should occur against the employee who filed the grievance.

6. Protection Against Retaliation:
- Employees will not face retaliation for reporting grievances or participating in investigations.`,
  },
  {
    sourceKey: "hr-policy-working-hours-attendance",
    title: "Working Hours and Attendance Policies",
    sourceUrl: "hr-policy.pdf",
    metadata: {
      documentType: "hr-policy",
      category: "attendance",
      version: "v3",
    },
    content: `Keywords: working hours, attendance, office timing, office hours, office time, biometric, standup, EOD report, end of day report, weekend, work week, 40 hours, paid leave, PL, sick leave, SL, leave balance, variable hours, time tracking, working time, attendance policy, working hours policy, office attendance

Working Hours and Attendance Policy defines expectations for all employees regarding attendance, timings, and leave entitlements.

1. Working Hours:
- Standard Work Week: 40 hours per week.
- Standard Timing: 10:00 AM or 10:30 AM to 07:00 PM or 07:30 PM (exact timing depends on assignment), with 40 minutes for lunch and a 20-minute refreshment break.
- Variable Work Time: some employees may be assigned different working hours depending on work requirements, management decision, or client time zone.
- Weekend Policy: Saturdays and Sundays are normally off. In emergencies, employees may be asked to work on weekends — extra working days will be paid.

2. Attendance Tracking:
- Time Tracking Tools: software may be used to track working hours, projects, and productivity.
- Biometric Systems: biometric attendance (fingerprint or facial recognition) may be used. If biometric is not working, management must be informed immediately.
- Self-Reporting: employees must post proper standup updates in the assigned work channel and provide an end-of-day (EOD) report.

3. Leave Entitlements:
- Paid Leave (PL): 12 days of earned annual leave per year. Available only after completion of probation period. One leave earned per month. Advance leave is not allowed if balance is zero.
- Sick Leave (SL): 9 sick leaves annually. Allowed during probation period. More than 2 consecutive sick leaves require a medical certificate.
- Holiday Schedule: a list of company-observed public holidays is provided separately.
- Remote Work: remote attendance and working hour practices follow the Remote Work Policy.`,
  },
  {
    sourceKey: "hr-policy-leave-deduction-salary",
    title: "Leave Deduction and Salary Policy",
    sourceUrl: "hr-policy.pdf",
    metadata: { documentType: "hr-policy", category: "leave", version: "v3" },
    content: `Keywords: leave, leave policy, leave deduction, salary deduction, unpaid leave, annual leave, sick leave, paid leave, PL, SL, NCNS, no call no show, leave encashment, carry over, salary confidentiality, leave without approval, leave balance, per day deduction, double deduction, uninformed absence, unapproved leave, leave salary impact

The Leave Deduction and Salary Policy explains how different types of leave affect leave balances and salary.

Leave Entitlements Summary:
- Paid Leave (PL): 12 days per year, earned at 1 day per month. Available only after probation. No advance leave if balance is zero.
- Sick Leave (SL): 9 days per year. Available during probation. More than 2 consecutive sick leaves require a medical certificate.

1. Annual Leave Deduction:
- Annual leave is deducted based on actual working days taken off.
- If leave is taken around weekends or public holidays, the entire period may be counted as leave under the Sandwich Leave Policy.

2. Sick Leave Deduction:
- If sick leave balance is exhausted, additional days are deducted from annual leave or treated as unpaid leave.
- Absence of more than 2 consecutive days must be supported by a medical certificate.

3. Unpaid Leave Deduction:
- After all paid leave balances (annual and sick) are exhausted, any additional leave is treated as unpaid.
- Salary is deducted proportionally on a per-day basis.

4. Leave Without Approval but Informed:
- Absence without prior approval but where the employee has informed the company is treated as unpaid leave.
- Salary is deducted on a per-day basis accordingly.

5. Leave Without Approval and Uninformed — No Call No Show (NCNS):
- Absence where the employee neither sought approval nor informed the company is treated as No Call No Show (NCNS).
- Salary is deducted at TWICE (double) the usual per-day rate.

6. Leave Encashment and Carry Over:
- There is NO leave encashment at financial year end for any kind of leave.
- Leave balances do NOT carry over to the next financial year. Unused leave is forfeited at year end.

7. Salary Confidentiality:
- Employees must keep compensation details strictly confidential.
- Discussion or disclosure of salary details with other employees is strictly prohibited.
- Breach of this rule may be treated as misconduct and may lead to disciplinary action.

General Notes:
- Employees should plan leave in advance.
- Annual leave will not be entertained if not informed in advance.
- Contact hr@hangingpanda.com for any leave or salary queries.`,
  },
  {
    sourceKey: "hr-policy-sandwich-leave",
    title: "Sandwich Leave Policy",
    sourceUrl: "hr-policy.pdf",
    metadata: { documentType: "hr-policy", category: "leave", version: "v3" },
    content: `Keywords: sandwich leave, sandwich, leave around holiday, leave around weekend, public holiday leave, leave deduction, holiday counting, extended leave, consecutive leave, sandwich rule, leave before holiday, leave after holiday, leave spanning weekend

Purpose: To clarify the treatment of leave taken around weekends and public holidays.

Definition:
Sandwich leave refers to leave taken immediately before and/or after a public holiday or weekend, extending the employee's time off. In such cases, the intervening weekend or holiday days are also counted as leave.

Policy Guidelines:

1. Leave Deduction Rule:
- If an employee takes leave on the working days immediately before AND after a public holiday or weekend, the entire duration — including the public holiday and weekend — is counted as leave.
- Example: if a public holiday falls on Friday and the employee takes leave on Thursday and the following Monday → leave counted = Thursday, Friday (holiday), Saturday, Sunday, Monday = 5 days deducted.

2. Public Holidays During Existing Leave:
- If an employee is already on approved leave and a public holiday falls within that leave period, the public holiday is NOT counted against the leave balance.
- Example: employee on leave Mon–Fri, Wednesday is a public holiday → only 4 days (Mon, Tue, Thu, Fri) are deducted.

3. Exceptions — Sandwich Rule Does NOT Apply:
- During official company-approved travel.
- During approved long-term leave such as sick leave.

4. Request Process:
- Employees should submit leave requests in advance and check how their leave may affect their overall leave balance before applying.`,
  },
  {
    sourceKey: "hr-policy-increment",
    title: "Annual or Performance-Based Increment Policy",
    sourceUrl: "hr-policy.pdf",
    metadata: {
      documentType: "hr-policy",
      category: "compensation",
      version: "v3",
    },
    content: `Keywords: increment, salary increment, salary hike, hike, appraisal, performance review, salary revision, raise, annual increment, mid-term revision, delayed revision, internship exclusion, management discretion, increment conditions, increment eligibility, disciplinary impact on increment, performance-based increment, increment policy, when will I get increment, automatic increment

Objective: To recognize and reward employee contributions through a structured salary increment process based on individual performance and company growth.

Policy Statement:
Salary increments are NOT automatic. They may be awarded based on:
- Individual performance and achievements.
- Role-specific responsibilities and results.
- Departmental and organizational goals.
- Feedback from reporting managers.
- Market competitiveness and budget availability.

Types of Increments:

1. Annual Increments:
- Employees are eligible for a performance review on an annual basis.
- Based on the evaluation, an increment may be offered at the sole discretion of management.

2. Mid-Term or Delayed Revision:
- If an annual increment is not awarded, a salary revision may be considered within 12 to 18 months from the date of joining or the date of the last revision.
- This is based on consistent performance and a recommendation from the reporting manager.

Conditions for Increment Eligibility:

1. Minimum Service Requirement:
- Employees must complete at least 12 months of continuous service to be eligible for an annual review, unless management specifies otherwise.

2. Impact of Disciplinary Issues:
- Unsatisfactory performance or disciplinary issues may result in delay, reduction, or denial of an increment.

3. Management Discretion:
- All increment decisions are at the sole discretion of management and are subject to business needs and financial performance.

Important Note — Internship Period Exclusion:
- The duration of an internship or training period is NOT counted for salary increment or performance review eligibility.
- Only the period served as a full-time employee from the official date of appointment counts toward salary revisions, appraisals, and other employment-related benefits.`,
  },
  {
    sourceKey: "hr-policy-sexual-harassment",
    title: "Sexual Harassment Clause",
    sourceUrl: "hr-policy.pdf",
    metadata: { documentType: "hr-policy", category: "conduct", version: "v3" },
    content: `Keywords: sexual harassment, harassment, POSH, unwelcome behavior, physical contact, sexual favors, sexually colored remarks, pornography, disciplinary action, termination, false complaint, harassment reporting, harassment policy, workplace harassment

Definition:
Sexual harassment includes one or more of the following unwelcome acts or behaviors, whether direct or implied:
- Physical contact or advances.
- A demand or request for sexual favors.
- Making sexually colored remarks.
- Showing pornography.
- Any other unwelcome physical, verbal, or non-verbal conduct of a sexual nature.

Company Commitment:
The company is committed to providing a workplace free from harassment and discrimination where every employee is treated with dignity and respect.

Employee Responsibilities:
- All employees have a personal responsibility to ensure their own behavior does not violate this clause.
- All employees are encouraged to help reinforce a work environment free from sexual harassment.

Complaints and Investigations:
- Making a knowingly false complaint is subject to disciplinary or corrective action.
- However, failure to prove a claim does NOT in itself constitute proof that the complaint was false or malicious.

Consequences:
- Sexual harassment is strictly prohibited in the workplace, by any employee, in any form.
- Violations are subject to disciplinary action and may result in suspension or termination of services.

Reporting:
- Employees may report concerns to HR at hr@hangingpanda.com or management at faisal@hangingpanda.com.`,
  },
  {
    sourceKey: "hr-policy-notice-termination",
    title: "Notice Period and Termination",
    sourceUrl: "hr-policy.pdf",
    metadata: {
      documentType: "hr-policy",
      category: "termination",
      version: "v3",
    },
    content: `Keywords: notice period, termination, resignation, FNF, full and final settlement, full and final, absconding, relieving, salary in lieu, misconduct termination, voluntary termination, 7 days, 40 days, deemed resignation, exit, leaving company, notice period policy, termination policy, how to resign, relieving letter, last working day

Notice and termination rules are as follows:

1. Standard Notice Period (Post-Probation):
- Services are terminable by giving one or two months' notice after successful completion of probation, depending on roles and responsibilities.
- The applicable notice period is discussed at the time of joining or at the time of increment.

2. Salary in Lieu of Notice:
- After satisfactory completion of probation and written confirmation, either the employee or the company may terminate by giving one month's notice OR by paying one month's salary in lieu of notice.
- This option applies on either side (both employee and company).
- This does NOT apply in misconduct-related situations.

3. Absence Beyond Approved Leave — Deemed Resignation:
- If an employee is absent without leave or remains absent beyond the approved leave period, the company may treat the employee as having voluntarily terminated employment without notice.
- The employee must return within 7 days from the start of such absence and provide a satisfactory explanation to management to avoid this outcome.

4. Termination Without Notice (Misconduct):
- Services may be terminated without any notice or salary in lieu in cases of:
  - Misconduct
  - Disloyalty
  - Acts involving moral turpitude
  - Indiscipline
  - Inefficiency
  - Any other serious misconduct as determined by management.

5. Management Authority During Notice Period:
- Management is fully authorized to relieve an employee at any time during the notice period.
- If misconduct occurs during the notice period, the employee is not entitled to salary or allowances for the remaining notice period.

6. Incorrect Information at Joining:
- If any information provided at the time of joining is withheld or found to be incorrect, the appointment is deemed irregular.
- The company may terminate such employment without notice at any time.

7. Full and Final Settlement (FNF):
- Full and Final Settlement is processed 40 days after the employee's last working day.`,
  },
  {
    sourceKey: "hr-policy-mobile-device",
    title: "Mobile Device Use Policy",
    sourceUrl: "hr-policy.pdf",
    metadata: {
      documentType: "hr-policy",
      category: "device-use",
      version: "v3",
    },
    content: `Keywords: mobile device, mobile phone, phone, personal phone, company phone, device policy, silent mode, work device, prohibited mobile use, gaming, social media on phone, endorsement, mobile policy, phone policy, phone during work, personal device

Employees are expected to use personal and company-provided mobile devices responsibly.

1. Personal Device Use:
- Keep personal calls, texts, and social media browsing to a minimum during work hours.
- Ensure mobile devices are on silent mode during meetings and collaborative sessions.

2. Company-Issued Devices:
- Use company-provided devices for work purposes only.
- Follow data security protocols such as password protection and VPN usage.

3. Prohibited Actions:
- Do not use mobile devices for non-work activities such as watching movies, videos, social media browsing, or playing mobile games during work time, as these cause distraction and productivity loss.
- Do not endorse third-party products or services without proper company approval.`,
  },
  {
    sourceKey: "hr-policy-social-media",
    title: "Social Media Use Policy",
    sourceUrl: "hr-policy.pdf",
    metadata: {
      documentType: "hr-policy",
      category: "social-media",
      version: "v3",
    },
    content: `Keywords: social media, LinkedIn, Instagram, Twitter, Facebook, posting, company reputation, endorsement, third party, defamatory, confidential information, authorized posting, PR, marketing approval, social media policy, online posting, company social media, personal social media

The use of social media, whether personal or work-related, must align with the company's values and brand image.

1. Personal Social Media:
- Employees may express personal opinions but must avoid posting anything that may harm the company's reputation.
- Employees must never share confidential company information, client data, or proprietary work on social media.

2. Company-Related Social Media:
- Only authorized personnel may post on behalf of the company.
- All work-related social media content must be pre-approved by the marketing or PR team before posting.

3. Prohibited Actions:
- Engaging in arguments or making defamatory comments about the company, clients, or competitors on social media is strictly prohibited.
- Endorsing third-party products or services without proper company approval is prohibited.`,
  },
  {
    sourceKey: "hr-policy-policy-modification",
    title: "Policy Modification",
    sourceUrl: "hr-policy.pdf",
    metadata: {
      documentType: "hr-policy",
      category: "governance",
      version: "v3",
    },
    content: `Keywords: policy modification, policy change, policy update, amendment, review, notification, effective date, acknowledgment, HR portal, employee handbook, policy revision, update policy, change in policy

Purpose: To outline the process for modifying company policies and informing employees about any changes.

1. Authority for Modification:
- The authority to modify company policies lies with the responsible department or management as designated by the company.
- Changes are made to align with legal requirements, business needs, and employee welfare.

2. Review Process:
- Policies are reviewed annually or as needed based on changes in law, regulation, or company operations.
- Feedback from employees and managers may be collected during the review to ensure effectiveness and relevance.

3. Notification of Changes:
- Employees are notified of policy changes through official communications such as email, meetings, or announcements.
- Updated policies are documented in the employee handbook and made accessible through internal channels such as the intranet or HR portal.

4. Effective Date:
- Each policy change has a specified effective date communicated alongside the change notice.
- Employees are expected to follow the modified policy from that effective date onward.

5. Acknowledgment of Changes:
- Employees may be required to acknowledge receipt and understanding of modified policies through signed or electronic confirmation.
- HR maintains a record of acknowledgment.

General Closing:
All members are bound by the rules and regulations of the company and are expected to acknowledge acceptance of the policy.`,
  },
];
