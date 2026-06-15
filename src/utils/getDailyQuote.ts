import { DAILY_QUOTES, type DailyQuoteEntry } from '../data/dailyQuotes';

function getLocalDayIndex(): number {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
}

export function getDailyQuote(): DailyQuoteEntry {
  const index = getLocalDayIndex() % DAILY_QUOTES.length;
  return DAILY_QUOTES[index]!;
}
