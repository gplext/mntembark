/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#F4F8FB",
      "foreground": "#17212B",
      "border": "#D7E2EA",
      "card": "#FFFFFF",
      "cardForeground": "#17212B",
      "popover": "#FFFFFF",
      "popoverForeground": "#17212B",
      "primary": "#8F6D1E",
      "primaryForeground": "#F4F8FB",
      "secondary": "#EAF2F7",
      "secondaryForeground": "#17212B",
      "muted": "#E6EFF5",
      "mutedForeground": "#5D6C78",
      "accent": "#C9A84C",
      "accentForeground": "#17212B",
      "destructive": "#C0392B",
      "destructiveForeground": "#F4F8FB",
      "input": "#D7E2EA",
      "ring": "#8F6D1E",
      "chart1": "#8F6D1E",
      "chart2": "#687C8C",
      "chart3": "#B18A2B",
      "chart4": "#425463",
      "chart5": "#C3A24D",
      "sidebar": "#EAF2F7",
      "sidebarForeground": "#17212B",
      "sidebarBorder": "#D7E2EA",
      "sidebarPrimary": "#8F6D1E",
      "sidebarPrimaryForeground": "#F4F8FB",
      "sidebarAccent": "#DDEAF2",
      "sidebarAccentForeground": "#17212B",
      "sidebarRing": "#8F6D1E"
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
