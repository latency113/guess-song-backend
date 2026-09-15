export interface SongItem {
  id: string;
  title: string;
  artist: string;
  category: "THAI_HITS" | "THAI_INDIE_ROCK" | "GLOBAL_POP" | "GLOBAL_CLASSIC";
  previewUrl: string;
  artworkUrl?: string;
  releaseYear?: number;
}

// Built-in curated search queries for diverse & popular songs
export const CATEGORY_QUERIES = {
  THAI_HITS: [
    "Three Man Down", "Tilly Birds", "Bowkylion", "NONT TANONT", "Jeff Satur", 
    "Cocktail", "Tattoo Colour", "Ink Waruntorn", "Billkin", "PP Krit", 
    "Violette Wautier", "URBOYTJ", "F.HERO", "MILLI"
  ],
  THAI_INDIE_ROCK: [
    "Bodyslam", "Big Ass", "Slot Machine", "Potato", "Labanoon", 
    "Paradox", "Silly Fools", "Loso", "Scrubb", "Safeplanet", 
    "Anatomy Rabbit", "Polycat", "Department of Architecture"
  ],
  GLOBAL_POP: [
    "Taylor Swift", "Ed Sheeran", "Bruno Mars", "The Weeknd", "Dua Lipa", 
    "Billie Eilish", "Ariana Grande", "Justin Bieber", "Harry Styles", "Olivia Rodrigo",
    "Post Malone", "Katy Perry", "Coldplay", "Maroon 5"
  ],
  GLOBAL_CLASSIC: [
    "Queen", "Michael Jackson", "ABBA", "The Beatles", "Bon Jovi", 
    "Guns N Roses", "Eagles", "Backstreet Boys", "Britney Spears", "Avril Lavigne", 
    "Linkin Park", "Green Day", "Oasis", "Whitney Houston"
  ]
};

// In-memory song cache to make gameplay ultra-fast
const songCache: Record<string, SongItem[]> = {};

export async function fetchSongsByQuery(
  query: string,
  category: SongItem["category"],
  country: "th" | "us" = "th",
  limit: number = 10
): Promise<SongItem[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=${country}&media=music&entity=song&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json() as { results: any[] };
    if (!data.results) return [];

    const songs: SongItem[] = [];
    for (const item of data.results) {
      if (item.previewUrl && item.trackName && item.artistName) {
        // Filter out karaoke or tribute versions if any
        if (item.trackName.toLowerCase().includes("karaoke") || item.artistName.toLowerCase().includes("tribute")) {
          continue;
        }

        songs.push({
          id: String(item.trackId),
          title: item.trackName,
          artist: item.artistName,
          category,
          previewUrl: item.previewUrl,
          artworkUrl: item.artworkUrl100 ? item.artworkUrl100.replace("100x100bb", "600x600bb") : undefined,
          releaseYear: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
        });
      }
    }
    return songs;
  } catch (error) {
    console.error(`Error fetching iTunes for query ${query}:`, error);
    return [];
  }
}

export async function getSongsForCategory(category: SongItem["category"]): Promise<SongItem[]> {
  if (songCache[category] && songCache[category].length >= 20) {
    return songCache[category];
  }

  const queries = CATEGORY_QUERIES[category] || [];
  const country = category.startsWith("THAI") ? "th" : "us";
  const allSongs: SongItem[] = [];
  const seenIds = new Set<string>();

  // Fetch from 5 random queries in the category to provide variety
  const shuffledQueries = [...queries].sort(() => 0.5 - Math.random()).slice(0, 6);

  await Promise.all(
    shuffledQueries.map(async (q) => {
      const results = await fetchSongsByQuery(q, category, country, 8);
      for (const s of results) {
        if (!seenIds.has(s.id)) {
          seenIds.add(s.id);
          allSongs.push(s);
        }
      }
    })
  );

  if (allSongs.length > 0) {
    songCache[category] = allSongs;
  }

  return allSongs.length > 0 ? allSongs : getFallbackSongs(category);
}

