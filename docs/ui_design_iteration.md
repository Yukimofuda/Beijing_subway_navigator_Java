# UI Design Iteration

## Direction

This release keeps the native HTML/CSS/JavaScript architecture and all existing route, fare, timetable, station-picker, and SVG-map behavior. The redesign separates the translucent navigation/control layer from solid content surfaces, reduces repeated borders, and gives the primary action one consistent blue accent.

References used during the design pass:

- [Apple Human Interface Guidelines: Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)
- [Apple Human Interface Guidelines: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Apple Human Interface Guidelines: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Apple Human Interface Guidelines: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [MTR Trip Planner](https://www.mtr.com.hk/mtrmobile/en/transport/trip-planner/)

## Implemented System

- Navigation: compact frosted control layer, active-page state, 44 px mobile targets.
- Typography: system-font stack, fewer weights, tighter display-heading tracking, readable body contrast.
- Surfaces: 28 px page shells, 18–22 px content groups, subtle hairlines instead of repeated framed boxes.
- Controls: 48 px fields, 44 px buttons, one primary blue action, quieter secondary actions, visible focus rings.
- Homepage: task-first planner, generated network artwork, live local-data panel, asymmetric tool grid.
- Query: unified origin/destination composer, restrained preference control, preserved colored route strip.
- Map: consolidated inspector, square SVG aspect ratio, larger pan canvas, direct touch panning.
- Fare and station pages: explicit information hierarchy, balanced empty states, consolidated missing-data messages.

## Independent Review

First review: **7.1/10**. The reviewer found strong visual hierarchy and color, but flagged route-label credibility, mobile map scaling, oversized empty states, repeated missing-data cards, and small mobile targets.

After the second implementation pass: **8.5/10**.

| Dimension | Score |
| --- | ---: |
| Visual hierarchy | 9.0 |
| Typography | 8.6 |
| Color | 8.8 |
| Component consistency | 8.5 |
| Interaction discoverability | 8.4 |
| Accessibility | 8.2 |
| Responsiveness | 8.3 |
| Product authenticity | 8.1 |

The reviewer classified the result as ready for public demonstration. Remaining production risks are data-related: the current SVG exposes 312 interactive station labels while the searchable station registry contains 404 stations, and local timetable freshness depends on the checked-in data files.
