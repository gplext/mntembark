-- ============================================================
-- TAG THE 4 EXISTING TOURS WITH ACTIVITIES
-- ============================================================
-- tour_activities is empty until someone tags tours. Until then every
-- activity filter returns nothing and every facet count reads 0, which
-- makes the Phase 4 UI impossible to judge.
--
-- These are my reading of your four tour titles. They are a starting point,
-- not a decision — change any line before running, or fix it in the admin
-- afterwards.
--
--   Aurora Beyond the Arctic Circle  -> off-road, hiking, dining
--   The Last Frontier of Patagonia   -> hiking, camping, canoeing, walking
--   The Art of the Maldives          -> swimming, diving, dining
--   Sahara Under a Billion Stars     -> desert, camping, off-road, dining
--
-- Tours are matched on a distinctive word in the title rather than on slug,
-- so this works regardless of how the slug was derived.
--
-- SAFE TO RUN MORE THAN ONCE.
-- ============================================================


INSERT INTO tour_activities (tour_id, activity_id, display_order)
SELECT t.id, a.id, v.ord
FROM (VALUES
  -- Iceland: super-jeep aurora chasing, glacier walks, long dinners
  ('%Aurora%',    'off-road',  0),
  ('%Aurora%',    'hiking',    1),
  ('%Aurora%',    'dining',    2),

  -- Patagonia: trekking country, with water and camps
  ('%Patagonia%', 'hiking',    0),
  ('%Patagonia%', 'camping',   1),
  ('%Patagonia%', 'canoeing',  2),
  ('%Patagonia%', 'walking',   3),

  -- Maldives: water first, then the table
  ('%Maldives%',  'swimming',  0),
  ('%Maldives%',  'diving',    1),
  ('%Maldives%',  'dining',    2),

  -- Morocco: dunes, camps, 4x4, and the food
  ('%Sahara%',    'desert',    0),
  ('%Sahara%',    'camping',   1),
  ('%Sahara%',    'off-road',  2),
  ('%Sahara%',    'dining',    3)
) AS v(title_match, activity_slug, ord)
JOIN tours      t ON t.title ILIKE v.title_match
JOIN activities a ON a.slug = v.activity_slug
ON CONFLICT DO NOTHING;


-- ------------------------------------------------------------
-- Refresh usage counts
-- ------------------------------------------------------------
-- Normally the nightly job does this. Seeding it now means the filter
-- sidebar sorts and displays correctly straight away.
UPDATE activities SET usage_count = sub.c
FROM (
  SELECT a.id, count(t.id) AS c
  FROM activities a
  LEFT JOIN tour_activities ta ON ta.activity_id = a.id
  LEFT JOIN tours t ON t.id = ta.tour_id
  GROUP BY a.id
) sub
WHERE activities.id = sub.id;


-- ------------------------------------------------------------
-- VERIFY
-- ------------------------------------------------------------
-- Each tour with its activities:
SELECT t.title,
       string_agg(a.name, ', ' ORDER BY ta.display_order) AS activities
FROM tours t
JOIN tour_activities ta ON ta.tour_id = t.id
JOIN activities a ON a.id = ta.activity_id
GROUP BY t.id, t.title
ORDER BY t.id;

-- The filter sidebar as it will now render — counts no longer all zero:
SELECT g.name AS section, a.name AS activity, a.usage_count AS tours
FROM activity_groups g
JOIN activities a ON a.group_id = g.id
WHERE a.is_filterable AND a.redirect_to_id IS NULL
ORDER BY g.display_order, a.display_order;

-- Nothing else moved:
SELECT 'tours' AS t, count(*) FROM tours
UNION ALL SELECT 'categories', count(*) FROM categories
UNION ALL SELECT 'destinations', count(*) FROM destinations
UNION ALL SELECT 'journals', count(*) FROM journals
UNION ALL SELECT 'tour_activities', count(*) FROM tour_activities;


-- ============================================================
-- TO RETAG A TOUR LATER
-- ============================================================
--   DELETE FROM tour_activities
--   WHERE tour_id = (SELECT id FROM tours WHERE title ILIKE '%Aurora%');
--
-- then re-insert. Or just do it in the admin once Phase 4 is built —
-- setTourActivities() replaces a tour's whole set in one transaction.
-- ============================================================
