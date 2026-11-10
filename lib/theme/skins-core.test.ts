import { describe, it, expect } from "vitest";
import type { SkinValidationConfig, SkinRow, SkinPayload } from "./skins-core";

const skins = await import("./skins-core");

// ── Fixtures ─────────────────────────────────────────────────────────────

const CONFIG: SkinValidationConfig = {
  tokenKeys: ["background", "foreground", "primary", "radius", "letter-spacing", "shadow-color", "agent-surface"],
  fontFamilies: ["Inter", "Lora", "JetBrains Mono"],
};

function colorMap(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    background: "#ffffff",
    foreground: "#111111",
    primary: "oklch(0.6 0.2 260)",
    radius: "0.5rem",
    "letter-spacing": "0em",
    "shadow-color": "#1b2a2d",
    "agent-surface": "#faf9f7",
    ...overrides,
  };
}

function validRawPayload(overrides: Record<string, unknown> = {}): unknown {
  return {
    label: "My Skin",
    swatch: ["#ffffff", "#111111", "oklch(0.6 0.2 260)"],
    light: colorMap(),
    dark: colorMap({ background: "#000000", foreground: "#eeeeee" }),
    fontKey: { sans: "Inter", serif: "Lora", mono: "JetBrains Mono", display: "Inter" },
    ...overrides,
  };
}

