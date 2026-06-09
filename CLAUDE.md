# IntelliCheck PoC — Claude Context

Next.js 14 (App Router) fleet visibility app pulling live machine data from Trackunit APIs.

## Running the app

```bash
npm run dev   # http://localhost:3000
```

## Key files

| File | Purpose |
|------|---------|
| `lib/trackunit-auth.ts` | Dual OAuth: V1 password grant (REST) + V2 client_credentials (GraphQL) |
| `lib/trackunit-api.ts` | Data layer — REST fleet fetch enriched with GQL images when available |
| `lib/types.ts` | Shared TypeScript types (`Asset`, `AssetLocation`, `AssetInsights`) |
| `app/page.tsx` | Fleet grid with offset pagination (`?page=N`) |
| `components/MachineCard.tsx` | Asset card — coloured placeholder when imageUrl is null |
| `components/LiveLocationModal.tsx` | 30s auto-refresh live location modal with Leaflet map |
| `app/api/assets/route.ts` | `GET /api/assets?page=N` |
| `app/api/assets/[id]/route.ts` | `GET /api/assets/:id` (used by LiveLocationModal) |
| `app/api/debug/route.ts` | `GET /api/debug` — tests both auth flows and reports token claims |
| `.env.local` | Credentials — **never commit this** |

## Auth architecture

### V1 — password grant (working)
- Endpoint: `https://auth.trackunit.com/token`
- Scope: `api` — covers all REST APIs (Asset API v2, AEMP 2.0)
- Env vars: `TRACKUNIT_CLIENT_ID`, `TRACKUNIT_CLIENT_SECRET`, `TRACKUNIT_API_USERNAME`, `TRACKUNIT_API_PASSWORD`, `TRACKUNIT_TOKEN_URL`

### V2 — client_credentials (pending — images blocked on this)
- Endpoint: `https://auth.trackunit.com/token/v2`
- Scope: `asset.view` — required for IrisX GraphQL (`https://iris.trackunit.com/api/graphql`)
- Env vars: `TRACKUNIT_GQL_CLIENT_ID`, `TRACKUNIT_GQL_CLIENT_SECRET`
- **Currently blank in `.env.local`** — the account needs the "API Keys" app enabled by Trackunit support
- App degrades gracefully: shows coloured initials placeholder instead of image

## Data sources

| Source | URL | Auth | Provides |
|--------|-----|------|----------|
| Asset API v2 | `https://iris.trackunit.com/api/asset/v2/assets` | V1 | name, brand, model, serialNumber, assetType |
| AEMP 2.0 (ISO 15143-3) | `https://iris.trackunit.com/public/api/aemp/v2/15143/-3/Fleet/{page}` | V1 | GPS location, operating hours, fuel, engine status |
| IrisX GraphQL | `https://iris.trackunit.com/api/graphql` | V2 only | images, street addresses, richer telematics |

Join key between Asset API and AEMP: `asset.serialNumber` ↔ `AempEquipment.EquipmentHeader.SerialNumber`

## Known facts / gotchas

- **Images are GraphQL-only.** The Asset API v2 and Machines API have no image field. Confirmed via OpenAPI spec — `MachineRepresentation` fields are: brand, category, externalReference, machineId, model, name, ownedBy, productionDate, readOnlyFields, score, unit, vin.
- **AEMP page 0 is empty metadata** — data starts at page 1. `fetchAllAemp()` starts from `/Fleet/1`.
- **GraphQL with V1 token returns 404 HTML** — Trackunit's gateway routes it to the Manager SPA when token lacks IrisX scope. The HTML contains `ecsSchemeConfig` JS. Not an endpoint error — it's an auth scope issue.
- Asset API uses Spring Boot pagination: `{ content: [], totalElements, totalPages }` — not `data[]`.
- `lastSeen` formatting uses deterministic UTC strings to avoid React hydration mismatches.
- `PAGE_SIZE = 50` in `trackunit-api.ts`.

## What's working

- Fleet grid with pagination (716 assets confirmed via GraphQL MCP)
- Asset metadata (name, brand, model, type)
- GPS location + operating hours via AEMP
- Activity status badge (WORKING / STOPPED / IDLE)
- Live location modal with 30s auto-refresh + Leaflet map
- Coloured placeholder cards when images unavailable

## What's pending

- **Machine images** — blocked on V2 API Keys being enabled for this Trackunit account. Once `TRACKUNIT_GQL_CLIENT_ID` + `TRACKUNIT_GQL_CLIENT_SECRET` are in `.env.local`, images will appear automatically — the enrichment code is already in place in `fetchGqlImages()`.
- Street-level address data also comes from GraphQL (currently showing coordinates only via AEMP)

## To unblock images

Ask Trackunit support: _"Can you enable the API Keys app in our Trackunit Manager account so we can create a client_credentials token with asset.view scope for IrisX GraphQL access?"_

Then fill in `.env.local`:
```
TRACKUNIT_GQL_CLIENT_ID=<from Manager → Administration → API Keys>
TRACKUNIT_GQL_CLIENT_SECRET=<from Manager → Administration → API Keys>
```
