---
title: "feat: Scaffold Astro marketing site on Cloudflare Pages"
type: feat
status: active
date: 2026-07-05
deepened: 2026-07-05
origin: docs/brainstorms/2026-07-05-website-tech-stack-requirements.md
---

# feat: Scaffold Astro marketing site on Cloudflare Pages

## Summary

Build the marketing site as a static Astro project deployed to Cloudflare Pages: responsive layout, GSAP-driven scroll/parallax/page-transition animation, and a single contact form backed by a Cloudflare Pages Function with layered spam protection. Page content stays placeholder until the Design file lands.

## Problem Frame

The repo is currently empty. Nothing has been scaffolded, so this plan starts a greenfield project rather than modifying existing code. The stack and key trade-offs were already resolved in `docs/brainstorms/2026-07-05-website-tech-stack-requirements.md`; this plan turns those decisions into concrete, dependency-ordered implementation units, informed by current (2026) Astro/Cloudflare/GSAP research.

---

## Requirements

**Hosting & domain**
- R1. The site is deployed on Cloudflare Pages.
- R2. The purchased domain (already a Cloudflare zone) is attached to the Pages project via Cloudflare's own custom-domain flow.

**Project foundation**
- R3. The project is a static-output Astro site (no server adapter).
- R4. Layout and styles are responsive across phone, tablet, and laptop viewports.

**Content**
- R5. Page content is authored directly in the repo as plain `.astro` pages; real copy/IA is placeholder until the Design file is available.

**Animation**
- R6. Scroll-driven sequences and parallax are implemented with GSAP + ScrollTrigger.
- R7. Hover/entrance micro-interactions use CSS transitions, kept separate from the GSAP scroll choreography (per origin decision — a single library should not own both scales of motion).
- R8. Page transitions use Astro View Transitions with GSAP re-initialized on transition.
- R9. All animation respects `prefers-reduced-motion` and degrades/disables parallax on mobile viewports.

**Contact form**
- R10. The site includes exactly one contact form; no other backend functionality is in scope.
- R11. The form submits to a Cloudflare Pages Function (not a third-party form service), which sends the message on via the Resend API.
- R12. The form is protected by a honeypot + timing check, a Cloudflare Turnstile challenge, and zone-level rate limiting.

---

## Key Technical Decisions

