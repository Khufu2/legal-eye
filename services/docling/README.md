# Legal Eye private parsing service

This service is the only canonical document-parsing boundary. It calls Docling directly and returns lossless Docling JSON; downstream search chunks remain derived artifacts linked to structural nodes and page geometry.

Supported input follows the pinned Docling release, including PDF/scanned PDF, DOCX, XLSX, PPTX, HTML, images and text. Confidential uploads are streamed to an ephemeral file, converted locally, and removed when the request finishes. Network egress should be disabled in production and model artifacts should be preloaded into the image/volume.

Required runtime controls:

- private network exposure only;
- `LEGAL_EYE_PARSER_KEY` supplied from the secret manager;
- encryption in transit and at rest;
- request-size, MIME and decompression limits at the gateway;
- malware scanning before conversion;
- no request bodies in logs;
- immutable source hash and conversion provenance retained in Supabase;
- one worker per container unless memory profiling proves safe concurrency.

The Docker base and Python dependencies are pinned. Production image promotion also requires SBOM generation, vulnerability scanning, signature verification and the golden legal-document regression suite.

