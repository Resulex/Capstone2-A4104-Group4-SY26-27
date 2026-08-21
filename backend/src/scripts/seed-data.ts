// Realistic seed data for KaBarangayConnect.
// Deterministic and static so re-seeding is reproducible. Passwords are
// hashed at runtime by seed.ts.

export interface SeedBarangay {
  name: string;
  city: string;
  province: string;
  region: string;
  zipCode: string;
}

export interface SeedAdmin {
  adminId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  userName: string;
  emailAddress: string;
  password: string;
  assignedRole: 'Admin' | 'Moderator' | 'Content Admin';
  accountStatus: 'active' | 'suspended' | 'deactivated';
  lastLogin?: string;
}

export interface SeedOfficial {
  officialId: string;
  fullName: string;
  designatedPosition: string;
  contactNumber: string;
  emailAddress: string;
  officeLocation: string;
  coreResponsibilities: string[];
  profileImageUrl?: string;
  isDeleted: boolean;
}

export interface SeedResident {
  residentId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  emailAddress: string;
  contactNumber: string;
  houseUnitNumber: string;
  streetPurokName: string;
  password: string;
  profileImageUrl?: string;
  accountStatus: 'active' | 'suspended';
}

export interface SeedAnnouncement {
  announcementId: string;
  titleText: string;
  descriptionContent: string;
  priorityLevel: 'high' | 'medium' | 'low';
  authorKey: string; // key into admins by adminId
  imageUrl?: string;
  eventDate?: string;
  isHidden: boolean;
}

// One barangay for the whole system (city/province/zip read-only defaults).
export const BARANGAY: SeedBarangay = {
  name: 'Purok Sampaguita, Barangay Ibabang Iyam',
  city: 'Lucena City',
  province: 'Quezon',
  region: 'CALABARZON',
  zipCode: '4301',
};

// Admins: keys are used to reference authorId / verifiedBy.
export const ADMINS: SeedAdmin[] = [
  {
    adminId: 'adm-001',
    firstName: 'Ricardo',
    lastName: 'Dela Cruz',
    middleName: 'Santos',
    userName: 'r.cruz',
    emailAddress: 'ricardo.delacruz@kabarangayconnect.gov.ph',
    password: 'Admin@123',
    assignedRole: 'Admin',
    accountStatus: 'active',
    lastLogin: '2026-07-28T09:15:00Z',
  },
  {
    adminId: 'adm-002',
    firstName: 'Maria',
    lastName: 'Reyes',
    middleName: 'Lopez',
    userName: 'm.reyes',
    emailAddress: 'maria.reyes@kabarangayconnect.gov.ph',
    password: 'Moderator@123',
    assignedRole: 'Moderator',
    accountStatus: 'active',
    lastLogin: '2026-08-10T14:30:00Z',
  },
  {
    adminId: 'adm-003',
    firstName: 'Jose',
    lastName: 'Bautista',
    middleName: '',
    userName: 'j.bautista',
    emailAddress: 'jose.bautista@kabarangayconnect.gov.ph',
    password: 'Content@123',
    assignedRole: 'Content Admin',
    accountStatus: 'active',
    lastLogin: '2026-07-15T11:20:00Z',
  },
  {
    adminId: 'adm-004',
    firstName: 'Anna',
    lastName: 'Gonzales',
    middleName: 'Ramos',
    userName: 'a.gonzales',
    emailAddress: 'anna.gonzales@kabarangayconnect.gov.ph',
    password: 'Suspended@123',
    assignedRole: 'Moderator',
    accountStatus: 'suspended',
    lastLogin: '2026-06-20T08:45:00Z',
  },
];

