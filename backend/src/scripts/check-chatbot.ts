import 'dotenv/config';
import {
  keywordReply,
  buildPortalContext,
  PortalContext,
} from '../shared/chatbot';

/**
 * Dev diagnostic: exercise the chatbot's no-key keyword fallback against the
 * resident FAQ intents (documents, incidents/emergency, officials, office
 * hours/contact, announcements, portal/account/chat, and off-topic refusals).
 *
 * By default it runs fully offline against a stub live snapshot, so it needs no
 * MongoDB and no provider key:
 *   npx ts-node src/scripts/check-chatbot.ts
 *
 * With `--live` it loads the real snapshot from the database and runs the same
 * questions through the live-data answer path:
 *   npx ts-node src/scripts/check-chatbot.ts --live
 */

/** Stub live snapshot so the eval runs without MongoDB. */
const STUB_CONTEXT: PortalContext = {
  barangay: {
    name: 'Labuin',
    city: 'Pila',
    province: 'Laguna',
    region: 'CALABARZON',
    zipCode: '4002',
    contactNumber: '(049) 555-0100',
    emailAddress: 'barangay.labuin@example.gov.ph',
    officeAddress: 'Purok 2, Labuin, Pila, Laguna',
    officeHours: [
      'Monday–Friday: 8:00 AM – 5:00 PM',
      'Saturday: 8:00 AM – 12:00 PM',
      'Sunday: Closed',
    ],
    emergencyHotline: '(049) 555-0911',
    emergencyMobile: '+63 917 000 0000',
  },
  officials: [
    { fullName: 'Maria Santos', designatedPosition: 'Punong Barangay' },
    { fullName: 'Jose Cruz', designatedPosition: 'Kagawad' },
    { fullName: 'Ana Reyes', designatedPosition: 'SK Chairman' },
    { fullName: 'Pedro Lim', designatedPosition: 'Barangay Secretary' },
    { fullName: 'Luz Bautista', designatedPosition: 'Barangay Treasurer' },
  ],
  announcements: [
    {
      titleText: 'Barangay Assembly sa Sabado',
      eventDate: '2026-10-17T00:00:00.000Z',
    },
  ],
};

interface CheckCase {
  /** Category label for the report. */
  category: string;
  /** Resident question (English or Filipino/Taglish). */
  question: string;
  /** Substrings that must all appear in the reply (case-insensitive). */
  must: string[];
  /**
   * Skip in `--live` mode. Set on cases whose assertions depend on the stub
   * snapshot's concrete values (names, numbers, titles) — the real dev data
   * predates some Barangay contact fields and carries different names.
   */
  stubOnly?: boolean;
}

const STUB_CAPTAIN = 'Maria Santos';
const STUB_SK = 'Ana Reyes';
const STUB_SECRETARY = 'Pedro Lim';
const STUB_EMAIL = 'barangay.labuin@example.gov.ph';
const STUB_OFFICE_ADDRESS = 'Purok 2, Labuin';
const STUB_HOTLINE = '(049) 555-0911';
const STUB_MOBILE = '+63 917 000 0000';
const STUB_ANNOUNCEMENT = 'Barangay Assembly sa Sabado';

