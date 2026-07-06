import { Resend } from "resend";

interface Env {
	RESEND_API_KEY: string;
	TURNSTILE_SECRET_KEY: string;
	CONTACT_TO_EMAIL: string;
	CONTACT_FROM_EMAIL: string;
}

const MAX_LENGTHS = { name: 100, email: 254, message: 2000 } as const;
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
// Reject CR/LF and other control characters in header-adjacent fields (name,
// email) — the primary defense against header injection, since `email` is
// used as Resend's replyTo. `message` only ever lands in the plain-text
// body, so it uses a separate, looser pattern below that allows the CRLF a
// normal multi-line <textarea> submission contains.
const HEADER_SAFE_CONTROL_CHAR_PATTERN = /[\r\n\x00-\x08\x0b\x0c\x0e-\x1f]/;
const MESSAGE_CONTROL_CHAR_PATTERN = /[\x00-\x08\x0b\x0c\x0e-\x1f]/;

const MIN_SUBMIT_MS = 2000;

export type RejectionReason =
	| "honeypot"
	| "too_fast"
	| "missing_fields"
	| "invalid_email"
	| "field_too_long"
	| "control_characters"
	| "turnstile_missing"
	| "turnstile_invalid"
	| "turnstile_verify_error";

export interface ValidSubmission {
	name: string;
	email: string;
	message: string;
	turnstileToken: string;
}

export type ValidationResult =
	| { ok: true; data: ValidSubmission }
	| { ok: false; reason: RejectionReason };

/**
 * Pure validation/rejection logic — no network calls, no Cloudflare bindings.
 * Kept separate from onRequestPost so it can be unit tested with a plain
 * FormData object, no PagesFunction context or browser required.
 */
export function validateSubmission(form: FormData): ValidationResult {
	// Honeypot: a field real users never see or fill; visually hidden (not
	// display:none) on the client, but still aria-hidden/tabindex=-1 there so
	// screen-reader users don't stumble into it either.
	const honeypot = form.get("company_website");
	if (typeof honeypot === "string" && honeypot.length > 0) {
		return { ok: false, reason: "honeypot" };
	}

	// Timing check: reject submissions completed faster than a human plausibly
	// could. Client renders a hidden `form_rendered_at` timestamp on mount.
	// This is a client-controlled, unsigned value — a soft anti-bot heuristic,
	// not a security boundary; Turnstile is the actual bot gate.
	const renderedAtField = form.get("form_rendered_at");
	const renderedAt = typeof renderedAtField === "string" ? Number(renderedAtField) : NaN;
	if (!Number.isFinite(renderedAt) || Date.now() - renderedAt < MIN_SUBMIT_MS) {
		return { ok: false, reason: "too_fast" };
	}

	const name = form.get("name");
	const email = form.get("email");
	const message = form.get("message");
	const turnstileToken = form.get("cf-turnstile-response");

	if (
		typeof name !== "string" ||
		typeof email !== "string" ||
		typeof message !== "string" ||
		name.trim() === "" ||
		email.trim() === "" ||
		message.trim() === ""
	) {
		return { ok: false, reason: "missing_fields" };
	}

	if (
		name.length > MAX_LENGTHS.name ||
		email.length > MAX_LENGTHS.email ||
		message.length > MAX_LENGTHS.message
	) {
		return { ok: false, reason: "field_too_long" };
	}

	if (
		HEADER_SAFE_CONTROL_CHAR_PATTERN.test(name) ||
		HEADER_SAFE_CONTROL_CHAR_PATTERN.test(email) ||
		MESSAGE_CONTROL_CHAR_PATTERN.test(message)
	) {
		return { ok: false, reason: "control_characters" };
	}

	if (!EMAIL_PATTERN.test(email)) {
		return { ok: false, reason: "invalid_email" };
	}

	if (typeof turnstileToken !== "string" || turnstileToken === "") {
		return { ok: false, reason: "turnstile_missing" };
	}

	return { ok: true, data: { name, email, message, turnstileToken } };
}

function logRejection(reason: RejectionReason) {
	// No PII logged — reason code only, so Cloudflare's Functions log stream
	// is useful for spot-checking after launch without exposing submitter data.
	console.log(`contact-form: rejected (${reason})`);
}

function jsonResponse(body: Record<string, unknown>, status: number) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

const TURNSTILE_VERIFY_TIMEOUT_MS = 5000;

export async function verifyTurnstile(token: string, secretKey: string, remoteIp: string): Promise<boolean> {
	const body = new URLSearchParams({ secret: secretKey, response: token, remoteip: remoteIp });
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TURNSTILE_VERIFY_TIMEOUT_MS);

	// Fail-closed: any network error, timeout, or non-2xx response is treated
	// as a rejection, never as a silent pass (doc-review finding).
	try {
		const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
			method: "POST",
			body,
			signal: controller.signal,
		});

		if (!response.ok) return false;

		const result = (await response.json()) as { success: boolean };
		return result.success === true;
	} catch {
		return false;
	} finally {
		clearTimeout(timeout);
	}
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
	const { request, env } = context;

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return jsonResponse({ ok: false, error: "Invalid form submission." }, 400);
	}

	const validation = validateSubmission(form);
	if (!validation.ok) {
		logRejection(validation.reason);
		const status = 400;
		const messages: Record<RejectionReason, string> = {
			honeypot: "Submission rejected.",
			too_fast: "Submission rejected.",
			missing_fields: "Please fill in all fields.",
			invalid_email: "Please enter a valid email address.",
			field_too_long: "One or more fields is too long.",
			control_characters: "Submission rejected.",
			turnstile_missing: "Verification failed. Please try again.",
			turnstile_invalid: "Verification failed. Please try again.",
			turnstile_verify_error: "Verification failed. Please try again.",
		};
		return jsonResponse({ ok: false, error: messages[validation.reason] }, status);
	}

	const { name, email, message, turnstileToken } = validation.data;

	const remoteIp = request.headers.get("CF-Connecting-IP") ?? "";
	const turnstileOk = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, remoteIp);
	if (!turnstileOk) {
		logRejection("turnstile_invalid");
		return jsonResponse({ ok: false, error: "Verification failed. Please try again." }, 400);
	}

	const resend = new Resend(env.RESEND_API_KEY);

	try {
		// Structured params only — never string-concatenated into headers/subject,
		// which is what would otherwise open a header-injection path (doc-review finding).
		const { error } = await resend.emails.send({
			from: env.CONTACT_FROM_EMAIL,
			to: env.CONTACT_TO_EMAIL,
			replyTo: email,
			subject: "New contact form submission",
			text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
		});

		if (error) {
			console.log("contact-form: resend send failed");
			return jsonResponse({ ok: false, error: "Could not send your message. Please try again later." }, 502);
		}
	} catch {
		console.log("contact-form: resend send threw");
		return jsonResponse({ ok: false, error: "Could not send your message. Please try again later." }, 502);
	}

	return jsonResponse({ ok: true }, 200);
};