export const OFFICIALS: SeedOfficial[] = [
  {
    officialId: 'off-001',
    fullName: 'Hon. Efren M. Villanueva',
    designatedPosition: 'Barangay Captain',
    contactNumber: '+639171234500',
    emailAddress: 'captain.villanueva@kabarangayconnect.gov.ph',
    officeLocation: 'Barangay Hall, Brgy. Ibabang Iyam, Lucena City',
    coreResponsibilities: [
      'Preside and manage the barangay assembly sessions',
      'Approve and sign official barangay documents and permits',
      'Oversee public safety, peacekeeping, and emergency response',
    ],
    profileImageUrl: 'https://s3.region.example.com/kbc/officials/off-001.png',
    isDeleted: false,
  },
  {
    officialId: 'off-002',
    fullName: 'Kagawad Lourdes D. Mercado',
    designatedPosition: 'Councilor - Peace & Order',
    contactNumber: '+639172345501',
    emailAddress: 'kagawad.mercado@kabarangayconnect.gov.ph',
    officeLocation: 'Barangay Hall, Brgy. Ibabang Iyam, Lucena City',
    coreResponsibilities: [
      'Lead the public safety committee and peace and order planning',
      'Coordinate with the barangay tanod and local police for patrols',
    ],
    profileImageUrl: 'https://s3.region.example.com/kbc/officials/off-002.png',
    isDeleted: false,
  },
  {
    officialId: 'off-003',
    fullName: 'Kagawad Tomas R. Agustin',
    designatedPosition: 'Councilor - Health & Sanitation',
    contactNumber: '+639173345502',
    emailAddress: 'kagawad.agustin@kabarangayconnect.gov.ph',
    officeLocation: 'Barangay Health Station, Brgy. Ibabang Iyam, Lucena City',
    coreResponsibilities: [
      'Supervise the barangay health station and immunization drives',
      'Organize cleanliness drives and waste segregation programs',
    ],
    profileImageUrl: 'https://s3.region.example.com/kbc/officials/off-003.png',
    isDeleted: false,
  },
  {
    officialId: 'off-004',
    fullName: 'Secretary Luz M. Palacio',
    designatedPosition: 'Barangay Secretary',
    contactNumber: '+639174345503',
    emailAddress: 'secretary.palacio@kabarangayconnect.gov.ph',
    officeLocation: 'Barangay Hall, Brgy. Ibabang Iyam, Lucena City',
    coreResponsibilities: [
      'Maintain official records, minutes, and document requests',
      'Process civil registrations and barangay certification requests',
    ],
    profileImageUrl: 'https://s3.region.example.com/kbc/officials/off-004.png',
    isDeleted: false,
  },
  {
    officialId: 'off-005',
    fullName: 'Treasurer Carmen V. Alonzo',
    designatedPosition: 'Barangay Treasurer',
    contactNumber: '+639175345504',
    emailAddress: 'treasurer.alonzo@kabarangayconnect.gov.ph',
    officeLocation: 'Barangay Hall, Brgy. Ibabang Iyam, Lucena City',
    coreResponsibilities: [
      'Record and manage barangay income and disbursements',
      'Issue official receipts for payments and fees',
    ],
    profileImageUrl: 'https://s3.region.example.com/kbc/officials/off-005.png',
    isDeleted: false,
  },
  {
    officialId: 'off-006',
    fullName: 'Kagawad Andres S. Villar',
    designatedPosition: 'Councilor - Infrastructure',
    contactNumber: '+639176345505',
    emailAddress: 'kagawad.villar@kabarangayconnect.gov.ph',
    officeLocation: 'Barangay Hall, Brgy. Ibabang Iyam, Lucena City',
    coreResponsibilities: [
      'Monitor road, drainage, and public facility maintenance',
      'Prioritize infrastructure repair requests from residents',
    ],
    profileImageUrl: 'https://s3.region.example.com/kbc/officials/off-006.png',
    isDeleted: true, // archived official kept for history
  },
];

