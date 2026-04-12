```markdown
# Design System Strategy: The Radiant Editorial

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Radiant Editorial."** This is not a standard SaaS interface; it is a high-performance workspace treated with the prestige of a luxury digital publication. 

By marrying the technical, geometric precision of **Space Grotesk** with a light-flooded, layered environment, we move away from "software-as-a-tool" toward "software-as-an-experience." We break the "template look" through **intentional white space**, **asymmetric content grouping**, and a **"Light-Leaking" aesthetic** where vibrant brand gradients act as the primary light source against a pristine, mist-like canvas.

---

## 2. Colors: Tonal Depth & The Gradient Soul
The color palette focuses on a high-contrast relationship between the "Near-Black" text and "Mist" backgrounds, punctuated by a high-energy spectrum.

### The "No-Line" Rule
To achieve a premium, modern feel, **1px solid borders are prohibited for sectioning.** Boundaries must be defined solely through background color shifts. Use `surface-container-low` sections sitting on a `background` or `surface` base to create a sense of architecture without the visual clutter of "boxes."

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine, semi-translucent paper.
- **Surface (Base):** `#f9f9fe` (The Mist).
- **Surface-Container-Lowest:** `#ffffff` (The pure white "Hero" layer for primary cards).
- **Surface-Container-High:** `#e8e8ed` (For recessed areas like sidebars or utility panels).

### The "Glass & Gradient" Rule
Standard flat buttons are insufficient for this identity. 
- **Signature Textures:** Main CTAs and high-impact accents must utilize the primary gradient (`#FF6B35` → `#FF3D71` → `#7B2CBF`). 
- **Glassmorphism:** For floating elements (menus, tooltips), use `surface` tokens at 80% opacity with a `20px` backdrop-blur. This ensures the vibrant brand gradients "glow" through the interface as the user scrolls.

---

## 3. Typography: Technical Elegance
The type system creates an authoritative hierarchy by pairing a high-character display face with a neutral, highly readable body face.

*   **Headlines (Space Grotesk):** Set in `#0B0B14`. Use the **Display-LG (3.5rem)** for hero moments with tight letter-spacing (-0.02em) to evoke a technical, editorial feel.
*   **Body (Inter):** Set in `#1A1A2E`. Inter provides the "Slate" functional grounding. Use **Body-MD (0.875rem)** for standard UI text to maintain a spacious, airy vibe.
*   **Labels (Inter):** Use **Label-SM (0.6875rem)** in uppercase with +0.05em tracking for metadata or small UI hints.

---

## 4. Elevation & Depth: Tonal Layering
We do not use shadows to "lift" objects; we use them to "soften" the atmosphere.

*   **The Layering Principle:** Depth is achieved by stacking. A `surface-container-lowest` (#ffffff) card placed on a `surface-container-low` (#f3f3f8) background creates a natural, soft lift without a single pixel of shadow.
*   **Ambient Shadows:** When a floating state (like a modal) is required, use a shadow with a **40px blur at 6% opacity**, tinted with the primary violet (`#7B2CBF`). This mimics natural, atmospheric light.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline-variant` (`#e1bfb5`) at **15% opacity**. Never use 100% opaque lines.
*   **Glassmorphism:** Use semi-transparent layers to allow the energetic brand gradients to bleed through from the layers below, making the UI feel like one cohesive, luminous organism.

---

## 5. Components

### Buttons
*   **Primary:** Features the brand gradient (`orange` to `violet`). Text is `on-primary` (#ffffff). Border-radius: `md` (0.75rem).
*   **Secondary:** A "Ghost" style. No fill. A `Ghost Border` (15% opacity outline) with the text utilizing a clipped gradient or the `secondary` (#b80046) tone.
*   **Tertiary:** No background, no border. Just `title-sm` typography with a subtle hover transition to 50% opacity.

### Input Fields
*   **Styling:** Fields should use `surface-container-lowest` (#ffffff) with a 2px bottom-only accent in `outline-variant` rather than a full box.
*   **Focus State:** The bottom accent transforms into the brand gradient, and the label (`label-md`) shifts to the `primary` (#ab3500) color.

### Cards & Lists
*   **Rule:** **Forbid divider lines.** 
*   **Separation:** Use vertical white space (from the `xl` spacing scale) or a subtle shift from `surface` to `surface-container-low`.
*   **Interactive Cards:** On hover, a card should shift from `surface-container-lowest` to a subtle 4% opacity tint of the `primary-container` (#ff6b35) to suggest "energy."

### Radiant Chips
*   Small badges or tags should use a 10% opacity version of the `tertiary` (#8234c6) background with `on-tertiary-container` (#4b0081) text. This creates a "jewel-toned" effect that feels premium.

---

## 6. Do's and Don'ts

### Do
*   **Use Asymmetry:** Place a large `Display-LG` headline on the left with a significant `body-lg` paragraph offset to the right to break the "standard grid" feel.
*   **Embrace White Space:** If you think there is enough padding, double it. The "Mist" needs room to breathe.
*   **Layer Surfaces:** Use at least three tiers of `surface-container` in complex layouts to create architectural interest.

### Don't
*   **Don't Use Pure Black Shadows:** This kills the "Radiant" vibe. Always tint shadows with a hint of the brand violet or slate.
*   **Don't Use Dividers:** Avoid the "table" look. Use background tonal shifts to separate data.
*   **Don't Overuse the Gradient:** The gradient is a "power move." Reserve it for high-action items (Primary Buttons, Icons, Progress Bars). If everything glows, nothing glows.
*   **Don't Use Default Borders:** Never use a `#CCCCCC` or `#DDDDDD` border. It makes the "Premium" vibe vanish instantly.