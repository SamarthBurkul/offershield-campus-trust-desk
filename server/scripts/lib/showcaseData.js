'use strict';

/**
 * Content of the "Demo Institute of Technology" showcase college. Everything here is invented:
 * people are fictional, and every scam contact is deliberately fake so it never points at a real
 * third party - impersonation domains end in "-demo.xyz", UPI handles contain "demo" and phone
 * numbers use the placeholder pattern +91 90000 0000X. Real company names appear only as the
 * college's verified recruiters (with their official domains) and as brands that scammers claim.
 */

const COLLEGE = Object.freeze({
  code: 'demo-campus',
  name: 'Demo Institute of Technology',
  domain: 'demo-campus.edu',
  // Public demo value, printed by the script. Not a secret: it only opens the demo college.
  joinCode: 'CAMPUS-DEMO-2026',
  branches: ['COMP', 'IT', 'EXTC', 'MECH'],
});

const STAFF = Object.freeze([
  { key: 'head', role: 'tpo_head', name: 'Dr. Meera Kulkarni', email: 'tpo.head@demo-campus.edu' },
  { key: 'rahul', role: 'placement_officer', name: 'Rahul Deshpande', email: 'rahul.deshpande@demo-campus.edu' },
  { key: 'sneha', role: 'placement_officer', name: 'Sneha Iyer', email: 'sneha.iyer@demo-campus.edu' },
]);

// 24 students: 6 per branch, years 2-4.
const STUDENT_NAMES = [
  ['Aarav Sharma', 'COMP', 4], ['Diya Patel', 'COMP', 4], ['Kabir Mehta', 'COMP', 3],
  ['Ananya Rao', 'COMP', 3], ['Vihaan Joshi', 'COMP', 2], ['Isha Nair', 'COMP', 2],
  ['Arjun Reddy', 'IT', 4], ['Saanvi Gupta', 'IT', 4], ['Rohan Kulkarni', 'IT', 3],
  ['Meera Pillai', 'IT', 3], ['Aditya Singh', 'IT', 2], ['Kavya Menon', 'IT', 2],
  ['Nikhil Verma', 'EXTC', 4], ['Pooja Shetty', 'EXTC', 4], ['Siddharth Jain', 'EXTC', 3],
  ['Riya Banerjee', 'EXTC', 3], ['Yash Patil', 'EXTC', 2], ['Tanvi Desai', 'EXTC', 2],
  ['Harsh Chauhan', 'MECH', 4], ['Neha Kapoor', 'MECH', 4], ['Omkar Pawar', 'MECH', 3],
  ['Shreya Das', 'MECH', 3], ['Pranav Iyer', 'MECH', 2], ['Aditi Mishra', 'MECH', 2],
];

const STUDENTS = Object.freeze(
  STUDENT_NAMES.map(([name, branch, year], index) => ({
    key: `s${index + 1}`,
    role: 'student',
    name,
    branch,
    year,
    email: `${name.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, '.')}@demo-campus.edu`,
  })),
);

const CHECK_NOTE = 'Checked against the official careers page and called the published HR number before campus approval.';

const RECRUITERS = Object.freeze([
  {
    key: 'infosys',
    companyName: 'Infosys',
    domains: ['infosys.com'],
    contactEmails: ['campus.hr@infosys.com'],
    methods: ['checked_official_careers_page', 'called_official_number', 'prior_campus_drive'],
    evidenceNote: `${CHECK_NOTE} Campus drive held in the previous academic year.`,
    status: 'verified',
  },
  {
    key: 'tcs',
    companyName: 'TCS',
    domains: ['tcs.com'],
    contactEmails: ['campus.hr@tcs.com'],
    methods: ['matched_official_domain', 'contacted_company_hr', 'prior_campus_drive'],
    evidenceNote: `${CHECK_NOTE} National Qualifier Test invitations come only from this domain.`,
    status: 'verified',
  },
  {
    key: 'accenture',
    companyName: 'Accenture',
    domains: ['accenture.com'],
    contactEmails: ['campus.hr@accenture.com'],
    methods: ['checked_official_careers_page', 'matched_official_domain'],
    evidenceNote: `${CHECK_NOTE} Offer letters are issued through the official candidate portal only.`,
    status: 'verified',
  },
  {
    key: 'persistent',
    companyName: 'Persistent Systems',
    domains: ['persistent.com'],
    contactEmails: [],
    methods: ['checked_official_careers_page'],
    evidenceNote: 'Proposed by the placement officer after an alumni referral; awaiting TPO head verification.',
    status: 'pending',
  },
  {
    key: 'capgemini',
    companyName: 'Capgemini',
    domains: ['capgemini.com'],
    contactEmails: [],
    methods: ['prior_campus_drive', 'checked_official_careers_page'],
    evidenceNote: 'Verified for the previous placement season; renewal is due before the next drive.',
    status: 'expired',
  },
]);

