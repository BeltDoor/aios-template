# AIOS append templates

Exact paste text for the AIOS-specific blocks `/skill-builder` bakes into a generated skill (§ 8 of SKILL.md).

## Time-saved row seeding (time-saver skills only)

**Self-ping footers are retired.** Counting is deterministic now: the King Intelligence plugin's PostToolUse hook (`scripts/skill-count.mjs`) increments the skill's TIME-SAVED.md row on every Skill-tool invocation. Never add a "Self-ping" block or FIRST-USE stub to a generated skill; a prose footer would double-count against the hook.

What to do instead for a time-saver skill:

1. Seed its row in `TIME-SAVED.md` directly:

```markdown
| `/<skill-name>` | <manual_time_minutes> min | 0 | 0 min | never |
```

2. If the skill will ship to clients through the plugin, add `"<skill-name>": <floor_minutes>` to the marketplace repo's `plugins/king-intelligence/defaults/skill-minutes.json` at publish time, where `<floor_minutes>` is the competent-peer estimate with the x0.2 calibration, rounded DOWN to the nearest 5. A skill absent from that table counts uses at 0 minutes for clients, which is the honest default.

## Voice-read line (draft-related skills only)

Paste at the top of the generated SKILL.md body (right under the H1 and any 1-line purpose). "Draft-related" = the skill produces text the user sends or posts as themselves (email, social, SMS, scripts, customer copy), not internal summaries.

```markdown
> Before drafting, read `voice-profile/VOICE-PROFILE.md` and `EMAIL-VOICE.md` (or wherever your repo keeps its voice profile). The output must match the voice captured there.
```
