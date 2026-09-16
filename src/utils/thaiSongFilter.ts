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
  "cocktail", "tattoo colour", "ink waruntorn", "billkin", "pp krit", 
  "violette wautier", "urboytj", "urboy tj", "f.hero", "f-hero", "f hero", 
  "milli", "the toys", "paper planes", "fellow fellow", "serious bacon", 
  "proxie", "4eve", "atlas", "bus because of you i shine", "bus", "pixxie", 
  "nunew", "zee pruk", "ally", "sarah salola", "safeplanet", "dept", 
  "mirrr", "loserpop", "purpeech", "no one else", "mean", "whal & dolph", 
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
  "bodyslam", "big ass", "slot machine", "potato", "labanoon", 
  "paradox", "silly fools", "loso", "sek loso", "palmy", "clash", 
  "zeal", "retrospect", "sweet mullet", "taitosmith", "bomb at track", 
  "blackhead", "fly", "rock rider", "ebola", "lomosonic", "playground", 
  "musketeers", "25hours", "asanee wasan", "micro", "nuvo", "hin lek fai", 
  "the sun", "smf", "the must", "carabao", "pongsit", "maleehuana",

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
  "gmm grammy", "what the duck", "smallroom", "spicydisc", "boxx music", "t-pop"
];

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Validates if a song is authentically Thai.
 * 
 * Rules:
 * 1. If either title or artist contains Thai characters (U+0E00 to U+0E7F), return true.
 * 2. If title or artist contains CJK characters (Chinese, Japanese, Korean) and no Thai characters, return false.
 * 3. If written in Latin/English, the artist must match a known Thai artist/label keyword (using word boundaries).
 */
export function isGenuineThaiSong(title: string, artist: string): boolean {
  if (!title || !artist) return false;

  // 1. Thai Unicode Range (Thai alphabet & vowels)
  if (/[\u0E00-\u0E7F]/.test(title) || /[\u0E00-\u0E7F]/.test(artist)) {
    return true;
  }

  // 2. Reject East Asian characters (Chinese, Japanese, Korean) when there are no Thai characters
  if (
    /[\u4E00-\u9FFF\uAC00-\uD7AF\u3040-\u30FF]/.test(title) || 
    /[\u4E00-\u9FFF\uAC00-\uD7AF\u3040-\u30FF]/.test(artist)
  ) {
    return false;
  }

  // 3. For Latin/English titles & artists, verify against known Thai artist names
  const cleanArtist = artist.trim();
  return KNOWN_THAI_KEYWORDS.some((kw) => {
    const escaped = escapeRegExp(kw);
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(cleanArtist);
  });
}
