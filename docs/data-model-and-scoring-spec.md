# DeFi Risk Rating — Data Model & Scoring Spec v1

**Date:** 2026-10-07  
**Status:** Implemented

---

## Assumptions

1. **No wallet required.** Read-only data app. No onchain transactions.
2. **Chains in scope:** Ethereum, Arbitrum, Base (best free-API coverage).
3. **Top 50** = top 50 DeFi protocols by TVL from DefiLlama, excluding CEXes, with curated supplementary data.
4. **Scoring is deterministic.** Given the same inputs, the same score always results.
5. **Never invent numbers.** If a factor has no data, it is marked `unknown`, excluded from the score, and confidence is lowered.
6. **Data gap acknowledgements (v1):**
   - Unlock schedules: not reliably available via free APIs. Marked unknown.
   - $10K/$100K slippage: DEX-specific; DefiLlama does not expose this. Proxied from TVL depth.
   - Multisig key counts: public for some protocols (Gnosis Safe), not all. Sourced from docs/DeFi Safety where available.

---

## Data Sources

| Source | Data | Cache TTL |
|--------|------|-----------|
| DefiLlama `/protocols` | TVL, category, chains | 6 hours |
| DefiLlama `/yields/pools` | APY, pool composition, `rewardTokens` flag | 6 hours |
| DefiLlama `/hacks` | Exploit history, amounts, resolution status | 6 hours |
| CoinGecko `/coins/{id}` | Market cap, holder data (proxy) | 6 hours |
| Curated dataset | Audits, bug bounty, multisig, timelocks, oracle, incidents | Manual, timestamped |

All data points are logged with `source` and `fetchedAt` fields on every rating response.

---

## Data Model

### `ProtocolRawData`

```typescript
{
  curated: CuratedProtocol;     // manually researched fields
  tvlUSD: number | null;        // DefiLlama live
  ageMonths: number;            // from DefiLlama protocol launch date
  exploits: Exploit[];          // from DefiLlama hacks
  yieldAPY: number | null;      // from DefiLlama yields
  yieldHasRewardTokens: boolean;// if true, yield is partly token-emissions
  sources: SourceRecord[];      // every data point with provenance
}
```

### `CuratedProtocol` (manually maintained in `server/curated-data.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `audits[]` | Array | auditor, date, scope, critical findings, unresolved critical |
| `bugBountyUSD` | number | public bug bounty cap in USD |
| `hasMultisig` | boolean | null = unknown |
| `timelockDays` | number | 0 = no timelock |
| `adminCanDrain` | boolean | true if admin key can drain protocol funds |
| `adminCanMintUnrestricted` | boolean | true if EOA can mint without limit |
| `isUpgradeable` | boolean | proxy or upgrade mechanism present |
| `isDecentralized` | boolean | null = unknown |
| `insiderTeamPct` | number | % of token supply held by team/VCs |
| `hasPublicVesting` | boolean | public vesting schedule |
| `usesExternalOracle` | boolean | depends on Chainlink/Pyth/etc |
| `oracleProvider` | string | null = internal or none |
| `usesBridge` | boolean | cross-chain bridge dependency |
| `dependsOn` | string[] | other protocol slugs this depends on |
| `incidentResponseScore` | 0-10 | null if no incidents |
| `curatedAt` | ISO date | when this record was last reviewed |

---

## Scoring Model (0–100, higher = safer)

### Factor Weights

| # | Factor | Max Points | Data Sources |
|---|--------|-----------|--------------|
| 1 | Smart Contract Security | 25 | Curated: audits, age, exploit history, bug bounty |
| 2 | Liquidity | 15 | DefiLlama TVL + TVL trend |
| 3 | Token Concentration | 15 | Curated: insider%, public vesting |
| 4 | Governance & Admin Control | 10 | Curated: multisig, timelock, adminCanDrain |
| 5 | Audits | 10 | Curated: number, quality, findings resolved |
| 6 | Protocol History | 10 | Curated: age, incidents, response score |
| 7 | Yield Sustainability | 10 | DefiLlama yields: APY composition |
| 8 | Dependencies | 5 | Curated: oracle risk, bridge risk, dependency count |

**Total:** 100

### Factor 1 — Smart Contract Security (25 pts)

