// Presentation-only metadata for the skin editor's control panel — how the
// SKIN_TOKEN_KEYS/SKIN_FONT_SLOTS (apps/web/lib/themes.ts, the real single
// source) group into labeled sections. NOT a security boundary (that's
// validateSkinPayload); this just decides what the accordion looks like.
// token-schema.test.ts proves every group here, plus radius/letter-spacing/
// fonts handled outside the color groups, adds up to the full editable
// surface — so no globals.css token the user would expect is missing.
import { SKIN_TOKEN_KEYS, SKIN_EXTRA_TOKEN_KEYS, SKIN_FONT_SLOTS } from "@/lib/theme/themes";

export interface ColorTokenGroup {
  id: string;
  label: string;
  keys: readonly string[];
}

/** Human label for one token row. Falls back to a title-cased key if a token
 *  is ever added to SKIN_TOKEN_KEYS without a label here — never silently
 *  drop a token from the editor for lack of copy. */
export const TOKEN_LABELS: Record<string, string> = {
  background: "Background",
  foreground: "Foreground (text)",
  card: "Card background",
  "card-foreground": "Card text",
  popover: "Popover background",
  "popover-foreground": "Popover text",
  "agent-surface": "Agent message surface",
  primary: "Primary",
  "primary-foreground": "Primary text",
  secondary: "Secondary",
  "secondary-foreground": "Secondary text",
  muted: "Muted background",
  "muted-foreground": "Muted text",
  accent: "Accent",
  "accent-foreground": "Accent text",
  destructive: "Destructive",
  "destructive-foreground": "Destructive text",
  border: "Border",
  input: "Input border",
  ring: "Focus ring",
  "shadow-color": "Shadow tint",
  "chart-1": "Chart 1",
  "chart-2": "Chart 2",
  "chart-3": "Chart 3",
  "chart-4": "Chart 4",
  "chart-5": "Chart 5",
  sidebar: "Sidebar background",
  "sidebar-foreground": "Sidebar text",
  "sidebar-primary": "Sidebar primary",
  "sidebar-primary-foreground": "Sidebar primary text",
  "sidebar-accent": "Sidebar accent",
  "sidebar-accent-foreground": "Sidebar accent text",
  "sidebar-border": "Sidebar border",
  "sidebar-ring": "Sidebar focus ring",
};

export const FONT_SLOT_LABELS: Record<(typeof SKIN_FONT_SLOTS)[number], string> = {
  sans: "Body & UI (sans)",
  serif: "Reading & agent replies (serif)",
  mono: "Code (mono)",
  display: "Headings (display)",
};

export const COLOR_TOKEN_GROUPS: ColorTokenGroup[] = [
  { id: "base", label: "Base", keys: ["background", "foreground"] },
  {
    id: "surfaces",
    label: "Cards & popovers",
    keys: ["card", "card-foreground", "popover", "popover-foreground", "agent-surface"],
  },
  {
    id: "primary",
    label: "Primary & secondary",
    keys: ["primary", "primary-foreground", "secondary", "secondary-foreground"],
  },
  {
    id: "accent",
    label: "Muted & accent",
    keys: ["muted", "muted-foreground", "accent", "accent-foreground"],
  },
  {
    id: "destructive",
    label: "Destructive",
    keys: ["destructive", "destructive-foreground"],
  },
  {
    id: "borders",
    label: "Borders, inputs & shadow",
    keys: ["border", "input", "ring", "shadow-color"],
  },
  {
    id: "charts",
    label: "Charts",
    keys: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"],
  },
  {
    id: "sidebar",
    label: "Sidebar",
    keys: [
      "sidebar",
      "sidebar-foreground",
      "sidebar-primary",
      "sidebar-primary-foreground",
      "sidebar-accent",
      "sidebar-accent-foreground",
      "sidebar-border",
      "sidebar-ring",
    ],
  },
];

/** Every color-grammar token key across all groups — used both to render and
 *  to prove (token-schema.test.ts) that this equals SKIN_TOKEN_KEYS minus the
 *  2 non-color keys (radius, letter-spacing), which the editor renders as a
 *  slider instead of a color row. */
export const ALL_GROUPED_COLOR_KEYS: string[] = COLOR_TOKEN_GROUPS.flatMap((g) => g.keys);

export const NON_COLOR_TOKEN_KEYS = ["radius", "letter-spacing"] as const;

export function tokenLabel(key: string): string {
  return (
    TOKEN_LABELS[key] ??
    key
      .split("-")
      .map((w) => w[0]!.toUpperCase() + w.slice(1))
      .join(" ")
  );
}

// Re-exported for convenience so editor components only need one import path.
export { SKIN_TOKEN_KEYS, SKIN_EXTRA_TOKEN_KEYS, SKIN_FONT_SLOTS };
