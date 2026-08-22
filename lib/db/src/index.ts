import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";
import { categoriesTable, destinationsTable, toursTable, journalsTable } from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function ensureTablesExist() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        cover_image TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS destinations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        country TEXT NOT NULL,
        region TEXT,
        description TEXT NOT NULL,
        cover_image TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tours (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        cover_image TEXT NOT NULL,
        images TEXT[] NOT NULL DEFAULT '{}',
        location TEXT NOT NULL,
        duration_days INTEGER NOT NULL DEFAULT 1,
        price_from REAL NOT NULL DEFAULT 0,
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        category_id INTEGER,
        destination_id INTEGER,
        itinerary_steps JSONB NOT NULL DEFAULT '[]',
        embedding JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS journals (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        content TEXT NOT NULL,
        cover_image TEXT NOT NULL,
        images TEXT[] NOT NULL DEFAULT '{}',
        location TEXT NOT NULL,
        author TEXT NOT NULL,
        published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function seedDatabaseIfEmpty(force = false) {
  if (!force) {
    const existingTours = await db.select({ count: sql<number>`count(*)` }).from(toursTable);
    const count = Number(existingTours[0]?.count || 0);
    if (count > 0) return;
  }

  // Clear existing if force is true
  if (force) {
    await db.delete(toursTable);
    await db.delete(journalsTable);
    await db.delete(destinationsTable);
    await db.delete(categoriesTable);
  }

  // Insert categories
  const catRows = await db
    .insert(categoriesTable)
    .values([
      { name: "Private Jet & Safaris", description: "Exclusive private aviation and wild luxury expeditions.", coverImage: "/images/cat-safari.jpg" },
      { name: "Superyacht Expeditions", description: "Charters across uncharted seas and private archipelagos.", coverImage: "/images/cat-cruise.jpg" },
      { name: "Arctic & Alpine Retreats", description: "Heli-skiing, glass igloos, and northern light sanctuaries.", coverImage: "/images/cat-mountain.jpg" },
      { name: "Desert & Wellness Sanctuaries", description: "Serene dunes, private oases, and ancient healing journeys.", coverImage: "/images/cat-beach.jpg" },
    ])
    .returning();

  // Insert destinations
  const destRows = await db
    .insert(destinationsTable)
    .values([
      { name: "Japan", country: "Japan", region: "Asia", description: "Private tea ceremonies, ryokan sanctuaries, and cherry blossom tours.", coverImage: "/images/dest-japan.jpg" },
      { name: "Iceland & Greenland", country: "Iceland", region: "Nordics", description: "Volcanic heli-tours, blue lagoon retreats, and aurora expeditions.", coverImage: "/images/dest-iceland.jpg" },
      { name: "Morocco", country: "Morocco", region: "North Africa", description: "Royal palaces of Marrakech and luxury desert glamping.", coverImage: "/images/dest-morocco.jpg" },
    ])
    .returning();

  // Insert tours
  await db.insert(toursTable).values([
    {
      title: "Patagonian Fjords & Glacier Odyssey",
      description: "Charter a private catamaran across pristine glacial fjords and stay in architect-designed lodges at the edge of the world.",
      coverImage: "/images/hero-patagonia.jpg",
      images: ["/images/hero-patagonia.jpg", "/images/dest-japan.jpg"],
      location: "Patagonia, Chile & Argentina",
      durationDays: 12,
      priceFrom: 24500,
      featured: true,
      categoryId: catRows[0]?.id,
      destinationId: destRows[0]?.id,
      itinerarySteps: [
        { type: "Flight", title: "Helicopter Transfer to Lodge", description: "Scenic flight over Torres del Paine." },
        { type: "Activities", title: "Private Glacier Trekking", description: "Guided ice walk with champagne lunch." }
      ],
    },
    {
      title: "Kyoto Heritage & Private Ryokan Escape",
      description: "Immerse yourself in Japan's cultural heart with private access to ancient temples, master tea artisans, and three-star Michelin dining.",
      coverImage: "/images/dest-japan.jpg",
      images: ["/images/dest-japan.jpg"],
      location: "Kyoto & Tokyo, Japan",
      durationDays: 9,
      priceFrom: 18000,
      featured: true,
      categoryId: catRows[2]?.id,
      destinationId: destRows[0]?.id,
      itinerarySteps: [
        { type: "Pickup", title: "Private Shinkansen Carriage", description: "First class bullet train from Tokyo to Kyoto." },
        { type: "Hotel", title: "Aman Kyoto Sanctuary", description: "Private villa with hot spring baths." }
      ],
    },
    {
      title: "Arctic Glass Igloos & Northern Lights",
      description: "Watch the aurora borealis from heated glass domes, fly by private helicopter to remote hot springs, and dine under frozen waterfalls.",
      coverImage: "/images/hero-aurora.jpg",
      images: ["/images/hero-aurora.jpg", "/images/dest-iceland.jpg"],
      location: "Reykjavik & North Iceland",
      durationDays: 7,
      priceFrom: 15200,
      featured: true,
      categoryId: catRows[2]?.id,
      destinationId: destRows[1]?.id,
      itinerarySteps: [
        { type: "Activities", title: "Super-Jeep Glacier Exploration", description: "Traverse Langjokull glacier in custom luxury vehicles." }
      ],
    },
    {
      title: "Royal Marrakech & Sahara Star-Gazing",
      description: "Stay in private riads in Marrakech before taking a private helicopter to a luxury tented encampment in the heart of the Sahara dunes.",
      coverImage: "/images/hero-sahara.jpg",
      images: ["/images/hero-sahara.jpg", "/images/dest-morocco.jpg"],
      location: "Marrakech & Erg Chebbi, Morocco",
      durationDays: 10,
      priceFrom: 19800,
      featured: true,
      categoryId: catRows[3]?.id,
      destinationId: destRows[2]?.id,
      itinerarySteps: [
        { type: "Hotel", title: "Royal Mansour Marrakech", description: "Private multi-story riad with dedicated butler." }
      ],
    },
    {
      title: "Maldives Private Island & Superyacht Charter",
      description: "An ultra-exclusive retreat pairing a private island villa with a 50-meter superyacht for private diving and sunset dining.",
      coverImage: "/images/hero-maldives.jpg",
      images: ["/images/hero-maldives.jpg"],
      location: "Baa Atoll, Maldives",
      durationDays: 8,
      priceFrom: 32000,
      featured: true,
      categoryId: catRows[1]?.id,
      destinationId: destRows[1]?.id,
      itinerarySteps: [
        { type: "Ride", title: "Seaplane Transfer", description: "Private chartered seaplane straight to your island jetty." }
      ],
    },
  ]);

  // Insert journals
  await db.insert(journalsTable).values([
    {
      title: "Inside the World of Private Jet Expeditions",
      excerpt: "How bespoke aviation is redefining remote luxury travel across six continents.",
      content: "Bespoke aviation has opened access to the most remote corners of our planet...",
      coverImage: "/images/journal-1.jpg",
      images: ["/images/journal-1.jpg"],
      location: "Global",
      author: "MNT Editorial Team",
    },
    {
      title: "Sailing the Uncharted Waters of Greenland",
      excerpt: "A glimpse into superyacht expeditions through ancient icebergs and deep fjords.",
      content: "Cruising through the quiet majesty of Disko Bay aboard a private ice-class yacht...",
      coverImage: "/images/journal-2.jpg",
      images: ["/images/journal-2.jpg"],
      location: "Greenland",
      author: "Capt. Julian Vance",
    },
    {
      title: "The Sacred Ryokans of Kyoto",
      excerpt: "Centuries of hospitality, private hot springs, and Michelin-starred kaiseki.",
      content: "Step into centuries-old traditions preserved with exquisite modern elegance...",
      coverImage: "/images/journal-3.jpg",
      images: ["/images/journal-3.jpg"],
      location: "Kyoto, Japan",
      author: "Elena Rostova",
    },
  ]);
}

export * from "./schema";


