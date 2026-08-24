-- ============================================================
-- PLACES: countries + locations, destinations become concepts
-- ============================================================
-- Your existing `destinations` rows (Bangkok, Phuket, Malé...) are CITIES.
-- Under the new model those belong in `locations`, and `destinations`
-- becomes the curated concept you sell ("Southeast Asia", "East Africa").
--
-- This script does the move WITHOUT breaking anything:
--   * locations rows keep the SAME ids as the destination rows they came
--     from, so remapping tours is a straight copy
--   * the old destination rows are LEFT IN PLACE, so tours.destination_id
--     still resolves and every page keeps rendering
--   * you clear them out in step 7, by hand, once you've curated real
--     destinations
--
-- SAFE TO RUN MORE THAN ONCE.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION slugify(src text) RETURNS text AS $$
  SELECT trim(both '-' FROM
    regexp_replace(lower(unaccent(coalesce(src, ''))), '[^a-z0-9]+', '-', 'g'));
$$ LANGUAGE sql IMMUTABLE;


-- ------------------------------------------------------------
-- 1. New tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS countries (
  id            serial PRIMARY KEY,
  slug          text NOT NULL,
  name          text NOT NULL,
  image         text,
  code          text,
  description   text,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id            serial PRIMARY KEY,
  slug          text NOT NULL,
  name          text NOT NULL,
  image         text,
  country_id    integer,
  description   text,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS destination_countries (
  destination_id integer NOT NULL,
  country_id     integer NOT NULL,
  display_order  integer NOT NULL DEFAULT 0,
  CONSTRAINT destination_countries_pk PRIMARY KEY (destination_id, country_id)
);

CREATE TABLE IF NOT EXISTS destination_locations (
  destination_id integer NOT NULL,
  location_id    integer NOT NULL,
  display_order  integer NOT NULL DEFAULT 0,
  CONSTRAINT destination_locations_pk PRIMARY KEY (destination_id, location_id)
);


-- ------------------------------------------------------------
-- 2. Loosen the old destinations columns
-- ------------------------------------------------------------
-- A destination is now just a name and an image, so the columns that used
-- to be required no longer are. Nothing is dropped — existing values stay.
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE destinations ALTER COLUMN country     DROP NOT NULL;
ALTER TABLE destinations ALTER COLUMN description DROP NOT NULL;
ALTER TABLE destinations ALTER COLUMN cover_image DROP NOT NULL;

ALTER TABLE tours ADD COLUMN IF NOT EXISTS location_id integer;

UPDATE destinations SET slug = slugify(name) WHERE slug IS NULL;

-- break any slug collisions
WITH d AS (
  SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
  FROM destinations
)
UPDATE destinations dest SET slug = dest.slug || '-' || dest.id
FROM d WHERE d.id = dest.id AND d.rn > 1;


-- ------------------------------------------------------------
-- 3. Countries from the old free-text column
-- ------------------------------------------------------------
INSERT INTO countries (slug, name, image)
SELECT slugify(d.country), min(d.country), min(d.cover_image)
FROM destinations d
WHERE d.country IS NOT NULL
  AND trim(d.country) <> ''
GROUP BY slugify(d.country)
ON CONFLICT DO NOTHING;

-- ISO codes for the common ones. Add your own rows to this list.
UPDATE countries SET code = v.code
FROM (VALUES
  ('thailand','TH'), ('maldives','MV'), ('kenya','KE'), ('tanzania','TZ'),
  ('united-arab-emirates','AE'), ('japan','JP'), ('italy','IT'),
  ('greece','GR'), ('morocco','MA'), ('iceland','IS'), ('norway','NO'),
  ('peru','PE'), ('indonesia','ID'), ('vietnam','VN'), ('turkey','TR'),
  ('france','FR'), ('spain','ES'), ('portugal','PT'), ('egypt','EG'),
  ('south-africa','ZA'), ('india','IN'), ('sri-lanka','LK')
) AS v(slug, code)
WHERE countries.slug = v.slug AND countries.code IS NULL;


-- ------------------------------------------------------------
-- 4. Copy existing destination rows into locations — SAME IDS
-- ------------------------------------------------------------
-- Keeping the ids identical is what makes step 5 a one-line copy instead
-- of a lookup table.
INSERT INTO locations (id, slug, name, image, country_id, description, created_at)
SELECT
  d.id,
  d.slug,
  d.name,
  d.cover_image,
  c.id,
  d.description,
  d.created_at
FROM destinations d
LEFT JOIN countries c ON c.slug = slugify(d.country)
WHERE d.country IS NOT NULL          -- only the old city-shaped rows
  AND trim(d.country) <> ''
ON CONFLICT (id) DO NOTHING;

-- Move the sequence past the ids we just forced in, or the next INSERT
-- without an explicit id collides.
SELECT setval(
  pg_get_serial_sequence('locations', 'id'),
  GREATEST((SELECT COALESCE(max(id), 0) FROM locations), 1)
);


-- ------------------------------------------------------------
-- 5. Point tours at their location
-- ------------------------------------------------------------
UPDATE tours t
SET location_id = t.destination_id
WHERE t.location_id IS NULL
  AND t.destination_id IN (SELECT id FROM locations);


-- ------------------------------------------------------------
-- 6. Foreign keys + indexes
-- ------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE locations ADD CONSTRAINT locations_country_id_fk
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE destination_countries ADD CONSTRAINT dc_destination_fk
    FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE destination_countries ADD CONSTRAINT dc_country_fk
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE destination_locations ADD CONSTRAINT dl_destination_fk
    FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE destination_locations ADD CONSTRAINT dl_location_fk
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE tours ADD CONSTRAINT tours_location_id_fk
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS countries_slug_key  ON countries (slug);
CREATE UNIQUE INDEX IF NOT EXISTS countries_name_key  ON countries (name);
CREATE UNIQUE INDEX IF NOT EXISTS locations_slug_key  ON locations (slug);
CREATE        INDEX IF NOT EXISTS locations_country_idx ON locations (country_id);
CREATE        INDEX IF NOT EXISTS destination_countries_country_idx ON destination_countries (country_id);
CREATE        INDEX IF NOT EXISTS destination_locations_location_idx ON destination_locations (location_id);
CREATE        INDEX IF NOT EXISTS tours_location_idx ON tours (location_id);
CREATE UNIQUE INDEX IF NOT EXISTS destinations_slug_key ON destinations (slug);


-- ------------------------------------------------------------
-- VERIFY
-- ------------------------------------------------------------
SELECT 'countries' AS t, count(*) FROM countries
UNION ALL SELECT 'locations',    count(*) FROM locations
UNION ALL SELECT 'destinations (old city rows)', count(*) FROM destinations
UNION ALL SELECT 'tours',        count(*) FROM tours
UNION ALL SELECT 'tours with location', count(*) FROM tours WHERE location_id IS NOT NULL;

-- Every location should have a country. Expect zero rows:
SELECT id, name FROM locations WHERE country_id IS NULL;

-- The place tree:
SELECT c.name AS country, c.code, string_agg(l.name, ', ' ORDER BY l.name) AS locations
FROM countries c LEFT JOIN locations l ON l.country_id = c.id
GROUP BY c.id, c.name, c.code ORDER BY c.name;


-- ============================================================
-- 7. DO THIS LATER, BY HAND — not part of the script
-- ============================================================
-- Right now `destinations` still holds the old city rows so your pages keep
-- working. Once you have curated real destinations and repointed tours:
--
--   a) create your destination concepts
--        INSERT INTO destinations (slug, name, cover_image)
--        VALUES ('southeast-asia', 'Southeast Asia', '/images/destinations/sea.jpg');
--
--   b) link them
--        INSERT INTO destination_countries (destination_id, country_id)
--        SELECT d.id, c.id FROM destinations d, countries c
--        WHERE d.slug = 'southeast-asia' AND c.slug IN ('thailand','vietnam','indonesia');
--
--        INSERT INTO destination_locations (destination_id, location_id)
--        SELECT d.id, l.id FROM destinations d, locations l
--        WHERE d.slug = 'southeast-asia' AND l.slug IN ('bangkok','phuket');
--
--   c) repoint each tour at its new destination
--        UPDATE tours SET destination_id = (SELECT id FROM destinations WHERE slug='southeast-asia')
--        WHERE location_id IN (SELECT id FROM locations WHERE slug IN ('bangkok','phuket'));
--
--   d) ONLY THEN delete the leftover city rows from destinations
--        DELETE FROM destinations
--        WHERE country IS NOT NULL
--          AND id NOT IN (SELECT DISTINCT destination_id FROM tours WHERE destination_id IS NOT NULL);
--
--      Run the SELECT version first and read what it would delete.
-- ============================================================
