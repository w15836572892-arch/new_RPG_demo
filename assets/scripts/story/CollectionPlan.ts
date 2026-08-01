import { CHAPTER_CHAR_PLANS, SUPPLEMENT_CHARS, ChapterCharPlan } from './ChapterCharMap';

/**
 * 章节字表与进度口径说明（重要，避免与剧情步骤链错位）：
 * 各章 ChapterX.ts 的步骤链把「本章全部主线字」都写成剧情线性强制的
 * excavation/learning 步骤，且 fragment-awakens 始终位于全部挖掘步骤之后。
 * 即当前每章并不存在独立的「自由探索」步骤——所有字都是剧情引导挖出。
 * 因此「引导字」实际等同「本章全部主线字」，自由探索字(main-free)为空。
 * 所有进度面板、门槛、对话里显示的字数，都以 CollectionPlan 的
 * guidedCardIds（=本章实际主线字总数）为准，与步骤链/存档真实挖掘数一致，
 * 不再使用写死的旧 GUIDED_COUNTS 错位数（如第二章旧写 4、实际 12）。
 */
export type CharacterCollectionLayer = 'guided' | 'main-free' | 'relic';

export type ChapterCollectionPlan = {
  chapterId: string;
  guidedCardIds: readonly string[];
  mainFreeCardIds: readonly string[];
  relicCardIds: readonly string[];
};

const cardIdFor = (char: { char: string; existingCardId: string | null }) =>
  char.existingCardId ?? `catalog-u${char.char.codePointAt(0)!.toString(16)}`;

function buildPlan(source: ChapterCharPlan, index: number): ChapterCollectionPlan {
  const cards = source.chars.map(cardIdFor);
  // 引导字 = 本章实际主线字总数（步骤链已全部线性强制挖出，无独立自由探索步骤）。
  // 由此 guidedCardIds 涵盖全章字、mainFreeCardIds 为空，进度/门槛/对话数字与真实挖掘一致。
  const guidedCount = cards.length;
  return {
    chapterId: source.chapterId,
    guidedCardIds: cards.slice(0, guidedCount),
    mainFreeCardIds: cards.slice(guidedCount),
    relicCardIds: [],
  };
}

export const CHAPTER_COLLECTION_PLANS = CHAPTER_CHAR_PLANS.map(buildPlan);
export const MAIN_STORY_CARD_IDS = CHAPTER_COLLECTION_PLANS.flatMap(plan => [
  ...plan.guidedCardIds,
  ...plan.mainFreeCardIds,
]);
// 拾遗字 = 原计划分配的 50 个补充字（编号 251–300），字形数据从仓库总字池
// （手写卡 + imported catalog-u + 宝宝建的补充卡字）中按 id 匹配获取。
// 仓库总字池 = 之前的字 + 补充卡字，剧情基于仓库所有字推进，但不把 152 当拾遗。
export const RELIC_CARD_IDS = SUPPLEMENT_CHARS.map(cardIdFor);

export function collectionPlanFor(chapterId: string) {
  return CHAPTER_COLLECTION_PLANS.find(plan => plan.chapterId === chapterId) ?? null;
}

export function fixedGuidedCardIds(chapterId: string) {
  return collectionPlanFor(chapterId)?.guidedCardIds ?? [];
}

(() => {
  const plans = CHAPTER_COLLECTION_PLANS;
  const guided = plans.reduce((total, plan) => total + plan.guidedCardIds.length, 0);
  const main = plans.reduce((total, plan) => total + plan.guidedCardIds.length + plan.mainFreeCardIds.length, 0);
  const relic = RELIC_CARD_IDS.length;
  console.assert(guided === 250, `[CollectionPlan] guided count: ${guided}`);
  console.assert(main === 250, `[CollectionPlan] main count: ${main}`);
  console.assert(relic === 50, `[CollectionPlan] relic count: ${relic}`);
})();
