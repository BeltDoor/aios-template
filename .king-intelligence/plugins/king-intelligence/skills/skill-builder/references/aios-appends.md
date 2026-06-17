# AIOS append templates

Exact paste text for the two blocks `/skill-builder` bakes into a generated skill (§ 8 of SKILL.md). Substitute `<skill-name>` and `<manual_time_minutes>` from the spec and the manual-time baseline.

## Self-ping block (time-saver skills only)

Paste at the bottom of the generated SKILL.md. Skip entirely for exempt skills (deep-dives, setup, one-shot, build/meta tools).

```markdown
## Self-ping (do this at the end of every invocation)

Before you finish, increment the row in `TIME-SAVED.md`:

- Skill: `/<skill-name>`
- Manual time per use: <manual_time_minutes> min
- Increment "Total uses" by 1
- Recompute "Total saved (cumulative)" as `Total uses × <manual_time_minutes> min`
- Update "Last used" to today's date

If `/<skill-name>` doesn't have a row yet, add one with the same fields.
```

## Voice-read line (draft-related skills only)

Paste at the top of the generated SKILL.md body (right under the H1 and any 1-line purpose). "Draft-related" = the skill produces text the user sends or posts as themselves (email, social, SMS, scripts, customer copy), not internal summaries.

```markdown
> Before drafting, read the voice profile in your repo (commonly at `voice-profile/VOICE-PROFILE.md` and `voice-profile/EMAIL-VOICE.md`). The output must match the voice captured there.
```
