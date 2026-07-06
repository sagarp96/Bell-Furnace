/* ============================================================
   Client animations — ported from the design handoff support.js.
   - [data-reveal]      : fade/translate in on scroll
   - [data-count]       : count-up numbers
   - [data-bpwipe]      : "blueprint" image reveal wipe
   - #bp-svg            : animated cutaway furnace blueprint
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

function blueprint() {
	const svg = document.getElementById("bp-svg") as SVGSVGElement | null;
	if (!svg || svg.dataset.done) return;
	svg.dataset.done = "1";
	const motion = !prefersReducedMotion();

	// line-draw for main outlines
	svg.querySelectorAll<SVGPathElement>(".bp-draw").forEach((p, i) => {
		let len = 0;
		try {
			len = p.getTotalLength();
		} catch {
			len = 0;
		}
		if (!len || !motion) return;
		p.style.strokeDasharray = String(len);
		p.style.strokeDashoffset = String(len);
		p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
			duration: 1100,
			delay: 150 + i * 140,
			easing: "ease-out",
			fill: "forwards",
		});
	});

	// coil groups fade in
	svg.querySelectorAll<SVGGElement>(".bp-draw-g").forEach((g, i) => {
		if (!motion) return;
		g.style.opacity = "0";
		g.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: 600,
			delay: 700 + i * 200,
			fill: "forwards",
		});
	});

	// labels fade in
	svg.querySelectorAll<SVGGElement>(".bp-label").forEach((g, i) => {
		if (!motion) {
			g.style.opacity = "1";
			return;
		}
		g.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: 500,
			delay: 1400 + i * 170,
			fill: "forwards",
		});
	});

	// spinning impeller
	const imp = svg.querySelector<SVGGElement>("#bp-impeller");
	if (imp && motion) {
		imp.style.transformBox = "fill-box";
		imp.style.transformOrigin = "center";
		imp.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
			duration: 2600,
			iterations: Infinity,
			easing: "linear",
		});
	}

	// hood lift loop
	const hood = svg.querySelector<SVGGElement>("#bp-hood");
	if (hood && motion) {
		hood.animate(
			[
				{ transform: "translateY(0px)", offset: 0 },
				{ transform: "translateY(0px)", offset: 0.3 },
				{ transform: "translateY(-56px)", offset: 0.48 },
				{ transform: "translateY(-56px)", offset: 0.62 },
				{ transform: "translateY(0px)", offset: 0.8 },
				{ transform: "translateY(0px)", offset: 1 },
			],
			{ duration: 9000, iterations: Infinity, easing: "ease-in-out", delay: 2000 },
		);
	}

	// heat waves rising
	svg.querySelectorAll<SVGPathElement>(".bp-wave").forEach((w, i) => {
		if (!motion) return;
		w.style.transformBox = "fill-box";
		w.animate(
			[
				{ opacity: 0, transform: "translateY(26px)" },
				{ opacity: 0.85, transform: "translateY(0px)" },
				{ opacity: 0, transform: "translateY(-26px)" },
			],
			{ duration: 2400, delay: 1800 + i * 500, iterations: Infinity, easing: "ease-in-out" },
		);
	});
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
		blueprint();
		mobileNav();
	});
}

document.addEventListener("astro:page-load", run);
