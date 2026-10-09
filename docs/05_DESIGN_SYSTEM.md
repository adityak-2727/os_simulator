# Interface design system

## Design direction

Design a technical lab workbench used during a real OS class. Prioritize the student's workload, the current algorithm decision, and the resulting state. The interface should feel assembled around these tasks: an editable table, a scaled timeline, a compact inspector, and readable calculations.

The supplied `design/CPU_Workbench_Reference.png` is a visual reference for the finished CPU lab. Its data comes from the Round Robin reference case. It is a static specification image, not evidence that the application exists. Match the layout discipline and information hierarchy; implement the actual controls and responsive behavior.

## Layout

- Desktop target: 1440 by 900 CSS pixels. A 196 to 208 px navigation rail sits beside the workbench. Top bar height is about 56 px.
- Main work area: a 280 px input column, a flexible visualization column of at least 420 px, and a 280 px event inspector when the viewport permits. Use 16 to 24 px gaps and a 24 px page inset.
- At 1024 px, move the inspector below the visualization or into a clearly labeled drawer. Keep the central visual usable.
- At 768 px and below, collapse navigation and stack inputs, playback, visualization, results, and explanation. Tables and timelines may scroll inside labeled containers. The page itself must not develop accidental horizontal scrolling.
- At 390 px, editing, stepping, reading the event explanation, and exporting a scenario still work. Maintain touch targets near 44 px where possible.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#F5F6F8` | Workspace background |
| Surface | `#FFFFFF` | Work areas and tables |
| Subtle surface | `#EDF1F5` | Selected table headers and secondary areas |
| Main text | `#17212F` | Titles, input values, body text |
| Secondary text | `#526071` | Descriptions, units, secondary labels |
| Divider | `#CDD3DA` | Meaningful boundaries and table rules |
| Action | `#245EA8` | Primary action and selected navigation |
| Action background | `#EAF1FA` | Selection fill |
| Success text | `#246043` | Completed or safe status |
| Success background | `#EDF6F0` | Quiet status background |
| Warning text | `#82510B` | Waiting or unsafe status |
| Warning background | `#FFF5DE` | Quiet warning background |
| Error text | `#A32B32` | Invalid input or deadlock |
| Error background | `#FCECEF` | Error context |
| Focus | `#245EA8` | High-contrast 2 px visible focus ring |

Verify contrast in the rendered combinations, especially small text and interactive borders. A divider token is not automatically an adequate control boundary.

Process colors: P1 blue `#275DAD`, P2 ochre `#8A5B12`, P3 green `#2E7656`, P4 violet `#784B93`, P5 brick `#A3463F`, P6 teal `#226F7C`. Assign by stable process order. After the palette repeats, retain explicit IDs and add a pattern or distinct border treatment. Process color does not mean state; state has a text label.

## Typography and spacing

Use a local system sans-serif stack headed by system-ui. Use ui-monospace for time values, addresses, vectors, page numbers, and process IDs. Enable tabular numerals. Body and form text is 14 to 15 px, dense table content 13 to 14 px, page titles 24 px, section labels 14 to 16 px, and secondary annotations no smaller than 12 px.

Spacing scale: 4, 8, 12, 16, 24, 32 px. Use 6 px radii for ordinary controls and panels and 8 px for dialogs. Favor dividers and grouped whitespace over a card for every statistic. Limit shadows to overlays or a subtle elevation needed to distinguish floating controls.

## Components

| Component | Required character and behavior |
| --- | --- |
| Process editor | Spreadsheet-like rows; stable IDs; right-aligned numbers; inline validation |
| Playback toolbar | Run/Pause, Previous, Next, Reset, speed, current event and time; disabled states explained |
| Metric strip | Compact labeled numbers with units; no giant promotional KPI cards |
| Gantt timeline | Uniform time scale, proportional segments, visible idle intervals, process IDs, focused interval detail |
| Queue view | Ordered entries with head/tail labels; empty queue has a plain meaningful label |
| Inspector | Selected event, decision explanation, before/after data, and rule used |
| Result table | Tabular values, accessible headers, units, export action, stable process ordering |
| Matrix editor | Row/column labels remain visible; related cell errors grouped clearly |
| Graph | Explicit request/allocation arrow legend; matching table editor; focusable selections |
| Dialog | Focus management, escape/cancel, contextual title and action label |

## Motion and visual integrity

Use short 120 to 180 ms state transitions for selection and panel changes. Playback advances the event cursor at a chosen rate; it must not stretch mathematical time intervals inaccurately. Honor prefers-reduced-motion and make manual stepping fully usable. Avoid continuously pulsing indicators and decorative graph motion.

The opening screen goes directly to the lab. Do not add a marketing hero, testimonials, invented adoption numbers, decorative 3D assets, emoji navigation, a terminal imitation, or an AI assistant bubble. Do not show random statistics to fill empty space. Typography, alignment, thoughtful data density, and complete interactions create the desired realistic appearance.

## Copy examples

Use: "Arrival time", "Time quantum", "Ready queue", "No process is ready at t = 3", "P3 has the shortest burst among the ready processes", "Request deferred: the tentative state has no safe sequence".

Avoid vague labels such as Smart insights, Optimize everything, Magic simulation, and Boost performance. Every explanation must reference the actual input and event. Preset scenarios are labeled Example; generated random workloads, if added later, must be seeded and labeled.

## Design acceptance

At desktop width, the core workload and timeline should be visible without scrolling past ornamental content. Focus order follows reading order. Numeric columns align. Charts have labels and units. Every enabled action works. Empty, invalid, running, paused, and completed states are intentional. A design review must inspect these states, not just the attractive preset screenshot.
