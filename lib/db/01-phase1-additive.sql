-- ============================================================
-- STEP 1 — Activities, classification, categories. ADDITIVE ONLY.
-- ============================================================
-- WHY THIS FILE EXISTS
-- If your Replit database was created with `db:push` (the Replit Drizzle
-- template's default), you have no migrations folder. `drizzle-kit generate`
-- will then emit a full CREATE TABLE migration that fails immediately on
-- "relation tours already exists".
--
-- This is the hand-written version that applies to a LIVE database.
-- Run it, then let drizzle-kit take over from the next change on.
--
-- SAFE TO RUN MORE THAN ONCE — every statement is guarded.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Classification enum
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE tour_classification AS ENUM ('standard', 'special', 'exclusive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ------------------------------------------------------------
-- 2. New columns on existing tables — all nullable or defaulted,
--    so existing rows are untouched and nothing fails.
-- ------------------------------------------------------------
ALTER TABLE tours        ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE tours        ADD COLUMN IF NOT EXISTS classification tour_classification NOT NULL DEFAULT 'standard';

ALTER TABLE categories   ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE categories   ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE categories   ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- Nothing is added to `destinations` here. That table is reshaped entirely
-- by 02-places-migration.sql, which also creates countries and locations.


-- ------------------------------------------------------------
-- 3. Activity tables (the many-to-many with tours)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_groups (
  id             serial PRIMARY KEY,
  slug           text NOT NULL,
  name           text NOT NULL,
  description    text,
  cover_image    text,
  icon           text,
  selection_mode text NOT NULL DEFAULT 'multiple',
  display_order  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id             serial PRIMARY KEY,
  group_id       integer NOT NULL,
  slug           text NOT NULL,
  name           text NOT NULL,
  description    text,          -- landing-page intro, nullable on purpose
  cover_image    text,          -- hero image path or URL, nullable on purpose
  icon           text,          -- 24px glyph for the filter checkbox
  aliases        text[] NOT NULL DEFAULT '{}'::text[],
  redirect_to_id integer,
  is_filterable  boolean NOT NULL DEFAULT true,
  is_indexable   boolean NOT NULL DEFAULT false,
  usage_count    integer NOT NULL DEFAULT 0,
  display_order  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- The many-to-many between tours and activities.
CREATE TABLE IF NOT EXISTS tour_activities (
  tour_id       integer NOT NULL,
  activity_id   integer NOT NULL,
  display_order smallint NOT NULL DEFAULT 0,
  CONSTRAINT tour_activities_pk PRIMARY KEY (tour_id, activity_id)
);


-- ------------------------------------------------------------
-- 4. Foreign keys
-- ------------------------------------------------------------
-- On tours.category_id / destination_id these are NEW CONSTRAINTS ON OLD
-- DATA, so they fail if a tour points at a row that no longer exists.
-- Clean first:

UPDATE tours SET category_id = NULL
WHERE category_id IS NOT NULL
  AND category_id NOT IN (SELECT id FROM categories);

UPDATE tours SET destination_id = NULL
WHERE destination_id IS NOT NULL
  AND destination_id NOT IN (SELECT id FROM destinations);

DO $$ BEGIN
  ALTER TABLE activities ADD CONSTRAINT activities_group_id_fk
    FOREIGN KEY (group_id) REFERENCES activity_groups(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE activities ADD CONSTRAINT activities_redirect_to_id_fk
    FOREIGN KEY (redirect_to_id) REFERENCES activities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE tour_activities ADD CONSTRAINT tour_activities_tour_id_fk
    FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE tour_activities ADD CONSTRAINT tour_activities_activity_id_fk
    FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE tours ADD CONSTRAINT tours_category_id_fk
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE tours ADD CONSTRAINT tours_destination_id_fk
    FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;



-- ------------------------------------------------------------
-- 5. Indexes
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS activity_groups_slug_key      ON activity_groups (slug);
CREATE        INDEX IF NOT EXISTS activity_groups_order_idx     ON activity_groups (display_order);
CREATE UNIQUE INDEX IF NOT EXISTS activities_slug_key           ON activities (slug);
CREATE        INDEX IF NOT EXISTS activities_group_idx          ON activities (group_id, display_order);
CREATE        INDEX IF NOT EXISTS activities_aliases_idx        ON activities USING gin (aliases);

-- Reverse lookup for /activities/[slug]. The composite PK already covers
-- tour_id, so only this direction needs its own index.
CREATE        INDEX IF NOT EXISTS tour_activities_activity_idx  ON tour_activities (activity_id);

CREATE        INDEX IF NOT EXISTS tours_category_idx       ON tours (category_id);
CREATE        INDEX IF NOT EXISTS tours_destination_idx    ON tours (destination_id);
CREATE        INDEX IF NOT EXISTS tours_classification_idx ON tours (classification);
CREATE        INDEX IF NOT EXISTS tours_featured_idx       ON tours (featured, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS tours_slug_key      ON tours (slug);
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON categories (slug);


-- ------------------------------------------------------------
-- 6. VERIFY — read this before going further
-- ------------------------------------------------------------
SELECT 'tours' AS table_name, count(*) FROM tours
UNION ALL SELECT 'destinations', count(*) FROM destinations
UNION ALL SELECT 'categories',   count(*) FROM categories
UNION ALL SELECT 'journals',     count(*) FROM journals;
-- Every count must match what you had BEFORE running this file.
