import { useMemo } from 'react';
import { applyRubyMarkup } from '../utils/rubyMarkup';
import { getDailyQuote } from '../utils/getDailyQuote';

export default function DailyQuote() {
  const quote = useMemo(() => getDailyQuote(), []);

  return (
    <aside className="daily-quote" aria-label="每日金句">
      <p
        className="daily-quote__jp"
        dangerouslySetInnerHTML={{ __html: applyRubyMarkup(quote.jp) }}
      />
      <p className="daily-quote__zh">{quote.zh}</p>
      <p className="daily-quote__meta">
        {quote.songTitle} · {quote.artist}
      </p>
    </aside>
  );
}
