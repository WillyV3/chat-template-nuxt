// Google Fonts loader for the themeable dashboard typography.
//
// The 40-theme catalog (themes.ts) carries tweakcn's LITERAL font-family strings
// (e.g. "Inter, sans-serif"); this stylesheet loads every non-system family they
// name, so a theme's font actually renders. ONE <link> (dashboard/layout.tsx)
// replaces the old per-family next/font self-host — that mapped themes to
// var(--font-*) defined on a descendant div, which never resolved at the :root
// scope the theme <style> writes, so most themes silently fell back to Geist.
// The v1 css API is used deliberately: it drops weights a family lacks instead
// of 400-erroring the whole request (verified 2026-08-12, HTTP 200, 36 families).
// The last 9 (Barlow…VT323) back the shadcn-studio extra themes + the "8-Bit"
// pixel theme (Pixelify Sans / Press Start 2P / VT323); the final two (Literata,
// Space Grotesk) back the Sontara ORIGINAL skins (Sontara Neon serif/sans,
// Solarium serif). The CSP is permissive (only frame-ancestors), so the CDN link
// is allowed.
export const THEME_WEBFONTS_HREF =
  "https://fonts.googleapis.com/css?family=Architects+Daughter|DM+Sans:400,500,600,700|Fira+Code:400,500,600,700|IBM+Plex+Mono:400,500,600,700|Inter:400,500,600,700|JetBrains+Mono:400,500,600,700|Libre+Baskerville:400,700|Lora:400,500,600,700|Merriweather:400,700|Montserrat:400,500,600,700|Open+Sans:400,500,600,700|Outfit:400,500,600,700|Oxanium:400,500,600,700|Playfair+Display:400,500,600,700|Plus+Jakarta+Sans:400,500,600,700|Poppins:400,500,600,700|Quicksand:400,500,600,700|Roboto:400,500,700|Roboto+Mono:400,500,600,700|Source+Code+Pro:400,500,600,700|Source+Serif+4:400,600,700|Space+Mono:400,700|Ubuntu+Mono:400,700|Geist:400,500,600,700|Geist+Mono:400,500,600,700|Barlow:400,500,600,700|Delius+Swash+Caps|Gabriela|Lato:400,700|Nunito:400,500,600,700|PT+Serif:400,700|Pixelify+Sans:400,500,600,700|Press+Start+2P|VT323|Literata:400,500,600,700|Space+Grotesk:400,500,600,700&display=swap";

// Every family the link loads — the pin (themes.test.ts) checks that each
// theme's non-system first-family appears here, so a theme can't ship naming a
// font the stylesheet doesn't load.
export const THEME_WEBFONT_FAMILIES: string[] = [
  "Architects Daughter", "DM Sans", "Fira Code", "Geist", "Geist Mono",
  "IBM Plex Mono", "Inter", "JetBrains Mono", "Libre Baskerville", "Lora",
  "Merriweather", "Montserrat", "Open Sans", "Outfit", "Oxanium",
  "Playfair Display", "Plus Jakarta Sans", "Poppins", "Quicksand", "Roboto",
  "Roboto Mono", "Source Code Pro", "Source Serif 4", "Space Mono", "Ubuntu Mono",
  // shadcn-studio extra themes + the "8-Bit" pixel theme:
  "Barlow", "Delius Swash Caps", "Gabriela", "Lato", "Nunito", "PT Serif",
  "Pixelify Sans", "Press Start 2P", "VT323",
  // Sontara ORIGINAL skins (Sontara Neon, Solarium):
  "Literata", "Space Grotesk",
];
