---
name: install-always-on-server
description: Set up a computer that runs your Claude all day and all night, so work happens while every machine you normally touch is asleep, and your second brain is reachable from your phone anywhere. Two paths, and Claude helps you pick with real evidence, not a sales pitch. Path 1 uses a computer you already own (a spare desktop or old laptop, costs nothing). Path 2 rents a small cloud server for a few dollars a month. Either way you finish with your second brain synced onto the always-on machine, one scheduled job proven to have run while you slept, and the door: a private connection that lets the Claude app on your phone and claude.ai read and work in your second brain with every computer of yours shut. Use when you say "set up an always-on computer", "I want Claude running 24/7", "run Claude while I sleep", "my automations stop when I close my laptop", "put Claude on my spare computer", "set up a server for Claude", "rent a server", "run this every morning without me", "I want my inbox sorted before I get up", "set up scheduled jobs", "the computer that never sleeps", or "Hetzner", even if you never say the words server or always-on. Not for simply checking on the Claude running on your main computer from your phone. That is /install-remote-control, takes two minutes, and needs no new machine. Not for browser automation either. That is /install-playwright.
allowed-tools: Bash, Read, Edit, Write
disable-model-invocation: false
---

# /install-always-on-server: the computer that never sleeps

*Provided as part of your King Intelligence engagement. Not for resale or redistribution.*

## What you get

When this setup is done, four things are true:

1. **A machine runs your Claude 24 hours a day.** Your laptop can sleep, travel, and close. The work continues.
2. **Your second brain lives on it and stays in sync with your main computer automatically**, both directions.
3. **One scheduled job does real work while you sleep**, and it proves itself by leaving something you can see in the morning.
4. **The door is open:** the Claude app on your phone and claude.ai on any browser can read your second brain, write to it, and start real jobs on the machine, from anywhere, with every computer of yours shut.

Two ways to get there. Read both before picking:

| | Cost | Setup | Best for |
|---|---|---|---|
| **Path 1: a computer you already own** | Nothing | An afternoon | You have a spare desktop or laptop and a spot to leave it plugged in |
| **Path 2: rent a small cloud server** | A few dollars a month | An afternoon, and a fiddlier one | No spare machine, or you want it out of your house and still running in a year without you thinking about it |

## Set expectations (read this first)

Say this to the user, out loud, before anything happens:

*"This is a real afternoon of work, two to three hours, and then three mornings of checking on it before you trust it. I run every command. Your jobs are: watch, approve, and click. On Path 2 there is exactly one thing only your hands do: entering your card at the server company's checkout, and I will tell you the cost out loud before you get there."*

Three more honest sentences that belong in the same breath:

- Expect it to break once in the first month. That is normal, not a sign you did it wrong.
- On Path 2, the lock-the-doors step is the least friendly part and where most people stop. Do not start it after dinner.
- Deciding against the whole thing is a fair result. An always-on machine is more to look after than the rest of your setup, and `/install-remote-control` gets you a good chunk of the benefit for two minutes of work and no upkeep.

## Already partly done? Start here

This build can span two sessions, so Claude locates the user on the map before touching anything. Check in this order; the first check that fails is where the run resumes:

```bash
tailscale status                                # is this machine on the private network yet?
ssh <boxuser>@<tailscale-ip> "echo alive"       # does an always-on machine already answer?
ssh <boxuser>@<tailscale-ip> "claude -p 'What is 12 times 12?'"   # is Claude signed in on it?
ssh <boxuser>@<tailscale-ip> "crontab -l"       # is a job already scheduled?
```

If all four pass, jump straight to "Prove it is done."

## Which path? (a real decision, not a sales pitch)

Ask these, plainly, one at a time:

1. Do you have a computer nobody else uses? It does not need to be fast.
2. Does it have a permanent spot: plugged in, out of the way, where nobody will tidy it away? Wired internet if possible.
3. Do you want zero new monthly bills, or is a small bill fine if the machine never gets unplugged?

Then say both numbers before recommending: *"Path 1 costs you nothing and an afternoon. Path 2 costs a few dollars a month and a slightly harder afternoon, and it lives in a data center where nothing ever unplugs it."* If they are torn, start with Path 1: it costs nothing and everything learned there transfers to Path 2 later. If they choose neither, run `/install-remote-control` instead and stop here. That is a real result, not a failure.

