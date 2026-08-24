-- ============================================================
-- BACKFILL SLUGS  —  run AFTER 01, BEFORE 03
-- ============================================================
-- Your 4 existing categories are demo data and stay exactly as they are.
-- This script does ONE thing: derives a slug from each name.
--
--   Aurora & Arctic          -> aurora-arctic
--   Ocean Retreats           -> ocean-retreats
--   Desert Journeys          -> desert-journeys
--   Expedition & Wilderness  -> expedition-wilderness
--
-- NOTHING ELSE CHANGES. Names, descriptions, cover images and the tours
-- attached to each are untouched.
--
-- Why it is needed at all: 01 adds a UNIQUE index on categories.slug, and
-- every public URL is /categories/<slug>. Without a slug those four rows
-- render as /categories/undefined.
--
-- It also slugs your 4 tours, for the same reason — 01 adds tours.slug and
-- a unique index on it, but nothing fills it in.
--
-- After this, 03 adds the 9 new categories. Final count: 13.
--
-- SAFE TO RUN MORE THAN ONCE.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ------------------------------------------------------------
-- 1. Derive a slug for any category that lacks one
-- ------------------------------------------------------------
UPDATE categories
SET slug = trim(both '-' FROM
      regexp_replace(lower(unaccent(name)), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- ------------------------------------------------------------
-- 2. Break collisions, if two names reduced to the same slug
-- ------------------------------------------------------------
WITH d AS (
  SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
  FROM categories
)
UPDATE categories c
SET slug = c.slug || '-' || c.id
FROM d
WHERE d.id = c.id AND d.rn > 1;

-- ------------------------------------------------------------
-- 3. Push the demo rows to the end of the nav
-- ------------------------------------------------------------
-- The 9 seeded categories use display_order 10..90. This puts the demo
-- ones after them so they do not sit in the middle of the real nav.
-- Ordering only — no other change.
UPDATE categories
SET display_order = 100 + id
WHERE display_order = 0;


-- ------------------------------------------------------------
-- 4. Same treatment for tours
-- ------------------------------------------------------------
-- 01 adds tours.slug + a unique index but does not populate it. Left NULL,
-- any route built on slug renders /tours/undefined.
UPDATE tours
SET slug = trim(both '-' FROM
      regexp_replace(lower(unaccent(title)), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL;

WITH d AS (
  SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
  FROM tours
)
UPDATE tours t
SET slug = t.slug || '-' || t.id
FROM d
WHERE d.id = t.id AND d.rn > 1;


-- ------------------------------------------------------------
-- VERIFY — read this before running 03
-- ------------------------------------------------------------
-- Expect your original 4 rows, same names, same tours, now with slugs.
SELECT c.id, c.name, c.slug, c.display_order, count(t.id) AS tours
FROM categories c
LEFT JOIN tours t ON t.category_id = c.id
GROUP BY c.id, c.name, c.slug, c.display_order
ORDER BY c.id;

-- Must return zero rows:
SELECT id, name FROM categories WHERE slug IS NULL;

-- Must equal the number of tours you started with:
SELECT count(*) AS tours_with_category FROM tours WHERE category_id IS NOT NULL;

-- Your tours, now with slugs. Titles unchanged.
SELECT id, title, slug FROM tours ORDER BY id;

-- Must return zero rows:
SELECT id, title FROM tours WHERE slug IS NULL;


-- ============================================================
-- WHEN YOU ARE READY TO DELETE THE DEMO DATA
-- ============================================================
-- Not now, and not by the agent. Each demo category has a tour attached,
-- so repoint the tours first or they are left with no category.
--
-- 1. See what is attached:
--
--    SELECT c.name AS category, t.id, t.title
--    FROM categories c JOIN tours t ON t.category_id = c.id
--    WHERE c.slug IN ('aurora-arctic','ocean-retreats',
--                     'desert-journeys','expedition-wilderness');
--
-- 2. Repoint each tour to whichever of the 9 it really belongs in, e.g.
--
--    UPDATE tours SET category_id = (SELECT id FROM categories WHERE slug='island-coast')
--    WHERE category_id = (SELECT id FROM categories WHERE slug='ocean-retreats');
--
-- 3. Only once no tour references them:
--
--    DELETE FROM categories
--    WHERE slug IN ('aurora-arctic','ocean-retreats',
--                   'desert-journeys','expedition-wilderness')
--      AND id NOT IN (SELECT category_id FROM tours WHERE category_id IS NOT NULL);
--
-- If you would rather keep 'Aurora & Arctic' and 'Desert Journeys' as real
-- categories — your catalogue has tours for both and the 9-item list has no
-- home for polar or desert trips — just leave them out of step 3.
-- ============================================================