export const RESIDENTS: SeedResident[] = [
  {
    residentId: 'res-001',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    middleName: 'Santos',
    suffix: 'Jr.',
    emailAddress: 'juan.delacruz@gmail.com',
    contactNumber: '+639181234567',
    houseUnitNumber: 'Lot 3',
    streetPurokName: 'Purok 1',
    password: 'Resident@123',
    profileImageUrl: 'https://s3.region.example.com/kbc/residents/res-001.png',
    accountStatus: 'active',
  },
  {
    residentId: 'res-002',
    firstName: 'Maria',
    lastName: 'Santos',
    middleName: 'Reyes',
    emailAddress: 'maria.santos@yahoo.com',
    contactNumber: '+639182345678',
    houseUnitNumber: 'Unit 8-B',
    streetPurokName: 'Purok 2',
    password: 'Resident@123',
    profileImageUrl: 'https://s3.region.example.com/kbc/residents/res-002.png',
    accountStatus: 'active',
  },
  {
    residentId: 'res-003',
    firstName: 'Jose',
    lastName: 'Manalo',
    middleName: '',
    suffix: 'Sr.',
    emailAddress: 'jose.manalo@outlook.com',
    contactNumber: '+639183456789',
    houseUnitNumber: 'House 12',
    streetPurokName: 'Purok 3',
    password: 'Resident@123',
    accountStatus: 'active',
  },
  {
    residentId: 'res-004',
    firstName: 'Ana',
    lastName: 'Reyes',
    middleName: 'Cruz',
    emailAddress: 'ana.reyes@gmail.com',
    contactNumber: '+639184567890',
    houseUnitNumber: 'Blk 2, Lot 15',
    streetPurokName: 'Purok 4',
    password: 'Resident@123',
    accountStatus: 'active',
  },
  {
    residentId: 'res-005',
    firstName: 'Pedro',
    lastName: 'Lim',
    middleName: 'Tan',
    emailAddress: 'pedro.lim@gmail.com',
    contactNumber: '+639185678901',
    houseUnitNumber: 'Unit 22-C',
    streetPurokName: 'Purok 1',
    password: 'Resident@123',
    accountStatus: 'active',
  },
  {
    residentId: 'res-006',
    firstName: 'Luisa',
    lastName: 'Torres',
    middleName: 'Dizon',
    emailAddress: 'luisa.torres@gmail.com',
    contactNumber: '+639186789012',
    houseUnitNumber: 'House 45',
    streetPurokName: 'Purok 2',
    password: 'Resident@123',
    accountStatus: 'suspended',
  },
  {
    residentId: 'res-007',
    firstName: 'Miguel',
    lastName: 'Fernandez',
    middleName: 'Ocampo',
    suffix: 'III',
    emailAddress: 'miguel.fernandez@gmail.com',
    contactNumber: '+639187890123',
    houseUnitNumber: 'Lot 9',
    streetPurokName: 'Purok 3',
    password: 'Resident@123',
    accountStatus: 'active',
  },
  {
    residentId: 'res-008',
    firstName: 'Carmen',
    lastName: 'Navarro',
    middleName: '',
    emailAddress: 'carmen.navarro@yahoo.com',
    contactNumber: '+639188901234',
    houseUnitNumber: 'Unit 5',
    streetPurokName: 'Purok 4',
    password: 'Resident@123',
    accountStatus: 'active',
  },
  {
    residentId: 'res-009',
    firstName: 'Ramon',
    lastName: 'Domingo',
    middleName: 'Salazar',
    emailAddress: 'ramon.domingo@gmail.com',
    contactNumber: '+639189012345',
    houseUnitNumber: 'House 67',
    streetPurokName: 'Purok 1',
    password: 'Resident@123',
    accountStatus: 'active',
  },
  {
    residentId: 'res-010',
    firstName: 'Elena',
    lastName: 'Mendoza',
    middleName: 'Villanueva',
    emailAddress: 'elena.mendoza@gmail.com',
    contactNumber: '+639190123456',
    houseUnitNumber: 'Blk 5, Lot 30',
    streetPurokName: 'Purok 2',
    password: 'Resident@123',
    accountStatus: 'active',
  },
];

