# GuruSocial — Harmonization Audit (REA evidence map)

Method: authorized product/architecture research across the listed sites using
public documentation and observed product surfaces (evidence classes: E3
official docs, E2 observed pages, I inference). No proprietary code or assets
were copied; every capability below is reimplemented originally in this repo.

## Reference stack → GuruSocial implementation map

| Source | Audited capability (evidence) | GuruSocial implementation |
|---|---|---|
| social-api.ai | 13-platform unified API; posts, scheduling, replies, DMs, webhooks; plan tiers with profile counts; free tier (docs.social-api.ai, /pricing) | 15-platform unified model, plan field on users, profiles/posts/inbox/webhooks tables, per-platform delivery results |
| postmcpai.com | REST + MCP transports, OpenAPI export, per-network publishing quirks owned by provider (/api, /api-docs/transports, /docs/mcp) | Convex HTTP actions: `/api/v1/*` REST + `/mcp` JSON-RPC (initialize/tools list/call); publisher adapter layer owns per-network quirks |
| postproxy.dev | Posts/queues/profiles resources, sandbox mode on all plans, webhooks with per-platform outcomes, retries+logs (/reference/overview, /social-media-api) | queueSlots table + nextFreeSlot, `gs_sandbox_` keys returning dry-run validations, webhook registry, apiLogs with per-platform results |
| ayrshare.com | Single POST publishing across networks, analytics endpoints, API key auth | POST /api/v1/posts, /api/v1/analytics/top, Bearer keys with scopes |
| blotato.com | One-call create_post to 11 platforms; useNextFreeSlot; visuals from templates; content extraction from URL; MCP server (/social-media-api, /mcp, blog) | create_post MCP tool, next-free-slot scheduling, visualTemplates + studio page, extractFromUrl reader pipeline |
| buffer.com | Queue with recurring timeslots, composer, calendar | queueSlots grid, composer, weekly calendar view |
| sproutsocial.com | Unified inbox, analytics reports, competitor tracking | inbox cockpit with types (comment/dm/review/mention), analytics page with CSV export, competitors table |
| agorapulse.com | Approval workflows, team roles | posts.approve with notes/history, owner/admin/member/approver role matrix |
| sendible.com | Client workspaces, white-label-style structure | workspaces/members tables, brand kits, multi-profile plan tiers |
| metricool.com | Competitor benchmarks, best-time suggestions, audience growth | competitors CRUD, bestTimes() heuristics, audienceSnapshot series |
| manychat.com | Keyword-triggered DM/comment automations within platform windows | automations table (dm_reply/comment_reply/keyword_trigger), run log, inbox "Run automation" |
| gohighlevel.com | CRM pipeline stages, lead capture from conversations | contacts pipeline (lead→engaged→opportunity→customer→advocate→lost), inbox→CRM handoff |
| kalil0321/reverse-api-engineer | Browse/capture HAR → typed API client in 10 languages (README, skills) | Reverse Studio page + harvestJobs table + `sidecar/reverse-api-bridge.py` executing queued jobs via the RAE CLI; credential markers recorded by name only |

## Architecture notes

- **Client/server boundary**: the SvelteKit SPA holds presentation and the
  offline demo provider; Convex owns auth, domain data, publishing lifecycle,
  analytics aggregation and the public API/MCP surface.
- **Post lifecycle**: `draft → pending_approval → approved → scheduled →
  published | failed`, with per-platform `perPlatformResults` and attempt
  counts (PostProxy-style contract).
- **Secrets**: platform credentials are stored by reference
  (`vault://…`), API keys by hash; full keys are shown once at creation.
- **Sandbox safety**: sandbox keys execute the full validation path but never
  publish — mirroring Postproxy's "sandbox on all plans".
- **Unknowns / honest limits**: hosted OAuth connectors require per-platform
  app review (Meta, TikTok, X) before live publishing; model-backed generation
  is optional and requires the user's own LLM key; the RAE sidecar runs
  locally because browser capture cannot run server-side.

## Verification performed

- `npm run build` — clean static production build (Cloudflare Pages output).
- `svelte-check` — 0 errors, 0 warnings across 24 files.
- `tsc -p convex` — 0 errors across 13 backend modules.
- Browser E2E: signup → seeded dashboard → AI composer generation →
  schedule-to-queue-slot → calendar render → all 14 pages smoke-tested.
- PWA: manifest + service worker registered; viewport/burger verified.
