# MNT Embark Design System

This package defines the visual language for MNT Embark — an ultra-luxury tour company for elite travelers. Use it whenever you build or restyle UI so every surface looks like the same product. It is a real workspace package (`@workspace/mnt-embark`): other artifacts depend on it and import its theme and components directly.

## Brand identity

**MNT Embark** is an ultra-luxury all-inclusive tour brand. The aesthetic is defined by:

- **Cool white-blue surfaces** — `background: #F4F8FB` in light mode. The site uses this light treatment by default, with dark mode available only where deliberately needed.
- **Deep warm gold accent** — `primary: #8F6D1E` on light surfaces. This is the signature brand color. Use it for buttons, focus rings, active states, and key accents. Never replace it with a generic blue or gray.
- **Deep blue-black text** — `foreground: #17212B` on light surfaces. Keep text placed directly on photographs light for legibility.
- **Cormorant Garamond** — the display/headline typeface (`font-serif`). High contrast, elegant, authoritative. Use for hero titles, tour names, section headings, and editorial moments.
- **Montserrat** — the body/UI typeface (`font-sans`). Geometric, refined, legible. Use for body copy, labels, navigation, and all functional text.
- **Architectural radius** — `0.25rem` base (4 px). Crisp, not rounded. Matches the brand's precise, unhurried character.

## What's here

- `tokens.json` — the single source of truth (DTCG format): colors (full light and dark), typography, spacing, radius.
- `scripts/build-tokens.mjs` — generates outputs from `tokens.json`. Run with `pnpm tokens`.
- `src/index.css` — GENERATED shadcn theme, exported as `./styles.css`.
- `src/generated/tokens.tsx` — GENERATED hex token object, the package's `.` and `./tokens` entry.
- `public/favicon.svg` — GENERATED app icon from tokens.
- `src/components/ui/` — the shadcn component library, themed by MNT Embark tokens, exported as `./components/*`.
- `src/lib/` (`cn`) and `src/hooks/` — exported as `./lib/*` and `./hooks/*`.
- `src/App.tsx` — entry point for the living style guide.
- `src/preview/registry.tsx` — preview metadata and ordered navigation.
- `src/preview/foundations.tsx` — Overview, Colors, Fonts, and Layout pages.
- `src/preview/demos/<component>.tsx` — component stories.
- `docs/consuming-web.md` — web consumer setup.
- `docs/migrating-web.md` — replacing scaffolded local design-system implementations.

## What this package exports

```jsonc
".":              "./src/generated/tokens.tsx",
"./tokens":       "./src/generated/tokens.tsx",
"./styles.css":   "./src/index.css",
"./components/*": "./src/components/*.tsx",
"./lib/*":        "./src/lib/*.tsx",
"./hooks/*":      "./src/hooks/*.tsx"
```

## Consuming this package (web / React-Vite)

1. Add to `package.json` dependencies: `"@workspace/mnt-embark": "workspace:*"`
2. Run `pnpm install`
3. In your app's main CSS (e.g. `src/index.css`):
   ```css
   @import "@workspace/mnt-embark/styles.css";
   ```
   Do NOT add a separate `@import "tailwindcss"` — it's already included.
4. In `index.html`, leave `<html>` without the `dark` class for light-first rendering:
   ```html
   <html lang="en">
   ```
5. Import components:
   ```tsx
   import { Button } from "@workspace/mnt-embark/components/ui/button";
   import { Card, CardHeader, CardTitle } from "@workspace/mnt-embark/components/ui/card";
   import { cn } from "@workspace/mnt-embark/lib/utils";
   ```

Read `docs/consuming-web.md` for the full setup. Read `docs/migrating-web.md` if replacing an existing scaffolded theme.

## Light-mode setup

The site is **light-first**. Do not apply the `dark` class to the `<html>` element globally:

```html
<html lang="en">
```

Do not toggle it dynamically unless building an explicit theme switcher. Use `text-foreground` for content on light surfaces and preserve light text where it overlays photography.

## Key token CSS variables

Use these in Tailwind utility classes or inline CSS. Never hardcode hex values in a consuming app.

| Purpose | CSS variable | Tailwind class |
|---|---|---|
| Page background | `--background` | `bg-background` |
| Default text | `--foreground` | `text-foreground` |
| **Signature gold** | `--primary` | `bg-primary`, `text-primary`, `border-primary` |
| Text on gold | `--primary-foreground` | `text-primary-foreground` |
| Card surface | `--card` | `bg-card` |
| Card text | `--card-foreground` | `text-card-foreground` |
| Muted text | `--muted-foreground` | `text-muted-foreground` |
| Border | `--border` | `border-border` |
| Gold focus ring | `--ring` | `ring-ring` |
| Gold accent | `--accent` | `bg-accent`, `text-accent` |

## Typography conventions

Use the `font-serif` class for all display/headline text. Use `font-sans` for body and UI copy.

```tsx
// Hero / tour name
<h1 className="font-serif text-5xl font-light tracking-wide">Patagonia Expedition</h1>

// Section label
<p className="font-sans text-xs font-medium uppercase tracking-widest text-muted-foreground">
  Exclusive Tours
</p>

// Body copy
<p className="font-sans text-base leading-relaxed">...</p>
```

Never mix the two typefaces on the same text node. Display headings and tour names are always serif. Navigation, labels, form fields, and body copy are always sans.

## Component conventions

- **Primary Button** — gold fill (`bg-primary text-primary-foreground`). The dominant CTA: "Reserve now", "Book".
- **Outline Button** — ghost with gold border. Secondary actions: "Learn more", "Enquire".
- **Card** — `bg-card` surface with `border` (subtle). Tour cards, destination cards, journal cards.
- **Badge** — use for tour tags: "Exclusive", "All-inclusive", "Safari", etc.
- **Input** — cool white-blue field (`bg-input`) with gold focus ring (`ring-primary`). All form fields.
- **Separator** — horizontal divider; can be gold-tinted with `bg-primary/30` for editorial moments.
- **Carousel** — used for hero images, journal entries, destinations, and tours. Always add descriptive caption text beneath slides.

## Do not

- Do not invent new colors. Use token CSS variables only.
- Do not use `font-sans` for tour names or headline text — use `font-serif`.
- Do not force dark mode globally — the app is light-first.
- Do not copy token values, component source, or these docs into a consuming artifact. Import from `@workspace/mnt-embark`.
- Do not use emojis anywhere in the UI.

## Editing the design system

Edit `tokens.json` only, then run `pnpm tokens`. The dev server also regenerates on change. Never hand-edit `src/index.css` or `src/generated/tokens.tsx`.

Every source file in this package is `.tsx` (no `.ts`).