export const ANNOUNCEMENTS: SeedAnnouncement[] = [
  {
    announcementId: 'ann-001',
    titleText: 'Barangay-wide Cleanup Drive',
    descriptionContent:
      'Join the monthly cleanup drive this Saturday. Volunteers are welcome. We will gather at the barangay hall at 6:00 AM for registration and assignment of areas.',
    priorityLevel: 'medium',
    authorKey: 'adm-003',
    imageUrl: 'https://s3.region.example.com/kbc/announcements/ann-001.jpg',
    eventDate: '2026-08-22T22:00:00.000Z',
    isHidden: false,
  },
  {
    announcementId: 'ann-002',
    titleText: 'Free Medical Mission for Residents',
    descriptionContent:
      'In partnership with the City Health Office, free check-ups, dental services, and free medicines will be available at the barangay health station.',
    priorityLevel: 'high',
    authorKey: 'adm-003',
    imageUrl: 'https://s3.region.example.com/kbc/announcements/ann-002.jpg',
    eventDate: '2026-08-28T01:00:00.000Z',
    isHidden: false,
  },
  {
    announcementId: 'ann-003',
    titleText: 'Typhoon Preparedness Advisory',
    descriptionContent:
      'Residents in flood-prone areas, especially along Purok 4 creek, are advised to prepare their evacuation kits and stay updated on weather bulletins.',
    priorityLevel: 'high',
    authorKey: 'adm-002',
    imageUrl: 'https://s3.region.example.com/kbc/announcements/ann-003.jpg',
    eventDate: '2026-08-18T00:00:00.000Z',
    isHidden: false,
  },
  {
    announcementId: 'ann-004',
    titleText: 'Sangguniang Barangay Regular Session',
    descriptionContent:
      'The regular barangay council session will be held to discuss the proposed infrastructure projects for the year.',
    priorityLevel: 'low',
    authorKey: 'adm-001',
    eventDate: '2026-08-19T09:00:00.000Z',
    isHidden: false,
  },
  {
    announcementId: 'ann-005',
    titleText: 'Barangay-wide Dengue Fogging Schedule',
    descriptionContent:
      'Fogging operations will be conducted to reduce dengue cases. Please keep doors and windows closed during your purok schedule.',
    priorityLevel: 'medium',
    authorKey: 'adm-002',
    imageUrl: 'https://s3.region.example.com/kbc/announcements/ann-005.jpg',
    isHidden: true, // hidden draft
  },
];

export interface SeedIncident {
  incidentId: string;
  residentKey: string;
  incidentCategory:
    | 'Fire'
    | 'Flood'
    | 'Medical Emergency'
    | 'Criminal Activity'
    | 'Road Accident'
    | 'Domestic Dispute'
    | 'Infrastructure Damage'
    | 'Public Disturbance'
    | 'Other';
  descriptionText: string;
  locationDetails: string;
  triagePriority: 'Critical' | 'High' | 'Medium' | 'Low';
  evidenceMediaUrls: string[];
  incidentStatus: 'Pending' | 'Responding' | 'Resolved' | 'Closed';
  reportedAt: string;
}

export const INCIDENTS: SeedIncident[] = [
  {
    incidentId: 'inc-001',
    residentKey: 'res-001',
    incidentCategory: 'Fire',
    descriptionText:
      'A grassfire broke out in the empty lot along Purok 1 near the creek. Flames are spreading quickly and threaten nearby houses.',
    locationDetails: 'Empty lot along Purok 1, near the creek',
    triagePriority: 'Critical',
    evidenceMediaUrls: [
      'https://s3.region.example.com/kbc/evidence/inc-001-photo1.jpg',
      'https://s3.region.example.com/kbc/evidence/inc-001-video.mp4',
    ],
    incidentStatus: 'Responding',
    reportedAt: '2026-08-12T02:30:00.000Z',
  },
  {
    incidentId: 'inc-002',
    residentKey: 'res-004',
    incidentCategory: 'Flood',
    descriptionText:
      'Rising floodwater in Purok 4 has reached waist-deep level after heavy rain. Some elderly residents are stranded in their homes.',
    locationDetails: 'Low-lying area of Purok 4',
    triagePriority: 'High',
    evidenceMediaUrls: [
      'https://s3.region.example.com/kbc/evidence/inc-002-photo1.jpg',
    ],
    incidentStatus: 'Responding',
    reportedAt: '2026-08-12T04:05:00.000Z',
  },
  {
    incidentId: 'inc-003',
    residentKey: 'res-003',
    incidentCategory: 'Medical Emergency',
    descriptionText:
      'An elderly resident collapsed and is unresponsive. May need an ambulance and immediate first aid.',
    locationDetails: 'House 12, Purok 3',
    triagePriority: 'Critical',
    evidenceMediaUrls: [],
    incidentStatus: 'Pending',
    reportedAt: '2026-08-11T10:12:00.000Z',
  },
  {
    incidentId: 'inc-004',
    residentKey: 'res-010',
    incidentCategory: 'Road Accident',
    descriptionText:
      'A motorcycle and a tricycle collided at the corner of Purok 2 road. No serious injuries reported but traffic is blocked.',
    locationDetails: 'Corner of Purok 2 road and national highway',
    triagePriority: 'Medium',
    evidenceMediaUrls: [
      'https://s3.region.example.com/kbc/evidence/inc-004-photo1.jpg',
    ],
    incidentStatus: 'Resolved',
    reportedAt: '2026-08-09T06:48:00.000Z',
  },
  {
    incidentId: 'inc-005',
    residentKey: 'res-002',
    incidentCategory: 'Criminal Activity',
    descriptionText:
      'Suspicious individuals were seen loitering near the store in Purok 2. A resident reported a possible attempt of theft.',
    locationDetails: 'Corner store, Purok 2',
    triagePriority: 'Medium',
    evidenceMediaUrls: [
      'https://s3.region.example.com/kbc/evidence/inc-005-photo1.jpg',
    ],
    incidentStatus: 'Resolved',
    reportedAt: '2026-08-08T22:20:00.000Z',
  },
  {
    incidentId: 'inc-006',
    residentKey: 'res-007',
    incidentCategory: 'Domestic Dispute',
    descriptionText:
      'A heated argument between neighbors escalated into a physical altercation on the street. Tanod intervention requested.',
    locationDetails: 'Street in Purok 3',
    triagePriority: 'High',
    evidenceMediaUrls: [],
    incidentStatus: 'Closed',
    reportedAt: '2026-08-06T15:40:00.000Z',
  },
];

