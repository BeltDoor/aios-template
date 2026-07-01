# Codex pricing and plans (for the coaching step)

What to tell a non-technical owner deciding whether and how to pay for Codex. Verified against OpenAI's Codex pricing page; prices move, so confirm the live page before quoting exact numbers.

## The headline answer

**$20/month (ChatGPT Plus) is the place to start, and it already includes the top model.** Paying more does not get a smarter model; it only buys more usage before you hit a limit. So the decision is about volume, not capability.

## The tiers

- **Free / Go ($8):** limited. Not for real daily use.
- **Plus ($20):** Codex everywhere (VS Code, terminal, web), the frontier coding model plus the cheaper models, cloud task delegation, and PR code review.
- **Pro (from $100):** same models as Plus, just 5x the usage (a higher 20x tier costs more). A research-preview fast model is Pro-only.
- **Business (~$20-25/user):** Plus-level Codex usage plus admin controls, SSO, and a no-training guarantee. Worth it for compliance, not for more Codex headroom.

## How limits work

Usage is a rolling credit window (about 5 hours). Heavy users on the top model report hitting the Plus window in 1 to 2 hours of hard use. You can buy one-off credit top-ups instead of upgrading.

## What to recommend

1. Start on **$20 Plus**. Sign in to the Codex VS Code extension and CLI with the ChatGPT account, not an API key (an API key loses the cloud features).
2. Use it for two weeks. If the 5-hour limit keeps interrupting real work, move up to **$100 Pro** for 5x the runway. If it does not, stay at $20.
3. Only consider a pay-as-you-go API key for automation/CI, not for daily editor work.

## Subscription vs API key

The ChatGPT subscription is the right default for working in the editor: it includes the cloud features (PR review, background tasks) and gets new models first. An API key is billed per token, loses the cloud features, and suits headless automation. For an owner running Codex in VS Code, subscription wins.
