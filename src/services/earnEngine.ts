import {
  ProAnalysis,
  UpcomingEarning,
  fetchCompanyProfile,
  fetchEarningsHistory,
  fetchProAnalysisList,
  fetchUpcomingEarnings,
  getPolymarketEarningsTickers,
} from './earningsService';

const POLYMARKET_API = '/api/polymarket';
const CLOB_API = '/api/clob';

export type EarnTradeDecision = 'BUY YES' | 'BUY NO' | 'PASS';
export type EarnOutcome = 'Yes' | 'No' | 'Unresolved';

export interface EarnScoreFactor {
  key: string;
  label: string;
  value: string;
  points: number | null;
  maxPoints: number;
  description: string;
}

export interface EarnScoreResult {
  beatScore10: number;
  fairYesPct: number;
  marketYesPct: number | null;
  edgePct: number | null;
  tradeDecision: EarnTradeDecision;
  conviction: 'LOW' | 'MEDIUM' | 'HIGH';
  earnedPoints: number;
  availablePoints: number;
  dataCompletenessPct: number;
  factors: EarnScoreFactor[];
}

export interface EarnLiveCard {
  analysis: ProAnalysis;
  score: EarnScoreResult;
}

export interface ResolvedEarningsMarket {
  symbol: string;
  slug: string;
  question: string;
  conditionId: string;
  endDate: string;
  createdAt: string;
  description: string;
  volume: number;
  liquidity: number;
  actualOutcome: EarnOutcome;
  preYesPricePct: number | null;
}

export interface EarnBacktestCase {
  market: ResolvedEarningsMarket;
  score: EarnScoreResult;
  won: boolean | null;
  historyQuartersUsed: number;
  notes: string[];
  companyName?: string;
}

export interface EarnBacktestSummary {
  days: number;
  totalMarkets: number;
  resolvedMarkets: number;
  tradeCount: number;
  passCount: number;
  wins: number;
  losses: number;
  winRatePct: number | null;
  yesTrades: number;
  yesWins: number;
  yesWinRatePct: number | null;
  noTrades: number;
  noWins: number;
  noWinRatePct: number | null;
  avgScore: number | null;
  avgEdgePct: number | null;
}

export interface EarnBacktestResult {
  summary: EarnBacktestSummary;
  cases: EarnBacktestCase[];
}