export interface SeedAnnouncementRef {
  announcementId: string;
  authorKey: string;
}

export const ANNOUNCEMENT_REFS: Record<string, SeedAnnouncementRef> = Object.fromEntries(
  ANNOUNCEMENTS.map((a) => [a.announcementId, { announcementId: a.announcementId, authorKey: a.authorKey }])
);

export interface SeedTimelineStep {
  step: string;
  date: string;
  status: string;
}

export interface SeedDocumentRequest {
  requestId: string;
  residentKey: string;
  documentType: string;
  purpose: string;
  verificationIdUrl?: string;
  currentStatus:
    | 'Submitted'
    | 'Processing'
    | 'Ready for Pickup'
    | 'Released'
    | 'Rejected';
  expectedCompletionDate: string;
  timeline: SeedTimelineStep[];
  paymentStatus: 'Unpaid' | 'Paid Offline';
  verifiedByKey?: string; // adminId
  verifiedAt?: string;
  officialReceiptNumber?: string;
  dateRequested: string;
}

export const DOCUMENT_REQUESTS: SeedDocumentRequest[] = [
  {
    requestId: 'req-001',
    residentKey: 'res-001',
    documentType: 'Barangay Clearance',
    purpose: 'Employment application requirement',
    verificationIdUrl: 'https://s3.region.example.com/kbc/verification/req-001-id.jpg',
    currentStatus: 'Processing',
    expectedCompletionDate: '2026-08-15T00:00:00.000Z',
    timeline: [
      { step: 'Submitted', date: '2026-08-12T01:00:00.000Z', status: 'completed' },
      { step: 'Verification', date: '2026-08-12T06:30:00.000Z', status: 'completed' },
      { step: 'Processing', date: '2026-08-13T00:00:00.000Z', status: 'in-progress' },
      { step: 'Ready for Pickup', date: '2026-08-15T00:00:00.000Z', status: 'pending' },
    ],
    paymentStatus: 'Paid Offline',
    verifiedByKey: 'adm-002',
    verifiedAt: '2026-08-12T07:00:00.000Z',
    officialReceiptNumber: 'OR-2026-0001',
    dateRequested: '2026-08-12T01:00:00.000Z',
  },
  {
    requestId: 'req-002',
    residentKey: 'res-004',
    documentType: 'Certificate of Indigency',
    purpose: 'Financial assistance from DSWD',
    verificationIdUrl: 'https://s3.region.example.com/kbc/verification/req-002-id.jpg',
    currentStatus: 'Ready for Pickup',
    expectedCompletionDate: '2026-08-14T00:00:00.000Z',
    timeline: [
      { step: 'Submitted', date: '2026-08-10T02:30:00.000Z', status: 'completed' },
      { step: 'Verification', date: '2026-08-10T09:00:00.000Z', status: 'completed' },
      { step: 'Processing', date: '2026-08-11T00:00:00.000Z', status: 'completed' },
      { step: 'Ready for Pickup', date: '2026-08-13T00:00:00.000Z', status: 'completed' },
    ],
    paymentStatus: 'Unpaid',
    dateRequested: '2026-08-10T02:30:00.000Z',
  },
  {
    requestId: 'req-003',
    residentKey: 'res-002',
    documentType: 'Barangay Clearance',
    purpose: 'Business permit application',
    verificationIdUrl: 'https://s3.region.example.com/kbc/verification/req-003-id.jpg',
    currentStatus: 'Processing',
    expectedCompletionDate: '2026-08-18T00:00:00.000Z',
    timeline: [
      { step: 'Submitted', date: '2026-08-11T05:00:00.000Z', status: 'completed' },
      { step: 'Verification', date: '2026-08-11T10:00:00.000Z', status: 'completed' },
      { step: 'Processing', date: '2026-08-12T00:00:00.000Z', status: 'in-progress' },
      { step: 'Ready for Pickup', date: '2026-08-18T00:00:00.000Z', status: 'pending' },
    ],
    paymentStatus: 'Paid Offline',
    verifiedByKey: 'adm-001',
    verifiedAt: '2026-08-11T11:00:00.000Z',
    officialReceiptNumber: 'OR-2026-0002',
    dateRequested: '2026-08-11T05:00:00.000Z',
  },
  {
    requestId: 'req-004',
    residentKey: 'res-010',
    documentType: 'Barangay Certification',
    purpose: 'Proof of residency for school enrollment',
    currentStatus: 'Released',
    expectedCompletionDate: '2026-08-13T00:00:00.000Z',
    timeline: [
      { step: 'Submitted', date: '2026-08-09T03:20:00.000Z', status: 'completed' },
      { step: 'Verification', date: '2026-08-09T08:00:00.000Z', status: 'completed' },
      { step: 'Processing', date: '2026-08-10T00:00:00.000Z', status: 'completed' },
      { step: 'Ready for Pickup', date: '2026-08-12T00:00:00.000Z', status: 'completed' },
    ],
    paymentStatus: 'Unpaid',
    dateRequested: '2026-08-09T03:20:00.000Z',
  },
  {
    requestId: 'req-005',
    residentKey: 'res-007',
    documentType: 'Barangay Clearance',
    purpose: 'Police clearance substitute for employment',
    verificationIdUrl: 'https://s3.region.example.com/kbc/verification/req-005-id.jpg',
    currentStatus: 'Submitted',
    expectedCompletionDate: '2026-08-17T00:00:00.000Z',
    timeline: [
      { step: 'Submitted', date: '2026-08-13T00:30:00.000Z', status: 'completed' },
      { step: 'Verification', date: '2026-08-13T00:30:00.000Z', status: 'pending' },
      { step: 'Processing', date: '2026-08-14T00:00:00.000Z', status: 'pending' },
      { step: 'Ready for Pickup', date: '2026-08-17T00:00:00.000Z', status: 'pending' },
    ],
    paymentStatus: 'Unpaid',
    dateRequested: '2026-08-13T00:30:00.000Z',
  },
];

