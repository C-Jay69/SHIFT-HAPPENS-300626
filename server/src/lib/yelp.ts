import { openrouterChat } from './openrouter.js';

/**
 * Yelp Fusion — review pull + sentiment engine (Review/Sentiment tier).
 *
 * Env: YELP_API_KEY.
 * Pipeline: search the business by restaurant name/location → fetch reviews
 * → per-review sentiment (local lexicon + star weighting, no external call)
 * → optional LLM summary and response drafts when OPENROUTER_API_KEY is set.
 */

const YELP_KEY = process.env.YELP_API_KEY ?? '';
const API = 'https://api.yelp.com/v3';

export const yelpConfigured = () => YELP_KEY.length > 0;

interface YelpReview {
  id: string;
  author_name: string;
  stars: number;
  text: string;
  date: string;
}

export interface AnalyzedReview extends YelpReview {
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number; // -1..1
  draftResponse?: string;
}

export interface ReviewReport {
  business: { id: string; name: string; location?: string; review_count?: number; stars?: number };
  reviews: AnalyzedReview[];
  summary: {
    count: number;
    avgStars: number;
    breakdown: { positive: number; neutral: number; negative: number };
    topThemes: { term: string; mentions: number; leaning: 'positive' | 'negative' }[];
    llmSummary?: string;
  };
}

