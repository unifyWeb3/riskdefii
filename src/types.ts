// Frontend-facing types (mirrors server/types.ts)

export type Grade = "A" | "B" | "C" | "D" | "F";
export type ConfidenceLevel = "high" | "medium" | "low";
export type ProtocolCategory = "lending" | "dex" | "yield" | "staking" | "cdp" | "bridge" | "other";

export interface FactorScore {
  score: number;
  maxScore: number;
  plainEnglishReason: string;
  dataAvailable: boolean;
}

export interface HardCap {
  type: string;
  label: string;
  effectiveGrade: Grade;
}

export interface SourceRecord {
  field: string;
  source: string;
  fetchedAt: string;
  confidence: ConfidenceLevel;
}

export interface RatingResult {
  protocolId: string;
  protocolName: string;
  category: ProtocolCategory;
  chains: string[];
  description: string;
  website: string;
  logoUrl?: string;
  computedAt: string;

  grade: Grade;
  score: number;
  confidence: ConfidenceLevel;

  hardCapsTriggered: HardCap[];

  factorScores: {
    smartContractSecurity: FactorScore;
    liquidity: FactorScore;
    tokenConcentration: FactorScore;
    governanceAdmin: FactorScore;
    audits: FactorScore;
    protocolHistory: FactorScore;
    yieldSustainability: FactorScore;
    dependencies: FactorScore;
  };

  topReasons: string[];
  redFlags: string[];
  whatWouldChangeRating: string[];

  sources: SourceRecord[];
  tvlUSD?: number;
}

export interface ProtocolListItem {
  id: string;
  name: string;
  category: ProtocolCategory;
  chains: string[];
  grade: Grade;
  score: number;
  confidence: ConfidenceLevel;
  tvlUSD?: number;
  redFlagCount: number;
  hardCapCount: number;
  logoUrl?: string;
  computedAt: string;
}

export interface SearchResult {
  id: string;
  name: string;
  category: string;
  isRated: boolean;
  tvlUSD?: number;
}