export interface SeedChatSession {
  sessionId: string;
  incidentKey: string;
  residentKey: string;
  adminKey: string; // responder
  isActive: boolean;
  deviceInfo: { os: string; browser: string; model: string };
  ipAddress: string;
  messageCount: number;
  startedAt: string;
  lastActivity: string;
}

export const CHAT_SESSIONS: SeedChatSession[] = [
  {
    sessionId: 'chat-001',
    incidentKey: 'inc-001',
    residentKey: 'res-001',
    adminKey: 'adm-001',
    isActive: true,
    deviceInfo: { os: 'Android 14', browser: 'Chrome Mobile', model: 'Xiaomi Redmi Note 12' },
    ipAddress: '192.168.1.101',
    messageCount: 4,
    startedAt: '2026-08-12T02:31:00.000Z',
    lastActivity: '2026-08-12T02:41:00.000Z',
  },
  {
    sessionId: 'chat-002',
    incidentKey: 'inc-003',
    residentKey: 'res-003',
    adminKey: 'adm-002',
    isActive: true,
    deviceInfo: { os: 'iOS 17', browser: 'Safari Mobile', model: 'iPhone 13' },
    ipAddress: '192.168.1.115',
    messageCount: 6,
    startedAt: '2026-08-11T10:13:00.000Z',
    lastActivity: '2026-08-11T10:35:00.000Z',
  },
  {
    sessionId: 'chat-003',
    incidentKey: 'inc-002',
    residentKey: 'res-004',
    adminKey: 'adm-001',
    isActive: true,
    deviceInfo: { os: 'Android 13', browser: 'Chrome Mobile', model: 'Samsung Galaxy A54' },
    ipAddress: '192.168.1.132',
    messageCount: 5,
    startedAt: '2026-08-12T04:06:00.000Z',
    lastActivity: '2026-08-12T04:20:00.000Z',
  },
  {
    sessionId: 'chat-004',
    incidentKey: 'inc-004',
    residentKey: 'res-010',
    adminKey: 'adm-003',
    isActive: false,
    deviceInfo: { os: 'Android 12', browser: 'Firefox Mobile', model: 'Vivo Y22' },
    ipAddress: '192.168.1.145',
    messageCount: 3,
    startedAt: '2026-08-09T06:50:00.000Z',
    lastActivity: '2026-08-09T07:02:00.000Z',
  },
];

