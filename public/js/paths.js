// Canada immigration paths, as maps of stops.
// Checked against official IRCC / Québec pages and recent draw data on 27 September 2026.
// Rules change often: every stop links to the official page, and the app shows the check date.

export const CHECKED = '27 September 2026';

const L = {
  ee: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html',
  eeApply: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/apply-permanent-residence.html',
  fsw: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers.html',
  cec: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/canadian-experience-class.html',
  cats: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations/category-based-selection.html',
  crs: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html',
  crsTool: 'https://ircc.canada.ca/english/immigrate/skilled/crs-tool.asp',
  rounds: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html',
  funds: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/proof-funds.html',
  eca: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/education-assessed.html',
  lang: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-requirements.html',
  police: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/police-certificates.html',
  medical: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/medical-police/medical-exams/requirements-permanent-residents.html',
  panel: 'https://secure.cic.gc.ca/pp-md/pp-list.aspx',
  bio: 'https://www.canada.ca/en/immigration-refugees-citizenship/campaigns/biometrics.html',
  fees: 'https://www.canada.ca/en/immigration-refugees-citizenship/news/notices/permanent-residence-fees-increasing.html',
  times: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html',
  landing: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/new-immigrants/prepare-life-canada/prepare-travel.html',
  pnp: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees.html',
  pstq: 'https://www.quebec.ca/en/immigration/permanent/skilled-workers/skilled-worker-selection-program',
  pstqReq: 'https://www.quebec.ca/en/immigration/permanent/skilled-workers/skilled-worker-selection-program/requirements',
  pstqInv: 'https://www.quebec.ca/en/immigration/permanent/skilled-workers/skilled-worker-selection-program/invitation/2026',
  peq: 'https://www.quebec.ca/immigration/permanente/travailleurs-qualifies/programme-experience-quebecoise',
  qcFed: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/quebec-skilled-workers.html',
  c16: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/hire-temporary-foreign/international-mobility-program/work-permit-exemptions/francophone-mobility.html',
  fcip: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/rural-franco-pilots/franco-immigration.html',
  rcip: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/rural-franco-pilots/rural-immigration.html',
  aip: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/atlantic-immigration.html',
  study: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html',
  pgwp: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation.html',
  fmcsp: 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/public-policies/pr-francophone-minority-communities-student-pilot-2025.html',
  spouse: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/family-sponsorship/spouse-partner-children.html',
  suv: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/start-visa.html',
  care: 'https://www.canada.ca/en/immigration-refugees-citizenship/news/notices/pausing-home-care-worker-immigration-pilots-application-intake.html',
  cicc: 'https://register.college-ic.ca/Public-Register-EN/Licensee/Lookup.aspx',
  vfs: 'https://visa.vfsglobal.com/tun/fr/can/',
  wes: 'https://www.wes.org/ca/'
};

