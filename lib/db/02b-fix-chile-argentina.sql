-- ============================================================
-- SPLIT "Chile & Argentina" INTO TWO REAL COUNTRIES
-- ============================================================
-- Your original destinations table had the free-text country
-- "Chile & Argentina" on the Patagonia row. The migration faithfully turned
-- that string into one countries row — but it is two countries, which is why
-- it has no ISO code while the others do.
--
-- Patagonia genuinely spans both. That is precisely the case
-- destination_countries exists for: a DESTINATION can have many countries,
-- a LOCATION has exactly one.
--
-- So: create Chile and Argentina properly, point the Patagonia location at
-- Chile, and set up "Patagonia" as a destination covering both.
--
-- SAFE TO RUN MORE THAN ONCE.
-- ============================================================


-- ------------------------------------------------------------
-- 1. The two real countries
-- ------------------------------------------------------------
INSERT INTO countries (slug, name, code, image, display_order)
SELECT 'chile', 'Chile', 'CL',
       (SELECT image FROM countries WHERE slug = 'chile-argentina'), 0
WHERE NOT EXISTS (SELECT 1 FROM countries WHERE slug = 'chile');

INSERT INTO countries (slug, name, code, image, display_order)
SELECT 'argentina', 'Argentina', 'AR',
       (SELECT image FROM countries WHERE slug = 'chile-argentina'), 0
WHERE NOT EXISTS (SELECT 1 FROM countries WHERE slug = 'argentina');


-- ------------------------------------------------------------
-- 2. Repoint the Patagonia location
-- ------------------------------------------------------------
-- A location has exactly one country. The Chilean side is the more common
-- base for Patagonia itineraries; change to 'argentina' if yours is not.
UPDATE locations
SET country_id = (SELECT id FROM countries WHERE slug = 'chile')
WHERE country_id = (SELECT id FROM countries WHERE slug = 'chile-argentina');


-- ------------------------------------------------------------
-- 3. Retire the bogus country row
-- ------------------------------------------------------------
-- Only once nothing references it. The guard means a re-run is harmless.
DELETE FROM countries
WHERE slug = 'chile-argentina'
  AND NOT EXISTS (
    SELECT 1 FROM locations l WHERE l.country_id = countries.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM destination_countries dc WHERE dc.country_id = countries.id
  );


-- ------------------------------------------------------------
-- 4. Patagonia as a destination spanning both countries
-- ------------------------------------------------------------
-- This is the first real use of the many-to-many. The destination is the
-- thing you sell; the two countries are where it physically is.
INSERT INTO destinations (slug, name, cover_image, display_order)
SELECT 'patagonia', 'Patagonia',
       (SELECT image FROM locations WHERE slug = 'patagonia'), 10
WHERE NOT EXISTS (SELECT 1 FROM destinations WHERE slug = 'patagonia');

INSERT INTO destination_countries (destination_id, country_id, display_order)
SELECT d.id, c.id, CASE c.slug WHEN 'chile' THEN 0 ELSE 1 END
FROM destinations d, countries c
WHERE d.slug = 'patagonia' AND c.slug IN ('chile', 'argentina')
ON CONFLICT DO NOTHING;

INSERT INTO destination_locations (destination_id, location_id, display_order)
SELECT d.id, l.id, 0
FROM destinations d, locations l
WHERE d.slug = 'patagonia' AND l.slug = 'patagonia'
ON CONFLICT DO NOTHING;


-- ------------------------------------------------------------
-- VERIFY
-- ------------------------------------------------------------
-- "Chile & Argentina" gone, Chile and Argentina present with ISO codes:
SELECT id, name, slug, code FROM countries ORDER BY name;

-- Every location still has a country. Must return zero rows:
SELECT id, name FROM locations WHERE country_id IS NULL;

-- Every tour still has its location. Must equal your tour count:
SELECT count(*) AS tours_with_location FROM tours WHERE location_id IS NOT NULL;

-- The Patagonia destination, spanning two countries:
SELECT d.name AS destination,
       (SELECT string_agg(c.name, ', ' ORDER BY dc.display_order)
        FROM destination_countries dc
        JOIN countries c ON c.id = dc.country_id
        WHERE dc.destination_id = d.id) AS countries,
       (SELECT string_agg(l.name, ', ')
        FROM destination_locations dl
        JOIN locations l ON l.id = dl.location_id
        WHERE dl.destination_id = d.id) AS locations
FROM destinations d
WHERE d.slug = 'patagonia';