export interface SeedMessage {
  messageId: string;
  sessionKey: string;
  senderKey: string;
  isUser: boolean;
  messageText: string;
  formattedContent: string;
  urgencyFlag: boolean;
  sentTimestamp: string;
}

export const MESSAGES: SeedMessage[] = [
  // chat-001: fire incident
  {
    messageId: 'msg-001',
    sessionKey: 'chat-001',
    senderKey: 'res-001',
    isUser: true,
    messageText: 'Fire is spreading fast near Purok 1, please send help immediately!',
    formattedContent: '<p>Fire is spreading fast near Purok 1, please send help immediately!</p>',
    urgencyFlag: true,
    sentTimestamp: '2026-08-12T02:31:00.000Z',
  },
  {
    messageId: 'msg-002',
    sessionKey: 'chat-001',
    senderKey: 'adm-001',
    isUser: false,
    messageText: 'We have dispatched the fire brigade. Evacuate to the barangay hall.',
    formattedContent: '<p>We have dispatched the fire brigade. Evacuate to the barangay hall.</p>',
    urgencyFlag: true,
    sentTimestamp: '2026-08-12T02:33:00.000Z',
  },
  {
    messageId: 'msg-003',
    sessionKey: 'chat-001',
    senderKey: 'res-001',
    isUser: true,
    messageText: 'Thank you. How long until they arrive?',
    formattedContent: '<p>Thank you. How long until they arrive?</p>',
    urgencyFlag: false,
    sentTimestamp: '2026-08-12T02:35:00.000Z',
  },
  {
    messageId: 'msg-004',
    sessionKey: 'chat-001',
    senderKey: 'adm-001',
    isUser: false,
    messageText: 'Estimated 5 minutes. Stay safe and keep a safe distance.',
    formattedContent: '<p>Estimated 5 minutes. Stay safe and keep a safe distance.</p>',
    urgencyFlag: false,
    sentTimestamp: '2026-08-12T02:41:00.000Z',
  },
  // chat-002: medical emergency
  {
    messageId: 'msg-005',
    sessionKey: 'chat-002',
    senderKey: 'res-003',
    isUser: true,
    messageText: 'EMERGENCY! My grandmother collapsed and is not breathing well.',
    formattedContent: '<p><strong>EMERGENCY!</strong> My grandmother collapsed and is not breathing well.</p>',
    urgencyFlag: true,
    sentTimestamp: '2026-08-11T10:13:00.000Z',
  },
  {
    messageId: 'msg-006',
    sessionKey: 'chat-002',
    senderKey: 'adm-002',
    isUser: false,
    messageText: 'Ambulance has been called. Please check if she is conscious.',
    formattedContent: '<p>Ambulance has been called. Please check if she is conscious.</p>',
    urgencyFlag: true,
    sentTimestamp: '2026-08-11T10:15:00.000Z',
  },
  {
    messageId: 'msg-007',
    sessionKey: 'chat-002',
    senderKey: 'res-003',
    isUser: true,
    messageText: 'She is unconscious but still breathing. What should I do?',
    formattedContent: '<p>She is unconscious but still breathing. What should I do?</p>',
    urgencyFlag: true,
    sentTimestamp: '2026-08-11T10:17:00.000Z',
  },
  {
    messageId: 'msg-008',
    sessionKey: 'chat-002',
    senderKey: 'adm-002',
    isUser: false,
    messageText: 'Turn her on her side to keep the airway open. Paramedics arrive shortly.',
    formattedContent: '<p>Turn her on her side to keep the airway open. Paramedics arrive shortly.</p>',
    urgencyFlag: true,
    sentTimestamp: '2026-08-11T10:35:00.000Z',
  },
  {
    messageId: 'msg-009',
    sessionKey: 'chat-002',
    senderKey: 'res-003',
    isUser: true,
    messageText: 'Paramedics are here now. Thank you for the help.',
    formattedContent: '<p>Paramedics are here now. Thank you for the help.</p>',
    urgencyFlag: false,
    sentTimestamp: '2026-08-11T10:45:00.000Z',
  },
];

