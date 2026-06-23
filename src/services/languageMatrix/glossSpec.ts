import type { GlossLanguage } from './types';

export type GlossSpec = {
  label: string;
  meaningField: string;
  detailField: string;
  translationField: string;
  exTranslationField: string;
};

const GLOSS_SPECS: Record<GlossLanguage, GlossSpec> = {
  zh: {
    label: 'Simplified Chinese',
    meaningField: 'Pure Chinese',
    detailField: 'Pure Chinese explanation',
    translationField: 'Pure Chinese translation',
    exTranslationField: 'Pure Chinese',
  },
  en: {
    label: 'natural English',
    meaningField: 'Natural English',
    detailField: 'Pure English explanation for native English learners',
    translationField: 'Natural English translation',
    exTranslationField: 'Natural English',
  },
};

export function getGlossSpec(gloss: GlossLanguage): GlossSpec {
  return GLOSS_SPECS[gloss];
}
