-- Adelbo initial database migration
-- Run: psql $DATABASE_URL -f migrations/001_initial.sql

CREATE TYPE identity_method AS ENUM ('world_id', 'email', 'wallet');
CREATE TYPE booking_status AS ENUM ('pending_payment', 'confirmed', 'active', 'completed', 'cancelled', 'refunded');
CREATE TYPE payment_method AS ENUM ('card', 'usdc', 'wld', 'stripe_onramp');
CREATE TYPE credit_ledger_type AS ENUM ('earned', 'redeemed', 'expired', 'adjusted');
CREATE TYPE tier AS ENUM ('explorer', 'adventurer', 'voyager', 'globetrotter');
CREATE TYPE ai_surface AS ENUM ('intent_search', 'hotel_truth', 'rate_advisor', 'price_timing', 'rescue_agent');

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    world_id VARCHAR(255) UNIQUE,
    wallet_address VARCHAR(42) UNIQUE,
    custodial_wallet_address VARCHAR(42),
    encrypted_private_key TEXT,
    display_name VARCHAR(100),
    tier tier DEFAULT 'explorer',
    reputation_score INTEGER DEFAULT 0,
    referral_code VARCHAR(6) UNIQUE,
    referred_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_world_id_idx ON users(world_id);

-- Identity methods
CREATE TABLE identity_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method identity_method NOT NULL,
    identifier VARCHAR(255) NOT NULL,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE(method, identifier)
);

-- OTP tokens
CREATE TABLE otp_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Hotels (LiteAPI cache)
CREATE TABLE hotels (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    destination_id VARCHAR(100),
    city VARCHAR(100),
    country VARCHAR(100),
    country_code VARCHAR(2),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    star_rating INTEGER,
    review_score DECIMAL(4,2),
    review_count INTEGER DEFAULT 0,
    thumbnail_url TEXT,
    images JSONB DEFAULT '[]',
    amenities JSONB DEFAULT '[]',
    description TEXT,
    address JSONB,
    raw_data JSONB,
    cached_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Bookings
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    hotel_id VARCHAR(100) NOT NULL REFERENCES hotels(id),
    liteapi_booking_id VARCHAR(100) UNIQUE,
    liteapi_pre_book_id VARCHAR(100),
    status booking_status DEFAULT 'pending_payment' NOT NULL,
    check_in TIMESTAMP NOT NULL,
    check_out TIMESTAMP NOT NULL,
    guests INTEGER NOT NULL DEFAULT 2,
    room_type VARCHAR(255),
    rate_plan VARCHAR(255),
    cancellation_policy TEXT,
    meal_plan VARCHAR(100),
    base_amount DECIMAL(12,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
    margin_amount DECIMAL(12,2),
    travel_credit_earned DECIMAL(12,2),
    pool_contribution DECIMAL(12,2),
    credit_redeemed DECIMAL(12,2) DEFAULT 0,
    payment_method payment_method,
    stripe_payment_intent_id VARCHAR(100),
    on_chain_tx_hash VARCHAR(66),
    on_chain_confirmed BOOLEAN DEFAULT FALSE,
    on_chain_booking_id INTEGER,
    guest_first_name VARCHAR(100),
    guest_last_name VARCHAR(100),
    guest_email VARCHAR(255),
    guest_phone VARCHAR(50),
    confirmed_at TIMESTAMP,
    checked_in_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX bookings_user_idx ON bookings(user_id);
CREATE INDEX bookings_status_idx ON bookings(status);
CREATE INDEX bookings_liteapi_idx ON bookings(liteapi_booking_id);

-- Booking events
CREATE TABLE booking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    event_type VARCHAR(50) NOT NULL,
    from_status booking_status,
    to_status booking_status,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Travel Credit ledger
CREATE TABLE travel_credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    booking_id UUID REFERENCES bookings(id),
    type credit_ledger_type NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    description VARCHAR(255),
    expires_at TIMESTAMP,
    on_chain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX credit_ledger_user_idx ON travel_credit_ledger(user_id);

-- Pool cycles
CREATE TABLE pool_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_number INTEGER UNIQUE NOT NULL,
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    total_amount DECIMAL(12,2) DEFAULT 0 NOT NULL,
    participant_count INTEGER DEFAULT 0,
    winner_count INTEGER DEFAULT 3,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    distributed_at TIMESTAMP,
    on_chain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Pool contributions
CREATE TABLE pool_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    cycle_id UUID NOT NULL REFERENCES pool_cycles(id),
    amount DECIMAL(12,2) NOT NULL,
    loyalty_score DECIMAL(10,4),
    is_winner BOOLEAN DEFAULT FALSE,
    winner_rank INTEGER,
    distribution_amount DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX pool_contributions_user_cycle_idx ON pool_contributions(user_id, cycle_id);

-- Reviews
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    booking_id UUID NOT NULL REFERENCES bookings(id) UNIQUE,
    hotel_id VARCHAR(100) NOT NULL REFERENCES hotels(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(200),
    content TEXT NOT NULL,
    tags JSONB DEFAULT '[]',
    travel_purpose VARCHAR(50),
    would_return BOOLEAN,
    on_chain_verified BOOLEAN DEFAULT FALSE,
    on_chain_tx_hash VARCHAR(66),
    content_hash VARCHAR(66),
    wld_reward_paid BOOLEAN DEFAULT FALSE,
    wld_reward_amount DECIMAL(10,6),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX reviews_hotel_idx ON reviews(hotel_id);
CREATE INDEX reviews_user_idx ON reviews(user_id);

-- AI recommendation events
CREATE TABLE ai_recommendation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(100),
    surface ai_surface NOT NULL,
    hotel_id VARCHAR(100),
    booking_id UUID REFERENCES bookings(id),
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    helpful BOOLEAN,
    user_booked BOOLEAN DEFAULT FALSE,
    cache_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    metadata JSONB,
    read_at TIMESTAMP,
    sent_via_email BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Support cases
CREATE TABLE support_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    booking_id UUID REFERENCES bookings(id),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open' NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' NOT NULL,
    resolution TEXT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Seed first pool cycle
INSERT INTO pool_cycles (cycle_number, starts_at, ends_at, total_amount, participant_count, status)
VALUES (
    1,
    date_trunc('month', NOW()),
    date_trunc('month', NOW()) + INTERVAL '1 month',
    0,
    0,
    'active'
);