// Clearly fictional scam contacts.
const FAKE = Object.freeze({
  technovaUpi: 'technova.hr.demo@okaxis',
  technovaDomain: 'technova-careers-demo.xyz',
  technovaPhone: '+91 90000 00001',
  taskUpiA: 'taskreward.demo@ybl',
  taskUpiB: 'dailytask.demo@paytm',
  taskUpiC: 'vip.tasks.demo@ibl',
  accentureFakeDomain: 'accenture-hiring-demo.xyz',
  accentureFakeEmail: 'offers@accenture-hiring-demo.xyz',
  infosysKitDomain: 'infosys-training-demo.xyz',
  infosysKitUpi: 'infy.kit.demo@ybl',
  quickhireEmail: 'hr@quickhire-analytics-demo.xyz',
  courierPhone: '+91 90000 00002',
  dataEntryPhone: '+91 90000 00003',
  cryptoUpi: 'coinintern.demo@axl',
});

const TASK_TEXT = (amount, upi) =>
  `Hello! You are selected for our online part time job. Just like YouTube videos and follow Instagram pages and earn Rs 3000 to Rs 5000 daily. ` +
  `First 3 tasks are free. To unlock VIP tasks pay Rs ${amount} refundable activation amount to ${upi} and send screenshot on Telegram. ` +
  `Offer valid only today, limited seats.`;

/**
 * Cases in chronological order. `day` = days ago the request was submitted; each step runs `h` hours later.
 * Step kinds: assign, review, info, reply, staffMessage, note, recommend, decide, reopen, evidence.
 */
