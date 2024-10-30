export interface OpenAiExtractionItem {
  k: string,
  m: string,
}

export interface OpenAiRawAnswer {
  d: string,
  e: OpenAiExtractionItem[]
}

export interface ExtractedTranslation {
  translationKey: string;
  text: string;
}

export interface OpenAiAnswer {
  diffPatch: string;
  extractedTranslationKeys: ExtractedTranslation[];
}
