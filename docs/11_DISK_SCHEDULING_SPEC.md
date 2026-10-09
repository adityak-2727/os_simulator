# Disk scheduling specification

## Model

Use a static batch of requests with no arrival times. Cylinders are integers from 0 through maxCylinder inclusive. The head starts at initialHead. Each request has a unique ID, and duplicate cylinder values are valid separate requests. Head movement is distance in cylinders, not measured I/O latency. Rotation, transfer time, caching, and SSD behavior are outside this model.

## Algorithms

| Algorithm | Rule |
| --- | --- |
| FCFS | Serve requests in input order |
| SSTF | Choose closest pending cylinder; smaller cylinder then input order breaks ties |
| SCAN | Sweep in the chosen direction, serving requests; if requests remain on the other side, travel to the physical endpoint, reverse, and serve them |
| C-SCAN | Sweep in the chosen direction; if requests remain on the other side, travel to that endpoint, wrap to the opposite endpoint without servicing on the wrap, then continue |

For SSTF and sweep algorithms, requests at the current head are served before moving; duplicates are served in input order. FCFS preserves input order even when a later request is at the initial head. Zero-distance servicing is still an event.

SCAN and C-SCAN stop when the last request is served. Do not travel to another endpoint afterward. When a sweep needs to reach the opposite-side requests, endpoint movement is included even if no request exists at the endpoint. C-SCAN wrap movement is included in the total. The interface must state this convention.

If the initial direction has no pending requests, SCAN still reaches that direction's endpoint before reversing, and C-SCAN reaches it before wrapping. For direction lower, mirror the rules around the cylinder range.

## Result contract

Represent every move with from, to, distance, kind (service, endpoint, or wrap), and requestId when serviced. Sum absolute movement distances to obtain total movement. Service order includes only request IDs, while head path includes endpoints and wrap points. The chart must visually distinguish a wrap from ordinary service movement.

The vertical or horizontal chart axis used for movement sequence is labeled step, not time. Comparison tables show total cylinders moved, average movement per request, and the conventions used. Do not display invented millisecond values.

## Reference case

Range 0 to 199, head 53, direction higher. Requests in input order: 98,183,37,122,14,124,65,67.

| Algorithm | Head path after initial 53 | Total movement |
| --- | --- | --- |
| FCFS | 98,183,37,122,14,124,65,67 | 640 |
| SSTF | 65,67,37,14,98,122,124,183 | 236 |
| SCAN | 65,67,98,122,124,183,199,37,14 | 331 |
| C-SCAN | 65,67,98,122,124,183,199,0,14,37 | 382 |

The 199 and 0 entries can be non-service moves. The reference includes them explicitly to avoid accidentally implementing LOOK or C-LOOK while labeling it SCAN or C-SCAN.

## Required tests

Reference paths; lower direction; no requests; one request at head; duplicates; equidistant SSTF candidates; all requests on one side; requests at endpoints; valid range limits; invalid out-of-range requests; wrap cost; no gratuitous final movement; sum of movement ledger equals displayed total.
