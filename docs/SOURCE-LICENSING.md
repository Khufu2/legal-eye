# Source licensing gate

No connector may discover or ingest automatically until a reviewer has recorded an approved policy. An unknown answer is treated as **no**.

## Required decisions

| Gate | Meaning |
| --- | --- |
| Discover | Index listings or metadata to identify available material. |
| Fetch individual document | Retrieve a user-selected item. |
| Cache | Retain a transient copy for processing or performance. |
| Store permanently | Preserve the source object and canonical representation. |
| Commercially display | Show source text or images inside a paid product. |
| Bulk ingest | Retrieve a corpus systematically. |
| Embed | Create and retain vector representations. |
| Computational analysis | Run OCR, extraction, classification, summarization or citation analysis. |
| Redistribute | Export or provide copies beyond the licensed user. |
| Attribution required | Display the required source, licence and attribution language. |

## Connector states

- `review_required`: registry entry exists; all capabilities default to false.
- `approved`: only the individually approved capability flags may run.
- `api_key_required`: approved path exists but needs customer or platform credentials.
- `license_required`: commercial agreement or written permission is required.
- `disabled`: connector must not execute.

The connector runtime must evaluate the relevant flag before each discovery, fetch, cache, storage, display, bulk, embedding, analysis or redistribution operation. `sync_enabled` is valid only when the state is `approved` and the exact requested operations are allowed.

Commercial providers such as Westlaw, LexisNexis, Practical Law and proprietary report databases are never scraped. Future access is through a `CommercialDataProvider` adapter using an authorized API and the customer’s or Legal Eye’s licensed entitlement.

