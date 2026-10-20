# Student Vault — Design System

> **Initial proposal for the later mockup.** These values are starting points and are adjustable after we review the mockup. This brief defines visual language and reusable rules, not final screen layouts.

## Identity
“Your university life, organized in one place.” Create a calm, premium, approachable academic product: forest green, warm cream, restrained warm accents, dark readable text, and quiet borders. Use purposeful structure and small details that help students feel oriented and confident about their records.

## Color tokens (initial HEX values)

| Token | HEX | Use |
| --- | --- | --- |
| --color-forest-950 | #173B32 | Deep brand surfaces and high-emphasis text |
| --color-forest-800 | #245344 | Primary brand and interactive elements |
| --color-forest-700 | #2F6A55 | Hover/active brand states |
| --color-forest-100 | #E5EFE9 | Soft selected and supporting surfaces |
| --color-cream-50 | #FBF9F3 | Main warm canvas |
| --color-cream-100 | #F3F0E7 | Secondary warm surfaces |
| --color-paper | #FFFFFF | Raised cards and input surfaces |
| --color-ink | #202923 | Primary text |
| --color-ink-muted | #59645D | Secondary text |
| --color-border | #DADFD7 | Subtle dividers and outlines |
| --color-gold | #A87424 | Restrained highlight; pair with light surfaces |
| --color-coral | #B85445 | Destructive/error accent; use sparingly |
| --color-success | #286347 | Success feedback |
| --color-warning | #805915 | Warning feedback |
| --color-danger | #A23E35 | Error and destructive actions |

Check foreground/background combinations for WCAG AA contrast when used in the mockup and implementation. Do not use color alone to communicate status. Adjust token values if needed to meet contrast while retaining the visual direction.

## Typography
Use a readable system sans-serif stack for interface text: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif. Use the same family throughout initially; distinguish hierarchy with size, weight, and spacing rather than decorative type.

| Role | Size / line height | Weight |
| --- | --- | --- |
| Display / page lead | 36 / 44 px | 650–700 |
| Page title | 30 / 38 px | 650–700 |
| Section title | 22 / 30 px | 600–650 |
| Card/subsection title | 17 / 24 px | 600 |
| Body | 16 / 24 px | 400 |
| Supporting/body small | 14 / 20 px | 400–500 |
| Label / button | 14 / 20 px | 550–650 |
| Metadata / caption | 12 / 16 px | 450–500 |

Keep long-form text comfortable to scan and reserve uppercase styling for brief labels, if used at all.

## Layout and spacing
Use a 4 px base spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 px (tokens --space-1 through --space-11). Default page gutters: 24 px desktop, 16 px mobile. Keep reading and form content at a comfortable measure; use a maximum content width of 1200 px and a text measure of about 68 characters. Align related content to a consistent grid and preserve generous separation between sections.

## Shape and elevation
- Radii: small 6px, controls 9px, cards 12px, large panels 16px, pill 999px.
- Borders: 1 px solid --color-border; use a stronger token or brand edge only for interactive/selected states.
- Shadows: subtle and infrequent. Base 0 1px 2px rgb(23 59 50 / 6%); raised 0 8px 24px rgb(23 59 50 / 10%). Avoid stacking shadows or using elevation as the only grouping cue.

## Component conventions
- **Buttons:** 44 px minimum height, 12–16 px horizontal padding, 9 px radius, clear text labels. Primary uses forest-800 with a high-contrast foreground; secondary uses paper/cream with a visible border; quiet actions remain visibly interactive. Destructive actions use danger color and clear wording. Include hover, pressed, disabled, and keyboard-focus states.
- **Inputs:** 44 px minimum height, paper background, 1 px border, 9 px radius, readable labels outside the control, and helper/error text associated with the field. Show focus without shifting layout. Never use placeholder text as the only label.
- **Cards:** paper or cream surface, subtle border, 12 px radius, consistent internal padding (20–24 px). Use clear headings and avoid card grids that add decoration without helping grouping or action.
- **Navigation:** provide clear active, hover, and focus states; use labels alongside icons where meaning may be unclear. Keep hierarchy and orientation consistent across breakpoints.
- **Reusable components:** share tokens and common primitives for controls, status messages, and layout. Components should have one clear purpose and consistent state behavior. Avoid one-off styles when a token or shared component fits.
- **CSS:** use standard CSS, custom properties for tokens, predictable class naming, and feature/component stylesheets. Avoid global element styling that causes leaks; keep responsive rules near the component they adapt.

## Responsive behavior
Initial breakpoints: small 0–599 px, medium 600–899 px, large 900–1199 px, wide 1200 px+. Treat these as starting values, adjustable after mockup review. Design from the narrow layout upward; prevent horizontal overflow, preserve readable spacing and touch targets, and adapt navigation and multi-column content based on available space rather than device names alone.

## Interaction and states
- **Focus:** keyboard focus must be obvious, using a 2 px forest outline with a 2 px offset (or an equally visible design-appropriate treatment). Never remove browser focus without replacement.
- **Loading:** use stable skeletons or a concise progress indicator; retain context and prevent confusing layout jumps. Announce meaningful loading changes to assistive technology.
- **Empty:** explain what is empty, why it matters, and the next useful action. Keep the tone calm and offer an appropriate starting action without inventing sample user data.
- **Error:** state what happened in plain language and what the user can do next. Associate field errors with controls; keep alerts perceivable without relying on color alone.
- **Success/selected/disabled:** use consistent visual and textual cues. Disabled controls must remain legible and explain unavailable actions where useful.

## Visual quality bar
Use intentional hierarchy, polished spacing, clear alignment, and a few meaningful visual details tied to documents and academic organization. Give dense information room to breathe. Keep repeated patterns consistent and make important actions easy to find. Avoid generic-looking dashboard templates, gratuitous gradients, decorative charts without a user need, oversized empty hero treatments, and icon-only controls with unclear meaning. Validate the system against a later mockup before treating these initial values as final.
