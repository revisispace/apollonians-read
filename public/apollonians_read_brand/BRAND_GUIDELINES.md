# Apollonians Read — Brand Guidelines

## 1. Brand idea

**Solar Listening Library**

Apollonians Read turns personal books into a calm, private listening experience.  
The identity combines:

- the **Apollo sun** for clarity, culture, and discovery;
- an **orbital listening arc** for audio and headphones;
- **open pages** for books and reading;
- a **single flowing wave** for voice and narration.

## 2. Brand positioning

**Category:** personal audiobook studio  
**Promise:** turn books you own or are permitted to process into a comfortable listening experience.  
**Core traits:** literary, warm, private, calm, intelligent, transparent.

### Recommended tagline

**Buku apa pun, kini bisa kamu dengarkan.**

### Supporting line

**Studio audiobook pribadi yang bekerja dekat dengan bukumu—tenang, mudah, dan privat.**

## 3. Logo collection

- `logo-primary-horizontal.svg` — default website and presentation logo.
- `logo-primary-reversed.svg` — dark-background version.
- `logo-stacked.svg` — square and centered layouts.
- `logo-wordmark.svg` — when the product context is already obvious.
- `logo-mark.svg` — compact brand mark.
- `app-icon.svg` — PWA, desktop shortcut, store listing.
- `social-avatar.svg` — social profile image.
- `favicon.svg` — browser favicon.
- `logo-primary-monochrome.svg` — one-color printing and restricted environments.

## 4. Logo rules

### Clear space

Use the diameter of the gold sun as the minimum clear space around every side of the complete logo.

### Minimum size

- Horizontal digital logo: **160 px wide**
- Stacked digital logo: **96 px wide**
- Standalone mark: **24 px**
- Favicon: use the simplified supplied file; do not place the wordmark in a favicon.

### Do not

- stretch, skew, rotate, or add effects;
- recolor individual elements outside the approved palette;
- place the full-color mark on a visually noisy image;
- replace the mark with a generic headphone icon;
- typeset “Apollonians Read” using an unrelated bold geometric font;
- use gold or coral for long body text on a light background.

## 5. Color system

| Role | Name | Hex | Use |
|---|---|---:|---|
| Primary dark | Forest Night | `#1F2824` | Sidebar, app icon, hero backgrounds |
| Primary action | Reader Green | `#2F6257` | Buttons, links, progress, focus |
| Deep action | Forest Dark | `#244B43` | Hover and pressed states |
| Main canvas | Paper | `#F5F0E6` | App background |
| Secondary canvas | Paper Deep | `#ECE5D8` | Section differentiation |
| Cards | Surface | `#FFFDF8` | Cards and elevated surfaces |
| Primary text | Ink | `#1C211D` | Headlines and body |
| Secondary text | Muted | `#70736D` | Metadata and descriptions |
| Brand light | Apollo Gold | `#E8B95B` | Sun, highlights on dark backgrounds |
| Emotional accent | Narrative Coral | `#D9754F` | Active narration, alerts, human warmth |
| Borders | Line | `#DED8CC` | Dividers and card outlines |

### Color proportion

- 55% Paper / Surface
- 25% Forest Night / Reader Green
- 12% Ink / Muted
- 5% Apollo Gold
- 3% Narrative Coral

Gold and coral are accents, not large text colors on light backgrounds.

## 6. Typography

### Editorial display and wordmark

`Iowan Old Style`, `Baskerville`, `Georgia`, serif

Use for:
- logo wordmark;
- page titles;
- audiobook titles;
- quotations and editorial statements.

### Interface

`Avenir Next`, `Segoe UI`, `Helvetica`, `Arial`, sans-serif

Use for:
- navigation;
- buttons;
- metadata;
- settings;
- forms and operational information.

### Hierarchy

- Display: 48–56 px, regular serif, tight leading
- H1: 36–44 px, regular serif
- H2: 26–32 px, regular serif
- Body: 14–16 px, sans-serif
- Label: 10–12 px, uppercase, 0.12–0.18em tracking

Avoid using serif for dense settings pages or long technical instructions.

## 7. Visual language

### Shape

- Soft but disciplined radii: 8–16 px.
- Thin, warm-gray borders.
- Circular controls for listening actions.
- Book-cover shapes may use a slightly asymmetric spine radius.

### Illustration

Use:
- warm editorial still life;
- books, headphones, sunlight, paper texture;
- flowing contour lines and sound waves;
- restrained depth and realistic materials.

Avoid:
- neon AI gradients;
- robot imagery;
- generic stock photos of people wearing headphones;
- excessive glassmorphism;
- loud music-streaming aesthetics.

### Iconography

Use outline icons with consistent stroke weight, preferably 1.8–2 px at 20–24 px.  
The brand mark must not be substituted with a library icon from an icon set.

## 8. Voice and writing

### Voice

- calm, clear, encouraging;
- intelligent without sounding academic;
- transparent about local processing and limitations;
- human and literary, not promotional or overexcited.

### Good examples

- “Lanjutkan cerita yang sempat tertunda.”
- “Buku tetap tersimpan di perangkatmu.”
- “Pilih bab yang ingin kamu dengarkan.”
- “Audio siap. Kamu bisa mulai dari bagian terakhir.”

### Avoid

- “Revolusi AI paling canggih!”
- “Konversi tanpa batas dan tanpa risiko.”
- “Kami membaca semua filemu.”
- overly technical terms before the user needs them.

## 9. Product-brand application

- Replace the current generic sidebar headphone icon with `logo-mark.svg`.
- Replace the unrelated blue favicon with `favicon.svg`.
- Keep the current warm paper, forest, coral, and gold UI direction.
- Use the primary horizontal logo only in onboarding, account, marketing, and empty states.
- Use the standalone mark in the sidebar, mobile header, loading state, and player.
- Use coral only for current/active narration, recording, warnings, or a small emotional highlight.
- Use gold for premium editorial highlights, not for system errors.

## 10. Accessibility and consistency

- Use Ink, Forest Night, Reader Green, or Forest Dark for text on Paper/Surface.
- Use Paper or Surface text on Forest Night.
- Do not use Apollo Gold or Narrative Coral as small paragraph text on light backgrounds.
- Preserve visible keyboard focus states.
- Centralize all brand values through `brand-tokens.css` or the product design-token file.

## 11. File naming

Use lowercase kebab case:

- `apollonians-read-logo-horizontal.svg`
- `apollonians-read-mark.svg`
- `apollonians-read-app-icon.svg`
- `apollonians-read-favicon.svg`

Version approved master assets rather than manually editing copies.
