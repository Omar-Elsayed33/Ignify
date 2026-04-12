```markdown
# Design System Specification: The Radiant Editorial

## 1. Overview & Creative North Star
**The Creative North Star: "Kinetic Clarity"**

This design system moves beyond the static "template" look of modern SaaS. It is an editorial-first framework that treats digital interfaces like high-end gallery spaces. By pairing the mathematical precision of geometric typography with the visceral warmth of an "ember-to-violet" gradient, we create an experience that feels both high-tech and human.

The system breaks the grid through **Intentional Asymmetry**. We utilize generous white space (the "breath") and overlapping elements (the "kinetic") to guide the eye. This is not a flat interface; it is a layered environment where depth is defined by tonal shifts rather than structural lines.

---

## 2. Colors & Surface Logic

The palette is rooted in a "Warm Neutral" base, allowing the vibrant Ignify spark to draw the eye to high-value actions.

### The Palette (Material Design Tokens)
*   **Primary (Ember):** `#ab3500` (On-Primary: `#ffffff`)
*   **Secondary (Coral):** `#b80046` (On-Secondary: `#ffffff`)
*   **Tertiary (Violet):** `#8234c6` (On-Tertiary: `#ffffff`)
*   **Base Surface:** `#fcf8ff` (A soft, lavender-tinted white to prevent screen fatigue)
*   **On-Surface (Wordmark):** `#1b1b24` (A deep, near-black charcoal)

### The "No-Line" Rule
**Prohibition:** 1px solid borders are forbidden for sectioning. 
**Execution:** Boundaries must be defined through background color shifts. To separate a sidebar from a main feed, transition from `surface` to `surface-container-low`. The eye perceives the change in luminosity as a boundary, creating a more sophisticated, "unbound" aesthetic.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked sheets of fine paper.
1.  **Level 0 (Canvas):** `surface` (`#fcf8ff`) - The global background.
2.  **Level 1 (Sections):** `surface-container-low` (`#f5f2ff`) - Used for large layout blocks.
3.  **Level 2 (Cards/Modules):** `surface-container-lowest` (`#ffffff`) - Pure white cards that "pop" against the off-white base.

### Signature Textures: The Ember Glow
CTAs and Hero elements should never be flat. Use a linear gradient (`#FF6B35` → `#FF3D71` → `#7B2CBF`) at a 135-degree angle. For a "Glassmorphism" effect, use `surface_variant` at 60% opacity with a `24px` backdrop-blur.

---

## 3. Typography: The Geometric Voice

We use a "High-Contrast Pairing" to balance authority with readability.

*   **Display & Headlines (Space Grotesk):** This is our "Brand Voice." Its geometric, wide apertures feel modern and architectural. Use `display-lg` (3.5rem) with tight letter-spacing (-0.02em) for hero moments to create an editorial impact.
*   **Body & Utility (Manrope):** This is our "Functional Voice." Manrope provides superior legibility at small scales. Use `body-md` (0.875rem) for all long-form content to maintain a high-clarity, professional feel.

**Hierarchy Strategy:** 
Titles should be bold and assertive (`headline-lg`), while labels (`label-md`) should use `spaceGrotesk` in all-caps with +0.05em tracking to differentiate functional UI from narrative content.

---

## 4. Elevation & Depth

We reject the "heavy shadow" era. Depth is achieved through **Tonal Layering**.

*   **The Layering Principle:** To create a "lifted" card, place a `surface-container-lowest` (#ffffff) element on a `surface-container` (#efecfa) background. The contrast in "purity" creates a natural elevation.
*   **Ambient Shadows:** When a floating element (like a Popover) is required, use a shadow with a 40px blur, 0px offset, and 4% opacity, using the `on-surface` color. This mimics a soft, natural light source.
*   **The "Ghost Border":** For input fields or containers requiring extra definition, use the `outline-variant` (`#e1bfb5`) at **15% opacity**. It should be felt, not seen.
*   **Glassmorphism:** Use `surface-container-lowest` at 70% opacity with a `12px` blur for floating navigation bars to let the "Ember" accents bleed through from behind.

---

## 5. Components

### Buttons (The "Spark" Elements)
*   **Primary:** Gradient fill (Ember to Coral). `xl` roundness (1.5rem). No border.
*   **Secondary:** `surface-container-highest` fill with `on-surface` text.
*   **Tertiary:** Transparent background, `primary` text, `sm` roundness for a subtle hover state.

### Cards & Lists
*   **The Rule of Space:** Forbid the use of divider lines between list items. Use `16px` of vertical white space to separate items. 
*   **Interactivity:** On hover, a card should shift from `surface-container-lowest` to `surface-bright`, with a subtle 2px upward translation.

### Input Fields
*   **Styling:** Large `md` (0.75rem) corners. Fill with `surface-container-low`.
*   **Focus State:** Transition the "Ghost Border" to 100% opacity `primary` and add a 2px outer glow using the `primary` color at 10% opacity.

### Featured "Insight" Chips
*   **The Signature Chip:** Use a `tertiary-fixed` (`#f1dbff`) background with `on-tertiary-fixed-variant` text. This provides a "violet pop" that breaks the orange/coral dominance.

---

## 6. Do’s and Don’ts

### Do:
*   **Use Asymmetric Padding:** Allow more white space at the top of a section than at the bottom to create an editorial, "pushed" look.
*   **Leverage Tone:** Use `on-surface-variant` for secondary text to maintain a soft, high-end contrast ratio.
*   **Layer Surfaces:** Always put "cleaner/whiter" surfaces on top of "grayer/darker" surfaces to denote importance.

### Don’t:
*   **Don't use pure black:** Never use `#000000`. It breaks the soft, premium feel of the `fcf8ff` base. Use `on-surface` (#1b1b24).
*   **Don't use hard borders:** Avoid 100% opaque outlines. They make the UI look like a legacy "enterprise" application.
*   **Don't crowd the Spark:** Give gradient elements (CTAs/Logos) at least 32px of "clear space" to ensure they remain the focal point.

---
*End of Document*```