const CASES = Object.freeze([
  {
    key: 'c01',
    student: 's1',
    day: 41,
    input: {
      claimedCompany: 'TechNova Solutions',
      roleTitle: 'Graduate Engineer Trainee',
      channel: 'whatsapp',
      messageText:
        `Congratulations! You have been shortlisted for TechNova Solutions GET program with 6.5 LPA package. ` +
        `To confirm your interview slot pay Rs 1,499 registration fee to ${FAKE.technovaUpi} within 24 hours. ` +
        `Details at https://${FAKE.technovaDomain}/register. HR desk ${FAKE.technovaPhone}.`,
      links: [`https://${FAKE.technovaDomain}/register`],
      contacts: { emails: [], phones: [FAKE.technovaPhone], upiIds: [FAKE.technovaUpi] },
      moneyRequested: { requested: true, amount: 1499, purpose: 'registration' },
      paidAlready: false,
      documentsShared: false,
      studentNote: 'I never applied to this company. The message came from an unknown number.',
    },
    evidence: ['png'],
    steps: [
      { h: 3, kind: 'assign', by: 'head', to: 'rahul' },
      { h: 5, kind: 'note', by: 'rahul', body: 'Domain registered 9 days ago, no company of this name on the MCA portal. UPI handle is a personal account.' },
      { h: 20, kind: 'recommend', by: 'rahul', type: 'confirmed_fraud', basis: 'Brand-new domain, personal UPI handle, fee before interview. Matches the classic registration-fee scam.' },
      {
        h: 26,
        kind: 'decide',
        by: 'head',
        decision: {
          type: 'confirmed_fraud',
          basis: 'No registered company, domain created days before the message, and a fee demanded before any interview. Same UPI handle reported on other campuses.',
          checks: ['mca_or_gst_lookup', 'reviewed_student_evidence'],
          studentMessage: 'This offer is fraudulent. Do not pay anything and block the sender. Thank you for checking with us first.',
          confirmedIndicators: [
            { type: 'upi', value: FAKE.technovaUpi },
            { type: 'domain', value: FAKE.technovaDomain },
          ],
        },
      },
    ],
  },
  {
    key: 'c02',
    student: 's7',
    day: 38,
    input: {
      claimedCompany: 'TechNova Solutions',
      roleTitle: 'Software Trainee',
      channel: 'telegram',
      messageText: `TechNova Solutions hiring freshers. Interview confirmation fee Rs 1,499 to ${FAKE.technovaUpi}. Pay today to block your slot.`,
      contacts: { emails: [], phones: [], upiIds: [FAKE.technovaUpi] },
      moneyRequested: { requested: true, amount: 1499, purpose: 'registration' },
      paidAlready: false,
      documentsShared: false,
    },
    steps: [
      { h: 4, kind: 'assign', by: 'head', to: 'rahul' },
      { h: 6, kind: 'note', by: 'rahul', body: 'Same UPI handle and fee as the TechNova case decided earlier this week.' },
      {
        h: 8,
        kind: 'decide',
        by: 'head',
        decision: {
          type: 'dismissed',
          basis: 'Duplicate of the TechNova registration-fee case, which is already decided as fraud.',
          dismissReason: 'duplicate',
          duplicateOf: 'c01',
          studentMessage: 'We already reviewed this offer: it is fraudulent. Do not pay and block the sender.',
        },
      },
    ],
  },
  {
    key: 'c03',
    student: 's9',
    day: 34,
    input: {
      claimedCompany: 'TCS',
      roleTitle: 'Ninja - Assistant System Engineer',
      channel: 'email',
      messageText:
        'Dear candidate, you are invited to the TCS National Qualifier Test campus slot on Saturday. Please register on the official portal and carry your college ID. No fee is charged at any stage.',
      contacts: { emails: ['campus.hr@tcs.com'], phones: [], upiIds: [] },
      moneyRequested: { requested: false },
      paidAlready: false,
      documentsShared: false,
      studentNote: 'Looks genuine but I want to be sure before registering.',
    },
    steps: [
      { h: 2, kind: 'assign', by: 'head', to: 'sneha' },
      { h: 6, kind: 'note', by: 'sneha', body: 'Sender domain is tcs.com and matches the verified recruiter. NQT dates match the official page.' },
      { h: 7, kind: 'recommend', by: 'sneha', type: 'verified_genuine', basis: 'Official domain, no fee, consistent with the published NQT schedule.' },
      {
        h: 9,
        kind: 'decide',
        by: 'head',
        decision: {
          type: 'verified_genuine',
          basis: 'Sender uses the official tcs.com domain, the invitation matches the published NQT schedule, and no payment is requested.',
          checks: ['matched_official_domain', 'checked_official_careers_page'],
          studentMessage: 'This invitation matches what TCS publishes officially. Register only on the official portal, never pay anyone.',
          verifiedDomains: ['tcs.com'],
        },
      },
    ],
  },
  {
    key: 'c04',
    student: 's13',
    day: 31,
    input: {
      claimedCompany: 'StarLink Digital Media',
      roleTitle: 'Work from home task executive',
      channel: 'telegram',
      messageText: TASK_TEXT('1,999', FAKE.taskUpiA),
      contacts: { emails: [], phones: [], upiIds: [FAKE.taskUpiA] },
      moneyRequested: { requested: true, amount: 1999, purpose: 'other' },
      paidAlready: true,
      documentsShared: false,
      studentNote: 'I paid 1,999 after doing three free tasks. Now they ask for 5,000 more to withdraw.',
    },
    evidence: ['png', 'pdf'],
    steps: [
      { h: 1, kind: 'assign', by: 'head', to: 'sneha' },
      { h: 2, kind: 'staffMessage', by: 'sneha', body: 'Please do not pay anything more. Call 1930 (cyber crime helpline) and report the payment today.' },
      { h: 5, kind: 'recommend', by: 'sneha', type: 'confirmed_fraud', basis: 'Telegram task scam: small free tasks, then an unlock fee, then a withdrawal fee.' },
      {
        h: 9,
        kind: 'decide',
        by: 'head',
        decision: {
          type: 'confirmed_fraud',
          basis: 'Classic Telegram task scam: earnings shown for free tasks, then an activation payment and a further withdrawal fee. Payee is a personal UPI handle.',
          checks: ['reviewed_student_evidence', 'other'],
          studentMessage: 'This is a task scam. Do not pay again. Report the payment on cybercrime.gov.in or call 1930 and keep your screenshots.',
          confirmedIndicators: [{ type: 'upi', value: FAKE.taskUpiA }],
        },
      },
    ],
  },
  {
    key: 'c05',
    student: 's10',
    day: 27,
    input: {
      claimedCompany: 'QuickHire Analytics',
      roleTitle: 'Data Analyst Intern',
      channel: 'linkedin',
      messageText:
        `Hi, we liked your profile. QuickHire Analytics offers a 3 month paid internship with stipend 15k. Send your resume and a scanned ID to ${FAKE.quickhireEmail} for onboarding.`,
      contacts: { emails: [FAKE.quickhireEmail], phones: [], upiIds: [] },
      moneyRequested: { requested: false },
      paidAlready: false,
      documentsShared: true,
    },
    steps: [
      { h: 5, kind: 'assign', by: 'head', to: 'rahul' },
      { h: 8, kind: 'info', by: 'rahul', message: 'Which ID document did you send them, and did they ask for any payment or OTP later?' },
      { h: 30, kind: 'reply', body: 'I sent my college ID only. They have not asked for money yet but stopped replying.' },
      { h: 34, kind: 'note', by: 'rahul', body: 'Company exists on LinkedIn with 3 employees, no website. Cannot confirm either way.' },
      {
        h: 40,
        kind: 'decide',
        by: 'head',
        decision: {
          type: 'inconclusive',
          basis: 'Could not confirm the company or the role; no money requested so far.',
          studentMessage: 'We could not confirm this internship. Do not share more documents and tell us if they ask for money or an OTP.',
        },
      },
    ],
  },
  {
    key: 'c06',
    student: 's19',
    day: 24,
    input: {
      claimedCompany: 'Accenture',
      roleTitle: 'Associate Software Engineer',
      channel: 'email',
      messageText:
        `Dear student, Accenture is pleased to offer you the role of Associate Software Engineer. Before issuing the offer letter please pay a refundable security deposit of Rs 4,500 for laptop allocation. Reply to ${FAKE.accentureFakeEmail}.`,
      links: [`https://${FAKE.accentureFakeDomain}/offer`],
      contacts: { emails: [FAKE.accentureFakeEmail], phones: [], upiIds: [] },
      moneyRequested: { requested: true, amount: 4500, purpose: 'security_deposit' },
      paidAlready: false,
      documentsShared: false,
    },
    evidence: ['pdf'],
    steps: [
      { h: 2, kind: 'assign', by: 'head', to: 'sneha' },
      { h: 4, kind: 'note', by: 'sneha', body: 'Look-alike of accenture.com. The real recruiter never charges a deposit.' },
      { h: 6, kind: 'recommend', by: 'sneha', type: 'confirmed_fraud', basis: 'Impersonation domain that imitates the verified Accenture domain, plus a deposit demand.' },
      {
        h: 30,
        kind: 'decide',
        by: 'head',
        decision: {
          type: 'confirmed_fraud',
          basis: 'Look-alike domain of the verified accenture.com and a refundable deposit demand, which the company never asks for.',
          checks: ['matched_official_domain', 'checked_official_careers_page'],
          studentMessage: 'This is not from Accenture. It is an impersonation scam. Do not pay the deposit and do not reply.',
          confirmedIndicators: [
            { type: 'domain', value: FAKE.accentureFakeDomain },
            { type: 'email', value: FAKE.accentureFakeEmail },
          ],
        },
      },
    ],
  },
  {
    key: 'c07',
    student: 's3',
    day: 18,
    input: {
      claimedCompany: 'Infosys',
      roleTitle: 'Systems Engineer Trainee',
      channel: 'whatsapp',
      messageText:
        `Infosys onboarding team: buy the mandatory training kit (laptop bag, ID card, study material) for Rs 2,999 before joining. Pay to ${FAKE.infosysKitUpi} and fill the form at https://${FAKE.infosysKitDomain}/kit.`,
      links: [`https://${FAKE.infosysKitDomain}/kit`],
      contacts: { emails: [], phones: [], upiIds: [FAKE.infosysKitUpi] },
      moneyRequested: { requested: true, amount: 2999, purpose: 'training' },
      paidAlready: false,
      documentsShared: false,
    },
    steps: [
      { h: 3, kind: 'assign', by: 'head', to: 'rahul' },
      {
        h: 20,
        kind: 'decide',
        by: 'head',
        decision: {
          type: 'inconclusive',
          basis: 'Only a forwarded message without sender details; could not tell who sent it.',
          studentMessage: 'We could not confirm this message. Do not pay anything until we know more. Reply if you have the sender details.',
        },
      },
      {
        h: 70,
        kind: 'reopen',
        by: 'head',
        reason: 'Student came to the desk with the full chat showing a UPI demand and a look-alike Infosys domain. Needs a fresh review.',
      },
      { h: 74, kind: 'evidence', files: ['png'] },
      { h: 75, kind: 'reply', body: 'I have uploaded the full WhatsApp chat. They keep asking me to pay for the kit before Friday.' },
      { h: 80, kind: 'note', by: 'rahul', body: 'Domain imitates infosys.com; verified recruiter says training kits are never sold.' },
      { h: 84, kind: 'recommend', by: 'rahul', type: 'confirmed_fraud', basis: 'Look-alike of the verified Infosys domain with a mandatory kit purchase.' },
    ],
  },
  {
    key: 'c08',
    student: 's15',
    day: 9,
    input: {
      claimedCompany: 'TechNova Solutions',
      roleTitle: 'Trainee Engineer',
      channel: 'sms',
      messageText: `TechNova: final round shortlisted. Pay Rs 1,499 slot fee to ${FAKE.technovaUpi} to attend. Call ${FAKE.technovaPhone}.`,
      contacts: { emails: [], phones: [FAKE.technovaPhone], upiIds: [FAKE.technovaUpi] },
      moneyRequested: { requested: true, amount: 1499, purpose: 'registration' },
      paidAlready: false,
      documentsShared: false,
    },
    steps: [
      { h: 2, kind: 'assign', by: 'head', to: 'rahul' },
      { h: 3, kind: 'note', by: 'rahul', body: 'UPI handle already in the confirmed fraud registry. Recommend closing as fraud after the student confirms the sender.' },
    ],
  },
  {
    key: 'c09',
    student: 's16',
    day: 6,
    input: {
      claimedCompany: 'StarLink Digital Media',
      roleTitle: 'Online task partner',
      channel: 'telegram',
      messageText: TASK_TEXT('2,499', FAKE.taskUpiB),
      contacts: { emails: [], phones: [], upiIds: [FAKE.taskUpiB] },
      moneyRequested: { requested: true, amount: 2499, purpose: 'other' },
      paidAlready: false,
      documentsShared: false,
    },
    steps: [
      { h: 3, kind: 'assign', by: 'head', to: 'sneha' },
      { h: 5, kind: 'info', by: 'sneha', message: 'Did you pay anything or share an OTP? Please upload the full Telegram chat if you still have it.' },
    ],
  },
  {
    key: 'c10',
    student: 's21',
    day: 5,
    input: {
      claimedCompany: 'BlueDart Logistics Careers',
      roleTitle: 'Operations Intern',
      channel: 'phone_call',
      messageText: `Caller said I was selected for an operations internship and must pay Rs 850 courier charges for the joining kit. Number ${FAKE.courierPhone}.`,
      contacts: { emails: [], phones: [FAKE.courierPhone], upiIds: [] },
      moneyRequested: { requested: true, amount: 850, purpose: 'equipment' },
      paidAlready: false,
      documentsShared: false,
    },
    steps: [
      { h: 6, kind: 'assign', by: 'head', to: 'rahul' },
      { h: 7, kind: 'info', by: 'rahul', message: 'Did they send anything in writing (email, SMS or WhatsApp)? Please share a screenshot.' },
    ],
  },
  {
    key: 'c11',
    student: 's5',
    day: 3,
    input: {
      claimedCompany: 'CoinIntern Labs',
      roleTitle: 'Blockchain Intern',
      channel: 'instagram',
      messageText: `Paid crypto internship, earn while you learn. Deposit Rs 3,000 to ${FAKE.cryptoUpi} to receive the starter wallet and training access.`,
      contacts: { emails: [], phones: [], upiIds: [FAKE.cryptoUpi] },
      moneyRequested: { requested: true, amount: 3000, purpose: 'training' },
      paidAlready: false,
      documentsShared: false,
    },
    steps: [
      { h: 4, kind: 'assign', by: 'head', to: 'sneha' },
      { h: 6, kind: 'note', by: 'sneha', body: 'No registered entity. Waiting for the student to share the Instagram profile link.' },
      { h: 8, kind: 'recommend', by: 'sneha', type: 'confirmed_fraud', basis: 'Deposit before training, crypto wallet bait, no registered company.' },
    ],
  },
  {
    key: 'c12',
    student: 's12',
    day: 2,
    input: {
      claimedCompany: 'StarLink Digital Media',
      roleTitle: 'Part time task job',
      channel: 'telegram',
      messageText: TASK_TEXT('999', FAKE.taskUpiC),
      contacts: { emails: [], phones: [], upiIds: [FAKE.taskUpiC] },
      moneyRequested: { requested: true, amount: 999, purpose: 'other' },
      paidAlready: false,
      documentsShared: false,
    },
    evidence: ['png'],
    steps: [],
  },
  {
    key: 'c13',
    student: 's22',
    day: 1,
    input: {
      claimedCompany: 'Sunrise Data Entry Services',
      roleTitle: 'Data entry operator',
      channel: 'whatsapp',
      messageText: `Home based data entry job, 25,000 per month. Registration and ID card charges Rs 1,200 only. Contact ${FAKE.dataEntryPhone}.`,
      contacts: { emails: [], phones: [FAKE.dataEntryPhone], upiIds: [] },
      moneyRequested: { requested: true, amount: 1200, purpose: 'registration' },
      paidAlready: false,
      documentsShared: false,
    },
    steps: [],
  },
  {
    key: 'c14',
    student: 's2',
    day: 0.3,
    input: {
      claimedCompany: 'Infosys',
      roleTitle: 'Specialist Programmer',
      channel: 'email',
      messageText: 'Invitation to the Infosys HackWithInfy online round. Register on the official Infosys careers site. There is no registration fee.',
      contacts: { emails: ['campus.hr@infosys.com'], phones: [], upiIds: [] },
      moneyRequested: { requested: false },
      paidAlready: false,
      documentsShared: false,
    },
    steps: [],
  },
]);

