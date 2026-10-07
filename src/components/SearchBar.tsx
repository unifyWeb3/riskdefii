import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { searchProtocols } from "../api";
import type { SearchResult } from "../types";

interface Props {
  onSelect: (id: string, name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

// debounce utility — stable function reference
function makeDebouncedSearch(
  setResults: (r: SearchResult[]) => void,
  setOpen: (v: boolean) => void,
  setLoading: (v: boolean) => void,
  ms: number
) {
  let tid: ReturnType<typeof setTimeout>;
  return (q: string) => {
    clearTimeout(tid);
    tid = setTimeout(() => {
      if (!q || q.length < 2) { setResults([]); setOpen(false); return; }
      setLoading(true);
      searchProtocols(q)
        .then((r) => { setResults(r); setOpen(r.length > 0); })
        .catch(() => { setResults([]); })
        .finally(() => setLoading(false));
    }, ms);
  };
}

export function SearchBar({ onSelect, placeholder = "Search any DeFi protocol or token…", autoFocus = false }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchFnRef = useRef<((q: string) => void) | null>(null);

  useEffect(() => {
    searchFnRef.current = makeDebouncedSearch(setResults, setOpen, setLoading, 300);
  }, []);

  useEffect(() => {
    searchFnRef.current?.(query);
  }, [query]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function handleSelect(r: SearchResult) {
    setQuery(r.name);
    setOpen(false);
    setResults([]);
    onSelect(r.id, r.name);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    if (e.key === "Enter" && activeIdx >= 0) { handleSelect(results[activeIdx]); }
    if (e.key === "Escape") { setOpen(false); }
  }

  function formatTvl(tvl?: number): string {
    if (!tvl) return "";
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B TVL`;
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(0)}M TVL`;
    return `$${(tvl / 1e3).toFixed(0)}K TVL`;
  }

  return (
    <div className="relative w-full" role="combobox" aria-expanded={open}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 focus-within:border-[var(--accent)]/50 focus-within:bg-white/[0.09] transition-all">
        {loading ? (
          <Loader2 size={18} className="text-[var(--subtle)] shrink-0 animate-spin" />
        ) : (
          <Search size={18} className="text-[var(--subtle)] shrink-0" />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(-1); }}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[var(--ink)] placeholder:text-[var(--subtle)] text-sm"
          aria-label="Search protocols"
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false); inputRef.current?.focus(); }}
            className="text-[var(--subtle)] hover:text-[var(--ink)] transition-colors"
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 w-full rounded-xl border border-white/10 bg-[#1a2d45]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50"
            role="listbox"
          >
            {results.map((r, i) => (
              <button
                key={r.id}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={() => handleSelect(r)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                  i === activeIdx ? "bg-white/10" : "hover:bg-white/[0.05]"
                } ${i > 0 ? "border-t border-white/[0.06]" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    r.isRated ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "bg-white/10 text-[var(--subtle)]"
                  }`}>
                    {r.isRated ? "Rated" : r.category}
                  </span>
                  <span className="font-medium text-[var(--ink)] truncate">{r.name}</span>
                </div>
                {r.tvlUSD && (
                  <span className="text-xs text-[var(--subtle)] shrink-0 ml-2 tabular-nums">{formatTvl(r.tvlUSD)}</span>
                )}
              </button>
            ))}
            {results.every((r) => !r.isRated) && (
              <div className="px-4 py-2 border-t border-white/[0.06]">
                <p className="text-xs text-[var(--subtle)]">Detailed ratings are available for our curated list. On-demand ratings coming soon.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