interface EarnScoreInput {
  beatRate: number;
  recentBeats: number;
  recentCount: number;
  avgSurprisePct: number;
  revenueGrowthTTM?: number | null;
  estimateDispersionPct?: number | null;
  analystBuyPct?: number | null;
  priceTargetUpside?: number | null;
  insiderNetValue?: number | null;
  sector30dReturnPct?: number | null;
  atmIV?: number | null;
  putSkew?: number | null;
  marketYesPct?: number | null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatPct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function formatMoneyK(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${(Math.abs(value) / 1000).toFixed(0)}K`;
}

function buildFactor(
  key: string,
  label: string,
  value: string,
  points: number | null,
  maxPoints: number,
  description: string,
): EarnScoreFactor {
  return { key, label, value, points, maxPoints, description };
}

export function computeEarnScore(input: EarnScoreInput): EarnScoreResult {
  const factors: EarnScoreFactor[] = [];

  const beatRatePoints = input.beatRate >= 75 ? 2 : input.beatRate >= 50 ? 1 : 0;
  factors.push(buildFactor(
    'beat-rate',
    'Beat Rate',
    `${input.beatRate.toFixed(0)}%`,
    beatRatePoints,
    2,
    'How often the company beat EPS in prior quarters.',
  ));

  const recentTrendPoints = input.recentCount >= 3
    ? (input.recentBeats >= 3 ? 1 : input.recentBeats >= 2 ? 0.5 : 0)
    : null;
  factors.push(buildFactor(
    'recent-trend',
    'Recent Trend',
    `${input.recentBeats}/${input.recentCount} beats`,
    recentTrendPoints,
    1,
    'Last four reported quarters, excluding the target quarter in backtests.',
  ));

  const avgSurprisePoints = input.avgSurprisePct > 5 ? 1 : input.avgSurprisePct >= 0 ? 0.5 : 0;
  factors.push(buildFactor(
    'avg-surprise',
    'Avg Surprise',
    formatPct(input.avgSurprisePct),
    avgSurprisePoints,
    1,
    'Average EPS surprise versus consensus.',
  ));

  const revenuePoints = input.revenueGrowthTTM == null
    ? null
    : input.revenueGrowthTTM >= 10 ? 1 : input.revenueGrowthTTM >= 0 ? 0.5 : 0;
  factors.push(buildFactor(
    'revenue-growth',
    'Revenue Growth',
    formatPct(input.revenueGrowthTTM),
    revenuePoints,
    1,
    'Top-line trend helps confirm whether EPS quality is supported by the business.',
  ));

  const dispersionPoints = input.estimateDispersionPct == null
    ? null
    : input.estimateDispersionPct < 10 ? 0.5 : input.estimateDispersionPct < 25 ? 0.25 : 0;
  factors.push(buildFactor(
    'estimate-dispersion',
    'Est. Dispersion',
    formatPct(input.estimateDispersionPct, 0),
    dispersionPoints,
    0.5,
    'Tighter analyst estimates imply cleaner consensus and less earnings uncertainty.',
  ));

  const analystPoints = input.analystBuyPct == null
    ? null
    : input.analystBuyPct >= 60 ? 0.5 : input.analystBuyPct >= 40 ? 0.25 : 0;
  factors.push(buildFactor(
    'analyst-buys',
    'Analyst Buys',
    input.analystBuyPct == null ? 'N/A' : `${input.analystBuyPct.toFixed(0)}%`,
    analystPoints,
    0.5,
    'Low weight signal from analyst recommendations.',
  ));

  const ptPoints = input.priceTargetUpside == null
    ? null
    : input.priceTargetUpside >= 15 ? 0.5 : input.priceTargetUpside >= 0 ? 0.25 : 0;
  factors.push(buildFactor(
    'pt-upside',
    'PT Upside',
    formatPct(input.priceTargetUpside),
    ptPoints,
    0.5,
    'Low weight support from analyst price targets.',
  ));

  const insiderPoints = input.insiderNetValue == null
    ? null
    : input.insiderNetValue >= 100_000 ? 0.5 : input.insiderNetValue >= -100_000 ? 0.25 : 0;
  factors.push(buildFactor(
    'insider-activity',
    'Insider Activity',
    formatMoneyK(input.insiderNetValue),
    insiderPoints,
    0.5,
    'Net insider buying over the last 90 days.',
  ));

  const sectorPoints = input.sector30dReturnPct == null
    ? null
    : input.sector30dReturnPct >= 5 ? 1 : input.sector30dReturnPct >= 0 ? 0.5 : 0;
  factors.push(buildFactor(
    'sector-momentum',
    'Sector Momentum',
    formatPct(input.sector30dReturnPct),
    sectorPoints,
    1,
    'Positive sector tape can help beat odds and post-print reaction quality.',
  ));

  const ivPoints = input.atmIV == null
    ? null
    : input.atmIV < 35 ? 0.5 : input.atmIV < 55 ? 0.25 : 0;
  factors.push(buildFactor(
    'options-iv',
    'Options IV',
    input.atmIV == null ? 'N/A' : `${input.atmIV.toFixed(0)}%`,
    ivPoints,
    0.5,
    'Lower event IV usually means less stress priced into the print.',
  ));

  const skewPoints = input.putSkew == null
    ? null
    : input.putSkew < 0 ? 0.5 : input.putSkew < 4 ? 0.25 : 0;
  factors.push(buildFactor(
    'put-skew',
    'Put Skew',
    formatPct(input.putSkew),
    skewPoints,
    0.5,
    'Positive put skew indicates downside hedging demand ahead of earnings.',
  ));

  const availableFactors = factors.filter(f => f.points != null);
  const earnedPoints = availableFactors.reduce((sum, factor) => sum + (factor.points ?? 0), 0);
  const availablePoints = availableFactors.reduce((sum, factor) => sum + factor.maxPoints, 0);
  const totalPossiblePoints = factors.reduce((sum, factor) => sum + factor.maxPoints, 0);

  const beatScore10 = availablePoints > 0 ? round1((earnedPoints / availablePoints) * 10) : 0;
  const fairYesPct = round1(clamp(15 + beatScore10 * 7, 1, 99));
  const marketYesPct = input.marketYesPct ?? null;
  const edgePct = marketYesPct == null ? null : round1(fairYesPct - marketYesPct);

  let tradeDecision: EarnTradeDecision = 'PASS';
  if (edgePct != null) {
    if (beatScore10 >= 8 && edgePct >= 7) tradeDecision = 'BUY YES';
    else if (beatScore10 <= 3 && edgePct <= -7) tradeDecision = 'BUY NO';
  } else {
    if (beatScore10 >= 8) tradeDecision = 'BUY YES';
    else if (beatScore10 <= 3) tradeDecision = 'BUY NO';
  }

  const conviction = edgePct == null
    ? (beatScore10 >= 8 || beatScore10 <= 3 ? 'MEDIUM' : 'LOW')
    : Math.abs(edgePct) >= 15 ? 'HIGH' : Math.abs(edgePct) >= 10 ? 'MEDIUM' : 'LOW';

  return {
    beatScore10,
    fairYesPct,
    marketYesPct,
    edgePct,
    tradeDecision,
    conviction,
    earnedPoints: round1(earnedPoints),
    availablePoints: round1(availablePoints),
    dataCompletenessPct: round1((availablePoints / totalPossiblePoints) * 100),
    factors,
  };
}

export function computeEarnScoreFromProAnalysis(analysis: ProAnalysis): EarnScoreResult {
  const recentBeats = analysis.recentTrend.filter(item => item === 'beat').length;
  return computeEarnScore({
    beatRate: analysis.beatRate,
    recentBeats,
    recentCount: analysis.recentTrend.length,
    avgSurprisePct: analysis.avgSurprisePct,
    revenueGrowthTTM: analysis.revenueGrowthTTM,
    estimateDispersionPct: analysis.estimateDispersionPct,
    analystBuyPct: analysis.analystBuyPct,
    priceTargetUpside: analysis.priceTargetUpside,
    insiderNetValue: analysis.insiderNetValue,
    sector30dReturnPct: analysis.sectorReturns?.d30 ?? null,
    atmIV: analysis.optionsIV?.atmIV ?? null,
    putSkew: analysis.optionsIV?.putSkew ?? null,
    marketYesPct: analysis.polymarket?.yesPct ?? null,
  });
}

export async function fetchEarnLiveCards(limit = 12): Promise<EarnLiveCard[]> {
  const [upcoming, polyTickers] = await Promise.all([
    fetchUpcomingEarnings(),
    getPolymarketEarningsTickers(),
  ]);

  const polymarketSet = new Set(polyTickers);
  const filtered = upcoming
    .filter(item => polymarketSet.has(item.symbol))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);

  if (filtered.length === 0) return [];

  const calendarMap = new Map(filtered.map(item => [item.symbol, item]));
  const analyses = await fetchProAnalysisList(filtered.map(item => item.symbol), calendarMap);

  return analyses
    .map(analysis => ({ analysis, score: computeEarnScoreFromProAnalysis(analysis) }))
    .sort((a, b) => {
      if (a.score.tradeDecision !== b.score.tradeDecision) {
        const rank = (decision: EarnTradeDecision) => decision === 'BUY YES' ? 0 : decision === 'BUY NO' ? 1 : 2;
        return rank(a.score.tradeDecision) - rank(b.score.tradeDecision);
      }
      return b.score.beatScore10 - a.score.beatScore10;
    });
}

function looksLikeEarningsMarket(market: any): boolean {
  const question = String(market?.question ?? '').toLowerCase();
  const slug = String(market?.slug ?? '').toLowerCase();
  const description = String(market?.description ?? '').toLowerCase();
  return (
    (question.includes('beat quarterly earnings') || slug.includes('quarterly-earnings')) &&
    (description.includes('gaap eps') || description.includes('earnings'))
  );
}

function extractTicker(market: any): string | null {
  const question = String(market?.question ?? '');
  const slug = String(market?.slug ?? '');
  const questionMatch = question.match(/\(([A-Z]{1,6})\)/);
  if (questionMatch) return questionMatch[1];

  const slugStart = slug.split('-quarterly-earnings')[0]?.replace(/-/g, '').toUpperCase();
  if (slugStart && /^[A-Z]{1,6}$/.test(slugStart)) return slugStart;

  const slugMatch = slug.match(/-([a-z]{1,6})-beat-quarterly-earnings/i);
  if (slugMatch) return slugMatch[1].toUpperCase();

  return null;
}

async function fetchRecentResolvedEarningsMarkets(days = 30): Promise<ResolvedEarningsMarket[]> {
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const results = new Map<string, ResolvedEarningsMarket>();
  const pageSize = 200;

  for (let page = 0; page < 12; page += 1) {
    const offset = page * pageSize;
    const res = await fetch(`${POLYMARKET_API}/markets?order=createdAt&ascending=false&limit=${pageSize}&offset=${offset}`);
    if (!res.ok) break;

    const markets: any[] = await res.json();
    if (!Array.isArray(markets) || markets.length === 0) break;

    let oldestCreatedAt = Number.POSITIVE_INFINITY;

    for (const market of markets) {
      const createdAt = Date.parse(String(market?.createdAt ?? market?.updatedAt ?? ''));
      if (Number.isFinite(createdAt)) oldestCreatedAt = Math.min(oldestCreatedAt, createdAt);

      if (!looksLikeEarningsMarket(market)) continue;

      const endDate = Date.parse(String(market?.endDate ?? ''));
      if (!Number.isFinite(endDate) || endDate < cutoff || endDate > now) continue;

      const symbol = extractTicker(market);
      if (!symbol) continue;

      const conditionId = String(market?.conditionId ?? '');
      if (!conditionId) continue;

      results.set(conditionId, {
        symbol,
        slug: String(market.slug),
        question: String(market.question),
        conditionId,
        endDate: String(market.endDate),
        createdAt: String(market.createdAt ?? ''),
        description: String(market.description ?? ''),
        volume: Number(market.volume ?? 0),
        liquidity: Number(market.liquidity ?? 0),
        actualOutcome: 'Unresolved',
        preYesPricePct: null,
      });
    }

    if (oldestCreatedAt < cutoff - 14 * 24 * 60 * 60 * 1000 && results.size > 0) break;
  }

  const enriched = await Promise.all(
    [...results.values()].map(async (market) => {
      try {
        const clobRes = await fetch(`${CLOB_API}/markets/${market.conditionId}`);
        if (!clobRes.ok) return market;
        const clob = await clobRes.json();
        const tokens: any[] = Array.isArray(clob?.tokens) ? clob.tokens : [];
        const yesToken = tokens.find(token => String(token?.outcome).toLowerCase() === 'yes');
        const winner = tokens.find(token => token?.winner === true || Number(token?.price) >= 0.99);
        const actualOutcome: EarnOutcome = winner?.outcome === 'Yes' || winner?.outcome === 'No'
          ? winner.outcome
          : 'Unresolved';

        let preYesPricePct: number | null = null;
        if (yesToken?.token_id) {
          const historyRes = await fetch(`${CLOB_API}/prices-history?market=${yesToken.token_id}&interval=1h&fidelity=500`);
          if (historyRes.ok) {
            const historyJson = await historyRes.json();
            const history = Array.isArray(historyJson?.history) ? historyJson.history : [];
            if (history.length > 0) {
              const tradable = history.filter((point: any) => Number(point?.p) > 0.01 && Number(point?.p) < 0.99);
              const selected = tradable.length > 0 ? tradable[tradable.length - 1] : history[Math.max(0, history.length - 2)] ?? history[0];
              if (selected?.p != null) preYesPricePct = round1(Number(selected.p) * 100);
            }
          }
        }

        return { ...market, actualOutcome, preYesPricePct };
      } catch {
        return market;
      }
    }),
  );

  return enriched
    .filter(item => item.actualOutcome !== 'Unresolved')
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
}

function buildBacktestScore(history: Awaited<ReturnType<typeof fetchEarningsHistory>>, marketYesPct: number | null): { score: EarnScoreResult; historyQuartersUsed: number; notes: string[] } {
  const notes: string[] = [];
  const safeHistory = history.length > 1 ? history.slice(1) : [];
  if (history.length > 0) {
    notes.push('Backtest excludes the most recent reported quarter to reduce look-ahead bias.');
  }
  if (safeHistory.length === 0) {
    notes.push('Insufficient prior earnings history — model uses limited information.');
  }

  const beatCount = safeHistory.filter(q => q.surprise > 0.005).length;
  const beatRate = safeHistory.length > 0 ? (beatCount / safeHistory.length) * 100 : 0;
  const recent = safeHistory.slice(0, 4);
  const recentBeats = recent.filter(q => q.surprise > 0.005).length;
  const avgSurprisePct = safeHistory.length > 0
    ? safeHistory.reduce((sum, quarter) => sum + quarter.surprisePct, 0) / safeHistory.length
    : 0;

  const score = computeEarnScore({
    beatRate,
    recentBeats,
    recentCount: recent.length,
    avgSurprisePct,
    marketYesPct,
  });

  return { score, historyQuartersUsed: safeHistory.length, notes };
}

export async function fetchEarnBacktest(days = 30): Promise<EarnBacktestResult> {
  const resolvedMarkets = await fetchRecentResolvedEarningsMarkets(days);

  const cases = await Promise.all(
    resolvedMarkets.map(async (market) => {
      const [profile, history] = await Promise.all([
        fetchCompanyProfile(market.symbol),
        fetchEarningsHistory(market.symbol),
      ]);

      const { score, historyQuartersUsed, notes } = buildBacktestScore(history, market.preYesPricePct);
      const won = score.tradeDecision === 'BUY YES'
        ? market.actualOutcome === 'Yes'
        : score.tradeDecision === 'BUY NO'
          ? market.actualOutcome === 'No'
          : null;

      return {
        market,
        score,
        won,
        historyQuartersUsed,
        notes,
        companyName: profile.name,
      } satisfies EarnBacktestCase;
    }),
  );

  const tradeCases = cases.filter(item => item.score.tradeDecision !== 'PASS' && item.won != null);
  const yesCases = tradeCases.filter(item => item.score.tradeDecision === 'BUY YES');
  const noCases = tradeCases.filter(item => item.score.tradeDecision === 'BUY NO');

  const wins = tradeCases.filter(item => item.won).length;
  const losses = tradeCases.filter(item => item.won === false).length;
  const avgScore = cases.length > 0 ? round1(cases.reduce((sum, item) => sum + item.score.beatScore10, 0) / cases.length) : null;
  const edges = tradeCases.map(item => item.score.edgePct).filter((value): value is number => value != null);
  const avgEdgePct = edges.length > 0 ? round1(edges.reduce((sum, value) => sum + value, 0) / edges.length) : null;

  const summary: EarnBacktestSummary = {
    days,
    totalMarkets: resolvedMarkets.length,
    resolvedMarkets: resolvedMarkets.length,
    tradeCount: tradeCases.length,
    passCount: cases.length - tradeCases.length,
    wins,
    losses,
    winRatePct: tradeCases.length > 0 ? round1((wins / tradeCases.length) * 100) : null,
    yesTrades: yesCases.length,
    yesWins: yesCases.filter(item => item.won).length,
    yesWinRatePct: yesCases.length > 0 ? round1((yesCases.filter(item => item.won).length / yesCases.length) * 100) : null,
    noTrades: noCases.length,
    noWins: noCases.filter(item => item.won).length,
    noWinRatePct: noCases.length > 0 ? round1((noCases.filter(item => item.won).length / noCases.length) * 100) : null,
    avgScore,
    avgEdgePct,
  };

  return {
    summary,
    cases: cases.sort((a, b) => b.market.endDate.localeCompare(a.market.endDate)),
  };
}

export function formatEarningsDate(date: string): string {
  if (!date) return 'Date TBD';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatHour(hour: UpcomingEarning['hour'] | string): string {
  switch (hour) {
    case 'bmo': return 'Before Open';
    case 'amc': return 'After Close';
    case 'dmh': return 'During Market';
    default: return 'Time TBD';
  }
}
