import { CHAPTER_CHAR_PLANS, SUPPLEMENT_CHARS, ChapterCharPlan } from './ChapterCharMap';

/**
 * The 300 target characters are intentionally split into three gameplay
 * layers. Only guided cards gate chapter completion; free-main and relic
 * cards are exploration rewards.
 */
export type CharacterCollectionLayer = 'guided' | 'main-free' | 'relic';

// 引导字（金圈箭头带路、门控章完成）= 独立的递增规律，从章一 3 起每章 +1。
// 与每章主线「收集总字数」(5/12/19/26/26/32/38/44/48) 是两回事：引导字只取每章前 N 个，
// 剩余 = 自由探索字(main-free)，靠玩家自行寻找、不引导、不门控章完成。
// 第1章教学锁死 5 字（雨田水土地云），宝宝要求五字全引导，故首章引导数取到 5；
// 其余章沿用「引导字金圈带路 + 自由字自行探索」的模板设计（自由字不门控章完成）。
const GUIDED_COUNTS = [5, 4, 5, 6, 7, 8, 9, 10, 11] as const;

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
  const guidedCount = GUIDED_COUNTS[index];
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
  console.assert(guided === 65, `[CollectionPlan] guided count: ${guided}`);
  console.assert(main === 250, `[CollectionPlan] main count: ${main}`);
  console.assert(relic === 50, `[CollectionPlan] relic count: ${relic}`);
})();
