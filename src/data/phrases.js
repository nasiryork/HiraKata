// Trip phrase pool. `tier` = release week (a phrase enters the pool when tier <= the plan's newTier).
// `frame: true` = fill-in-the-blank pattern (swap the noun).
export const PHRASES = [
  {
    "id": 1,
    "jp": "すごい！",
    "romaji": "sugoi",
    "en": "Wow / amazing",
    "group": "feelings",
    "frame": false,
    "tier": 1
  },
  {
    "id": 2,
    "jp": "きれい",
    "romaji": "kirei",
    "en": "Beautiful, pretty",
    "group": "feelings",
    "frame": false,
    "tier": 1
  },
  {
    "id": 3,
    "jp": "すごくきれいですね",
    "romaji": "sugoku kirei desu ne",
    "en": "That's really beautiful",
    "group": "feelings",
    "frame": false,
    "tier": 1
  },
  {
    "id": 4,
    "jp": "この景色、最高ですね",
    "romaji": "kono keshiki, saikou desu ne",
    "en": "This view is the best",
    "group": "feelings",
    "frame": false,
    "tier": 1
  },
  {
    "id": 5,
    "jp": "山がきれいですね",
    "romaji": "yama ga kirei desu ne",
    "en": "The mountains are beautiful",
    "group": "feelings",
    "frame": false,
    "tier": 1
  },
  {
    "id": 6,
    "jp": "いいですね",
    "romaji": "ii desu ne",
    "en": "Nice / sounds good",
    "group": "feelings",
    "frame": false,
    "tier": 1
  },
  {
    "id": 7,
    "jp": "ばっちりです",
    "romaji": "bacchiri desu",
    "en": "Perfect (use for \"did the photo come out good?\")",
    "group": "feelings",
    "frame": false,
    "tier": 1
  },
  {
    "id": 8,
    "jp": "最高です",
    "romaji": "saikou desu",
    "en": "The best",
    "group": "feelings",
    "frame": false,
    "tier": 1
  },
  {
    "id": 9,
    "jp": "楽しいです",
    "romaji": "tanoshii desu",
    "en": "It's fun",
    "group": "feelings",
    "frame": false,
    "tier": 1
  },
  {
    "id": 10,
    "jp": "楽しかったです",
    "romaji": "tanoshikatta desu",
    "en": "It was fun",
    "group": "feelings",
    "frame": false,
    "tier": 1
  },
  {
    "id": 11,
    "jp": "おもしろいです",
    "romaji": "omoshiroi desu",
    "en": "It's interesting / funny (NOT \"tasty\")",
    "group": "feelings",
    "frame": false,
    "tier": 1
  },
  {
    "id": 12,
    "jp": "疲れました",
    "romaji": "tsukaremashita",
    "en": "I'm tired",
    "group": "feelings",
    "frame": false,
    "tier": 1
  },
  {
    "id": 13,
    "jp": "好きです",
    "romaji": "suki desu",
    "en": "I like it",
    "group": "likes",
    "frame": false,
    "tier": 1
  },
  {
    "id": 14,
    "jp": "大好きです",
    "romaji": "daisuki desu",
    "en": "I love it",
    "group": "likes",
    "frame": false,
    "tier": 1
  },
  {
    "id": 15,
    "jp": "あまり好きじゃないです",
    "romaji": "amari suki janai desu",
    "en": "I don't like it much",
    "group": "likes",
    "frame": false,
    "tier": 1
  },
  {
    "id": 16,
    "jp": "アニメが好きです",
    "romaji": "anime ga suki desu",
    "en": "I like anime",
    "group": "likes",
    "frame": false,
    "tier": 1
  },
  {
    "id": 17,
    "jp": "好きなアニメは何ですか",
    "romaji": "sukina anime wa nan desu ka",
    "en": "What anime do you like?",
    "group": "likes",
    "frame": false,
    "tier": 1
  },
  {
    "id": 18,
    "jp": "___が一番好きです",
    "romaji": "___ ga ichiban suki desu",
    "en": "___ is my favorite",
    "group": "likes",
    "frame": true,
    "tier": 1
  },
  {
    "id": 19,
    "jp": "おいしいです",
    "romaji": "oishii desu",
    "en": "It's delicious",
    "group": "food",
    "frame": false,
    "tier": 2
  },
  {
    "id": 20,
    "jp": "めっちゃおいしい",
    "romaji": "meccha oishii",
    "en": "Super delicious (casual)",
    "group": "food",
    "frame": false,
    "tier": 2
  },
  {
    "id": 21,
    "jp": "このえびの天ぷら、おいしいです",
    "romaji": "kono ebi no tenpura, oishii desu",
    "en": "This shrimp tempura is delicious",
    "group": "food",
    "frame": false,
    "tier": 2
  },
  {
    "id": 22,
    "jp": "ごちそうさまでした",
    "romaji": "gochisousama deshita",
    "en": "Thanks for the meal (after)",
    "group": "food",
    "frame": false,
    "tier": 2
  },
  {
    "id": 23,
    "jp": "いただきます",
    "romaji": "itadakimasu",
    "en": "Thanks for the meal (before)",
    "group": "food",
    "frame": false,
    "tier": 2
  },
  {
    "id": 24,
    "jp": "これをください",
    "romaji": "kore o kudasai",
    "en": "This one, please",
    "group": "food",
    "frame": false,
    "tier": 2
  },
  {
    "id": 25,
    "jp": "牛肉と豚肉は食べません",
    "romaji": "gyuuniku to butaniku wa tabemasen",
    "en": "I don't eat beef or pork",
    "group": "food",
    "frame": false,
    "tier": 2
  },
  {
    "id": 26,
    "jp": "鶏肉と魚は食べます",
    "romaji": "toriniku to sakana wa tabemasu",
    "en": "I eat chicken and fish",
    "group": "food",
    "frame": false,
    "tier": 2
  },
  {
    "id": 27,
    "jp": "水をください",
    "romaji": "mizu o kudasai",
    "en": "Water, please",
    "group": "food",
    "frame": false,
    "tier": 2
  },
  {
    "id": 28,
    "jp": "お会計お願いします",
    "romaji": "okaikei onegaishimasu",
    "en": "The check, please",
    "group": "food",
    "frame": false,
    "tier": 2
  },
  {
    "id": 29,
    "jp": "___はありますか",
    "romaji": "___ wa arimasu ka",
    "en": "Do you have ___?",
    "group": "food",
    "frame": true,
    "tier": 2
  },
  {
    "id": 30,
    "jp": "はじめまして。ナシルです",
    "romaji": "hajimemashite. Nashiru desu",
    "en": "Nice to meet you, I'm Nasir",
    "group": "talk",
    "frame": false,
    "tier": 2
  },
  {
    "id": 31,
    "jp": "ニューヨークから来ました",
    "romaji": "nyuuyooku kara kimashita",
    "en": "I'm from New York",
    "group": "talk",
    "frame": false,
    "tier": 2
  },
  {
    "id": 32,
    "jp": "日本は三回目です",
    "romaji": "nihon wa sankaime desu",
    "en": "It's my third time in Japan",
    "group": "talk",
    "frame": false,
    "tier": 2
  },
  {
    "id": 33,
    "jp": "日本語はまだ勉強中です",
    "romaji": "nihongo wa mada benkyouchuu desu",
    "en": "I'm still studying Japanese",
    "group": "talk",
    "frame": false,
    "tier": 2
  },
  {
    "id": 34,
    "jp": "少しだけ話せます",
    "romaji": "sukoshi dake hanasemasu",
    "en": "I can speak a little",
    "group": "talk",
    "frame": false,
    "tier": 2
  },
  {
    "id": 35,
    "jp": "ゆっくりお願いします",
    "romaji": "yukkuri onegaishimasu",
    "en": "Slowly, please",
    "group": "talk",
    "frame": false,
    "tier": 2
  },
  {
    "id": 36,
    "jp": "もう一度お願いします",
    "romaji": "mou ichido onegaishimasu",
    "en": "One more time, please",
    "group": "talk",
    "frame": false,
    "tier": 2
  },
  {
    "id": 37,
    "jp": "ちょっと待ってください",
    "romaji": "chotto matte kudasai",
    "en": "Please wait a moment",
    "group": "talk",
    "frame": false,
    "tier": 2
  },
  {
    "id": 38,
    "jp": "ありがとうございます",
    "romaji": "arigatou gozaimasu",
    "en": "Thank you",
    "group": "talk",
    "frame": false,
    "tier": 2
  },
  {
    "id": 39,
    "jp": "写真を撮ってもらえますか",
    "romaji": "shashin o totte moraemasu ka",
    "en": "Could you take my photo?",
    "group": "talk",
    "frame": false,
    "tier": 2
  },
  {
    "id": 40,
    "jp": "分かりません",
    "romaji": "wakarimasen",
    "en": "I don't understand",
    "group": "talk",
    "frame": false,
    "tier": 2
  },
  {
    "id": 41,
    "jp": "___はどこですか",
    "romaji": "___ wa doko desu ka",
    "en": "Where is ___?",
    "group": "directions",
    "frame": true,
    "tier": 3
  },
  {
    "id": 42,
    "jp": "ここですか",
    "romaji": "koko desu ka",
    "en": "Here?",
    "group": "directions",
    "frame": false,
    "tier": 3
  },
  {
    "id": 43,
    "jp": "トイレはどこですか",
    "romaji": "toire wa doko desu ka",
    "en": "Where's the bathroom?",
    "group": "directions",
    "frame": false,
    "tier": 3
  },
  {
    "id": 44,
    "jp": "いくらですか",
    "romaji": "ikura desu ka",
    "en": "How much?",
    "group": "directions",
    "frame": false,
    "tier": 3
  },
  {
    "id": 45,
    "jp": "ちょっと見ているだけです",
    "romaji": "chotto mite iru dake desu",
    "en": "Just looking",
    "group": "directions",
    "frame": false,
    "tier": 3
  },
  {
    "id": 46,
    "jp": "ウニ",
    "romaji": "uni",
    "en": "Sea urchin (Nijo Market)",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 47,
    "jp": "ホタテ",
    "romaji": "hotate",
    "en": "Scallop",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 48,
    "jp": "カニ",
    "romaji": "kani",
    "en": "Crab (king crab = タラバガニ taraba-gani)",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 49,
    "jp": "牡蠣 / かき",
    "romaji": "kaki",
    "en": "Oyster",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 50,
    "jp": "海鮮丼",
    "romaji": "kaisendon",
    "en": "Seafood rice bowl",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 51,
    "jp": "スープカレー",
    "romaji": "suupu karee",
    "en": "Soup curry",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 52,
    "jp": "ラーメン",
    "romaji": "raamen",
    "en": "Ramen",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 53,
    "jp": "味噌 / しお / しょうゆ",
    "romaji": "miso / shio / shoyu",
    "en": "Ramen broth types",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 54,
    "jp": "チャーシューなしでお願いします",
    "romaji": "chaashuu nashi de onegaishimasu",
    "en": "No chashu (pork) please",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 55,
    "jp": "唐揚げ / ザンギ",
    "romaji": "karaage / zangi",
    "en": "Fried chicken (zangi is the Hokkaido name)",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 56,
    "jp": "ソフトクリーム",
    "romaji": "sofuto kuriimu",
    "en": "Soft serve",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 57,
    "jp": "ジンギスカン",
    "romaji": "jingisukan",
    "en": "Lamb grill (he can eat lamb, not beef or pork, so check the sauce and sides)",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 58,
    "jp": "ビール",
    "romaji": "biiru",
    "en": "Beer (Sapporo Beer Museum)",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 59,
    "jp": "おにぎり",
    "romaji": "onigiri",
    "en": "Rice ball (Seicomart)",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  },
  {
    "id": 60,
    "jp": "豚肉は入っていますか",
    "romaji": "butaniku wa haitte imasu ka",
    "en": "Does it have pork in it?",
    "group": "sapporo",
    "frame": false,
    "tier": 4
  }
];

