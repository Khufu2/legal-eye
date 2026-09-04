/** Explainable ranking inputs. Vector similarity is never authority by itself. */
export type LegalRetrievalSignals = {
  fullTextRank: number;
  trigramSimilarity: number;
  vectorSimilarity: number;
  metadataMatch: number;
  citationGraphRank: number;
  courtAuthorityRank: number;
  treatmentRank: number;
  temporallyValid: boolean;
  sourcePolicyApproved: boolean;
  permissionGranted: boolean;
};

export function eligibleForLegalAnswer(signals: LegalRetrievalSignals) {
  return signals.permissionGranted && signals.sourcePolicyApproved && signals.temporallyValid;
}

export function explainableHybridScore(signals: LegalRetrievalSignals) {
  if (!eligibleForLegalAnswer(signals)) return Number.NEGATIVE_INFINITY;
  return (
    signals.fullTextRank * 0.22 +
    signals.trigramSimilarity * 0.08 +
    signals.vectorSimilarity * 0.18 +
    signals.metadataMatch * 0.12 +
    signals.citationGraphRank * 0.14 +
    signals.courtAuthorityRank * 0.16 +
    signals.treatmentRank * 0.10
  );
}

