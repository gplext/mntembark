/**
 * Seeds the database with starter content.
 *
 *   pnpm --filter @workspace/db run seed
 *
 * Safe to re-run: it does nothing if content already exists. Use `seed:reset`
 * to wipe the four content tables and repopulate from scratch.
 *
 * All images referenced here ship with the frontend in
 * artifacts/mnt-embark-web/public/images.
 */

import { db, pool } from "./index";
import {
  categoriesTable,
  destinationsTable,
  journalsTable,
  toursTable,
} from "./schema";

const RESET = process.argv.includes("--reset");

type ItineraryStep = {
  type:
    | "Pickup"
    | "Flight"
    | "Visa"
    | "Layover"
    | "Ride"
    | "Hotel"
    | "Activities";
  title: string;
  description: string;
};

const categories = [
  {
    name: "Safari",
    description:
      "Private conservancies and unhurried game drives, where the only other guests are the ones you brought with you.",
    coverImage: "/images/cat-safari.jpg",
  },
  {
    name: "Expedition Cruising",
    description:
      "Small vessels and smaller manifests, tracing coastlines that larger ships will never reach.",
    coverImage: "/images/cat-cruise.jpg",
  },
  {
    name: "Island & Coast",
    description:
      "Overwater villas, empty sandbars and water so clear it disappears beneath you.",
    coverImage: "/images/cat-beach.jpg",
  },
  {
    name: "Mountain & Wilderness",
    description:
      "High country, glacial silence and lodges positioned exactly where the view is best.",
    coverImage: "/images/cat-mountain.jpg",
  },
];

const destinations = [
  {
    name: "Japan",
    country: "Japan",
    region: "East Asia",
    description:
      "Ryokan mornings, private temple access and a culinary tradition that rewards those who arrive with patience.",
    coverImage: "/images/dest-japan.jpg",
  },
  {
    name: "Morocco",
    country: "Morocco",
    region: "North Africa",
    description:
      "Riads hidden behind unmarked doors, Atlas passes at dusk, and the Sahara opening out beyond the last village.",
    coverImage: "/images/dest-morocco.jpg",
  },
  {
    name: "Iceland",
    country: "Iceland",
    region: "Nordics",
    description:
      "Volcanic coastline, glacial lagoons and winter skies that perform without warning.",
    coverImage: "/images/dest-iceland.jpg",
  },
];

