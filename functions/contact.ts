import { Resend } from "resend";

interface Env {
	RESEND_API_KEY: string;
	TURNSTILE_SECRET_KEY: string;
	CONTACT_TO_EMAIL: string;
	CONTACT_FROM_EMAIL: string;
}

const MAX_LENGTHS = { name: 100, email: 254, message: 2000 } as const;
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
// Reject CR/LF and other control characters — the primary defense against
// header injection if any field is ever used in an email header/subject.
const CONTROL_CHAR_PATTERN = /[\r\n\x00-\x08\x0b\x0c\x0e-\x1f]/;

type RejectionReason =
	| "honeypot"
	| "too_fast"
	| "missing_fields"
	| "invalid_email"
	| "field_too_long"
	| "control_characters"
	| "turnstile_missing"
	| "turnstile_invalid"
	| "turnstile_verify_error";

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

async function verifyTurnstile(token: string, secretKey: string, remoteIp: string): Promise<boolean> {
	const body = new URLSearchParams({ secret: secretKey, response: token, remoteip: remoteIp });

	// Fail-closed: any network error, timeout, or non-2xx response is treated
	// as a rejection, never as a silent pass (doc-review finding).
	try {
		const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
			method: "POST",
			body,
		});

		if (!response.ok) return false;

		const result = (await response.json()) as { success: boolean };
		return result.success === true;
	} catch {
		return false;
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

	// Honeypot: a field real users never see or fill; visually hidden (not
	// display:none) on the client, but still aria-hidden/tabindex=-1 there so
	// screen-reader users don't stumble into it either.
	const honeypot = form.get("company_website");
	if (typeof honeypot === "string" && honeypot.length > 0) {
		logRejection("honeypot");
		return jsonResponse({ ok: false, error: "Submission rejected." }, 400);
	}

	// Timing check: reject submissions completed faster than a human plausibly
	// could. Client renders a hidden `form_rendered_at` timestamp on mount.
	const renderedAt = Number(form.get("form_rendered_at"));
	const MIN_SUBMIT_MS = 2000;
	if (!Number.isFinite(renderedAt) || Date.now() - renderedAt < MIN_SUBMIT_MS) {
		logRejection("too_fast");
		return jsonResponse({ ok: false, error: "Submission rejected." }, 400);
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
		logRejection("missing_fields");
		return jsonResponse({ ok: false, error: "Please fill in all fields." }, 400);
	}

	if (
		name.length > MAX_LENGTHS.name ||
		email.length > MAX_LENGTHS.email ||
		message.length > MAX_LENGTHS.message
	) {
		logRejection("field_too_long");
		return jsonResponse({ ok: false, error: "One or more fields is too long." }, 400);
	}

	if (
		CONTROL_CHAR_PATTERN.test(name) ||
		CONTROL_CHAR_PATTERN.test(email) ||
		CONTROL_CHAR_PATTERN.test(message)
	) {
		logRejection("control_characters");
		return jsonResponse({ ok: false, error: "Submission rejected." }, 400);
	}

	if (!EMAIL_PATTERN.test(email)) {
		logRejection("invalid_email");
		return jsonResponse({ ok: false, error: "Please enter a valid email address." }, 400);
	}

	if (typeof turnstileToken !== "string" || turnstileToken === "") {
		logRejection("turnstile_missing");
		return jsonResponse({ ok: false, error: "Verification failed. Please try again." }, 400);
	}

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
