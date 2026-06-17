# King Intelligence — Skill Settings

This is the one place the config-driven King Intelligence skills read their per-user settings.
Fill in the values for your tools and the skills adapt to you. Each skill reads ONLY its own `##` section.
Anything you leave blank or as a `[placeholder]` falls back to safe, generic behavior, and the skill
will tell you, once, what to fill in. So you can start using everything today and tune this over time.

Format: plain `- key: value` lines under each skill heading. Keep the keys exactly as written.
This file lives in YOUR repo and is never shared. Edit it by hand any time.

---

## debrief
Tune the post-meeting debrief to your stack. Blank = that step is skipped or asks you instead.
- transcriptSource: paste          # where transcripts come from: otter | zoom | fathom | granola | paste
- crm:                              # your CRM: trello | hubspot | pipedrive | none  (blank = skip CRM logging)
- crmBoardId:                       # your CRM board/pipeline id, if any
- crmList.activeProspect:           # the list/stage name for "needs my help now" prospects
- crmList.futureProspect:           # the list/stage name for future/long-game prospects
- crmList.partner:                  # the list/stage name for partners / referral sources
- crmList.client:                   # the list/stage name for active clients
- crmLabels:                        # comma-separated labels you tag new cards with
- paymentsTool:                     # invoicing: stripe | quickbooks | square | none  (blank = just flag money owed)
- calendarTool:                     # google | outlook | none
- emailTool:                        # gmail | outlook | none
- emailDraftMethod:                 # how drafts get built: gws | mcp | none
- senderEmail: [your-email]         # the From address on drafted emails
- signatureFilePath:                # repo-relative path to your email signature HTML, if any
- voiceGuidePath:                   # repo-relative path/folder of your writing-voice guide, if any
- clientFolderRoot: clients/        # where per-client work lives
- clientFolderConvention: clients/<name>/   # your per-client folder shape
- clientRollupFile: clients/CLAUDE.md       # a rollup note across clients, if you keep one
- socialPublishTool: none           # auto-post the meeting as a LinkedIn post: blotato | playwright | none
- socialAccountId:                  # your social account id for the publish tool, if used
- socialIsPersonalFeed: true        # true = personal profile, false = a company page
- productResearchIndexPath:         # repo path to a research roster you append meeting intel to, if any

## end-session
Tune the session close-out. The memory folder and your git branch are found automatically, leave them out.
- registries: SKILLS.md, CONNECTIONS.md, TIME-SAVED.md   # root files to refresh; blank = skip
- registryPreserveSections:         # any hand-maintained "## " headings inside SKILLS.md to never regenerate
- knowledgeGraph:                   # an in-repo knowledge folder to update, e.g. knowledge/  (blank = skip)
- conveyorScript:                   # path to a memory-pruning script, if you have one  (blank = manual hygiene)
- folderLayoutDoc:                  # a folder-map doc to update when top-level folders change, if any
- memoryIndexFormat: newest-first   # how your memory index is ordered: pin-band | newest-first

## networking
Tune the calendar-filling networking skill.
- city: [your city, ST]             # home base for the search + radius
- homeZip: [your ZIP]               # the ZIP your drive-time radius is measured from
- radius: 30 min                    # how far you'll travel for an event
- calendarTool: none                # google | outlook | other | none  (none = hand you a list instead of auto-adding)
- selfEmail: [your-email]           # added as a guest so the Yes/No/Maybe RSVP prompt shows
- calendarColor: 9                  # the color id for the tentative holds (Google: 3 = purple, 9 = blue)
- icpProfile:                       # the buyer/peer mix you want, in your words
- metroCarveOut:                    # any exception to the radius (e.g. "nearby big city only if AI-focused")
- anchorsFile: references/networking-anchors.md   # where YOUR recurring rooms are defined (create as you add them)
