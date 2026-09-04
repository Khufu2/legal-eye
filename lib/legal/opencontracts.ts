/** Server-side boundary for the dedicated OpenContracts service. */

export type OpenContractsTransport = {
  endpoint: string;
  token?: string;
  timeoutMs?: number;
};

export type GraphQLError = { message: string; path?: Array<string | number> };
export type GraphQLResponse<T> = { data?: T; errors?: GraphQLError[] };

export class OpenContractsClient {
  constructor(private readonly transport: OpenContractsTransport) {}

  async execute<T>(
    query: string,
    variables: Record<string, unknown> = {},
    requestId = crypto.randomUUID(),
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.transport.timeoutMs ?? 30_000);
    try {
      const response = await fetch(this.transport.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-legal-eye-request-id": requestId,
          ...(this.transport.token ? { authorization: `Bearer ${this.transport.token}` } : {}),
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`OpenContracts request failed (${response.status})`);
      const result = await response.json() as GraphQLResponse<T>;
      if (result.errors?.length || !result.data) {
        throw new Error(result.errors?.map((error) => error.message).join("; ") || "OpenContracts returned no data");
      }
      return result.data;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export type CanonicalDocumentReference = {
  legalEyeDocumentId: string;
  openContractsDocumentId: string;
  canonicalArtifactHash: string;
  organizationId: string;
  matterId?: string;
};

export type CanonicalCitationEdge = {
  sourceDocumentId: string;
  sourceNodeRef: string;
  rawCitation: string;
  normalizedCitation?: string;
  targetAuthorityId?: string;
  parserKey: string;
  parserVersion: string;
  confidence: number;
};