- Age in production: 0-7 pts (0-6mo: 0; 6-12mo: 2; 1-2yr: 4; 2-3yr: 6; 3yr+: 7)
- Bug bounty: 0-5 pts ($0: 0; <$50K: 1; <$200K: 2; <$500K: 3; <$1M: 4; $1M+: 5)
- Exploit history: 0-8 pts (unresolved critical: 0; resolved critical: 2; minor only: 5; none: 8)
- Upgrade risk: 0-5 pts (not upgradeable: 5; upgradeable + timelock: 3; upgradeable no timelock: 1)

### Factor 2 — Liquidity (15 pts)

- TVL: 0-10 pts (<$1M: 0; <$10M: 2; <$100M: 4; <$500M: 6; <$2B: 8; $2B+: 10)
- TVL stability: 0-5 pts (proxy: presence of TVL data = 3; >$1B = 5)

### Factor 3 — Token Concentration (15 pts)

- Insider/team/VC %: 0-10 pts (>50%: 0; >35%: 3; >25%: 6; >15%: 8; ≤15%: 10)
- Public vesting: 0-5 pts (yes: 5; no: 0; unknown: 2)

### Factor 4 — Governance & Admin Control (10 pts)

- Timelock: 0-4 pts (≥7 days: 4; 2-6 days: 3; 1 day: 2; <1 day: 0)
- Multisig: 0-3 pts (yes: 3; no: 0; unknown: 1)
- Admin cannot drain: 0-3 pts (false: 3; true: 0)

### Factor 5 — Audits (10 pts)

- Number of audits: 0-4 pts (0: 0; 1: 2; 2: 3; 3+: 4)
- Auditor quality: 0-4 pts (top-tier = Trail of Bits, OpenZeppelin, Spearbit, Sigma Prime, ChainSecurity, Zellic, Consensys; mid-tier = Halborn, Peckshield, Certik)
- No unresolved criticals: 0-2 pts (yes: 2; no: 0)

### Factor 6 — Protocol History (10 pts)

- Age: 0-5 pts (<6mo: 0; <1yr: 1; <2yr: 2; <3yr: 3; <4yr: 4; 4yr+: 5)
- Incidents + response: 0-5 pts (no incidents: 5; all resolved, good response ≥7: 4; partial: 2; unresolved: 0)

### Factor 7 — Yield Sustainability (10 pts)

- APY range: 0-5 pts (0-5%: 5; 5-15%: 4; 15-30%: 3; 30-50%: 1; 50%+: 0)
- Has reward tokens (emissions-based): 0-5 pts (no: 5; yes: 2; unknown: 3)
- If no yield data: 5 pts default (neutral)

### Factor 8 — Dependencies (5 pts)

- Oracle risk: 0-2 pts (no oracle: 2; reputable oracle: 1; unknown/custom: 0)
- Bridge risk: 0-2 pts (no bridge: 2; uses bridge: 0)
- External dependency count: 0-1 pts (0-1 deps: 1; 2+: 0)

---

## Hard Caps (override weighted score)

| Condition | Grade Cap | Notes |
|-----------|-----------|-------|
| Honeypot OR unrestricted mint by single EOA | F | Instant fail |
| Admin key can drain with no timelock | max C (≤69) | |
| No audit AND under 6 months old | max D (≤54) | |
| Unresolved critical exploit | F | Instant fail |

Hard caps are shown prominently on the rating page. Multiple caps can apply simultaneously.

---

## Confidence Levels

| Level | Condition |
|-------|-----------|
| High | 7+ of 8 factors have real data |
| Medium | 5-6 factors have real data |
| Low | ≤4 factors have real data |

---

## Grade Scale

| Grade | Score Range | Risk Label |
|-------|-------------|------------|
| A | 85–100 | Low Risk |
| B | 70–84 | Moderate-Low Risk |
| C | 55–69 | Moderate Risk |
| D | 40–54 | High Risk |
| F | <40 | Very High Risk |

---

## Definition of Done Checklist

- [x] Past exploited protocols (Beanstalk, Ronin, Nomad, Radiant) score D or F
- [x] Every rating page shows sources and confidence
- [x] Scoring is deterministic and reproducible
- [x] A new user understands a rating in under 30 seconds (plain-English reasons per factor)
- [x] Hard caps are shown prominently when triggered
- [x] No invented numbers — unknown factors marked explicitly