const FOOD = [
  { jp: 'ラーメン', romaji: 'raamen', en: 'ramen' },
  { jp: 'すし', romaji: 'sushi', en: 'sushi' },
  { jp: 'てんぷら', romaji: 'tenpura', en: 'tempura' },
  { jp: 'うどん', romaji: 'udon', en: 'udon' },
  { jp: 'カレー', romaji: 'karee', en: 'curry' },
  { jp: 'ビール', romaji: 'biiru', en: 'beer' },
  { jp: 'お茶', romaji: 'ocha', en: 'tea' },
  { jp: 'コーヒー', romaji: 'koohii', en: 'coffee' },
];
const PLACES = [
  { jp: '駅', romaji: 'eki', en: 'the station' },
  { jp: 'トイレ', romaji: 'toire', en: 'the toilet' },
  { jp: 'ホテル', romaji: 'hoteru', en: 'the hotel' },
  { jp: 'バス停', romaji: 'basutei', en: 'the bus stop' },
  { jp: 'コンビニ', romaji: 'konbini', en: 'the convenience store' },
  { jp: '空港', romaji: 'kuukou', en: 'the airport' },
  { jp: '病院', romaji: 'byouin', en: 'the hospital' },
  { jp: '出口', romaji: 'deguchi', en: 'the exit' },
];

// Noun choices for frame drills, keyed by phrase group.
export const FRAME_NOUNS = { likes: FOOD, food: FOOD, directions: PLACES };
