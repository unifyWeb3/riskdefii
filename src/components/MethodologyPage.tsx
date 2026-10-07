import { ArrowLeft } from "lucide-react";

interface Props {
  onBack: () => void;
}

const FACTORS = [
  { name: "Smart Contract Security", weight: 25, description: "How long the contracts have been running in production, whether they have a bug bounty program, and any past exploits (resolved or not)." },
  { name: "Liquidity", weight: 15, description: "How much money is locked in the protocol (TVL), how stable that TVL has been over 30 days, and estimated slippage at $10k and $100k trade sizes." },
  { name: "Token Concentration", weight: 15, description: "What percentage of the token supply the top 10 wallets hold, how much the team/insiders/VCs hold, and whether a large unlock is coming soon." },
  { name: "Governance & Admin Control", weight: 10, description: "Whether a multisig is required to make changes, whether there is a timelock (delay) before changes take effect, and whether a DAO vote is required for upgrades." },
  { name: "Audits", weight: 10, description: "How many audits have been done, by which firms (tier-1 vs tier-2 vs others), how recently, and whether any critical findings were left unresolved." },
  { name: "Protocol History", weight: 10, description: "How old the protocol is and how many incidents it has had. If incidents occurred, how well the team responded (transparency, recovery, post-mortems)." },
  { name: "Yield Sustainability", weight: 10, description: "For yield protocols: what fraction of the APY comes from real revenue vs token emissions. Very high APYs backed entirely by token printing are fragile." },
  { name: "Dependencies", weight: 5, description: "Whether the protocol relies on external oracles (and which kind), cross-chain bridges, or other protocols that could fail and take this one down." },
];

const HARD_CAPS = [
  { condition: "Honeypot or unrestricted mint by a single wallet", effect: "Force grade F", reason: "A single address that can print unlimited tokens can drain all value instantly." },
  { condition: "Admin key can upgrade or drain funds with no timelock", effect: "Max grade C (69)", reason: "Users have no warning before a malicious upgrade can steal funds." },
  { condition: "No audit AND under 6 months old", effect: "Max grade D (54)", reason: "Untested code with no professional review is high risk regardless of other factors." },
  { condition: "Any unresolved critical exploit", effect: "Force grade F", reason: "Active exploits mean funds may still be at risk right now." },
];

const SOURCES = [
  { name: "DefiLlama", url: "https://defillama.com", use: "TVL, TVL changes, yield APY breakdown, hack history" },
  { name: "CoinGecko", url: "https://coingecko.com", use: "Token market data, price history" },
  { name: "GoPlus", url: "https://gopluslabs.io", use: "Token security flags (honeypot, mint functions)" },
  { name: "Etherscan", url: "https://etherscan.io", use: "Token holder distribution, contract verification" },
  { name: "Snapshot / Tally", url: "https://snapshot.org", use: "Governance participation" },
  { name: "Curated research", url: "", use: "Audit records, governance setup, incident response scores — manually verified against protocol docs, audit reports, and post-mortems" },
];

const AUDITOR_TIERS = [
  { tier: "Tier 1", firms: "Trail of Bits, OpenZeppelin, Spearbit, ChainSecurity, Decurity, Zellic, Consensys Diligence", pts: "+3 per audit" },
  { tier: "Tier 2", firms: "Sigma Prime, Peckshield, Certik, Quantstamp, Halborn, Sherlock, Slowmist", pts: "+2 per audit" },
  { tier: "Tier 3", firms: "All others", pts: "+1 per audit" },
];

