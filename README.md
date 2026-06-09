# IntelliCheck — PoC

Fleet visibility app pulling live machine data from Trackunit.
Shows each machine's name, brand/model, fuel level, battery, operating hours,
engine hours, activity status, and a live location map with 30-second auto-refresh.

## What it demonstrates

- Trackunit machine list with images, metadata, and telematics
- Live GPS location on an OpenStreetMap map (no paid map API needed)
- Auto-refreshing location every 30 seconds per machine
- Clean machine cards with fuel/battery progress bars and status badges

## Prerequisites

- Node.js 18+
- A Trackunit account with at least one machine
- A Trackunit application registered at https://developers.trackunit.com

## Setup

**1. Get Trackunit credentials**

Go to https://developers.trackunit.com, sign in, and create a new Application.
Select "Client Credentials" as the grant type and note your `client_id` and `client_secret`.

**2. Configure environment**

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your `TRACKUNIT_CLIENT_ID` and `TRACKUNIT_CLIENT_SECRET`.

**3. Install dependencies**

```bash
npm install
```

**4. Run**

```bash
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add the four env vars from `.env.local` in the Vercel project settings.

## Architecture

```
app/
  page.tsx                  # Server component — fetches fleet, renders grid
  api/
    assets/route.ts         # GET /api/assets — all machines
    assets/[id]/route.ts    # GET /api/assets/:id — single machine (live refresh)

lib/
  trackunit-auth.ts         # OAuth client credentials token service (with caching)
  trackunit-api.ts          # GraphQL queries + data normalizers
  types.ts                  # TypeScript types

components/
  MachineCard.tsx           # Machine card with telematics + "Live Location" button
  LiveLocationModal.tsx     # Modal with auto-refreshing map
  MapView.tsx               # Leaflet map (client-side only, dynamic import)
  StatusBadge.tsx           # Working / Idling / Stopped badge
  TelematicsMetric.tsx      # Single metric with optional progress bar
```

## Next steps (beyond PoC)

- Add user authentication (NextAuth.js + Trackunit OAuth authorization code flow)
- Store machines in a database to support non-Trackunit assets
- Add inspection assignment and response submission
- Build the operator mobile app (React Native WebView wrapper)
- Add more telematics: oil pressure, coolant temp, hydraulic fluid level
# intellispect
# intellispect