## Before we start (Claude checks these)

1. **A Claude Pro or Max subscription.** The always-on machine bills the existing plan, zero dollars extra. That is the whole design. If the user has neither, stop here and talk it through: without a subscription the machine would bill for every single use, and this build is not designed for that.
2. **The second brain's cloud backup is on.** Check: `git ls-remote origin` succeeds from inside the second-brain folder. Required for Path 2 (it is how the files travel); strongly recommended for Path 1. If it is off, switch it on first.
3. **Phone apps:** Tailscale (both paths) and Termius (Path 2). Both free.
4. Path 1 only: the spare machine at hand, its charger, and its spot chosen.
5. Path 2 only: a payment card, in the user's hands, never Claude's.

---

# Path 1: a computer you already own

### Step 1.1: Give it a home

Permanent spot, plugged in, wired internet if possible. Then a real physical step: put a note on the machine that says "always on, do not unplug." A family member tidying up is a documented way these setups die.

### Step 1.2: Turn off every sleep setting

The part people miss: the screen may sleep, the computer must not, and on a laptop, closing the lid must do nothing.

**Mac:** `sudo pmset -c sleep 0` (warn first: it asks for their computer password and nothing shows as they type; that blank prompt is normal). A Mac **laptop** that will sit with its lid closed needs one more: `sudo pmset -a disablesleep 1` — without it, closing the lid sleeps the machine no matter what else is set. Say the tradeoff: this stops the machine sleeping entirely until it is undone (`sudo pmset -a disablesleep 0`), which is exactly right for this job and wrong for a laptop that ever goes back in a bag. **Windows (PowerShell):** `powercfg /change standby-timeout-ac 0`, and set the lid-close action to "do nothing" in power settings.

Also turn on automatic login, so an overnight update reboot does not strand the machine at a login screen. Say the tradeoff out loud first: anyone who sits at this machine is in without a password. For a machine in a locked home doing this job, that is usually the right trade, but it is the user's call.

### Step 1.3: Claude Code and the toolkit on it

On Windows, install Git for Windows FIRST, before anything ever opens Claude. Older Claude Code versions quit with a wall of technical text without it, newer ones quietly fall back to a limited mode, and cloning the second brain needs Git either way. Then install Claude Code, sign in normally (this machine has a screen and a browser), and set up the second brain on it the same way as the main machine: clone it from the cloud backup, then confirm the toolkit loads by typing one slash command from inside the folder.

### Step 1.4: The private network

Tailscale on this machine, the main computer, and the phone, all signed into the same Tailscale account (free). On a Mac, install it with the standalone installer from tailscale.com/download, **not** the App Store copy — only the standalone one gives the terminal the `tailscale` command that the door and its kill switch use later. Note this machine's Tailscale address (looks like `100.x.y.z`). From now on that address is its name.

### Step 1.5: Keep the files in sync

If the cloud backup is on (the normal case): give this machine its own git identity so anyone can tell which machine made a change, then schedule the sync script from Path 2 Step 2.6 every 30 minutes. If the user's backup is a cloud drive (OneDrive, iCloud, Dropbox) instead: install that same drive client here and let it do the syncing.

### Step 1.6: Phone access

Run `/install-remote-control` **on this machine**. The Claude app on the phone then shows this machine's session directly; two minutes, no terminal involved. One honest note: that phone path uses the normal sign-in, which expires every so often and needs a re-login at the machine. The scheduled job below does not share that problem; its token lasts a year (Step 1.7).

### Step 1.7: The job's own sign-in

A scheduled job must survive the interactive sign-in expiring. Mint a 1-year token: run `claude setup-token` in a real terminal on this machine, approve in the browser, and put the printed token (starts `sk-ant-oat01-`) in a locked file the job loads, exactly as Path 2 Step 2.5 shows. Never put it in the second brain.

Then continue at **"Your one first job"** below.

---

# Path 2: rent a small cloud server

### Step 2.1: The cost out loud, then the checkout (the user's hands)

Say before any signup page is open: *"This is roughly five to twenty dollars a month, billed monthly, cancel anytime. You type the card in. I never see or enter payment details."*

