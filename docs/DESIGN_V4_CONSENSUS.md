# Legal Eye v4 — Evidence Workspace Design

This iteration deliberately moves beyond the previous dark visual layer. The goal is not to copy another company's interface pixel-for-pixel; it is to adopt the interaction qualities that make research products feel fast, credible and calm.

## Benchmarks

### Consensus
Useful patterns:
- light, paper-like evidence surfaces
- mint/teal used as a restrained research/accent colour rather than a full-page brand wash
- strong title-first hierarchy
- extracted answer or synthesis separated visually from source metadata
- dense filters and research controls that remain secondary to evidence
- paper/source preview in a side panel rather than forcing navigation away from the answer
- mobile research optimized around search, paper detail, library and thread continuity

### Linear
Useful patterns:
- strict spacing discipline
- small, predictable control heights
- compact left navigation
- low visual noise and minimal decoration
- interaction states expressed with subtle background/border changes

### Notion
Useful patterns:
- document/work-product remains the visual priority
- progressive disclosure instead of exposing every control at once
- clear separation between editing content and workspace chrome

### Perplexity / modern answer engines
Useful patterns:
- citations remain adjacent to claims
- answer width stays readable
- evidence opens beside the answer
- follow-up actions do not compete with the primary result

## What changed structurally

The v4 stylesheet is a layout layer, not only a palette layer.

- The application shell becomes a light institutional research workspace with a quieter, tighter sidebar.
- Ask becomes a research-home surface with one dominant composer, compact action launchers and a restrained continuation list.
- On mobile, Ask is recomposed: quick launchers and history scroll normally while the question composer becomes a floating bottom assistant control.
- Research becomes three floating evidence surfaces with real gutters and hierarchy instead of a dark split-screen grid.
- The answer uses a narrow reading column, title-first hierarchy, compact proposition cards and evidence metrics.
- Source viewing becomes a dedicated paper/evidence card with a highlighted passage treatment.
- Draft keeps a true page-on-canvas model while side panes become compact white tools rather than dark dashboards.
- Review findings are rebuilt visually as scan-first evidence cards.
- Tables and Lists move to low-chrome, dense white data surfaces with subtle sticky-style headers and source-state emphasis.
- Agent becomes an execution console: progress, plan and checkpoints are visually separated from run controls.
- Skills becomes a library/detail workspace.
- Monitor becomes a policy/evidence operations workspace rather than a wall of dark cards.
- Workflow uses a light graph canvas and white process nodes.
- Matters and Vault use understated content cards rather than dramatic tiles.
- Trust becomes an enterprise evidence surface with soft mint/lilac atmosphere rather than a marketing-style dark hero.

## Palette

The palette intentionally echoes Consensus' professional research feel without copying proprietary assets:

- Canvas: `#F6F8F7`
- Soft canvas: `#F0F4F2`
- Surface: `#FFFFFF`
- Ink: `#172126`
- Secondary ink: `#27333A`
- Muted text: `#66747A`
- Hairline: `#DCE5E1`
- Mint: `#31C5A4`
- Mint strong: `#14957B`
- Mint deep: `#0B6F5D`
- Mint ghost: `#E8F8F3`
- Soft lilac: `#F5F3FB`

## Mobile principle

Do not miniaturize the whole desktop product. On phones, prioritize:
1. Ask / Assistant
2. Research
3. Vault / files
4. Matter continuity
5. Source checking

Drafting remains readable, but secondary panes collapse. Structured review tables remain scrollable rather than becoming card soup. Agent controls collapse before the execution trace.
