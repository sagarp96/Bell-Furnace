import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, registerGsapPlugins } from "../../lib/gsap";

registerGsapPlugins();

interface ScrollRevealProps {
	children: ReactNode;
	/** Parallax y-offset in px, applied on laptop/tablet only — disabled on phone. */
	parallaxDistance?: number;
}

/**
 * Reference scroll-reveal/parallax island. Hydrate with `client:visible` so
 * the GSAP/ScrollTrigger JS never ships to visitors who don't scroll to it.
 */
export default function ScrollReveal({ children, parallaxDistance = 40 }: ScrollRevealProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			const mm = gsap.matchMedia();

			// Reduced-motion branch checked first — accessibility setting wins
			// over any breakpoint-based decision.
			mm.add(
				{
					noMotionPreference: "(prefers-reduced-motion: no-preference)",
					mobile: "(max-width: 767px)",
				},
				(context) => {
					const { noMotionPreference, mobile } = context.conditions as {
						noMotionPreference: boolean;
						mobile: boolean;
					};

					if (!noMotionPreference) {
						// User prefers reduced motion: snap straight to the end-state, no animation.
						gsap.set(containerRef.current, { opacity: 1, y: 0 });
						return;
					}

					const distance = mobile ? 0 : parallaxDistance;

					gsap.fromTo(
						containerRef.current,
						{ opacity: 0, y: distance },
						{
							opacity: 1,
							y: 0,
							duration: 0.6,
							ease: "power2.out",
							scrollTrigger: {
								trigger: containerRef.current,
								start: "top 85%",
								toggleActions: "play none none none",
							},
						},
					);
				},
			);

			return () => mm.revert();
		},
		{ scope: containerRef },
	);

	return <div ref={containerRef}>{children}</div>;
}
