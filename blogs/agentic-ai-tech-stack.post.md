---
title: "The Agentic AI Tech Stack, Layer by Layer"
slug: agentic-ai-tech-stack
excerpt: "A practical, layer-by-layer map of the agentic AI tooling ecosystem — from user-facing apps and agent harnesses down to serving engines and inference silicon, plus the observability and security that span every layer."
tags: ["Agentic AI", "LLMs", "Architecture"]
cover: agentic-ai-tech-stack-cover.png
---

> A layered map of the tooling ecosystem used to build, run, observe, and secure
> autonomous AI agents — from end-user applications at the top down to the silicon
> doing the inference at the bottom.

This post explains the "Agentic AI Tech Stack" landscape. The stack is organized
roughly top-to-bottom from **what the user sees** (applications) down to **where the
model actually runs** (inference hardware). Two vertical sidebars cut across all
layers — **Observability / Monitoring / Evals** and **AI Safety / Security** — because
both concerns apply at every level of the stack.

![The Agentic AI Tech Stack — a layered map from applications down to inference hardware, with observability and security spanning every layer](/diagrams/agentic-ai-tech-stack.svg)

---

## How to read the stack

Think of building an agent as assembling a vertical slice through these layers:

1. A **user** interacts with an **Application**.
2. The app is driven by an **Agent Harness** (the loop that lets a model take actions).
3. The harness is built on an **Agentic Framework** and runs inside a **Runtime/SDK**.
4. The agent reaches the outside world through **Tools/APIs + Automation**.
5. Those connections speak common **Standards/Protocols** (MCP, A2A, OpenAPI…).
6. The agent reads/writes **Knowledge, Data, Context & Memory** (vector DBs, memory stores).
7. Requests are sent through a **Routing** layer to the right model.
8. **Model Providers** supply the actual LLMs (closed or open weights).
9. A **Serving Engine** turns model weights into a callable endpoint.
10. The engine runs on **Inference hardware** (ASIC, GPU, or cloud).

Surrounding all of this, **Observability** and **Safety/Security** tools watch and
guard the system.

---

## Horizontal layers (top → bottom)

### 1. Applications
The polished, user-facing products built on top of agents.

| Tool | What it is |
|------|------------|
| **ChatGPT (OpenAI)** | General-purpose conversational AI assistant. |
| **Claude (Anthropic)** | Conversational assistant with strong reasoning/coding. |
| **Perplexity** | AI-powered answer/search engine with citations. |
| **Gemini** | Google's multimodal assistant. |
| **Higgsfield** | Generative AI media/video application. |
| **Lovable** | AI app builder ("vibe coding" full apps from prompts). |

### 2. AI Agent Harness

**What "harness" means:** A harness is *everything around the model that turns a raw
LLM into an agent* — the agentic loop, tool execution, state/memory, context
management, retries, guardrails, and logging. As one definition puts it, "a harness
is every piece of code, configuration, and execution logic that isn't the model
itself." The core pattern is a **ReAct loop**: the model reasons → calls a tool →
observes the result → repeats until done.

The stack splits harnesses into **Personal Agents** (general/24-7 assistants) and
**Coding Agents** (specialized for editing and running code).

| Tool | Category | What it is |
|------|----------|------------|
| **Gemini Spark** | Personal Agent | Google's 24/7 personal AI agent. Persists between sessions, runs in the background on cloud infrastructure, and takes actions across tools — built from Gemini base models and an agentic harness from Google Antigravity, with native Gmail/Calendar/Drive/Docs integration. |
| **Claude Code** | Coding Agent | Anthropic's agentic coding tool that lives in your terminal, understands your codebase, and executes tasks (edit files, run commands, handle git) via natural language. Its underlying harness — the Claude Agent SDK — can power general-purpose agents too. |
| **Cursor** | Coding Agent | An AI-native IDE (VS Code fork) and coding agent. Its agents search the codebase, edit files, run terminal commands, and complete multi-step tasks from natural language; recent versions run multiple agents in parallel on isolated git branches. |

### 3. Agentic Frameworks & Runtimes/SDKs
The libraries you actually write agent logic with.

**Agentic Frameworks**
- **LangGraph** — graph/state-machine orchestration of agents (from LangChain).
- **CrewAI** — role-based multi-agent "crews" that collaborate.
- **AG2 (AutoGen)** — multi-agent conversation framework.
- **Mastra** — TypeScript agent framework.
- **CAMEL AI** — communicative/role-playing multi-agent research framework.
- **PydanticAI** — type-safe, structured-output agent framework.

**Runtimes / SDKs**
- **OpenAI Agent SDK** — OpenAI's official agent-building toolkit.
- **Google Agent Development Kit (ADK)** — Google's agent runtime/SDK.

### 4. Tools/APIs + Automation
How agents reach out and *do things* in the world.

- **Tools & APIs:** **Composio**, **Exa**, **Tavily**, **Arcade**, **Firecrawl**,
  **Perplexity (API)**, **Browserbase**, **Manus** — search, web scraping/crawling,
  browser automation, and pre-built tool/integration catalogs.
