import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const productsPage = readFileSync(
	new URL("../src/pages/products.astro", import.meta.url),
	"utf8",
);
const homePage = readFileSync(
	new URL("../src/pages/index.astro", import.meta.url),
	"utf8",
);

describe("products image presentation", () => {
	it("uses uniform edge-to-edge 3:4 frames on Home and Products", () => {
		expect(productsPage).toContain("aspect-ratio:3/4");
		expect(productsPage).not.toContain("aspect-ratio:4/3");
		expect(productsPage).not.toContain("height:100%;object-fit:contain");
		expect(homePage).toContain("aspect-ratio:3/4");
		expect(homePage).not.toContain("height:100%;object-fit:contain");
		expect(productsPage).toContain("height:100%;object-fit:cover");
		expect(homePage).toContain("height:100%;object-fit:cover");
	});

	it("keeps the requested product photo mappings", () => {
		expect(productsPage).toContain('img: "retort-lifting.jpg"');
		expect(productsPage).toContain('img: "heating-hood-elements.jpg"');
		expect(homePage).toContain('img: "impeller-dynamic-balancing.jpg"');
		expect(homePage).toContain('img: "base-assembly-dispatch.jpg"');
	});
});
