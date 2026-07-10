# Craftory UI Style Guide

Design philosophy: **Artisan Warmth** — ấm áp, thủ công, gần gũi. Inspired by handcraft aesthetics.

## Color Tokens

```css
/* Primary */
--orange:      #E85D04;   /* Primary CTA, links */
--orange-lt:   #FB8500;   /* Hover */
--orange-pale: #FFF3E8;   /* Background tint */
--terracotta:  #C4622D;   /* Secondary accent */

/* Accent */
--green:       #588157;   /* Success, nature */
--sage:        #A3B18A;   /* Soft accent */
--yellow:      #FFB703;   /* Highlights */
--blue:        #3A86FF;   /* Info */

/* Neutral */
--ink:         #1A1209;   /* Primary text */
--ink-2:       #3D2B1F;   /* Secondary text */
--ink-3:       #7A5C4A;   /* Muted text */
--ink-4:       #A68972;   /* Placeholder */
--ink-5:       #C8B4A3;   /* Very muted */
--cream:       #FFFCF7;   /* Page background */
--cream-2:     #FFF8F0;   /* Section background */
--parchment:   #F5EDE1;   /* Borders, dividers */
--surface:     #FFFFFF;   /* Card background */

/* Semantic */
--error:   var(--rose);   /* #E63946 */
--amber:   #F59E0B;
--cobalt:  #3A86FF;
```

## Typography

```css
--font-display: 'Playfair Display', Georgia, serif;  /* h1, h2 */
--font-h:       'Baloo 2', 'Nunito', sans-serif;     /* h3-h5, labels */
--font-body:    'Nunito', sans-serif;                /* body text */
--font-hand:    'Caveat', cursive;                   /* decorative */
```

Type scale:
- `h1`: clamp(1.85rem, 4.8vw, 3rem)
- `h2`: clamp(1.38rem, 3.2vw, 2rem)
- `h3`: clamp(1.06rem, 2vw, 1.36rem)
- Body: 15.5px / 1.72 line-height

## Spacing Scale

Base unit: 8px
- `--gap-sm`: 8px
- `--gap-md`: 16px
- `--gap-lg`: 24px
- `--gap-xl`: 32px
- Section padding: `clamp(52px, 7vw, 100px)`

## Border Radius

```css
--r-sm:  6px
--r-md:  10px
--r-lg:  16px
--r-xl:  24px
--r-2xl: 36px
--r-full: 999px
```

## Shadows

```css
--sh-sm: 0 1px 3px rgba(90,50,20,.1), 0 1px 2px rgba(90,50,20,.06)
--sh-md: 0 4px 12px rgba(90,50,20,.12), 0 2px 6px rgba(90,50,20,.07)
--sh-lg: 0 10px 28px rgba(90,50,20,.14), 0 4px 12px rgba(90,50,20,.09)
--sh-xl: 0 20px 48px rgba(90,50,20,.18), 0 8px 20px rgba(90,50,20,.11)
```

## Buttons

```html
<button class="btn btn-primary">Primary</button>
<button class="btn btn-outline">Outline</button>
<button class="btn btn-ghost">Ghost</button>
<button class="btn btn-sm">Small</button>
<button class="btn btn-lg">Large</button>
<button class="btn btn-block">Full width</button>
```

## Form Components

```html
<div class="form-group">
  <label class="form-label">Label <span class="required">*</span></label>
  <input class="form-input" type="text">
  <div class="form-hint">Helpful hint text</div>
  <div class="form-error">Error message</div>
</div>
```

## Cards

```html
<div class="product-card">
  <div class="product-card-img">...</div>
  <div class="product-card-body">
    <div class="product-age">Collection · Age</div>
    <div class="product-name">Name</div>
    <div class="product-desc">Description</div>
    <div class="product-footer">...</div>
  </div>
</div>
```

## Badges

```html
<span class="product-badge hot">🔥 Bán chạy</span>
<span class="product-badge new">✨ Mới</span>
<span class="product-badge sale">🏷 Giảm giá</span>
```

## Modals

```html
<div class="modal-overlay" id="myModal">
  <div class="modal">
    <button class="modal-close" onclick="...">✕</button>
    <h2 class="modal-title">Title</h2>
    <p class="modal-subtitle">Subtitle</p>
    <!-- content -->
  </div>
</div>
```
Open/close: add/remove `.open` class on `.modal-overlay`.

## Toasts

```js
Toast.show('Message text', 'success'); // or 'error', ''
```

## Grid Utilities

```css
.grid-4 { grid-template-columns: repeat(4, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
```

## Accessibility Notes

- All interactive elements have focus rings (`:focus-visible`)
- Buttons have `aria-label` for icon-only buttons
- Images have `alt` text
- Color contrast meets WCAG AA (4.5:1 for body text)
- Mobile-first responsive design with hamburger menu