function tours(categoryIds: number[], destinationIds: number[]) {
  const [safari, cruise, island, mountain] = categoryIds;
  const [, morocco, iceland] = destinationIds;

  return [
    {
      title: "Patagonia: The Southern Wild",
      description:
        "Ten days between granite towers and turquoise lakes, staying at a private estancia with a guide who has walked these valleys for thirty years. Helicopter access to the ice field, and evenings by the fire with nobody else booked in.",
      coverImage: "/images/hero-patagonia.jpg",
      images: ["/images/hero-patagonia.jpg", "/images/cat-mountain.jpg"],
      location: "Torres del Paine, Chile",
      durationDays: 10,
      priceFrom: 28500,
      featured: true,
      categoryId: mountain,
      destinationId: null,
      itinerarySteps: [
        {
          type: "Flight",
          title: "Private transfer to Punta Arenas",
          description:
            "Chartered aircraft from Santiago, timed to your arrival rather than a schedule.",
        },
        {
          type: "Ride",
          title: "Overland to the estancia",
          description:
            "Four hours through the steppe, stopping wherever the guanaco are.",
        },
        {
          type: "Hotel",
          title: "Private estancia, six nights",
          description:
            "Exclusive use. Your own chef, guide and horses for the duration.",
        },
        {
          type: "Activities",
          title: "Ice field by helicopter",
          description:
            "Landing on the Southern Patagonian Ice Field, weather permitting, with a glaciologist aboard.",
        },
      ] satisfies ItineraryStep[],
    },
    {
      title: "Aurora Season in the Far North",
      description:
        "Seven nights chasing clear skies across northern Iceland, with a glass-roofed lodge, a private aurora forecaster and the flexibility to move when the forecast does.",
      coverImage: "/images/hero-aurora.jpg",
      images: ["/images/hero-aurora.jpg", "/images/dest-iceland.jpg"],
      location: "Northern Iceland",
      durationDays: 7,
      priceFrom: 19800,
      featured: true,
      categoryId: mountain,
      destinationId: iceland,
      itinerarySteps: [
        {
          type: "Pickup",
          title: "Keflavík arrival",
          description: "Met airside and driven north the same evening.",
        },
        {
          type: "Hotel",
          title: "Glass-roofed lodge",
          description:
            "Six nights, with an aurora call service that will wake you only when it is worth it.",
        },
        {
          type: "Activities",
          title: "Glacier lagoon and ice caves",
          description:
            "Private access before the day visitors arrive, with a mountain guide.",
        },
      ] satisfies ItineraryStep[],
    },
    {
      title: "Sahara: Nights Under the Erg",
      description:
        "From a Marrakech riad into the dunes of Erg Chigaga, where a private camp is raised for your arrival and struck after you leave. Astronomer in residence, and a chef who has cooked for three heads of state.",
      coverImage: "/images/hero-sahara.jpg",
      images: ["/images/hero-sahara.jpg", "/images/dest-morocco.jpg"],
      location: "Erg Chigaga, Morocco",
      durationDays: 8,
      priceFrom: 22400,
      featured: true,
      categoryId: safari,
      destinationId: morocco,
      itinerarySteps: [
        {
          type: "Visa",
          title: "Documentation handled",
          description:
            "All entry formalities arranged in advance by our Casablanca office.",
        },
        {
          type: "Hotel",
          title: "Riad, two nights",
          description:
            "Private riad in the medina, staffed exclusively for your party.",
        },
        {
          type: "Ride",
          title: "Into the erg",
          description:
            "Four-wheel drive convoy across the hamada, with lunch beneath a lone acacia.",
        },
        {
          type: "Activities",
          title: "Private desert camp",
          description:
            "Three nights under canvas. Astronomer in residence for the new moon.",
        },
      ] satisfies ItineraryStep[],
    },
    {
      title: "Maldives: The Empty Atoll",
      description:
        "A week on a private island in a rarely visited southern atoll. One villa, one crew, one reef. Dive master on call, and a seaplane that answers to you.",
      coverImage: "/images/hero-maldives.jpg",
      images: ["/images/hero-maldives.jpg", "/images/cat-beach.jpg"],
      location: "Southern Atolls, Maldives",
      durationDays: 7,
      priceFrom: 34900,
      featured: false,
      categoryId: island,
      destinationId: null,
      itinerarySteps: [
        {
          type: "Flight",
          title: "Seaplane to the atoll",
          description: "Private transfer from Malé, forty minutes over the reef.",
        },
        {
          type: "Hotel",
          title: "Private island, seven nights",
          description:
            "Sole occupancy. Chef, dive master and house reef included.",
        },
        {
          type: "Activities",
          title: "Manta season diving",
          description:
            "Guided dives timed to the cleaning stations, with nobody else on the site.",
        },
      ] satisfies ItineraryStep[],
    },
    {
      title: "Kyoto in the Off-Season",
      description:
        "Eleven days in Japan when the crowds have gone. Private tea ceremony, temple gardens before opening, and a ryokan in the mountains north of the city.",
      coverImage: "/images/dest-japan.jpg",
      images: ["/images/dest-japan.jpg"],
      location: "Kyoto & Kansai, Japan",
      durationDays: 11,
      priceFrom: 26700,
      featured: false,
      categoryId: cruise,
      destinationId: destinationIds[0],
      itinerarySteps: [
        {
          type: "Pickup",
          title: "Haneda arrival",
          description: "Met at the aircraft door, through immigration privately.",
        },
        {
          type: "Hotel",
          title: "Kyoto machiya, five nights",
          description:
            "Restored townhouse in Gion, with a housekeeper and private car.",
        },
        {
          type: "Activities",
          title: "Temples before opening",
          description:
            "Arranged access to three gardens ahead of public hours, with a curator.",
        },
        {
          type: "Hotel",
          title: "Mountain ryokan, four nights",
          description:
            "Private onsen, kaiseki dining, and absolutely nothing scheduled.",
        },
      ] satisfies ItineraryStep[],
    },
  ];
}

