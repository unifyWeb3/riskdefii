// ===== DeFi Risk Rating — Shared Types =====

export type ProtocolCategory = "lending" | "dex" | "yield" | "staking" | "cdp" | "bridge" | "other";
export type ConfidenceLevel = "high" | "medium" | "low";
export type Grade = "A" | "B" | "C" | "D" | "F";

export interface DataPoint<T> {
  value: T | null;
  source: string;
  fetchedAt: string;
  confidence: ConfidenceLevel;
}

export interface AuditRecord {
  auditor: string;
  date: string;
  scope: string;
  criticalFindings: number;
  unresolvedCritical: number;
  reportUrl?: string;
}

export interface ExploitRecord {
  date: string;
  lossUSD: number;
  type: string;
  resolved: boolean;
  postMortemUrl?: string;
  source: string;
}

export interface ProtocolRawData {
  protocolId: string;
  protocolName: string;

  // Smart Contract Security
  audits: DataPoint<AuditRecord[]>;
  bugBountyUSD: DataPoint<number>;
  exploitHistory: DataPoint<ExploitRecord[]>;
  codeMaturityMonths: DataPoint<number>;
  contractsVerified: DataPoint<boolean>;

  // Liquidity
  tvlUSD: DataPoint<number>;
  tvl30dChange: DataPoint<number>;
  tvl7dChange: DataPoint<number>;
  slippage10k: DataPoint<number | null>;
  slippage100k: DataPoint<number | null>;

  // Token Concentration
  top10HolderPct: DataPoint<number | null>;
  insiderTeamPct: DataPoint<number | null>;
  hasPublicVestingSchedule: DataPoint<boolean | null>;
  nearUnlockRiskFlag: DataPoint<boolean | null>;

  // Governance & Admin
  hasMultisig: DataPoint<boolean | null>;
  timelockDays: DataPoint<number>;
  adminCanDrainWithoutTimelock: DataPoint<boolean>;
  adminCanMintUnrestricted: DataPoint<boolean>;
  isUpgradeable: DataPoint<boolean>;
  isDecentralized: DataPoint<boolean | null>;

  // Protocol History
  ageMonths: DataPoint<number>;
  pastIncidentCount: DataPoint<number>;
  incidentResponseScore: DataPoint<number | null>;

  // Yield Sustainability
  apyTotal: DataPoint<number | null>;
  apyBase: DataPoint<number | null>;
  apyReward: DataPoint<number | null>;
  rewardTokenIsNative: DataPoint<boolean | null>;

  // Dependencies
  usesExternalOracle: DataPoint<boolean>;
  oracleProvider: DataPoint<string | null>;
  usesBridge: DataPoint<boolean>;
  bridgeProvider: DataPoint<string | null>;
  dependsOnExternalProtocols: DataPoint<string[]>;
}

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
