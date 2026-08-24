import {
  categoriesTable,
  db,
  destinationsTable,
  journalsTable,
  toursTable,
} from "@workspace/db";
import { logger } from "./logger";

const image = (name: string): string => `/images/${name}`;

/**
 * Restores the starter catalog that ships with the imported site.
 * The seed is deliberately all-or-nothing: it only runs against a completely
 * empty catalog and never modifies content created through the admin panel.
 */
export async function seedInitialContent(): Promise<void> {
  const [categories, destinations, tours, journals] = await Promise.all([
    db.select({ id: categoriesTable.id }).from(categoriesTable).limit(1),
    db.select({ id: destinationsTable.id }).from(destinationsTable).limit(1),
    db.select({ id: toursTable.id }).from(toursTable).limit(1),
    db.select({ id: journalsTable.id }).from(journalsTable).limit(1),
  ]);

  if (
    categories.length > 0 ||
    destinations.length > 0 ||
    tours.length > 0 ||
    journals.length > 0
  ) {
    logger.info("Starter catalog already exists; skipping initial content seed");
    return;
  }

  const insertedCategories = await db
    .insert(categoriesTable)
    .values([
      {
        name: "Aurora & Arctic",
        description:
          "Private winter expeditions beneath the northern lights, designed around absolute comfort and rare access.",
        coverImage: image("cat-mountain.jpg"),
      },
      {
        name: "Ocean Retreats",
        description:
          "Unhurried escapes across warm waters, private islands, and exceptional coastal sanctuaries.",
        coverImage: image("cat-beach.jpg"),
      },
      {
        name: "Desert Journeys",
        description:
          "Immersive desert crossings shaped by ancient landscapes, refined camps, and quiet discovery.",
        coverImage: image("cat-safari.jpg"),
      },
      {
        name: "Expedition & Wilderness",
        description:
          "Remote landscapes, expertly guided adventures, and the freedom to explore beyond the familiar.",
        coverImage: image("cat-cruise.jpg"),
      },
    ])
    .returning({ id: categoriesTable.id, name: categoriesTable.name });

  const insertedDestinations = await db
    .insert(destinationsTable)
    .values([
      {
        name: "Iceland",
        country: "Iceland",
        region: "Nordic Atlantic",
        description:
          "A dramatic meeting of fire and ice, private geothermal rituals, and aurora-filled winter skies.",
        coverImage: image("dest-iceland.jpg"),
      },
      {
        name: "Patagonia",
        country: "Chile & Argentina",
        region: "South America",
        description:
          "A vast, elemental frontier of granite peaks, luminous lakes, and wilderness without compromise.",
        coverImage: image("dest-japan.jpg"),
      },
      {
        name: "The Maldives",
        country: "Maldives",
        region: "Indian Ocean",
        description:
          "Private-island serenity, clear-water exploration, and effortless days shaped entirely around you.",
        coverImage: image("dest-morocco.jpg"),
      },
      {
        name: "Morocco",
        country: "Morocco",
        region: "North Africa",
        description:
          "From the Atlas Mountains to the Sahara, a richly textured journey through craft, color, and quiet luxury.",
        coverImage: image("dest-morocco_2.jpg"),
      },
    ])
    .returning({ id: destinationsTable.id, name: destinationsTable.name });

  const categoryIds = new Map(
    insertedCategories.map((category) => [category.name, category.id]),
  );
  const destinationIds = new Map(
    insertedDestinations.map((destination) => [
      destination.name,
      destination.id,
    ]),
  );

  await db.insert(toursTable).values([
    {
      title: "Aurora Beyond the Arctic Circle",
      description:
        "A private Icelandic winter journey of heli-transfers, glacier dining, geothermal rituals, and nights beneath the northern lights.",
      coverImage: image("tour-aurora.jpg"),
      images: [image("tour-aurora.jpg"), image("hero-aurora.jpg")],
      location: "Iceland",
      durationDays: 7,
      priceFrom: 48500,
      featured: true,
      categoryId: categoryIds.get("Aurora & Arctic"),
      destinationId: destinationIds.get("Iceland"),
      itinerarySteps: [
        {
          type: "Pickup",
          title: "Private arrival",
          description:
            "Meet your private driver at Keflavík and transfer to your secluded Reykjavík residence.",
          image: image("dest-iceland.jpg"),
        },
        {
          type: "Ride",
          title: "Into the wild",
          description:
            "Travel by private super-jeep across black-sand plains and glacial valleys.",
          image: image("hero-aurora.jpg"),
        },
        {
          type: "Hotel",
          title: "A private lodge",
          description:
            "Settle into a design-led lodge with uninterrupted views of the northern sky.",
          image: image("tour-aurora.jpg"),
        },
        {
          type: "Activities",
          title: "Chase the aurora",
          description:
            "Follow expert guides to the clearest skies for an unforgettable night beneath the lights.",
          image: image("hero-aurora.jpg"),
        },
      ],
    },
    {
      title: "The Last Frontier of Patagonia",
      description:
        "A considered passage through Patagonia with private guides, extraordinary lodges, and access to its most remote trails.",
      coverImage: image("tour-patagonia.jpg"),
      images: [image("tour-patagonia.jpg"), image("hero-patagonia.jpg")],
      location: "Patagonia, Chile & Argentina",
      durationDays: 10,
      priceFrom: 56200,
      featured: true,
      categoryId: categoryIds.get("Expedition & Wilderness"),
      destinationId: destinationIds.get("Patagonia"),
      itinerarySteps: [
        {
          type: "Pickup",
          title: "A seamless welcome",
          description:
            "Your private host meets you on arrival and handles every onward detail.",
          image: image("tour-patagonia.jpg"),
        },
        {
          type: "Flight",
          title: "Across the ice fields",
          description:
            "A scenic private flight reveals the scale of Patagonia’s glaciers and peaks.",
          image: image("hero-patagonia.jpg"),
        },
        {
          type: "Hotel",
          title: "Frontier lodge",
          description:
            "Retire each evening to a remote lodge chosen for warmth, privacy, and extraordinary views.",
          image: image("tour-patagonia.jpg"),
        },
        {
          type: "Activities",
          title: "Beyond the trail",
          description:
            "Explore with expert guides on routes tailored to your pace and curiosity.",
          image: image("hero-patagonia.jpg"),
        },
      ],
    },
    {
      title: "The Art of the Maldives",
      description:
        "An unhurried private-island escape with a dedicated villa team, ocean experiences, and time that belongs only to you.",
      coverImage: image("tour-maldives.jpg"),
      images: [image("tour-maldives.jpg"), image("hero-maldives.jpg")],
      location: "The Maldives",
      durationDays: 8,
      priceFrom: 39800,
      featured: true,
      categoryId: categoryIds.get("Ocean Retreats"),
      destinationId: destinationIds.get("The Maldives"),
      itinerarySteps: [
        {
          type: "Pickup",
          title: "Island arrival",
          description:
            "A host greets you at Malé for a smooth private transfer to your island sanctuary.",
          image: image("tour-maldives.jpg"),
        },
        {
          type: "Ride",
          title: "Overwater passage",
          description:
            "Glide across the lagoon to your villa, where every detail has been prepared in advance.",
          image: image("hero-maldives.jpg"),
        },
        {
          type: "Hotel",
          title: "Your own horizon",
          description:
            "Enjoy a private villa with an on-call team, infinity pool, and direct access to the ocean.",
          image: image("tour-maldives.jpg"),
        },
        {
          type: "Activities",
          title: "Life below the surface",
          description:
            "Set out with a marine biologist for a private reef exploration at the day’s best hour.",
          image: image("hero-maldives.jpg"),
        },
      ],
    },
    {
      title: "Sahara Under a Billion Stars",
      description:
        "A private journey from Marrakech to the Sahara, blending Moroccan craft, Atlas passes, and a refined desert camp.",
      coverImage: image("tour-sahara.jpg"),
      images: [image("tour-sahara.jpg"), image("hero-sahara.jpg")],
      location: "Morocco",
      durationDays: 6,
      priceFrom: 32400,
      featured: true,
      categoryId: categoryIds.get("Desert Journeys"),
      destinationId: destinationIds.get("Morocco"),
      itinerarySteps: [
        {
          type: "Pickup",
          title: "Marrakech arrival",
          description:
            "Be welcomed by your host and transferred directly to a private riad in the medina.",
          image: image("dest-morocco.jpg"),
        },
        {
          type: "Ride",
          title: "Through the Atlas",
          description:
            "Cross cinematic mountain roads in a private 4×4 with a local guide and chef-prepared picnic.",
          image: image("hero-sahara.jpg"),
        },
        {
          type: "Hotel",
          title: "Desert camp",
          description:
            "A discreet, beautifully appointed camp awaits beyond the dunes.",
          image: image("tour-sahara.jpg"),
        },
        {
          type: "Activities",
          title: "The night sky",
          description:
            "Dine by firelight before a private astronomy session under the Sahara’s brilliant stars.",
          image: image("hero-sahara.jpg"),
        },
      ],
    },
  ]);

  await db.insert(journalsTable).values([
    {
      title: "Where Silence Becomes a Luxury",
      excerpt:
        "In Iceland, a winter landscape invites a slower, more attentive way of travelling.",
      content:
        "The rarest luxury is often the space to be still. Across Iceland’s volcanic plains, every horizon seems to make room for thought. We follow the weather, linger in warm water, and let the northern lights decide the evening’s pace.",
      coverImage: image("journal-1.jpg"),
      images: [image("journal-1.jpg"), image("journal-1_2.jpg")],
      location: "Iceland",
      author: "MNT Embark",
      publishedAt: new Date("2026-01-18T00:00:00.000Z"),
    },
    {
      title: "The Art of Arrival",
      excerpt:
        "A thoughtful journey begins long before the first destination comes into view.",
      content:
        "The best arrivals feel effortless. A familiar face at the airport, a room already prepared, and a first meal that quietly introduces a place: these are the details that make travel feel personal from its opening moment.",
      coverImage: image("journal-2.jpg"),
      images: [image("journal-2.jpg"), image("journal-2_2.jpg")],
      location: "The Maldives",
      author: "MNT Embark",
      publishedAt: new Date("2026-02-11T00:00:00.000Z"),
    },
    {
      title: "A Desert Drawn in Gold",
      excerpt:
        "Morocco’s Sahara rewards those willing to travel beyond the obvious route.",
      content:
        "As afternoon fades, the Sahara is remade in gold and rose. Our favourite moments arrive after the road ends: mint tea under canvas, a quiet walk among the dunes, and the sky opening into more stars than most of us have ever seen.",
      coverImage: image("journal-3.jpg"),
      images: [image("journal-3.jpg"), image("journal-3_2.jpg")],
      location: "Morocco",
      author: "MNT Embark",
      publishedAt: new Date("2026-03-04T00:00:00.000Z"),
    },
  ]);

  logger.info(
    { categories: 4, destinations: 4, tours: 4, journals: 3 },
    "Seeded initial MNT Embark catalog",
  );
}