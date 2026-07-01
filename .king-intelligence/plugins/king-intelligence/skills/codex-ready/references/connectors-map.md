# Hosted services to Codex connectors

How the services a Claude Code repo reaches through claude.ai connectors map to Codex's own connectors. Verified against official OpenAI docs; an adversarial pass corrected two fabricated recipes, flagged below. The big picture: almost everything has a real Codex path now, so the old "hosted connectors are the hard part" worry mostly dissolved.

Two ways Codex connects to a service: a **first-party plugin** (browse with `/plugins` in the app or CLI, "Curated by OpenAI") or an **MCP server** (`codex mcp add <name> --url <url>`, or a `[mcp_servers.<name>]` block). Cloud features need a Plus plan or higher; no free tier.

| Service | Codex path | How |
|---|---|---|
| Gmail | First-party plugin | `/plugins` → Gmail → sign in |
| Google Drive (Docs/Sheets/Slides) | First-party plugin | `/plugins` → Google Drive → sign in (one connector covers all three) |
| Google Calendar | First-party plugin | `/plugins` → Google Calendar → sign in |
| Notion | First-party plugin (curated, launched 3/26/26) | `/plugins` → Notion → authorize |
| Zoom | First-party plugin (+ MCP) | `/plugins` → Zoom (meeting summaries, transcripts, recordings) |
| Stripe | MCP server | admin enables MCP at dashboard.stripe.com/settings/mcp, then `codex mcp add stripe --url https://mcp.stripe.com` |
| Vercel | MCP server | `codex mcp add vercel --url https://mcp.vercel.com` |
| Supabase | MCP server | `codex mcp add supabase --url https://mcp.supabase.com/mcp` (or run the local Supabase MCP in config.toml) |
| Cloudflare | MCP servers (13 domain-specific) | `codex mcp add cloudflare-<svc> --url https://<svc>.mcp.cloudflare.com/...`, add only what is needed |
| Otter.ai | MCP server | `codex mcp add otter --url https://mcp.otter.ai/mcp`, OAuth on first use |
| GitHub | Cloud connector + remote MCP | Cloud (PR review/background tasks): connect at chatgpt.com/codex/settings/environments. Local API: `codex mcp add github --url https://api.githubcopilot.com/mcp/ --bearer-token-env-var GITHUB_PAT_TOKEN` |

**Two fabrications the verification caught (do not repeat them):**
- There is NO `npx @github/github-mcp-server` package. Use the remote `https://api.githubcopilot.com/mcp/` server instead.
- Notion DOES have a first-party curated plugin; older "use the raw MCP server" advice is outdated.

**Method, not just the table:** for any service, check `/plugins` first (a first-party plugin is the least setup), then fall back to the vendor's official MCP server. If a service has neither (some niche tools), keep using its CLI or API as the repo does today. Always confirm the live page before quoting a URL or command; these move fast.