async function yelpFetch(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${YELP_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Yelp API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

export async function searchBusiness(term: string, location?: string): Promise<{ id: string; name: string; location?: string; review_count?: number; stars?: number }> {
  const params = new URLSearchParams({ term, limit: '1' });
  if (location) params.set('location', location);
  const data = await yelpFetch(`/businesses/search?${params.toString()}`);
  const first = ((data.businesses ?? []) as unknown[])[0] as
    | { id: string; name: string; location?: { display_address?: string[] }; review_count?: number; stars?: number }
    | undefined;
  if (!first) throw new Error(`Yelp found no business matching "${term}"${location ? ` near ${location}` : ''}`);
  return {
    id: first.id,
    name: first.name,
    location: first.location?.display_address?.join(', '),
    review_count: first.review_count,
    stars: first.stars,
  };
}

export async function getReviews(businessId: string, limit = 50): Promise<YelpReview[]> {
  const data = await yelpFetch(`/businesses/${encodeURIComponent(businessId)}/reviews?limit=${Math.min(limit, 50)}`);
  return ((data.reviews ?? []) as YelpReview[]).map((r) => ({
    id: r.id,
    author_name: r.author_name,
    stars: r.stars,
    text: r.text,
    date: r.date,
  }));
}

// --- Local sentiment (no external dependency) --------------------------------

const POSITIVE_WORDS = [
  'great', 'amazing', 'excellent', 'delicious', 'wonderful', 'fantastic', 'love',
  'loved', 'best', 'fresh', 'friendly', 'fast', 'perfect', 'outstanding', 'incredible',
  'recommend', 'tasty', 'cozy', 'beautiful', 'generous', 'impeccable', 'favorite',
  'highlight', 'gourmet', 'flawless', 'heavenly', 'superb',
];
const NEGATIVE_WORDS = [
  'terrible', 'awful', 'disgusting', 'worst', 'cold', 'rude', 'slow', 'overpriced',
  'burnt', 'soggy', 'disappointed', 'disappointing', 'never', 'bland', 'gross',
  'dirty', 'unacceptable', 'pathetic', 'mediocre', 'horrible', 'foul', 'stale',
  'undercooked', 'overcooked', 'rude', 'waited', 'wait', 'bland', 'bland',
];

function lexiconScore(text: string): number {
  const words = text.toLowerCase().replace(/[^a-z'\s]/g, ' ').split(/\s+/);
  let score = 0;
  for (const w of words) {
    if (POSITIVE_WORDS.includes(w)) score += 1;
    if (NEGATIVE_WORDS.includes(w)) score -= 1;
  }
  const norm = Math.max(-1, Math.min(1, score / Math.max(3, Math.sqrt(words.length))));
  return norm;
}

export function analyzeReview(review: YelpReview): { sentiment: 'positive' | 'neutral' | 'negative'; score: number } {
  const lex = lexiconScore(review.text);
  // Star anchor: Yelp stars are the strongest signal available.
  const starScore = (review.stars - 3) / 2; // 5★→+1, 1★→-1
  const score = Math.max(-1, Math.min(1, 0.6 * starScore + 0.4 * lex));
  const sentiment = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral';
  return { sentiment, score: Math.round(score * 100) / 100 };
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'was', 'were', 'this', 'that', 'they', 'them',
  'have', 'has', 'had', 'not', 'but', 'you', 'your', 'our', 'very', 'really',
  'just', 'about', 'would', 'could', 'there', 'their', 'when', 'what', 'from',
  'them', 'then', 'than', 'them', 'its', 'into', 'more', 'most', 'some', 'such',
  'only', 'over', 'also', 'like', 'one', 'two', 'back', 'even', 'well', 'much',
]);

function topThemes(reviews: AnalyzedReview[]): ReviewReport['summary']['topThemes'] {
  const counts = new Map<string, { pos: number; neg: number }>();
  for (const r of reviews) {
    const words = r.text.toLowerCase().replace(/[^a-z'\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOPWORDS.has(w));
    for (const w of new Set(words)) {
      const c = counts.get(w) ?? { pos: 0, neg: 0 };
      if (r.sentiment === 'positive') c.pos += 1;
      if (r.sentiment === 'negative') c.neg += 1;
      counts.set(w, c);
    }
  }
  return [...counts.entries()]
    .map(([term, { pos, neg }]) => ({
      term,
      mentions: pos + neg,
      leaning: (neg > pos ? 'negative' : 'positive') as 'positive' | 'negative',
    }))
    .filter((t) => t.mentions >= 2)
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 8);
}

function templateResponse(r: AnalyzedReview): string {
  if (r.sentiment === 'negative') {
    return `Hi ${r.author_name.split(' ')[0]}, thank you for the honest feedback. I'm sorry we missed the mark on your recent visit — please reach out to our manager at the front of house and we'll make it right. We'd love another chance.`;
  }
  if (r.sentiment === 'positive') {
    return `Hi ${r.author_name.split(' ')[0]}, thank you so much! Reviews like yours make our day. We look forward to hosting you again soon.`;
  }
  return `Hi ${r.author_name.split(' ')[0]}, thanks for taking the time to share your experience. We'd love to hear more — please stop by and chat with our team next time you visit.`;
}

/** Full pipeline: find the business, pull reviews, analyze, summarize. */
export async function buildReviewReport(name: string, location?: string, limit = 30): Promise<ReviewReport> {
  const business = await searchBusiness(name, location);
  const raw = await getReviews(business.id, limit);
  const reviews: AnalyzedReview[] = raw.map((r) => {
    const { sentiment, score } = analyzeReview(r);
    return { ...r, sentiment, score, draftResponse: templateResponse({ ...r, sentiment, score }) };
  });

  const breakdown = { positive: 0, neutral: 0, negative: 0 };
  for (const r of reviews) breakdown[r.sentiment] += 1;

  const summary: ReviewReport['summary'] = {
    count: reviews.length,
    avgStars: reviews.length ? Math.round((reviews.reduce((s, r) => s + r.stars, 0) / reviews.length) * 10) / 10 : 0,
    breakdown,
    topThemes: topThemes(reviews),
  };

  // Optional LLM layer: executive summary + polished drafts for the negatives.
  const digest = reviews
    .slice(0, 12)
    .map((r) => `[${r.stars}★ ${r.sentiment}] ${r.text.slice(0, 200)}`)
    .join('\n');
  const llmSummary = await openrouterChat(
    `You are the owner of a restaurant reviewing customer feedback. Summarize these recent reviews in 3-4 sentences: overall trend, what guests love, what needs fixing, and one concrete action. Be specific and concise.\n\n${digest}`,
  );
  if (llmSummary) summary.llmSummary = llmSummary;

  return { business, reviews, summary };
}
