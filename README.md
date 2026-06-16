# SHYEN — Autonomous BGP Hijack Detection & Response System

**PRD v2.0 — FAR AWAY 2026 Hackathon · Agentic & Autonomous Systems Track**

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set your Anthropic API key
cp .env.example .env.local
# Edit .env.local and add: VITE_ANTHROPIC_API_KEY=sk-ant-...

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

| Layer     | Tech                              |
|-----------|-----------------------------------|
| Frontend  | React 18 + Vite 5                 |
| State     | Zustand 4                         |
| AI Layer  | Anthropic Claude (claude-sonnet)  |
| Styling   | Inline styles + CSS variables     |
| Icons     | Lucide React (minimal use)        |

## Features

- Real-time BGP ticker (800ms updates, 15% suspicious rate)
- Auto-generated incidents every ~4 seconds
- 15 real Indian ASNs with actual IP prefix ranges
- Severity matrix (CRITICAL / HIGH / MEDIUM / LOW)
- Multi-vantage confirmation (4–8 of 8 global points)
- Claude AI threat analysis per incident (real API call)
- RPKI / IXP / Forensics response actions
- ASN Health Grid with sector colour-coding
- Live system clock (UTC)

## Environment Variables

| Variable                  | Description                     |
|---------------------------|---------------------------------|
| `VITE_ANTHROPIC_API_KEY`  | Your Anthropic API key (sk-ant-...) |

> All BGP data is **simulated**. No live feed connections are made.
> The Claude API call is real and will consume tokens.
