# SHYEN — Autonomous BGP Hijack Detection & Response System

**PRD v2.0 — FAR AWAY 2026 Hackathon · Agentic & Autonomous Systems Track**

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set your API keys
cp .env.example .env.local
# Edit .env.local and add your Groq / HuggingFace keys — see .env.example

# 3. Run the dev server
npm run dev
```

Open http://localhost:5173

## Build for Production

```bash
npm run build
npm run preview
```

Or deploy the `dist/` folder to Vercel / Netlify.

## Stack

| Layer     | Tech                                        |
|-----------|----------------------------------------------|
| Frontend  | React 18 + Vite 6                             |
| State     | Zustand 4                                     |
| AI Layer  | Groq (openai/gpt-oss-120b, openai/gpt-oss-20b) — incident analysis, Admin Chat, CERT-In reports, NOC drafts; HuggingFace fallback |
| Styling   | Inline styles + CSS variables                 |
| Icons     | Lucide React (minimal use)                    |

## Features

- Real-time BGP ticker (800ms updates, 15% suspicious rate)
- Auto-generated incidents every ~4 seconds
- 15 real Indian ASNs with actual IP prefix ranges
- Severity matrix (CRITICAL / HIGH / MEDIUM / LOW)
- Multi-vantage confirmation (4–8 of 8 global points)
- Groq AI threat analysis per incident (real API call)
- RPKI / IXP / Forensics response actions
- ISP NOC notification drafting (Groq) from the Forensics panel
- ASN Health Grid with sector colour-coding
- Live system clock (UTC)
- Demo Mode: 18 pre-scripted incidents across all attack types, sectors, and severities — zero live network dependency
- Structured Change Log (persisted) — records every incident detection, action, AI decision, and session event with a before/after diff
- Supabase-backed persistence for incidents, change log, AI chat history, and activity log — survives refresh/device change

## Environment Variables

| Variable              | Description                                             |
|------------------------|-----------------------------------------------------------|
| `VITE_GROQ_API_KEY`    | Groq key — decision engine (openai/gpt-oss-120b)          |
| `VITE_GROQ_API_KEY_2`  | Optional second Groq key — text queue (openai/gpt-oss-20b) |
| `VITE_HF_API_KEY`      | HuggingFace key — fallback when Groq is rate-limited       |
| `VITE_SUPABASE_URL`    | Supabase project URL — backend persistence                 |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public key — backend persistence            |

> Live data sources: RIPE RIS, APNIC, Cloudflare RPKI, RIPE STAT, crt.sh — see the app's own data-source breakdown for what's real vs. simulated.
> AI API calls are real and will consume tokens/credits on the respective provider.
