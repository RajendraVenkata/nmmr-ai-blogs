---
title: "Try It Live: Run Code Right Inside the Post"
slug: try-it-live-embedded-terminals
excerpt: "A quick demo of the new embedded terminals — launch a real, sandboxed Linux container from inside a blog post and run code as you read. No setup, no install, just click Launch."
tags: ["Coding", "Tutorials", "Platform"]
---

> Reading about code is fine. *Running* it is better. This post embeds a real,
> sandboxed terminal you can launch right here — type, run, experiment.

Most tutorials make you copy snippets into your own editor, install the right
runtime, and hope your environment matches the author's. That friction is where
learning stalls. So this site can now drop a **live terminal** straight into a post:
each reader gets their **own** throwaway container, wired to the page over a
WebSocket.

## How it works

If you're signed in and have the **Coder** role, the block below renders as a real
Python shell instead of a code listing. Click **Launch**, wait a second for your
container to spin up, and you're at a prompt:

```terminal
lab: python-basics
```

Try a few things once it's running:

```bash
python3 hello.py
python3 -c "print(sum(range(1, 101)))"
```

That `hello.py` file is pre-loaded in your container — and the container is *yours*:
nobody else shares it, and it's destroyed automatically after 30 minutes of
inactivity (or whenever you stop it from your account page).

## A plain Linux box, too

The same mechanism works for other environments. Here's an Ubuntu shell with the
usual CLI tooling (`gcc`, `make`, `git`, `vim`, `jq`, …):

```terminal
lab: linux-basics
```

Compile and run a quick C program to prove it's real:

```bash
echo '#include <stdio.h>
int main(){ printf("hello from your container\n"); return 0; }' > hi.c
gcc hi.c -o hi && ./hi
```

## What's happening under the hood

- Each terminal is a Docker container started just for you, with strict CPU and
  memory limits.
- The page talks to it over a WebSocket; your browser authenticates with your own
  login, and the backend verifies it before handing you a shell.
- The default labs run **offline** for safety. Networked variants (where
  `pip install` / `npm install` work) are available where a post needs them.

## Don't see a terminal?

If the blocks above look like plain code rather than a live shell, you either aren't
signed in or don't have **Coder** access yet. Head to your **account** page and
request it — once an admin approves, this post (and any other with a terminal)
becomes interactive.

Happy hacking. 🧪
