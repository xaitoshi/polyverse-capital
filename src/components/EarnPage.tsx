import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, BarChart3, Calendar, ExternalLink, Loader2, Radar, Target, TrendingDown, TrendingUp } from 'lucide-react';
import {
  EarnBacktestCase,
  EarnBacktestResult,
  EarnLiveCard,
  EarnTradeDecision,
  fetchEarnBacktest,
  fetchEarnLiveCards,
  formatEarningsDate,
  formatHour,
} from '../services/earnEngine';

function scoreColor(score: number): string {
  if (score >= 8) return 'text-blue-400';
  if (score <= 3) return 'text-red-400';
  return 'text-yellow-400';
}

function decisionClasses(decision: EarnTradeDecision): string {
  if (decision === 'BUY YES') return 'border-blue-500/40 bg-blue-500/15 text-blue-400';
  if (decision === 'BUY NO') return 'border-red-500/40 bg-red-500/15 text-red-400';
  return 'border-gray-700 bg-gray-900/50 text-gray-400';
}

function convictionClasses(conviction: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  if (conviction === 'HIGH') return 'text-blue-400';
  if (conviction === 'MEDIUM') return 'text-yellow-400';
  return 'text-gray-500';
}

function formatPct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function formatVol(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}

function MetricCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-2xl border border-blue-500/15 bg-black/50 p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-gray-600">{label}</div>
      <div className="mt-2 text-2xl font-black font-mono text-white">{value}</div>
      {sublabel && <div className="mt-1 text-xs text-gray-500">{sublabel}</div>}
    </div>
  );
}