const CASES: CheckCase[] = [
  // 1. Document requests (clearances & certificates).
  {
    category: 'documents',
    question: 'Paano kumuha ng Barangay Clearance online?',
    must: ['My Document Requests'],
  },
  {
    category: 'documents',
    question: 'How do I request a Certificate of Residency?',
    must: ['My Document Requests'],
  },
  {
    category: 'documents',
    question: 'Ano po ang mga kailangan para sa Certificate of Indigency?',
    must: ['2–3 business days'],
  },
  {
    category: 'documents',
    question: 'Saan ko makikita kung ready for pick up na yung request ko?',
    must: ['My Document Requests'],
  },
  {
    category: 'documents',
    question: 'Is there a fee for requesting a barangay clearance?',
    must: ['fees may apply'],
  },
  {
    category: 'documents',
    question: 'How long does it take for document requests to be processed?',
    must: ['2–3 business days'],
  },
  {
    category: 'documents',
    question: 'Paano kumuha ng police clearance?',
    must: ['My Document Requests'],
  },

  // 2. Incident reporting & emergency hotlines.
  {
    category: 'incidents',
    question: 'May sunog sa purok namin, ano emergency hotline ng barangay?',
    must: [STUB_HOTLINE],
    stubOnly: true,
  },
  {
    category: 'incidents',
    question: 'Paano mag-file ng incident report tungkol sa baha?',
    must: ['My Incident Reports'],
  },
  {
    category: 'incidents',
    question: 'How do I attach photos or evidence when filing a complaint?',
    must: ['evidence'],
  },
  {
    category: 'incidents',
    question: 'Sino po ang tatawagan kapag gabi may aksidente?',
    must: [STUB_MOBILE],
    stubOnly: true,
  },
  {
    category: 'incidents',
    question: 'Ano ang emergency mobile number ni Kapitan o ng tanod?',
    must: [STUB_MOBILE],
    stubOnly: true,
  },
  {
    category: 'incidents',
    question: 'Can I report a neighbor making loud noise late at night?',
    must: ['My Incident Reports'],
  },

  // 3. Barangay officials & directory.
  {
    category: 'officials',
    question: 'Sino po ang kasalukuyang Barangay Captain?',
    must: [STUB_CAPTAIN],
    stubOnly: true,
  },
  {
    category: 'officials',
    question: 'Who are the elected barangay kagawads?',
    must: ['Kagawad'],
    stubOnly: true,
  },
  {
    category: 'officials',
    question: 'Sino po ang SK Chairman ng barangay natin?',
    must: [STUB_SK],
    stubOnly: true,
  },
  {
    category: 'officials',
    question: 'Sino ang barangay secretary kung kailangan ko pumirma ng papeles?',
    must: [STUB_SECRETARY],
    stubOnly: true,
  },
  {
    category: 'officials',
    question: 'Where can I view the full list of barangay officials in the portal?',
    must: ['officials'],
  },

  // 4. Office hours, address & contact details.
  {
    category: 'contact',
    question: 'Bukas po ba ang barangay hall ngayon?',
    must: ['Office hours'],
    stubOnly: true,
  },
  {
    category: 'contact',
    question: 'What are the official office hours of the barangay hall?',
    must: ['Office hours'],
    stubOnly: true,
  },
  {
    category: 'contact',
    question: 'Saan po banda ang barangay hall ng Labuin?',
    must: [STUB_OFFICE_ADDRESS],
    stubOnly: true,
  },
  {
    category: 'contact',
    question: 'Ano po ang official email address at landline number ng barangay?',
    must: [STUB_EMAIL],
    stubOnly: true,
  },
  {
    category: 'contact',
    question: 'Bukas ba ang serbisyo kapag weekends o holidays?',
    must: ['Office hours'],
    stubOnly: true,
  },

  // 5. Announcements, programs & public notices.
  {
    category: 'announcements',
    question: 'Ano po ang pinakabagong anunsyo sa barangay?',
    must: [STUB_ANNOUNCEMENT],
    stubOnly: true,
  },
  {
    category: 'announcements',
    question: 'May schedule po ba ng medical mission o libreng bakuna?',
    must: [STUB_ANNOUNCEMENT],
    stubOnly: true,
  },
  {
    category: 'announcements',
    question: 'Kailan po ang pamamahagi ng ayuda o relief goods?',
    must: [STUB_ANNOUNCEMENT],
    stubOnly: true,
  },
  {
    category: 'announcements',
    question: 'May anunsyo ba kung suspendido ang klase dahil sa bagyo?',
    must: [STUB_ANNOUNCEMENT],
    stubOnly: true,
  },
  {
    category: 'announcements',
    question: 'Where can I read the full public notices from the barangay?',
    must: [STUB_ANNOUNCEMENT],
    stubOnly: true,
  },

  // 6. Portal navigation, account management & live chat.
  {
    category: 'portal',
    question: 'Bakit hindi ako makapag-start ng bagong Live Chat?',
    must: ['Live Chat'],
  },
  {
    category: 'portal',
    question: 'Paano ko kakausapin si admin tungkol sa report ko?',
    must: ['Live Chat'],
  },
  {
    category: 'portal',
    question: 'Paano ko i-install itong web app sa phone ko?',
    must: ['Add to Home Screen'],
  },
  {
    category: 'portal',
    question: 'Saan ko makikita ang mga notipikasyon kapag may update sa request ko?',
    must: ['Notifications'],
  },
  {
    category: 'portal',
    question: 'Paano i-update ang contact number o address sa profile ko?',
    must: ['Account Settings'],
  },

  // 7. Out-of-scope / mutation requests.
  {
    category: 'refusal',
    question: 'Pwede mo ba i-approve agad yung clearance ko?',
    must: ['makakapagbago', 'My Document Requests'],
  },
  {
    category: 'refusal',
    question: 'Can you approve my clearance?',
    must: ['cannot change any records', 'My Document Requests'],
  },
  {
    category: 'refusal',
    question: 'I-delete mo na yung incident report ko.',
    must: ['makakapagbago', 'My Incident Reports'],
  },
  {
    category: 'refusal',
    question: 'Ano ang recipe ng adobo?',
    must: ['KaBarangayConnect'],
  },
];

function runCase(
  { category, question, must }: CheckCase,
  context: PortalContext
): boolean {
  const reply = keywordReply(question, context);
  const lower = reply.toLowerCase();
  const missing = must.filter((needle) => !lower.includes(needle.toLowerCase()));
  const ok = missing.length === 0;

  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] (${category}) ${question}`);
  if (!ok) console.log(`       missing: ${missing.join(' | ')}`);
  console.log(`       reply  : ${reply.replace(/\n/g, '\n                ')}`);

  return ok;
}

async function main(): Promise<void> {
  const live = process.argv.includes('--live');

  let context = STUB_CONTEXT;
  if (live) {
    const { connectToDatabase, disconnectDatabase } = await import(
      '../config/db'
    );
    await connectToDatabase();
    try {
      context = await buildPortalContext();
    } finally {
      await disconnectDatabase();
    }
    console.log(
      'Live context:',
      JSON.stringify(
        {
          barangay: context.barangay?.name ?? null,
          officials: context.officials.length,
          announcements: context.announcements.length,
        },
        null,
        2
      )
    );
  } else {
    console.log('Using stub context (no MongoDB / no provider key needed).');
  }

  const skippedInLive = live
    ? CASES.filter((testCase) => testCase.stubOnly).length
    : 0;
  const selected = live
    ? CASES.filter((testCase) => !testCase.stubOnly)
    : CASES;

  const results = selected.map((testCase) => runCase(testCase, context));
  const passed = results.filter(Boolean).length;

  if (skippedInLive > 0) {
    console.log(
      `\nSkipped ${skippedInLive} stub-only case(s) in --live mode (they assert the stub snapshot's values).`
    );
  }
  console.log(
    `\n${passed}/${results.length} chatbot keyword-fallback checks passed.`
  );
  if (passed !== results.length) process.exit(1);
}

main();
