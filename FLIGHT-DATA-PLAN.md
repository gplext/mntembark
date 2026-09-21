# Showing real flight data on MNT Embark — a plan

Researched September 2026. No code written; this is the decision document.

---

## 1. The thing to settle before anything else

**You are an enquiry business, not a booking engine.** Every flight page ends
in "Request a quote", the same as a tour. Nobody buys a ticket on the site.

That single fact decides most of what follows, because the flight API market is
built almost entirely around *selling tickets*. The commercial APIs price per
booking and subsidise the searching; a site that searches heavily and books
nothing is the customer they price against, not for.

So the first question is not "which API" but **which of these two problems you
are actually solving:**

| | **A — Routes & schedules** | **B — Live fares** |
|---|---|---|
| Answers | Who flies Lahore → Kilimanjaro, on which days, how long | What a seat costs right now |
| Changes | A few times a year | Every few minutes |
| Cost | ~$8–40 a month | Per-search or per-booking |
| Licensing | Data subscription | Often needs accreditation |
| Accuracy risk | Low — a route either exists or it doesn't | High — a stale price is a complaint |

Everything you have told me so far points at **A**. Your words: *"we dont want
to show prices we just want to show airlines which can go to that destination
from pakistan."* The Flights page copy already says fares are quoted on
request, and that is a defensible position for a curated operator.

**If A is still what you want, this is a cheap, low-risk problem and the rest of
this document is mostly about doing it well.** If you have changed your mind and
want live prices, skip to §6, which is honest about what that costs.

---

## 2. What changed since we last discussed this

**Amadeus Self-Service is gone.** Amadeus paused new registrations in March 2026
and decommissioned the portal on **17 July 2026** — API keys disabled, portal
inaccessible. Only the Enterprise product remains, which is an account-managed
commercial contract, not something you sign up for.

I recommended Amadeus to you earlier in our work. That recommendation is dead,
and I would have been sending you at a door that had already closed. This is the
main reason to check the market rather than plan from memory.

The knock-on effect is that a lot of the "just use the free tier" advice online
is now stale, and several of the remaining players have tightened access.

---

## 3. What to judge an option on

Criteria, in the order they should eliminate candidates:

1. **Can you actually get access?** Several of the best APIs are invite-only or
   need traffic you do not have. Kiwi's Tequila closed self-serve signup;
   their Travelpayouts route wants 50,000 monthly active users. Skyscanner is
   partnership-only. These are not options for you today, whatever their docs say.
2. **Does it cover your carriers?** This is the one that quietly breaks projects.
   Your routes start in Pakistan and several relevant carriers are low-cost
   (Fly Jinnah, AirSial) and historically thin in GDS data. Untested assumption —
   see the spike in §7.
3. **Does the licence allow commercial display?** AeroDataBox's free tier
   explicitly prohibits commercial use. Free tiers are for evaluation, not for
   running your business on.
4. **How long may you cache?** This sets your architecture and your bill. Seven
   days versus indefinite is the difference between a nightly job and a live call
   on every page view.
5. **Cost at your real traffic**, not at a demo. A brochure site's flight page
   might see a few hundred views a month; that shape suits a flat subscription
   and suits per-search pricing badly.
6. **What happens when it fails.** Not optional. The page must degrade to
   something truthful, not to an error.

---

## 4. The options, with real numbers

### For routes and schedules (problem A)

| Provider | What you get | Cost | Access | Notes |
|---|---|---|---|---|
| **AeroDataBox** | Airport daily routes & frequencies; future & historical schedules; arrivals/departures | Free 400 units (**non-commercial only**); $8/mo 5k units, $40/mo 50k, $200/mo 500k via RapidAPI; direct plans from $19/mo 40k units | Self-serve | Endpoints cost 1, 2 or 6 units by tier. Caching 7 days on lower plans, unlimited-while-subscribed higher up. **Best fit for you.** |
| **Aviationstack** | Real-time and historical flights, schedules, airlines, airports | Free 100 req/mo (1 per 60s); paid $49.99–$499.99/mo | Self-serve | Simple REST. Jump from free to $50 is steep for this use. |
| **FlightAware AeroAPI** | Status, tracking, historical, gates | $5/mo free credit; $200/mo minimum Standard | Self-serve | Built for live tracking, not "who flies where". Overkill. |
| **OAG / Cirium** | The authoritative schedule datasets | Enterprise quote | Sales | What the industry actually uses. Priced for airlines. |

