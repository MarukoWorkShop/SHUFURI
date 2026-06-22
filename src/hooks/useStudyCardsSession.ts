import { useCallback, useRef } from 'react';
import type { LangCode } from '../services/appSettings';
import {
  createStudyCardsBundleId,
  trySyncStudyCardsFromRaw,
} from '../studyCards/syncStudyCards';

export function useStudyCardsSession(defaultIncludeVocabAndGrammar: boolean) {
  const studyCardsBundleIdRef = useRef(createStudyCardsBundleId());

  const syncStudyCardsFromRaw = useCallback(
    async (
      rawLyrics: string,
      bundleId: string,
      meta: {
        title?: string;
        artist?: string;
        lang?: LangCode;
        includeVocabAndGrammar?: boolean;
      },
    ) => {
      return trySyncStudyCardsFromRaw({
        rawLyrics,
        bundleId,
        title: meta.title,
        artist: meta.artist,
        lang: meta.lang,
        includeVocabAndGrammar:
          meta.includeVocabAndGrammar ?? defaultIncludeVocabAndGrammar,
      });
    },
    [defaultIncludeVocabAndGrammar],
  );

  return {
    studyCardsBundleIdRef,
    syncStudyCardsFromRaw,
  };
}
