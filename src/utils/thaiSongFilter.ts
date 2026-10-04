/**
 * Utility for verifying whether a song belongs to the Thai music categories
 * (THAI_HITS and THAI_INDIE_ROCK).
 * 
 * Prevents non-Thai songs (Western Pop, K-Pop, J-Pop, Chinese OSTs) from 
 * leaking into Thai game categories.
 */

export const KNOWN_THAI_KEYWORDS: string[] = [
  // Modern T-Pop & Pop Artists
  "three man down", "tilly birds", "bowkylion", "nont tanont", "jeff satur", 
  "cocktail", "ohm cocktail", "tattoo colour", "ink waruntorn", "billkin", "pp krit", 
  "violette wautier", "urboytj", "urboy tj", "f.hero", "f-hero", "f hero", 
  "milli", "the toys", "paper planes", "fellow fellow", "serious bacon", 
  "proxie", "4eve", "atlas", "bus because of you i shine", "bus", "pixxie", 
  "nunew", "zee pruk", "ally", "sarah salola", "safeplanet", "dept", 
  "mirrr", "loserpop", "purpeech", "no one else", "mean", "mean band", "whal & dolph", 
  "landokmai", "television off", "perses", "dice", "alala", "bamm", 
  "qrra", "pretzelle", "mxfruit", "viis", "empress", "lykn", "badmixy",

  // Thai Indie, Neo-Soul & Alternative
  "anatomy rabbit", "polycat", "department of architecture", "moderndog", 
  "scrubb", "the yers", "desktop error", "solitude is bliss", "moving and cut", 
  "yented", "h 3 f", "h3f", "hybs", "phum viphurit", "temp.", "folk9", 
  "blackbeans", "slur", "lemon soup", "t_047", "t 047", "freehand", 
  "quick sands bed", "yew", "guncharlie", "the white hair cut", "penguin villa", 
  "superbaker", "armchair", "flure", "crescendo", "etc.", "groove riders", 
  "pause", "friday", "2 days ago kids", "soul after six", "p.o.p", 
  "boyd kosiyabong", "nop ponchamni", "trai bhumiratna", "the parkinson", 
  "greasy cafe", "t-bone", "poy portrait", "the mousses", "triumphs kingdom",

  // Thai Rock & Metal
  "bodyslam", "big ass", "slot machine", "potato", "pup potato", "labanoon", 
  "paradox", "silly fools", "loso", "sek loso", "palmy", "clash", 
  "zeal", "pex zeal", "retrospect", "sweet mullet", "tao sweet mullet", "taitosmith", "bomb at track", 
  "blackhead", "วง ฟลาย", "rock rider", "ebola", "lomosonic", "playground", 
  "musketeers", "25 hours", "25hours", "asanee wasan", "micro", "nuvo", "hin lek fai", 
  "the sun", "smf", "the must", "carabao", "pongsit", "maleehuana", "kwang abnormal",

  // Thai Hip-Hop, Rap & R&B
  "youngohm", "1mill", "saran", "sprite", "meyou", "pun", "d gerrard", 
  "lazyloxy", "cd guntee", "og-anic", "twopee", "southside", "daboyway", 
  "pok mindset",

  // Mainstream Pop, 90s-2000s Classics & Labels
  "lipta", "stamp", "singto numchok", "getsunova", "klear", "mild", 
  "season five", "room39", "two popetorn", "wan thanakrit", "burin boonvisut", 
  "peck palitchoke", "aof pongsak", "da endorphine", "new jiew", "lula", 
  "pango", "earth patravee", "atom chanakan", "kacha nontanun", "boydpod", 
  "marc tatchapon", "pete pol", "pimthitiii", "fai patthaya", "funky wah wah", 
  "wahncai", "massaman", "monik", "waii", "timethai", "zaza", "d2b", 
  "k-otic", "kamikaze", "four mod", "faye fang kaew", "c-quint", "golf mike", 
  "chin chinawut", "ice sarunyu", "bie sukrit", "gun napat", "dome jaruwat", 
  "tum warawut", "gam wichayanee", "ploychompoo", "jannine weigel", 
  "oat pramote", "pop pongkool", "singharat", "j jetrin", "christina aguilar", 
  "tata young", "mos patiparn", "uht", "raptor", "tik shiro",
  "zom marie", "slapkiss", "ayla's", "aylas", "jetset'er", "jetseter", "rose sirintip",
  "tor+ saksit", "tor saksit", "nap a lean", "napalean", "autta", "bow maylada",
  "calories blah blah", "death of a salesman", "meentra intira", "p-hot", "pee clock",
  "win siriwong", "ปลานิลเต็มบ้าน", "เรนิษรา", "sudkhate",
  "bonnie pattraphus", "joong archen", "moor", "yes'sir days", "yessir days",
  "k6y", "rifle", "1st", "7days crazy", "blvckheart", "boy sompob", "cincin irada",
  "first anuwat", "gavin:d", "gawin", "goodmood", "jayrun", "khaotung",
  "matcha", "mikesickflow", "nineilx", "somkiat", "spoonfulz", "temi", "tigger",
  "the darkest romance", "the jukks", "tor wasan", "wanyai", "yong armchair", "z9",
  "zentyarb", "bonnadol", "chokla999", "เต๋า ภรัณวัฒน์", "แด๊ก rock rider", "แม็กก้า",
  "gmm grammy", "what the duck", "smallroom", "spicydisc", "t-pop"
];