/* ---------- shared stops (tailored per path with overrides) ---------- */
const S = {
  eca: (o = {}) => ({
    id: 'eca', title: 'Get your diploma assessed (ECA)', time: '4–10 weeks', cost: '≈ CAD 240–300 + courier',
    why: 'Foreign education only counts in Canada once a designated organisation confirms its Canadian equivalent.',
    steps: [
      'Choose a designated organisation: WES is the most used for Tunisian degrees (others: ICES, CES, IQAS, ICAS; doctors use MCC, pharmacists PEBC).',
      'Create an account and pay online, then ask your university to send sealed transcripts directly (WES lists the exact process for Tunisian institutions).',
      'Send a copy of your diploma as instructed.',
      'Keep the report: it is valid 5 years and you enter its reference number in your profile.'
    ],
    docs: ['Diploma (copy)', 'Official transcripts sent by the university', 'Passport'],
    tunisia: 'Diplomas from ENIT, ENSI, INSAT, FST and other public schools convert well. Start early: university offices can take weeks to send sealed transcripts.',
    link: L.eca, ...o
  }),
  french: (level, o = {}) => ({
    id: 'french', title: 'Take TEF Canada or TCF Canada', time: '1–3 months of prep, results in about 2–4 weeks', cost: '≈ CAD 200–350 per test (paid in TND at the centre)',
    why: 'Your language score is the biggest factor you control.',
    steps: [
      'Target: ' + level + '.',
      'Prepare all four skills: compréhension orale et écrite, expression orale et écrite.',
      'Book the full TEF Canada (4 tests) or TCF Canada in Tunis. Seats fill weeks ahead.',
      'Results are valid 2 years. They must still be valid on the day you submit your PR application.'
    ],
    docs: ['Passport (the same one you will use in your application)'],
    tunisia: 'TEF Canada and TCF Canada are both offered in Tunis. Book early before exam season.',
    app: { go: '#/tef', label: 'Train for TEF in the app', exam: 'tef', min: o.min || 7 },
    link: L.lang, ...o
  }),
  english: (level, o = {}) => ({
    id: 'english', title: 'Take IELTS General Training (or CELPIP / PTE Core)', time: '1–3 months of prep, results in about 2 weeks', cost: '≈ CAD 200–400 (paid in TND at the centre)',
    why: 'English scores give you points, or unlock the program on their own.',
    steps: [
      'Target: ' + level + '.',
      'Only IELTS General Training counts, not Academic. CELPIP-General and PTE Core are also accepted where available.',
      'Results are valid 2 years.'
    ],
    docs: ['Passport'],
    tunisia: 'IELTS is offered in Tunis, Sousse and Sfax. Check the British Council or IDP Tunisia pages for dates and the current fee.',
    app: { go: '#/ielts', label: 'Train for IELTS in the app', exam: 'ielts', min: o.min || 7 },
    link: L.lang, ...o
  }),
  police: (o = {}) => ({
    id: 'police', title: 'Police certificates', time: '1–4 weeks each', cost: 'Low in Tunisia; varies abroad',
    why: 'Every adult in your application needs one from each country where they lived 6 months or more since age 18.',
    steps: [
      'Tunisia: request the Bulletin n°3 (extrait du casier judiciaire). Check the IRCC police certificate page for the current procedure.',
      'Get one for every other country where you lived 6+ months since 18: France, the Gulf, and so on.',
      'Translate documents that are not in English or French with a certified translator, and upload the original and the translation.'
    ],
    docs: ['Bulletin n°3 (recent)', 'Certificates from other countries', 'Certified translations'],
    tunisia: 'The Bulletin n°3 is in Arabic, so budget for a certified translation into French or English.',
    link: L.police, ...o
  }),
  medical: (o = {}) => ({
    id: 'medical', title: 'Immigration medical exam', time: '1–2 weeks', cost: 'Set by the clinic (ask when booking)',
    why: 'Everyone in the application, including family members who are not coming, must pass an exam with an IRCC panel physician.',
    steps: [
      'Book with a panel physician in Tunis from the official IRCC list. Other doctors are not accepted.',
      'Bring your passport, photos and any medical reports. The clinic sends the results to IRCC.',
      'Upload the IMM 1017 information sheet or the eMedical receipt with your application.',
      'Results are valid 12 months.'
    ],
    docs: ['Passport', 'Photos', 'eMedical sheet / receipt'],
    tunisia: 'Panel physicians in Tunis are listed on the IRCC panel physician site.',
    link: L.panel, ...o
  }),
  biometrics: (o = {}) => ({
    id: 'bio', title: 'Biometrics (fingerprints and photo)', time: 'Within 30 days of the letter', cost: 'CAD 85 per person (max CAD 170 per family)',
    why: 'Required after you submit your application, unless you gave them in the last 10 years.',
    steps: ['Wait for the Biometric Instruction Letter in your IRCC account.', 'Book the VFS Global centre in Tunis and bring the letter and your passport.'],
    docs: ['Biometric Instruction Letter', 'Passport'],
    tunisia: 'The VFS Global Canada application centre is in Tunis. Book online as soon as the letter arrives.',
    link: L.vfs, ...o
  }),
  landing: (o = {}) => ({
    id: 'landing', title: 'Confirmation of PR and landing in Canada', time: 'Before your COPR / visa expires', cost: 'Flights + settlement',
    why: 'You become a permanent resident when you land and an officer confirms your status.',
    steps: [
      'You receive a request for your passport (portal or VFS) and your Confirmation of Permanent Residence (COPR) with the PR visa.',
      'Travel before the COPR expiry date. It usually follows your medical exam date.',
      'At the border, declare any funds over CAD 10,000 and have your COPR, passport and proof of funds ready.',
      'After landing: get your SIN, open a bank account, apply for provincial health insurance, and wait for your PR card by mail.'
    ],
    docs: ['COPR', 'Passport with PR visa', 'Proof of funds'],
    link: L.landing, ...o
  })
};
const prFees = 'CAD 990 processing + CAD 600 right of PR fee per adult (from 30 April 2026), less for children, + CAD 85 biometrics per person';

