/* ============================================================
   Client animations — ported from the design handoff support.js.
   - [data-reveal]      : fade/translate in on scroll
   - [data-count]       : count-up numbers
   - [data-bpwipe]      : "blueprint" image reveal wipe
   Re-runs on every Astro view-transition page load.
   ============================================================ */

const prefersReducedMotion = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function reveals() {
	const els = document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-rdone])");
	if (!els.length) return;
	if (prefersReducedMotion()) {
		els.forEach((el) => {
			el.dataset.rdone = "1";
			el.style.opacity = "1";
			el.style.transform = "none";
		});
		return;
	}
	const obs = new IntersectionObserver(
		(entries) => {
			entries.forEach((en) => {
				if (!en.isIntersecting) return;
				const el = en.target as HTMLElement;
				el.dataset.rdone = "1";
				const d = el.dataset.delay;
				if (d) el.style.transitionDelay = d + "ms";
				el.style.opacity = "1";
				el.style.transform = "none";
				obs.unobserve(el);
			});
		},
		{ threshold: 0.12 },
	);
	els.forEach((el) => obs.observe(el));
}

function wipes() {
	const els = document.querySelectorAll<HTMLElement>("[data-bpwipe]:not([data-wdone])");
	if (!els.length) return;
	if (prefersReducedMotion()) {
		els.forEach((el) => {
			el.dataset.wdone = "1";
			el.style.clipPath = "inset(100% 0 0 0)";
		});
		return;
	}
	const obs = new IntersectionObserver(
		(entries) => {
			entries.forEach((en) => {
				if (!en.isIntersecting) return;
				const el = en.target as HTMLElement;
				el.dataset.wdone = "1";
				obs.unobserve(el);
				setTimeout(() => {
					el.style.clipPath = "inset(100% 0 0 0)";
				}, 550);
			});
		},
		{ threshold: 0.45 },
	);
	els.forEach((el) => obs.observe(el));
}

function counts() {
	const els = document.querySelectorAll<HTMLElement>("[data-count]:not([data-cdone])");
	if (!els.length) return;
	if (prefersReducedMotion()) {
		els.forEach((el) => (el.dataset.cdone = "1"));
		return;
	}
	const obs = new IntersectionObserver(
		(entries) => {
			entries.forEach((en) => {
				if (!en.isIntersecting) return;
				const el = en.target as HTMLElement;
				el.dataset.cdone = "1";
				obs.unobserve(el);
				const target = parseFloat(el.dataset.count || "0");
				const suffix = el.dataset.suffix || "";
				const t0 = performance.now();
				const dur = 1600;
				const tick = (t: number) => {
					const p = Math.min(1, (t - t0) / dur);
					const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
					el.textContent = v + suffix;
					if (p < 1) requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
			});
		},
		{ threshold: 0.4 },
	);
	els.forEach((el) => obs.observe(el));
}

/* Mobile nav toggle (design used component state; here it's a data hook) */
function mobileNav() {
	const toggle = document.querySelector<HTMLElement>("[data-menu-toggle]");
	const menu = document.querySelector<HTMLElement>("[data-menu]");
	if (!toggle || !menu || toggle.dataset.wired) return;
	toggle.dataset.wired = "1";
	toggle.addEventListener("click", () => {
		const open = menu.style.display !== "flex";
		menu.style.display = open ? "flex" : "none";
		toggle.setAttribute("aria-expanded", String(open));
	});
}

function run() {
	requestAnimationFrame(() => {
		reveals();
		counts();
		wipes();
		mobileNav();
	});
}

document.addEventListener("astro:page-load", run);
