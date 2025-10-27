# Botpress Flow Wiring Guide

This guide shows how to wire your Botpress flow to accept the JWT from the webchat, initialize a session, greet the user using claims, and route to Admin/Tenant menus based on role.

## Prerequisites
- Your site already embeds the Botpress webchat and auto-sends the JWT after webchat init. This is implemented in `client/javascript/assistant-webchat.js` by emitting a `custom` event with `{ jwt }` when the widget is ready.
- Your backend endpoint `/api/v1/assistant/session/init` can return basic claims for the current user if needed. The frontend already calls this and passes claims into the webchat initialization.

## 1) Create two Actions: captureJwt and initSession

Create actions in your Botpress bot (in Studio > Code) named:
- `captureJwt`
- `initSession`

### Action: captureJwt
Purpose: Read the JWT sent from webchat and store it in conversation/session state for later use.

Suggested implementation (Botpress JS/TS action):

```ts
// actions/captureJwt.ts
import type { ActionProps } from '@botpress/sdk';

export default async function captureJwt({ event, client, state }: ActionProps) {
  try {
    // webchat sends: { type: 'custom', payload: { jwt } }
    const jwt = (event?.payload && (event as any).payload.jwt) || null;
    if (!jwt) return { success: false, reason: 'no-jwt' };

    // Store for later nodes (choose one or both scopes as needed)
    state.session.jwt = jwt;
    state.conversation.jwt = jwt;

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
```

Notes:
- If your plan is to decode claims inside Botpress, you can decode the JWT payload (Base64URL) and extract `role`, `display_name`, etc. Store them in `state.session.claims`.

Example minimal decode (no signature validation):

```ts
function decodeJwtPayload(jwt: string): any | null {
  try {
    const payload = jwt.split('.')[1];
    const decoded = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
```

### Action: initSession
Purpose: If you want Botpress to fetch user metadata/claims from your API using the JWT.

```ts
// actions/initSession.ts
import type { ActionProps } from '@botpress/sdk';

export default async function initSession({ client, state, bp }: ActionProps) {
  const jwt = state.session.jwt || state.conversation.jwt;
  if (!jwt) return { success: false, reason: 'no-jwt' };
  try {
    const res = await fetch(`${process.env.API_BASE ?? 'https://ambuloproperties-00d066e1316e.herokuapp.com/api'}/v1/assistant/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return { success: false, status: res.status };
    const data = await res.json();
    // Persist for later usage in flow
    state.session.claims = data?.claims ?? null;
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
```

Tip: You can also skip this action if your webchat already passes decoded claims to Botpress via a custom event—then just store them directly in `state.session.claims`.

## 2) Wire Start Node
On your Start node:
- Add Action: `captureJwt`
- Add Action: `initSession` (optional if you decode claims locally)
- Then add a short `Say` message, e.g.: "Welcome!"

This allows the Start node to immediately capture the JWT when the widget is ready and the custom event arrives.

## 3) Personalized Welcome
Create a node "Welcome" that uses a Short Text message:

```
Hello {{ session.claims.display_name || session.claims.name || 'there' }} 👋
How can I help you today?
```

Fallback if you didn’t store claims in session:
- Use `state.session.jwt` and decode payload (see helper above), then set `state.session.claims` in a small pre-action.

## 4) Role-based Routing
Add a Decision node "Route by Role" with a variable to check, for example:
- Variable: `session.claims.role` (or `session.claims.user_role`)
- Conditions:
  - If equals `ADMIN` or `MANAGER` or `STAFF` → go to "Admin Menu"
  - Else → go to "Tenant Menu"

Create two destination nodes:
- "Admin Menu" — buttons or quick replies like: Properties, Tenants, Payments, Maintenance, Messages
- "Tenant Menu" — buttons like: Lease Info, Make a Payment, Maintenance Request, Messages

Example Quick Reply content:
```
Please pick one:
- Properties
- Tenants
- Payments
- Maintenance
- Messages
```

## 5) Consuming the JWT Event
The site sends the JWT via webchat custom event after init. Ensure your bot listens to the `custom` event type. In Botpress, the "Start" node receives all events, but you can also add a Transition on event type equals `custom` and then run `captureJwt`.

Recommended:
- Keep `captureJwt` on Start node so the first custom event stores the JWT
- Subsequent nodes can rely on `session.jwt` / `session.claims`

## 6) Optional: Security Considerations
- Only decode JWT payload client-side for convenience; actual authorization must happen server-side
- Avoid using JWT payload for critical decisions without validation
- Expire or refresh claims in `state.session` if the chat lasts a long time

## 7) Troubleshooting
- If `session.jwt` is empty, confirm the webchat is initialized before `sendEvent` and that your bot receives `event.type === 'custom'`
- Log from your actions temporarily: `bp.logger.info(JSON.stringify({ event }))`
- Check browser devtools console for any CORS or network errors

## 8) Next Steps
- Map Admin/Tenant menu buttons to your REST APIs
- Add intents for common queries (rent due, maintenance status, etc.)
- Persist conversation context keyed by user_id from claims to create continuity