### For live fares (problem B)

| Provider | Model | Cost | Access |
|---|---|---|---|
| **Duffel** | Sell tickets, they provide IATA accreditation | $3 per confirmed order, 1% managed content, **$0.005 per search beyond a 1500:1 search-to-order ratio** | Self-serve, no upfront |
| **Kiwi Tequila** | Commission | — | Invite-only; Travelpayouts route needs 50k MAU |
| **Skyscanner** | Metasearch partnership | Commercial agreement | Partnership only |
| **Travelpayouts** | Affiliate, cached fares | 1.1–1.5% commission | Free signup; Search API needs 50k MAU |
| **SerpApi (Google Flights)** | Scrapes Google Flights | Per search; cached searches free | Self-serve |
| **FlightAPI.io** | Prices + schedules | $49–$199/mo | Self-serve |

**Read the Duffel line carefully.** The 1500:1 ratio is generous *if you sell
tickets*. You don't. With zero orders every search is billable at $0.005 — cheap
in absolute terms (1,000 searches ≈ $5), but you are paying for a booking
pipeline you will never use, and the fares you display would be bookable ones
you then ask people to enquire about instead. That is a strange experience and a
strange bill.

**A note on SerpApi and the scraper-style APIs.** They work, they are cheap, and
they hand you Google Flights data without a partnership. They also sit on
someone else's terms of service rather than a licence granted to you. For a
hobby project, fine. For the public face of a travel company that wants airline
relationships, I would not build the flights page on it.

---

## 5. Recommended shape (for problem A)

### Architecture

```
  Admin panel  ──────────────► airlines table        (curated, authoritative)
                                     │
  Nightly job ──► AeroDataBox ──► route_cache table  (verifies + enriches)
                                     │
  Flights page ◄── your own API ◄────┘                (never calls out live)
```

Three principles:

1. **The API never touches the visitor's request path.** A scheduled job pulls
   routes into your own table; the page reads your table. The page stays fast,
   the bill stays flat and predictable, and an outage at the provider is
   invisible to visitors.
2. **Curated data stays authoritative; the API verifies it.** You keep the
   admin panel. The job's output is a *comparison*, not a replacement — it tells
   you "Emirates no longer appears on LHE→ZNZ" and you decide. A feed that
   silently rewrites your content is a feed that will one day silently delete it.
3. **The key lives on the server only.** Never in the browser bundle.

### What the nightly job does

For each Pakistani origin (LHE, KHI, ISB) and each destination airport in your
admin data, fetch the route and frequency data, then write:

- which airlines operate it, and how often
- first/last observed date, so you can tell fresh from stale
- a diff against your curated `airline_destinations` rows

### What the admin sees

A "Route check" screen listing disagreements:

- *Confirmed* — you say Emirates flies LHE→ZNZ; so does the data.
- *Not found* — you say it; the data doesn't. Worth checking.
- *New* — the data shows a carrier you haven't added. Worth adding.

You act on it. Nothing publishes itself.

---

## 6. The criteria for "real time"

You asked what criteria to use. "Real time" is not one thing — each kind of data
has its own honest refresh rate, and claiming more than you have is the failure
mode:

| Data | Genuine refresh | How to show it |
|---|---|---|
| **Which airlines fly a route** | Weekly is plenty. Networks change seasonally. | State it plainly. No timestamp needed. |
| **Days of week / frequency** | Weekly, from the schedule feed. | "Departs Mon, Wed, Fri" |
| **Departure times** | Monthly. Schedules are filed in advance. | "Typically departs 03:20" — "typically" is doing honest work |
| **Seat availability** | Seconds. You cannot have this without a booking API. | Don't show it. |
| **Fares** | Minutes. Same. | "Quoted on request" — where you are now, and it's fine |
| **Today's flight status** | Minutes. Only useful to someone already flying. | Out of scope |

