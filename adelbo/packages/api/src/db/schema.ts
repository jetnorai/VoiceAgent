import {
  pgTable, text, varchar, integer, decimal, boolean,
  timestamp, uuid, jsonb, pgEnum, index, uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─── Enums ─────────────────────────────────────────────────────────────────────
export const identityMethodEnum = pgEnum('identity_method', ['world_id', 'email', 'wallet']);
export const bookingStatusEnum = pgEnum('booking_status', [
  'pending_payment', 'confirmed', 'active', 'completed', 'cancelled', 'refunded',
]);
export const paymentMethodEnum = pgEnum('payment_method', ['card', 'usdc', 'wld', 'stripe_onramp']);
export const creditLedgerTypeEnum = pgEnum('credit_ledger_type', ['earned', 'redeemed', 'expired', 'adjusted']);
export const tierEnum = pgEnum('tier', ['explorer', 'adventurer', 'voyager', 'globetrotter']);
export const aiSurfaceEnum = pgEnum('ai_surface', [
  'intent_search', 'hotel_truth', 'rate_advisor', 'price_timing', 'rescue_agent',
]);

// ─── Users ─────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique(),
  worldId: varchar('world_id', { length: 255 }).unique(),
  walletAddress: varchar('wallet_address', { length: 42 }).unique(),
  custodialWalletAddress: varchar('custodial_wallet_address', { length: 42 }),
  encryptedPrivateKey: text('encrypted_private_key'), // KMS-encrypted for email users
  displayName: varchar('display_name', { length: 100 }),
  tier: tierEnum('tier').default('explorer'),
  reputationScore: integer('reputation_score').default(0),
  referralCode: varchar('referral_code', { length: 6 }).unique(),
  referredBy: uuid('referred_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  emailIdx: index('users_email_idx').on(t.email),
  worldIdIdx: index('users_world_id_idx').on(t.worldId),
}));

// ─── Identity methods ──────────────────────────────────────────────────────────
export const identityMethods = pgTable('identity_methods', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  method: identityMethodEnum('method').notNull(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqueIdentifier: uniqueIndex('identity_method_identifier_idx').on(t.method, t.identifier),
}));

// ─── OTP tokens ────────────────────────────────────────────────────────────────
export const otpTokens = pgTable('otp_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  token: varchar('token', { length: 6 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Hotels (LiteAPI cache) ────────────────────────────────────────────────────
export const hotels = pgTable('hotels', {
  id: varchar('id', { length: 100 }).primaryKey(), // LiteAPI hotel ID
  name: varchar('name', { length: 255 }).notNull(),
  destinationId: varchar('destination_id', { length: 100 }),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }),
  countryCode: varchar('country_code', { length: 2 }),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  starRating: integer('star_rating'),
  reviewScore: decimal('review_score', { precision: 4, scale: 2 }),
  reviewCount: integer('review_count').default(0),
  thumbnailUrl: text('thumbnail_url'),
  images: jsonb('images').$type<string[]>().default([]),
  amenities: jsonb('amenities').$type<string[]>().default([]),
  description: text('description'),
  address: jsonb('address').$type<Record<string, string>>(),
  rawData: jsonb('raw_data'), // full LiteAPI response cached
  cachedAt: timestamp('cached_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Bookings ──────────────────────────────────────────────────────────────────
export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  hotelId: varchar('hotel_id', { length: 100 }).notNull().references(() => hotels.id),
  liteApiBookingId: varchar('liteapi_booking_id', { length: 100 }).unique(),
  liteApiPreBookId: varchar('liteapi_pre_book_id', { length: 100 }),
  status: bookingStatusEnum('status').default('pending_payment').notNull(),

  // Room & rate details
  checkIn: timestamp('check_in').notNull(),
  checkOut: timestamp('check_out').notNull(),
  guests: integer('guests').notNull().default(2),
  roomType: varchar('room_type', { length: 255 }),
  ratePlan: varchar('rate_plan', { length: 255 }),
  cancellationPolicy: text('cancellation_policy'),
  mealPlan: varchar('meal_plan', { length: 100 }),

  // Pricing
  baseAmount: decimal('base_amount', { precision: 12, scale: 2 }).notNull(), // before Adelbo markup
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(), // with 5% markup
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  marginAmount: decimal('margin_amount', { precision: 12, scale: 2 }), // 5% of base
  travelCreditEarned: decimal('travel_credit_earned', { precision: 12, scale: 2 }), // 1.25%
  poolContribution: decimal('pool_contribution', { precision: 12, scale: 2 }), // 2%
  creditRedeemed: decimal('credit_redeemed', { precision: 12, scale: 2 }).default('0'),

  // Payment
  paymentMethod: paymentMethodEnum('payment_method'),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 100 }),
  onChainTxHash: varchar('on_chain_tx_hash', { length: 66 }),
  onChainConfirmed: boolean('on_chain_confirmed').default(false),
  onChainBookingId: integer('on_chain_booking_id'), // MarginSplitter.bookingCount

  // Traveler info
  guestFirstName: varchar('guest_first_name', { length: 100 }),
  guestLastName: varchar('guest_last_name', { length: 100 }),
  guestEmail: varchar('guest_email', { length: 255 }),
  guestPhone: varchar('guest_phone', { length: 50 }),

  // Timestamps
  confirmedAt: timestamp('confirmed_at'),
  checkedInAt: timestamp('checked_in_at'),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('bookings_user_idx').on(t.userId),
  statusIdx: index('bookings_status_idx').on(t.status),
  liteApiIdx: index('bookings_liteapi_idx').on(t.liteApiBookingId),
}));