const ADVISORIES = Object.freeze({
  published: {
    title: 'Fake "TechNova Solutions" registration-fee offers',
    severity: 'critical',
    target: { years: [3, 4], branches: [] },
    body:
      'Several students received WhatsApp, Telegram and SMS messages from "TechNova Solutions" offering a trainee role and asking for a Rs 1,499 registration or slot fee. ' +
      'Your placement cell confirmed this is a scam. Genuine recruiters never charge a fee to interview or join. Do not pay, do not share OTPs, and report any such message on the desk.',
    sourceCase: 'c01',
    indicators: [
      { type: 'upi', value: FAKE.technovaUpi },
      { type: 'domain', value: FAKE.technovaDomain },
    ],
    day: 37,
    acknowledgedBy: ['s1', 's2', 's3', 's7', 's8', 's13', 's19'],
  },
  draft: {
    title: 'Telegram "like and earn" task scams',
    severity: 'warning',
    target: { years: [], branches: [] },
    body:
      'Messages on Telegram promise Rs 3,000 to 5,000 a day for liking videos. After a few free tasks they ask for an activation payment and then a withdrawal fee. ' +
      'This is a known scam pattern. Never pay to unlock tasks or to withdraw earnings.',
    sourceCase: 'c04',
    indicators: [{ type: 'upi', value: FAKE.taskUpiA }],
    day: 2,
  },
});

