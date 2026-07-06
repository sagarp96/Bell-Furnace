import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { validateSubmission, verifyTurnstile } from "./contact";

const HUMAN_DELAY_MS = 3000;

function buildForm(overrides: Record<string, string> = {}): FormData {
	const form = new FormData();
	form.set("name", "Ada Lovelace");
	form.set("email", "ada@example.com");
	form.set("message", "Hello,\nI would like to get in touch.");
	form.set("company_website", "");
	form.set("form_rendered_at", String(Date.now() - HUMAN_DELAY_MS));
	form.set("cf-turnstile-response", "test-token");

	for (const [key, value] of Object.entries(overrides)) {
		form.set(key, value);
	}

	return form;
}

describe("validateSubmission", () => {
	it("accepts a well-formed submission", () => {
		const result = validateSubmission(buildForm());
		expect(result.ok).toBe(true);
	});

	it("accepts a multi-line message (real <textarea> input contains CRLF/newlines)", () => {
		const result = validateSubmission(buildForm({ message: "Line one\r\nLine two\r\nLine three" }));
		expect(result.ok).toBe(true);
	});

	it("rejects when the honeypot field is filled", () => {
		const result = validateSubmission(buildForm({ company_website: "https://spam.example" }));
		expect(result).toEqual({ ok: false, reason: "honeypot" });
	});

	it("rejects a submission completed faster than the minimum threshold", () => {
		const result = validateSubmission(buildForm({ form_rendered_at: String(Date.now() - 100) }));
		expect(result).toEqual({ ok: false, reason: "too_fast" });
	});

	it("rejects when form_rendered_at is omitted entirely (regression test for Number(null)=0 bypass)", () => {
		const form = buildForm();
		form.delete("form_rendered_at");
		const result = validateSubmission(form);
		expect(result).toEqual({ ok: false, reason: "too_fast" });
	});

	it("rejects missing required fields", () => {
		const result = validateSubmission(buildForm({ name: "" }));
		expect(result).toEqual({ ok: false, reason: "missing_fields" });
	});

	it("rejects fields exceeding the max length", () => {
		const result = validateSubmission(buildForm({ name: "a".repeat(101) }));
		expect(result).toEqual({ ok: false, reason: "field_too_long" });
	});

	it("rejects an invalid email format", () => {
		const result = validateSubmission(buildForm({ email: "not-an-email" }));
		expect(result).toEqual({ ok: false, reason: "invalid_email" });
	});

	it("rejects control characters (other than CRLF) in the message", () => {
		const result = validateSubmission(buildForm({ message: "Hello\x07World" }));
		expect(result).toEqual({ ok: false, reason: "control_characters" });
	});

	it("rejects CRLF injected into the name field (header-injection defense)", () => {
		const result = validateSubmission(buildForm({ name: "Ada\r\nBcc: victim@example.com" }));
		expect(result).toEqual({ ok: false, reason: "control_characters" });
	});

	it("rejects a missing Turnstile token", () => {
		const result = validateSubmission(buildForm({ "cf-turnstile-response": "" }));
		expect(result).toEqual({ ok: false, reason: "turnstile_missing" });
	});
});

describe("verifyTurnstile", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.useRealTimers();
	});

	it("returns true when Cloudflare reports success", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ success: true }),
		}) as unknown as typeof fetch;

		await expect(verifyTurnstile("token", "secret", "1.2.3.4")).resolves.toBe(true);
	});

	it("fails closed when Cloudflare reports failure", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ success: false }),
		}) as unknown as typeof fetch;

		await expect(verifyTurnstile("token", "secret", "1.2.3.4")).resolves.toBe(false);
	});

	it("fails closed on a non-2xx response", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch;

		await expect(verifyTurnstile("token", "secret", "1.2.3.4")).resolves.toBe(false);
	});

	it("fails closed when the network request throws", async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

		await expect(verifyTurnstile("token", "secret", "1.2.3.4")).resolves.toBe(false);
	});
});
