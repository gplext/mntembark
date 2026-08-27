import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Initializes database tables, types, and starter data on server boot.
 * 
 * Safe for production and development:
 * - Retries database connection on startup (in case external Postgres is booting)
 * - All DDL statements are IF NOT EXISTS (never drops tables or columns)
 * - Only seeds data if tables are empty (never overwrites existing live data)
 */
export async function seedInitialContent(): Promise<void> {
  // 1. Wait for database connection with retries
  let connected = false;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      await pool.query("SELECT 1");
      connected = true;
      break;
    } catch (err) {
      logger.warn({ attempt, err }, "Waiting for database connection...");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!connected) {
    throw new Error("Could not connect to database after multiple attempts");
  }

  // 2. Ensure extensions, types, and tables exist
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "unaccent";

    DO $$ BEGIN
      CREATE TYPE tour_classification AS ENUM ('standard', 'special', 'exclusive');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE enquiry_source AS ENUM ('tour', 'contact');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE enquiry_status AS ENUM ('new', 'handled');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      cover_image TEXT NOT NULL,
      icon TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS destinations (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE,
      name TEXT NOT NULL,
      cover_image TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      country TEXT,
      region TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS countries (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE,
      name TEXT NOT NULL UNIQUE,
      image TEXT,
      code TEXT UNIQUE,
      description TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS locations (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE,
      name TEXT NOT NULL,
      image TEXT,
      country_id INTEGER REFERENCES countries(id) ON DELETE SET NULL,
      description TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS destination_countries (
      destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
      country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
      display_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (destination_id, country_id)
    );

    CREATE TABLE IF NOT EXISTS destination_locations (
      destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      display_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (destination_id, location_id)
    );

    CREATE TABLE IF NOT EXISTS tours (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      cover_image TEXT NOT NULL,
      images TEXT[] NOT NULL DEFAULT '{}',
      location TEXT NOT NULL,
      duration_days INTEGER NOT NULL DEFAULT 1,
      price_from REAL NOT NULL DEFAULT 0,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      classification tour_classification NOT NULL DEFAULT 'standard',
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      destination_id INTEGER REFERENCES destinations(id) ON DELETE SET NULL,
      location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
      itinerary_steps JSONB NOT NULL DEFAULT '[]',
      embedding JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS journals (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      cover_image TEXT NOT NULL,
      images TEXT[] NOT NULL DEFAULT '{}',
      location TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'MNT Embark',
      published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS activity_groups (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      cover_image TEXT,
      icon TEXT,
      selection_mode TEXT NOT NULL DEFAULT 'multiple',
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      group_id INTEGER NOT NULL REFERENCES activity_groups(id) ON DELETE RESTRICT,
      description TEXT,
      cover_image TEXT,
      icon TEXT,
      aliases TEXT[] NOT NULL DEFAULT '{}',
      display_order INTEGER NOT NULL DEFAULT 0,
      usage_count INTEGER NOT NULL DEFAULT 0,
      is_filterable BOOLEAN NOT NULL DEFAULT TRUE,
      redirect_to_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tour_activities (
      tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      display_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (tour_id, activity_id)
    );

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
  `);

  // 3. Seed Categories if empty
  const catCountRes = await pool.query("SELECT COUNT(*) AS count FROM categories");
  if (parseInt(catCountRes.rows[0].count, 10) === 0) {
    await pool.query(`
      INSERT INTO categories (id, slug, name, description, cover_image, icon, display_order) VALUES
      (1, 'safari', 'Safari', 'Private conservancies and unhurried game drives, where the only other guests are the ones you brought with you.', '/images/cat-safari.jpg', 'binoculars', 1),
      (2, 'expedition-cruising', 'Expedition Cruising', 'Small vessels and smaller manifests, tracing coastlines that larger ships will never reach.', '/images/cat-cruise.jpg', 'ship', 2),
      (3, 'island-coast', 'Island & Coast', 'Overwater villas, empty sandbars and water so clear it disappears beneath you.', '/images/cat-beach.jpg', 'palmtree', 3),
      (4, 'mountain-wilderness', 'Mountain & Wilderness', 'High country, glacial silence and lodges positioned exactly where the view is best.', '/images/cat-mountain.jpg', 'mountain', 4),
      (5, 'architecture-history', 'Architecture & History', 'Old cities, ruins and living heritage, read with someone who knows the story.', '/images/cat-mountain.jpg', 'landmark', 5),
      (6, 'family-fun', 'Family Fun', 'Trips built around travelling together, paced so nobody is bored or exhausted.', '/images/cat-safari.jpg', 'users', 6),
      (7, 'relaxation-spa', 'Relaxation & Spa', 'Thermal waters, long treatments and days with nothing scheduled in them.', '/images/cat-beach.jpg', 'flower', 7),
      (8, 'rail-road', 'Rail & Road', 'Legendary railways and long drives, where the journey is the destination.', '/images/cat-cruise.jpg', 'train', 8),
      (9, 'active-lifestyle', 'Active Lifestyle', 'Trips that keep you moving, from dawn starts to genuinely hard days.', '/images/cat-mountain.jpg', 'activity', 9)
      ON CONFLICT (id) DO NOTHING;

      SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM categories), true);
    `);
    logger.info("Seeded starter categories");
  }

  // 4. Seed Destinations if empty
  const destCountRes = await pool.query("SELECT COUNT(*) AS count FROM destinations");
  if (parseInt(destCountRes.rows[0].count, 10) === 0) {
    await pool.query(`
      INSERT INTO destinations (id, slug, name, country, region, description, cover_image, display_order) VALUES
      (1, 'japan', 'Japan', 'Japan', 'East Asia', 'Ryokan mornings, private temple access and a culinary tradition that rewards those who arrive with patience.', '/images/dest-japan.jpg', 1),
      (2, 'morocco', 'Morocco', 'Morocco', 'North Africa', 'Riads hidden behind unmarked doors, Atlas passes at dusk, and the Sahara opening out beyond the last village.', '/images/dest-morocco.jpg', 2),
      (3, 'iceland', 'Iceland', 'Iceland', 'Nordics', 'Volcanic coastline, glacial lagoons and winter skies that perform without warning.', '/images/dest-iceland.jpg', 3)
      ON CONFLICT (id) DO NOTHING;

      SELECT setval('destinations_id_seq', (SELECT COALESCE(MAX(id), 1) FROM destinations), true);
    `);
    logger.info("Seeded starter destinations");
  }

  // 5. Seed Countries & Locations if empty
  const countryCountRes = await pool.query("SELECT COUNT(*) AS count FROM countries");
  if (parseInt(countryCountRes.rows[0].count, 10) === 0) {
    await pool.query(`
      INSERT INTO countries (id, slug, name, code, display_order) VALUES
      (1, 'japan', 'Japan', 'JP', 1),
      (2, 'morocco', 'Morocco', 'MA', 2),
      (3, 'iceland', 'Iceland', 'IS', 3),
      (4, 'chile', 'Chile', 'CL', 4),
      (5, 'maldives', 'Maldives', 'MV', 5)
      ON CONFLICT (id) DO NOTHING;

      SELECT setval('countries_id_seq', (SELECT COALESCE(MAX(id), 1) FROM countries), true);

      INSERT INTO locations (id, slug, name, country_id, display_order) VALUES
      (1, 'kyoto', 'Kyoto', 1, 1),
      (2, 'erg-chigaga', 'Erg Chigaga', 2, 2),
      (3, 'northern-iceland', 'Northern Iceland', 3, 3),
      (4, 'torres-del-paine', 'Torres del Paine', 4, 4),
      (5, 'southern-atolls', 'Southern Atolls', 5, 5)
      ON CONFLICT (id) DO NOTHING;

      SELECT setval('locations_id_seq', (SELECT COALESCE(MAX(id), 1) FROM locations), true);

      INSERT INTO destination_countries (destination_id, country_id, display_order) VALUES
      (1, 1, 1),
      (2, 2, 1),
      (3, 3, 1)
      ON CONFLICT DO NOTHING;

      INSERT INTO destination_locations (destination_id, location_id, display_order) VALUES
      (1, 1, 1),
      (2, 2, 1),
      (3, 3, 1)
      ON CONFLICT DO NOTHING;
    `);
    logger.info("Seeded starter countries and locations");
  }

  // 6. Seed Tours if empty
  const tourCountRes = await pool.query("SELECT COUNT(*) AS count FROM tours");
  if (parseInt(tourCountRes.rows[0].count, 10) === 0) {
    await pool.query(`
      INSERT INTO tours (id, slug, title, description, cover_image, images, location, duration_days, price_from, featured, category_id, destination_id, location_id, itinerary_steps) VALUES
      (1, 'patagonia-the-southern-wild', 'Patagonia: The Southern Wild', 'Ten days between granite towers and turquoise lakes, staying at a private estancia with a guide who has walked these valleys for thirty years. Helicopter access to the ice field, and evenings by the fire with nobody else booked in.', '/images/hero-patagonia.jpg', ARRAY['/images/hero-patagonia.jpg', '/images/cat-mountain.jpg'], 'Torres del Paine, Chile', 10, 28500, true, 4, NULL, 4, '[
        {"type": "Flight", "title": "Private transfer to Punta Arenas", "description": "Chartered aircraft from Santiago, timed to your arrival rather than a schedule."},
        {"type": "Ride", "title": "Overland to the estancia", "description": "Four hours through the steppe, stopping wherever the guanaco are."},
        {"type": "Hotel", "title": "Private estancia, six nights", "description": "Exclusive use. Your own chef, guide and horses for the duration."},
        {"type": "Activities", "title": "Ice field by helicopter", "description": "Landing on the Southern Patagonian Ice Field, weather permitting, with a glaciologist aboard."}
      ]'),
      (2, 'aurora-season-in-the-far-north', 'Aurora Season in the Far North', 'Seven nights chasing clear skies across northern Iceland, with a glass-roofed lodge, a private aurora forecaster and the flexibility to move when the forecast does.', '/images/hero-aurora.jpg', ARRAY['/images/hero-aurora.jpg', '/images/dest-iceland.jpg'], 'Northern Iceland', 7, 19800, true, 4, 3, 3, '[
        {"type": "Pickup", "title": "Keflavík arrival", "description": "Met airside and driven north the same evening."},
        {"type": "Hotel", "title": "Glass-roofed lodge", "description": "Six nights, with an aurora call service that will wake you only when it is worth it."},
        {"type": "Activities", "title": "Glacier lagoon and ice caves", "description": "Private access before the day visitors arrive, with a mountain guide."}
      ]'),
      (3, 'sahara-nights-under-the-erg', 'Sahara: Nights Under the Erg', 'From a Marrakech riad into the dunes of Erg Chigaga, where a private camp is raised for your arrival and struck after you leave. Astronomer in residence, and a chef who has cooked for three heads of state.', '/images/hero-sahara.jpg', ARRAY['/images/hero-sahara.jpg', '/images/dest-morocco.jpg'], 'Erg Chigaga, Morocco', 8, 22400, true, 1, 2, 2, '[
        {"type": "Visa", "title": "Documentation handled", "description": "All entry formalities arranged in advance by our Casablanca office."},
        {"type": "Hotel", "title": "Riad, two nights", "description": "Private riad in the medina, staffed exclusively for your party."},
        {"type": "Ride", "title": "Into the erg", "description": "Four-wheel drive convoy across the hamada, with lunch beneath a lone acacia."},
        {"type": "Activities", "title": "Private desert camp", "description": "Three nights under canvas. Astronomer in residence for the new moon."}
      ]'),
      (4, 'maldives-the-empty-atoll', 'Maldives: The Empty Atoll', 'A week on a private island in a rarely visited southern atoll. One villa, one crew, one reef. Dive master on call, and a seaplane that answers to you.', '/images/hero-maldives.jpg', ARRAY['/images/hero-maldives.jpg', '/images/cat-beach.jpg'], 'Southern Atolls, Maldives', 7, 34900, false, 3, NULL, 5, '[
        {"type": "Flight", "title": "Seaplane to the atoll", "description": "Private transfer from Malé, forty minutes over the reef."},
        {"type": "Hotel", "title": "Private island, seven nights", "description": "Sole occupancy. Chef, dive master and house reef included."},
        {"type": "Activities", "title": "Manta season diving", "description": "Guided dives timed to the cleaning stations, with nobody else on the site."}
      ]'),
      (5, 'kyoto-in-the-off-season', 'Kyoto in the Off-Season', 'Eleven days in Japan when the crowds have gone. Private tea ceremony, temple gardens before opening, and a ryokan in the mountains north of the city.', '/images/dest-japan.jpg', ARRAY['/images/dest-japan.jpg'], 'Kyoto & Kansai, Japan', 11, 26700, false, 2, 1, 1, '[
        {"type": "Pickup", "title": "Haneda arrival", "description": "Met at the aircraft door, through immigration privately."},
        {"type": "Hotel", "title": "Kyoto machiya, five nights", "description": "Restored townhouse in Gion, with a housekeeper and private car."},
        {"type": "Activities", "title": "Temples before opening", "description": "Arranged access to three gardens ahead of public hours, with a curator."},
        {"type": "Hotel", "title": "Mountain ryokan, four nights", "description": "Private onsen, kaiseki dining, and absolutely nothing scheduled."}
      ]')
      ON CONFLICT (id) DO NOTHING;

      SELECT setval('tours_id_seq', (SELECT COALESCE(MAX(id), 1) FROM tours), true);
    `);
    logger.info("Seeded starter tours");
  }

  // 7. Seed Journals if empty
  const journalCountRes = await pool.query("SELECT COUNT(*) AS count FROM journals");
  if (parseInt(journalCountRes.rows[0].count, 10) === 0) {
    await pool.query(`
      INSERT INTO journals (id, slug, title, excerpt, content, cover_image, images, location, author, published_at) VALUES
      (1, 'the-case-for-travelling-in-the-wrong-season', 'The Case for Travelling in the Wrong Season', 'The best light, the emptiest rooms and the lowest prices all arrive at the same time — and almost nobody takes advantage of it.', 'There is a version of Kyoto that exists for about six weeks a year, and it is not the one on the postcards. The maples have gone over, the tour groups have moved on, and the gardens are wet and almost empty.\n\nWe have spent years building itineraries around this idea. Not contrarianism for its own sake, but a simple observation: the things that make a place extraordinary are rarely the things that draw a crowd, and the crowd actively diminishes them.\n\nThe same logic applies almost everywhere. Patagonia in the shoulder weeks, when the wind drops and the estancias have space. The Maldives outside the European holidays. Iceland in the depth of winter, when the aurora forecast is worth building a week around.\n\nWhat you give up is certainty about the weather. What you gain is the place itself.', '/images/journal-1.jpg', ARRAY['/images/journal-1.jpg'], 'Kyoto, Japan', 'Élise Marchand', NOW()),
      (2, 'notes-from-the-erg', 'Notes from the Erg', 'Three nights in the Sahara with an astronomer, and a reminder of how much sky most of us never see.', 'Our astronomer, who has spent twenty years in observatories across three continents, made a point on the first evening that has stayed with me. He said that most people have never actually seen the night sky — they have seen a version of it with ninety percent of the stars removed.\n\nErg Chigaga sits far enough from anything electrical that the Milky Way casts a shadow. Guests who have travelled everywhere, who are genuinely difficult to impress, tend to go quiet for the first ten minutes.\n\nWe now time this itinerary to the new moon deliberately. The dunes are the reason people book it. The sky is the reason they come back.', '/images/journal-2.jpg', ARRAY['/images/journal-2.jpg'], 'Erg Chigaga, Morocco', 'Rafael Okonkwo', NOW()),
      (3, 'what-exclusivity-actually-means', 'What Exclusivity Actually Means', 'It is not marble, and it is not a bigger suite. It is the absence of other people''s schedules.', 'The luxury travel industry has a vocabulary problem. Exclusive has come to mean expensive, and private has come to mean slightly separated from everyone else.\n\nWe use both words more literally. A private camp means the camp is raised for your arrival and struck after you leave. Exclusive use of an estancia means there is no one else booked, not that you have the better wing.\n\nThis is harder to arrange and it costs more, and it is the only version worth selling. The difference is not visible in photographs. It is entirely visible on the third morning, when you realise you have not queued, waited, or shared a view with anyone you did not choose.', '/images/journal-3.jpg', ARRAY['/images/journal-3.jpg'], 'Torres del Paine, Chile', 'Amara Whitfield', NOW())
      ON CONFLICT (id) DO NOTHING;

      SELECT setval('journals_id_seq', (SELECT COALESCE(MAX(id), 1) FROM journals), true);
    `);
    logger.info("Seeded starter journals");
  }

  // 8. Seed Activity Groups & Activities if empty
  const actGroupCountRes = await pool.query("SELECT COUNT(*) AS count FROM activity_groups");
  if (parseInt(actGroupCountRes.rows[0].count, 10) === 0) {
    await pool.query(`
      INSERT INTO activity_groups (id, slug, name, description, cover_image, icon, selection_mode, display_order) VALUES
      (1, 'water', 'Water', 'In it, on it and under it.', '/images/cat-beach.jpg', 'waves', 'multiple', 10),
      (2, 'land-adventure', 'Land & Adventure', 'Ground covered on foot, wheels or four-wheel drive.', '/images/cat-mountain.jpg', 'compass', 'multiple', 20),
      (3, 'culture', 'Culture & Entertainment', 'Stages, screens and the things people queue for.', '/images/dest-japan.jpg', 'ticket', 'multiple', 30),
      (4, 'food-drink', 'Food & Drink', 'Where the trip stops to eat.', '/images/dest-morocco.jpg', 'utensils', 'multiple', 40)
      ON CONFLICT (id) DO NOTHING;

      SELECT setval('activity_groups_id_seq', (SELECT COALESCE(MAX(id), 1) FROM activity_groups), true);

      INSERT INTO activities (id, group_id, slug, name, description, cover_image, icon, aliases, display_order) VALUES
      (1, 1, 'swimming', 'Swimming', 'Warm water, quiet coves and the occasional pool worth staying in for.', '/images/cat-beach.jpg', 'waves', '{}', 10),
      (2, 1, 'diving', 'Diving & Snorkelling', 'Reefs, wrecks and drop-offs — from a first breath underwater to logged dives with a private guide.', '/images/cat-beach.jpg', 'anchor', '{"deep-sea-diving","scuba","snorkelling"}', 20),
      (3, 1, 'canoeing', 'Canoeing & Kayaking', 'Paddle-powered days on rivers, lagoons and sheltered coastline, at the pace the water sets.', '/images/cat-cruise.jpg', 'sailboat', '{"canoing","kayaking","paddling"}', 30),
      (4, 2, 'hiking', 'Hiking & Trekking', 'Trails from half-day walks to multi-day routes, with the height gained and the nights out planned properly.', '/images/cat-mountain.jpg', 'footprints', '{"trekking","trails"}', 10),
      (5, 2, 'walking', 'Walking Tours', 'Cities read at street level, on foot, with someone who actually knows them.', '/images/dest-japan.jpg', 'walk', '{"walking-tours","city-walks"}', 20),
      (6, 2, 'cycling', 'Cycling', 'Road, gravel and mountain — from easy coastal spins to climbs that earn the lunch.', '/images/cat-mountain.jpg', 'bike', '{"bike","biking","mountain-biking","cycle"}', 30),
      (7, 2, 'off-road', '4x4 & Off-road', 'Tracks a normal car cannot reach: dunes, dry riverbeds and mountain passes.', '/images/hero-sahara.jpg', 'truck', '{"jeep","jeep-safari","4x4","off-roading"}', 40),
      (8, 2, 'camping', 'Camping', 'Nights under canvas, from fly camps on a walking route to fully staffed mobile camps.', '/images/cat-mountain.jpg', 'tent', '{"glamping","under-canvas"}', 50),
      (9, 2, 'desert', 'Desert & Dunes', 'Sand seas, oases and the particular quiet that arrives after dark.', '/images/hero-sahara.jpg', 'sun', '{"sand","dune-bashing","sandboarding"}', 60),
      (10, 3, 'theatre', 'Theatre', 'Stages worth planning a trip around, from opera houses to rooms above pubs.', '/images/dest-japan.jpg', 'drama', '{"theater","shows"}', 10),
      (11, 3, 'concerts', 'Live Music & Concerts', 'Festivals, concert halls and the small venues where things start.', '/images/dest-japan.jpg', 'music', '{"concert","live-music","gigs"}', 20),
      (12, 3, 'theme-parks', 'Theme Parks', 'Rides and water parks, with the queuing strategy handled for you.', '/images/cat-safari.jpg', 'ferris', '{"amusement-parks","water-parks"}', 30),
      (13, 4, 'dining', 'Dining', 'Tasting menus, market stalls and the tables that need booking months ahead.', '/images/dest-morocco.jpg', 'utensils', '{"eating","restaurants","food","fine-dining"}', 10),
      (14, 4, 'cafes', 'Cafés & Coffee', 'Coffee culture, pastry counters and mornings spent sitting still.', '/images/dest-japan.jpg', 'coffee', '{"cafe","coffee","coffee-culture"}', 20)
      ON CONFLICT (id) DO NOTHING;

      SELECT setval('activities_id_seq', (SELECT COALESCE(MAX(id), 1) FROM activities), true);

      -- Tag demo tours
      INSERT INTO tour_activities (tour_id, activity_id, display_order)
      SELECT t.id, a.id, v.ord
      FROM (VALUES
        ('%Aurora%',    'off-road',  0),
        ('%Aurora%',    'hiking',    1),
        ('%Aurora%',    'dining',    2),
        ('%Patagonia%', 'hiking',    0),
        ('%Patagonia%', 'camping',   1),
        ('%Patagonia%', 'canoeing',  2),
        ('%Patagonia%', 'walking',   3),
        ('%Maldives%',  'swimming',  0),
        ('%Maldives%',  'diving',    1),
        ('%Maldives%',  'dining',    2),
        ('%Sahara%',    'desert',    0),
        ('%Sahara%',    'camping',   1),
        ('%Sahara%',    'off-road',  2),
        ('%Sahara%',    'dining',    3)
      ) AS v(title_match, activity_slug, ord)
      JOIN tours      t ON t.title ILIKE v.title_match
      JOIN activities a ON a.slug = v.activity_slug
      ON CONFLICT DO NOTHING;

      -- Update activity usage count
      UPDATE activities SET usage_count = sub.c
      FROM (
        SELECT a.id, count(t.id) AS c
        FROM activities a
        LEFT JOIN tour_activities ta ON ta.activity_id = a.id
        LEFT JOIN tours t ON t.id = ta.tour_id
        GROUP BY a.id
      ) sub
      WHERE activities.id = sub.id;
    `);
    logger.info("Seeded starter activities and tour tags");
  }

  logger.info("Database schema and catalog verified");
}