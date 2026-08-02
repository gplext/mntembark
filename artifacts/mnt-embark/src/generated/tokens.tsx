/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#FAF7F0",
      "foreground": "#1A1612",
      "border": "#DDD5C0",
      "card": "#FFFFFF",
      "cardForeground": "#1A1612",
      "popover": "#FFFFFF",
      "popoverForeground": "#1A1612",
      "primary": "#A8832A",
      "primaryForeground": "#FAF7F0",
      "secondary": "#F5EFE2",
      "secondaryForeground": "#1A1612",
      "muted": "#F0EAD8",
      "mutedForeground": "#7A6B52",
      "accent": "#C9A84C",
      "accentForeground": "#1A1612",
      "destructive": "#C0392B",
      "destructiveForeground": "#FAF7F0",
      "input": "#DDD5C0",
      "ring": "#A8832A",
      "chart1": "#A8832A",
      "chart2": "#8B7355",
      "chart3": "#C9A84C",
      "chart4": "#6B5A3E",
      "chart5": "#D4AA55",
      "sidebar": "#F5EFE2",
      "sidebarForeground": "#1A1612",
      "sidebarBorder": "#DDD5C0",
      "sidebarPrimary": "#A8832A",
      "sidebarPrimaryForeground": "#FAF7F0",
      "sidebarAccent": "#EDE3CC",
      "sidebarAccentForeground": "#1A1612",
      "sidebarRing": "#A8832A"
    },
    "dark": {
      "background": "#0A0908",
      "foreground": "#F2EAD3",
      "border": "#2E2820",
      "card": "#141210",
      "cardForeground": "#F2EAD3",
      "popover": "#1C1916",
      "popoverForeground": "#F2EAD3",
      "primary": "#C9A84C",
      "primaryForeground": "#0A0908",
      "secondary": "#2A2520",
      "secondaryForeground": "#F2EAD3",
      "muted": "#1E1B17",
      "mutedForeground": "#9C8B6E",
      "accent": "#D4AA55",
      "accentForeground": "#0A0908",
      "destructive": "#9B2335",
      "destructiveForeground": "#F2EAD3",
      "input": "#2E2820",
      "ring": "#C9A84C",
      "chart1": "#C9A84C",
      "chart2": "#8B7355",
      "chart3": "#E8C97A",
      "chart4": "#6B5A3E",
      "chart5": "#A08B6A",
      "sidebar": "#100E0C",
      "sidebarForeground": "#F2EAD3",
      "sidebarBorder": "#2E2820",
      "sidebarPrimary": "#C9A84C",
      "sidebarPrimaryForeground": "#0A0908",
      "sidebarAccent": "#2A2520",
      "sidebarAccentForeground": "#C9A84C",
      "sidebarRing": "#C9A84C"
    }
  },
  "fontFamily": {
    "sans": [
      "Montserrat",
      "sans-serif"
    ],
    "serif": [
      "Cormorant Garamond",
      "Georgia",
      "serif"
    ],
    "mono": [
      "JetBrains Mono",
      "monospace"
    ]
  },
  "radius": "0.25rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