- **React (via `@astrojs/react`) is the sole UI framework for interactive/animated islands.** Astro is framework-agnostic, so this is a first-class decision, not an inference from file extensions. All islands in this plan (`ScrollReveal.tsx`, `ContactForm.tsx`, `TransitionController.tsx`) are React; no vanilla-script islands are planned. This keeps GSAP cleanup uniform (`@gsap/react`'s `useGSAP()` everywhere, no second manual-cleanup code path to maintain). If a genuinely trivial one-off script ever doesn't warrant React's hydration cost, that would be a deliberate exception requiring its own manual `ScrollTrigger.kill()` cleanup — not the default.
- **Static Astro output, no `@astrojs/cloudflare` adapter.** The adapter is only needed for SSR/on-demand rendering. Since the only server-side need is the contact form, which Cloudflare Pages Functions handle independently via a top-level `functions/` directory, the Astro build itself stays fully static (`astro build` → `dist`). This avoids adapter/Wrangler-runtime complexity entirely.
- **Cloudflare Pages over Workers-with-static-assets.** Confirmed with the user despite Cloudflare steering new 2026 projects toward Workers. The concrete cost of staying on Pages: Pages Functions do not get access to newer Workers-first bindings — confirmed during planning that the Workers Rate Limiting binding is explicitly absent from Pages Functions' supported binding set (see KTD on contact-form defense below), which is why rate limiting is handled at the zone level instead of in code. In exchange, Pages keeps the simpler dashboard-based Git-connect flow and is not a one-way door (see Risks).
- **GSAP + ScrollTrigger owns scroll/parallax/transition choreography; CSS transitions own hover/entrance micro-interactions.** This preserves the origin brainstorm's explicit split (R7) rather than collapsing everything into one library: GSAP is reserved for motion that's driven by scroll position or navigation, while small, state-driven UI feedback (hover, focus, entrance-on-mount for non-scroll elements) stays plain CSS — cheaper, and avoids paying GSAP's JS cost for effects that don't need a timeline engine. `gsap.matchMedia()` gates the GSAP side for both `prefers-reduced-motion` and mobile-breakpoint parallax reduction.
- **Transition orchestration hydrates separately from per-section scroll animation.** R8 (GSAP re-init on every Astro View Transition) and KTD's lazy-hydration goal are in tension: a page-transition controller must run on *every* navigation, while per-section scroll-reveal islands should only hydrate when scrolled into view. Resolution: a small root-level transition-controller component hydrates via `client:load` in `BaseLayout` (always-on, minimal footprint), while section-level animated islands (e.g. `ScrollReveal.tsx`) stay on `client:visible`/`client:idle`. The two are separate components with separate hydration strategies, not one directive doing both jobs.
- **Plain `.astro` pages, no content collections.** Content collections solve listing/filtering problems the site doesn't have yet (no blog, no repeatable content). Reserved for later if a blog/resources section is added.
- **Layered contact-form defense, no third-party form vendor, rate limiting resolved at the zone level (not in code).** Honeypot + submit-timing check (always on, zero cost) → Cloudflare Turnstile (primary bot gate, native to the existing Cloudflare account) → a **Cloudflare WAF Rate Limiting Rule** scoped to `/contact`, configured at the dashboard/zone level (available on the Free plan, 1 rule). This replaces the originally-considered Workers Rate Limiting binding: research confirmed during planning that binding is not in Cloudflare's documented Pages Functions binding set at all (not merely undocumented — explicitly absent from both the Pages bindings list and the Pages `wrangler.toml` config reference), so it was never a viable option under Pages Functions. A code-level Durable Object IP-counter (DOs are supported for Pages Functions, unlike the rate-limit binding) is a valid future hardening layer if the zone-level rule proves insufficient, but is not needed for this site's expected traffic and is deferred (see Scope Boundaries).
- **Resend** as the transactional email API called from the Pages Function. Considered against Postmark, SendGrid, and Cloudflare Email Routing; Resend won on having a documented, current Cloudflare-Workers-native integration pattern (Cloudflare's own tutorial covers this exact Pages-Function-plus-Resend shape) and a free tier sufficient for a low-volume contact form — the Workers runtime itself has no built-in email-sending capability, so an external API is required regardless of which one is chosen.

---

## Implementation Units

### U1. Project scaffold & Astro config

- **Goal:** Initialize the Astro project with static output, TypeScript, a shared base layout, and the folder conventions the rest of the plan builds on.
- **Requirements:** R3, R4
- **Dependencies:** none
- **Files:** `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/layouts/BaseLayout.astro`, `src/pages/index.astro` (placeholder), `.gitignore`
- **Approach:** Scaffold via `npm create astro@latest`. Keep `output: 'static'` (Astro's default) — do not install `@astrojs/cloudflare`. `BaseLayout.astro` carries shared `<head>` concerns (title, description, canonical URL, OG tags) behind a small typed props interface so every page stays consistent without a CMS enforcing it.
- **Patterns to follow:** n/a — greenfield.
- **Test scenarios:** Test expectation: none -- scaffolding/config only, no behavior to test.
- **Verification:** `astro build` completes with no errors; `astro dev` renders the placeholder home page.

### U2. Global styles & responsive foundation

- **Goal:** Establish design tokens, responsive breakpoints, shared header/footer, CSS-driven micro-interactions, and a CSS-level motion-safety baseline.
- **Requirements:** R4, R7, R9
- **Dependencies:** U1
- **Files:** `src/styles/global.css`, `src/components/Header.astro`, `src/components/Footer.astro`
- **Approach:** CSS custom properties for spacing/color/type scale; mobile-first breakpoints with tablet/laptop min-width overrides. Hover/entrance micro-interactions (buttons, links, cards) use plain CSS transitions defined alongside component styles — no GSAP involvement, per the KTD separating scroll choreography from micro-interactions. Include a global `@media (prefers-reduced-motion: reduce)` rule as a CSS-level safety net underneath the GSAP-level `matchMedia` handling added in U4.
- **Test scenarios:** Test expectation: none -- styling/layout only, verified visually.
- **Verification:** Header/footer render correctly and reflow correctly at phone/tablet/laptop breakpoints; hover/entrance micro-interactions animate via CSS only (confirm no GSAP is invoked for these).

### U3. Page content structure (placeholder marketing pages)

- **Goal:** Stand up the page-level structure as plain `.astro` pages with placeholder sections, ready for real copy once the Design file arrives.
- **Requirements:** R5
- **Dependencies:** U1, U2
- **Files:** `src/pages/index.astro`, additional `src/pages/*.astro` placeholders as needed (exact set deferred — see Open Questions)
- **Approach:** Plain `.astro` pages per the content-collections KTD above. Each page composes shared sections (hero, feature blocks, CTA, contact) via `BaseLayout`.
- **Test scenarios:** Test expectation: none -- placeholder content, no behavioral logic.
- **Verification:** All planned placeholder pages route correctly and render without errors.

### U4. Animation system (GSAP, ScrollTrigger, page transitions)

- **Goal:** Configure GSAP/ScrollTrigger, build a reusable scroll-reveal/parallax island pattern, and wire up page transitions, all gated by reduced-motion and mobile breakpoint.
- **Requirements:** R6, R8, R9
- **Dependencies:** U1, U2
- **Files:** `package.json` (`gsap`, `@gsap/react`), `src/components/animated/ScrollReveal.tsx` (reference scroll island, `client:visible`), `src/components/TransitionController.tsx` (root-level transition orchestrator, `client:load`), `src/lib/gsap.ts` (shared registration/setup)
- **Approach:** Register `ScrollTrigger` once in a shared module, guarded against re-registration across multiple islands. Build one reference scroll-reveal island hydrated with `client:visible`, using `useGSAP()` for automatic cleanup. Gate all scroll/parallax animation setup through `gsap.matchMedia()`: check `prefers-reduced-motion` first (skip animation or snap to end-state via `.set()`), then a mobile breakpoint query (disable/simplify parallax below ~768px). Page transitions are owned by a separate `TransitionController` island mounted once in `BaseLayout` with `client:load` (always-on, per KTD on hydration split) — it re-initializes/reverts GSAP contexts on `astro:page-load` for Astro View Transitions, independent of whether any per-section scroll island has hydrated yet.
- **Execution note:** Treat the ScrollTrigger + View Transitions interaction as the highest-uncertainty part of this unit — validate transition + re-init behavior manually before relying on it across many pages, given the known integration gaps surfaced in research.
- **Technical design (directional, not implementation-ready):**
  ```
  registerOnce(() => gsap.registerPlugin(ScrollTrigger))

  gsap.matchMedia().add(
    { reduced: "(prefers-reduced-motion: no-preference)", mobile: "(max-width: 768px)" },
    (ctx) => { /* branch animation setup on ctx.conditions.reduced / .mobile */ }
  )
  ```
- **Patterns to follow:** Astro client directives (`client:visible` for below-fold sections, `client:idle` for secondary widgets).
- **Test scenarios:**
  - Happy path: on a laptop-width viewport with no reduced-motion preference, scrolling into the reference section triggers its ScrollTrigger-driven animation once.
  - Edge case: with `prefers-reduced-motion: reduce` set, the same section renders in its end-state with no animation.
  - Edge case: at a phone-width viewport, parallax depth is disabled/simplified per the mobile `matchMedia` branch.
  - Integration: navigating between two pages (triggering a View Transition) does not leave duplicate or orphaned ScrollTrigger instances on the destination page.
  - Integration: a page transition fires correctly even when navigating before any below-fold `ScrollReveal` island has hydrated — confirms `TransitionController`'s `client:load` hydration is independent of the lazy `client:visible` islands.
- **Verification:** Manually verify all five scenarios above across at least one desktop and one mobile viewport, with and without the OS reduced-motion setting.

### U5. Contact form (UI + Cloudflare Pages Function backend)

- **Goal:** Build the contact form UI with a honeypot field and Turnstile widget, and a Cloudflare Pages Function that validates and sends the message via Resend.
- **Requirements:** R10, R11, R12
- **Dependencies:** U1, U2
- **Files:** `src/components/ContactForm.tsx`, `functions/contact.ts`, `.dev.vars` (local secrets template, no real values committed), `package.json` (`resend` dependency)
- **Approach:** The client renders the form plus a visually-hidden (not `display:none`) honeypot input and the Turnstile widget, then POSTs to `/contact` with form fields and the Turnstile token. `functions/contact.ts` exports `onRequestPost`: rejects if the honeypot is filled or the submission completed faster than a minimum time threshold; verifies the Turnstile token via Cloudflare's `siteverify` endpoint; then sends the message via the Resend API using a `RESEND_API_KEY` secret. Returns a JSON success/error response; the client form reflects the corresponding state. Rate limiting itself (R12) is handled at the zone level in U6, not in this unit's code — see the KTD on contact-form defense.
- **Execution note:** Log the specific rejection reason (honeypot / timing / bad Turnstile token — no PII) on each rejected request so Cloudflare's Functions log stream is useful for spot-checking after launch, per the launch-verification notes in U6.
- **Patterns to follow:** Cloudflare Pages Functions file-based routing (`functions/contact.ts` → `/contact`); Cloudflare's documented Resend-from-Workers pattern.
- **Test scenarios:**
  - Happy path: a valid submission (empty honeypot, human-paced timing, valid Turnstile token) sends an email via Resend and returns success.
  - Edge case: honeypot field filled → request rejected without calling Turnstile or Resend.
  - Edge case: submission completed faster than the minimum time threshold → rejected as likely automated.
  - Error path: invalid or missing Turnstile token → rejected with a client-visible error, no email sent.
  - Error path: Resend API call fails (simulated failure/timeout) → function returns an error state the client can display, without crashing.
- **Verification:** All five scenarios above pass; an end-to-end test submission arrives in the configured inbox; rejected requests appear in the Functions log with a distinguishing reason.

### U6. Cloudflare Pages deployment, custom domain & launch verification

- **Goal:** Connect the repo to a Cloudflare Pages project, configure build settings, attach the already-registered Cloudflare domain, configure zone-level rate limiting for the contact form, and verify the whole stack end-to-end before calling launch complete.
- **Requirements:** R1, R2, R12
- **Dependencies:** U1 (can run as soon as U1 lands, for early preview deploys; full end-to-end verification depends on U2–U5 being complete)
- **Files:** none required in-repo; optionally `wrangler.toml` if Pages Functions need an explicit compatibility date
- **Approach:** Connect the GitHub repo in the Cloudflare dashboard (Workers & Pages → create project → connect to Git). Set build command to `npm run build` and build output directory to `dist`. Attach the custom domain through the Pages project's **Custom domains** flow — not by hand-creating a CNAME first, which is a documented cause of 522 errors; Cloudflare writes the DNS record itself when the domain is added through the dashboard. Confirm CAA records don't block certificate issuance. Configure a **Cloudflare WAF Rate Limiting Rule** scoped to the `/contact` path (Free plan supports 1 rule) to satisfy R12's rate-limiting requirement at the zone level.
- **Test scenarios:** Test expectation: none -- infrastructure/config, verified via the go-live checklist below rather than test code.
- **Verification — go-live checklist:**
  - `RESEND_API_KEY` and `TURNSTILE_SECRET_KEY` are set as secrets on the Pages project's **Production** environment (not just in local `.dev.vars`)
  - Resend's sending domain is verified, with SPF/DKIM DNS records present on the Cloudflare zone — confirmed via a real test send landing in the inbox, not just an API success response
  - Turnstile's site key allowed-domain list includes the production custom domain (Turnstile keys are domain-bound; a widget verified only on the `*.pages.dev` preview URL can silently fail once served from production)
  - The WAF Rate Limiting Rule for `/contact` is active in production; exercised once (e.g., rapid duplicate submissions) to confirm it actually blocks
  - Production deploy is reachable at the custom domain over HTTPS with a valid certificate
  - Full click-through against the **production URL** (not preview): navigation, animations, and one real end-to-end contact-form submission arrives in the destination inbox
  - The honeypot-rejection path is exercised once against production, confirming the client shows the expected error state and no email is sent
  - Cloudflare's Functions log stream (dashboard **Logs** tab or `wrangler pages deployment tail`) is checked during the above tests to confirm rejection reasons are visible and no unhandled exceptions appear

---

## Scope Boundaries

**Deferred for later** (carried from origin):
- CMS / visual content editing
- Newsletter or mailing-list integration
- User accounts, dashboards, or any logged-in experience
- E-commerce or payment functionality

**Deferred to Follow-Up Work** (plan-local):
- Exact page copy and information architecture — pending the Design file
- Any future blog/listable content — would introduce Astro content collections, intentionally not set up now
- A code-level Durable Object IP-counter for the contact form, as a secondary rate-limiting layer beyond the zone-level WAF rule — only worth adding if real abuse volume shows the dashboard rule is insufficient

---

## Open Questions

**Deferred to implementation:**
- Exact page inventory and copy — depends on the Design file, to be swapped into the U3 placeholder structure once available.

*(The Workers Rate Limiting binding's Pages Functions compatibility, previously an open question, was resolved during planning — see the KTD on contact-form defense: the binding is confirmed absent from Pages Functions' supported binding set, so rate limiting is handled via a zone-level WAF rule instead.)*

---

## Risks & Dependencies

- Cloudflare Pages is in maintenance mode; new platform features are landing on Workers-with-static-assets first. No deprecation has been announced and Pages Functions remain fully supported — this is a deliberate, revisit-able choice (confirmed with the user), not an oversight.
- Astro 7's stricter HTML parsing (no longer auto-fixing invalid markup) can surface authoring errors once real content/copy is added — worth a quick lint pass after the Design file content lands.
- GSAP ScrollTrigger + Astro View Transitions have known community-reported integration gaps requiring manual re-init — flagged with an execution note on U4.
- Mobile viewport-height instability (address bar collapse/expand) can desync ScrollTrigger pinning on iOS Safari — test on real devices, not just emulation.
- Resend delivery failures are invisible to the site owner by default — the Function only reports success/failure to the submitting browser at that moment. Mitigation: treat Resend's own Activity/Logs dashboard as the system of record for delivery, plus a recurring (e.g., monthly) manual smoke-test submission through the live form.
- Pages Functions secrets are environment-scoped and easy to miss for Production — `.dev.vars` only covers local dev, so a deploy can succeed while the function fails on every real submission if `RESEND_API_KEY`/`TURNSTILE_SECRET_KEY` aren't separately set on the Production environment. Mitigation: explicit go-live checklist item in U6.
- Turnstile's site key is domain-bound — a widget verified on the `*.pages.dev` preview URL can silently fail once served from the custom domain. Mitigation: go-live checklist item in U6 confirming the production domain is in Turnstile's allowed-domain list, tested against the production URL specifically.

---

## Sources / Research

- Astro 7.0.6 current stable; `npm create astro@latest` scaffold path — [Astro Cloudflare deploy guide](https://docs.astro.build/en/guides/deploy/cloudflare/)
- Cloudflare Pages custom domain attachment flow and CNAME pitfall — [Cloudflare Pages custom domains docs](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- Cloudflare Pages maintenance-mode posture vs. Workers-with-static-assets — [Cloudflare Pages→Workers migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- Cloudflare Pages Functions + Resend email pattern — [Cloudflare Resend tutorial](https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/)
- `@gsap/react` / `useGSAP()` cleanup pattern — [GSAP + React docs](https://gsap.com/resources/React/)
- `gsap.matchMedia()` for reduced-motion and breakpoint gating — [gsap.matchMedia() docs](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/)
- Cloudflare Turnstile + Pages Function server-side verification pattern
- Confirmation that the Workers Rate Limiting binding is absent from Pages Functions' supported binding set — [Pages Functions bindings docs](https://developers.cloudflare.com/pages/functions/bindings/), [Pages wrangler.toml configuration reference](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [Rate Limiting binding docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- Cloudflare WAF Rate Limiting Rules (zone-level, Free-plan-compatible alternative) — [WAF Rate Limiting Rules docs](https://developers.cloudflare.com/waf/rate-limiting-rules/)
