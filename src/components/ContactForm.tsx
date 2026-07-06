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
const SUBMIT_TIMEOUT_MS = 15000;
const TURNSTILE_SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined;

const inputStyle: React.CSSProperties = {
	border: "1px solid #ddd",
	background: "#fff",
	padding: "13px 14px",
	fontSize: "14.5px",
	outline: "none",
};

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

		const formEl = event.currentTarget;
		const formData = new FormData(formEl);
		formData.set("form_rendered_at", String(renderedAt));

		// The backend contract is (name, email, message). Fold the design's
		// extra Company / Phone fields into the message body so they reach the
		// email without changing the Pages Function or its tests.
		const company = (formData.get("company") as string | null)?.trim();
		const phone = (formData.get("phone") as string | null)?.trim();
		const baseMessage = ((formData.get("message") as string | null) ?? "").trim();
		const prefixLines = [
			company ? `Company: ${company}` : null,
			phone ? `Phone: ${phone}` : null,
		].filter(Boolean);
		const composedMessage = prefixLines.length
			? `${prefixLines.join("\n")}\n\n${baseMessage}`
			: baseMessage;
		formData.set("message", composedMessage);
		formData.delete("company");
		formData.delete("phone");

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

		try {
			const response = await fetch("/contact", {
				method: "POST",
				body: formData,
				signal: controller.signal,
			});
			const result = (await response.json()) as { ok: boolean };

			if (response.ok && result.ok) {
				setState("success");
				formEl.reset();
				if (window.turnstile && widgetIdRef.current) {
					window.turnstile.reset(widgetIdRef.current);
				}
			} else {
				setState("error");
			}
		} catch {
			setState("error");
		} finally {
			clearTimeout(timeout);
		}
	}

	const isSubmitting = state === "submitting";

	return (
		<form onSubmit={handleSubmit} noValidate style={{ background: "#f8f6f3", padding: "clamp(22px,3vw,34px)" }}>
			<div style={{ fontFamily: "'Chakra Petch',sans-serif", fontWeight: 700, fontSize: "22px" }}>Request a Quote</div>
			<div style={{ fontSize: "14px", color: "#666", marginTop: "4px" }}>
				Share your requirement — we usually respond within one working day.
			</div>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit,minmax(min(220px,100%),1fr))",
					gap: "14px",
					marginTop: "20px",
				}}
			>
				<input className="q-input" name="name" aria-label="Your name" placeholder="Your name" required disabled={isSubmitting} style={inputStyle} />
				<input className="q-input" name="company" aria-label="Company" placeholder="Company" disabled={isSubmitting} style={inputStyle} />
				<input className="q-input" name="phone" aria-label="Phone or WhatsApp" placeholder="Phone / WhatsApp" disabled={isSubmitting} style={inputStyle} />
				<input className="q-input" name="email" type="email" aria-label="Email" placeholder="Email" required disabled={isSubmitting} style={inputStyle} />
			</div>

			<textarea
				className="q-input"
				name="message"
				aria-label="Requirement"
				placeholder="Requirement — e.g. bell annealer for 25 t steel wire coils, electric, HNx atmosphere…"
				rows={5}
				required
				disabled={isSubmitting}
				style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginTop: "14px", resize: "vertical" }}
			/>

			{/* Honeypot: present for bots, hidden from sighted users and assistive tech. */}
			<div className="visually-hidden" aria-hidden="true">
				<label htmlFor="company_website">Company website</label>
				<input id="company_website" name="company_website" type="text" tabIndex={-1} autoComplete="off" />
			</div>

			{TURNSTILE_SITE_KEY && <div ref={turnstileContainerRef} style={{ marginTop: "16px" }} />}

			<button
				type="submit"
				className="btn-red"
				disabled={isSubmitting}
				style={{
					fontFamily: "'Chakra Petch',sans-serif",
					fontWeight: 600,
					fontSize: "15px",
					background: "#D91E26",
					color: "#fff",
					padding: "15px 30px",
					letterSpacing: "1.5px",
					cursor: "pointer",
					border: "none",
					marginTop: "16px",
				}}
			>
				{isSubmitting ? "SENDING…" : "SEND ENQUIRY →"}
			</button>

			<p role="status" aria-live="polite" style={{ fontSize: "12px", color: "#9a9a9a", marginTop: "10px" }}>
				{state === "success" && "Message sent — we'll be in touch soon."}
				{state === "error" && "Something went wrong. Please try again."}
				{state !== "success" && state !== "error" && "We usually reply within one working day."}
			</p>
		</form>
	);
}
