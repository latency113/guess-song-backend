import { db } from "../db";
import { 
  CATEGORY_QUERIES, 
  fetchAppleTopSongsRSS, 
  fetchSongsByQuery,
  type SongItem 
} from "../services/itunes";

async function seedCategory(category: SongItem["category"]) {
  console.log(`\n🎵 [Seeding] Category: ${category}...`);
  const country = category.startsWith("THAI") ? "th" : "us";
  const queries = CATEGORY_QUERIES[category] || [];
  const songs: SongItem[] = [];
  const seenUrls = new Set<string>();

  // 1. Fetch Apple RSS Top 100 if applicable
  if (category === "THAI_HITS" || category === "GLOBAL_POP") {
    try {
      console.log(`  📡 Fetching Apple Music Top 100 RSS (${country.toUpperCase()})...`);
      const rssSongs = await fetchAppleTopSongsRSS(category, country, 100);
      for (const s of rssSongs) {
        if (!seenUrls.has(s.previewUrl)) {
          seenUrls.add(s.previewUrl);
          songs.push(s);
        }
      }
      console.log(`     -> Got ${rssSongs.length} tracks from Apple Top Charts.`);
    } catch (e) {
      console.error(`     ❌ Failed to fetch RSS for ${category}:`, e);
    }
  }

  // 2. Query artists / labels / keywords from CATEGORY_QUERIES
  console.log(`  🔍 Fetching tracks from ${queries.length} curated queries...`);
  // Process in batches of 3 to respect iTunes rate limits
  const batchSize = 3;
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (q) => {
        try {
          const results = await fetchSongsByQuery(q, category, country, 25);
          for (const s of results) {
            if (!seenUrls.has(s.previewUrl)) {
              seenUrls.add(s.previewUrl);
              songs.push(s);
            }
          }
        } catch {
          // ignore query error
        }
      })
    );
    // Pause between query batches
    await new Promise((resolve) => setTimeout(resolve, 450));
  }

  console.log(`  💾 Saving ${songs.length} fetched songs into database...`);
  const insertedCount = await db.saveSongs(songs);
  console.log(`  ✅ Successfully saved ${insertedCount} new unique songs into PostgreSQL!`);
}

async function main() {
  console.log("==========================================");
  console.log("🚀 Starting Song Catalog Database Seeder");
  console.log("==========================================");

  const categories: SongItem["category"][] = [
    "THAI_HITS",
    "THAI_INDIE_ROCK",
    "GLOBAL_POP",
    "GLOBAL_CLASSIC"
  ];

  for (const cat of categories) {
    await seedCategory(cat);
  }

  console.log("\n==========================================");
  console.log("📊 Database Song Catalog Summary:");
  console.log("==========================================");
  const stats = await db.getSongStats();
  let total = 0;
  for (const [cat, count] of Object.entries(stats)) {
    console.log(`  • ${cat.padEnd(16)}: ${count} songs`);
    total += count;
  }
  console.log(`------------------------------------------`);
  console.log(`  Total in DB       : ${total} songs`);
  console.log("==========================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
