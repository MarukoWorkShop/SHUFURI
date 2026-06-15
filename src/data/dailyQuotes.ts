export type DailyQuoteEntry = {
  songTitle: string;
  artist: string;
  jp: string;
  zh: string;
};

export const DAILY_QUOTES: DailyQuoteEntry[] = [
  {
    songTitle: '秋樱',
    artist: '山口百惠',
    jp: '{縦|たて}の{糸|いと}はあなた {横|よこ}の{糸|いと}はわたし',
    zh: '纵向的线是你 横向的线是我',
  },
  {
    songTitle: 'First Love',
    artist: '宇多田光',
    jp: 'あなたと{出会|であ}った{時|とき} {子供|こども}のように{震|ふる}えた',
    zh: '与你相遇时 像孩子般颤抖',
  },
  {
    songTitle: '残酷な天使のテーゼ',
    artist: '高桥洋子',
    jp: '{残酷|ざんこく}な{天使|てんし}のように {少年|しょうねん}よ {神話|しんわ}になれ',
    zh: '像残酷的天使一样 少年啊 成为神话吧',
  },
  {
    songTitle: 'Lemon',
    artist: '米津玄师',
    jp: 'まだ{足|あし}も{踏|ふ}み{出|だ}せない {夏|なつ}の{日|ひ}',
    zh: '仍是未能迈步的 夏日',
  },
  {
    songTitle: '上を向いて歩こう',
    artist: '坂本九',
    jp: '{上|うえ}を{向|む}いて{歩|ある}こう {涙|なみだ}が{止|と}まらない',
    zh: '抬头向前走吧 泪水止不住',
  },
];
