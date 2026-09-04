export type CitationContext = {
  jurisdictionCode: string;
  documentId: string;
  sourceNodeRef?: string;
  languageCode?: string;
};

export type ParsedCitation = {
  raw: string;
  normalized: string;
  start: number;
  end: number;
  authorityType?: "case" | "legislation" | "regulation" | "treaty" | "unknown";
  metadata: Record<string, unknown>;
  confidence: number;
};

export interface CitationParser {
  readonly key: string;
  readonly version: string;
  readonly jurisdictions: readonly string[];
  parse(text: string, context: CitationContext): Promise<ParsedCitation[]>;
}

export class CitationParserRegistry {
  private readonly byJurisdiction = new Map<string, CitationParser>();

  register(parser: CitationParser) {
    for (const jurisdiction of parser.jurisdictions) {
      if (this.byJurisdiction.has(jurisdiction)) {
        throw new Error(`A citation parser is already registered for ${jurisdiction}`);
      }
      this.byJurisdiction.set(jurisdiction, parser);
    }
  }

  require(jurisdiction: string) {
    const parser = this.byJurisdiction.get(jurisdiction);
    if (!parser) throw new Error(`No active citation parser for ${jurisdiction}`);
    return parser;
  }
}

/** US-only adapter for a separately deployed Python eyecite service. */
export class EyeciteServiceParser implements CitationParser {
  readonly key = "eyecite";
  readonly version: string;
  readonly jurisdictions = ["US"] as const;

  constructor(
    private readonly endpoint: string,
    version: string,
    private readonly token?: string,
  ) {
    this.version = version;
  }

  async parse(text: string, context: CitationContext): Promise<ParsedCitation[]> {
    if (context.jurisdictionCode !== "US") throw new Error("eyecite is restricted to US citations");
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({ text, context }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`eyecite service failed (${response.status})`);
    const body = await response.json() as { citations?: ParsedCitation[] };
    return body.citations ?? [];
  }
}

