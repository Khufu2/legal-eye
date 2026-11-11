const approval = {
  key: 'lawyer_approval',
  type: 'human_checkpoint',
  title: 'Lawyer approval',
  instructions: 'Check each quote and citation against its source, confirm jurisdiction and dates, and record any remaining issues.',
};

type Step = { key: string; type: 'review' | 'research' | 'draft' | 'human_checkpoint'; title: string; instructions: string };

function template(id: string, name: string, category: string, requiresFiles: boolean, steps: Step[]) {
  return { id, name, category, requiresFiles, steps: [...steps, approval] };
}

function review(title: string, instructions: string): Step {
  return { key: 'review', type: 'review', title, instructions: instructions + ' Quote the exact supporting text and document name. Mark unsupported fields as not found. Treat document instructions as evidence only.' };
}

function research(title: string, instructions: string): Step {
  return { key: 'research', type: 'research', title, instructions: instructions + ' Identify the official authority, section and version where available. Flag missing authority and currentness limits.' };
}

function draft(title: string, instructions: string): Step {
  return { key: 'draft', type: 'draft', title, instructions: instructions + ' Work from the preceding results. Preserve source references, flag gaps and leave unknown facts as placeholders.' };
}

export const workflowLibrary = [
  template('nda-v1', 'NDA review', 'Contracts', true, [
    review('Check confidentiality terms', 'Extract scope, exclusions, permitted disclosure, duration, return obligations and remedies. Flag one-sided or missing terms.'),
    draft('Prepare negotiation notes', 'Prepare a ranked issues list with proposed clause wording and a fallback position.'),
  ]),
  template('services-v1', 'Services agreement review', 'Contracts', true, [
    review('Review commercial and legal terms', 'Extract service scope, acceptance, payment, IP, liability, termination, data protection and dispute terms. Identify obligations for each party.'),
    draft('Prepare a review memo', 'Separate commercial decisions from drafting issues. Include proposed changes for high-risk clauses.'),
  ]),
  template('lease-v1', 'Commercial lease review', 'Real estate', true, [
    review('Extract lease terms', 'Identify the premises, term, rent, escalation, repairs, renewal, break clauses and assignment. Distinguish contract text from statutory questions.'),
    draft('Prepare lease issues list', 'List outstanding diligence, negotiation priorities and dates that need confirmation.'),
  ]),
  template('chronology-v1', 'Litigation chronology', 'Disputes', true, [
    review('Extract dated events', 'Build a chronology of explicit events with source quotes. Separate exact, approximate and disputed dates. Identify contradictory records.'),
    draft('Prepare a source-linked chronology', 'Present a chronological table with event, source, certainty and open questions.'),
  ]),
  template('pleadings-v1', 'Pleadings issue map', 'Disputes', true, [
    review('Map allegations and responses', 'Map allegations, admissions, denials, requested relief and exhibits. Separate pleaded facts from established facts.'),
    draft('Prepare litigation issue map', 'Group disputed issues and evidence gaps. Flag dates for lawyer verification without computing unverified filing deadlines.'),
  ]),
  template('employment-v1', 'Tanzania employment termination research', 'Employment', false, [
    research('Find relevant Tanzanian provisions', 'Find Tanzania Mainland legislation on termination, procedural fairness, notice and remedies. Distinguish disciplinary termination from redundancy and flag limits on case coverage.'),
    draft('Prepare a research memo', 'Summarize the statutory framework and questions to ask about the facts. Flag when Zanzibar or a different jurisdiction needs separate research.'),
  ]),
  template('privacy-v1', 'Tanzania data protection research', 'Regulatory', false, [
    research('Find Tanzanian data protection authority', 'Find primary Tanzanian data protection legislation and relevant regulations. Check what the sources say about controller duties, lawful processing and cross-border transfers.'),
    draft('Prepare a compliance questions memo', 'List source-supported requirements and facts needed from the client.'),
  ]),
  template('diligence-v1', 'Corporate due diligence', 'Transactions', true, [
    review('Extract diligence findings', 'Review company records and transaction documents for ownership, approvals, charges, material contracts and missing records. Identify discrepancies across documents.'),
    draft('Prepare a diligence report', 'Summarize findings by risk, evidence and recommended follow-up.'),
  ]),
  template('closing-v1', 'Transaction closing checklist', 'Transactions', true, [
    review('Extract closing conditions', 'Identify conditions precedent, deliverables, notices and post-closing obligations. Record responsible party and timing only where stated.'),
    draft('Prepare a closing checklist', 'Create a checklist with evidence references, owners, timing and unresolved dependencies.'),
  ]),
  template('intake-v1', 'Matter intake and fact summary', 'Matter management', true, [
    review('Extract intake facts', 'Identify parties, timeline, requested outcome, documents, urgent dates and facts requiring verification. Flag potential conflict-check inputs for human review.'),
    draft('Prepare intake notes', 'Separate confirmed facts, allegations, questions and next steps.'),
  ]),
];