function skinRow(overrides: Partial<SkinRow> = {}): SkinRow {
  return {
    slug: "skin-my-skin-abc123",
    name: "My Skin",
    payload: validRawPayload() as SkinPayload,
    status: "approved",
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════════
// THE SECURITY RECEIPT — attack payloads from spec §4, every one REJECTED.
// ════════════════════════════════════════════════════════════════════════
describe("validateSkinPayload — attack suite (spec §4)", () => {
  it("REJECTS a CSS rule breakout (close declaration + rule, inject a full-page overlay)", () => {
    const payload = validRawPayload({
      light: colorMap({ primary: "red} html{display:none!important} :root{--x:red" }),
    });
    const result = skins.validateSkinPayload(payload, CONFIG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("light.primary"))).toBe(true);
  });

  it("REJECTS url() exfiltration/beaconing", () => {
    const payload = validRawPayload({
      light: colorMap({ background: "url(https://evil.example/x)" }),
    });
    const result = skins.validateSkinPayload(payload, CONFIG);
    expect(result.ok).toBe(false);
  });

  it("REJECTS a url() value even wrapped to look like a function call", () => {
    const payload = validRawPayload({
      light: colorMap({ background: "rgb(url(https://evil.example/x))" }),
    });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS a font-string `;}` breakout — fonts are KEYS, not free strings", () => {
    const payload = validRawPayload({
      fontKey: { sans: 'Inter"; } body { background: url(evil)', serif: "Lora", mono: "JetBrains Mono" },
    });
    const result = skins.validateSkinPayload(payload, CONFIG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("fontKey.sans"))).toBe(true);
  });

  it("REJECTS an arbitrary font name not on the allowlist (exact-match only)", () => {
    const payload = validRawPayload({
      fontKey: { sans: "Comic Sans MS", serif: "Lora", mono: "JetBrains Mono" },
    });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS @import", () => {
    const payload = validRawPayload({
      light: colorMap({ primary: "@import url(evil.css)" }),
    });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS embedded newlines", () => {
    const payload = validRawPayload({
      light: colorMap({ primary: "red\n}html{display:none}" }),
    });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS a carriage-return-smuggled value", () => {
    const payload = validRawPayload({
      light: colorMap({ primary: "red\r}html{display:none}" }),
    });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS oversized values", () => {
    const huge = "#" + "ff".repeat(40); // 81 chars, way past MAX_COLOR_LEN
    const payload = validRawPayload({ light: colorMap({ primary: huge }) });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS an oversized font-breakout crammed into the length cap", () => {
    const payload = validRawPayload({
      light: colorMap({ primary: "oklch(0.5 0.1 200)".padEnd(70, " ") + ")" }),
    });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS a payload missing a required token", () => {
    const light = colorMap();
    delete (light as Record<string, unknown>).radius;
    const payload = validRawPayload({ light });
    const result = skins.validateSkinPayload(payload, CONFIG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("light.radius is missing"))).toBe(true);
  });

  it("REJECTS an unrecognized extra token key (no smuggled channel)", () => {
    const payload = validRawPayload({
      light: { ...colorMap(), evil: "red} body{display:none}" },
    });
    const result = skins.validateSkinPayload(payload, CONFIG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("light.evil"))).toBe(true);
  });

  it("REJECTS an unexpected top-level field", () => {
    const payload = validRawPayload({ rawCss: "body{display:none}" });
    const result = skins.validateSkinPayload(payload, CONFIG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("unexpected field: rawCss"))).toBe(true);
  });

  it("REJECTS expression() (legacy IE CSS expression injection)", () => {
    const payload = validRawPayload({ light: colorMap({ primary: "expression(alert(1))" }) });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS a backslash-escape smuggling attempt", () => {
    const payload = validRawPayload({ light: colorMap({ primary: "oklch(0.5 0.1 200\\)) ;" }) });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS a semicolon-terminated declaration smuggle", () => {
    const payload = validRawPayload({ light: colorMap({ primary: "red;background:url(evil)" }) });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS a value with leading/trailing whitespace (edge smuggling)", () => {
    const payload = validRawPayload({ light: colorMap({ primary: " #ffffff " }) });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS radius with injected characters despite matching a loose regex", () => {
    const payload = validRawPayload({ light: colorMap({ radius: "1rem}body{color:red" }) });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS a radius value using an un-allowed unit", () => {
    const payload = validRawPayload({ light: colorMap({ radius: "1vh" }) });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS wrong swatch length (too few / too many)", () => {
    expect(skins.validateSkinPayload(validRawPayload({ swatch: ["#fff", "#000"] }), CONFIG).ok).toBe(false);
    expect(
      skins.validateSkinPayload(
        validRawPayload({ swatch: ["#fff", "#000", "#111", "#222", "#333"] }),
        CONFIG,
      ).ok,
    ).toBe(false);
  });

  it("REJECTS a label with control characters", () => {
    expect(skins.validateSkinPayload(validRawPayload({ label: "evil\x00name" }), CONFIG).ok).toBe(false);
  });

  it("REJECTS a label over the length bound", () => {
    expect(skins.validateSkinPayload(validRawPayload({ label: "x".repeat(41) }), CONFIG).ok).toBe(false);
  });

  it("REJECTS a non-object payload", () => {
    expect(skins.validateSkinPayload("not an object", CONFIG).ok).toBe(false);
    expect(skins.validateSkinPayload(null, CONFIG).ok).toBe(false);
    expect(skins.validateSkinPayload(["array"], CONFIG).ok).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// Valid inputs — every supported grammar form must PASS.
// ════════════════════════════════════════════════════════════════════════
describe("validateSkinPayload — accepts every valid color grammar", () => {
  it("accepts #hex (3/6/8 digit)", () => {
    expect(skins.validateSkinPayload(validRawPayload({ light: colorMap({ primary: "#abc" }) }), CONFIG).ok).toBe(true);
    expect(skins.validateSkinPayload(validRawPayload({ light: colorMap({ primary: "#aabbcc" }) }), CONFIG).ok).toBe(true);
    expect(skins.validateSkinPayload(validRawPayload({ light: colorMap({ primary: "#aabbccdd" }) }), CONFIG).ok).toBe(true);
  });

  it("accepts oklch()", () => {
    expect(
      skins.validateSkinPayload(validRawPayload({ light: colorMap({ primary: "oklch(0.6231 0.1880 259.8145)" }) }), CONFIG)
        .ok,
    ).toBe(true);
    expect(
      skins.validateSkinPayload(validRawPayload({ light: colorMap({ primary: "oklch(62% 0.18 259.8 / 0.5)" }) }), CONFIG)
        .ok,
    ).toBe(true);
  });

  it("accepts hsl()/hsla() — modern and legacy comma syntax", () => {
    expect(skins.validateSkinPayload(validRawPayload({ light: colorMap({ primary: "hsl(210 40% 96%)" }) }), CONFIG).ok).toBe(
      true,
    );
    expect(
      skins.validateSkinPayload(validRawPayload({ light: colorMap({ primary: "hsla(210, 40%, 96%, 0.5)" }) }), CONFIG).ok,
    ).toBe(true);
    expect(
      skins.validateSkinPayload(validRawPayload({ light: colorMap({ primary: "hsl(210deg 40% 96% / 50%)" }) }), CONFIG).ok,
    ).toBe(true);
  });

  it("accepts rgb()/rgba() — modern and legacy comma syntax", () => {
    expect(skins.validateSkinPayload(validRawPayload({ light: colorMap({ primary: "rgb(0 151 178)" }) }), CONFIG).ok).toBe(
      true,
    );
    expect(
      skins.validateSkinPayload(validRawPayload({ light: colorMap({ primary: "rgba(0, 151, 178, 0.5)" }) }), CONFIG).ok,
    ).toBe(true);
  });

  it("accepts the safe keyword set", () => {
    for (const kw of ["transparent", "currentColor", "inherit"]) {
      expect(skins.validateSkinPayload(validRawPayload({ light: colorMap({ primary: kw }) }), CONFIG).ok).toBe(true);
    }
  });

  it("accepts a system font-stack keyword in fontKey (including the display slot)", () => {
    const result = skins.validateSkinPayload(
      validRawPayload({ fontKey: { sans: "system-ui", serif: "Lora", mono: "monospace", display: "ui-sans-serif" } }),
      CONFIG,
    );
    expect(result.ok).toBe(true);
  });

  it("round-trips: valid payload in -> same values out, trimmed label", () => {
    const result = skins.validateSkinPayload(validRawPayload({ label: "  Nice Skin  " }), CONFIG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.label).toBe("Nice Skin");
      expect(result.data.light).toEqual(colorMap());
      expect(result.data.fontKey).toEqual({ sans: "Inter", serif: "Lora", mono: "JetBrains Mono", display: "Inter" });
    }
  });

  // ── letter-spacing: a NEW grammar (signed length, unlike radius) ────────
  it("accepts every valid letter-spacing form", () => {
    for (const v of ["0em", "0", "normal", "-0.05em", "0.025em", "1px", "-2rem"]) {
      expect(
        skins.validateSkinPayload(validRawPayload({ light: colorMap({ "letter-spacing": v }) }), CONFIG).ok,
        v,
      ).toBe(true);
    }
  });

  it("REJECTS a letter-spacing CSS breakout", () => {
    const payload = validRawPayload({ light: colorMap({ "letter-spacing": "1em}body{display:none}" }) });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS a letter-spacing calc() breakout attempt (functions are not part of this grammar)", () => {
    const payload = validRawPayload({ light: colorMap({ "letter-spacing": "calc(1em + 1px)" }) });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS a letter-spacing value using an un-allowed unit (%, vh)", () => {
    expect(skins.validateSkinPayload(validRawPayload({ light: colorMap({ "letter-spacing": "5%" }) }), CONFIG).ok).toBe(
      false,
    );
    expect(skins.validateSkinPayload(validRawPayload({ light: colorMap({ "letter-spacing": "1vh" }) }), CONFIG).ok).toBe(
      false,
    );
  });

  it("REJECTS an out-of-bounds letter-spacing magnitude", () => {
    expect(skins.validateSkinPayload(validRawPayload({ light: colorMap({ "letter-spacing": "10em" }) }), CONFIG).ok).toBe(
      false,
    );
  });

  it("REJECTS a semicolon-smuggled letter-spacing value", () => {
    const payload = validRawPayload({ light: colorMap({ "letter-spacing": "0em;background:url(evil)" }) });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  // ── shadow-color / agent-surface: ordinary color-grammar tokens ─────────
  it("accepts a valid shadow-color and agent-surface, rejects a breakout on either", () => {
    expect(
      skins.validateSkinPayload(validRawPayload({ light: colorMap({ "shadow-color": "oklch(0.2 0.05 250)" }) }), CONFIG)
        .ok,
    ).toBe(true);
    expect(
      skins.validateSkinPayload(validRawPayload({ light: colorMap({ "agent-surface": "#faf9f7" }) }), CONFIG).ok,
    ).toBe(true);
    expect(
      skins.validateSkinPayload(validRawPayload({ light: colorMap({ "shadow-color": "red}html{display:none}" }) }), CONFIG)
        .ok,
    ).toBe(false);
    expect(
      skins.validateSkinPayload(validRawPayload({ light: colorMap({ "agent-surface": "url(evil.example)" }) }), CONFIG).ok,
    ).toBe(false);
  });

  // ── fontKey.display: same allowlist posture as sans/serif/mono ──────────
  it("REJECTS an arbitrary fontKey.display not on the allowlist", () => {
    const payload = validRawPayload({
      fontKey: { sans: "Inter", serif: "Lora", mono: "JetBrains Mono", display: "Comic Sans MS" },
    });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS a fontKey.display CSS-breakout string", () => {
    const payload = validRawPayload({
      fontKey: { sans: "Inter", serif: "Lora", mono: "JetBrains Mono", display: 'Inter"; } body { background: url(evil)' },
    });
    expect(skins.validateSkinPayload(payload, CONFIG).ok).toBe(false);
  });

  it("REJECTS a payload missing fontKey.display — the 4th slot is required, not optional", () => {
    const payload = validRawPayload({ fontKey: { sans: "Inter", serif: "Lora", mono: "JetBrains Mono" } });
    const result = skins.validateSkinPayload(payload, CONFIG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("fontKey.display"))).toBe(true);
  });

  it("REJECTS out-of-range numeric components (rgb > 255, hue > 360)", () => {
    expect(skins.validateSkinPayload(validRawPayload({ light: colorMap({ primary: "rgb(300 0 0)" }) }), CONFIG).ok).toBe(
      false,
    );
    expect(skins.validateSkinPayload(validRawPayload({ light: colorMap({ primary: "hsl(999 40% 40%)" }) }), CONFIG).ok).toBe(
      false,
    );
  });
});

// ════════════════════════════════════════════════════════════════════════
// resolveSkinTheme — fail-safe on read
// ════════════════════════════════════════════════════════════════════════
describe("resolveSkinTheme", () => {
  it("returns null for a non-approved skin (pending/rejected/hidden all fail closed)", () => {
    for (const status of ["pending", "rejected", "hidden"] as const) {
      expect(skins.resolveSkinTheme(skinRow({ status }), CONFIG)).toBeNull();
    }
  });

  it("returns null when the STORED payload is invalid — never trust a prior validation", () => {
    const corrupted = skinRow({
      status: "approved",
      payload: validRawPayload({ light: colorMap({ primary: "red}html{display:none}" }) }) as SkinPayload,
    });
    expect(skins.resolveSkinTheme(corrupted, CONFIG)).toBeNull();
  });

  it("resolves a valid approved skin to a Theme-shaped object", () => {
    const row = skinRow({ status: "approved" });
    const theme = skins.resolveSkinTheme(row, CONFIG);
    expect(theme).not.toBeNull();
    expect(theme?.id).toBe(row.slug);
    expect(theme?.fontSans).toBe("Inter, sans-serif");
    expect(theme?.fontSerif).toBe("Lora, serif");
    expect(theme?.fontMono).toBe("JetBrains Mono, monospace");
    expect(theme?.fontDisplay).toBe("Inter, sans-serif");
    expect(theme?.light.primary).toBe("oklch(0.6 0.2 260)");
    expect(theme?.light["shadow-color"]).toBe("#1b2a2d");
    expect(theme?.light["letter-spacing"]).toBe("0em");
  });

  it("resolves a system-stack fontKey verbatim (no fallback appended)", () => {
    const row = skinRow({
      status: "approved",
      payload: validRawPayload({
        fontKey: { sans: "system-ui", serif: "Lora", mono: "monospace", display: "ui-sans-serif" },
      }) as SkinPayload,
    });
    const theme = skins.resolveSkinTheme(row, CONFIG);
    expect(theme?.fontSans).toBe("system-ui");
    expect(theme?.fontMono).toBe("monospace");
    expect(theme?.fontDisplay).toBe("ui-sans-serif");
  });
});

// ════════════════════════════════════════════════════════════════════════
// isSkinSlug / slug generation
// ════════════════════════════════════════════════════════════════════════
describe("isSkinSlug", () => {
  it("accepts well-formed skin slugs", () => {
    expect(skins.isSkinSlug("skin-my-skin-abc123")).toBe(true);
    expect(skins.isSkinSlug("skin-a")).toBe(true);
  });

  it("rejects catalog ids and malformed slugs", () => {
    expect(skins.isSkinSlug("modern-minimal")).toBe(false);
    expect(skins.isSkinSlug("skin-")).toBe(false);
    expect(skins.isSkinSlug("skin--leading-dash")).toBe(false);
    expect(skins.isSkinSlug("SKIN-CAPS")).toBe(false);
    expect(skins.isSkinSlug("skin-" + "x".repeat(41))).toBe(false);
  });
});
