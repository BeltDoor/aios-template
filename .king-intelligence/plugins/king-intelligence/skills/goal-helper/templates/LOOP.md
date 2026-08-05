# LOOP: <short name>

*Designed with /goal-helper on <date>. This is a reusable, editable spec, re-run it any time by pasting the /goal line at the bottom or by handing this file back to /goal-helper.*

## Goal

<The sharpened outcome: what's different in the world when this is done, the target result, and the scope line (what's in, what's out). From Stage 1.>

**Read first:** <files / notes the worker must read before starting, e.g. a folder CLAUDE.md or a knowledge/ note>

## Done = these checks

<From Stage 2. Each line is one check, tagged with its bucket.>

- [ ] *(hard check)* <objective pass/fail>
- [ ] *(hard check)* <objective pass/fail>
- [ ] *(judge)* <what the Opus judge scores against, specific enough that any AI would score it the same>
- [ ] *(your signoff)* <the user's final taste / business call>

## Who checks

- **Hard checks** run first, this session, and settle pass/fail before anything else.
- **Judge:** a second Claude helper on Opus 4.8 (a subagent, free on the subscription) scores the work against the checklist above and returns `VERDICT: pass | needs work` plus blocking issues.
- **Signoff:** the user.

## Guardrails

- Revise-limit per round: **<3>**
- Stop after: **<20>** turns
- Stop if stuck: same blocker twice, or a round with no real change → stop
- Budget: <rough time / effort ceiling>
- May touch: **<folder / files only>**
- Outward actions (send / post / deploy / charge / delete): **need the user's OK first**

## The loop shape

```
  do a round of work
        |
        v
  run the HARD checks  --- fail ---> revise (up to the limit) --+
        |                                                        |
       pass                                                      |
        |                                                        |
        v                                                        |
  Opus judge scores it  --- needs work ---> fix named issues ----+
        |
       pass
        |
        v
  User signs off  ----> DONE (show the evidence)

  Stops any time: checklist all green | turn cap | stuck twice | budget blown | outward action needs OK
```

## Paste-ready /goal line

```
/goal <sharpened goal + "every check in this loop's checklist passes">, or stop after <20> turns
```