We use **Hetzner Cloud**; any similar host works. One thing to know before starting: Hetzner reviews every new account by hand and sometimes asks for a photo ID, so the account can take hours to approve (or get declined). If the build is scheduled, create the account a day ahead; if the account gets declined, DigitalOcean or Vultr work the same way at a similar price. The user creates the account and pays. Then create a server: **Ubuntu 24.04**, the smallest plan with 4 GB of memory they offer (about six dollars a month as of late August 2026). It is enough. Before checkout, Claude prepares the main computer's SSH public key so the user pastes it during creation; the server is then key-only from its first breath.

### Step 2.2: First login and the everyday user

As root, once:

```bash
apt update && apt upgrade -y
apt install -y ufw unattended-upgrades git nodejs npm
adduser <boxuser>
usermod -aG sudo <boxuser>
loginctl enable-linger <boxuser>
```

(`git` carries the files in Step 2.6 and `nodejs`/`npm` run the door later; a fresh server ships with none of them.)

Plain words for the user: root is the master key, and nobody works holding the master key. The everyday user is what everything runs as. "Linger" lets that user's scheduled work run with nobody logged in.

### Step 2.3: The private network

Tailscale on the server, the main computer, and the phone, same account:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
```

Note the server's Tailscale address (`100.x.y.z`). From now on, always connect to that address, never the public one.

### Step 2.4: Lock the doors

Three parts, and the filename matters.

1. Key-only SSH, via a drop-in at `/etc/ssh/sshd_config.d/00-hardening.conf`:

```
PasswordAuthentication no
PermitRootLogin prohibit-password
```

The `00-` prefix is load-bearing: it must sort before the cloud image's own `50-` file, or the hardening silently loses to a default that re-enables passwords.

2. Firewall: nothing in from the public internet, SSH only over the private network:

```bash
ufw default deny incoming
ufw allow in on tailscale0 to any port 22 proto tcp
ufw enable
```

3. **Verify from the outside, and do not skip it.** From the main computer: `nc -vz <public-ip> 22` must FAIL, and `ssh <boxuser>@<tailscale-ip>` must work. The failed connection is the proof.

If a lockout ever happens, the spare key is the provider's web console in their dashboard. The firewall never gets weakened to get back in.

### Step 2.5: Claude on the server, billing the existing plan

1. On the server, as the everyday user: `curl -fsSL https://claude.ai/install.sh | bash`, and make sure `~/.local/bin` is on the PATH.
2. On the **main computer** (the one with a browser and the subscription): run `claude setup-token` in a real, ordinary terminal window. A browser opens; the user approves. It prints a token starting `sk-ant-oat01-`, valid one year. When copying it, it wraps across terminal lines; rejoin it and strip all whitespace.
3. On the server, put the token in a locked file, pasted in with a text editor, never typed into a visible command and never in the second brain:

```bash
touch ~/.box.env && chmod 600 ~/.box.env
# paste into the file:  CLAUDE_CODE_OAUTH_TOKEN=<the token>
```

And make every login load it, at the **very top** of `~/.bashrc` (the stock Ubuntu file stops reading a few lines in for remote commands, so a line added at the bottom never runs for them):

```bash
export PATH="$HOME/.local/bin:$PATH"; set -a; [ -f "$HOME/.box.env" ] && . "$HOME/.box.env"; set +a
```

4. **Prove it:** `claude -p "What is 12 times 12?"` on the server answers with no login error. That answer is also the billing proof: the subscription is paying, not a per-use bill.
5. Merge `"hasCompletedOnboarding": true` into the server's `~/.claude.json`. Merge into the existing file, never replace it. This stops the full-screen Claude from running a first-time wizard that tries to open a browser the server does not have.
6. Set a calendar reminder about 11 months out: the token lasts a year and renewal is manual.

### Step 2.6: The second brain onto the server

1. Ask before cloning: *"Is there any folder in your second brain too personal for a rented machine?"* Anything named gets excluded so it is never downloaded to the server, and it goes on the door's own refuse list later. One honest limit, said plainly: the exclusion is a strong screen, not a vault — git will fetch that folder's history if something on the server ever explicitly asks for it, so anything truly radioactive belongs out of the second brain entirely.
2. Create a deploy key (an SSH key that unlocks only this one repository): generate it on the server, and the user pastes the public half into GitHub under the repository's Settings, Deploy keys, with **write access** ticked.
3. Clone light, excluding what was named:

```bash
git clone --filter=blob:none --sparse git@github.com:<user>/<second-brain>.git ~/secondbrain
cd ~/secondbrain
git sparse-checkout set --no-cone '/*' '!/<private-folder>/'
git config user.name "Always-On Box"
git config user.email "box@<their-domain>"
```

The separate name means every change made by this machine is recognizable at a glance forever.

4. Create `~/bin/repo-sync.sh` (auto-save commit, pull, push, with a lock so two runs never collide):

```bash
#!/bin/bash
LOCK="$HOME/.repo-sync.lock"
if [ -d "$LOCK" ] && [ -n "$(find "$LOCK" -mmin +30 2>/dev/null)" ]; then rmdir "$LOCK" 2>/dev/null; fi
mkdir "$LOCK" 2>/dev/null || exit 0
trap 'rmdir "$LOCK" 2>/dev/null' EXIT
cd "$HOME/secondbrain" || exit 1
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null) || exit 1
if [ -n "$(git status --porcelain)" ]; then git add -A; git commit -qm "auto-save (box) $(date +%m/%d/%y-%H:%M)" || true; fi
git fetch --quiet origin || exit 0
git pull --rebase --quiet origin "$BRANCH" || { git rebase --abort 2>/dev/null; exit 0; }
git push --quiet origin "$BRANCH" || true
```

Two things in there are deliberate: the folder-style lock works on Mac and Linux both (the `flock` tool a Linux-only version would use does not exist on a Mac), and the branch is read from the repo instead of assuming it is called `main` (a repo whose branch is `master` would otherwise sync nothing, silently, forever).

`chmod +x` it, schedule it every 30 minutes with cron, and add the auto-land block to `~/.bashrc` so every login starts inside the second brain (skills only load from inside that folder; starting Claude anywhere else looks broken). On a Path 1 Mac this block goes in `~/.zshrc` instead — Macs read a different startup file, and a `~/.bashrc` there is dead text that never runs:

```bash
claude() { [ "$PWD" = "$HOME" ] && cd "$HOME/secondbrain"; command claude "$@"; }
case $- in *i*) [ -d "$HOME/secondbrain" ] && cd "$HOME/secondbrain" ;; esac
```

5. The toolkit ships inside the second brain, so it arrived with the clone. Prove it: start `claude` and type one slash command.

### Step 2.7: Phone access (Termius)

1. Tailscale app on the phone, same account, toggled on.
2. In Termius (free), generate the phone its own SSH key and add its public half to the server's `~/.ssh/authorized_keys`. Its own key means a lost phone can be revoked alone.
3. Create a plain SSH host: address = the server's `100.x.y.z`, user = `<boxuser>`. **Skip any paid upsell sheet it shows** (AI features, sync); a plain SSH host and its key are free, and the identical result.
4. Tap the host. Type `claude`. That is the whole daily flow.

---

## Your one first job (both paths land here)

The rule, learned the hard way: **start it on ONE job**, and get that right for two weeks before adding a second.

Propose two or three candidates from what the user actually has connected, for example a morning email brief waiting when they wake (if `/install-email`, `/install-google`, or `/install-microsoft` has been run), or a scheduled check of something they currently check by hand. Never propose a job needing a tool this machine does not have. Every candidate must **leave a dated file in the second brain**. That artifact is what makes "done" provable, so a job that leaves nothing behind is not a candidate.

Mechanics: a small script that changes into the second-brain folder **explicitly** (the wrong-folder trap is the number one way scheduled jobs die), loads the locked env file, and runs `claude -p "<the job>"`. Schedule it with cron (or Task Scheduler on a Windows Path 1 machine), at a time offset from the sync script so they never collide.

## The door (the last build step, both paths)

The door lets the Claude app on the phone and claude.ai on any browser reach the second brain directly: read it, write to it, and start real Claude jobs on the machine, with every other computer shut. It is one small program plus one Tailscale command.

Say this before building it: *"This creates one locked door on the public internet. It only opens with a long random key, it can only see your second brain, it refuses your private folder and anything secret, it writes down every knock, and there is one command that slams it shut. I will show you that command."*

