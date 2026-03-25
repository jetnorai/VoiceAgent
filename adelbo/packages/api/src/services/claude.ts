import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-6';

export interface AIResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cacheHit: boolean;
}

// ─── Surface 1: Intent Search Copilot ─────────────────────────────────────────

export async function intentSearchCopilot(params: {
  query: string;
  checkin: string;
  checkout: string;
  adults: number;
  budget?: number;
  currency?: string;
}): Promise<{
  structuredQuery: {
    destination: string;
    amenities: string[];
    mood: string;
    maxPricePerNight?: number;
    cancellationPreference: 'flexible' | 'any';
    recommendedFilters: string[];
  };
  categories: {
    bestForWork: string[];
    bestVibeMatch: string[];
    bestValue: string[];
    bestFlexibility: string[];
  };
  summary: string;
}> {
  const start = Date.now();
  const nights = Math.round(
    (new Date(params.checkout).getTime() - new Date(params.checkin).getTime()) / 86400000
  );

  const prompt = `You are Adelbo's search assistant helping a traveler find the perfect hotel. Convert their natural language query into structured search criteria.

Query: "${params.query}"
Dates: ${params.checkin} to ${params.checkout} (${nights} nights)
Guests: ${params.adults}
Budget: ${params.budget ? `${params.currency || 'USD'} ${params.budget}/night max` : 'Not specified'}

Extract and return a JSON object with exactly this structure:
{
  "structuredQuery": {
    "destination": "city/country/region name",
    "amenities": ["array", "of", "key", "amenities"],
    "mood": "brief vibe descriptor",
    "maxPricePerNight": null or number,
    "cancellationPreference": "flexible" or "any",
    "recommendedFilters": ["useful", "filter", "suggestions"]
  },
  "categories": {
    "bestForWork": ["criteria1", "criteria2"],
    "bestVibeMatch": ["criteria1", "criteria2"],
    "bestValue": ["criteria1", "criteria2"],
    "bestFlexibility": ["criteria1", "criteria2"]
  },
  "summary": "One sentence plain English interpretation of what the user wants"
}

Return ONLY the JSON, no explanation.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());

    return {
      ...parsed,
      _meta: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs: Date.now() - start,
      },
    };
  } catch (err: any) {
    logger.error('intentSearchCopilot error', { error: err.message });
    throw err;
  }
}

// ─── Surface 2: Hotel Truth Layer ─────────────────────────────────────────────

export async function hotelTruthLayer(params: {
  hotel: any;
  rates: any[];
  reviews: any[];
  userQuery?: string;
  checkin: string;
  checkout: string;
  adults: number;
}): Promise<AIResponse> {
  const start = Date.now();

  const hotelData = {
    name: params.hotel.name,
    starRating: params.hotel.starRating,
    address: params.hotel.address,
    amenities: params.hotel.amenities?.slice(0, 30),
    reviewScore: params.hotel.reviewScore,
    reviewCount: params.hotel.reviewCount,
    description: params.hotel.description?.slice(0, 800),
  };

  const reviewSample = params.reviews?.slice(0, 8).map((r: any) => ({
    rating: r.rating,
    text: r.text?.slice(0, 300),
  }));

  const prompt = `You are Adelbo's hotel truth analyst. Give an honest, direct assessment of this hotel — no promotional language.

Hotel: ${JSON.stringify(hotelData)}
Sample reviews: ${JSON.stringify(reviewSample)}
${params.userQuery ? `Traveler said: "${params.userQuery}"` : ''}
Stay: ${params.checkin} → ${params.checkout}, ${params.adults} guest(s)

Write a structured honest summary with these exact sections:

**Best for:** [who will genuinely enjoy this hotel, in 1-2 sentences]

**Strengths:**
- [concrete positive point from reviews/data]
- [concrete positive point]
- [concrete positive point]

**Watch out for:**
- [honest weakness or common complaint]
- [potential issue]

**Not ideal if:** [specific scenarios where this hotel would disappoint]

**Confidence:** [High/Medium/Low] — [one-sentence reason for confidence level]

Be honest. If the hotel is mediocre, say so. If reviews are mixed, flag it. Never use marketing language like "stunning", "world-class", or "exceptional" unless the data clearly supports it. Keep the total response under 250 words.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return {
      content: text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - start,
      cacheHit: false,
    };
  } catch (err: any) {
    logger.error('hotelTruthLayer error', { error: err.message });
    throw err;
  }
}

// ─── Surface 3: Rate / Flexibility Advisor ────────────────────────────────────

