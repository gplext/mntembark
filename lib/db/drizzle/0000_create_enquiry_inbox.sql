-- Stores customer submissions from tour enquiry and Contact Us forms.
-- Every statement is idempotent so development databases which received the
-- additive migration before this journal was initialized remain safe.

DO $$
BEGIN
  CREATE TYPE enquiry_source AS ENUM ('tour', 'contact');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE enquiry_status AS ENUM ('new', 'handled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS enquiries (
  id SERIAL PRIMARY KEY,
  source enquiry_source NOT NULL,
  status enquiry_status NOT NULL DEFAULT 'new',
  title TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  is_travel_advisor BOOLEAN,
  notes TEXT,
  accept_privacy BOOLEAN NOT NULL DEFAULT FALSE,
  receive_updates BOOLEAN NOT NULL DEFAULT FALSE,
  tour_title TEXT,
  tour_location TEXT,
  tour_duration_days INTEGER,
  enquiry_type TEXT,
  budget TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  handled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS enquiries_status_created_idx
  ON enquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS enquiries_created_idx
  ON enquiries (created_at DESC);