1. Copy the door program to the machine and install its one dependency. The door runs on Node.js: the Step 2.2 install already put it on a Path 2 server, but a Path 1 machine may not have it — check `node -v` first, and if it is missing install the LTS from nodejs.org (the standard installer), then reopen the terminal.

```bash
mkdir -p ~/.second-brain-door && cd ~/.second-brain-door
# copy ${CLAUDE_PLUGIN_ROOT}/scripts/door-server.mjs here (scp it from the main computer)
npm init -y && npm install @modelcontextprotocol/sdk
```

2. Generate the key into a locked file (prove it exists with `ls -l`, never print it):

```bash
node -e "console.log('BRAIN_DOOR_TOKEN='+require('crypto').randomBytes(32).toString('hex'))" > ~/.door.env
echo "BRAIN_DOOR_ROOT=$HOME/secondbrain" >> ~/.door.env
echo "BRAIN_DOOR_ENV_FILE=$HOME/.box.env" >> ~/.door.env
chmod 600 ~/.door.env
```

If a private folder was named in Step 2.6, or this is a Path 1 machine (which carries the whole second brain, nothing excluded), put that folder on the door's own refuse list too: `echo "BRAIN_DOOR_DENY=<folder>" >> ~/.door.env` (comma-separate several). The door always refuses a folder named `personal` plus every secret-shaped file; this line covers a private folder named anything else.

3. Keep it running, and mind the one trap: the door refuses to start unless its settings file is loaded first, and only systemd knows how to load such a file on its own.
   - **Path 2:** a systemd user service with `EnvironmentFile=%h/.door.env`, `ExecStart=/usr/bin/node %h/.second-brain-door/door-server.mjs` (confirm the path with `which node`; systemd wants the full path), `Restart=always`, then `systemctl --user enable --now`.
   - **Path 1 Mac:** a LaunchAgent with `RunAtLoad` and `KeepAlive` whose program is one bash line that loads the settings itself, because LaunchAgents cannot read an env file: `/bin/bash -lc 'set -a; . "$HOME/.door.env"; exec node "$HOME/.second-brain-door/door-server.mjs"'`.
   - **Path 1 Windows:** a Task Scheduler task at logon pointing at a small `door.cmd` that first `set`s the values from the settings file, then runs `node` on the script.

   Prove it locally: `curl -s http://127.0.0.1:8123/healthz` prints `ok`. If it never does, the service almost certainly started without its settings loaded — re-read this step.
4. Put it on the internet with Tailscale Funnel (needs the one-time Funnel approval in the Tailscale admin page, which Claude walks the user to):

```bash
tailscale funnel --bg --https=443 http://127.0.0.1:8123
```

It prints the machine's public `https://….ts.net` address. The connector address is that address plus `/<the token>/mcp`. Read the token from the env file only at this moment, to assemble the address for the user.

5. The user registers it, their hands, their account: claude.ai, Settings, Connectors, "Add custom connector", paste the address. This works regardless of how the machine's own Claude signs in.
6. **The kill switch, said out loud and written into the user's second brain:** `tailscale funnel --https=443 off` closes the door from anywhere, instantly, leaving the machine untouched.

## Prove it is done (observables, never a clean exit code)

1. **The anywhere test:** phone on cellular, Wi-Fi off. Reach the machine (Claude app session on Path 1, Termius on Path 2) and type one real slash command. It runs.
2. **The door test:** from the claude.ai app on the phone, ask the connector to read one real file from the second brain. The contents come back.
3. **The overnight test:** the next morning, the job's dated file exists with a timestamp from while the user slept. **This artifact is the definition of done for this whole skill.** Nothing is reported as finished until it exists.
4. **Path 2 only:** the outside knock already failed correctly in Step 2.4, and `claude -p` answered without a login error in Step 2.5.
5. **The trust ramp:** check it each morning for three days before relying on it, and expect one break in the first month.

## If you hit a snag

### "I can't reach the server anymore" / SSH just hangs

Tailscale is toggled off on the phone or laptop, or the machine rebooted before Tailscale was enabled at boot. Check the Tailscale app on both ends first, same account. A true lockout on Path 2 goes through the provider's web console, the spare key. The firewall never gets weakened.

