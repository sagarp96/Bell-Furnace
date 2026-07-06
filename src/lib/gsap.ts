import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

/** Registers GSAP plugins exactly once, even if imported from multiple islands. */
export function registerGsapPlugins() {
	if (registered) return;
	gsap.registerPlugin(ScrollTrigger);
	registered = true;
}

export { gsap, ScrollTrigger };
