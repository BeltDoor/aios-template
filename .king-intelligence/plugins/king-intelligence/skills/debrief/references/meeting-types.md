# Meeting Type Detection Rules

Auto-detect the meeting type from transcript content. Use these signal words and patterns to classify. If multiple types match, prefer the one with more signals.

## Types

### discovery
**Display name:** Discovery Call
**Signals:**
- First-time meeting (no prior conversation history in client CLAUDE.md)
- Discussion of services, pricing, proposals
- "What do you do?" / "Tell me about your business" / "How can I help?"
- Pain point exploration ("What's taking the most time?" / "What's frustrating you?")
- Pricing mentioned ("How much" / "$" / "budget" / "cost")
- Scheduling a follow-up or next meeting
- Client explains their business, team, or tech stack for the first time

### coaching
**Display name:** Coaching Session
**Signals:**
- Client already paying for coaching
- Screen sharing, tool installation, demos of the user's tools
- Teaching/explaining concepts ("MCP", "how this works", "let me show you")
- Troubleshooting technical issues (Node.js, Claude Code, extensions)
- Homework or action items assigned for next session
- "Session 1" / "Session 2" / "next session" language

### check-in
**Display name:** Check-in
**Signals:**
- Existing client relationship
- Status update on ongoing work
- "How's it going?" / "Any issues?" / "Update on..."
- Short meeting (under 20 minutes based on transcript length)
- No new scope or pricing discussed

### demo
**Display name:** Product Demo
**Signals:**
- User showing a product or service
- "Let me show you" / "Here's how it works" / "Watch this"
- Client reacting to features ("That's cool" / "How does that work?")
- Trial or next steps discussed after showing
- Screen sharing is one-directional (user showing)

### proposal-review
**Display name:** Proposal Review
**Signals:**
- Reviewing a document the user sent
- Pricing discussion with specific numbers
- Scope negotiation ("Can we add..." / "What about...")
- Contract or agreement language
- Decision timeline ("When can you start?" / "Let me think about it")

### onboarding
**Display name:** Onboarding Session
**Signals:**
- Client has already signed up or paid
- Setting up accounts, access, tools
- Walkthrough of the system
- "Here's how to..." / "Your login is..." / "First thing to do is..."
- Training on how to use something

### follow-up
**Display name:** Follow-Up Call
**Signals:**
- References a previous meeting ("Last time we talked about...")
- Checking on action items from before
- Doesn't fit other categories
- Not the first meeting, not a status check-in, not coaching

## Disambiguation

When the transcript matches multiple types:

1. **discovery + demo:** If it's a first meeting AND the user demos a product, classify as **discovery** (the demo was part of the discovery, not a standalone demo)
2. **coaching + demo:** If it's a paid session AND the user shows tools, classify as **coaching** (demos during coaching are teaching, not selling)
3. **check-in + follow-up:** If short (<20 min) and mostly status updates, classify as **check-in**. If longer and involves new discussion, classify as **follow-up**
4. **proposal-review + discovery:** If pricing/scope is the primary topic, classify as **proposal-review**. If pricing is briefly mentioned in a first meeting, classify as **discovery**