// Lookups students and staff ran, spread over six weeks: [user, query, daysAgo].
const LOOKUPS = Object.freeze([
  ['s4', 'campus.hr@infosys.com', 40], ['s6', 'TechNova Solutions', 39], ['s8', FAKE.technovaUpi, 36],
  ['s11', 'tcs.com', 35], ['s14', 'campus.hr@accenture.com', 33], ['s17', 'infosys-careers-demo.xyz', 30],
  ['s18', 'capgemini.com', 29], ['s20', FAKE.taskUpiA, 28], ['s23', 'Wipro', 26], ['s24', 'tcs.com', 25],
  ['s2', 'accenture-careers-demo.xyz', 22], ['s4', FAKE.accentureFakeDomain, 20], ['s6', 'Persistent Systems', 19],
  ['s9', 'campus.hr@tcs.com', 17], ['s11', FAKE.technovaDomain, 15], ['s14', 'capgemini.com', 14],
  ['s17', 'Zoho', 12], ['s20', 'infosys.com', 11], ['s1', FAKE.technovaUpi, 10], ['s3', 'infosys-training-demo.xyz', 9],
  ['s5', 'Deloitte', 8], ['s7', 'accenture.com', 7], ['s10', FAKE.taskUpiA, 6], ['s12', 'tcs.com', 5],
  ['s15', 'campus.hr@infosys.com', 4], ['s16', FAKE.taskUpiB, 3], ['s18', 'HCL', 2], ['s21', 'infosys.com', 1],
  ['rahul', FAKE.technovaUpi, 9], ['sneha', 'capgemini.com', 4],
]);

module.exports = { COLLEGE, STAFF, STUDENTS, RECRUITERS, CASES, ADVISORIES, LOOKUPS, FAKE };
