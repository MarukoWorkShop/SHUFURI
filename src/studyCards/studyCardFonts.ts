const HAN_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;

/** 背面大号释义含汉字时用宋体，其余中文辅文仍走 PingFang */
export function studyCardMeaningUsesSongti(meaning: string): boolean {
  return HAN_RE.test(meaning.trim());
}
