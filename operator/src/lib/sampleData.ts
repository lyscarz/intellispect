import type {
  Asset,
  OperatorSession,
  InboxMessage,
  Certificate,
  ExperienceEntry,
} from '../types';

// Fallback fleet shown when the Supabase `machines` table isn't readable from
// the client (RLS) or is empty. Centred on Aarhus, DK. coords = [lng, lat].
function asset(
  id: string,
  name: string,
  brand: string,
  model: string,
  assetType: string,
  activity: Asset['activity'],
  lng: number,
  lat: number,
  fuel: number | null,
  hours: number | null
): Asset {
  return {
    assetId: id,
    accountId: null,
    name,
    brand,
    model,
    serialNumber: `SN-${id}`,
    assetType,
    lastSeen: '2026-06-25T07:40:00.000Z',
    activity,
    imageUrl: null,
    location: {
      coordinates: [lng, lat],
      address: { street: null, city: 'Aarhus', country: 'Denmark' },
      updatedAt: '2026-06-25T07:40:00.000Z',
    },
    insights: {
      fuelLevel: fuel,
      batteryStateOfChargePercent: null,
      cumulativeOperatingHours: hours,
      cumulativeEngineHours: hours,
    },
  };
}

export const SAMPLE_FLEET: Asset[] = [
  asset('1', 'Excavator 21', 'Caterpillar', '320', 'Excavator', 'WORKING', 10.2039, 56.1629, 78, 4120),
  asset('2', 'Telehandler 04', 'Manitou', 'MT 1840', 'Telehandler', 'IDLING', 10.2105, 56.1665, 54, 2310),
  asset('3', 'Wheel Loader 12', 'Volvo', 'L120H', 'Wheel Loader', 'WORKING', 10.1960, 56.1588, 41, 6890),
  asset('4', 'Dumper 07', 'Bell', 'B30E', 'Dumper', 'STOPPED', 10.2240, 56.1602, 88, 1540),
  asset('5', 'Compactor 02', 'Hamm', 'H 13i', 'Compactor', 'IDLING', 10.1885, 56.1701, 33, 980),
  asset('6', 'Generator 19', 'Atlas Copco', 'QAS 60', 'Generator', 'WORKING', 10.2150, 56.1540, 64, 12030),
  asset('7', 'Scissor Lift 31', 'JLG', '3246ES', 'Scissor Lift', 'STOPPED', 10.1990, 56.1720, 100, 760),
];

export const SAMPLE_SESSIONS: OperatorSession[] = [
  { id: 's1', machineName: 'Excavator 21', machineType: 'Excavator', brand: 'Caterpillar', date: '2026-06-24T06:30:00.000Z', segments: { drive: 312, idle: 78, stopped: 40 } },
  { id: 's2', machineName: 'Wheel Loader 12', machineType: 'Wheel Loader', brand: 'Volvo', date: '2026-06-23T07:05:00.000Z', segments: { drive: 245, idle: 120, stopped: 65 } },
  { id: 's3', machineName: 'Telehandler 04', machineType: 'Telehandler', brand: 'Manitou', date: '2026-06-21T08:10:00.000Z', segments: { drive: 180, idle: 45, stopped: 30 } },
  { id: 's4', machineName: 'Dumper 07', machineType: 'Dumper', brand: 'Bell', date: '2026-06-20T06:50:00.000Z', segments: { drive: 410, idle: 35, stopped: 25 } },
  { id: 's5', machineName: 'Excavator 21', machineType: 'Excavator', brand: 'Caterpillar', date: '2026-06-18T07:20:00.000Z', segments: { drive: 290, idle: 95, stopped: 55 } },
];

export const SAMPLE_INBOX: InboxMessage[] = [
  {
    id: 'm1',
    kind: 'license_request',
    from: 'Mette Sørensen',
    fromRole: 'Fleet owner',
    title: 'Driver’s license required',
    preview: 'Please upload your category C license before Monday.',
    body: 'Hi — to keep operating the Volvo L120H you need a valid category C license on file. Could you upload a photo of the front and back before Monday? Thanks.',
    time: '2026-06-25T06:15:00.000Z',
    unread: true,
    actionable: true,
  },
  {
    id: 'm2',
    kind: 'permission_grant',
    from: 'Lars Bak',
    fromRole: 'Site manager',
    title: 'Access to Excavator 21',
    preview: 'You’ve been granted access to CAT 320 on Site B.',
    body: 'You now have operating access to Excavator 21 (CAT 320) on Site B until 2026-07-15. The digital key is active on your account.',
    time: '2026-06-24T14:02:00.000Z',
    unread: true,
    actionable: false,
  },
  {
    id: 'm3',
    kind: 'health_report',
    from: 'HR — Trackunit',
    fromRole: 'Operations',
    title: 'Annual health report due',
    preview: 'Your yearly health declaration is due in 10 days.',
    body: 'Your annual health declaration expires on 2026-07-05. Please complete the form and submit it to operations to avoid an interruption to your assignments.',
    time: '2026-06-23T09:30:00.000Z',
    unread: false,
    actionable: true,
  },
  {
    id: 'm4',
    kind: 'question',
    from: 'Jonas Holm',
    fromRole: 'Operator',
    title: 'Telehandler attachment?',
    preview: 'Did you leave the fork carriage on the MT 1840?',
    body: 'Hey, taking over the Manitou after you — did you leave the fork carriage mounted or is it back in the container? Cheers.',
    time: '2026-06-22T16:45:00.000Z',
    unread: false,
    actionable: false,
  },
  {
    id: 'm5',
    kind: 'message',
    from: 'Dispatch',
    fromRole: 'Operations',
    title: 'Schedule for week 27',
    preview: 'Your assignments for next week are published.',
    body: 'Your assignments for week 27 are published. Monday–Wednesday on Site B (Excavator 21), Thursday–Friday on Site A (Wheel Loader 12).',
    time: '2026-06-21T11:00:00.000Z',
    unread: false,
    actionable: false,
  },
];

export const SAMPLE_CERTIFICATES: Certificate[] = [
  { id: 'c1', name: 'Driver’s license — Category C', issuer: 'Færdselsstyrelsen', expires: '2029-03-01', kind: 'license' },
  { id: 'c2', name: 'Excavator operator certificate', issuer: 'Dansk Byggeri', expires: '2027-11-20', kind: 'certificate' },
  { id: 'c3', name: 'Telehandler / rough-terrain', issuer: 'IPAF', expires: '2026-09-12', kind: 'certificate' },
  { id: 'c4', name: 'First aid', issuer: 'Red Cross', expires: null, kind: 'certificate' },
];

export const SAMPLE_EXPERIENCE: ExperienceEntry[] = [
  { type: 'Excavator', hours: 1240 },
  { type: 'Wheel Loader', hours: 860 },
  { type: 'Telehandler', hours: 540 },
  { type: 'Dumper', hours: 320 },
  { type: 'Compactor', hours: 145 },
];