// ─── Booking events ────────────────────────────────────────────────────────────
export const bookingEvents = pgTable('booking_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  fromStatus: bookingStatusEnum('from_status'),
  toStatus: bookingStatusEnum('to_status'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Travel Credit ledger ──────────────────────────────────────────────────────
export const travelCreditLedger = pgTable('travel_credit_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  bookingId: uuid('booking_id').references(() => bookings.id),
  type: creditLedgerTypeEnum('type').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 12, scale: 2 }).notNull(),
  description: varchar('description', { length: 255 }),
  expiresAt: timestamp('expires_at'),
  onChainTxHash: varchar('on_chain_tx_hash', { length: 66 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('credit_ledger_user_idx').on(t.userId),
}));

// ─── Pool cycles ───────────────────────────────────────────────────────────────
export const poolCycles = pgTable('pool_cycles', {
  id: uuid('id').primaryKey().defaultRandom(),
  cycleNumber: integer('cycle_number').unique().notNull(),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  participantCount: integer('participant_count').default(0),
  winnerCount: integer('winner_count').default(3),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | distributing | completed
  distributedAt: timestamp('distributed_at'),
  onChainTxHash: varchar('on_chain_tx_hash', { length: 66 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Pool contributions ────────────────────────────────────────────────────────
export const poolContributions = pgTable('pool_contributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id),
  cycleId: uuid('cycle_id').notNull().references(() => poolCycles.id),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  loyaltyScore: decimal('loyalty_score', { precision: 10, scale: 4 }),
  isWinner: boolean('is_winner').default(false),
  winnerRank: integer('winner_rank'),
  distributionAmount: decimal('distribution_amount', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userCycleIdx: index('pool_contributions_user_cycle_idx').on(t.userId, t.cycleId),
}));

// ─── Reviews ───────────────────────────────────────────────────────────────────
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id).unique(),
  hotelId: varchar('hotel_id', { length: 100 }).notNull().references(() => hotels.id),
  rating: integer('rating').notNull(), // 1-5
  title: varchar('title', { length: 200 }),
  content: text('content').notNull(),
  tags: jsonb('tags').$type<string[]>().default([]),
  travelPurpose: varchar('travel_purpose', { length: 50 }), // leisure | business | family | couple
  wouldReturn: boolean('would_return'),
  onChainVerified: boolean('on_chain_verified').default(false),
  onChainTxHash: varchar('on_chain_tx_hash', { length: 66 }),
  contentHash: varchar('content_hash', { length: 66 }), // keccak256 of content
  wldRewardPaid: boolean('wld_reward_paid').default(false),
  wldRewardAmount: decimal('wld_reward_amount', { precision: 10, scale: 6 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  hotelIdx: index('reviews_hotel_idx').on(t.hotelId),
  userIdx: index('reviews_user_idx').on(t.userId),
}));

// ─── AI recommendation events ──────────────────────────────────────────────────
export const aiRecommendationEvents = pgTable('ai_recommendation_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  sessionId: varchar('session_id', { length: 100 }),
  surface: aiSurfaceEnum('surface').notNull(),
  hotelId: varchar('hotel_id', { length: 100 }),
  bookingId: uuid('booking_id').references(() => bookings.id),
  prompt: text('prompt').notNull(),
  response: text('response').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  latencyMs: integer('latency_ms'),
  helpful: boolean('helpful'), // user feedback
  userBooked: boolean('user_booked').default(false),
  cacheHit: boolean('cache_hit').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Notifications ─────────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  metadata: jsonb('metadata'),
  readAt: timestamp('read_at'),
  sentViaEmail: boolean('sent_via_email').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Support cases ──────────────────────────────────────────────────────────────
export const supportCases = pgTable('support_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  bookingId: uuid('booking_id').references(() => bookings.id),
  subject: varchar('subject', { length: 255 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(),
  priority: varchar('priority', { length: 20 }).default('normal').notNull(),
  resolution: text('resolution'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