const KNOWN_THAI_SET = new Set(KNOWN_THAI_KEYWORDS.map((k) => k.toLowerCase().trim()));

// Explicit list of known foreign artists/track types that must never enter Thai categories
const BLOCKED_FOREIGN_ARTISTS = [
  "montefiori cocktail",
  "cocktail bananas",
  "dane amar"
];

const BLOCKED_TRACK_SUBSTRINGS = [
  "epic version",
  "baywatch",
  "ducktales",
  "thundercats",
  "knight rider",
  "inspector gadget"
];

/**
 * Validates if a song is authentically Thai.
 * 
 * Rules:
 * 1. Reject blocked foreign artists and compilation junk.
 * 2. If either title or artist contains Thai characters (U+0E00 to U+0E7F), return true.
 * 3. If title or artist contains CJK characters (Chinese, Japanese, Korean) and no Thai characters, return false.
 * 4. If written in Latin/English, verify that at least one primary or featured collaborator matches known Thai artists.
 */
export function isGenuineThaiSong(title: string, artist: string): boolean {
  if (!title || !artist) return false;

  const lowerArtist = artist.toLowerCase().trim();
  const lowerTitle = title.toLowerCase().trim();

  // 1. Explicit foreign artist rejection
  for (const blocked of BLOCKED_FOREIGN_ARTISTS) {
    if (lowerArtist.includes(blocked)) return false;
  }

  // Reject foreign theme covers / compilation artists
  for (const theme of BLOCKED_TRACK_SUBSTRINGS) {
    if (lowerTitle.includes(theme)) return false;
  }

  if (
    lowerArtist.includes("spicydisc light") ||
    lowerTitle.includes("spicydisc light") ||
    lowerArtist === "boxx music" ||
    lowerArtist.includes("what the duck all artist")
  ) {
    return false;
  }

  // 2. Thai Unicode Range (Thai alphabet & vowels)
  if (/[\u0E00-\u0E7F]/.test(title) || /[\u0E00-\u0E7F]/.test(artist)) {
    return true;
  }

  // 3. Reject East Asian characters (Chinese, Japanese, Korean) when there are no Thai characters
  if (
    /[\u4E00-\u9FFF\uAC00-\uD7AF\u3040-\u30FF]/.test(title) || 
    /[\u4E00-\u9FFF\uAC00-\uD7AF\u3040-\u30FF]/.test(artist)
  ) {
    return false;
  }

  // 4. For Latin/English titles & artists, split into collaborators and verify authentic Thai artist
  const collabs = artist
    .split(/\s*(?:feat\.|ft\.|featuring|&|\bwith\b|\bx\b|\bX\b|และ|,|\/)\s*/i)
    .map((s) => s.trim().toLowerCase().replace(/^วง\s+/i, ""))
    .filter(Boolean);

  for (const c of collabs) {
    if (KNOWN_THAI_SET.has(c)) {
      return true;
    }
    for (const kw of KNOWN_THAI_KEYWORDS) {
      if (kw.length >= 4 && (c === kw || c.startsWith(kw + " ") || c.endsWith(" " + kw))) {
        return true;
      }
    }
  }

  return false;
}