### "Invalid token" or a login error days after setup

The 1-year token was truncated when it wrapped across terminal lines during copying. Re-mint it on the main computer, re-paste the whole line into the locked env file, and prove it with `claude -p "What is 12 times 12?"`.

### `claude setup-token` sits there with no output

It was run through a pipe or in the background. Run it in a real, ordinary terminal window on the main computer.

### A first-time wizard appears on the server and wants a browser

The `hasCompletedOnboarding` merge from Step 2.5 was skipped, or the file was replaced instead of merged. Merge the single key into the existing `~/.claude.json` and relaunch.

### "My skills are gone" / Claude seems broken on the machine

Claude was started outside the second-brain folder. Change into it; the auto-land block in Step 2.6 prevents it recurring. Also: some skills never appear when you ask Claude to list skills; they exist only as typed commands. Test by typing.

### The files on the machine are old

The sync script is not scheduled or backed off after a conflict. Run it by hand once, check `crontab -l`, and compare `git log -1` on both machines.

### A usage bill appeared / "API charges"

`ANTHROPIC_API_KEY` got set on the machine. Its mere presence silently switches Claude from the flat subscription to pay-per-use billing. Remove it from the env file; the 1-year login token is the only Claude credential that belongs there.

### Termius wants money

An upsell sheet (AI features, cross-device sync). Close it and save the plain SSH host; hosts and keys are free, and plain SSH is the identical result.

### Windows: Claude quits instantly with a wall of text

Read it for "Git Bash not found." Install Git for Windows, then fully exit the app (File, Exit, not the X) and reopen. Claude only looks for Git at startup.

### The morning file never appeared

In order: the job script is missing its explicit change into the second-brain folder; the machine slept (Path 1: re-check Step 1.2); the job's sign-in expired. Check the job's own log before anything else.

### The connector says unauthorized or cannot connect

Unauthorized means the address's token segment does not match the machine's env file; re-assemble the address from the file. Cannot connect means the Funnel is off or the door service is down: `curl -s http://127.0.0.1:8123/healthz` on the machine, then `tailscale funnel --bg --https=443 http://127.0.0.1:8123` to reopen.

## Rules that don't bend

1. **Nothing that can move money ever goes on this machine.** No payment cards, no payment-processor keys, no banking logins. If it is ever reached by someone else, there is nothing there to take.
2. **`ANTHROPIC_API_KEY` never gets set on it.** (Different thing from the login token, which is right.)
3. **Claude never enters a payment card, and the monthly cost is named out loud before the user reaches any checkout.**
4. **Secrets are proven with `ls`, never `cat`.** Locked files stay `chmod 600`, out of the second brain, never pasted into a visible command.
5. **On Path 2 the only ways in are the private network and the door**, and the door's kill switch (`tailscale funnel --https=443 off`) gets written into the user's second brain where they can find it.
6. **One job for two weeks** before the second one.
7. **Done is the morning artifact and the door reading a real file**, never a clean run and never "it should work now."

## Gotchas

- **(8/23/26)** Path 1's first month, the documented ways it dies: a power cut brings it back off, a family member tidies it away, the router reboots overnight and it never reconnects, an update leaves it at a login screen. None fatal. The note on the machine, automatic login, and the morning check are the countermeasures.
- **(7/21/26)** A phone setup "worked" for days while every session quietly launched from the wrong folder with no skills, and the machine's copy silently fell four days behind because nothing refreshed it. Both fixes are structural (the auto-land block and the scheduled sync), not habits.
- **(7/17/26)** The 1-year token wraps across terminal lines when copied and a truncated copy fails later with a confusing error. The only real proof of the token is a live `claude -p` answer.
- **(7/24/26)** The door serves THIS machine's copy of the second brain. An edit made on the main computer is invisible through the door until the sync carries it over, up to 30 minutes. That lag looks like a bug and is not one.
- **(7/24/26)** The door's job runner is full-power Claude on this machine. If that ever feels like too much, the user can set "Start job" to Blocked in the connector's tool permissions on claude.ai and keep everything else.
- **(8/6/26)** A Windows spare machine with no Git: Claude Code exits with a wall of technical text instead of a useful message. Path 1 Step 1.3 orders Git first on purpose.
