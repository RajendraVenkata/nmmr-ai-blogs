---
title: "Try It Live: Run Code Right Inside the Post"
slug: try-it-live-embedded-terminals
excerpt: "A quick demo of the new floating terminal — launch a real, sandboxed Python container that docks in the corner of the page. Minimize it, keep reading, pop it open to run code, no setup required."
tags: ["Coding", "Tutorials", "Platform"]
---

> Reading about code is fine. *Running* it is better. This post comes with a real,
> sandboxed terminal that **floats in the bottom-right corner** — minimize it while you
> read, pop it open to run a command, and your shell stays exactly where you left it.

Most tutorials make you copy snippets into your own editor, install the right runtime,
and hope your environment matches the author's. That friction is where learning stalls.
So this site can now dock a **live terminal** into the corner of a post: you get your
**own** throwaway container, wired to the page over a WebSocket, that follows you as you
scroll.

## Launch it

If you're signed in and have the **Coder** role, the block below mounts a Python shell in
the corner. Click **Launch**, give it a second to spin up your container, and you're at a
prompt — collapse it to a pill any time with the **–** button and bring it back with a
click.

```terminal
lab: python-basics
float: true
```

Try a few things once it's running:

```bash
python3 hello.py
python3 -c "print(sum(range(1, 101)))"
python3 -c "import this" | head -5
```

That `hello.py` file is pre-loaded in your container — and the container is *yours*:
nobody else shares it, and it's destroyed automatically after 30 minutes of inactivity
(or whenever you stop it from your account page).

## Why a floating terminal?

The point is to **code along** without losing your place. Scroll down to read the next
section, keep the terminal minimized in the corner, then expand it to try the idea
immediately — no jumping between tabs, no scrolling back up to find the prompt. The
session keeps running the whole time you're reading.

## What's happening under the hood

- The terminal is a Docker container started just for you, with strict CPU and memory
  limits.
- The page talks to it over a WebSocket; your browser authenticates with your own login,
  and the relay verifies it (and your Coder access) before handing you a shell.
- This lab runs **offline** for safety. Networked variants — where `pip install` actually
  reaches the internet — are available on posts that need them.

## Don't see a terminal?

If the corner is empty or shows a "Coder access required" note, you either aren't signed
in or don't have **Coder** access yet. Head to your **account** page and request it —
once an admin approves and you sign back in, this post (and any other with a terminal)
becomes interactive.

Happy hacking. 🧪
