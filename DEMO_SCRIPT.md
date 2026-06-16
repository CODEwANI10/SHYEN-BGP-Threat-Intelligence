# SHYEN — 3-Minute Demo Script

**Track:** Agentic & Autonomous Systems · FAR AWAY 2026
**Goal:** Demonstrate a real, autonomous, India-specific BGP threat detection and response system.

---

## Before You Start (5 minutes before judges arrive)

1. Open SHYEN in the browser and let it run for **at least 5 minutes** before judging.
   - This pre-warms the AS country cache (instant flags/arcs during demo)
   - This gives real RIPE RIS data time to populate the dashboard with live incidents
   - Check the footer: `RIPE RIS: connected`, `APNIC prefixes loaded`

2. Have the tab focused and full-screen. Close devtools.

3. Know your numbers:
   - UPI processes **10.6 billion transactions/month**
   - A 60-second hijack window can expose **~175 million transactions**
   - Current detection time in India: **72 hours average** (via foreign researchers)
   - SHYEN detection time: **under 90 seconds**
   - Global RPKI coverage: **~45%**
   - SHYEN monitors **15 critical Indian ASNs**

---

## The Script

### [0:00 – 0:20] Open with the problem — not the product

> "In 2010, Pakistan Telecom accidentally hijacked YouTube's global traffic for two hours. Nobody noticed until it was over. India has the same vulnerability today — UPI, Aadhaar, NSE, all run on IP space that nobody is watching in real time. CERT-In finds out about hijacks days later, usually from foreign researchers."

**[Gesture to the dashboard — it's already running]**

> "This is SHYEN. It's been running for the last 5 minutes, watching real BGP traffic from the global internet right now."

---

### [0:20 – 0:50] Show the live system

**[Point to the BGP ticker at top]**

> "This ticker is real. Every line is an actual BGP announcement happening on the internet right now, pulled from RIPE RIS — Europe's internet routing authority. We're filtering specifically for Indian IP space across 15 critical ASNs — Jio, Airtel, BSNL, NPCI, UIDAI, SBI, DRDO."

**[Point to the incident list — if real incidents exist]**

> "These are real anomalies SHYEN has already caught — origin mismatches, sub-prefix hijacks, route leaks. Each one is cross-validated, scored for confidence, and..."

**[Click on an incident, point to AI SOC Analyst panel]**

> "...this analysis is generated autonomously by Groq — no human asked for it. If confidence crosses 75%, SHYEN's AI analyzes the threat and acts on its own."

**[Point to AI ACTED badge if one is showing]**

> "See this badge? That means the AI already decided what to do — pushed RPKI, alerted IXPs — before anyone looked at this incident."

---

### [0:50 – 1:10] Show the map

**[Point to Global BGP Threat Map]**

> "This map shows where attacks are originating from, in real time. India is the center — every active threat draws an animated line from its origin country to India, color-coded by severity."

**[If a real attack is showing, click the attacker node]**

> "Clicking any origin filters the incident list to just that attacker — useful when you're tracking a specific threat actor."

---

### [1:10 – 1:30] The honest part — what makes this credible

> "Here's what we're NOT claiming. We can't unilaterally pull a hijacked route off the global internet — nobody can, not even nation-states. What SHYEN does is the realistic version: generate the RPKI invalidation record, alert NIXI's exchange points, and compile a forensics package formatted for CERT-In. That's the actual authority a system like this has — and it's still a massive improvement over the current 72-hour detection gap."

---

### [1:30 – 2:30] THE WOW MOMENT — Breach Simulator

**[Press `B` or click ⚡ SIMULATE BREACH]**

> "Now let's simulate an actual attack — this is what SHYEN looks like the moment it detects something CRITICAL."

**[Click the big red/orange "QUICK DEMO" button]**

> "One click — China Telecom attempting an Origin Hijack on NPCI, the company that runs UPI."

**[Terminal fires — let it play, narrate over it]**

> "Watch the pipeline: BGP update received... origin validation... mismatch confirmed... cross-checking all 8 global vantage points... all confirmed... CRITICAL severity... and now — autonomous response. RPKI invalidation generated. IXP filters pushed to NIXI Mumbai, Delhi, Chennai, Kolkata. Forensics package compiled. CERT-In alerted. All of this — in about 90 seconds. Today, this takes 72 hours and usually requires a foreign researcher to notice first."

**[Terminal completes — dismiss]**

> "And now it's in our incident list, fully analyzed by AI, with both RPKI and IXP actions already marked complete — mitigated."

---

### [2:30 – 2:50] Close with scale

> "SHYEN currently monitors 15 ASNs — that's the financial, government, defense, and telecom backbone of India. The architecture scales to 1000+ ASNs without redesign. Global RPKI coverage is only 45%, so even partial protection here is a massive step up from zero."

---

### [2:50 – 3:00] One-line close

> "SHYEN is the first unified, sovereign, autonomous BGP defense layer built specifically for India — detecting in seconds what currently takes days, and acting on it without waiting for a human."

**[Stop talking. Let the dashboard sit there, live, running.]**

---

## Anticipated Judge Questions

**"Is this real data?"**
> "Yes — the ticker and incident detection run on live RIPE RIS data, real APNIC prefix mappings, real RPKI checks via Cloudflare, and real AS-to-country resolution via RIPE STAT. The only simulated part is the breach simulator, which we use for demo purposes since real CRITICAL hijacks on Indian ASNs don't happen on a predictable schedule."

**"Can you actually block a hijack?"**
> "Not unilaterally — no one can, that's the nature of BGP. What we can do is generate the RPKI invalidation record (protects ~45% of global routers immediately), alert Indian IXPs to filter at the exchange level (protects domestic traffic), and compile forensics for CERT-In. That's the realistic and achievable response layer."

**"How does the AI know what to do?"**
> "Groq analyzes the incident — victim sector, attack type, confidence, repeat-attacker history — and returns a structured decision: severity assessment, recommended action, and whether to auto-execute RPKI/IXP responses. Above 75% confidence on real incidents, it acts without waiting for a human click."

**"What happens if RIPE RIS goes down?"**
> "Automatic reconnection with exponential backoff — you can see the connection status in the footer. The dashboard degrades gracefully; existing incidents remain visible and actionable."

**"Why these 15 ASNs specifically?"**
> "They represent the financial (NPCI, SBI, NSE), government (NIC, UIDAI), defense (DRDO), and telecom backbone (Jio, Airtel, BSNL, VSNL) of India — the highest-value targets for a state-sponsored BGP attack."

---

## If Something Goes Wrong

- **No real incidents showing:** That's fine — say "the live feed is quiet right now, which is actually normal — real hijacks are rare. Let's trigger one." → go straight to Quick Demo.
- **RIPE RIS disconnected:** Check footer status. If red, say "connection dropped — it auto-reconnects" and point at the reconnect attempt, or refresh once before judges arrive.
- **Groq API slow/fails:** The AI panel shows a graceful fallback message ("AI analysis service unavailable"). Acknowledge it briefly: "Groq's free tier occasionally rate-limits — production would use a dedicated key."
- **Map shows "Resolving origin...":** Say "the system is resolving the attacker's country via RIPE's registry in real time" — this is true and sounds sophisticated.

---

## Final Checklist

- [ ] App running 5+ min before judging
- [ ] Footer shows RIPE RIS connected
- [ ] Groq API key set and working (test AI analysis once before judges arrive)
- [ ] Full screen, devtools closed
- [ ] Know the 6 numbers cold
- [ ] Practiced the Quick Demo flow at least 3 times
- [ ] Backup: screen recording of a successful run, in case live demo fails
