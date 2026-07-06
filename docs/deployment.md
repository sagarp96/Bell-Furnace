# Deployment Runbook (U6)

This is the one implementation unit in the plan that can't be done from the
repo — it requires your Cloudflare account, your domain, and API keys from
Resend and Turnstile. Follow these steps to go live.

## Current status (as of 2026-07-06)

- ✅ Cloudflare Pages project `bell-furnace` created, static build deployed
  via `wrangler pages deploy dist` — live at https://bell-furnace.pages.dev
- ✅ `bellfurnace.com` and `www.bellfurnace.com` attached to the project via
  the Cloudflare API (zone confirmed active on the same account)
- ⏳ **Blocked on you:** the CNAME DNS records for both domains haven't been
  created yet. The wrangler OAuth session used to automate the steps above
  only has `zone:read`, not DNS-write scope, so this one step needs to
  happen through your dashboard — see step 5 below.
- ⬜ Not done: GitHub → Cloudflare Pages git integration (the deploy above
  was a one-off CLI upload, not continuous deployment on push — see step 3
  if you want push-to-deploy)
- ⬜ Not done: Resend/Turnstile accounts, keys, and Production secrets (step
  2 and 4) — the contact form will not work until these are set
- ⬜ Not done: the WAF rate-limiting rule (step 6)

## 1. Push the branch and open a PR

```bash
git push -u origin feat/astro-cloudflare-site
```

Then merge to `main` (or deploy straight from this branch — Cloudflare Pages
can build any branch).

## 2. Create accounts and get keys

- **Resend** (https://resend.com): create an API key. Verify your sending
  domain (adds SPF/DKIM DNS records — do this on the Cloudflare zone for your
  domain) before going live, or Resend may reject sends or messages may land
  in spam even when the API call reports success.
- **Cloudflare Turnstile** (Cloudflare dashboard → Turnstile): create a
  widget for your domain. You get a **site key** (public) and a **secret
  key** (server-side only).

## 3. Connect Cloudflare Pages

**Already done, partially:** the `bell-furnace` Pages project exists and has
one live deployment, pushed via `wrangler pages deploy dist` (a one-off CLI
upload — not connected to git yet). **Optional follow-up:** connect it to
this GitHub repo for continuous deployment on push — Cloudflare dashboard →
Workers & Pages → `bell-furnace` project → Settings → Builds → connect to
Git (this step needs GitHub OAuth authorization through the dashboard, not
something wrangler/API can do).

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory:** `/` (repo root)

## 4. Set environment variables / secrets

**Production environment secrets** (Pages project → Settings → Environment
variables — set for Production, not just Preview):

| Name | Value | Notes |
|---|---|---|
| `RESEND_API_KEY` | from step 2 | secret |
| `TURNSTILE_SECRET_KEY` | from step 2 | secret |
| `CONTACT_TO_EMAIL` | where you want submissions sent | plain var |
| `CONTACT_FROM_EMAIL` | a verified Resend sending address | plain var |
| `PUBLIC_TURNSTILE_SITE_KEY` | from step 2 | **build-time** var — Astro inlines `PUBLIC_*` vars at build, so this must be set before the build runs, not just at runtime |

`.dev.vars.example` and `.env.example` at the repo root mirror these for
local development — copy them to `.dev.vars` / `.env` and fill in real
values (both are gitignored).

## 5. Attach your custom domain

**Already done via the API:** `bellfurnace.com` and `www.bellfurnace.com`
are both registered against the `bell-furnace` Pages project (status:
`pending`, waiting on DNS). **What's left:** the CNAME records themselves —
go to the Cloudflare dashboard → `bellfurnace.com` zone → **DNS** → add:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `@` (root) | `bell-furnace.pages.dev` | Proxied |
| CNAME | `www` | `bell-furnace.pages.dev` | Proxied |

Cloudflare supports CNAME flattening at the apex, so the root-domain CNAME
is valid here. Once added, check Pages project → **Custom domains** — both
should flip from `pending` to `active` within a few minutes as the cert
issues. Confirm no CAA record on your zone blocks certificate issuance.

## 6. Configure rate limiting (zone-level, not code) — do this before step 7

The contact form has no request-volume cap in code (rate limiting is
deliberately handled at the zone level, not in `functions/contact.ts` — see
the plan's KTD). Until this rule is active, `/contact` is unbounded and a
motivated actor could exhaust the Resend sending quota. Configure the rule
in this step, **before** running through the go-live checklist below, so
there's no window where the custom domain is live with no rate limit at all.

Cloudflare dashboard → your domain's zone → **Security → WAF → Rate limiting
rules** → create a rule scoped to the `/contact` path.

- **Suggested starting threshold:** 5 requests per 10 minutes per IP.
- **Known tradeoff, accepted for this site's traffic:** shared/CGNAT IPs
  (e.g. an office network) could occasionally hit this from multiple real
  visitors. Tune the threshold up if that happens; there's no perfect
  IP-based rule.

## 7. Go-live checklist

Run through this against the **production custom domain**, not the
`*.pages.dev` preview URL — several of these (Turnstile, the rate-limit
rule) only take effect once the custom domain is attached.

- [ ] All Production secrets from step 4 are set (including the build-time
      `PUBLIC_TURNSTILE_SITE_KEY`)
- [ ] Resend sending domain shows verified (SPF/DKIM) in the Resend dashboard
- [ ] Turnstile widget's allowed-domain list includes the production domain
- [ ] Rate limiting rule for `/contact` is active; test by submitting the
      form several times quickly and confirming it starts blocking
- [ ] Production URL loads over HTTPS with a valid certificate
- [ ] Full click-through on the production domain: navigation, scroll
      animations, a page transition, and one real contact-form submission
      that arrives in the `CONTACT_TO_EMAIL` inbox
- [ ] Submit the honeypot path once (fill the hidden `company_website`
      field via devtools) and confirm it's rejected with no email sent
- [ ] Check Cloudflare Pages Functions logs (dashboard **Logs** tab, or
      `wrangler pages deployment tail`) during the tests above — rejection
      reasons should be visible, no unhandled exceptions

## Ongoing

- Recurring manual smoke test (e.g. monthly, or after touching
  `functions/contact.ts`): submit one real message through the live form.
- Treat Resend's own Activity/Logs dashboard as the system of record for
  delivery — the Function only reports success/failure at submit time, not
  ongoing deliverability.