**Three rules I would hold to:**

1. **Never show a number you cannot stand behind.** A fare or a seat count that
   turns out wrong costs you a client. A frequency that is a week stale costs
   you nothing.
2. **Label freshness where it matters, and only there.** "Schedules as at
   September 2026" under a timetable is honest and reassuring. A ticking
   "updated 4 seconds ago" on data that changes twice a year is theatre.
3. **Degrade to the curated data, never to an error.** If the feed is down or
   the route is unknown, show what your admin panel says and say nothing about
   the feed. The visitor came for "can I get there", and you can always answer
   that from your own table.

---

## 7. Validate before committing — a one-day spike

Do not sign up for a paid plan until these are answered. Each is a
`curl` against a free/trial key:

1. **Pakistani coverage.** Does the routes endpoint return sensible results for
   **LHE, KHI and ISB**? This is the make-or-break question.
2. **The low-cost carriers.** Do **Fly Jinnah (9P)** and **AirSial (PF)** appear
   at all? If not, any automated route list will silently omit them — and they
   matter for the domestic positioning legs.
3. **Your actual destinations.** Do **JRO, ZNZ, NBO, KGL, LUN, WDH** come back
   with the carriers you would expect?
4. **Unit cost in practice.** How many units does one route call actually
   consume? Tier 3 endpoints cost 6 units each — 400 free units is ~66 calls,
   which a careless loop burns in a minute.
5. **What the data says about connections.** Your itinerary is two legs via a
   hub. Does the feed model that, or only direct routes? If direct-only, you are
   assembling connections yourself and the curated table stays in charge.

**If (1) or (3) fails, stop.** The honest answer is then to keep the curated
admin data, which already works, and spend the effort on filling it in properly
rather than on an integration that returns nothing useful.

---

## 8. Phases

**Phase 0 — the spike above.** One day. Output: go / no-go, with evidence.

**Phase 1 — read-only verification.** Nightly job, `route_cache` table, admin
"Route check" screen. Nothing on the public site changes. You get a tool that
tells you when your curated data has drifted. Lowest risk, immediate value.

**Phase 2 — enrich the public pages.** Once you trust the feed, let it supply
frequency and typical departure times on the flight detail page, replacing the
generated schedule with real filed data. The disclaimer banner comes off *only*
for the fields that are genuinely sourced.

**Phase 3 — decide about fares.** Revisit only if the business changes and you
want to sell tickets. That is a different company with different obligations —
accreditation, payment handling, refunds, IATA rules — and it should be a
deliberate decision, not a feature.

---

## 9. Open questions for you

1. **Fares: still no?** If you want prices displayed, say so now — it changes the
   provider, the cost and the legal position, and §6 stops applying.
2. **Budget.** Is $8–40 a month acceptable? Below that there is no commercially
   licensed option, only free tiers that forbid commercial use.
3. **Who reconciles?** Phase 1 produces a list of disagreements. Someone has to
   look at it. If nobody will, build Phase 2 straight away or skip the whole thing.
4. **How much do the Pakistani low-cost carriers matter?** If Fly Jinnah and
   AirSial are essential, that raises the odds you stay curated regardless.

---

## Sources

- Amadeus shutdown: [PhocusWire](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers)
- [Duffel pricing](https://duffel.com/pricing)
- [AeroDataBox pricing](https://aerodatabox.com/pricing) · [AeroDataBox API](https://aerodatabox.com/api)
- [SerpApi Google Flights](https://serpapi.com/google-flights-api)
- Market overview: [Thunderbit, 10 Best Flight APIs 2026](https://thunderbit.com/blog/best-flight-api-with-free-tiers)