export async function rateAdvisor(params: {
  rates: any[];
  checkin: string;
  checkout: string;
  tripCertainty: 'definite' | 'likely' | 'uncertain';
  currency: string;
}): Promise<AIResponse> {
  const start = Date.now();

  const nights = Math.round(
    (new Date(params.checkout).getTime() - new Date(params.checkin).getTime()) / 86400000
  );

  const rateData = params.rates.slice(0, 10).map((r: any) => ({
    id: r.id,
    name: r.name,
    totalPrice: r.retailRate?.total?.[0],
    perNight: r.retailRate?.total?.[0]?.amount / nights,
    cancellation: r.cancellationPolicies,
    mealPlan: r.boardType,
    refundable: r.refundable,
  }));

  const prompt = `You are Adelbo's rate advisor. Help the traveler understand which rate to pick — clearly and honestly.

Rates available: ${JSON.stringify(rateData)}
Stay: ${params.checkin} → ${params.checkout} (${nights} nights)
Trip certainty: ${params.tripCertainty} (${
    params.tripCertainty === 'definite' ? 'they will definitely travel'
    : params.tripCertainty === 'likely' ? 'plans might change'
    : 'plans are uncertain'
  })
Currency: ${params.currency}

Give clear, practical advice with these sections:

**Recommended rate:** [name and why in one sentence]

**Best value:** [which rate gives most for the price]

**Safest pick:** [if trip certainty is uncertain/likely, which rate to choose for flexibility]

**Flexibility tradeoff:** [is the price difference between refundable and non-refundable worth it given their trip certainty?]

**Meal plan:** [is breakfast/all-inclusive worth it at this property? Quick honest take.]

Keep it under 200 words. Be direct — give a clear recommendation, not a list of "it depends."`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return {
      content: text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - start,
      cacheHit: false,
    };
  } catch (err: any) {
    logger.error('rateAdvisor error', { error: err.message });
    throw err;
  }
}

// ─── Surface 4: Price Timing Assistant ───────────────────────────────────────

export async function priceTiming(params: {
  hotelName: string;
  currentPrice: number;
  priceIndex: any;
  checkin: string;
  checkout: string;
  currency: string;
}): Promise<AIResponse> {
  const start = Date.now();

  const prompt = `You are Adelbo's price timing assistant. Help the traveler decide whether to book now or wait.

Hotel: ${params.hotelName}
Current price: ${params.currency} ${params.currentPrice}/night
Dates: ${params.checkin} → ${params.checkout}
Price index data: ${JSON.stringify(params.priceIndex)}

Give a direct recommendation:

**Verdict:** [BOOK NOW / WATCH PRICES / SHIFT DATES] — [one sentence reason]

**Context:** [1-2 sentences on whether this price is high/low/typical for this hotel and destination at this time]

**Risk if you wait:** [brief note on what could happen to prices]

Keep it under 100 words. Be direct — give a clear verdict.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return {
      content: text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - start,
      cacheHit: false,
    };
  } catch (err: any) {
    logger.error('priceTiming error', { error: err.message });
    throw err;
  }
}

// ─── Surface 5: Rescue Agent ─────────────────────────────────────────────────

export async function rescueAgent(params: {
  booking: any;
  reason: string;
  newDates?: { checkin: string; checkout: string };
  userMessage: string;
}): Promise<AIResponse> {
  const start = Date.now();

  const prompt = `You are Adelbo's rescue agent, helping a traveler recover when their plans have changed.

Current booking:
- Hotel: ${params.booking.hotelName || 'Unknown'}
- Dates: ${params.booking.checkIn} → ${params.booking.checkOut}
- Status: ${params.booking.status}
- Cancellation policy: ${params.booking.cancellationPolicy || 'Unknown'}
- Amount paid: ${params.booking.currency} ${params.booking.totalAmount}

Situation: "${params.reason}"
Traveler says: "${params.userMessage}"
${params.newDates ? `New dates requested: ${params.newDates.checkin} → ${params.newDates.checkout}` : ''}

Evaluate their options and give clear advice:

**Best path forward:** [clear recommendation — amend / cancel / keep / escalate]

**Options:**
1. [Option with cost/risk]
2. [Option with cost/risk]
3. [Option if available]

**What to do right now:** [immediate action step]

**Caution:** [anything important they shouldn't miss about timing or penalties]

Be honest about costs. If the policy is restrictive, say so. Keep under 200 words.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return {
      content: text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - start,
      cacheHit: false,
    };
  } catch (err: any) {
    logger.error('rescueAgent error', { error: err.message });
    throw err;
  }
}

// ─── Booking confidence summary ───────────────────────────────────────────────

export async function bookingConfidenceSummary(params: {
  hotel: any;
  rate: any;
  checkin: string;
  checkout: string;
  totalAmount: number;
  currency: string;
  travelCreditEarned: number;
  poolContribution: number;
}): Promise<AIResponse> {
  const start = Date.now();

  const prompt = `You are Adelbo's booking confirmation assistant. Write a brief, reassuring booking confidence summary.

Hotel: ${params.hotel.name} (${params.hotel.starRating}★, score: ${params.hotel.reviewScore}/10)
Rate: ${params.rate.name || 'Standard Room'}
Cancellation: ${params.rate.cancellationPolicies || 'Check terms'}
Stay: ${params.checkin} → ${params.checkout}
Total: ${params.currency} ${params.totalAmount}
Travel Credit to earn: ${params.currency} ${params.travelCreditEarned.toFixed(2)}
Pool contribution: ${params.currency} ${params.poolContribution.toFixed(2)}

Write 2-3 short sentences that:
1. Confirm what they're getting (hotel quality, rate type)
2. State the cancellation terms in plain English
3. Note the Travel Credit they'll earn on completion

No hype. No marketing. Just clear, reassuring information. Under 80 words.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return {
      content: text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - start,
      cacheHit: false,
    };
  } catch (err: any) {
    logger.error('bookingConfidenceSummary error', { error: err.message });
    throw err;
  }
}