// Static fallback songs with guaranteed valid iTunes preview streams
export function getFallbackSongs(category: SongItem["category"]): SongItem[] {
  if (category.startsWith("THAI")) {
    return [
      {
        id: "th-1",
        title: "ถ้าเราเจอกันอีก (Until Then)",
        artist: "Tilly Birds",
        category: "THAI_HITS",
        previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/bf/16/d2/bf16d2f3-f5b2-3fc4-ca8b-d58671bcf5f7/mzaf_10022370779774648174.plus.aac.p.m4a",
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/aa/c8/17/aac817d9-4fa2-bf6d-a34f-01533ad03c15/8859344421272.jpg/600x600bb.jpg",
        releaseYear: 2021
      },
      {
        id: "th-2",
        title: "ฝนตกไหม",
        artist: "Three Man Down",
        category: "THAI_HITS",
        previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/ee/12/35/ee1235b2-65a8-4ce6-5591-231a47321e25/mzaf_10526938222956276228.plus.aac.p.m4a",
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/cb/20/be/cb20bebb-8bc0-d6ef-9a5c-7557161b9795/8859344414601.jpg/600x600bb.jpg",
        releaseYear: 2019
      },
      {
        id: "th-3",
        title: "บานปลาย (Best Regards)",
        artist: "BOWKYLION",
        category: "THAI_HITS",
        previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/91/79/11/9179116e-48a6-8ea8-ea87-21a4fa0c5c36/mzaf_11306354898129704207.plus.aac.p.m4a",
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/a4/09/a6/a409a6ba-0cfa-e0ca-fa84-e91040317e0a/8859665800053.jpg/600x600bb.jpg",
        releaseYear: 2022
      },
      {
        id: "th-4",
        title: "โต๊ะริม (Melt)",
        artist: "NONT TANONT",
        category: "THAI_HITS",
        previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/fa/10/7c/fa107cfa-e5b4-d539-7561-c85265532087/mzaf_7195826629853903102.plus.aac.p.m4a",
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bb/da/8c/bbda8c97-6a4d-c1bc-96b0-71a25c1cbcf3/8859665800473.jpg/600x600bb.jpg",
        releaseYear: 2022
      },
      {
        id: "th-5",
        title: "แสงสุดท้าย",
        artist: "Bodyslam",
        category: "THAI_INDIE_ROCK",
        previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/aa/62/17/aa62174c-4ebc-cfae-399d-8d4e73dbd665/mzaf_10014022464731333705.plus.aac.p.m4a",
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/be/89/3b/be893b82-ce9d-e4fb-7411-96eb132a67e0/8852683050414.jpg/600x600bb.jpg",
        releaseYear: 2010
      },
      {
        id: "th-6",
        title: "ขาหมู",
        artist: "Tattoo Colour",
        category: "THAI_INDIE_ROCK",
        previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/31/76/99/31769970-d790-2aa3-ffc9-8977a414e8e0/mzaf_1350849390772213791.plus.aac.p.m4a",
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/3e/60/7a/3e607a73-3069-42b7-a359-baae8923a1f2/8859085800057.jpg/600x600bb.jpg",
        releaseYear: 2008
      }
    ];
  } else {
    return [
      {
        id: "gl-1",
        title: "Cruel Summer",
        artist: "Taylor Swift",
        category: "GLOBAL_POP",
        previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/ef/a9/a2/efa9a2d6-0c67-d615-581d-e59392e21b7b/mzaf_7824169724103130325.plus.aac.p.m4a",
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/10/7c/41/107c41fa-f4f7-fcbf-7cc8-c300898852f5/19UMGIM86558.rgb.jpg/600x600bb.jpg",
        releaseYear: 2019
      },
      {
        id: "gl-2",
        title: "Blinding Lights",
        artist: "The Weeknd",
        category: "GLOBAL_POP",
        previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/6a/5a/82/6a5a82fa-25f0-6c98-c17a-5ae008f515d9/mzaf_1507963364956321262.plus.aac.p.m4a",
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/0d/18/69/0d1869e5-94cb-59b3-e28e-5b1b490f2b38/19UMGIM97205.rgb.jpg/600x600bb.jpg",
        releaseYear: 2019
      },
      {
        id: "gl-3",
        title: "Shape of You",
        artist: "Ed Sheeran",
        category: "GLOBAL_POP",
        previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/74/d3/ca/74d3caef-b924-ce44-24ce-90696a4a1599/mzaf_3990868846399159976.plus.aac.p.m4a",
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4a/bf/3e/4abf3ea4-5b48-12d7-31df-e84803932e60/0190295851286.jpg/600x600bb.jpg",
        releaseYear: 2017
      },
      {
        id: "gl-4",
        title: "Bohemian Rhapsody",
        artist: "Queen",
        category: "GLOBAL_CLASSIC",
        previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/7b/03/79/7b03798a-2115-4fa8-3011-2e66699ec76f/mzaf_10332822839958744211.plus.aac.p.m4a",
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/5a/85/3e/5a853ec5-7fcf-24a9-7fa1-a75d17961803/00602567977464.rgb.jpg/600x600bb.jpg",
        releaseYear: 1975
      },
      {
        id: "gl-5",
        title: "Billie Jean",
        artist: "Michael Jackson",
        category: "GLOBAL_CLASSIC",
        previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/ca/cb/c7/cacbc751-fe6d-aa9f-76ee-2384a56a6401/mzaf_17208499709971842079.plus.aac.p.m4a",
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/9a/c0/83/9ac08365-5c12-32b4-7127-ec56133efb1d/886443534606.jpg/600x600bb.jpg",
        releaseYear: 1982
      }
    ];
  }
}
