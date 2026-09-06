# Product UI Review — v5

## Product Goal

The interface is a working Beijing metro travel tool, not a marketing landing page. The first screen therefore starts with origin, destination, travel preference, and the next departures. The original page background images remain in place; the new UI uses controlled translucent surfaces so the supplied artwork stays visible without reducing text contrast.

## Requirement Alignment

| Course requirement | Product surface | Decision in this iteration |
| --- | --- | --- |
| Plan the shortest-time or least-transfer route | `index.html`, `query.html` | Put the origin/destination composer first and retain both route modes and the existing algorithm. |
| Show route, line, distance, time, fare, and transfer details | `query.html`, `fare_calculator.html` | Keep the colored station strip and route metrics; make the summary readable before the detailed path. |
| Browse the subway map | `Map.html` | Use a compact inspector beside the largest possible map canvas; keep SVG search, zoom, pan, hover, and next-train behavior. |
| Browse lines, stations, trains, and timetables | `lines.html`, `stations.html`, `trains.html`, `timetable.html` | Strengthen hierarchy, filters, sticky table headers, overflow handling, and empty states without changing data flow. |
| Inspect station details | `station_guide.html` | Present station selection and detail as a master-detail workspace; retain neighboring stations, facilities, and route shortcuts. |
| View operating information | `service_board.html` | Prioritize the current service state and departure information instead of implementation details. |
| Manage line data through the Node service | Existing management pages and APIs | No backend or route-management behavior is removed or replaced in this visual pass. |

## Product Review

### Problems Found

- The previous homepage split one task across a large planner card, a dark diagnostics panel, and several isolated numbered cards. It read like a component showcase rather than one connected journey.
- Several labels described implementation details such as local files, indexes, and data modes. These do not help a passenger decide what to do next.
- Borders, radii, and elevations varied between pages. Some nested panels looked like unrelated boxes and several long route/table elements could exceed their intended surface.
- The map inspector competed with the SVG instead of supporting it; list pages lacked enough visual distinction between controls, status, and data.
- Generic explanatory paragraphs repeated what nearby controls already communicated, making the interface feel generated rather than authored.

### Implemented Decisions

- Adopt a transit-first silhouette: connected A/B station composer, one primary action, immediate departure context, and four compact utility destinations.
- Use one restrained blue action color, real metro line colors for route meaning, neutral white content surfaces, and dark navy only for high-value live information.
- Replace decorative numbering with custom functional line icons; reduce corner radii and remove repeated nested borders.
- Keep route strips intrinsically sized to their station content and place horizontal scrolling on the strip viewport, preventing colored borders from overshooting the station row.
- Convert technical copy to short passenger language while preserving accurate loading, empty, and failure states.
- Keep all original background-image declarations untouched and visible behind the application surfaces.

## Visual Reference Notes

- [Apple Human Interface Guidelines — Maps](https://developer.apple.com/design/human-interface-guidelines/maps): keep controls secondary to the map and reveal detail in context.
- [MTR Journey Planner](https://www.mtr.com.hk/en/customer/jp/index.php): make origin, destination, and travel options the primary interaction rather than an introductory hero.
- [Transport for London Journey Planner](https://tfl.gov.uk/plan-a-journey/): expose route options, accessible choices, and live service information with concise task-oriented labels.

These references inform hierarchy and interaction patterns only; no page or generated component code was copied.

## Independent UI Review

An independent UI/UX review scored the first pass **81/100**. It identified misleading real-time language, compressed mobile homepage actions, excess fare-result height, and duplicated station facts. After those findings were addressed, the same reviewer scored the second pass **88/100** and found no remaining UI blocker for release.

- At a 390 px viewport, the homepage action group measures 330 px and the primary action 225 px; its label no longer wraps.
- Static timetable states now use `时刻表可用`, `当前时段`, `首班前`, and `末班后` instead of implying a live operations feed.
- The desktop fare result surface is reduced from 630 px to 460 px, with a 300 px mobile minimum.
- Station details no longer show the low-value matched-schedule count or duplicate exit and nearby-place facts.

## Browser Evidence

- Shared station picker opens all **404** stations after a station has already been selected.
- `station_guide.html` lists **404** stations and keeps the full registry available.
- `Map.html` loads the SVG and exposes **312** mapped station labels while retaining search for the complete station registry.
- The tested `西直门 → 积水潭` result retains one colored route strip and two station nodes; the strip and station-content widths both measured **86 px**, so the line does not extend beyond its stops.
- Fare actions remain within their form panel, and the checked homepage, query, fare, station, map, and service-board layouts have no desktop horizontal overflow.

## Remaining Data Limitation

The searchable station registry contains more stations than the supplied SVG exposes as identifiable labels. The interface reports this gap instead of inventing map coordinates. Resolving it completely requires an updated source SVG or a verified station-to-SVG mapping dataset; it is not a styling problem.
