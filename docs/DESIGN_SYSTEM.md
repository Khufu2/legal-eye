# Legal Eye — Midnight Editorial Design System

This document is the product-design contract for Legal Eye. It keeps the Legora-class workflow depth, but moves the product away from a generic legal dashboard and toward a distinct editorial legal-intelligence workspace.

## 1. Product principle

**Legal Eye should make the lawyer more capable, not make the AI more visible.**

The UI is designed around work product, authority, provenance, correction and judgment. AI is present as a tool inside the lawyer's workflow rather than as a decorative layer over every screen.

The product should feel closer to a high-end legal publication, research desk and document room than a conventional SaaS admin panel.

## 2. Visual direction

The supplied reference artwork established the palette. Dominant sampled colours were:

- Midnight: `#040517`
- Midnight soft: `#07091A`
- Surface grey/navy: `#141620`
- Hairline/muted slate: `#4E505E`
- Cool secondary text: `#A9AEBA`
- Cool light text: `#B2B8C5`

Legal Eye turns those into a two-material system:

1. **Midnight chrome** for navigation, command surfaces, AI controls, corpus operations and workspaces.
2. **Cool paper** for sustained reading and drafting where lawyers need high contrast over long sessions.

This keeps the visual identity faithful to the reference without forcing long legal opinions onto a low-contrast dark canvas.

## 3. Evidence-based interaction rules

The design system applies the human-AI interaction guidelines validated by Amershi et al. (CHI 2019):

- Make clear what the system can do.
- Make clear how well it can do it.
- Show contextually relevant information.
- Make AI easy to invoke and easy to dismiss.
- Make errors easy to correct.
- Scope the system when uncertain.
- Make clear why a result occurred.
- Encourage granular feedback and lawyer override.

Source: Microsoft Research, *Guidelines for Human-AI Interaction*  
https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/

### Legal-specific consequence

Legal research AI still requires verification. Stanford's empirical evaluation of AI legal research systems found meaningful hallucination rates even in specialist RAG products. Legal Eye therefore does not visually present an AI answer as self-authenticating.

Source: Magesh et al., *Hallucination-Free? Assessing the Reliability of Leading AI Legal Research Tools*  
https://law.stanford.edu/publications/hallucination-free-assessing-the-reliability-of-leading-ai-legal-research-tools/

Recent work on legal citation hallucination detection also shows that subtle citation errors remain difficult to catch automatically. That supports keeping source access, treatment state and lawyer verification close to the proposition rather than in a distant audit page.

Source: Liu, Stammbach & Henderson, *Who Checks the Citations? Benchmarking Legal Hallucination Detection*  
https://arxiv.org/abs/2606.21155

### Legal RAG consequence

Retrieval quality is a system-level property, not just a model property. LRAGE/LARGE emphasises that legal RAG depends on corpus, retrieval, reranking, model and evaluation together. Legal Eye therefore exposes evidence, authority sets, corpus policy, exact source spans and coverage rather than reducing research to a single chat response.

Source: *LARGE: Legal Retrieval Augmented Generation Evaluation Tool* — Papers With Code  
https://paperswithcode.com/paper/large-legal-retrieval-augmented-generation

## 4. Core UX rules

### 4.1 Keep matter and jurisdiction context visible
The user should always be able to see the active matter, jurisdiction and private-knowledge boundary without opening a settings page.

### 4.2 Put authority beside the proposition
Inline citation chips open the exact source. The research workspace retains a three-pane model:

`Research plan → Answer → Source`

The source pane is a first-class part of the answer, not an appendix.

### 4.3 Separate facts, law, inference and uncertainty
Use restrained status labels. Never use colour alone. Every uncertain or illustrative record is labelled in text.

### 4.4 Let lawyers correct AI at the point of work
Draft and review surfaces keep `Apply`, `Redline`, `Comment`, `Ignore`, `Save as precedent`, and direct text editing close to the suggestion.

### 4.5 Do not hide agent execution
Long-running agent work exposes planning, execution, verification and pending steps. A lawyer can inspect evidence or pause the run.

### 4.6 Preserve provenance in tables
Every extracted cell should retain source, confidence and reviewer state. AI extraction without a source trail is incomplete work.

### 4.7 Prefer density over decoration
Legal Eye is a professional tool. Motion is short and functional. Gradients are extremely restrained. Cards are used only when they create hierarchy, not because every object needs a container.

### 4.8 Use serif typography for legal reading, sans-serif for control
- Editorial/legal content: Iowan Old Style / Palatino / Baskerville / Georgia fallback stack.
- Product controls and metadata: Inter / system UI stack.

This creates a clear cognitive distinction between **work product** and **software controls**.

## 5. Surface hierarchy

| Surface | Material | Purpose |
|---|---|---|
| Sidebar / header | Midnight | Product orientation and context |
| Research plan | Midnight | Search process and authority set |
| Research answer | Cool paper | Long-form legal reasoning |
| Source viewer | Midnight | Evidence inspection |
| Document canvas | Cool paper | Drafting and redline work |
| AI inspector | Midnight | Suggestions and playbook checks |
| Tables / lists | Midnight | Dense structured review |
| Trust / monitor | Midnight | Governance and operational control |

## 6. Component rules

### Buttons
Primary actions are cool white on midnight. Secondary actions are subtle midnight surfaces with hairline borders. Avoid saturated brand colours for normal actions.

### Borders
Use hairlines to establish structure. Do not stack multiple shadows and borders on the same hierarchy level.

### Radius
- Tiny controls: 7–8px
- Cards/panes: 10–12px
- Hero composer: 16px
- Document paper: 2–3px, intentionally sheet-like

### Status accents
Status colours are functional, desaturated and sparing:

- Verified / active: muted sage
- Information / jurisdiction: muted slate-blue
- Warning / license gate: muted amber
- High risk / error: muted crimson

### Motion
- 140–220ms for hover/state transitions
- No bouncing, glowing or decorative perpetual motion
- Honour `prefers-reduced-motion`

## 7. Responsive behaviour

Desktop remains the primary serious-work surface, but mobile must not feel like a broken desktop app.

- Research plan collapses before the answer.
- Source evidence is available through the source sheet when space is constrained.
- Draft outline and AI inspector collapse before the document.
- Dense tables remain horizontally scrollable rather than wrapping legal data into unreadable cards.
- System-status footer is removed on small screens.
- Touch targets remain comfortably tappable.

## 8. What not to do

- Do not return to beige/green generic legal-tech styling.
- Do not mimic Legora's visual identity; retain the workflow concepts, not its surface treatment.
- Do not fill screens with AI sparkle icons or gradients.
- Do not hide caveats in tooltips.
- Do not show an AI confidence percentage without evidence/coverage context.
- Do not use a single chat window as the primary interface for research, review, drafting or diligence.
- Do not make every module visually identical. Reading, drafting, table review and agent execution have different cognitive jobs.

## 9. Implementation

The theme lives in `app/editorial.css`, imported after `app/globals.css` from `app/layout.tsx`. This lets the visual system overhaul the application without disturbing the production logic already implemented in `app/page.tsx`.

All future UI work should use this file and document as the baseline unless a deliberate design-system revision is made.
