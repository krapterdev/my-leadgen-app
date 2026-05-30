-- PostgreSQL Schema for Email Outreach & Marketing Automation Platform
-- Satisfies Step 4: Postgres database schema design

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Enums for statuses and providers
CREATE TYPE contact_status AS ENUM ('active', 'suppressed', 'bounced', 'unsubscribed', 'replied');
CREATE TYPE mailbox_provider AS ENUM ('gmail', 'gsuite', 'outlook', 'office365', 'yahoo', 'custom');
CREATE TYPE mailbox_status AS ENUM ('active', 'paused', 'error');
CREATE TYPE scraping_state AS ENUM ('PENDING', 'SCRAPING', 'ENRICHING', 'COMPLETED', 'FAILED');

-- 1. USERS TABLE
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    company VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for user email lookups
CREATE INDEX idx_users_email ON users(email);

-- 2. MAILBOXES TABLE
CREATE TABLE mailboxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    provider mailbox_provider NOT NULL,
    smtp_settings JSONB NOT NULL, -- Contains host, port, secure, username, encrypted password
    imap_settings JSONB NOT NULL, -- Contains host, port, secure, username, encrypted password
    throttle_settings JSONB DEFAULT '{"perHour": 50, "perDay": 200}'::jsonb,
    is_verified BOOLEAN DEFAULT FALSE,
    last_verified TIMESTAMP WITH TIME ZONE,
    warmup_enabled BOOLEAN DEFAULT FALSE,
    status mailbox_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for mailboxes
CREATE INDEX idx_mailboxes_user ON mailboxes(user_id);
CREATE INDEX idx_mailboxes_email ON mailboxes(email);

-- 3. CONTACTS TABLE (Optimized for scraper outputs and filtering)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(255),
    title VARCHAR(100),
    timezone VARCHAR(100),
    status contact_status DEFAULT 'active',
    tags TEXT[] DEFAULT '{}', -- PostgreSQL text array for tagging (e.g. gmb-scraper, startups)
    custom_fields JSONB DEFAULT '{}'::jsonb, -- Flexible schema for website, phone, GMB address, rating, reviews, domainAgeDays, businessType
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique contact email per user
    CONSTRAINT unique_user_contact_email UNIQUE (user_id, email)
);

-- Indexes for contact search, filtering, and indexing custom fields
CREATE INDEX idx_contacts_user_email ON contacts(user_id, email);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_tags ON contacts USING gin(tags);
CREATE INDEX idx_contacts_custom_fields ON contacts USING gin(custom_fields);

-- Index specifically for businessType inside custom_fields JSONB
CREATE INDEX idx_contacts_business_type ON contacts ((custom_fields->>'businessType'));

-- Index specifically for GMB address inside custom_fields JSONB for location filtering
CREATE INDEX idx_contacts_address ON contacts ((custom_fields->>'address'));

-- 4. TEMPLATES TABLE
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_user ON templates(user_id);

-- 5. CAMPAIGNS TABLE
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_campaigns_user ON campaigns(user_id);

-- 6. EMAIL LOGS / OUTBOUND RECORDS (For campaign tracking and analytics)
CREATE TABLE email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    mailbox_id UUID NOT NULL REFERENCES mailboxes(id) ON DELETE RESTRICT,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- sent, bounced, pending, failed
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    replied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_logs_campaign ON email_logs(campaign_id);
CREATE INDEX idx_email_logs_contact ON email_logs(contact_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);
