/**
 * KRDICT lite 基础词补丁：源 XML 无中文 Equivalent 的高频词在构建时被丢弃。
 * 运行时并入索引，避免「항상／하나」等基础词本地未命中。
 * 释义手写精简中文，仅补洞，不覆盖正式词典条目。
 */

import type { KrdictLiteEntry } from './krdictLite';

function seed(
  h: string,
  p: string,
  g: string,
  r = h,
  extraForms: string[] = [],
): KrdictLiteEntry {
  const forms = [h, ...extraForms].filter(Boolean);
  return { f: [...new Set(forms)], h, r, p, g };
}

/** 仅在索引中不存在该表面形时写入 */
export const KRDICT_SEED_PATCHES: KrdictLiteEntry[] = [
  // —— 数词 / 冠形 ——
  seed('하나', '数词', '一；最小的整数；也泛指「一个／唯一」。'),
  seed('한', '冠形词', '一（个）；用于修饰名词的数词形。'),

  // —— 时间 / 程度副词（歌词极高频）——
  seed('항상', '副词', '总是；一直。'),
  seed('언제나', '副词', '无论何时；总是。'),
  seed('자주', '副词', '经常；时常。'),
  seed('가끔', '副词', '偶尔；有时。'),
  seed('벌써', '副词', '已经（比预期早）。'),
  seed('아직', '副词', '还；尚未。'),
  seed('이미', '副词', '已经。'),
  seed('바로', '副词', '就；立刻；正是。'),
  seed('갑자기', '副词', '突然。'),
  seed('천천히', '副词', '慢慢地。'),
  seed('계속', '副词', '继续；不停地。'),
  seed('정말', '副词', '真的；确实。', '정ː말'),
  seed('참', '副词', '真；的确（口语感叹）。'),
  seed('꼭', '副词', '一定；务必。'),
  seed('절대', '副词', '绝对；决不。'),
  seed('결코', '副词', '决不；绝对不（多与否定搭配）。'),
  seed('함께', '副词', '一起；共同。'),
  seed('어떻게', '副词', '怎样；如何。'),
  seed('지금', '名词', '现在；此刻。'),

  // —— 空间 / 人物相关名词 ——
  seed('곁', '名词', '身旁；身边。'),
  seed('하루', '名词', '一天；一整天。'),
  seed('친구', '名词', '朋友。'),
  seed('희망', '名词', '希望；期望。'),
  seed('행복', '名词', '幸福；生活称心如意的状态。'),
  seed('혼자', '名词', '独自；一个人。'),
  seed('조금', '名词', '一点；稍微。'),

  // —— 核心用言（构建时常因无中文义被丢）——
  seed('하다', '动词', '做；进行某种行为（万能动词，常接名词构成「…하다」）。'),
  seed('주다', '动词', '给；也可作补助动词表示「为对方做…」。'),
  seed('좋다', '形容词', '好；喜欢。'),
  seed('싫다', '形容词', '讨厌；不愿意。'),
  seed('싶다', '形容词', '想要（接在动词后表示愿望）。'),
  seed('지키다', '动词', '守护；遵守；保卫。'),
  seed('죽다', '动词', '死；消失。'),
  seed('살다', '动词', '活；生活。'),
  seed('만나다', '动词', '遇见；见面。'),
  seed('기다리다', '动词', '等待。'),
  seed('떠나다', '动词', '离开。'),
  seed('행복하다', '形容词', '幸福；感到称心如意。'),
];

/** 把种子词并入索引：不覆盖已有 KRDICT 正式条目 */
export function mergeKrdictSeedPatches(
  index: Map<string, KrdictLiteEntry>,
): number {
  let added = 0;
  for (const entry of KRDICT_SEED_PATCHES) {
    for (const form of entry.f) {
      if (!form || index.has(form)) continue;
      index.set(form, entry);
      added++;
    }
    if (entry.h && !index.has(entry.h)) {
      index.set(entry.h, entry);
      added++;
    }
  }
  return added;
}
