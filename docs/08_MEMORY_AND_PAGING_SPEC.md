# Memory allocation and page replacement

## Contiguous allocation model

Model a contiguous address space from 0 to totalKiB using half-open ranges. Sizes and addresses are integer KiB units for teaching. Start with one free segment covering all memory. Each live allocation has a unique ID and occupies one contiguous segment. Allocated plus free segment sizes must equal total capacity; segments neither overlap nor leave unaccounted gaps.

| Strategy | Selection |
| --- | --- |
| First Fit | First sufficiently large free hole in ascending address order |
| Best Fit | Smallest sufficiently large hole; lower address breaks ties |
| Worst Fit | Largest sufficiently large hole; lower address breaks ties |

Allocate from the low-address end of the selected hole. Split only when a positive remainder exists. Free releases exactly the live allocation for that ID and merges free neighbors on both sides. Invalid duplicate allocation IDs or freeing a non-live ID are rejected without changing state. A previously freed ID may be reused by a later valid operation.

When allocation fails, distinguish insufficient total free memory from sufficient total free memory fragmented into holes that are individually too small. Show total free memory, largest free hole, and optionally free space outside the largest hole. Label that last number exactly; do not claim it is a universal fragmentation percentage. Exact-size variable partitions introduce no modeled internal fragmentation; do not invent alignment overhead.

## Allocation reference

Capacity 1024 KiB. Allocate A=100, B=300, C=100, D=300 in that order, then free B. The holes are [100,400) of size 300 and [800,1024) of size 224. Allocating E=200 yields address 100 under First Fit and Worst Fit, and address 800 under Best Fit.

From the state before E, requesting 400 fails because the largest hole is 300 although total free space is 524. Freeing C in that state merges the B and C holes into [100,500). Freeing D then produces the free range [100,1024), while A remains allocated.

The allocation laboratory steps through an ordered operation list. Each operation has a result and explanation; unsuccessful operations consume a visible step but do not change memory. Stop on structurally invalid scenarios before running. Runtime failure to fit is an ordinary step outcome.

## Paging model

Input is a sequence of nonnegative integer page IDs and a positive number of frames. All frames begin empty; fill the lowest-index empty frame first. Process references in order. A reference either hits an existing page or faults and inserts a page, evicting if necessary.

| Algorithm | Eviction rule |
| --- | --- |
| FIFO | Page that has resided longest since insertion; hits do not alter this order |
| LRU | Page with the oldest last-access index; a hit updates recency |
| Optimal | Page whose next future use is farthest away; never-used-again counts as infinity; lowest frame index breaks ties |

Optimal is a teaching benchmark that knows the future reference sequence. Explain that assumption. Page hits must not duplicate a page in another frame. Every event includes reference index, referenced page, hit/fault, evicted page if any, chosen frame, resulting frame array, and the reason.

Metrics: faults, hits, total references, fault ratio = faults/references, and hit ratio = hits/references. For an empty sequence, disallow Run and show no misleading percentages. Do not convert page faults to milliseconds without a separately specified timing model.

## Paging reference

Frames = 3. References = [7,0,1,2,0,3,0,4,2,3,0,3,2]. Expected faults: FIFO 10, LRU 9, Optimal 7. The fixture includes complete per-reference frames so a correct total cannot hide incorrect intermediate behavior.

## Required tests

Allocation: exact fit, split, no fit, duplicate ID, free unknown ID, one-sided and two-sided coalescing, tied holes, and conservation after every operation. Paging: repeated page, one frame, more frames than unique pages, empty input, FIFO hits, LRU recency updates, Optimal ties, and consistent frame indices. Keep allocation and paging state separate.
