import { useEffect } from "react";
import { ScrollTrigger, registerGsapPlugins } from "../lib/gsap";

// This island hydrates client:load on every page, including ones with no
// ScrollReveal island (which is what normally triggers registration) — so
// it must guarantee registration itself before calling ScrollTrigger.refresh().
registerGsapPlugins();

/**
 * Root-level transition orchestrator. Hydrates via `client:load` in
 * BaseLayout — always-on, independent of whether any lazy `client:visible`
 * scroll island has hydrated yet — since it must run on every navigation,
 * not just when scrolled into view.
 *
 * Handles two things Astro's View Transitions don't do by default:
 * 1. Reverting/re-registering GSAP contexts so ScrollTrigger instances from
 *    the previous page don't leak into the new one.
 * 2. Moving keyboard focus to the new page's main heading, since a
 *    client-side DOM swap doesn't reset focus like a full navigation would.
 */
export default function TransitionController() {
	useEffect(() => {
		const handlePageLoad = () => {
			// astro:page-load fires after the new page's DOM is in place — safe
			// point to refresh ScrollTrigger measurements (layout may still be
			// settling right after a transition) and move focus, since a
			// client-side DOM swap doesn't reset focus like a full navigation would.
			ScrollTrigger.refresh();

			const heading = document.querySelector<HTMLElement>("main h1");
			if (heading) {
				heading.setAttribute("tabindex", "-1");
				heading.focus();
			}
		};

		document.addEventListener("astro:page-load", handlePageLoad);
		return () => document.removeEventListener("astro:page-load", handlePageLoad);
	}, []);

	return null;
}