const journals = [
  {
    title: "The Case for Travelling in the Wrong Season",
    excerpt:
      "The best light, the emptiest rooms and the lowest prices all arrive at the same time — and almost nobody takes advantage of it.",
    content:
      "There is a version of Kyoto that exists for about six weeks a year, and it is not the one on the postcards. The maples have gone over, the tour groups have moved on, and the gardens are wet and almost empty.\n\nWe have spent years building itineraries around this idea. Not contrarianism for its own sake, but a simple observation: the things that make a place extraordinary are rarely the things that draw a crowd, and the crowd actively diminishes them.\n\nThe same logic applies almost everywhere. Patagonia in the shoulder weeks, when the wind drops and the estancias have space. The Maldives outside the European holidays. Iceland in the depth of winter, when the aurora forecast is worth building a week around.\n\nWhat you give up is certainty about the weather. What you gain is the place itself.",
    coverImage: "/images/journal-1.jpg",
    images: ["/images/journal-1.jpg"],
    location: "Kyoto, Japan",
    author: "Élise Marchand",
  },
  {
    title: "Notes from the Erg",
    excerpt:
      "Three nights in the Sahara with an astronomer, and a reminder of how much sky most of us never see.",
    content:
      "Our astronomer, who has spent twenty years in observatories across three continents, made a point on the first evening that has stayed with me. He said that most people have never actually seen the night sky — they have seen a version of it with ninety percent of the stars removed.\n\nErg Chigaga sits far enough from anything electrical that the Milky Way casts a shadow. Guests who have travelled everywhere, who are genuinely difficult to impress, tend to go quiet for the first ten minutes.\n\nWe now time this itinerary to the new moon deliberately. The dunes are the reason people book it. The sky is the reason they come back.",
    coverImage: "/images/journal-2.jpg",
    images: ["/images/journal-2.jpg"],
    location: "Erg Chigaga, Morocco",
    author: "Rafael Okonkwo",
  },
  {
    title: "What Exclusivity Actually Means",
    excerpt:
      "It is not marble, and it is not a bigger suite. It is the absence of other people's schedules.",
    content:
      "The luxury travel industry has a vocabulary problem. Exclusive has come to mean expensive, and private has come to mean slightly separated from everyone else.\n\nWe use both words more literally. A private camp means the camp is raised for your arrival and struck after you leave. Exclusive use of an estancia means there is no one else booked, not that you have the better wing.\n\nThis is harder to arrange and it costs more, and it is the only version worth selling. The difference is not visible in photographs. It is entirely visible on the third morning, when you realise you have not queued, waited, or shared a view with anyone you did not choose.",
    coverImage: "/images/journal-3.jpg",
    images: ["/images/journal-3.jpg"],
    location: "Torres del Paine, Chile",
    author: "Amara Whitfield",
  },
];

async function main(): Promise<void> {
  if (RESET) {
    console.log("Clearing existing content...");
    // tours references categories/destinations, so it goes first.
    await db.delete(toursTable);
    await db.delete(journalsTable);
    await db.delete(categoriesTable);
    await db.delete(destinationsTable);
  } else {
    const existing = await db.select().from(toursTable).limit(1);
    if (existing.length > 0) {
      console.log(
        "Database already has content — nothing to do.\n" +
          "Re-run with `pnpm --filter @workspace/db run seed:reset` to wipe and reseed.",
      );
      return;
    }
  }

  const insertedCategories = await db
    .insert(categoriesTable)
    .values(categories)
    .returning({ id: categoriesTable.id });
  console.log(`Inserted ${insertedCategories.length} categories`);

  const insertedDestinations = await db
    .insert(destinationsTable)
    .values(destinations)
    .returning({ id: destinationsTable.id });
  console.log(`Inserted ${insertedDestinations.length} destinations`);

  const insertedTours = await db
    .insert(toursTable)
    .values(
      tours(
        insertedCategories.map((c) => c.id),
        insertedDestinations.map((d) => d.id),
      ),
    )
    .returning({ id: toursTable.id });
  console.log(`Inserted ${insertedTours.length} tours`);

  const insertedJournals = await db
    .insert(journalsTable)
    .values(journals)
    .returning({ id: journalsTable.id });
  console.log(`Inserted ${insertedJournals.length} journals`);

  console.log("\nDone. Reload the site to see the content.");
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