export interface SeedNotification {
  notificationId: string;
  recipientKey: string;
  notificationCategory: 'incidentAlert' | 'documentUpdate' | 'systemMessage';
  titleText: string;
  messageBody: string;
  referenceUrlId?: string;
  isRead: boolean;
  createdAt: string;
}

export const NOTIFICATIONS: SeedNotification[] = [
  {
    notificationId: 'not-001',
    recipientKey: 'adm-001',
    notificationCategory: 'incidentAlert',
    titleText: 'High Priority Incident Reported',
    messageBody: 'A Fire incident has been reported in Purok 1.',
    referenceUrlId: 'inc-001',
    isRead: true,
    createdAt: '2026-08-12T02:30:00.000Z',
  },
  {
    notificationId: 'not-002',
    recipientKey: 'res-001',
    notificationCategory: 'incidentAlert',
    titleText: 'Responders Assigned',
    messageBody: 'Barangay responders have been assigned to your reported Fire incident.',
    referenceUrlId: 'inc-001',
    isRead: false,
    createdAt: '2026-08-12T02:33:00.000Z',
  },
  {
    notificationId: 'not-003',
    recipientKey: 'adm-002',
    notificationCategory: 'incidentAlert',
    titleText: 'Critical Medical Emergency Reported',
    messageBody: 'A Medical Emergency incident has been reported in Purok 3.',
    referenceUrlId: 'inc-003',
    isRead: true,
    createdAt: '2026-08-11T10:12:00.000Z',
  },
  {
    notificationId: 'not-004',
    recipientKey: 'res-001',
    notificationCategory: 'documentUpdate',
    titleText: 'Document Request Updated',
    messageBody: 'Your Barangay Clearance request (req-001) is now Ready for Pickup.',
    referenceUrlId: 'req-001',
    isRead: false,
    createdAt: '2026-08-13T02:00:00.000Z',
  },
  {
    notificationId: 'not-005',
    recipientKey: 'res-004',
    notificationCategory: 'documentUpdate',
    titleText: 'Document Request Updated',
    messageBody: 'Your Certificate of Indigency request (req-002) is now Ready for Pickup.',
    referenceUrlId: 'req-002',
    isRead: true,
    createdAt: '2026-08-13T01:00:00.000Z',
  },
  {
    notificationId: 'not-006',
    recipientKey: 'res-001',
    notificationCategory: 'systemMessage',
    titleText: 'Account Verified',
    messageBody: 'Your KaBarangayConnect account has been verified. Welcome!',
    isRead: true,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    notificationId: 'not-007',
    recipientKey: 'adm-001',
    notificationCategory: 'systemMessage',
    titleText: 'Scheduled Maintenance',
    messageBody: 'The system will undergo scheduled maintenance on Sunday from 2:00 AM to 4:00 AM.',
    isRead: false,
    createdAt: '2026-08-14T00:00:00.000Z',
  },
];