function LiveSignalCard({ card }: { card: EarnLiveCard }) {
  const { analysis, score } = card;

  return (
    <div className="rounded-2xl border border-blue-500/15 bg-black/45 p-5 transition-colors hover:border-blue-500/35">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            {analysis.logo ? (
              <img src={analysis.logo} alt={analysis.symbol} className="h-11 w-11 rounded-xl border border-gray-800 bg-gray-900 object-contain" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-800 bg-gray-900 font-mono font-bold text-blue-400">
                {analysis.symbol[0]}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-lg font-bold text-white">{analysis.symbol}</span>
                <span className="truncate text-sm text-gray-400">{analysis.name}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-mono text-gray-500">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatEarningsDate(analysis.date)}</span>
                <span>{formatHour(analysis.hour)}</span>
                {analysis.epsEstimate != null && <span>EPS est. ${analysis.epsEstimate.toFixed(2)}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className={`text-4xl font-black font-mono ${scoreColor(score.beatScore10)}`}>{score.beatScore10.toFixed(1)}</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-gray-600">Beat score / 10</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-blue-500/10 bg-black/40 p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Decision</div>
          <div className={`mt-2 inline-flex rounded-md border px-2.5 py-1 font-mono text-sm font-bold ${decisionClasses(score.tradeDecision)}`}>
            {score.tradeDecision}
          </div>
          <div className={`mt-2 text-[11px] font-mono ${convictionClasses(score.conviction)}`}>{score.conviction} conviction</div>
        </div>

        <div className="rounded-xl border border-blue-500/10 bg-black/40 p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Fair YES</div>
          <div className="mt-2 text-xl font-black font-mono text-white">{score.fairYesPct.toFixed(1)}%</div>
          <div className="mt-1 text-[11px] text-gray-500">Model probability</div>
        </div>

        <div className="rounded-xl border border-blue-500/10 bg-black/40 p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Market YES</div>
          <div className="mt-2 text-xl font-black font-mono text-white">
            {score.marketYesPct != null ? `${score.marketYesPct.toFixed(1)}%` : 'N/A'}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">Polymarket price</div>
        </div>

        <div className="rounded-xl border border-blue-500/10 bg-black/40 p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Edge</div>
          <div className={`mt-2 text-xl font-black font-mono ${score.edgePct == null ? 'text-gray-500' : score.edgePct >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {score.edgePct == null ? 'N/A' : formatPct(score.edgePct)}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">Fair value vs market</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {score.factors.map((factor) => (
          <div key={factor.key} className="rounded-xl border border-blue-500/10 bg-black/35 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono text-gray-400">{factor.label}</div>
                <div className="mt-1 text-sm font-mono text-white">{factor.value}</div>
              </div>
              <div className={`text-sm font-bold font-mono ${factor.points == null ? 'text-gray-600' : factor.points > 0 ? 'text-blue-400' : factor.points === 0 ? 'text-gray-500' : 'text-red-400'}`}>
                {factor.points == null ? 'N/A' : `+${factor.points}`.replace('+0', '0')}
              </div>
            </div>
            <div className="mt-2 text-[11px] leading-snug text-gray-600">{factor.description}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-mono text-gray-500">
        <span>Completeness: {score.dataCompletenessPct.toFixed(0)}%</span>
        {analysis.polymarket && (
          <a
            href={`https://polymarket.com/event/${analysis.polymarket.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
          >
            View market <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function BacktestRow({ item }: { item: EarnBacktestCase }) {
  const outcomeColor = item.market.actualOutcome === 'Yes' ? 'text-blue-400' : 'text-red-400';
  const wonColor = item.won == null ? 'text-gray-500' : item.won ? 'text-blue-400' : 'text-red-400';

  return (
    <div className="rounded-2xl border border-blue-500/10 bg-black/40 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-bold text-white">{item.market.symbol}</span>
            <span className="text-sm text-gray-400">{item.companyName || item.market.question}</span>
          </div>
          <div className="mt-1 text-sm text-gray-500">{item.market.question}</div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-mono text-gray-500">
            <span>{new Date(item.market.endDate).toLocaleString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span>Pre-event YES: {item.market.preYesPricePct != null ? `${item.market.preYesPricePct.toFixed(1)}%` : 'N/A'}</span>
            <span>Volume: {formatVol(item.market.volume)}</span>
            <span>History used: {item.historyQuartersUsed}Q</span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[460px]">
          <div className="rounded-xl border border-blue-500/10 bg-black/35 p-3 text-center">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Signal</div>
            <div className={`mt-2 inline-flex rounded-md border px-2 py-1 font-mono text-sm font-bold ${decisionClasses(item.score.tradeDecision)}`}>{item.score.tradeDecision}</div>
          </div>
          <div className="rounded-xl border border-blue-500/10 bg-black/35 p-3 text-center">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Score</div>
            <div className={`mt-2 text-xl font-black font-mono ${scoreColor(item.score.beatScore10)}`}>{item.score.beatScore10.toFixed(1)}</div>
          </div>
          <div className="rounded-xl border border-blue-500/10 bg-black/35 p-3 text-center">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Actual</div>
            <div className={`mt-2 text-xl font-black font-mono ${outcomeColor}`}>{item.market.actualOutcome}</div>
          </div>
          <div className="rounded-xl border border-blue-500/10 bg-black/35 p-3 text-center">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Result</div>
            <div className={`mt-2 text-xl font-black font-mono ${wonColor}`}>{item.won == null ? 'PASS' : item.won ? 'WIN' : 'LOSS'}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-blue-500/10 bg-black/35 p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Fair YES</div>
          <div className="mt-2 text-lg font-black font-mono text-white">{item.score.fairYesPct.toFixed(1)}%</div>
        </div>
        <div className="rounded-xl border border-blue-500/10 bg-black/35 p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Market YES</div>
          <div className="mt-2 text-lg font-black font-mono text-white">{item.score.marketYesPct != null ? `${item.score.marketYesPct.toFixed(1)}%` : 'N/A'}</div>
        </div>
        <div className="rounded-xl border border-blue-500/10 bg-black/35 p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Edge</div>
          <div className={`mt-2 text-lg font-black font-mono ${item.score.edgePct == null ? 'text-gray-500' : item.score.edgePct >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{item.score.edgePct == null ? 'N/A' : formatPct(item.score.edgePct)}</div>
        </div>
        <div className="rounded-xl border border-blue-500/10 bg-black/35 p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Conviction</div>
          <div className={`mt-2 text-lg font-black font-mono ${convictionClasses(item.score.conviction)}`}>{item.score.conviction}</div>
        </div>
      </div>

      {item.notes.length > 0 && (
        <div className="mt-3 text-[11px] leading-relaxed text-gray-500">
          {item.notes.map((note, index) => (
            <div key={index}>• {note}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EarnPage() {
  const [liveCards, setLiveCards] = useState<EarnLiveCard[]>([]);
  const [backtest, setBacktest] = useState<EarnBacktestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | EarnTradeDecision>('ALL');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchEarnLiveCards(14), fetchEarnBacktest(30)])
      .then(([live, bt]) => {
        if (!mounted) return;
        setLiveCards(live);
        setBacktest(bt);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load /earn data');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredCases = useMemo(() => {
    if (!backtest) return [];
    if (decisionFilter === 'ALL') return backtest.cases;
    return backtest.cases.filter(item => item.score.tradeDecision === decisionFilter);
  }, [backtest, decisionFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <div className="flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-black/60 px-5 py-4 text-blue-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-mono text-sm uppercase tracking-[0.3em]">Loading /earn</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(0,102,255,0.12),transparent_45%)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-500/20 bg-black/60 p-4 backdrop-blur-xl">
          <div>
            <a href="/" className="inline-flex items-center gap-2 text-sm font-mono text-gray-400 transition-colors hover:text-blue-400">
              <ArrowLeft className="h-4 w-4" /> Back to Polyverse
            </a>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
                <Radar className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-[0.35em] text-blue-400">Polyverse Capital</div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">/earn</h1>
              </div>
            </div>
          </div>

          <div className="max-w-xl text-sm leading-relaxed text-gray-400">
            A dedicated earnings intelligence page: normalized 0–10 beat score, fair YES probability, buy yes / buy no trade decision, and a resolved-market backtest on recent Polymarket earnings contracts.
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {backtest && (
          <>
            <section className="mt-8">
              <div className="mb-4 flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                <h2 className="text-xl font-bold text-white">Backtest snapshot</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="Past 30D Win Rate" value={backtest.summary.winRatePct != null ? `${backtest.summary.winRatePct.toFixed(1)}%` : 'N/A'} sublabel={`${backtest.summary.wins} wins / ${backtest.summary.losses} losses`} />
                <MetricCard label="Trade Count" value={`${backtest.summary.tradeCount}`} sublabel={`${backtest.summary.passCount} passes`} />
                <MetricCard label="YES Win Rate" value={backtest.summary.yesWinRatePct != null ? `${backtest.summary.yesWinRatePct.toFixed(1)}%` : 'N/A'} sublabel={`${backtest.summary.yesTrades} YES trades`} />
                <MetricCard label="NO Win Rate" value={backtest.summary.noWinRatePct != null ? `${backtest.summary.noWinRatePct.toFixed(1)}%` : 'N/A'} sublabel={`${backtest.summary.noTrades} NO trades`} />
                <MetricCard label="Avg Beat Score" value={backtest.summary.avgScore != null ? backtest.summary.avgScore.toFixed(1) : 'N/A'} sublabel="Across resolved markets" />
                <MetricCard label="Avg Edge" value={backtest.summary.avgEdgePct != null ? formatPct(backtest.summary.avgEdgePct) : 'N/A'} sublabel="Model fair value minus market" />
              </div>
            </section>

            <section className="mt-8 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-blue-500/15 bg-black/45 p-5 lg:col-span-2">
                <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-[0.25em] text-gray-500">
                  <Target className="h-4 w-4 text-blue-400" /> Framework rules
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-blue-500/10 bg-black/30 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Buy YES</div>
                    <div className="mt-2 text-lg font-black font-mono text-blue-400">Score ≥ 8.0</div>
                    <div className="mt-1 text-sm text-gray-500">and edge ≥ +7 pts</div>
                  </div>
                  <div className="rounded-xl border border-blue-500/10 bg-black/30 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Pass</div>
                    <div className="mt-2 text-lg font-black font-mono text-yellow-400">4.0–7.9</div>
                    <div className="mt-1 text-sm text-gray-500">or no pricing edge</div>
                  </div>
                  <div className="rounded-xl border border-blue-500/10 bg-black/30 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-600">Buy NO</div>
                    <div className="mt-2 text-lg font-black font-mono text-red-400">Score ≤ 3.0</div>
                    <div className="mt-1 text-sm text-gray-500">and edge ≤ -7 pts</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-500/15 bg-black/45 p-5">
                <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-[0.25em] text-gray-500">
                  <Activity className="h-4 w-4 text-blue-400" /> Methodology notes
                </div>
                <div className="mt-4 space-y-2 text-sm leading-relaxed text-gray-400">
                  <p>Backtest universe = recent resolved Polymarket earnings markets discovered from the Polymarket earnings feed and market metadata.</p>
                  <p>Model uses pre-resolution market YES price from Polymarket price history and excludes the target quarter from historical EPS inputs to reduce look-ahead bias.</p>
                  <p>Current backtest is intentionally conservative: historical-quarter features are strongest, while richer fundamentals are fully used in live forward signals.</p>
                </div>
              </div>
            </section>
          </>
        )}

        <section className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Live earnings board</h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {liveCards.map(card => <LiveSignalCard key={card.analysis.symbol} card={card} />)}
          </div>
          {liveCards.length === 0 && (
            <div className="rounded-2xl border border-blue-500/10 bg-black/40 p-6 text-center text-sm text-gray-500">
              No active Polymarket earnings markets matched the upcoming calendar right now.
            </div>
          )}
        </section>

        {backtest && (
          <section className="mt-10 pb-12">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-5 w-5 text-blue-400" />
                <h2 className="text-xl font-bold text-white">Resolved market backtest</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-500/15 bg-black/45 p-1">
                {(['ALL', 'BUY YES', 'BUY NO', 'PASS'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setDecisionFilter(filter)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-mono transition-colors ${decisionFilter === filter ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-blue-300'}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {filteredCases.map(item => <BacktestRow key={item.market.conditionId} item={item} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
