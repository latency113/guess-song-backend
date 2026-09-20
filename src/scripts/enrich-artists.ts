import { db } from "../db";
import { fetchSongsByQuery, CATEGORY_QUERIES, type SongItem } from "../services/itunes";
import { extractPrimaryArtist } from "../routes/game";
import { CategoryType } from "@prisma/client";

async function enrichArtists() {
  console.log("=================================================");
  console.log("🎵 Enriching Songs for Artists with < 4 Songs");
  console.log("=================================================");

  const categories: CategoryType[] = [
    "THAI_HITS",
    "THAI_INDIE_ROCK",
    "GLOBAL_POP",
    "GLOBAL_CLASSIC"
  ];

  for (const cat of categories) {
    console.log(`\n🔍 Checking category: ${cat}`);

    // Query artists with < 4 songs
    const lowSongArtists = await db.prisma.$queryRaw<Array<{ artist: string; count: number }>>`
      SELECT artist, CAST(COUNT(DISTINCT title) AS INTEGER) as count
      FROM "Song"
      WHERE category = ${cat}::"CategoryType"
      GROUP BY artist
      HAVING COUNT(DISTINCT title) < 4
      ORDER BY count DESC, artist ASC
    `;

    console.log(`Found ${lowSongArtists.length} artists with < 4 songs in ${cat}.`);

    // Extract primary artist names and deduplicate
    const targetArtists = new Set<string>();
    for (const item of lowSongArtists) {
      const primary = extractPrimaryArtist(item.artist).trim();
      // Skip label names or weird symbols
      if (
        primary.length > 1 &&
        !primary.toLowerCase().includes("spicydisc") &&
        !primary.toLowerCase().includes("boxx music") &&
        !primary.toLowerCase().includes("all artist")
      ) {
        targetArtists.add(primary);
      }
    }

    // Also include curated queries for this category to ensure full coverage
    const curated = CATEGORY_QUERIES[cat as SongItem["category"]] || [];
    for (const q of curated) {
      targetArtists.add(q.replace(/\s+(thai|rock|เพลง|วง)\b/gi, "").trim());
    }

    console.log(`Targeting ${targetArtists.size} unique artists to query for ${cat}...`);

    const country = cat.startsWith("THAI") ? "th" : "us";
    let enrichedCount = 0;
    let newSongsTotal = 0;

    for (const artistName of Array.from(targetArtists)) {
      try {
        // Fetch up to 15 top songs for this artist
        const songs = await fetchSongsByQuery(artistName, cat as any, country, 15);
        if (songs.length > 0) {
          const saved = await db.saveSongs(songs);
          if (saved > 0) {
            newSongsTotal += saved;
            enrichedCount++;
            console.log(`  ✅ [${cat}] "${artistName}": saved ${saved} new songs (found ${songs.length})`);
          }
        }
        // Small delay to be polite to iTunes Search API
        await new Promise((r) => setTimeout(r, 120));
      } catch (err) {
        console.error(`  ❌ Failed for "${artistName}":`, err);
      }
    }

    console.log(`🎉 Finished ${cat}: Enriched ${enrichedCount} artists, added ${newSongsTotal} new songs.`);
  }

  console.log("\n=================================================");
  console.log("📊 Final Database Song Statistics:");
  console.log("=================================================");
  const stats = await db.getSongStats();
  for (const [c, count] of Object.entries(stats)) {
    console.log(`  • ${c.padEnd(16)}: ${count} songs`);
  }
  console.log("=================================================\n");

  await db.prisma.$disconnect();
}

enrichArtists().catch((err) => {
  console.error("Enrichment script failed:", err);
  process.exit(1);
});
