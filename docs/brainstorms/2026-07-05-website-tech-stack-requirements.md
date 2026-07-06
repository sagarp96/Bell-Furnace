---
date: 2026-07-05
topic: website-tech-stack
---

## Summary

Build the business/marketing site on Astro, deployed to Cloudflare Pages, with content edited directly in the repo (no CMS) and a single contact form as the only backend surface. Rich scroll-driven and interactive animation is a core requirement, handled primarily with GSAP + ScrollTrigger.

## Key Decisions

- **Astro over a React meta-framework (Next.js).** The site is content/marketing-first, not app-like, and the domain already lives on Cloudflare — hosting on Cloudflare Pages keeps domain, DNS, and hosting on one vendor. Astro's zero-JS-by-default output also gives the best baseline performance for a mostly-static site. Trade-off: growing into app-like features later (accounts, dashboards) would mean bolting them on rather than growing into them naturally.
- **GSAP + ScrollTrigger as the primary animation engine**, with lightweight CSS or Framer Motion for small hover/entrance micro-interactions. One library carries the scroll/parallax/page-transition choreography rather than mixing several animation systems.
- **No CMS.** Content (copy, images, pricing) is edited directly in the repo by the site owner and deployed via a normal commit/push. No headless CMS, no visual editor.
- **Interactive animation lives in isolated Astro islands.** Since Astro ships no JS by default, animated sections must be explicitly marked as hydrated islands; the rest of the page stays static HTML/CSS.
- **Contact form submits via a Cloudflare Pages Function**, not a third-party form service. Keeps the entire stack (hosting, DNS, and now form handling) on one vendor, at the cost of owning a small piece of backend code (e.g., an email-sending call to a provider like Resend).

## Requirements

**Hosting & domain**
- R1. The site is deployed on Cloudflare Pages.
- R2. The purchased domain (already on Cloudflare) is connected to the Pages deployment via Cloudflare DNS.

**Content & structure**
- R3. Page content (text, images, pricing/offer details) is stored and edited directly in the repository — no external CMS dependency.
- R4. The site layout and page structure follow the Design file once it is shared; this doc does not invent page count or IA.

**Performance**
- R5. Pages ship minimal JavaScript by default; animated components are the only parts that hydrate client-side.
- R6. The site is fully responsive across phone, tablet, and laptop viewports.

**Animation**
- R7. Scroll-driven sequences, parallax, and page transitions are implemented with GSAP + ScrollTrigger.
- R8. Smaller hover/entrance micro-interactions use CSS transitions or Framer Motion, kept separate from the GSAP scroll choreography.

**Contact form**
- R9. The site includes one contact form; no other backend functionality (accounts, newsletters, bookings) is in scope.
- R10. The contact form submits to a Cloudflare Pages Function (not a third-party form service), which sends the submission on (e.g., via email).

## Scope Boundaries

Deferred for later:
- CMS / visual content editing
- Newsletter or mailing-list integration
- User accounts, dashboards, or any logged-in experience
- E-commerce or payment functionality

## Outstanding Questions

Deferred to planning:
- Exact page count, information architecture, and animation scope — pending the Design file, which the user will provide separately.

## Dependencies / Assumptions

- The domain is registered through Cloudflare; this plan assumes it can be pointed at Cloudflare Pages via Cloudflare's own DNS (same-vendor setup, no cross-registrar transfer needed).
- A Design file exists (referenced by the user) but has not yet been shared with the agent — content structure, exact animation scope, and page inventory depend on it.
