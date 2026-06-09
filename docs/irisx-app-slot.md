# Wrapping the inspection builder as an IrisX app

A decision-aid writeup so we can choose whether to ship the builder as a Trackunit IrisX app slot now, later, or never. **No code in here** — the runtime app already runs standalone at `/inspections`; this is about turning it into a Manager-embedded experience.

## What an IrisX app slot actually is

An IrisX app is an iframe Trackunit embeds inside Manager. Trackunit hosts the chrome (sidebar, header, account picker). We host the inner page at a public HTTPS URL. The two communicate via:

- **Initial context** — Trackunit injects `?accountId=…&userId=…&siteId=…&signature=…&ts=…` (or similar) into the iframe URL on load.
- **postMessage** — for runtime events like "account changed", "navigate to asset X", deep linking.

The slot itself is registered server-side by Trackunit. There is no self-service portal as of writing — you ask support to register it, the same admin app that gates the V2 API Keys we're already chasing for asset images.

## Why we'd want it

- The builder lives where fleet managers already work — no second login, no context switch.
- We can deep-link from a Manager asset page straight to a relevant inspection template.
- One auth funnel: Trackunit's session becomes our session.

## Why we might not need it yet

- The runtime mobile flow (`/m`) is the load-bearing surface for field users — IrisX doesn't help them.
- The builder works fine standalone. Magic-link Supabase auth covers internal admins for a PoC.
- Adding IrisX adds a dependency on Trackunit support tickets and on Manager's release cadence for the embedding harness.

Recommendation: **build it standalone first** (already done — `/inspections`). Add the IrisX wrap once we have one paying account that asks for it.

## What we'd need to build when we do wrap it

### 1. An embed-shaped route

A duplicate of `/inspections/*` under `/embed/inspections/*` that:

- Drops the existing AppShell sidebar.
- Drops top-level "back to dashboard" navigation (no Manager-iframe-busting links).
- Reads context from the initial query params or `postMessage` and stashes it in a React context provider.

The actual editor components (FormEditor, AssignmentPanel, etc.) are already prop-driven and can be reused as-is.

### 2. Iframe HTTP headers

In `next.config.js` add headers for `/embed/*`:

```js
async headers() {
  return [{
    source: '/embed/:path*',
    headers: [
      // Trackunit's iframe parent — confirm exact host with their integration team.
      { key: 'Content-Security-Policy', value: "frame-ancestors https://*.trackunit.com" },
      // Some browsers still honour X-Frame-Options; remove the global DENY for /embed.
      { key: 'X-Frame-Options', value: 'ALLOW-FROM https://manager.trackunit.com' },
    ],
  }];
}
```

### 3. Auth bridge

Two viable models:

**(a) Signed context exchange.** Trackunit hands us a signed JWT-ish payload containing their userId + accountId. We verify the signature (shared secret from registration), look up or auto-create the matching Supabase user, mint a Supabase session, set cookies, and render. The user never sees a login screen.

**(b) Account selector only.** The iframe forces Supabase magic-link login the first time, then the cookie carries the session across iframe loads. Simpler to ship; gives a second login the first time.

We'd go with (b) for v1 and revisit (a) once Trackunit confirms what context they actually post.

### 4. Account mapping

Trackunit `accountId` ↔ our `accounts.id` is a one-to-one mapping table (new column `accounts.trackunit_account_id`). The exchange route looks up by this column and creates an account on first use.

## What to ask Trackunit support

Bundle this with the V2 API Keys request so we only burn one ticket:

> Hi — we'd like to enable two things on our Trackunit account:
>
> 1. **API Keys app** in Manager → Administration. We need to create a `client_credentials` token with `asset.view` scope to call IrisX GraphQL (`https://iris.trackunit.com/api/graphql`) for asset images and richer telematics.
> 2. **IrisX app registration** for an internal inspection-builder app. We'll host it at `https://<our-domain>/embed/inspections`. Please share:
>    - The integration-team docs for the iframe context handshake (query params vs postMessage, signing scheme).
>    - The list of allowed iframe parents we should put in our `frame-ancestors` CSP.
>    - The slot-registration form / process.

## Decision gate

Don't build any of this until support gives us a slot. Until then the builder ships at the standalone URL and the mobile flow at `/m` carries the field experience. The wrap is small (one route group, one config block, one auth route) — a half-day of work once we have the handshake spec.
