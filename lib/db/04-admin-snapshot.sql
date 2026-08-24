-- ============================================================
-- ADMIN SNAPSHOT — run this BEFORE and AFTER using the admin form
-- ============================================================
-- Purpose: prove that saving a tour in the admin changed exactly what you
-- intended and nothing else.
--
-- The admin form now writes three things that used to be untouchable:
-- location_id, classification, and the whole tour_activities set. A form
-- that fails to load one of those correctly will silently overwrite it on
-- save, and no error appears anywhere.
--
-- READ ONLY. Changes nothing. Safe to run any number of times.
--
--   cd lib/db
--   psql "$DATABASE_URL" -f ./04-admin-snapshot.sql
-- ============================================================


-- ------------------------------------------------------------
-- 1. Every tour, every field the form can touch
-- ------------------------------------------------------------
SELECT
  t.id,
  left(t.title, 32)                       AS title,
  t.classification,
  coalesce(l.name, '— none —')            AS location,
  coalesce(c.name, '— none —')            AS country,
  coalesce(cat.name, '— none —')          AS category,
  t.featured,
  (SELECT count(*) FROM tour_activities ta WHERE ta.tour_id = t.id) AS acts,
  coalesce((SELECT string_agg(a.slug, ' ' ORDER BY a.slug)
            FROM tour_activities ta
            JOIN activities a ON a.id = ta.activity_id
            WHERE ta.tour_id = t.id), '— none —') AS activities
FROM tours t
LEFT JOIN locations  l   ON l.id   = t.location_id
LEFT JOIN countries  c   ON c.id   = l.country_id
LEFT JOIN categories cat ON cat.id = t.category_id
ORDER BY t.id;


-- ------------------------------------------------------------
-- 2. One hash of all of the above
-- ------------------------------------------------------------
-- Compare this line before and after. Identical hash = nothing moved.
-- Different hash when you only meant to change one tour = look at query 1.
SELECT md5(string_agg(r, '|' ORDER BY r)) AS snapshot_hash
FROM (
  SELECT concat_ws(':', t.id, t.classification, t.location_id, t.category_id,
                   t.featured,
                   (SELECT string_agg(ta.activity_id::text, ',' ORDER BY ta.activity_id)
                    FROM tour_activities ta WHERE ta.tour_id = t.id)) AS r
  FROM tours t
) s;


-- ------------------------------------------------------------
-- 3. Is the location dropdown safe to trust?
-- ------------------------------------------------------------
-- The admin form finds a tour's current location by matching the location
-- NAME it got from the API back against the list of locations. That only
-- works while every location name is unique. The day you add a second
-- "Santiago" the form starts picking the wrong one — or picking "None",
-- which wipes the tour's location on the next save.
--
-- Must return ZERO rows. If it does not, the form needs to use ids.
SELECT lower(trim(name)) AS duplicate_name, count(*) AS n,
       string_agg(id::text || '=' || slug, ', ' ORDER BY id) AS rows
FROM locations
GROUP BY lower(trim(name))
HAVING count(*) > 1;

-- Same question for the leading/trailing whitespace case, which matches
-- visually but not by string equality. Must return ZERO rows.
SELECT id, slug, '[' || name || ']' AS padded_name
FROM locations
WHERE name <> trim(name);


-- ------------------------------------------------------------
-- 4. Did anything break the 10-activity rule?
-- ------------------------------------------------------------
-- The form disables checkboxes at 10. The database does not enforce this,
-- so if the API route skips the check, a crafted request gets past it.
-- Must return ZERO rows.
SELECT t.id, t.title, count(*) AS activities
FROM tours t
JOIN tour_activities ta ON ta.tour_id = t.id
GROUP BY t.id, t.title
HAVING count(*) > 10;


-- ------------------------------------------------------------
-- 5. Orphans — activities pointing at nothing
-- ------------------------------------------------------------
-- A save that half-failed leaves rows here. Must return ZERO rows.
SELECT ta.tour_id, ta.activity_id
FROM tour_activities ta
LEFT JOIN tours t      ON t.id = ta.tour_id
LEFT JOIN activities a ON a.id = ta.activity_id
WHERE t.id IS NULL OR a.id IS NULL;


-- ------------------------------------------------------------
-- 6. The rule from replit.md, checked
-- ------------------------------------------------------------
-- An activity may not be indexable until it has both a description and an
-- image. Nothing in the database enforces it. These rows are the ones whose
-- landing pages would be thin content if a crawler reached them.
SELECT slug, name,
       (description IS NULL)  AS missing_description,
       (cover_image IS NULL)  AS missing_image
FROM activities
WHERE is_indexable
  AND (description IS NULL OR cover_image IS NULL)
ORDER BY slug;


-- ------------------------------------------------------------
-- 7. Destinations whose two lists disagree
-- ------------------------------------------------------------
-- A destination has a list of countries and a list of locations, and they
-- are stored independently. Nothing stops you linking a destination to
-- Iceland while one of its locations sits in Kenya. That is not always an
-- error — you might add the city before the country — but every row here
-- is somewhere a breadcrumb or a filter will contradict itself.
SELECT d.name AS destination, l.name AS location, c.name AS location_country
FROM destinations d
JOIN destination_locations dl ON dl.destination_id = d.id
JOIN locations l  ON l.id = dl.location_id
LEFT JOIN countries c ON c.id = l.country_id
WHERE NOT EXISTS (
  SELECT 1 FROM destination_countries dc
  WHERE dc.destination_id = d.id AND dc.country_id = l.country_id
)
ORDER BY d.name, l.name;

-- Destinations with no country at all — these vanish from a country filter.
SELECT d.id, d.name, d.slug
FROM destinations d
WHERE NOT EXISTS (SELECT 1 FROM destination_countries dc
                  WHERE dc.destination_id = d.id)
ORDER BY d.name;


-- ------------------------------------------------------------
-- 8. Counts — must not move during admin work
-- ------------------------------------------------------------
SELECT 'tours' AS t, count(*) FROM tours
UNION ALL SELECT 'destinations',    count(*) FROM destinations
UNION ALL SELECT 'categories',      count(*) FROM categories
UNION ALL SELECT 'countries',       count(*) FROM countries
UNION ALL SELECT 'locations',       count(*) FROM locations
UNION ALL SELECT 'activities',      count(*) FROM activities
UNION ALL SELECT 'tour_activities', count(*) FROM tour_activities
UNION ALL SELECT 'journals',        count(*) FROM journals;
