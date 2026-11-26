# GuruSocial — E-WIN Platform Feature & Route Matrix

Prepared: 26 November 2026. Classification per the master prompt: **public**,
**authenticated user**, **entitled user** (plan-gated where applicable),
**super-admin-only**, **internal service**.

| Route / Feature | Class | Server enforcement |
|---|---|---|
| `/` landing (hero, showcase, pillars, how-it-works, install, testimonials, FAQ) | public | static |
| `/pricing` (₦ plans), `/docs` (API/MCP docs) | public | static |
| `/auth` sign in / sign up / OAuth / hub-session redeem | public | Convex actions: `auth.signIn/signUp`, OAuth callbacks, `ewinAuth.provisionFromHub` (signed channel) |
| `/console` (Overview, Users, Roles & access, Messages, Broadcast, Audit, System) | **super-admin-only** | `adminOps.*` verify `adminToken` against `adminSessions` server-side; 12 h expiry |
| `/dashboard` overview | authenticated user | session token → `users` row |
| `/dashboard/composer` (AI generation) | authenticated user; pay-as-you-use via central wallet when enabled | `billing.preflight` (super-admin exempt server-side) → quote/hold/release/refund |
| `/dashboard/calendar`, `/dashboard/posts` | authenticated user | token-scoped queries |
| `/dashboard/approvals` | approver/admin/owner (RBAC `posts.approve`) | `assertPermission` in `workspaceExtra.decideApproval` + audit log |
| `/dashboard/inbox`, `/dashboard/messages`, `/dashboard/notifications` | authenticated user (participant-scoped) | RBAC `inbox.read` / `messages.read.participant` |
| `/dashboard/analytics`, `/dashboard/reports` | entitled user | token-scoped analytics queries |
| `/dashboard/listening` | entitled user | `assertPermission(analytics.read)` on keyword mutations |
| `/dashboard/agents`, `/dashboard/studio` | authenticated user | token-scoped |
| `/dashboard/crm`, `/dashboard/campaigns`, `/dashboard/channels` | authenticated user | token-scoped |
| `/dashboard/media` (R2 uploads) | authenticated user; delete requires `workspace.admin` | `assertPermission` in `workspaceExtra.remove` |
| `/dashboard/developer` (API keys) | authenticated user (owner/admin) | keys hashed at rest, shown once |
| `/dashboard/team`, `/dashboard/settings` | authenticated user | RBAC role checks |
| `/dashboard/ecosystem` (E-WIN hub: status, code, heartbeat, central wallet) | authenticated user | signed service channel for writes |
| `/dashboard/integrations` (Reverse Studio) | authenticated user | token-scoped harvest jobs |
| `/api/v1/posts` (GET/POST) | internal service (API key) | key hash verified server-side; sandbox keys never publish |
| `/mcp` (JSON-RPC tools) | internal service (MCP client) | key-scoped |
| `/integrations/ewin/{link,session,identity,report,revoke}` | internal service (hub) | HMAC-SHA256 + 5-min window + timing-safe compare, 4 KB cap, no-store |
| `/oauth/{google,github}/callback` | public | provider exchange server-side; secrets in Convex env |

## Super-admin data isolation proof points

- Admin console data is **never fetched** into user-view routes; admin queries live in `adminOps.*` and require the server session.
- Ordinary members cannot reach `/console` data: all reads/mutations reject without a valid `adminSessions` row.
- Role is not trusted from the client: permissions resolve from the server-side user record (`rbac.hasPermission`).
