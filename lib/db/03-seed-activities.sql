-- ============================================================
-- SEED: Categories, Activity groups, Activities
-- ============================================================
-- SAFE TO RUN MORE THAN ONCE. Every insert is ON CONFLICT guarded, so if
-- the Replit agent re-runs it (it will), nothing duplicates and nothing you
-- edited by hand gets overwritten.
--
-- Run AFTER 01-phase1-additive.sql.
-- ============================================================


-- ------------------------------------------------------------
-- 1. CATEGORIES  (9 curated buckets — the main navigation)
-- ------------------------------------------------------------
-- description and cover_image are NOT NULL on this table, so these carry
-- placeholder copy. Replace it in the admin — a re-run will not overwrite.

INSERT INTO categories (slug, name, description, cover_image, icon, display_order) VALUES
  ('cruise',               'Cruise',                 'Ocean crossings and river voyages, with the itinerary built around the water.',   '/images/categories/cruise.jpg',       'ship',       10),
  ('island-coast',         'Island & Coast',         'Shorelines, archipelagos and the slow business of getting between islands.',      '/images/categories/island-coast.jpg', 'palmtree',   20),
  ('mountain-wilderness',  'Mountain & Wilderness',  'High country, forest and open wild, with height gained and nights out.',          '/images/categories/mountain.jpg',     'mountain',   30),
  ('safari',               'Safari',                 'Wildlife and the great game reserves, guided by people who track for a living.',  '/images/categories/safari.jpg',       'binoculars', 40),
  ('architecture-history', 'Architecture & History', 'Old cities, ruins and living heritage, read with someone who knows the story.',   '/images/categories/history.jpg',      'landmark',   50),
  ('family-fun',           'Family Fun',             'Trips built around travelling together, paced so nobody is bored or exhausted.',  '/images/categories/family.jpg',       'users',      60),
  ('relaxation-spa',       'Relaxation & Spa',       'Thermal waters, long treatments and days with nothing scheduled in them.',        '/images/categories/spa.jpg',          'flower',     70),
  ('rail-road',            'Rail & Road',            'Legendary railways and long drives, where the journey is the destination.',       '/images/categories/rail-road.jpg',    'train',      80),
  ('active-lifestyle',     'Active Lifestyle',       'Trips that keep you moving, from dawn starts to genuinely hard days.',            '/images/categories/active.jpg',       'activity',   90)
ON CONFLICT (slug) DO NOTHING;


-- ------------------------------------------------------------
-- 2. ACTIVITY GROUPS  (the four filter sections)
-- ------------------------------------------------------------
-- Your fifteen activities are grouped rather than listed flat. Fifteen loose
-- checkboxes is a wall; four labelled sections of two to six is scannable.

INSERT INTO activity_groups (slug, name, description, cover_image, icon, selection_mode, display_order) VALUES
  ('water',          'Water',                   'In it, on it and under it.',                    '/images/activity-groups/water.jpg',   'waves',      'multiple', 10),
  ('land-adventure', 'Land & Adventure',        'Ground covered on foot, wheels or four-wheel drive.', '/images/activity-groups/land.jpg', 'compass', 'multiple', 20),
  ('culture',        'Culture & Entertainment', 'Stages, screens and the things people queue for.', '/images/activity-groups/culture.jpg', 'ticket',   'multiple', 30),
  ('food-drink',     'Food & Drink',            'Where the trip stops to eat.',                  '/images/activity-groups/food.jpg',    'utensils',   'multiple', 40)
ON CONFLICT (slug) DO NOTHING;


-- ------------------------------------------------------------
-- 3. ACTIVITIES
-- ------------------------------------------------------------
-- Your 15 became 14 — "bike" and "cycling" are the same activity, so they
-- are one row with the other as an alias. Four entries were renamed for
-- clarity; the ORIGINAL WORD IS KEPT AS AN ALIAS in every case, so search
-- and imports using your original term still resolve correctly.
--
--   deep sea diving -> Diving & Snorkelling   (deep sea diving is the
--                      commercial/technical trade; you mean recreational)
--   jeep            -> 4x4 & Off-road         (Jeep is a trademark, and the
--                      activity is the terrain, not the vehicle)
--   sand            -> Desert & Dunes         (BEST GUESS — see the note at
--                      the bottom of this file)
--   eating          -> Dining
--   canoing         -> Canoeing & Kayaking    (spelling)
--
-- description and cover_image are nullable on this table, deliberately: an
-- activity works as a filter checkbox the moment it exists. Real copy is
-- seeded here anyway so nothing ships empty.