export function MethodologyPage({ onBack }: Props) {
  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-[var(--subtle)] hover:text-[var(--muted)] transition-colors"
      >
        <ArrowLeft size={15} />
        Back
      </button>

      <div>
        <h1 className="text-3xl font-bold display text-[var(--ink)] text-balance">How Ratings Work</h1>
        <p className="mt-3 text-[var(--muted)] text-pretty leading-relaxed">
          Every rating is a deterministic score from 0–100. The score maps to a grade (A through F).
          Each data point is logged with its source and timestamp. We never invent numbers —
          if data is unavailable, we mark it unknown and lower the confidence level.
        </p>
      </div>

      {/* Principles */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold display text-[var(--ink-2)]">Principles</h2>
        <ul className="space-y-2 text-sm text-[var(--muted)] leading-relaxed">
          <li className="flex gap-2"><span className="text-[var(--accent)] shrink-0">→</span> <strong className="text-[var(--ink-2)]">Explainability over cleverness.</strong> Every score traces back to a specific data point.</li>
          <li className="flex gap-2"><span className="text-[var(--accent)] shrink-0">→</span> <strong className="text-[var(--ink-2)]">Honest about uncertainty.</strong> Confidence levels (High / Medium / Low) reflect how complete the data is.</li>
          <li className="flex gap-2"><span className="text-[var(--accent)] shrink-0">→</span> <strong className="text-[var(--ink-2)]">No paid placement.</strong> Rankings are purely score-driven. No protocol can pay to improve their rating.</li>
          <li className="flex gap-2"><span className="text-[var(--accent)] shrink-0">→</span> <strong className="text-[var(--ink-2)]">We don't tell you what to buy.</strong> We describe risk. Your risk tolerance is your own.</li>
        </ul>
      </section>

      {/* Grade thresholds */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold display text-[var(--ink-2)]">Grade Thresholds</h2>
        <div className="rounded-xl border border-white/10 overflow-hidden text-sm">
          {[
            { grade: "A", range: "85–100", color: "text-[#5fb97a]", label: "Low risk — battle-tested, well-audited, strong governance" },
            { grade: "B", range: "70–84", color: "text-[#7ac4a8]", label: "Moderate-low risk — established with some caveats" },
            { grade: "C", range: "55–69", color: "text-[#e8b84d]", label: "Moderate risk — notable gaps in safety profile" },
            { grade: "D", range: "40–54", color: "text-[#e8843a]", label: "High risk — significant red flags" },
            { grade: "F", range: "0–39", color: "text-[#e86d7a]", label: "Very high risk — critical issues or hard cap triggered" },
          ].map((r, i) => (
            <div key={r.grade} className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? "border-t border-white/[0.06]" : ""}`}>
              <span className={`text-xl font-bold display w-6 ${r.color}`}>{r.grade}</span>
              <span className={`mono text-xs w-14 tabular-nums ${r.color}`}>{r.range}</span>
              <span className="text-[var(--muted)]">{r.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Scoring factors */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold display text-[var(--ink-2)]">Scoring Factors (100 points total)</h2>
        <div className="space-y-3">
          {FACTORS.map((f) => (
            <div key={f.name} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--ink-2)] text-sm">{f.name}</span>
                <span className="text-xs font-semibold tabular-nums mono text-[var(--accent)]">{f.weight} pts</span>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Hard caps */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold display text-[var(--ink-2)]">Hard Caps</h2>
        <p className="text-sm text-[var(--muted)]">
          These conditions override the weighted score. They catch scenarios where a single risk is severe enough to override everything else.
        </p>
        <div className="space-y-3">
          {HARD_CAPS.map((c) => (
            <div key={c.condition} className="rounded-xl border border-[#e86d7a]/20 bg-[#e86d7a]/[0.04] p-4 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-[#e86d7a]/90">{c.condition}</span>
                <span className="text-xs font-semibold text-[#e86d7a] shrink-0 whitespace-nowrap">{c.effect}</span>
              </div>
              <p className="text-xs text-[var(--muted)]">{c.reason}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Auditor tiers */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold display text-[var(--ink-2)]">Auditor Tiers</h2>
        <div className="rounded-xl border border-white/10 overflow-hidden text-sm">
          {AUDITOR_TIERS.map((t, i) => (
            <div key={t.tier} className={`flex items-start gap-4 px-4 py-3 ${i > 0 ? "border-t border-white/[0.06]" : ""}`}>
              <span className="font-medium text-[var(--ink-2)] shrink-0 w-12">{t.tier}</span>
              <span className="text-[var(--muted)] flex-1">{t.firms}</span>
              <span className="mono text-xs text-[var(--accent)] shrink-0">{t.pts}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--subtle)]">Tier classification is our judgment based on track record, publication history, and tooling quality. It is not a paid certification.</p>
      </section>

      {/* Data sources */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold display text-[var(--ink-2)]">Data Sources</h2>
        <div className="space-y-2">
          {SOURCES.map((s) => (
            <div key={s.name} className="rounded-lg border border-white/[0.08] px-4 py-3 flex items-start gap-3">
              <span className="font-medium text-[var(--ink-2)] text-sm shrink-0 w-28">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors">{s.name}</a>
                ) : s.name}
              </span>
              <span className="text-xs text-[var(--muted)] leading-relaxed">{s.use}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Known gaps */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold display text-[var(--ink-2)]">Known Limitations</h2>
        <ul className="space-y-2 text-sm text-[var(--muted)] leading-relaxed list-none">
          {[
            "Token unlock schedules are not available via free APIs; we mark this as unknown for most protocols.",
            "Top-10 holder data requires a block explorer API key; we flag it as low-confidence where unavailable.",
            "Slippage estimates for lending/staking protocols are proxied from TVL; actual orderbook data is not used.",
            "Incident response scores are manually assigned based on public post-mortems; they are our opinion.",
            "Data is cached and refreshed on a schedule — it may lag real-time events by up to 12 hours.",
          ].map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[var(--subtle)] shrink-0">•</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Confidence */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold display text-[var(--ink-2)]">Confidence Levels</h2>
        <div className="space-y-2 text-sm">
          {[
            { level: "High", desc: "6 or more of 8 scoring factors had real data from a verified source.", color: "text-[#5fb97a]" },
            { level: "Medium", desc: "4–5 of 8 factors had real data.", color: "text-[#e8b84d]" },
            { level: "Low", desc: "3 or fewer factors had real data; treat the rating with extra caution.", color: "text-[#94a3b8]" },
          ].map((c) => (
            <div key={c.level} className="flex gap-3">
              <span className={`font-medium w-16 shrink-0 ${c.color}`}>{c.level}</span>
              <span className="text-[var(--muted)]">{c.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="pt-4 border-t border-white/[0.08]">
        <p className="text-xs text-[var(--subtle)] leading-relaxed">
          This is informational data, not financial advice. DeFi Risk Ratings does not endorse any protocol or recommend buying or selling any asset. All investments carry risk; always do your own research.
        </p>
      </div>
    </div>
  );
}