- **Automation:** **Zapier**, **Make**, **n8n**, **Workato** — no/low-code workflow
  automation that agents can trigger or be embedded into.
- **Sandbox:** **E2B**, **Daytona**, **Modal** — secure, isolated environments where
  agents can run generated code safely.

### 5. Standards / Protocols
The interoperability layer so tools, agents, and models can talk to each other.

- **Model Context Protocol (MCP)** — open standard for connecting models to tools/data.
- **A2A (Agent-to-Agent)** — protocol for agents communicating with other agents.
- **OpenAPI Initiative** — standard for describing REST APIs (often how tools are defined).
- **OpenTelemetry** — open standard for traces/metrics/logs (observability instrumentation).
- **AG-UI** — protocol for connecting agents to user interfaces.

### 6. Knowledge / Data / Context & Memory
Where the agent stores and retrieves information (RAG + long-term memory).

**Knowledge / Data / Context**
- *Beginner-friendly DBs:* **ChromaDB**, **Haystack** (deepset), **LlamaIndex**.
- *Production-grade DBs:* **Pinecone**, **Weaviate**, **Qdrant**, **Neo4j**
  (graph DB) — vector and graph stores powering retrieval-augmented generation.

**Memory** (persistent agent memory across sessions)
- **mem0**, **Zep**, **Letta** (formerly MemGPT), **supermemory**, **cognee**.

### 7. Routing
A layer that sits between your app and many model providers, choosing/normalizing
which model handles a request.
- **LiteLLM** — unified API across 100+ LLM providers.
- **OpenRouter** — single endpoint routing to many hosted models.
- **Hugging Face** — model hub and inference routing.

### 8. Model Providers
The companies/labs that produce the actual large language models.

- **Closed weights:** **Gemini** (Google), **OpenAI**, **Anthropic**, **Mistral**.
- **Open weights:** **Meta (Llama)**, **Mistral**, **OpenAI (open models)**, **Gemma**,
  **DeepSeek**, **Qwen**, **Kimi**.

### 9. Serving Engine
Software that loads model weights and serves them as a high-throughput API.
- **vLLM** — high-throughput inference server (PagedAttention).
- **TensorRT(-LLM)** — NVIDIA's optimized inference runtime.
- **TGI (Text Generation Inference)** — Hugging Face's serving engine.
- **SGLang** — structured/efficient LLM serving engine.

### 10. Inference Hardware
The physical compute the models run on.
- **ASIC Inferencing:** **Groq**, **Cerebras**, **Google TPU**, **AWS Trainium** —
  purpose-built chips for fast/cheap inference.
- **Standalone GPU Inferencing:** **Fireworks AI**, **Baseten** — managed GPU inference.
- **Cloud Inferencing:** **Nebius / Token Factory**, **Google Cloud**, **AWS** —
  general cloud platforms offering model hosting.

---

## Vertical sidebars (cut across all layers)

### Observability / Monitoring / Evals
Tools to trace, debug, evaluate, and monitor agent behavior and LLM output quality.
- **LangSmith**, **Braintrust**, **Arize**, **Langfuse**, **Fiddler**, **Helicone**.

### AI Safety / Security
Tools for identity, access control, guardrails, governance, and red-teaming.
- **Okta** (identity/auth), **Robust Intelligence** (model security/firewall),
  **watsonx.governance** (IBM AI governance), **Portkey** (AI gateway/guardrails),
  **Lakera** (prompt-injection/LLM security), **promptfoo** (LLM testing & red-teaming).

---

## Putting it together — an example slice

A coding assistant might look like:

```
Application:        Lovable (build an app from a prompt)
Agent Harness:      Claude Code
Framework/Runtime:  LangGraph + OpenAI Agent SDK
Tools/Automation:   Firecrawl (scrape docs) + E2B (run generated code)
Standards:          MCP (connect to tools) + OpenTelemetry (tracing)
Knowledge/Memory:   Pinecone (RAG) + mem0 (long-term memory)
Routing:            LiteLLM
Model Provider:     Anthropic (Claude) / Qwen (open weights)
Serving Engine:     vLLM
Hardware:           AWS Trainium / Groq

  ↕ watched by:     Langfuse (observability)
  ↕ guarded by:     Lakera + Portkey (safety/security)
```

---

## Key takeaways

- The stack mirrors a classic systems architecture: **UI → orchestration →
  integration → data → model → serving → hardware.**
- **Standards/protocols (especially MCP)** are the glue that makes the ecosystem
  composable — pick best-of-breed at each layer.
- **Observability and security are not layers but dimensions** — you need them at
  every level, which is why they span the full height of the stack.
- **Open vs. closed weights** is now a first-class choice, with strong open models
  (Llama, Mistral, DeepSeek, Qwen, Kimi, Gemma) competing with closed APIs.
- **Inference is increasingly specialized**, moving from general GPUs toward ASICs
  (Groq, Cerebras, TPU, Trainium) for cost and speed — directly relevant to AWS users
  via **Trainium/Inferentia**.
