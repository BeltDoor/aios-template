# What You're Installing (and why)

Plain-English answers for the handful of tools a new second brain needs on your computer. No tech background required. When you (or your client) ask "what is this thing I'm installing?", this is the answer to read aloud.

Two things to know up front:

- **It's all one-time setup.** Once these are on, you never think about them again.
- **You don't operate any of them.** They sit in the background so your AI Chief of Staff can do its job. You just talk to it in plain English.

## VS Code

The window everything happens in. Think of it as the room where you and your AI Chief of Staff sit down to work. On its own it does nothing special: it's the place the real tools plug into.

## The Claude Code extension

This is what turns that empty room into your AI Chief of Staff. It's the actual brain you talk to in the chat panel. VS Code is the room; this is the person sitting in it.

## Git

Your work's time machine, and the first half of your backup. Every time you finish a session, Git quietly takes a snapshot of your whole second brain folder, so nothing is ever truly lost and you can always roll back to an earlier version. You never touch it directly; it runs in the background. (Fuller detail in [`git-and-backup.md`](git-and-backup.md).)

## GitHub

The safe, off-laptop vault where those snapshots get sent. Git takes the snapshot; GitHub holds it in the cloud, privately, where only you can see it. Together they mean one thing that matters a lot: if your laptop is ever lost, stolen, or dies, your entire second brain is safe, and you can pick up on a new computer in minutes. Your vault is private. Nobody else can see your business.

## Node.js

A small, quiet engine that a few of your tools run on. Some skills need it the way a blender needs to be plugged in: you never operate the engine yourself, it just has to be there so the tool works. Install it once and forget it.

- **Windows:** one command does it (your AI will run it for you): `winget install --id OpenJS.NodeJS.LTS -e --source winget`.
- **Mac:** download the **LTS** version from [nodejs.org](https://nodejs.org) and double-click the installer. That's it.

## Windows only: Git Bash vs PowerShell

This is the one that trips people up, so here's the plain version.

A "command line" is the text-based way your AI runs the behind-the-scenes steps. Windows comes with one built in, called **PowerShell**. When you install Git, you also quietly get a different one called **Git Bash**.

Your second brain is built to speak Git Bash. If your AI ends up on PowerShell instead, the very first setup step fails, because the two speak different languages. It's not broken, it's just the wrong translator.

The fix is automatic almost every time: install Git, then close and reopen VS Code, and your AI picks up Git Bash on its own. Your AI checks this for you at the very start of setup and walks you through the fix if it's needed. You don't have to understand any of it. At most, you might be asked to close and reopen the window once.

## Mac only: what about Homebrew?

You may see "Homebrew" mentioned in Mac setup guides online. It's an "app store for behind-the-scenes tools," a popular way Mac developers install things like Node.

**You don't need it for your second brain.** Your Mac already comes with Apple's own lightweight tools for Git, and Node installs from a normal double-click installer off its website. Homebrew is a heavier, slower, more technical install that buys you nothing here, so we skip it on purpose. If a guide ever tells you to install Homebrew "first," you can safely ignore it for second brain setup.