INSERT INTO activities (group_id, slug, name, description, cover_image, icon, aliases, display_order) VALUES

  -- Water --------------------------------------------------------------
  ((SELECT id FROM activity_groups WHERE slug='water'), 'swimming', 'Swimming',
   'Warm water, quiet coves and the occasional pool worth staying in for.',
   '/images/activities/swimming.jpg', 'waves', '{}', 10),

  ((SELECT id FROM activity_groups WHERE slug='water'), 'diving', 'Diving & Snorkelling',
   'Reefs, wrecks and drop-offs — from a first breath underwater to logged dives with a private guide.',
   '/images/activities/diving.jpg', 'anchor', '{"deep-sea-diving","scuba","snorkelling"}', 20),

  ((SELECT id FROM activity_groups WHERE slug='water'), 'canoeing', 'Canoeing & Kayaking',
   'Paddle-powered days on rivers, lagoons and sheltered coastline, at the pace the water sets.',
   '/images/activities/canoeing.jpg', 'sailboat', '{"canoing","kayaking","paddling"}', 30),

  -- Land & Adventure ----------------------------------------------------
  ((SELECT id FROM activity_groups WHERE slug='land-adventure'), 'hiking', 'Hiking & Trekking',
   'Trails from half-day walks to multi-day routes, with the height gained and the nights out planned properly.',
   '/images/activities/hiking.jpg', 'footprints', '{"trekking","trails"}', 10),

  ((SELECT id FROM activity_groups WHERE slug='land-adventure'), 'walking', 'Walking Tours',
   'Cities read at street level, on foot, with someone who actually knows them.',
   '/images/activities/walking.jpg', 'walk', '{"walking-tours","city-walks"}', 20),

  ((SELECT id FROM activity_groups WHERE slug='land-adventure'), 'cycling', 'Cycling',
   'Road, gravel and mountain — from easy coastal spins to climbs that earn the lunch.',
   '/images/activities/cycling.jpg', 'bike', '{"bike","biking","mountain-biking","cycle"}', 30),

  ((SELECT id FROM activity_groups WHERE slug='land-adventure'), 'off-road', '4x4 & Off-road',
   'Tracks a normal car cannot reach: dunes, dry riverbeds and mountain passes.',
   '/images/activities/off-road.jpg', 'truck', '{"jeep","jeep-safari","4x4","off-roading"}', 40),

  ((SELECT id FROM activity_groups WHERE slug='land-adventure'), 'camping', 'Camping',
   'Nights under canvas, from fly camps on a walking route to fully staffed mobile camps.',
   '/images/activities/camping.jpg', 'tent', '{"glamping","under-canvas"}', 50),

  ((SELECT id FROM activity_groups WHERE slug='land-adventure'), 'desert', 'Desert & Dunes',
   'Sand seas, oases and the particular quiet that arrives after dark.',
   '/images/activities/desert.jpg', 'sun', '{"sand","dune-bashing","sandboarding"}', 60),

  -- Culture & Entertainment ---------------------------------------------
  ((SELECT id FROM activity_groups WHERE slug='culture'), 'theatre', 'Theatre',
   'Stages worth planning a trip around, from opera houses to rooms above pubs.',
   '/images/activities/theatre.jpg', 'drama', '{"theater","shows"}', 10),

  ((SELECT id FROM activity_groups WHERE slug='culture'), 'concerts', 'Live Music & Concerts',
   'Festivals, concert halls and the small venues where things start.',
   '/images/activities/concerts.jpg', 'music', '{"concert","live-music","gigs"}', 20),

  ((SELECT id FROM activity_groups WHERE slug='culture'), 'theme-parks', 'Theme Parks',
   'Rides and water parks, with the queuing strategy handled for you.',
   '/images/activities/theme-parks.jpg', 'ferris', '{"amusement-parks","water-parks"}', 30),

  -- Food & Drink ---------------------------------------------------------
  ((SELECT id FROM activity_groups WHERE slug='food-drink'), 'dining', 'Dining',
   'Tasting menus, market stalls and the tables that need booking months ahead.',
   '/images/activities/dining.jpg', 'utensils', '{"eating","restaurants","food","fine-dining"}', 10),

  ((SELECT id FROM activity_groups WHERE slug='food-drink'), 'cafes', 'Cafés & Coffee',
   'Coffee culture, pastry counters and mornings spent sitting still.',
   '/images/activities/cafes.jpg', 'coffee', '{"cafe","coffee","coffee-culture"}', 20)

ON CONFLICT (slug) DO NOTHING;


-- ------------------------------------------------------------
-- 4. VERIFY
-- ------------------------------------------------------------
-- Expect: 9 categories, 4 groups, 14 activities.

SELECT 'categories'      AS what, count(*) AS n FROM categories
UNION ALL SELECT 'activity_groups', count(*) FROM activity_groups
UNION ALL SELECT 'activities',      count(*) FROM activities;

-- Read the filter sidebar exactly as it will render:
SELECT g.name AS section, a.name AS activity, a.slug, a.icon,
       (a.cover_image IS NOT NULL) AS has_image,
       (a.description IS NOT NULL) AS has_copy
FROM activity_groups g
JOIN activities a ON a.group_id = g.id
WHERE a.is_filterable AND a.redirect_to_id IS NULL
ORDER BY g.display_order, a.display_order;


-- ============================================================
-- TWO THINGS TO DO
-- ============================================================
-- 1. The image paths above are placeholders pointing at
--    /images/activities/*.jpg. Upload real files there or update the rows.
--    Nothing breaks if they 404 — the filter still works, the landing page
--    just looks empty.
--
-- 2. "sand" was ambiguous. It is seeded as Desert & Dunes on the assumption
--    you meant desert trips. If you meant BEACH time, run this NOW, before
--    tours are tagged and /activities/desert is live:
--
--      UPDATE activities
--      SET slug        = 'beach',
--          name        = 'Beach & Sunbathing',
--          description = 'Long stretches of sand, loungers worth the walk, and nowhere to be.',
--          cover_image = '/images/activities/beach.jpg',
--          icon        = 'umbrella',
--          aliases     = '{"sand","sunbathing","beaches"}'
--      WHERE slug = 'desert';
-- ============================================================
