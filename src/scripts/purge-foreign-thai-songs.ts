import { db } from "../db";
import { isGenuineThaiSong } from "../utils/thaiSongFilter";

async function purgeForeignSongs() {
  console.log("=================================================");
  console.log("🧹 Purging Non-Thai Songs from THAI Categories");
  console.log("=================================================");

  const thaiSongs = await db.prisma.song.findMany({
    where: { category: { in: ["THAI_HITS", "THAI_INDIE_ROCK"] } },
    select: { id: true, title: true, artist: true, category: true }
  });

  console.log(`Found ${thaiSongs.length} songs in THAI_HITS & THAI_INDIE_ROCK.`);

  const invalidSongs = thaiSongs.filter((s) => !isGenuineThaiSong(s.title, s.artist));
  console.log(`Identified ${invalidSongs.length} non-Thai foreign songs to remove.`);

  if (invalidSongs.length === 0) {
    console.log("✨ No foreign songs found. Database is already clean!");
    process.exit(0);
  }

  const idsToDelete = invalidSongs.map((s) => s.id);

  const deleteResult = await db.prisma.song.deleteMany({
    where: { id: { in: idsToDelete } }
  });

  console.log(`✅ Successfully deleted ${deleteResult.count} non-Thai tracks from PostgreSQL!`);

  console.log("\nSample of purged foreign songs:");
  invalidSongs.slice(0, 25).forEach((s, idx) => {
    console.log(`  ${idx + 1}. [${s.category}] "${s.title}" - ${s.artist}`);
  });

  console.log("\n=================================================");
  console.log("📊 Remaining Song Statistics:");
  console.log("=================================================");
  const stats = await db.getSongStats();
  for (const [cat, count] of Object.entries(stats)) {
    console.log(`  • ${cat.padEnd(16)}: ${count} songs`);
  }
  console.log("=================================================\n");

  await db.prisma.$disconnect();
}

purgeForeignSongs().catch((err) => {
  console.error("Error purging foreign songs:", err);
  process.exit(1);
});
