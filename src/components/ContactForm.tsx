import { useEffect, useRef, useState, type FormEvent } from "react";

declare global {
	interface Window {
		turnstile?: {
			render: (container: HTMLElement, options: { sitekey: string }) => string;
			reset: (widgetId?: string) => void;
		};
	}
}

type SubmitState = "idle" | "submitting" | "success" | "error";

const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const TURNSTILE_SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined;

export default function ContactForm() {
	const [state, setState] = useState<SubmitState>("idle");
	const [renderedAt] = useState(() => Date.now());
	const turnstileContainerRef = useRef<HTMLDivElement>(null);
	const widgetIdRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		if (!TURNSTILE_SITE_KEY || !turnstileContainerRef.current) return;

		function renderWidget() {
			if (window.turnstile && turnstileContainerRef.current) {
				widgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
					sitekey: TURNSTILE_SITE_KEY as string,
				});
			}
		}

		if (window.turnstile) {
			renderWidget();
			return;
		}

		const script = document.createElement("script");
		script.src = TURNSTILE_SCRIPT_SRC;
		script.async = true;
		script.defer = true;
		script.addEventListener("load", renderWidget);
		document.head.appendChild(script);

		return () => {
			script.removeEventListener("load", renderWidget);
		};
	}, []);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setState("submitting");

		const formData = new FormData(event.currentTarget);
		formData.set("form_rendered_at", String(renderedAt));

		try {
			const response = await fetch("/contact", { method: "POST", body: formData });
			const result = (await response.json()) as { ok: boolean };

			if (response.ok && result.ok) {
				setState("success");
				event.currentTarget.reset();
				if (window.turnstile && widgetIdRef.current) {
					window.turnstile.reset(widgetIdRef.current);
				}
			} else {
				setState("error");
			}
		} catch {
			setState("error");
		}
	}

	const isSubmitting = state === "submitting";

	return (
		<form onSubmit={handleSubmit} noValidate>
			<div>
				<label htmlFor="name">Name</label>
				<input id="name" name="name" type="text" required disabled={isSubmitting} />
			</div>

			<div>
				<label htmlFor="email">Email</label>
				<input id="email" name="email" type="email" required disabled={isSubmitting} />
			</div>

			<div>
				<label htmlFor="message">Message</label>
				<textarea id="message" name="message" required disabled={isSubmitting} />
			</div>

			{/* Honeypot: present in the DOM for bots to fill, but invisible to
			    sighted users AND assistive tech (aria-hidden + tabindex=-1 +
			    autocomplete=off) — visually-hidden, not display:none, since some
			    bots specifically skip display:none/type=hidden fields. */}
			<div className="visually-hidden" aria-hidden="true">
				<label htmlFor="company_website">Company website</label>
				<input
					id="company_website"
					name="company_website"
					type="text"
					tabIndex={-1}
					autoComplete="off"
				/>
			</div>

			{TURNSTILE_SITE_KEY && <div ref={turnstileContainerRef} />}

			<button type="submit" disabled={isSubmitting}>
				{isSubmitting ? "Sending…" : "Send message"}
			</button>

			<p role="status" aria-live="polite">
				{state === "success" && "Message sent — we'll be in touch soon."}
				{state === "error" && "Something went wrong. Please try again."}
			</p>
		</form>
	);
}
