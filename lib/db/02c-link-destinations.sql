-- ============================================================
-- LINK THE REMAINING DESTINATIONS TO THEIR COUNTRIES & LOCATIONS
-- ============================================================
-- 02b already did this for Patagonia. This does the other three.
--
-- Your original destination rows were region-level (Iceland, The Maldives,
-- Morocco, Patagonia), not cities — which means they already ARE destination
-- concepts. Nothing needs deleting. They just need their many-to-many links
-- filled in so the country and location filters work.
--
-- Matching is by slug, so it only links rows that actually exist. A
-- destination whose country or location is missing is simply skipped, and
-- the verification at the bottom shows you which.
--
-- SAFE TO RUN MORE THAN ONCE.
-- ============================================================


-- ------------------------------------------------------------
-- 1. destination -> country
-- ------------------------------------------------------------
INSERT INTO destination_countries (destination_id, country_id, display_order)
SELECT d.id, c.id, 0
FROM (VALUES
  ('iceland',      'iceland'),
  ('the-maldives', 'maldives'),
  ('morocco',      'morocco')
) AS v(dest_slug, country_slug)
JOIN destinations d ON d.slug = v.dest_slug
JOIN countries   c ON c.slug = v.country_slug
ON CONFLICT DO NOTHING;


-- ------------------------------------------------------------
-- 2. destination -> location
-- ------------------------------------------------------------
-- Each destination currently has one location with the same name. As you
-- add real cities (Reykjavík, Malé, Marrakesh) just add more rows here —
-- that is what the many-to-many is for.
INSERT INTO destination_locations (destination_id, location_id, display_order)
SELECT d.id, l.id, 0
FROM destinations d
JOIN locations l ON l.slug = d.slug
WHERE d.slug IN ('iceland', 'the-maldives', 'morocco')
ON CONFLICT DO NOTHING;


-- ------------------------------------------------------------
-- VERIFY
-- ------------------------------------------------------------
-- Every destination with its countries and locations.
-- All four should now show both columns filled.
SELECT
  d.name AS destination,
  d.slug,
  COALESCE((SELECT string_agg(c.name, ', ' ORDER BY c.name)
            FROM destination_countries dc
            JOIN countries c ON c.id = dc.country_id
            WHERE dc.destination_id = d.id), '— none —') AS countries,
  COALESCE((SELECT string_agg(l.name, ', ' ORDER BY l.name)
            FROM destination_locations dl
            JOIN locations l ON l.id = dl.location_id
            WHERE dl.destination_id = d.id), '— none —') AS locations,
  (SELECT count(*) FROM tours t WHERE t.destination_id = d.id) AS tours
FROM destinations d
ORDER BY d.name;

-- The full chain a tour card needs: tour -> location -> country
SELECT t.title, l.name AS location, c.name AS country, c.code
FROM tours t
LEFT JOIN locations l ON l.id = t.location_id
LEFT JOIN countries c ON c.id = l.country_id
ORDER BY t.id;


-- ============================================================
-- AS YOU ADD REAL CITIES
-- ============================================================
-- Right now each location holds the region name as a placeholder. When you
-- add actual cities, the pattern is:
--
--   INSERT INTO locations (slug, name, image, country_id)
--   VALUES ('reykjavik', 'Reykjavík', '/images/locations/reykjavik.jpg',
--           (SELECT id FROM countries WHERE slug = 'iceland'));
--
--   INSERT INTO destination_locations (destination_id, location_id)
--   SELECT d.id, l.id FROM destinations d, locations l
--   WHERE d.slug = 'iceland' AND l.slug = 'reykjavik';
--
--   UPDATE tours SET location_id = (SELECT id FROM locations WHERE slug='reykjavik')
--   WHERE slug = 'your-tour-slug';
--
-- The placeholder location can then be retired once no tour points at it.
-- ============================================================