/* ---------- paths ---------- */
export const PATHS = [
  {
    id: 'ee-french', name: 'Express Entry: French-language draws', color: '#1F4FA8', tag: 'Best odds for French speakers',
    summary: 'Federal permanent residence for skilled workers who reach NCLC 7 in French. In 2026 these draws have been large (5,000 invitations each) with CRS cut-offs as low as 382.',
    who: ['At least 1 year of skilled work (TEER 0–3) in the last 10 years', 'French NCLC 7 or higher in all four skills', 'Post-secondary education (assessed)', 'Settling outside Québec'],
    time: '9–15 months from first test to landing', cost: 'About CAD 3,500–5,000 for a single applicant, excluding proof of funds',
    lang: { exam: 'tef', min: 7, label: 'NCLC 7 in all four French skills' },
    facts: ['French draws in July–August 2026: 5,000 invitations each, cut-offs 382 to 420.', 'NCLC 7 in French also adds 25 or 50 bonus CRS points (50 if your English is also CLB 5 or higher).', 'General "all-program" draws have not happened since April 2024: the categories are where invitations go.'],
    stops: [
      { id: 'check', title: 'Check you qualify for a program', time: '1 day', cost: 'Free',
        why: 'The French category invites people who already qualify for FSW, CEC or FST. Most people abroad go through FSW.',
        steps: ['FSW: 1 year of continuous full-time paid work (1,560 hours) in one TEER 0–3 occupation within the last 10 years.', 'Score at least 67/100 on the FSW grid: language, education, experience, age, job offer, adaptability.', 'Find your occupation code (NOC 2021) and make sure your duties match its description.', 'Estimate your CRS with the official tool.'],
        link: L.fsw },
      S.french('NCLC 7 minimum in all four skills. NCLC 9+ adds many more CRS points', { min: 7 }),
      S.english('CLB 5+ in all four skills to get the full 50 French bonus points; CLB 7+ to also earn second-language points', { min: 5, optional: true }),
      S.eca(),
      { id: 'funds', title: 'Build your proof of funds', time: 'Start early', cost: 'CAD 15,263 for 1 person, 19,001 for 2, 23,360 for 3, 28,362 for 4',
        why: 'FSW applicants must show that they can support themselves, unless they already work in Canada with a valid job offer.',
        steps: ['Keep the money in your own name (a joint account with your spouse is fine), available and unencumbered.', 'Official bank letters must show the current balance, the 6-month average balance, account opening date and any debts.', 'Avoid large unexplained deposits just before applying: explain any gifts with documents.', 'The amounts are updated each year (current IRCC table).'],
        docs: ['Bank letters on letterhead', 'Statements for the last 6 months'],
        tunisia: 'Funds in Tunisian dinar accounts are accepted when documented. The officer converts them at the current rate, so keep a buffer.',
        link: L.funds },
      { id: 'profile', title: 'Create your Express Entry profile', time: '1–2 evenings', cost: 'Free',
        why: 'Your profile enters the pool and receives a CRS score. The French category is applied automatically if you meet NCLC 7.',
        steps: ['Create an IRCC secure account and fill in the profile. Enter test results, ECA and work history exactly as documented.', 'List every job with NOC code, hours per week and dates, with no gaps (explain unemployment or studies).', 'The profile is valid 12 months. Update it when your scores improve.', 'Never guess: a false claim leads to refusal and a 5-year ban.'],
        link: L.ee },
      { id: 'ita', title: 'Wait for an invitation (ITA)', time: 'Weeks to months', cost: 'Free',
        why: 'IRCC sends invitations to the highest-scoring profiles in each draw.',
        steps: ['Follow French-language draws on the official rounds page. In 2026 they are frequent and large.', 'Raise your score while waiting: a higher NCLC (9–10), an English test, your spouse\'s tests and ECA, or a provincial nomination (+600).', 'Prepare every document now: once invited, you only have 60 days.'],
        link: L.rounds },
      { id: 'docs', title: 'Gather documents (before or right after the ITA)', time: '4–8 weeks', cost: 'Translations ≈ 30–60 TND per page',
        why: 'The 60-day window is short. Reference letters take the longest.',
        steps: ['Employment reference letters on letterhead: title, NOC duties, hours per week, salary, dates, signed with contact details.', 'Civil documents: passport, birth certificate, marriage certificate (if any), children\'s documents.', 'Certified translations of everything in Arabic.', 'Digital photos to IRCC specifications.'],
        docs: ['Reference letters', 'Passport pages', 'Birth / marriage certificates', 'Translations'],
        tunisia: 'Ask employers for letters that describe your duties in detail. Generic "attestations de travail" often lack the duties and hours IRCC needs.',
        link: L.eeApply },
      S.police(),
      S.medical(),
      { id: 'apply', title: 'Submit your PR application', time: 'Within 60 days of the ITA', cost: prFees,
        why: 'The application must match your profile and include every requested document.',
        steps: ['Fill in the e-APR online and upload every document on the personalised checklist.', 'Pay the fees. Paying the right of PR fee now avoids a later delay.', 'Submit before the 60-day deadline, then keep the submission confirmation.', 'You receive an Acknowledgement of Receipt (AOR).'],
        link: L.eeApply },
      S.biometrics(),
      { id: 'processing', title: 'Processing and decision', time: 'About 6 months standard', cost: 'Free',
        why: 'IRCC checks eligibility, background and medical results.',
        steps: ['Watch your account for requests: additional documents, updated medicals.', 'Tell IRCC about any change: marriage, birth, new job, new address.', 'When approved, you receive a request for your passport and your COPR.'],
        link: L.times },
      S.landing()
    ]
  },
  {
    id: 'ee-fsw', name: 'Express Entry: Federal Skilled Worker (English)', color: '#B4263A', tag: 'Skilled workers abroad',
    summary: 'The main federal program for skilled workers outside Canada. In 2026 invitations go mainly to categories (French, healthcare, STEM, trades, education, transport) and to provincial nominees, so plan to fit one of them.',
    who: ['1 year continuous skilled work (TEER 0–3) in the last 10 years', 'CLB 7 in all four English skills', 'Post-secondary education (assessed)', '67/100 on the FSW grid'],
    time: '10–18 months', cost: 'About CAD 3,500–5,000 single, excluding proof of funds',
    lang: { exam: 'ielts', min: 7, label: 'CLB 7 minimum; CLB 9+ recommended' },
    facts: ['No general all-program draws since April 2024: without French, a category occupation or a nomination, CRS cut-offs are out of reach for most people abroad.', 'Categories in 2026: French, healthcare & social services, STEM, trades, education, transport, plus new categories for doctors, researchers and senior managers with Canadian experience. Most need 12 months of experience in an eligible occupation.', 'Job offer points were removed in March 2025.'],
    stops: [
      { id: 'check', title: 'Check the FSW grid and your category', time: '1 day', cost: 'Free',
        why: 'Being eligible gets you into the pool; a category or a nomination gets you invited.',
        steps: ['Compute your 67-point score: language (28), education (25), experience (15), age (12), job offer (10), adaptability (10).', 'Check whether your NOC is in a 2026 category, with 12 months of experience in it.', 'Estimate your CRS with the official tool. Under 470 without a category, plan French or a province.'],
        link: L.cats },
      S.english('CLB 7 minimum in all four; CLB 9 (IELTS L8 R7 W7 S7) gives far more CRS points', { min: 9 }),
      S.french('NCLC 7 in French adds up to 50 bonus points and opens the French draws', { optional: true, min: 7 }),
      S.eca(),
      { id: 'funds', title: 'Proof of funds', time: 'Start early', cost: 'CAD 15,263 single → 28,362 for a family of 4', why: 'Required for FSW unless you already work in Canada with a job offer.', steps: ['Keep the money in your own name, available, with 6 months of history.', 'Get official bank letters with current and average balances.'], link: L.funds },
      { id: 'profile', title: 'Create your Express Entry profile', time: '1–2 evenings', cost: 'Free', why: 'Enters the pool with your CRS.', steps: ['Enter exact test, ECA and job data with NOC codes.', 'Update the profile each time you improve a score.', 'The profile is valid 12 months.'], link: L.ee },
      { id: 'boost', title: 'Boost your score while in the pool', time: 'Ongoing', cost: 'Varies',
        why: 'Most invitations go to categories and nominees.',
        steps: ['Retake IELTS to reach CLB 9–10 in every skill.', 'Add French (TEF/TCF) for the bonus and the French draws.', 'Add your spouse\'s language test and ECA.', 'Apply to provincial streams that select from Express Entry (+600 CRS).'],
        link: L.crs },
      { id: 'ita', title: 'Invitation to apply', time: 'Depends on draws', cost: 'Free', why: '60 days to submit after an ITA.', steps: ['Follow category draws on the official rounds page.', 'Have documents ready before you are invited.'], link: L.rounds },
      S.police(), S.medical(),
      { id: 'apply', title: 'Submit your PR application', time: 'Within 60 days', cost: prFees, why: 'Complete, consistent with your profile.', steps: ['Upload reference letters, civil documents, funds, police certificates, medical proof.', 'Pay the fees and submit before the deadline.'], link: L.eeApply },
      S.biometrics(),
      { id: 'processing', title: 'Processing', time: 'About 6 months', cost: 'Free', why: '', steps: ['Answer requests quickly and report any change.'], link: L.times },
      S.landing()
    ]
  },
  {
    id: 'ee-cec', name: 'Express Entry: Canadian Experience Class', color: '#1D7650', tag: 'After working in Canada',
    summary: 'For people who already have a year of skilled work in Canada: after a work permit (for example Francophone Mobility) or after graduating in Canada.',
    who: ['1 year skilled work in Canada (TEER 0–3) in the last 3 years, with work authorisation', 'CLB/NCLC 7 for TEER 0–1 jobs, 5 for TEER 2–3', 'No education requirement (it still gives points)', 'Settling outside Québec'],
    time: '6–9 months after you qualify', cost: 'PR fees only; no proof of funds',
    lang: { exam: 'ielts', min: 7, label: 'CLB 7 (TEER 0–1) or CLB 5 (TEER 2–3)' },
    facts: ['CEC draws in August–September 2026 invited 1,000–3,000 people with cut-offs of 516–523.', 'With NCLC 7 French, you can also be invited in French draws at much lower scores.', 'Student work and self-employment do not count.'],
    stops: [
      { id: 'permit', title: 'Get authorised work in Canada', time: 'Varies', cost: 'Work permit fees', why: 'CEC only counts Canadian experience gained with a valid permit.', steps: ['Common routes: Francophone Mobility (C16), post-graduation work permit, employer-specific LMIA permit.', 'Keep pay stubs, contracts and the ROE/T4 slips from day one.'], link: L.c16 },
      { id: 'year', title: 'Work 12 months in a TEER 0–3 job', time: '1 year (1,560 hours)', cost: '—', why: 'Full-time or equivalent part-time, in the last 3 years.', steps: ['Make sure your real duties match the NOC you will claim.', 'Leave no gaps in your permit: maintained status counts if you applied to extend on time.'], link: L.cec },
      S.french('NCLC 7 opens the French draws and adds up to 50 points', { min: 7, optional: true }),
      S.english('CLB 7+ (TEER 0–1) or CLB 5+ (TEER 2–3); CLB 9 gives far more points', { min: 7 }),
      { id: 'profile', title: 'Express Entry profile', time: '1–2 evenings', cost: 'Free', why: '', steps: ['Enter your Canadian job with NOC, hours and dates.', 'Add your foreign experience and ECA: they add skill-transferability points.'], link: L.ee },
      { id: 'ita', title: 'CEC, category or French invitation', time: 'Weeks to months', cost: 'Free', why: '', steps: ['CEC draws are regular. French-speakers may be invited sooner in French draws.', 'A provincial nomination (+600) is also common for people working in a province.'], link: L.rounds },
      S.police({ steps: ['Police certificates from Tunisia and every country lived in 6+ months since 18. Canada is not needed.', 'Translate documents that are not in English or French.'] }),
      S.medical({ steps: ['Book a panel physician in Canada from the IRCC list.', 'Results are valid 12 months.'] }),
      { id: 'apply', title: 'Submit PR application', time: 'Within 60 days', cost: prFees, why: 'No proof of funds for CEC.', steps: ['Upload employer letters, pay stubs, T4s, permits.', 'Apply for a bridging open work permit if your permit is ending.'], link: L.eeApply },
      { id: 'landing', title: 'Become a permanent resident', time: 'About 6 months', cost: '—', why: 'You confirm PR online or at an IRCC office, with no need to travel.', steps: ['Confirm your address and upload a photo in the PR confirmation portal.', 'Your PR card arrives by mail.'], link: L.landing }
    ]
  },
  {
    id: 'pnp', name: 'Provincial Nominee Program (PNP)', color: '#8A5A00', tag: '+600 CRS points',
    summary: 'Provinces nominate people they need. An "enhanced" nomination adds 600 CRS points and almost guarantees an Express Entry invitation. In 2026 most streams favour people already working or with a job offer in the province.',
    who: ['Depends on the stream: often a job offer or work in the province', 'Some streams draw directly from the Express Entry pool', 'Language often CLB 4–7 depending on the stream'],
    time: '12–24 months', cost: 'Provincial fee (≈ CAD 0–1,500) + PR fees',
    lang: { exam: 'ielts', min: 5, label: 'Stream-specific (often CLB 5–7)' },
    facts: ['2026 PNP target: 91,500 admissions nationally.', 'PNP draws in Express Entry in 2026: cut-offs 697–805 (the 600 points included).', 'Saskatchewan accepts some priority-sector candidates from outside Canada; Ontario and Alberta now mostly need a job offer or local work.'],
    stops: [
      { id: 'target', title: 'Pick provinces that match your profile', time: '1 week', cost: 'Free', why: 'Every province has different streams and rules, and they change often.', steps: ['List streams open to people abroad (for example Saskatchewan priority sectors) and francophone streams (New Brunswick, Ontario, Manitoba, Nova Scotia).', 'Check whether a stream is "enhanced" (linked to Express Entry) or "base" (paper route).', 'Read the stream\'s language, experience and job-offer rules on the province\'s own site.'], link: L.pnp },
      S.english('Most streams: CLB 4–7 depending on the job', { min: 5 }),
      S.french('Francophone streams usually ask NCLC 5–7', { optional: true, min: 5 }),
      S.eca(),
      { id: 'eoi', title: 'Submit an Expression of Interest to the province', time: 'Hours', cost: 'Usually free', why: 'Most provinces score and invite from their own pool.', steps: ['Create an EOI in the provincial system with the same data as your Express Entry profile.', 'For enhanced streams, keep an active Express Entry profile.'], link: L.pnp },
      { id: 'nomination', title: 'Provincial application and nomination', time: '2–6 months', cost: 'Provincial fee', why: 'The province checks your documents and job offer.', steps: ['Submit the full provincial application when invited.', 'Enhanced: accept the nomination in your Express Entry profile (+600 points).', 'Base: you receive a nomination certificate to apply on paper/online to IRCC.'], link: L.pnp },
      { id: 'ita', title: 'Express Entry invitation (enhanced) or federal application (base)', time: 'Next draw / immediate', cost: 'Free', why: '', steps: ['Enhanced nominees are invited in the next PNP draw.', 'Base nominees apply straight to IRCC with the nomination.'], link: L.rounds },
      S.police(), S.medical(),
      { id: 'apply', title: 'Federal PR application', time: '60 days (enhanced)', cost: prFees, why: '', steps: ['Same documents as Express Entry plus the nomination.', 'Base streams take longer to process.'], link: L.pnp },
      S.biometrics(), S.landing({ steps: ['Land in the province that nominated you and plan to live there.', 'After landing: SIN, bank, health card, PR card.'] })
    ]
  },
  {
    id: 'quebec', name: 'Québec: PSTQ and PEQ', color: '#2F6FD1', tag: 'For strong French speakers',
    summary: 'Québec selects its own immigrants. PSTQ (via Arrima) is the main program; the PEQ was temporarily reopened on 2 July 2026 for two years for people already in Québec.',
    who: ['PSTQ stream 1 (high skills): French oral 7 + written 5, 1 year experience in the last 5 years', 'Stream 2 (TEER 3–5): French oral 5, 2 years of experience including 1 in Québec', 'Stream 3 (regulated professions) and stream 4 (exceptional talent)', 'Spouse: French oral 4'],
    time: '18–36 months', cost: 'Québec fees + federal PR fees',
    lang: { exam: 'tef', min: 7, label: 'Stream 1: NCLC 7 oral, 5 written' },
    facts: ['PSTQ rounds in 2026 have mostly invited people already in Québec or in priority sectors; high minimum scores (around 630–780) for the general groups.', 'PEQ first wave (2 July – 31 October 2026) is for people in Québec who met the criteria on 19 November 2025.', 'Québec targets about 29,000 economic immigrants a year, split between PSTQ and PEQ.'],
    stops: [
      { id: 'stream', title: 'Choose your stream and check the points', time: '1 week', cost: 'Free', why: 'Each stream has its own French and experience minimums.', steps: ['Read the PSTQ requirements for your stream.', 'Check whether invitation rounds target your occupation (TEER), region or sector.', 'Living and working in Québec greatly improves your chances in 2026 rounds.'], link: L.pstqReq },
      S.french('Stream 1: oral level 7 (listening + speaking) and written 5 (reading + writing). Higher gives more points', { min: 7 }),
      { id: 'eval', title: 'Get your diploma recognised by Québec', time: '1–3 months', cost: 'MIFI fee (see site)', why: 'Québec uses its own Évaluation comparative des études (MIFI), not WES.', steps: ['Apply online to the MIFI for an Évaluation comparative des études effectuées hors du Québec.', 'Regulated professions (engineers, nurses…) also need the order\'s recognition.'], link: L.pstq },
      { id: 'arrima', title: 'Declare your interest in Arrima', time: '1–2 evenings', cost: 'Free', why: 'The Arrima declaration of interest is the entry to the PSTQ pool.', steps: ['Create an Arrima account and fill in your declaration: experience, education, French results, spouse.', 'Keep it updated for 12 months; renew it if needed.'], link: L.pstq },
      { id: 'invite', title: 'Invitation and application for permanent selection', time: 'Weeks to months', cost: 'Québec fee (see site)', why: 'Only invited people can apply.', steps: ['After an invitation, submit the full application with documents in the set deadline.', 'Sign the declaration on Québec values and prove 3 months of financial self-sufficiency (contract).'], link: L.pstqInv },
      { id: 'csq', title: 'Receive the Québec Selection Certificate (CSQ)', time: 'Months', cost: '—', why: 'The CSQ is Québec\'s selection decision.', steps: ['Answer any request quickly.', 'The CSQ is needed for the federal application.'], link: L.pstq },
      S.police(), S.medical(),
      { id: 'federal', title: 'Federal PR application (Québec skilled worker)', time: 'Months', cost: prFees, why: 'Canada checks health, security and admissibility.', steps: ['Apply online to IRCC with your CSQ.', 'Give biometrics when asked.'], link: L.qcFed },
      S.landing({ steps: ['Settle in Québec.', 'Register with the RAMQ for health insurance.'] })
    ]
  },
  {
    id: 'c16', name: 'Francophone Mobility work permit → PR', color: '#6A4BC4', tag: 'Fastest way to work in Canada',
    summary: 'A Canadian employer outside Québec can hire a French speaker without an LMIA. After a year of work, you apply for PR through CEC, the French draws or a province.',
    who: ['French NCLC 5 in speaking and listening', 'Job offer in any TEER 0–5 occupation outside Québec (except primary agriculture TEER 4–5)', 'An employer willing to use code C16'],
    time: '2–4 months to the work permit; 12+ months of work; then PR', cost: 'CAD 155 permit + CAD 85 biometrics; employer pays CAD 230',
    lang: { exam: 'tef', min: 5, label: 'NCLC 5 in speaking and listening' },
    facts: ['The requirement is NCLC 5 (not 7) since June 2023.', 'After 12 months in a TEER 0–3 job you can qualify for CEC; with NCLC 7 you enter the French draws.', 'Destination Canada Mobilité and francophone job boards list employers used to C16.'],
    stops: [
      S.french('NCLC 5 in speaking and listening for the permit; aim for NCLC 7 in all four for PR later', { min: 5 }),
      { id: 'job', title: 'Find an employer outside Québec', time: '1–6 months', cost: 'Free', why: 'The permit is tied to that employer.', steps: ['Target francophone communities in New Brunswick, Ontario, Manitoba, Nova Scotia, Alberta and BC.', 'Use Destination Canada Mobilité events and francophone job boards.', 'Explain the C16 route to the employer: no LMIA, fast.'], link: L.c16 },
      { id: 'offer', title: 'Employer submits the offer (C16)', time: 'Days', cost: 'Employer: CAD 230', why: 'The offer number is needed for your permit application.', steps: ['The employer submits the offer in the IRCC Employer Portal and pays the compliance fee.', 'They send you the offer number (A-number).'], link: L.c16 },
      { id: 'permit', title: 'Apply for the work permit', time: 'Weeks to a few months', cost: 'CAD 155 + 85 biometrics', why: '', steps: ['Apply online with the offer number, TEF/TCF results, diploma, CV and passport.', 'Give biometrics at VFS Tunis, then receive the port-of-entry letter.', 'Your spouse may qualify for an open work permit, depending on your job\'s TEER level (rules tightened in 2025).'], link: L.c16 },
      { id: 'arrive', title: 'Arrive and start working', time: '—', cost: 'Flights + first months', why: '', steps: ['Get your permit at the border.', 'Collect proof of work from day one: contract, pay stubs, T4.'], link: L.landing },
      { id: 'year', title: 'Work 12 months', time: '1 year', cost: '—', why: 'Builds CEC eligibility and CRS points.', steps: ['Stay in a TEER 0–3 job if you want CEC.', 'Meanwhile raise French to NCLC 7+ and take IELTS.'], link: L.cec },
      { id: 'pr', title: 'Apply for PR (CEC / French draw / province)', time: '6–9 months', cost: prFees, why: 'Continue on the CEC map.', steps: ['Create your Express Entry profile after 12 months.', 'Consider a provincial francophone stream in parallel.'], link: L.ee }
    ]
  },
  {
    id: 'fcip', name: 'Francophone & Rural Community Pilots (FCIP / RCIP)', color: '#0F7B83', tag: 'Job offer in a small community',
    summary: 'Direct PR for people with a job offer from a designated employer in a participating community. FCIP needs French; RCIP accepts English or French.',
    who: ['Job offer from a designated employer in the community', '1 year (1,560 h) related work in the last 3 years', 'FCIP: French NCLC 5 in all four; RCIP: CLB 6 (TEER 0–1), 5 (TEER 2–3), 4 (TEER 4–5)', 'Secondary diploma equivalent + settlement funds'],
    time: '12–24 months', cost: 'PR fees + optional work permit',
    lang: { exam: 'tef', min: 5, label: 'FCIP: NCLC 5 in all four skills' },
    facts: ['FCIP communities: Acadian Peninsula (NB), Sudbury, Timmins, Superior East (ON), St. Pierre Jolys (MB), Kelowna (BC).', 'RCIP communities include North Bay, Sudbury, Timmins, Sault Ste. Marie, Thunder Bay, Steinbach, Altona/Rhineland, Brandon, Moose Jaw, Claresholm, West Kootenay, North Okanagan-Shuswap, Peace Liard and Pictou County.', 'Some occupations reach yearly caps in some communities: check each community\'s site.'],
    stops: [
      { id: 'community', title: 'Choose a community and read its rules', time: '1–2 weeks', cost: 'Free', why: 'Each community publishes its priority occupations and designated employers.', steps: ['Read the community\'s site: priority jobs, caps, application calendar.', 'Check that your occupation is on the list.'], link: L.fcip },
      S.french('FCIP: NCLC 5 minimum in all four skills', { min: 5 }),
      S.eca({ why: 'Needed for a foreign secondary or post-secondary diploma.' }),
      { id: 'job', title: 'Job offer from a designated employer', time: '1–6 months', cost: 'Free', why: 'Only designated employers can make valid offers.', steps: ['Apply to designated employers in the community.', 'The offer must be full-time, non-seasonal and at or above the wage in the program rules.'], link: L.fcip },
      { id: 'reco', title: 'Community recommendation', time: 'Weeks to months', cost: 'Free', why: 'The community\'s organisation recommends you to IRCC.', steps: ['Submit your recommendation application to the community with your job offer.', 'Keep the recommendation certificate: it is valid for a limited time.'], link: L.fcip },
      S.police(), S.medical(),
      { id: 'apply', title: 'Apply for PR (and optionally a work permit)', time: '—', cost: prFees, why: '', steps: ['Apply online to IRCC with the recommendation, job offer and documents.', 'With a support letter, you can also apply for a work permit to start the job sooner.'], link: L.fcip },
      S.biometrics(), S.landing()
    ]
  },
  {
    id: 'aip', name: 'Atlantic Immigration Program (AIP)', color: '#155E75', tag: 'Job offer in NB, NS, PEI, NL',
    summary: 'Employer-driven PR for the four Atlantic provinces. A designated employer offers the job, the province endorses you, and you apply to IRCC.',
    who: ['Full-time job offer from a designated Atlantic employer', '1 year of experience in the last 5 years (for most jobs)', 'Language CLB/NCLC 5 (TEER 0–3) or 4 (TEER 4)', 'Secondary diploma equivalent + settlement funds'],
    time: '2+ years (processing about 26 months in mid-2026)', cost: 'PR fees + optional work permit',
    lang: { exam: 'ielts', min: 5, label: 'CLB/NCLC 5 (TEER 0–3)' },
    facts: ['2026 target: 4,000 admissions.', 'Since July 2026, applicants who change employer or job details have 90 days to send updated endorsement documents, or the application is refused.', 'A 2-year employer-specific work permit lets you start working before PR.'],
    stops: [
      S.english('CLB 5 for TEER 0–3 jobs, CLB 4 for TEER 4 (French NCLC also accepted)', { min: 5 }),
      S.eca(),
      { id: 'job', title: 'Job offer from a designated employer', time: '1–6 months', cost: 'Free', why: '', steps: ['Search the provinces\' designated employer lists and job boards.', 'The offer must be full-time and, for TEER 0–3, at least 1 year; for TEER 4, permanent.'], link: L.aip },
      { id: 'settle', title: 'Settlement plan and endorsement', time: '1–3 months', cost: 'Free', why: 'The province endorses the offer after a settlement plan.', steps: ['Get a settlement plan from a designated service provider.', 'The employer requests the provincial endorsement.'], link: L.aip },
      S.police(), S.medical(),
      { id: 'apply', title: 'Apply for PR and a work permit', time: '—', cost: prFees, why: '', steps: ['Apply online to IRCC with the endorsement certificate (IMM 0157).', 'Apply for the employer-specific work permit to start working sooner.'], link: L.aip },
      S.biometrics(), S.landing()
    ]
  },
  {
    id: 'fmcsp', name: 'Study in French outside Québec → direct PR', color: '#9D174D', tag: 'Open to Tunisians until Aug 2027',
    summary: 'The Francophone Minority Communities Student Pilot lets French-speaking students from eligible countries (including Tunisia) study in French outside Québec and then apply directly for PR.',
    who: ['Citizen of an eligible country (Tunisia is eligible)', 'French NCLC 5', 'Admission to a full-time program of 2+ years, at least 50% in French, at a participating institution outside Québec'],
    time: '2–3 years of study, then PR', cost: 'Tuition + CAD 22,895 a year for living costs (24,617 in Québec) + fees',
    lang: { exam: 'tef', min: 5, label: 'NCLC 5' },
    facts: ['Intake opened 26 August 2026 and runs to 25 August 2027 or until 2,970 study permit applications.', '17 participating institutions, mainly in Ontario, plus NB, SK, AB, BC, MB, NS and PEI.', 'Master\'s and PhD students at public institutions are exempt from the study permit cap and the attestation letter.'],
    stops: [
      S.french('NCLC 5 minimum', { min: 5 }),
      { id: 'admission', title: 'Get admitted to a participating program', time: '2–6 months', cost: 'Application fees', why: 'Only programs at the 17 participating institutions count.', steps: ['Choose a 2+ year program taught at least 50% in French.', 'Ask the institution to confirm it is part of the pilot.'], link: L.fmcsp },
      { id: 'funds', title: 'Show your funds', time: '—', cost: 'First-year tuition + CAD 22,895 (single)', why: '', steps: ['Bank statements, scholarship letters or sponsor documents.'], link: L.study },
      { id: 'permit', title: 'Apply for the study permit under the pilot', time: 'Weeks to months', cost: 'CAD 150 + 85 biometrics', why: '', steps: ['Apply online, mentioning the pilot, with your letter of acceptance.', 'Give biometrics at VFS Tunis; medical exam if requested.'], link: L.fmcsp },
      { id: 'study', title: 'Study and graduate', time: '2+ years', cost: '—', why: '', steps: ['Keep full-time status and good standing.', 'Part-time work is allowed within the limits of your permit.'], link: L.study },
      { id: 'pr', title: 'Apply directly for PR', time: 'After graduation', cost: prFees, why: 'The pilot gives a direct PR route after graduation.', steps: ['Apply while living outside Québec with valid status.'], link: L.fmcsp },
      S.landing({ title: 'Become a permanent resident', steps: ['Confirm PR in the online portal; your PR card arrives by mail.'] })
    ]
  },
  {
    id: 'study', name: 'Study in Canada → work → PR', color: '#4D7C0F', tag: 'Long route, most flexible',
    summary: 'Study, get a post-graduation work permit (PGWP), gain a year of Canadian experience, then apply through CEC, a province or Québec.',
    who: ['Admission to a designated institution', 'Funds for tuition + CAD 22,895 a year (single)', 'A provincial attestation letter (PAL), except master\'s/PhD at public institutions'],
    time: '3–5 years', cost: 'Tuition CAD 15,000–40,000 a year + living costs',
    lang: { exam: 'ielts', min: 7, label: 'PGWP: CLB 7 (university) or CLB 5 (college)' },
    facts: ['Study permit cap for 2026: 408,000, 7% lower than 2025.', 'Bachelor\'s, master\'s and PhD graduates are exempt from the PGWP field-of-study list; college programs must be in listed fields.', 'Spousal open work permits are limited to master\'s of 16+ months, PhD and some professional programs.'],
    stops: [
      { id: 'program', title: 'Choose a PGWP-eligible program', time: '1–2 months', cost: 'Free', why: 'The wrong program can mean no work permit after graduation.', steps: ['Check the institution is a DLI and the program is PGWP-eligible.', 'For college programs, check the field-of-study list.'], link: L.pgwp },
      S.english('University: IELTS 6.0 average often required; PGWP needs CLB 7 (university) or CLB 5 (college)', { min: 7 }),
      { id: 'admission', title: 'Letter of acceptance + PAL', time: '2–6 months', cost: 'Application fees', why: '', steps: ['Get the letter of acceptance.', 'Ask the school for the provincial attestation letter (PAL) unless you are exempt.'], link: L.study },
      { id: 'permit', title: 'Study permit', time: 'Weeks to months', cost: 'CAD 150 + 85 biometrics', why: '', steps: ['Funds, acceptance, PAL, study plan, ties to Tunisia.', 'Biometrics at VFS Tunis.'], link: L.study },
      { id: 'grad', title: 'Graduate and apply for a PGWP', time: 'Within 180 days of completion', cost: 'About CAD 255 (check the current fee)', why: '', steps: ['Apply with your final transcript and completion letter.', 'Meet the language requirement.'], link: L.pgwp },
      { id: 'work', title: 'Work 12 months in a TEER 0–3 job', time: '1 year', cost: '—', why: '', steps: ['Build CEC eligibility; explore provincial graduate streams.'], link: L.cec },
      { id: 'pr', title: 'PR through CEC, a province or Québec', time: '6–12 months', cost: prFees, why: '', steps: ['Continue on the CEC or PNP map.'], link: L.ee }
    ]
  },
  {
    id: 'spouse', name: 'Spouse or partner sponsorship', color: '#7C2D12', tag: 'Your partner is Canadian or PR',
    summary: 'A Canadian citizen or permanent resident can sponsor their spouse, common-law or conjugal partner and dependent children.',
    who: ['Sponsor: 18+, Canadian citizen or PR living in Canada (citizens can also be abroad and plan to return)', 'A genuine relationship', 'The sponsor signs a 3-year undertaking'],
    time: 'About 12–18 months', cost: 'About CAD 1,255 (sponsorship + processing + right of PR fee) + biometrics',
    lang: null,
    facts: ['2026 target: 69,000 spouses, partners and children.', 'Inside Canada, the partner can often get an open work permit while waiting.'],
    stops: [
      { id: 'eligible', title: 'Check sponsor and relationship eligibility', time: '1 day', cost: 'Free', why: '', steps: ['Read who can sponsor and who can be sponsored.', 'Choose outside-Canada or inside-Canada processing.'], link: L.spouse },
      { id: 'proof', title: 'Collect relationship evidence', time: '2–4 weeks', cost: 'Translations', why: 'Officers assess whether the relationship is genuine.', steps: ['Marriage certificate, photos over time, messages, trips, joint documents, family knowledge.', 'Certified translations of Arabic documents.'], link: L.spouse },
      S.police(), S.medical(),
      { id: 'apply', title: 'Submit the sponsorship and PR application together', time: '—', cost: 'About CAD 1,255 + biometrics', why: '', steps: ['Apply online through the PR portal with both applications.', 'Give biometrics when asked.'], link: L.spouse },
      { id: 'decision', title: 'Processing, interview if needed, decision', time: 'About 12 months', cost: '—', why: '', steps: ['Answer requests; an interview can be scheduled at the embassy.'], link: L.times },
      S.landing()
    ]
  }
];

export const PAUSED = [
  { name: 'Start-up Visa', note: 'Closed to new commitment certificates since 1 January 2026. A smaller entrepreneur pilot has been announced for 2026, focused on people already in Canada.', link: L.suv },
  { name: 'Self-Employed Persons Program', note: 'Paused until further notice.', link: L.suv },
  { name: 'Home Care Worker pilots (caregivers)', note: 'Intake paused since 19 December 2025; it will not reopen in March 2026.', link: L.care }
];

export const LINKS = L;
