import {
  _decorator,
  BlockInputEvents,
  Canvas,
  Color,
  Component,
  DebugMode,
  EventKeyboard,
  EventTouch,
  Game,
  Graphics,
  game,
  input,
  Input,
  KeyCode,
  Label,
  Mask,
  Node,
  resources,
  ResolutionPolicy,
  Sprite,
  SpriteFrame,
  sys,
  Texture2D,
  UIOpacity,
  UITransform,
  Vec2,
  view,
  Widget,
} from 'cc';
import { HallCard, LearningHall } from './LearningHall';
import { createPhaseOneRegionConfig } from './regions/RegionTrialConfig';
import { RegionTransitionManager } from './regions/RegionTransitionManager';
import { RegionEntry, RegionExit, RegionId } from './regions/RegionTypes';
import { LocalSaveDatabase } from './storage/LocalSaveDatabase';
import { GameAudioManager } from './GameAudioManager';
import { importedOracleCards, RAW_CATALOG_PINYIN, makeLesson } from './data/ImportedOracleCatalog';
import { supplementalOracleCards } from './data/SupplementalOracleCatalog';
import { buildDivinationQuestions } from './data/DivinationQuestionBank';
import { DialoguePanel } from './story/DialoguePanel';
import { ChapterBanner } from './story/ChapterBanner';
import { QuestGuide } from './story/QuestGuide';
import { StoryController } from './story/StoryController';
import {
  chapterOneDefinition,
  CHAPTER_ONE_FRAGMENT_CARDS,
  CHAPTER_ONE_ID,
} from './story/ChapterOne';
import {
  chapterTwoDefinition,
  CHAPTER_TWO_FRAGMENT_CARDS,
  CHAPTER_TWO_ID,
} from './story/ChapterTwo';
import {
  chapterThreeDefinition,
  CHAPTER_THREE_FRAGMENT_CARDS,
  CHAPTER_THREE_ID,
} from './story/ChapterThree';
import { STORY_LOCATIONS, StoryLocationId, storyLocation } from './story/StoryLocations';
import {
  chapterFourDefinition,
  CHAPTER_FOUR_FRAGMENT_CARDS,
  CHAPTER_FOUR_ID,
} from './story/ChapterFour';
import {
  chapterFiveDefinition,
  CHAPTER_FIVE_FRAGMENT_CARDS,
  CHAPTER_FIVE_ID,
} from './story/ChapterFive';
import {
  chapterSixDefinition,
  CHAPTER_SIX_FRAGMENT_CARDS,
  CHAPTER_SIX_ID,
} from './story/ChapterSix';
import {
  chapterSevenDefinition,
  CHAPTER_SEVEN_FRAGMENT_CARDS,
  CHAPTER_SEVEN_ID,
} from './story/ChapterSeven';
import {
  chapterEightDefinition,
  CHAPTER_EIGHT_FRAGMENT_CARDS,
  CHAPTER_EIGHT_ID,
} from './story/ChapterEight';
import {
  chapterNineDefinition,
  CHAPTER_NINE_FRAGMENT_CARDS,
  CHAPTER_NINE_ID,
} from './story/ChapterNine';
import { migrateStorySave } from './story/StoryState';
import { DialogueLine, StoryObjective, StorySaveState, StoryStepDefinition } from './story/StoryTypes';
import { CHAPTER_CHAR_PLANS, SUPPLEMENT_CHARS } from './story/ChapterCharMap';
import { collectionPlanFor, fixedGuidedCardIds, MAIN_STORY_CARD_IDS, RELIC_CARD_IDS } from './story/CollectionPlan';

// 主线/拾遗字 id 集合（基于 ChapterCharMap：主线 250 = 9 章 PLANS，拾遗 50 = SUPPLEMENT_CHARS）
function planCardId(entry: { char: string; existingCardId: string | null }): string {
  if (entry.existingCardId) return entry.existingCardId;
  return 'catalog-u' + entry.char.codePointAt(0)!.toString(16);
}
const STORY_CARD_IDS = new Set<string>(MAIN_STORY_CARD_IDS);
const SUPPLEMENT_CARD_IDS = new Set<string>(RELIC_CARD_IDS);

// 为 ChapterCharMap 的 300 字目标表（9 章主线 250 + 拾遗 50）中「尚无手录卡面」的字
// 生成占位卡：id 用 planCardId（existingCardId ?? catalog-u{unicode}），拼音取自 RAW_CATALOG，
// 释义用 makeLesson 通用文案，asset 指向 catalog/ob-u{unicode}（本机若有对应甲骨图则显示，
// 缺失则由 createOracleGlyphVisual 的加载失败回退到现代字）。带 excavatable:true，使其进入
// 挖掘候选池与图鉴全集。最终在 oracleCards 初始化处按 id 去重，优先保留已有真实字形的卡。
function generatePlannedMissingCards(): OracleCardData[] {
  const plans: { char: string; existingCardId: string | null }[] = [
    ...CHAPTER_CHAR_PLANS.flatMap(plan => plan.chars),
    ...SUPPLEMENT_CHARS,
  ];
  const cards: OracleCardData[] = [];
  for (const entry of plans) {
    const id = planCardId(entry);
    const unicode = entry.char.codePointAt(0)!.toString(16);
    const pinyin = RAW_CATALOG_PINYIN.get(entry.char) ?? '';
    const lesson = makeLesson(entry.char);
    cards.push({
      id,
      glyph: entry.char,
      modern: entry.char,
      pinyin,
      quality: 'blue',
      asset: `catalog/ob-u${unicode}`,
      imageBounds: [0, 0, 200, 200] as [number, number, number, number],
      excavatable: true,
      meaning: lesson.meaning,
      evolution: lesson.evolution,
      history: lesson.history,
    });
  }
  return cards;
}
// Keep chapter-jump controls available while the current local build is under
// test. Switch this back to false before packaging the player build.
const SHOW_STORY_TEST_BUTTONS = true;
// Collision outlines are useful while authoring maps, but must never leak
// into the player build merely because Creator itself is running in debug.
const SHOW_COLLISION_DEBUG = false;
const STORY_CHAPTER_DEFINITIONS = [
  chapterOneDefinition,
  chapterTwoDefinition,
  chapterThreeDefinition,
  chapterFourDefinition,
  chapterFiveDefinition,
  chapterSixDefinition,
  chapterSevenDefinition,
  chapterEightDefinition,
  chapterNineDefinition,
] as const;
const STORY_CHAPTER_IDS = STORY_CHAPTER_DEFINITIONS.map(chapter => chapter.id);
const ALL_STORY_FRAGMENT_CARDS = [
  ...CHAPTER_ONE_FRAGMENT_CARDS,
  ...CHAPTER_TWO_FRAGMENT_CARDS,
  ...CHAPTER_THREE_FRAGMENT_CARDS,
  ...CHAPTER_FOUR_FRAGMENT_CARDS,
  ...CHAPTER_FIVE_FRAGMENT_CARDS,
  ...CHAPTER_SIX_FRAGMENT_CARDS,
  ...CHAPTER_SEVEN_FRAGMENT_CARDS,
  ...CHAPTER_EIGHT_FRAGMENT_CARDS,
  ...CHAPTER_NINE_FRAGMENT_CARDS,
] as const;
const STORY_CHAPTER_FRAGMENT_CARDS: Record<string, ReadonlyArray<{ cardId: string }>> = {
  [CHAPTER_ONE_ID]: CHAPTER_ONE_FRAGMENT_CARDS,
  [CHAPTER_TWO_ID]: CHAPTER_TWO_FRAGMENT_CARDS,
  [CHAPTER_THREE_ID]: CHAPTER_THREE_FRAGMENT_CARDS,
  [CHAPTER_FOUR_ID]: CHAPTER_FOUR_FRAGMENT_CARDS,
  [CHAPTER_FIVE_ID]: CHAPTER_FIVE_FRAGMENT_CARDS,
  [CHAPTER_SIX_ID]: CHAPTER_SIX_FRAGMENT_CARDS,
  [CHAPTER_SEVEN_ID]: CHAPTER_SEVEN_FRAGMENT_CARDS,
  [CHAPTER_EIGHT_ID]: CHAPTER_EIGHT_FRAGMENT_CARDS,
  [CHAPTER_NINE_ID]: CHAPTER_NINE_FRAGMENT_CARDS,
};
type StoryTestChapter = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
const STORY_TEST_STARTS: Record<StoryTestChapter, { chapterId: string; storyLocationId: StoryLocationId }> = {
  1: { chapterId: CHAPTER_ONE_ID, storyLocationId: 'chapter-1-city-entry' },
  2: { chapterId: CHAPTER_TWO_ID, storyLocationId: 'chapter-2-riverbank-entry' },
  3: { chapterId: CHAPTER_THREE_ID, storyLocationId: 'chapter-3-royal-tomb-entry' },
  4: { chapterId: CHAPTER_FOUR_ID, storyLocationId: 'chapter-4-highland-entry' },
  5: { chapterId: CHAPTER_FIVE_ID, storyLocationId: 'chapter-5-fields-entry' },
  6: { chapterId: CHAPTER_SIX_ID, storyLocationId: 'chapter-6-royal-tomb-entry' },
  7: { chapterId: CHAPTER_SEVEN_ID, storyLocationId: 'chapter-7-highland-entry' },
  8: { chapterId: CHAPTER_EIGHT_ID, storyLocationId: 'chapter-8-royal-tomb-entry' },
  9: { chapterId: CHAPTER_NINE_ID, storyLocationId: 'chapter-9-city-entry' },
};
const guidedStoryCardsFor = (chapterId: string) =>
  (STORY_CHAPTER_FRAGMENT_CARDS[chapterId] ?? [])
    .slice(0, fixedGuidedCardIds(chapterId).length)
    .map(fragment => fragment.cardId)
    .filter((cardId): cardId is string => Boolean(cardId));

/**
 * 本章全部主线字（引导字 + 自由探索字）的 id 列表，作为章节完成门槛。
 * 必须与「进度统计」(chapterMainProgress) 和「自由探索坑」(prepareChapterFreeExploration)
 * 使用同一数据源 CollectionPlan，否则会出现「门槛含了某张自由探索坑未开放的字」→
 * 该字永远学不到 → completeCurrentChapter 永远阻塞 → 章卡死、占卜多次不进下一章。
 * 故门槛直接由 CollectionPlan 全量主线字推导，与后两者天然一致。
 */
const allStoryMainCardIds = (chapterId: string): string[] => {
  const plan = collectionPlanFor(chapterId);
  if (!plan) return [];
  return [...plan.guidedCardIds, ...plan.mainFreeCardIds];
};

const GUIDED_STORY_CARD_IDS = new Set<string>(
  STORY_CHAPTER_DEFINITIONS.flatMap(chapter => guidedStoryCardsFor(chapter.id)),
);

const { ccclass } = _decorator;

type RectObstacle = { x: number; y: number; w: number; h: number; name: string; regionId?: string; source?: string };
type CircleObstacle = { x: number; y: number; radius: number; name: string };
type WaterSegment = { ax: number; ay: number; bx: number; by: number; radius: number; name: string };
type SwayObject = { node: Node; phase: number; amplitude: number; speed: number; reactsToPlayer?: boolean };
type Ripple = { node: Node; baseX: number; phase: number };
type CanalFlowMark = {
  node: Node; startX: number; startY: number; distance: number; horizontal: boolean; phase: number; speed: number;
};
type DepthTree = { node: Node; trunkY: number; halfWidth: number; canopyHeight: number; baseZ: number };
type DepthOccluder = {
  node: Node; footY: number; halfWidth: number; coverHeight: number; baseZ: number; foregroundZ: number; regionId?: string;
};
type StaticStructureSprite = { node: Node; asset: string };
type WildlifeMotion = 'swim' | 'wade' | 'hop';
type Wildlife = {
  node: Node; baseX: number; baseY: number; phase: number; speed: number; rangeX: number; rangeY: number; lastX: number;
  motion: WildlifeMotion; wake?: Node; bodyParts?: Node[]; wingParts?: Node[]; legParts?: Node[];
};
type WetlandPlantKind = 'reed' | 'grass';
type WetlandPlant = { root: Node; sprite: Sprite; variant: number; natureRegionId?: RegionId; natureName?: string; reported?: boolean };
type RiverbankTerrainKind = 'WATER' | 'SHORE' | 'LAND' | 'ROAD' | 'BRIDGE' | 'BOUNDARY';
type CropPlant = { root: Node; visual: Node; sprite: Sprite; frames: Array<SpriteFrame | null>; phase: number; x: number; y: number; bend: number; squash: number };
type TorchFlame = {
  root: Node; flame: Graphics; glow: Graphics; embers: Graphics; phase: number; intensity: number; sheltered?: boolean;
};
type Facing = 'down' | 'left' | 'right' | 'up';
type WorldMode = 'outside' | 'templeInterior';
type TerrainElevation = 'UPPER' | 'LOWER';
type TerrainBounds = { left: number; right: number; bottom: number; top: number };
type ElevationTransitionConfig = {
  id: string;
  regionId: RegionId;
  /** Disabled transitions retain their authored data but do not block movement. */
  enabled?: boolean;
  upperBounds: TerrainBounds;
  lowerBounds: TerrainBounds;
  cliffBand: TerrainBounds;
  stairPassage: TerrainBounds;
  upperCommitY: number;
  lowerCommitY: number;
};
type ToolKind = 'none' | 'shovel';
type FishingCastEffect = {
  root: Node; line: Graphics; ripple: Graphics; timer: number; target: Vec2; origin: Vec2;
  playerOrigin: Vec2; castDuration: number; waitDuration: number;
};
type CutPlantRegrowth = { node: Node; timer: number };
type BackpackTab = 'tools' | 'codex';
type DugHole = { node: Node; timer: number; x: number; y: number };
type ExcavationRegion = 'river' | 'field' | 'lake' | 'royal' | 'forest' | 'supplement' | 'trial';
type ExcavationReward = {
  kind: 'oracle' | 'ink'; quality: OracleQuality | null; cardId: string | null; amount: number;
  tier?: 'story' | 'supplement'; experience?: number; coins?: number;
};
type ExcavationVisualState = 'idle' | 'dug';
type ExcavationSite = {
  id: string; root: Node; sprite: Sprite; glow: Graphics; x: number; y: number;
  region: ExcavationRegion; mapRegion: RegionId; active: boolean; revealed: boolean; respawnTimer: number; holeTimer: number;
  awaitingStudy: boolean; reward: ExcavationReward; storyTarget?: boolean;
};
type PendingExcavation = { site: ExcavationSite; timer: number; rewarded: boolean };
type RewardFlight = {
  root: Node; start: Vec2; end: Vec2; timer: number; duration: number; phase: number;
};
type DigParticle = { root: Node; vx: number; vy: number; gravity: number; life: number; maxLife: number };
type WeatherKind = '晴' | '雨天' | '小雨' | '中雨';
type WeatherParticle = { x: number; y: number; vx: number; vy: number; size: number; life: number; phase: number };
type RainSplash = { x: number; y: number; life: number; maxLife: number };
type RegionExitMarkerAnimation = {
  aura: Node;
  auraOpacity: UIOpacity;
  core: Node;
  coreOpacity: UIOpacity;
  bloom: Node;
  bloomOpacity: UIOpacity;
  phase: number;
};
type Villager = {
  root: Node; visual: Node; sprite: Sprite; frames: Record<Facing, Array<SpriteFrame | null>>;
  route: Vec2[]; routeIndex: number; routeDirection: number; target: Vec2; facing: Facing; walkPhase: number; displayedFrame: number;
  velocity: Vec2; speed: number; pause: number; phase: number; facingHold: number; blockedTime: number;
  avoidanceSign: number; radius: number; workFrames: Array<SpriteFrame | null>; workIndices: number[];
  working: boolean; workTimer: number; activityRegionId?: RegionId;
};
type RestingVillager = {
  root: Node; visual: Node; sprite: Sprite; frames: Array<SpriteFrame | null>; displayedFrame: number; phase: number;
};
type HorseCart = {
  root: Node; visual: Node; sprite: Sprite; frames: Array<SpriteFrame | null>; displayedFrame: number;
  leftX: number; rightX: number; direction: number; speed: number; walkPhase: number; pause: number;
  phase: number; radius: number; turnPending: boolean;
};
type OracleQuality = 'blue' | 'red' | 'gold';
type CityOverlay = 'none' | 'shopConfirm' | 'shop' | 'backpack' | 'chapterProgress' | 'divination' | 'excavationLearning' | 'chapterChallenge';
type DivinationStage = 'none' | 'waiting' | 'question' | 'animating' | 'review';
type ExcavationLearningStage = 'none' | 'question' | 'detail';

type ChapterChallenge = {
  title: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  success: string;
};

const CHAPTER_CHALLENGES: Record<string, ChapterChallenge> = {
  [CHAPTER_ONE_ID]: {
    title: '第一章 · 初识问卜',
    prompt: '五枚骨纹已经聚齐。哪一枚最适合回应阿禾的求雨之问？',
    choices: ['雨', '土', '田', '云'], correctIndex: 0,
    success: '你以“雨”字定下第一次问卜，碎甲的光纹安静下来。',
  },
  [CHAPTER_TWO_ID]: {
    title: '第二章 · 河滩辨位',
    prompt: '潮水退去后，要寻找上游失物，应先沿哪一侧河势追查？',
    choices: ['顺流向下', '逆流向上', '停在原地', '横渡深水'], correctIndex: 1,
    success: '你循逆流辨明方向，水文碎甲在掌心连成了线。',
  },
  [CHAPTER_THREE_ID]: {
    title: '第三章 · 水脉拼图',
    prompt: '峡壁水脉图被冲散。应先确认哪项信息，才能判断卜骨去向？',
    choices: ['水流方向', '山色深浅', '石头大小', '风声远近'], correctIndex: 0,
    success: '你先定水流方向，再将支流接回主脉。',
  },
  [CHAPTER_FOUR_ID]: {
    title: '第四章 · 星月引路',
    prompt: '雾起后，阿岚要辨认归途。最可靠的线索组合是？',
    choices: ['脚印与树影', '星、月与水脉', '鸟鸣与落叶', '远处炊烟'], correctIndex: 1,
    success: '星月与水脉相互印证，迷径里亮起一条归路。',
  },
  [CHAPTER_FIVE_ID]: {
    title: '第五章 · 护送择路',
    prompt: '护送祭器经过岔路时，应优先选择哪条路线？',
    choices: ['近但险的山径', '有村落照应的官道', '无人知晓的小道', '被洪水淹没的河道'], correctIndex: 1,
    success: '你选择有人照应的官道，护送队伍得以安全前行。',
  },
  [CHAPTER_SIX_ID]: {
    title: '第六章 · 残灯复明',
    prompt: '要让废墟灯阵重新点亮，最先应点燃哪一盏？',
    choices: ['出口的灯', '中央主灯', '最暗的角灯', '任意一盏'], correctIndex: 1,
    success: '中央主灯亮起，四周残灯依次回应。',
  },
  [CHAPTER_SEVEN_ID]: {
    title: '第七章 · 辨伪救简',
    prompt: '火势逼近时，应先抢救哪一卷？',
    choices: ['字形与已学甲骨相符的真简', '刻痕崭新的伪简', '装饰最华丽的简', '无法辨认的空白简'], correctIndex: 0,
    success: '你救下真简，也识破了伪造的刻痕。',
  },
  [CHAPTER_EIGHT_ID]: {
    title: '第八章 · 三证对读',
    prompt: '三人证词不一时，最应优先核对什么？',
    choices: ['谁说得最大声', '证词与甲骨刻辞是否相符', '谁站得最近', '谁最早到场'], correctIndex: 1,
    success: '你以甲骨刻辞校验证词，三条线索终于相互印证。',
  },
  [CHAPTER_NINE_ID]: {
    title: '第九章 · 通天之契',
    prompt: '面对重续的甲骨知识，你选择如何传承？',
    choices: ['封存不语', '只供少数人占有', '整理后公开传授', '毁去所有碎甲'], correctIndex: 2,
    success: '你选择整理并传授，让识字与问卜重新服务于众人。',
  },
};
type OracleCardData = {
  id: string; glyph: string; modern: string; pinyin: string; quality: OracleQuality;
  meaning: string; evolution: string; history: string;
  asset?: string; imageBounds?: readonly [number, number, number, number]; excavatable?: boolean;
  catalogOnlyWhenUnlocked?: boolean;
};

type OracleGlyphOverride = Partial<Pick<OracleCardData, 'asset' | 'imageBounds' | 'glyph' | 'modern'>>;

// These legacy gameplay ids are kept for existing saves and story steps, but
// their former symbol placeholders are now bound to the supplied oracle image
// assets. Cards without an image source remain deliberately unbound and are
// excluded from learner-facing interactions below.
const ORACLE_GLYPH_ASSET_OVERRIDES: Record<string, OracleGlyphOverride> = {
  field: { glyph: '', asset: 'catalog/ob-u7530', imageBounds: [0, 0, 199, 199] },
  'water-temp': { glyph: '', modern: '水', asset: 'catalog/ob-u6c34', imageBounds: [0, 0, 199, 199] },
  'ancestor-temp': { glyph: '', modern: '祖', asset: 'supplemental/ob-u7956', imageBounds: [0, 0, 199, 199] },
  'ritual-temp': { glyph: '', modern: '祭', asset: 'supplemental/ob-u796d', imageBounds: [0, 0, 199, 199] },
  'king-temp': { glyph: '', modern: '王', asset: 'supplemental/ob-u738b', imageBounds: [0, 0, 199, 199] },
  'mountain-temp': { glyph: '', modern: '山', asset: 'catalog/ob-u5c71', imageBounds: [0, 0, 199, 199] },
  'fire-temp': { glyph: '', modern: '火', asset: 'catalog/ob-u706b', imageBounds: [0, 0, 199, 199] },
  'person-temp': { glyph: '', modern: '人', asset: 'catalog/ob-u4eba', imageBounds: [0, 0, 199, 199] },
  'cow-temp': { glyph: '', modern: '牛', asset: 'supplemental/ob-u725b', imageBounds: [0, 0, 199, 199] },
  'horse-temp': { glyph: '', modern: '马', asset: 'catalog/ob-u9a6c', imageBounds: [0, 0, 199, 199] },
  'bird-temp': { glyph: '', modern: '鸟', asset: 'supplemental/ob-u9e1f', imageBounds: [0, 0, 199, 199] },
  'mouth-temp': { glyph: '', modern: '口', asset: 'catalog/ob-u53e3', imageBounds: [0, 0, 199, 199] },
  'eye-temp': { glyph: '', modern: '目', asset: 'supplemental/ob-u76ee', imageBounds: [0, 0, 199, 199] },
  'ear-temp': { glyph: '', modern: '耳', asset: 'catalog/ob-u8033', imageBounds: [0, 0, 199, 199] },
  'child-temp': { glyph: '', modern: '子', asset: 'supplemental/ob-u5b50', imageBounds: [0, 0, 199, 199] },
  'woman-temp': { glyph: '', modern: '女', asset: 'catalog/ob-u5973', imageBounds: [0, 0, 199, 199] },
  'large-temp': { glyph: '', modern: '大', asset: 'catalog/ob-u5927', imageBounds: [0, 0, 199, 199] },
  'small-temp': { glyph: '', modern: '小', asset: 'catalog/ob-u5c0f', imageBounds: [0, 0, 199, 199] },
  'above-temp': { glyph: '', modern: '上', asset: 'catalog/ob-u4e0a', imageBounds: [0, 0, 199, 199] },
  'below-temp': { glyph: '', modern: '下', asset: 'catalog/ob-u4e0b', imageBounds: [0, 0, 199, 199] },
  'earth-temp': { glyph: '', modern: '土', asset: 'catalog/ob-u571f', imageBounds: [0, 0, 199, 199] },
  'river-temp': { glyph: '', modern: '川', asset: 'supplemental/ob-u5ddd', imageBounds: [0, 0, 199, 199] },
  'door-temp': { glyph: '', modern: '门', asset: 'catalog/ob-u95e8', imageBounds: [0, 0, 199, 199] },
  'dog-temp': { glyph: '', modern: '犬', asset: 'supplemental/ob-u72ac', imageBounds: [0, 0, 199, 199] },
  'boat-temp': { glyph: '', modern: '舟', asset: 'supplemental/ob-u821f', imageBounds: [0, 0, 199, 199] },
  'millet-temp': { glyph: '', modern: '禾' },
  'tomb-temp': { glyph: '', modern: '陵' },
  'hand-temp': { glyph: '', modern: '手' },
  'foot-temp': { glyph: '', modern: '足' },
};

// These legacy ids remain in the runtime for story compatibility and existing
// save files, but their oracle image is already represented by a dedicated
// catalog card. Hiding such visual duplicates gives the public catalog its
// intended 300-card presentation without deleting playable data.
const CATALOG_HIDDEN_LEGACY_DUPLICATE_IDS = new Set([
  'above-temp', 'below-temp', 'person-temp', 'mouth-temp', 'earth-temp',
  'large-temp', 'woman-temp', 'child-temp', 'small-temp', 'mountain-temp',
  'river-temp', 'fire-temp', 'cow-temp', 'dog-temp', 'king-temp',
  'eye-temp', 'ancestor-temp', 'ritual-temp', 'ear-temp', 'boat-temp',
  'moon-temp', 'tree-temp', 'water-temp',
]);
type DivinationQuestion = { villager: string; prompt: string; answerId: string; portrait: 'farmer' | 'woman' };

// 第六章的三轮问卜不是随机村民题。它们分别推进「灯阵分层 →
// 点灯时序 → 余灯指向」的线索，因此每一轮使用不同的甲骨字与问辞。
// 这样连续完成三卜时不会反复出现同一句问题。
const CHAPTER_SIX_DIVINATION_QUESTIONS: Record<string, DivinationQuestion> = {
  'chapter-6-ruins-lamp-divination-1': {
    villager: '灯匠·阿烛', portrait: 'woman', answerId: 'catalog-u5206',
    prompt: '灯匠·阿烛求问：“残灯散在废墟四角，先要分清灯阵的层位与次第，才能找回主灯。”请从三片甲骨中选出与“分辨、分层”最相符的一字。',
  },
  'chapter-6-ruins-lamp-divination-2': {
    villager: '灯匠·阿烛', portrait: 'woman', answerId: 'catalog-u65f6',
    prompt: '灯匠·阿烛求问：“主灯已定，接下来该依什么时序点亮四周残灯，才不会让火光彼此冲乱？”请从三片甲骨中选出与“时序”最相符的一字。',
  },
  'chapter-6-ruins-lamp-divination-3': {
    villager: '灯匠·阿烛', portrait: 'woman', answerId: 'catalog-u5149',
    prompt: '灯匠·阿烛求问：“最后一盏残灯只余微光，它照出的方向正是下一段路的线索吗？”请从三片甲骨中选出与“光亮、指引”最相符的一字。',
  },
};
type ShopProduct = {
  id: string; name: string; price: number; description: string;
  quality: OracleQuality;
};
type LearningRecord = { attempts: number; bestStars: number; correctCount: number };
type WrongBookEntry = { wrongCount: number; lastWrongAt: number };
type CitySave = {
  version: number; ink: number; coins: number; experience: number;
  unlockedOracleIds: string[]; excavatedStoryIds: string[]; excavatedCardIds: string[]; mastery: Record<string, LearningRecord>; wrongBook: Record<string, WrongBookEntry>;
  ownedProductIds: string[]; equippedShellId: string; placedDecorationIds: string[];
  playerName: string; avatarId: string; avatarUrl?: string; characterChoiceCompleted: boolean; musicOn: boolean; sfxOn: boolean; nightMode: boolean;
  story: StorySaveState;
  currentRegionId?: RegionId;
  storyLocationId?: string;
  playerWorldPosition?: { x: number; y: number };
  playerFacing?: Facing;
};

/**
 * 《殷墟小卜官》动态地图原型。
 * 地图由独立 Cocos 节点实时绘制，不使用整张背景图；包含真实碰撞、
 * 分件角色行走动画、动态草木、水纹和跟随镜头。
 */
@ccclass('YinXuCity')
export class YinXuCity extends Component {
  private readonly tile = 48;
  private readonly cols = 250;
  private readonly rows = 180;
  private readonly mapWidth = this.cols * this.tile;
  private readonly mapHeight = this.rows * this.tile;
  private readonly playerRadius = 9;
  private readonly actorRadius = 23;
  // The indoor player root is the foot point. Its 44px-wide root and 24x8px
  // painted shadow require a wider, shallow footprint than the old 9px circle.
  private readonly templeFootHalfWidth = 20;
  private readonly templeFootHalfHeight = 9;
  private readonly moveSpeed = 138;
  private readonly templeWalkBounds = { left: -548, right: 548, bottom: -282, top: 214 };
  private readonly templeSeatPoint = new Vec2(0, -24);
  private readonly templeRiseSafePoint = new Vec2(0, -185);
  /** Center Y of the main east-west thoroughfare (drawRoads: 60, 440, 820). */
  private readonly cityEastWestRoadCenterY = 440;
  private readonly excavationNodeWidth = 44;
  private readonly excavationNodeHeight = 32;
  private readonly EXCAVATION_VISUAL_WIDTH = 112;
  private readonly EXCAVATION_VISUAL_HEIGHTS: Record<ExcavationVisualState, number> = {
    // Preserve each trimmed PNG's exact visible-content aspect ratio.
    idle: 112 * 384 / 657,
    dug: 112 * 468 / 746,
  };
  private readonly EXCAVATION_VISUAL_GROUND_Y = -12;
  /** Shared southward shift for all temple nodes, collision, and triggers. */
  private readonly templeMoveDeltaY = -200;
  private readonly excavationFramePaths: Record<ExcavationVisualState, string> = {
    idle: 'art/environment/excavation/excavation_mound_idle/spriteFrame',
    dug: 'art/environment/excavation/excavation_mound_dug/spriteFrame',
  };
  private readonly wetlandPlantFramePaths = [
    'art/environment/wetland/reeds_a/spriteFrame',
    'art/environment/wetland/reeds_b/spriteFrame',
    'art/environment/wetland/reeds_c/spriteFrame',
    'art/environment/wetland/wet_grass_a/spriteFrame',
    'art/environment/wetland/wet_grass_b/spriteFrame',
  ];
  private readonly wetlandReedVariantCount = 3;
  private readonly wetlandPlantBlankPercent = 22;
  private readonly wetlandReedPercent = 35;
  private readonly wetlandPlantCanvasSizes: Record<WetlandPlantKind, [number, number]> = {
    reed: [100, 100],
    grass: [92, 52],
  };
  // Both imported sprite canvases leave four transparent pixels below their
  // roots. These offsets put that shared visible baseline at root-local -24.
  private readonly wetlandPlantVisualOffsetY: Record<WetlandPlantKind, number> = {
    reed: 22,
    grass: -2,
  };
  private readonly riverRegion = { left: -6000, right: -3800, bottom: -3000, top: 850 };
  private readonly riverbankNorthHighland = {
    north: 850,
    cliffTop: -250,
    cliffBottom: -378,
    roadLeft: -4956,
    roadRight: -4844,
    spawnX: -4900,
    spawnY: 690,
  };
  private readonly riverbankPhaseOneRiverPoints: Array<[number, number]> = [
    // Sampled directly from the visible blue channel in
    // huan-river-continuous-v1. This replaces the old procedural-river route
    // entirely, so no invisible legacy water remains on the grass.
    [-6025, -1195], [-5780, -1286], [-5517, -1368], [-5236, -1357],
    [-5008, -1410], [-4762, -1524], [-4534, -1691], [-4385, -1883],
    [-4359, -2146], [-4377, -2392], [-4394, -2655], [-4377, -2883],
    [-4333, -3076],
  ];
  /**
   * Piecewise shoreline samples from the visible water edge in
   * huan-river-continuous-v1.png around the north bridge. The third value is
   * half the local water width. pointInRiverbankNorthBridgeWater() interpolates
   * the north and south edges separately so bends do not grow circular air-wall
   * bulges over the painted grass.
   */
  private readonly riverbankNorthBridgeWaterPoints: Array<[number, number, number]> = [
    [-5517, -1402, 68], [-5460, -1413, 73], [-5380, -1389, 76],
    [-5300, -1380, 73], [-5220, -1368, 75], [-5140, -1358, 86],
    [-5060, -1354, 96], [-4980, -1348, 96], [-4900, -1359, 92],
    [-4820, -1370, 95], [-4740, -1425, 97], [-4660, -1488, 89],
    [-4580, -1549, 96], [-4534, -1590, 106],
  ];
  /**
   * Continuous north/right shoreline sampled from the painted water edge.
   * It starts west of the bridge, follows every bend, and reaches the lower
   * edge of the river art. Collision is generated just inside the land (minus
   * normal direction) so the grass, mud and stones remain approachable while
   * the player's feet are blocked at the water edge.
   */
  private readonly riverbankNorthShorePoints: Array<[number, number]> = [
    [-5568, -1340], [-5525, -1330], [-5481, -1335], [-5437, -1328],
    [-5393, -1321], [-5349, -1321], [-5305, -1312], [-5261, -1293],
    [-5218, -1293], [-5174, -1300], [-5130, -1274], [-5086, -1265],
    [-5042, -1254], [-4998, -1249], [-4954, -1254], [-4911, -1265],
    [-4867, -1261], [-4823, -1272], [-4779, -1293], [-4735, -1325],
    [-4691, -1368], [-4647, -1402], [-4604, -1437], [-4560, -1456],
    [-4516, -1495], [-4453, -1532], [-4416, -1575], [-4368, -1619],
    [-4360, -1663], [-4339, -1707], [-4316, -1751], [-4300, -1795],
    [-4298, -1839], [-4279, -1882], [-4261, -1926], [-4258, -1970],
    [-4275, -2014], [-4288, -2058], [-4282, -2102], [-4300, -2146],
    [-4302, -2189], [-4344, -2233], [-4365, -2277], [-4377, -2321],
    [-4388, -2365], [-4393, -2409], [-4396, -2453], [-4375, -2496],
    [-4391, -2540], [-4360, -2584], [-4337, -2628], [-4358, -2672],
    [-4358, -2716], [-4363, -2760], [-4367, -2804], [-4360, -2847],
    [-4342, -2891], [-4307, -2935], [-4296, -2979], [-4319, -3023],
  ];
  private readonly riverbankPhaseOneRoadPoints: Array<[number, number]> = [
    [-4900, 790], [-4900, -250], [-4900, -700], [-4920, -1040], [-4900, -1335],
  ];
  // The bridge is centred on the widened river at the end of the north road,
  // rather than leaving half of its deck on the south bank.
  // The continuous river artwork sits higher than the old placeholder channel.
  // Keep the deck centred between its two banks, while retaining a small
  // overlap with the north road so there is no walkable seam at the landing.
  private readonly riverbankPhaseOneBridge = { x: -4900, y: -1190, w: 82, h: 560 };
  private readonly riverbankPhaseOneReturnTrigger = {
    left: -4956, right: -4844, bottom: 770, top: 820,
  };
  private readonly riverbankElevationTransition: ElevationTransitionConfig = {
    id: 'riverbank-north-cliff-stairs',
    regionId: RegionId.RIVERBANK,
    // The north highland cliff and stairs were removed. Keep the authoring
    // data for diagnostics only; it must no longer restrict movement.
    enabled: false,
    upperBounds: { left: -6000, right: -3800, bottom: -218, top: 850 },
    lowerBounds: { left: -6000, right: -3800, bottom: -3000, top: -410 },
    cliffBand: { left: -6000, right: -3800, bottom: -378, top: -250 },
    stairPassage: { left: -4956, right: -4844, bottom: -410, top: -218 },
    upperCommitY: -218,
    lowerCommitY: -410,
  };
  // 湖湾区收紧到 OUTSKIRTS 城南可达荒地带：bottom/top 必须落在 OUTSKIRTS 可达区
  // (currentWorldBounds minY=-960) 之内，否则 resolveExcavationPosition 会把 lake 坑 seed
  // 的 y clamp 回南墙死区(y<-960)，导致"指针往返死循环"。top 也须 < CITY 南边界(-240)，
  // 避免 lake 坑被误判进城内(CITY)而与 mapRegion=OUTSKIRTS 不一致。
  // left/right 同时收紧在 OUTSKIRTS 可达范围内(minX=-1240, maxX=1240)，防止 x<-1240
  // 的 seed 落入城西空白死区。
  private readonly lakeRegion = { left: -1180, right: -520, bottom: -960, top: -300 };
  private readonly fieldRegion = { left: 140, right: 3000, bottom: -2200, top: -400 };
  private readonly mountainRegion = { left: 3000, right: 5700, bottom: -2200, top: -400 };
  private readonly tombRegion = { left: 600, right: 5200, bottom: -4100, top: -2450 };
  private readonly southOutskirtsTrial = { left: -1300, right: 1300, bottom: -960, top: -240 };
  // 第一章教学坑专用区：出南城门直行即达的城南试炼场中心（OUTSKIRTS 城南，y<-240），
  // 远离试炼场左右围墙(x=±1284)与城内建筑。玩家无需 teleport、自己走几步就能到，
  // 彻底绕开 FIELDS 北墙/地面从 x=140 起、南城门洞却在 x=0 导致的"看得见走不到"死区。
  // 与 field(=FIELDS 内) 完全隔离，绝不污染二/五/九章的 FIELDS 坑池。
  private readonly trialRegion = { left: -550, right: 450, bottom: -1300, top: 350 };
  /** One source of truth for both authored wall visuals and foot-point collision. */
  private readonly cityBoundary = {
    left: -1300, right: 1300, bottom: -240, top: 1450, thickness: 64,
    cornerVisualSize: 154,
    gates: {
      north: { enabled: true, center: 0, passageWidth: 112, gatehouseHalfWidth: 190 },
      south: { enabled: true, center: 0, passageWidth: 112, gatehouseHalfWidth: 190 },
      west:  { enabled: true, center: 440, passageWidth: 112, gatehouseHalfWidth: 190 },
      east:  { enabled: true, center: 440, passageWidth: 112, gatehouseHalfWidth: 190 },
    },
  } as const;
  private readonly forestRegion = { left: 3150, right: 5600, bottom: -2100, top: -500 };
  // 同一次刷新周期内已分配出去的主线字，防止多个坑在同一帧重生时抽到同一个字（重复字）。
  private readonly excavationRollingReserved: Set<string> = new Set<string>();
  // 拾遗专属挖掘区：覆盖整张可行走地图的陆地，散布广、彼此稀疏；门控：主线完成后才解锁。
  private readonly supplementRegion = { left: -5850, right: 5500, bottom: -3950, top: -380 };

  private world!: Node;
  /** OUTSKIRTS ground fill Graphics node - toggled via updateOutskirtsVisibility() */
  private outskirtsGroundNode: Node | null = null;
  /** Container for all OutskirtsGroundTile sprites */
  private outskirtsTileContainer: Node | null = null;
  /** OUTSKIRTS ground-cover layer. Solid nature entities live in DynamicWorld for depth sorting. */
  private outskirtsNatureRoot: Node | null = null;
  /** OUTSKIRTS trees and jujube bushes participate in world-depth sorting. */
  private outskirtsNatureEntityNodes: Node[] = [];
  /** FIELDS visuals overlap OUTSKIRTS coordinates, so they are hidden outside their owning region. */
  private fieldVisualNodes: Node[] = [];
  /** Purely visual, region-scoped road-exit markers; they never create collision data. */
  private readonly regionExitMarkerRoots = new Map<RegionId, Node>();
  private regionExitMarkerAnimations: RegionExitMarkerAnimation[] = [];
  /** Obstacles created by the rebuildable OUTSKIRTS nature pass. */
  private readonly outskirtsNatureObstacleNames = new Set<string>();
  /** Retired grove names are ignored by delayed SpriteFrame callbacks. */
  private readonly retiredOutskirtsNatureTreeNames = new Set<string>();
  /** One runtime audit per OUTSKIRTS visit for the reported south-road wall. */
  private outskirtsSouthAirwallProbeReported = false;
  private player!: Node;
  private playerVisual!: Node;
  private playerSprite!: Sprite;
  private joystickKnob!: Node;
  private status!: Label;
  private statusNotice = '';
  private statusNoticeTimer = 0;
  private region!: Label;
  private weatherLabel!: Label;
  private weatherTimerLabel!: Label;
  private weatherIcon!: Graphics;
  private weatherParticles!: Graphics;
  private weatherParticleNode!: Node;
  private audioManager!: GameAudioManager;

  private playerPos = new Vec2(0, 20);
  private cameraPos = new Vec2(0, 20);
  private keyboard = new Vec2();
  private stick = new Vec2();
  private playerMotion = new Vec2();
  private footstepDistance = 0;
  private wasWalkingForAudio = false;
  private touchOrigin: Vec2 | null = null;
  private obstacles: RectObstacle[] = [];
  /** Synchronous authoring scope inherited by addObstacle() when no region is supplied. */
  private currentObstacleRegionId: string | undefined;
  private waterCircles: CircleObstacle[] = [];
  private waterSegments: WaterSegment[] = [];
  private waterCrossings: RectObstacle[] = [];
  private sways: SwayObject[] = [];
  private wetlandPlants: WetlandPlant[] = [];
  private wetlandPlantFrames: Array<SpriteFrame | null> = [null, null, null, null, null];
  private wetlandPlantFramesRequested = false;
  private previousWetlandPlantVariant = -1;
  /** Runtime-only audit of successfully bound regional decoration sprites. */
  private readonly natureDecorVisibleCounts = new Map<string, number>();
  private ripples: Ripple[] = [];
  private canalFlowMarks: CanalFlowMark[] = [];
  private depthTrees: DepthTree[] = [];
  private depthOccluders: DepthOccluder[] = [];
  private fixedForegroundNodes: Node[] = [];
  /** Story NPC names stay outside actor subtrees and always render above the world. */
  private storyNpcLabelRoot: Node | null = null;
  private storyNpcWorldLabels: Array<{ source: Node; label: Node }> = [];
  /** Alpha-only south-gate pixels rendered permanently above outdoor actors. */
  private southGateForegroundVisual: Node | null = null;
  private southOutskirtsSurfaceNodes: Node[] = [];
  private staticCityBoundaryNodes: Node[] = [];
  private cityWallVisualRoot: Node | null = null;
  private staticStructureSprites: StaticStructureSprite[] = [];
  private structureFootprintOwners = new Set<string>();
  private wildlife: Wildlife[] = [];
  private cropPlants: CropPlant[] = [];
  private torchFlames: TorchFlame[] = [];
  private torchRenderTimer = 0;
  private villagers: Villager[] = [];
  private restingVillager: RestingVillager | null = null;
  private horseCarts: HorseCart[] = [];
  private frameCache = new Map<string, SpriteFrame>();
  private frameWaiters = new Map<string, Array<(frame: SpriteFrame) => void>>();
  private frameErrorWaiters = new Map<string, Array<() => void>>();
  private excavationFrames: Record<ExcavationVisualState, SpriteFrame | null> = { idle: null, dug: null };
  private excavationFramesRequested = false;
  private playerFrames: Record<Facing, Array<SpriteFrame | null>> = {
    down: [null, null, null, null, null, null],
    left: [null, null, null, null, null, null],
    right: [null, null, null, null, null, null],
    up: [null, null, null, null, null, null],
  };
  private readonly playerFrameCount = 6;
  private facing: Facing = 'down';
  private displayedPlayerFrame = -1;
  private playerSpriteLoadToken = 0;
  private elapsed = 0;
  private walkPhase = 0;
  private blocked = false;
  private weather: WeatherKind = '晴';
  private weatherChangeTimer = 55;
  private precipitation: WeatherParticle[] = [];
  private rainSplashes: RainSplash[] = [];
  private weatherRenderTimer = 0;
  private readonly saveKey = 'yinxu-city-save-v1';
  private readonly localSaveDatabase = new LocalSaveDatabase('yinxu-city-local-db', 'saves');
  private readonly saveCheckpointInterval = 4;
  private saveCheckpointElapsed = 0;
  private readonly onApplicationHide = () => this.flushCitySave();
  private readonly divinationInkCost = 4;
  // 图鉴显示模式：false = 正式体验，只展示已挖掘/解锁的甲骨（未挖到的不进图鉴，不显示灰格）；
  // true = 仅供调试预览全集（所有字都标为已解锁）。它只影响图鉴展示，绝不把未解锁字写进存档。
  private readonly unlockAllCatalogForPreview = false;
  private readonly oracleCards: OracleCardData[] = (() => {
    const raw = [
    { id: 'catalog-u65f6', glyph: '时', modern: '时', pinyin: 'shí', quality: 'blue', meaning: '表示时间、时辰，与昼夜更替和农时安排有关。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以干支与时段记录事件，时间观念服务于祭祀、农事与出行。' },
    { id: 'catalog-u5206', glyph: '分', modern: '分', pinyin: 'fēn', quality: 'blue', asset: 'catalog/ob-u5206', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示划分、分开，与时间单位和分配有关。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代历法以分段记时，分用于安排农事与祭祀。' },
    { id: 'catalog-u523b', glyph: '刻', modern: '刻', pinyin: 'kè', quality: 'blue', asset: 'catalog/ob-u523b', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示雕刻、刻度，也用于记时。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代在龟甲兽骨上契刻卜辞，刻是文字留存的方式。' },
    { id: 'catalog-u5e74', glyph: '年', modern: '年', pinyin: 'nián', quality: 'blue', asset: 'catalog/ob-u5e74', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示收成、年岁，与农事周期有关。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以谷物成熟记年，年关联丰收与祭祀。' },
    { id: 'catalog-u5c81', glyph: '岁', modern: '岁', pinyin: 'suì', quality: 'blue', asset: 'catalog/ob-u5c81', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示岁星、年岁，用于记时。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以岁记时，岁关联历法与农事。' },
    { id: 'catalog-u671d', glyph: '朝', modern: '朝', pinyin: 'zhāo', quality: 'blue', asset: 'catalog/ob-u671d', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示早晨、朝向。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代观察朝旦以安排祭祀与出行。' },
    { id: 'catalog-u5915', glyph: '夕', modern: '夕', pinyin: 'xī', quality: 'blue', asset: 'catalog/ob-u5915', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示傍晚、夜晚。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以朝夕记时，夕关联夜事与守卫。' },
    { id: 'catalog-u663c', glyph: '昼', modern: '昼', pinyin: 'zhòu', quality: 'blue', meaning: '表示白昼、白天。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以昼夜安排农事与祭祀。' },
    { id: 'catalog-u591c', glyph: '夜', modern: '夜', pinyin: 'yè', quality: 'blue', asset: 'catalog/ob-u591c', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示夜晚。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代夜事与守卫、祭祀相关。' },
    { id: 'catalog-u5149', glyph: '光', modern: '光', pinyin: 'guāng', quality: 'blue', asset: 'catalog/ob-u5149', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示光亮、火光。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以火光照明与祭祀，光关联灯烛。' },
    { id: 'catalog-u5934', glyph: '头', modern: '头', pinyin: 'tóu', quality: 'blue', asset: 'catalog/ob-u5934', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示头部，人体最上的部位。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代在人体部位字中，头为基础构件。' },
    { id: 'catalog-u9762', glyph: '面', modern: '面', pinyin: 'miàn', quality: 'blue', asset: 'catalog/ob-u9762', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示面部。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以面部表人，面关联容貌与身份。' },
    { id: 'catalog-u773c', glyph: '眼', modern: '眼', pinyin: 'yǎn', quality: 'blue', meaning: '表示眼睛。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以目表视觉，眼是基础构件。' },
    { id: 'catalog-u8033', glyph: '耳', modern: '耳', pinyin: 'ěr', quality: 'blue', asset: 'catalog/ob-u8033', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示耳朵。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以耳表听觉，耳关联听闻与命令。' },
    { id: 'catalog-u53e3', glyph: '口', modern: '口', pinyin: 'kǒu', quality: 'blue', asset: 'catalog/ob-u53e3', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示嘴、口部。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以口表言语与饮食，口是基础构件。' },
    { id: 'catalog-u9f3b', glyph: '鼻', modern: '鼻', pinyin: 'bí', quality: 'blue', asset: 'catalog/ob-u9f3b', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示鼻子。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以鼻表呼吸与嗅觉，鼻关联人面。' },
    { id: 'catalog-u624b', glyph: '手', modern: '手', pinyin: 'shǒu', quality: 'blue', meaning: '表示手，人体劳作部位。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以手表劳作与持物，手是基础构件。' },
    { id: 'catalog-u8db3', glyph: '足', modern: '足', pinyin: 'zú', quality: 'blue', meaning: '表示脚、足。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以足表行走，足关联出行与狩猎。' },
    { id: 'catalog-u5fc3', glyph: '心', modern: '心', pinyin: 'xīn', quality: 'blue', asset: 'catalog/ob-u5fc3', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示心脏，表思维与情感。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以心表内心，心关联思虑与祭祀。' },
    { id: 'catalog-u8eab', glyph: '身', modern: '身', pinyin: 'shēn', quality: 'blue', asset: 'catalog/ob-u8eab', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示身体、身躯。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以身表人，身关联人的整体。' },
    { id: 'catalog-u9aa8', glyph: '骨', modern: '骨', pinyin: 'gǔ', quality: 'blue', asset: 'catalog/ob-u9aa8', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示骨头，甲骨文的载体。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以骨记卜，骨是卜辞的物质基础。' },
    { id: 'catalog-u76ae', glyph: '皮', modern: '皮', pinyin: 'pí', quality: 'blue', asset: 'catalog/ob-u76ae', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示兽皮。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以皮制衣与祭，皮关联狩猎。' },
    { id: 'catalog-u6bdb', glyph: '毛', modern: '毛', pinyin: 'máo', quality: 'blue', meaning: '表示毛发。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以毛表兽羽，毛关联动物。' },
    { id: 'catalog-u53d1', glyph: '发', modern: '发', pinyin: 'fà', quality: 'blue', asset: 'catalog/ob-u53d1', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示头发。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以发表人首，发关联容貌。' },
    { id: 'catalog-u9f7f', glyph: '齿', modern: '齿', pinyin: 'chǐ', quality: 'blue', meaning: '表示牙齿。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以齿表咀嚼，齿关联饮食。' },
    { id: 'catalog-u820c', glyph: '舌', modern: '舌', pinyin: 'shé', quality: 'blue', asset: 'catalog/ob-u820c', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示舌头，表言语。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以舌表言语，舌关联号令与占问。' },
    { id: 'catalog-u80a9', glyph: '肩', modern: '肩', pinyin: 'jiān', quality: 'blue', asset: 'catalog/ob-u80a9', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '表示肩膀。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以肩表负重，肩关联劳作。' },
    { id: 'catalog-u80f8', glyph: '胸', modern: '胸', pinyin: 'xiōng', quality: 'blue', meaning: '表示胸膛。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以胸表身躯前部，胸关联人体。' },
    { id: 'catalog-u8170', glyph: '腰', modern: '腰', pinyin: 'yāo', quality: 'blue', meaning: '表示腰部。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以腰表身段，腰关联人体。' },
    { id: 'catalog-u817f', glyph: '腿', modern: '腿', pinyin: 'tuǐ', quality: 'blue', meaning: '表示腿。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以腿表行走，腿关联出行。' },
    { id: 'catalog-u811a', glyph: '脚', modern: '脚', pinyin: 'jiǎo', quality: 'blue', meaning: '表示脚。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以脚表行走，脚关联出行与狩猎。' },
    { id: 'catalog-u6307', glyph: '指', modern: '指', pinyin: 'zhǐ', quality: 'blue', meaning: '表示手指，表指向。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '商代以指表指向与计数，指关联手。' },
    { id: 'catalog-u4e00', glyph: '一', modern: '一', pinyin: 'yī', quality: 'blue', asset: 'catalog/ob-u4e00', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4e03', glyph: '七', modern: '七', pinyin: 'qī', quality: 'blue', asset: 'catalog/ob-u4e03', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4e07', glyph: '万', modern: '万', pinyin: 'wàn', quality: 'blue', asset: 'catalog/ob-u4e07', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4e09', glyph: '三', modern: '三', pinyin: 'sān', quality: 'blue', asset: 'catalog/ob-u4e09', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4e0a', glyph: '上', modern: '上', pinyin: 'shàng', quality: 'blue', asset: 'catalog/ob-u4e0a', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4e0b', glyph: '下', modern: '下', pinyin: 'xià', quality: 'blue', asset: 'catalog/ob-u4e0b', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4e2d', glyph: '中', modern: '中', pinyin: 'zhōng', quality: 'blue', asset: 'catalog/ob-u4e2d', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4e5d', glyph: '九', modern: '九', pinyin: 'jiǔ', quality: 'blue', asset: 'catalog/ob-u4e5d', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4e66', glyph: '书', modern: '书', pinyin: 'shū', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4e8c', glyph: '二', modern: '二', pinyin: 'èr', quality: 'blue', asset: 'catalog/ob-u4e8c', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4e94', glyph: '五', modern: '五', pinyin: 'wǔ', quality: 'blue', asset: 'catalog/ob-u4e94', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4e95', glyph: '井', modern: '井', pinyin: 'jǐng', quality: 'blue', asset: 'catalog/ob-u4e95', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4eba', glyph: '人', modern: '人', pinyin: 'rén', quality: 'blue', asset: 'catalog/ob-u4eba', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4eca', glyph: '今', modern: '今', pinyin: 'jīn', quality: 'blue', asset: 'catalog/ob-u4eca', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4ed6', glyph: '他', modern: '他', pinyin: 'tā', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4eec', glyph: '们', modern: '们', pinyin: 'men', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u4f60', glyph: '你', modern: '你', pinyin: 'nǐ', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5047', glyph: '假', modern: '假', pinyin: 'jiǎ', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u513f', glyph: '儿', modern: '儿', pinyin: 'ér', quality: 'blue', asset: 'catalog/ob-u513f', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u516b', glyph: '八', modern: '八', pinyin: 'bā', quality: 'blue', asset: 'catalog/ob-u516b', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u516d', glyph: '六', modern: '六', pinyin: 'liù', quality: 'blue', asset: 'catalog/ob-u516d', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5173', glyph: '关', modern: '关', pinyin: 'guān', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u518c', glyph: '册', modern: '册', pinyin: 'cè', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5199', glyph: '写', modern: '写', pinyin: 'xiě', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u51ac', glyph: '冬', modern: '冬', pinyin: 'dōng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u51fa', glyph: '出', modern: '出', pinyin: 'chū', quality: 'blue', asset: 'catalog/ob-u51fa', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5200', glyph: '刀', modern: '刀', pinyin: 'dāo', quality: 'blue', asset: 'catalog/ob-u5200', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5230', glyph: '到', modern: '到', pinyin: 'dào', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u524d', glyph: '前', modern: '前', pinyin: 'qián', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u52fa', glyph: '勺', modern: '勺', pinyin: 'sháo', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5341', glyph: '十', modern: '十', pinyin: 'shí', quality: 'blue', asset: 'catalog/ob-u5341', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5343', glyph: '千', modern: '千', pinyin: 'qiān', quality: 'blue', asset: 'catalog/ob-u5343', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5348', glyph: '午', modern: '午', pinyin: 'wǔ', quality: 'blue', asset: 'catalog/ob-u5348', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5367', glyph: '卧', modern: '卧', pinyin: 'wò', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u53bb', glyph: '去', modern: '去', pinyin: 'qù', quality: 'blue', asset: 'catalog/ob-u53bb', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u53eb', glyph: '叫', modern: '叫', pinyin: 'jiào', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u53f3', glyph: '右', modern: '右', pinyin: 'yòu', quality: 'blue', asset: 'catalog/ob-u53f3', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5403', glyph: '吃', modern: '吃', pinyin: 'chī', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u540e', glyph: '后', modern: '后', pinyin: 'hòu', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u542c', glyph: '听', modern: '听', pinyin: 'tīng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u54b1', glyph: '咱', modern: '咱', pinyin: 'zán', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u54e5', glyph: '哥', modern: '哥', pinyin: 'gē', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u54ea', glyph: '哪', modern: '哪', pinyin: 'nǎ', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u54ed', glyph: '哭', modern: '哭', pinyin: 'kū', quality: 'blue', asset: 'catalog/ob-u54ed', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u558a', glyph: '喊', modern: '喊', pinyin: 'hǎn', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u559c', glyph: '喜', modern: '喜', pinyin: 'xǐ', quality: 'blue', asset: 'catalog/ob-u559c', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u559d', glyph: '喝', modern: '喝', pinyin: 'hē', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u56db', glyph: '四', modern: '四', pinyin: 'sì', quality: 'blue', asset: 'catalog/ob-u56db', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u56de', glyph: '回', modern: '回', pinyin: 'huí', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u56fe', glyph: '图', modern: '图', pinyin: 'tú', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u571f', glyph: '土', modern: '土', pinyin: 'tǔ', quality: 'blue', asset: 'catalog/ob-u571f', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5730', glyph: '地', modern: '地', pinyin: 'dì', quality: 'blue', asset: 'catalog/ob-u5730', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u574f', glyph: '坏', modern: '坏', pinyin: 'huài', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5750', glyph: '坐', modern: '坐', pinyin: 'zuò', quality: 'blue', asset: 'catalog/ob-u5750', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5761', glyph: '坡', modern: '坡', pinyin: 'pō', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5899', glyph: '墙', modern: '墙', pinyin: 'qiáng', quality: 'blue', asset: 'catalog/ob-u5899', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u58f0', glyph: '声', modern: '声', pinyin: 'shēng', quality: 'blue', asset: 'catalog/ob-u58f0', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u590f', glyph: '夏', modern: '夏', pinyin: 'xià', quality: 'blue', asset: 'catalog/ob-u590f', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5916', glyph: '外', modern: '外', pinyin: 'wài', quality: 'blue', asset: 'catalog/ob-u5916', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u591a', glyph: '多', modern: '多', pinyin: 'duō', quality: 'blue', asset: 'catalog/ob-u591a', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5927', glyph: '大', modern: '大', pinyin: 'dà', quality: 'blue', asset: 'catalog/ob-u5927', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5929', glyph: '天', modern: '天', pinyin: 'tiān', quality: 'blue', asset: 'catalog/ob-u5929', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5951', glyph: '契', modern: '契', pinyin: 'qì', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5973', glyph: '女', modern: '女', pinyin: 'nǚ', quality: 'blue', asset: 'catalog/ob-u5973', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5976', glyph: '奶', modern: '奶', pinyin: 'nǎi', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5979', glyph: '她', modern: '她', pinyin: 'tā', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u597d', glyph: '好', modern: '好', pinyin: 'hǎo', quality: 'blue', asset: 'catalog/ob-u597d', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5988', glyph: '妈', modern: '妈', pinyin: 'mā', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u59b9', glyph: '妹', modern: '妹', pinyin: 'mèi', quality: 'blue', asset: 'catalog/ob-u59b9', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u59d0', glyph: '姐', modern: '姐', pinyin: 'jiě', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5b57', glyph: '字', modern: '字', pinyin: 'zì', quality: 'blue', asset: 'catalog/ob-u5b57', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5b66', glyph: '学', modern: '学', pinyin: 'xué', quality: 'blue', asset: 'catalog/ob-u5b66', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5b69', glyph: '孩', modern: '孩', pinyin: 'hái', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5b83', glyph: '它', modern: '它', pinyin: 'tā', quality: 'blue', asset: 'catalog/ob-u5b83', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5bb6', glyph: '家', modern: '家', pinyin: 'jiā', quality: 'blue', asset: 'catalog/ob-u5bb6', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5c0f', glyph: '小', modern: '小', pinyin: 'xiǎo', quality: 'blue', asset: 'catalog/ob-u5c0f', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5c11', glyph: '少', modern: '少', pinyin: 'shǎo', quality: 'blue', asset: 'catalog/ob-u5c11', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5c3a', glyph: '尺', modern: '尺', pinyin: 'chǐ', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5c4b', glyph: '屋', modern: '屋', pinyin: 'wū', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5c71', glyph: '山', modern: '山', pinyin: 'shān', quality: 'blue', asset: 'catalog/ob-u5c71', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5de6', glyph: '左', modern: '左', pinyin: 'zuǒ', quality: 'blue', asset: 'catalog/ob-u5de6', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5df7', glyph: '巷', modern: '巷', pinyin: 'xiàng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5e08', glyph: '师', modern: '师', pinyin: 'shī', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5e8a', glyph: '床', modern: '床', pinyin: 'chuáng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5f00', glyph: '开', modern: '开', pinyin: 'kāi', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5f1f', glyph: '弟', modern: '弟', pinyin: 'dì', quality: 'blue', asset: 'catalog/ob-u5f1f', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5f80', glyph: '往', modern: '往', pinyin: 'wǎng', quality: 'blue', asset: 'catalog/ob-u5f80', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u5ff5', glyph: '念', modern: '念', pinyin: 'niàn', quality: 'blue', asset: 'catalog/ob-u5ff5', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6012', glyph: '怒', modern: '怒', pinyin: 'nù', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u601d', glyph: '思', modern: '思', pinyin: 'sī', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u60b2', glyph: '悲', modern: '悲', pinyin: 'bēi', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u60f3', glyph: '想', modern: '想', pinyin: 'xiǎng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6101', glyph: '愁', modern: '愁', pinyin: 'chóu', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u61c2', glyph: '懂', modern: '懂', pinyin: 'dǒng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6211', glyph: '我', modern: '我', pinyin: 'wǒ', quality: 'blue', asset: 'catalog/ob-u6211', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u623f', glyph: '房', modern: '房', pinyin: 'fáng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u626b', glyph: '扫', modern: '扫', pinyin: 'sǎo', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u62ff', glyph: '拿', modern: '拿', pinyin: 'ná', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u638c', glyph: '掌', modern: '掌', pinyin: 'zhǎng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u64e6', glyph: '擦', modern: '擦', pinyin: 'cā', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6500', glyph: '攀', modern: '攀', pinyin: 'pān', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u653e', glyph: '放', modern: '放', pinyin: 'fàng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6570', glyph: '数', modern: '数', pinyin: 'shù', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6587', glyph: '文', modern: '文', pinyin: 'wén', quality: 'blue', asset: 'catalog/ob-u6587', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u65b0', glyph: '新', modern: '新', pinyin: 'xīn', quality: 'blue', asset: 'catalog/ob-u65b0', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u65e7', glyph: '旧', modern: '旧', pinyin: 'jiù', quality: 'blue', asset: 'catalog/ob-u65e7', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u65e9', glyph: '早', modern: '早', pinyin: 'zǎo', quality: 'blue', asset: 'catalog/ob-u65e9', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u660e', glyph: '明', modern: '明', pinyin: 'míng', quality: 'blue', asset: 'catalog/ob-u660e', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u660f', glyph: '昏', modern: '昏', pinyin: 'hūn', quality: 'blue', asset: 'catalog/ob-u660f', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6625', glyph: '春', modern: '春', pinyin: 'chūn', quality: 'blue', asset: 'catalog/ob-u6625', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6628', glyph: '昨', modern: '昨', pinyin: 'zuó', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u665a', glyph: '晚', modern: '晚', pinyin: 'wǎn', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6668', glyph: '晨', modern: '晨', pinyin: 'chén', quality: 'blue', asset: 'catalog/ob-u6668', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6708', glyph: '月', modern: '月', pinyin: 'yuè', quality: 'blue', asset: 'catalog/ob-u6708', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6728', glyph: '木', modern: '木', pinyin: 'mù', quality: 'blue', asset: 'catalog/ob-u6728', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u672c', glyph: '本', modern: '本', pinyin: 'běn', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6765', glyph: '来', modern: '来', pinyin: 'lái', quality: 'blue', asset: 'catalog/ob-u6765', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u676f', glyph: '杯', modern: '杯', pinyin: 'bēi', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u679c', glyph: '果', modern: '果', pinyin: 'guǒ', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6821', glyph: '校', modern: '校', pinyin: 'xiào', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u684c', glyph: '桌', modern: '桌', pinyin: 'zhuō', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6865', glyph: '桥', modern: '桥', pinyin: 'qiáo', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6905', glyph: '椅', modern: '椅', pinyin: 'yǐ', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u697c', glyph: '楼', modern: '楼', pinyin: 'lóu', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6bcd', glyph: '母', modern: '母', pinyin: 'mǔ', quality: 'blue', asset: 'catalog/ob-u6bcd', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6c11', glyph: '民', modern: '民', pinyin: 'mín', quality: 'blue', asset: 'catalog/ob-u6c11', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6c14', glyph: '气', modern: '气', pinyin: 'qì', quality: 'blue', asset: 'catalog/ob-u6c14', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6c34', glyph: '水', modern: '水', pinyin: 'shuǐ', quality: 'blue', asset: 'catalog/ob-u6c34', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6c57', glyph: '汗', modern: '汗', pinyin: 'hàn', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6c5f', glyph: '江', modern: '江', pinyin: 'jiāng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6c64', glyph: '汤', modern: '汤', pinyin: 'tāng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6c99', glyph: '沙', modern: '沙', pinyin: 'shā', quality: 'blue', asset: 'catalog/ob-u6c99', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6cb9', glyph: '油', modern: '油', pinyin: 'yóu', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6cc9', glyph: '泉', modern: '泉', pinyin: 'quán', quality: 'blue', asset: 'catalog/ob-u6cc9', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6cea', glyph: '泪', modern: '泪', pinyin: 'lèi', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6d17', glyph: '洗', modern: '洗', pinyin: 'xǐ', quality: 'blue', asset: 'catalog/ob-u6d17', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6d77', glyph: '海', modern: '海', pinyin: 'hǎi', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6e38', glyph: '游', modern: '游', pinyin: 'yóu', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u6e56', glyph: '湖', modern: '湖', pinyin: 'hú', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u706b', glyph: '火', modern: '火', pinyin: 'huǒ', quality: 'blue', asset: 'catalog/ob-u706b', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u706f', glyph: '灯', modern: '灯', pinyin: 'dēng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u70ec', glyph: '烬', modern: '烬', pinyin: 'jìn', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u722c', glyph: '爬', modern: '爬', pinyin: 'pá', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7231', glyph: '爱', modern: '爱', pinyin: 'ài', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7236', glyph: '父', modern: '父', pinyin: 'fù', quality: 'blue', asset: 'catalog/ob-u7236', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7237', glyph: '爷', modern: '爷', pinyin: 'yé', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7238', glyph: '爸', modern: '爸', pinyin: 'bà', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u73ed', glyph: '班', modern: '班', pinyin: 'bān', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u74dc', glyph: '瓜', modern: '瓜', pinyin: 'guā', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u751f', glyph: '生', modern: '生', pinyin: 'shēng', quality: 'blue', asset: 'catalog/ob-u751f', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7537', glyph: '男', modern: '男', pinyin: 'nán', quality: 'blue', asset: 'catalog/ob-u7537', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u753b', glyph: '画', modern: '画', pinyin: 'huà', quality: 'blue', asset: 'catalog/ob-u753b', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u767b', glyph: '登', modern: '登', pinyin: 'dēng', quality: 'blue', asset: 'catalog/ob-u767b', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u767e', glyph: '百', modern: '百', pinyin: 'bǎi', quality: 'blue', asset: 'catalog/ob-u767e', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u76c6', glyph: '盆', modern: '盆', pinyin: 'pén', quality: 'blue', asset: 'catalog/ob-u76c6', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u76d0', glyph: '盐', modern: '盐', pinyin: 'yán', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u770b', glyph: '看', modern: '看', pinyin: 'kàn', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u771f', glyph: '真', modern: '真', pinyin: 'zhēn', quality: 'blue', asset: 'catalog/ob-u771f', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7761', glyph: '睡', modern: '睡', pinyin: 'shuì', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u77e5', glyph: '知', modern: '知', pinyin: 'zhī', quality: 'blue', asset: 'catalog/ob-u77e5', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u77f3', glyph: '石', modern: '石', pinyin: 'shí', quality: 'blue', asset: 'catalog/ob-u77f3', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7897', glyph: '碗', modern: '碗', pinyin: 'wǎn', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u79cb', glyph: '秋', modern: '秋', pinyin: 'qiū', quality: 'blue', asset: 'catalog/ob-u79cb', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7a97', glyph: '窗', modern: '窗', pinyin: 'chuāng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7ad9', glyph: '站', modern: '站', pinyin: 'zhàn', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7b11', glyph: '笑', modern: '笑', pinyin: 'xiào', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7b14', glyph: '笔', modern: '笔', pinyin: 'bǐ', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7b77', glyph: '筷', modern: '筷', pinyin: 'kuài', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7c73', glyph: '米', modern: '米', pinyin: 'mǐ', quality: 'blue', asset: 'catalog/ob-u7c73', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7ca5', glyph: '粥', modern: '粥', pinyin: 'zhōu', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7cd6', glyph: '糖', modern: '糖', pinyin: 'táng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7eb8', glyph: '纸', modern: '纸', pinyin: 'zhǐ', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u7f38', glyph: '缸', modern: '缸', pinyin: 'gāng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8001', glyph: '老', modern: '老', pinyin: 'lǎo', quality: 'blue', asset: 'catalog/ob-u8001', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8089', glyph: '肉', modern: '肉', pinyin: 'ròu', quality: 'blue', asset: 'catalog/ob-u8089', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8239', glyph: '船', modern: '船', pinyin: 'chuán', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u82f1', glyph: '英', modern: '英', pinyin: 'yīng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8336', glyph: '茶', modern: '茶', pinyin: 'chá', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u83dc', glyph: '菜', modern: '菜', pinyin: 'cài', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u852c', glyph: '蔬', modern: '蔬', pinyin: 'shū', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u86cb', glyph: '蛋', modern: '蛋', pinyin: 'dàn', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8840', glyph: '血', modern: '血', pinyin: 'xuè', quality: 'blue', asset: 'catalog/ob-u8840', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u884c', glyph: '行', modern: '行', pinyin: 'xíng', quality: 'blue', asset: 'catalog/ob-u884c', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8857', glyph: '街', modern: '街', pinyin: 'jiē', quality: 'blue', asset: 'catalog/ob-u8857', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8bb0', glyph: '记', modern: '记', pinyin: 'jì', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8bed', glyph: '语', modern: '语', pinyin: 'yǔ', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8bf4', glyph: '说', modern: '说', pinyin: 'shuō', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8bfb', glyph: '读', modern: '读', pinyin: 'dú', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8bfe', glyph: '课', modern: '课', pinyin: 'kè', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8c01', glyph: '谁', modern: '谁', pinyin: 'shuí', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8d70', glyph: '走', modern: '走', pinyin: 'zǒu', quality: 'blue', asset: 'catalog/ob-u8d70', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8dd1', glyph: '跑', modern: '跑', pinyin: 'pǎo', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8def', glyph: '路', modern: '路', pinyin: 'lù', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8df3', glyph: '跳', modern: '跳', pinyin: 'tiào', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8f66', glyph: '车', modern: '车', pinyin: 'chē', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8fd9', glyph: '这', modern: '这', pinyin: 'zhè', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u8fdb', glyph: '进', modern: '进', pinyin: 'jìn', quality: 'blue', asset: 'catalog/ob-u8fdb', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u9053', glyph: '道', modern: '道', pinyin: 'dào', quality: 'blue', asset: 'catalog/ob-u9053', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u90a3', glyph: '那', modern: '那', pinyin: 'nà', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u9152', glyph: '酒', modern: '酒', pinyin: 'jiǔ', quality: 'blue', asset: 'catalog/ob-u9152', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u91cc', glyph: '里', modern: '里', pinyin: 'lǐ', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u91d1', glyph: '金', modern: '金', pinyin: 'jīn', quality: 'blue', asset: 'catalog/ob-u91d1', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u95e8', glyph: '门', modern: '门', pinyin: 'mén', quality: 'blue', asset: 'catalog/ob-u95e8', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u9662', glyph: '院', modern: '院', pinyin: 'yuàn', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u97f3', glyph: '音', modern: '音', pinyin: 'yīn', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u98ce', glyph: '风', modern: '风', pinyin: 'fēng', quality: 'blue', asset: 'catalog/ob-u98ce', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u98de', glyph: '飞', modern: '飞', pinyin: 'fēi', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u996d', glyph: '饭', modern: '饭', pinyin: 'fàn', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u997c', glyph: '饼', modern: '饼', pinyin: 'bǐng', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u9a6c', glyph: '马', modern: '马', pinyin: 'mǎ', quality: 'blue', asset: 'catalog/ob-u9a6c', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u9ad8', glyph: '高', modern: '高', pinyin: 'gāo', quality: 'blue', asset: 'catalog/ob-u9ad8', imageBounds: [0, 0, 200, 200], excavatable: true, meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    { id: 'catalog-u9ea6', glyph: '麦', modern: '麦', pinyin: 'mài', quality: 'blue', meaning: '甲骨文字，待正式甲骨资料到位后补充释义。', evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。', history: '待补充。' },
    {
      id: 'rain', glyph: '雨', modern: '雨', pinyin: 'yǔ', quality: 'blue',
      asset: 'catalog/ob-u96e8', imageBounds: [0, 0, 199, 199], excavatable: true,
      meaning: '表示从天空降下的雨水，是观察自然天气的重要文字。',
      evolution: '图鉴所用甲骨字形以密集短画表现自天而降的雨势；后世逐步收束为“雨”的外框与内部点画。',
      history: '商代卜辞常记录求雨、止雨和未来天气，帮助安排耕作与祭祀。',
    },
    {
      id: 'sun', glyph: '日', modern: '日', pinyin: 'rì', quality: 'blue',
      asset: 'ri', imageBounds: [25, 72, 75, 105], excavatable: true,
      meaning: '字形像太阳的轮廓，中间的短画用来区别普通圆形，表示太阳、白昼和日期。',
      evolution: '早期字形保留太阳外框与中心标记，经过金文、小篆逐渐规整，最终演变为现代“日”字。',
      history: '商代先民观察日出、日落与日影安排农事、祭祀和出行，卜辞也常以“日”记录时间。',
    },
    {
      id: 'river-official', glyph: '河', modern: '河', pinyin: 'hé', quality: 'blue',
      asset: 'he', imageBounds: [27, 44, 73, 132], excavatable: true,
      meaning: '字形以水流为核心，并结合表示河道与水势的构件，用来记录河川、水势和渡涉。',
      evolution: '早期字形保留流动水纹与河道结构，经过金文、小篆逐步固定，最终形成现代“河”字。',
      history: '洹河是殷墟聚落的重要自然环境，商代卜辞中的水事与出行、渔猎、农耕和祭祀密切相关。',
    },
    {
      id: 'cloud-official', glyph: '云', modern: '云', pinyin: 'yún', quality: 'blue',
      asset: 'yun', imageBounds: [33, 51, 69, 126], excavatable: true,
      meaning: '字形描绘天空中卷曲、层叠的云气，用来表示云层以及与天气有关的自然现象。',
      evolution: '甲骨文字形着重表现云气回旋的轮廓，经过长期简化和规整，演变为现代“云”字。',
      history: '云层变化与降雨、农时和出行直接相关，商代先民会结合云、雨等天象进行观察和占问。',
    },
    {
      id: 'star-official', glyph: '星', modern: '星', pinyin: 'xīng', quality: 'gold',
      asset: 'xing', imageBounds: [25, 52, 75, 123], excavatable: true,
      meaning: '字形表现夜空中可见的星体，并以组合结构强调星光与天象，是观察天空的重要文字。',
      evolution: '早期字形以多个星点或日形表现群星，后来结构逐渐稳定，形成现代“星”字。',
      history: '商代对日月星辰的观察服务于历法、农时、祭祀和方向判断，体现了早期天象知识的积累。',
    },
    {
      id: 'field', glyph: '田', modern: '田', pinyin: 'tián', quality: 'red',
      asset: 'catalog/ob-u7530', imageBounds: [0, 0, 199, 199], excavatable: true,
      meaning: '表示划分整齐的耕地，与播种、收获和田猎活动有关。',
      evolution: '图鉴字形以阡陌分割的方格象征田界；经金文、篆书的线条规整，发展为今天的“田”字。',
      history: '甲骨卜辞中常见对收成、田猎和土地事务的占问。',
    },
    {
      id: 'water-temp', glyph: '水', modern: '水', pinyin: 'shuǐ', quality: 'blue',
      asset: 'catalog/ob-u6c34', imageBounds: [0, 0, 199, 199], excavatable: true,
      meaning: '字形以中间主流和两侧分支表现流水，表示江河、水源及与水有关的行动。',
      evolution: '甲骨文把水流的分叉和回旋写成可见线条；后世逐渐把它规范为“水”的竖画、撇捺结构。',
      history: '商代卜辞常把水与降雨、渡涉、渔猎和农事相连；河畔聚落的用水与水势都可能成为占问事项。',
    },
    {
      id: 'millet-temp', glyph: '♮', modern: '禾（临）', pinyin: 'hé', quality: 'blue',
      meaning: '临时收藏位：表示禾谷与生长，正式字形资料到位后替换。',
      evolution: '由成熟穗子的轮廓发展而来，此版先使用临时符号。',
      history: '郊外田野更容易发现的普通卜骨，对应播种与收获。',
    },
    {
      id: 'ancestor-temp', glyph: '▱', modern: '祖（临）', pinyin: 'zǔ', quality: 'red',
      meaning: '临时收藏位：表示先祖与宗庙祭礼。',
      evolution: '将在正式资料中展示相应甲骨拓片和字形演变。',
      history: '湖泊沿岸和祭祀地层可见的涂朱类卜甲记录。',
    },
    {
      id: 'ritual-temp', glyph: '✦', modern: '祭（临）', pinyin: 'jì', quality: 'red',
      meaning: '临时收藏位：表示祭祀活动与礼仪。',
      evolution: '实物字形待后续三百字资料库接入。',
      history: '与商代祭祀场所、燎祭和宴飨活动相关。',
    },
    {
      id: 'king-temp', glyph: '◆', modern: '王（临）', pinyin: 'wáng', quality: 'gold',
      meaning: '临时收藏位：表示王权与王室卜事。',
      evolution: '金光收藏先使用临时符号，不影响品质与重复转化数据。',
      history: '仅在甲骨窑穴·王陵祭祀区发现的王室金光卜甲。',
    },
    {
      id: 'tomb-temp', glyph: '◈', modern: '陵（临）', pinyin: 'líng', quality: 'gold',
      meaning: '临时收藏位：表示王陵地层中的特殊祭告记录。',
      evolution: '正式资料接入后，将换成真实甲骨字形与拓片。',
      history: '王陵祭祀区独有的金光收藏，用于验证高品质学习链路。',
    },
    {
      id: 'mountain-temp', glyph: '△', modern: '山（临）', pinyin: 'shān', quality: 'blue',
      meaning: '以连绵峰峦的轮廓表示山地，是典型的象形造字思路。',
      evolution: '临时符号保留三峰结构；正式资料接入后将展示甲骨文字形、摹本和楷书演变对照。',
      history: '商代卜辞中的山常与方域、出行、狩猎和自然崇拜有关，能帮助学习者理解先民的空间观念。',
    },
    {
      id: 'tree-temp', glyph: '木', modern: '木', pinyin: 'mù', quality: 'blue',
      asset: 'mu', imageBounds: [34, 50, 66, 130], excavatable: true,
      meaning: '描绘树干、树枝和根部，后来既表示树木，也成为许多植物类汉字的构形部件。',
      evolution: '甲骨文字形突出向上分出的枝条和向下伸展的根部，后来逐渐规整为现代“木”字。',
      history: '木材与房屋、车具、农具和祭祀器物制作密切相关，是认识商代生产生活的重要入口。',
    },
    {
      id: 'fire-temp', glyph: '♢', modern: '火（临）', pinyin: 'huǒ', quality: 'blue',
      meaning: '模拟火焰向上升腾、火星向两侧散开的形态，表示燃烧和火光。',
      evolution: '临时符号用于辨识流程；正式资料会展示火焰笔画如何逐渐稳定为现代“火”字。',
      history: '火在炊煮、照明、烧陶、冶铸和祭祀中都十分关键，可联系青铜文明的技术发展。',
    },
    {
      id: 'moon-temp', glyph: '月', modern: '月', pinyin: 'yuè', quality: 'blue',
      asset: 'yue', imageBounds: [39, 56, 61, 127], excavatable: true,
      meaning: '以弯月或月轮的形态表示月亮，并可用于记录月份和夜间时间。',
      evolution: '甲骨文字形保留弯月的细长轮廓，后来内部笔画和外框逐渐稳定为现代“月”字。',
      history: '观察月相有助于安排历法、农时与祭祀日期，体现商代对天象变化的长期记录。',
    },
    {
      id: 'person-temp', glyph: '∧', modern: '人（临）', pinyin: 'rén', quality: 'blue',
      meaning: '侧面描绘站立或行走的人体，突出躯干与腿部，是基础象形字之一。',
      evolution: '临时符号表现人体轮廓；正式资料将展示不同书写方向和姿态造成的字形差别。',
      history: '“人”及其变体常参与身份、劳作、战争和祭祀相关记录，是理解卜辞人物关系的基础。',
    },
    {
      id: 'cow-temp', glyph: '⋈', modern: '牛（临）', pinyin: 'niú', quality: 'red',
      meaning: '突出牛头正面的双角和耳部特征，以最有辨识度的局部代表整只动物。',
      evolution: '临时符号强调双角；正式版本将补充牛头象形如何逐步转化为稳定笔画。',
      history: '牛既用于农业和运输，也常见于祭祀牲礼记录，能连接文字学习与商代礼制。',
    },
    {
      id: 'horse-temp', glyph: '⌁', modern: '马（临）', pinyin: 'mǎ', quality: 'red',
      meaning: '早期字形会表现马的头、鬃、身体和长腿，用于记录马匹及车马活动。',
      evolution: '临时符号仅作题库占位；正式资料将展示复杂动物轮廓如何简化成后世字形。',
      history: '马与车战、出行、田猎和贡纳密切相关，是认识商代交通与军事的重要主题。',
    },
    {
      id: 'bird-temp', glyph: '⌒', modern: '鸟（临）', pinyin: 'niǎo', quality: 'red',
      meaning: '抓住鸟喙、羽翼、身体和尾羽等特征表示鸟类，属于动物象形字。',
      evolution: '临时符号用于区分选项；正式资料将补充不同鸟类字形及其细节变化。',
      history: '鸟类与季节观察、狩猎、氏族象征和祭祀观念相关，可结合地图中的水鸟动态进行学习。',
    },
    {
      id: 'mouth-temp', glyph: '▢', modern: '口（临）', pinyin: 'kǒu', quality: 'blue',
      meaning: '以张开的嘴部轮廓表示口，也可参与构成与说话、进食有关的文字。',
      evolution: '临时符号保留封闭轮廓；正式字库将换成对应摹本与拓片。',
      history: '卜辞中的口形构件可联系命令、言说与人口等语境，是理解会意构形的基础。',
    },
    {
      id: 'eye-temp', glyph: '◉', modern: '目（临）', pinyin: 'mù', quality: 'blue',
      meaning: '描绘人的眼睛和瞳孔，用于表示眼目、观看与观察。',
      evolution: '临时符号突出眼眶和瞳孔；正式资料将展示横置眼形逐渐转为竖写结构的过程。',
      history: '由身体局部造字能帮助学习者理解甲骨文抓取事物典型特征的方式。',
    },
    {
      id: 'ear-temp', glyph: 'ϟ', modern: '耳（临）', pinyin: 'ěr', quality: 'blue',
      meaning: '取耳郭曲折的侧面轮廓表示耳朵，并引申到听闻。',
      evolution: '当前以曲折符号占位，正式字库将补充不同时期耳形笔画的变化。',
      history: '身体象形字常作为其他文字的构件，可由此观察早期汉字的组合规律。',
    },
    {
      id: 'hand-temp', glyph: '≋', modern: '手（临）', pinyin: 'shǒu', quality: 'blue',
      meaning: '描绘手掌与手指，常用于表达拿取、劳作和动作。',
      evolution: '临时符号强调分出的指形；正式资料会对照正写、侧写等不同手形。',
      history: '农耕、制造和祭祀记录中常见手形构件，能连接文字与具体劳动场景。',
    },
    {
      id: 'foot-temp', glyph: '⌞', modern: '足（临）', pinyin: 'zú', quality: 'blue',
      meaning: '以小腿和脚掌的轮廓表示足部，并可表示行走、到达。',
      evolution: '临时符号保留弯折脚掌；正式字形将展示足迹与下肢形态的演变。',
      history: '出行、征伐和田猎相关文字常包含足形，可用于认识动作类会意字。',
    },
    {
      id: 'child-temp', glyph: '⌇', modern: '子（临）', pinyin: 'zǐ', quality: 'blue',
      meaning: '描绘幼儿头部、身体和双臂，表示孩子或后代。',
      evolution: '临时符号简化人体结构；正式资料将展示头大身小的早期象形特点。',
      history: '卜辞会记录生育、家族与子嗣事务，是了解商代家族关系的重要材料。',
    },
    {
      id: 'woman-temp', glyph: '∿', modern: '女（临）', pinyin: 'nǚ', quality: 'blue',
      meaning: '早期字形常表现屈膝跪坐、双手收于身前的人物姿态。',
      evolution: '当前用姿态符号占位；正式字库将比较不同拓片中的身体与手臂结构。',
      history: '人物称谓和亲属关系在卜辞中十分常见，可结合具体卜辞语境学习。',
    },
    {
      id: 'large-temp', glyph: '⋀', modern: '大（临）', pinyin: 'dà', quality: 'blue',
      meaning: '描绘正面张开双臂站立的人，以舒展的姿态表示大。',
      evolution: '临时符号突出伸展轮廓；正式资料将补充人体象形向抽象意义发展的过程。',
      history: '从具体人体姿态引申出大小概念，体现早期汉字由象形走向表意。',
    },
    {
      id: 'small-temp', glyph: '∴', modern: '小（临）', pinyin: 'xiǎo', quality: 'blue',
      meaning: '以数个细小点画表示微小、细碎的事物。',
      evolution: '临时符号保留散点结构；正式资料将对照点画数量与排列差异。',
      history: '把抽象尺度转化为可见点画，是认识指事造字方法的直观例子。',
    },
    {
      id: 'above-temp', glyph: '⊥', modern: '上（临）', pinyin: 'shàng', quality: 'blue',
      meaning: '用基准线和位于其上的短画表示上方位置。',
      evolution: '临时符号展示相对位置；正式资料会呈现早期指事符号的书写方向。',
      history: '“上”体现用简单标记表达空间关系的指事方法，可与地图方位学习结合。',
    },
    {
      id: 'below-temp', glyph: '⊤', modern: '下（临）', pinyin: 'xià', quality: 'blue',
      meaning: '用基准线和位于其下的短画表示下方位置。',
      evolution: '临时符号与“上”成组展示；正式资料将替换为准确甲骨字形。',
      history: '成对学习上下位置字，有助于区分相近结构并理解指事字的造字逻辑。',
    },
    {
      id: 'earth-temp', glyph: '土', modern: '土', pinyin: 'tǔ', quality: 'blue',
      asset: 'catalog/ob-u571f', imageBounds: [0, 0, 199, 199], excavatable: true,
      meaning: '表现地面上隆起的土块或土堆，用于表示土地。',
      evolution: '图鉴字形以地面横线和隆起的土块为核心；此后线条逐渐规整，形成“土”的上下结构。',
      history: '土地与城邑、农耕、方域和祭祀密切相关，是殷墟生活的重要主题。',
    },
    {
      id: 'river-temp', glyph: '〰', modern: '川（临）', pinyin: 'chuān', quality: 'blue',
      meaning: '以并行、弯曲的水道表示河川和流动的水系。',
      evolution: '临时符号保留水流方向；正式资料将补充多道水线的甲骨写法。',
      history: '可结合洹水河畔地图观察自然河道，理解文字与真实地貌之间的联系。',
    },
    {
      id: 'door-temp', glyph: 'Π', modern: '门（临）', pinyin: 'mén', quality: 'blue',
      meaning: '描绘门扇、门框或成对门板，用于表示建筑出入口。',
      evolution: '临时符号保留门框轮廓；正式资料会展示单扇与双扇结构的差异。',
      history: '由城门、房门等地图场景进入文字学习，可帮助学习者建立形义联想。',
    },
    {
      id: 'dog-temp', glyph: '∽', modern: '犬（临）', pinyin: 'quǎn', quality: 'blue',
      meaning: '以侧面动物的头、身、足和卷尾表示犬类。',
      evolution: '临时符号强调弯曲尾部；正式字库将补充完整动物象形轮廓。',
      history: '犬与狩猎、守卫和祭祀相关，可结合村落动物活动理解商代生活。',
    },
    {
      id: 'boat-temp', glyph: '⌣', modern: '舟（临）', pinyin: 'zhōu', quality: 'red',
      meaning: '描绘狭长船身和船舷，表示水上行舟。',
      evolution: '临时符号表现船体弧线；正式资料将对照船舱、船首等细节。',
      history: '舟联系河流交通、捕鱼与物资运输，在湖泊和洹水区域以红光收藏出现。',
    },
    {
      id: 'fish-temp', glyph: '鱼', modern: '鱼', pinyin: 'yú', quality: 'red',
      asset: 'yu', imageBounds: [24, 50, 76, 127], excavatable: true,
      meaning: '描绘鱼头、鱼身、鳍和尾部，以完整动物外形表示鱼。',
      evolution: '早期字形完整保留鱼身、鱼鳍与尾部，随着书写简化，轮廓逐渐演变成现代“鱼”字。',
      history: '渔猎和水产资源是河畔生活的一部分，可与钓鱼玩法和水域生态联动学习。',
    },
    ...importedOracleCards,
    ...supplementalOracleCards,
    ...generatePlannedMissingCards(),
  ];
  // 按 id 去重：优先保留「有真实字形图(asset)」的卡（手写特殊卡 / imported 真实卡），
  // 无图占位卡（手写占位或本次生成的占位）仅在无更优版本时保留，确保待补字也能进入全集。
  const byId = new Map<string, (typeof raw)[number]>();
  for (const card of raw) {
    const existing = byId.get(card.id);
    if (!existing || (!existing.asset && card.asset)) byId.set(card.id, card);
  }
  return [...byId.values()];
})().map(card => ({
    ...card,
    quality: card.quality as OracleQuality,
    imageBounds: card.imageBounds as OracleCardData['imageBounds'],
    ...(ORACLE_GLYPH_ASSET_OVERRIDES[card.id] ?? {}),
  }));
  // ⚠️ 不要在 oracleCards 本体上按「现代字」去重（上游曾在此加过一层 filter，合并时已剔除）。
  // oracleCards 是运行时数据源：挖掘池、题库、字表校验(validIds)、存档解锁 id 都依赖它。
  // 实测按现代字去重会删掉 5 张被字表引用的卡（catalog-u571f 土 / u6c34 水 / u6708 月 /
  // u6728 木 / u7940 祀），转而保留不在字表里的 legacy 卡（earth-temp 等），
  // 导致第一章 5 字塌成 3 字、第二章缺「木」、第四章缺「月」、拾遗缺「祀」。
  // 「图鉴不出现重复字」的诉求已在展示层 getCards 的去重中实现，无需动本体。
  private readonly divinationQuestions: DivinationQuestion[] = buildDivinationQuestions(
    this.oracleCards.filter(card => this.hasRealOracleGlyph(card)),
  );
  private readonly shopProducts: ShopProduct[] = [
    { id: 'shell-clay', name: '素面占卜龟甲', price: 0, description: '宗庙初始使用的朴素龟甲，保留自然灼裂纹理。', quality: 'blue' },
    { id: 'shell-vermilion', name: '涂朱占卜龟甲', price: 180, description: '朱砂沿裂纹缓慢亮起，改变占卜龟甲与成功动画。', quality: 'red' },
    { id: 'shell-gold', name: '鎏金王室龟甲', price: 420, description: '金色裂纹与祭祀光点环绕的珍贵龟甲外观。', quality: 'gold' },
  ];
  private save!: CitySave;
  private overlay: CityOverlay = 'none';
  // UI buttons are drawn in code, so they do not have individual Cocos Button
  // components to host a click clip. A short WebAudio tone keeps the feedback
  // consistent without adding a separate asset dependency.
  private uiAudioContext: any = null;
  private divinationStage: DivinationStage = 'none';
  private overlayRoot: Node | null = null;
  private excavationLearningMask: Node | null = null;
  private actionLabel!: Label;
  private actionButtonNode!: Node;
  private actionToolIconNode!: Node;
  private currencyLabel!: Label;
  private actionKind: 'none' | 'temple' | 'templeSeat' | 'templeExit' | 'shop' = 'none';
  private worldMode: WorldMode = 'outside';
  private templeInterior: Node | null = null;
  private interiorObstacles: RectObstacle[] = [];
  private templeChairVisualRoot: Node | null = null;
  private templeTableVisual: Node | null = null;
  private templeTableForegroundVisual: Node | null = null;
  private templeCollisionDebug: Node | null = null;
  private templeCollisionDebugGraphics: Graphics | null = null;
  private templePreSitPosition: Vec2 | null = null;
  private templePreSitFacing: Facing = 'down';
  private templePreSitWorldMode: WorldMode = 'templeInterior';
  private templeLastRisePosition: Vec2 | null = null;
  private seated = false;
  private currentQuestion: DivinationQuestion | null = null;
  // A story divination is one seated ceremony of three rounds. The narrative
  // advances only after the third result is confirmed.
  private storyDivinationRounds = 0;
  private storyDivinationAnswerIds: string[] = [];
  private currentQuestionIndex = -1;
  private currentAttempts = 0;
  private queueTimer = 0;
  private divinationAnimationTimer = 0;
  private divinationText: Label | null = null;
  private divinationName: Label | null = null;
  private riseButtonLabel: Label | null = null;
  private oracleCardNodes: Node[] = [];
  private oracleCardHome: Vec2[] = [];
  private currentDivinationCards: OracleCardData[] = [];
  private draggingCardIndex = -1;
  private dragOffset = new Vec2();
  private correctCardIndex = -1;
  private divinationShellNode: Node | null = null;
  private divinationCracks: Graphics | null = null;
  private divinationFusedGlyph: Node | null = null;
  private divinationActiveCardNode: Node | null = null;
  private divinationActiveCard: OracleCardData | null = null;
  private supplicant: Node | null = null;
  private supplicantVisual: Node | null = null;
  private supplicantSprite: Sprite | null = null;
  private supplicantFrames: Record<Facing, Array<SpriteFrame | null>> = {
    down: [null, null, null, null], left: [null, null, null, null],
    right: [null, null, null, null], up: [null, null, null, null],
  };
  private supplicantFacing: Facing = 'right';
  private supplicantWalkPhase = 0;
  private supplicantDisplayedFrame = -1;
  private supplicantTarget = new Vec2(150, -82);
  private supplicantLeaving = false;
  private currentRewardCoins = 0;
  private currentRewardExperience = 0;
  private currentMasteryStars = 0;
  private selectedBackpackIndex = 0;
  private codexPage = 0;
  private backpackTab: BackpackTab = 'tools';
  private equippedTool: ToolKind = 'none';
  // Kept solely to dispose a stale effect from a hot-reloaded older session;
  // no current tool list, input, UI, or action can create these effects.
  private fishingCastEffect: FishingCastEffect | null = null;
  private cutPlantRegrowth: CutPlantRegrowth[] = [];
  private heldToolNode!: Node;
  private heldToolGraphics!: Graphics;
  private toolActionTimer = 0;
  private toolActionDuration = .5;
  private dugHoles: DugHole[] = [];
  private excavationSites: ExcavationSite[] = [];
  private pendingExcavation: PendingExcavation | null = null;
  private excavationLearningStage: ExcavationLearningStage = 'none';
  private excavationLearningSite: ExcavationSite | null = null;
  private excavationLearningCard: OracleCardData | null = null;
  private excavationLearningOptions: OracleCardData[] = [];
  private excavationWrongChoices: number[] = [];
  private excavationLearningAttempts = 0;
  private excavationLearningFeedback: Label | null = null;
  private excavationLearningResult = '';
  // 拾遗坑：主线通关后才逐批现世（渐进刷新，不一次性点亮、不集体刷新）。
  private supplementSites: ExcavationSite[] = [];
  private supplementRevealStarted = false;
  private supplementRevealTimer = 0;
  private supplementRevealIndex = 0;
  private static readonly SUPPLEMENT_REVEAL_BATCH = 4;     // 每批发掘点数
  private static readonly SUPPLEMENT_REVEAL_INTERVAL = 45;  // 批次间隔（秒）
  private static readonly SUPPLEMENT_MIN_DISTANCE = 480;    // 彼此最小间距（分散些）
  private rewardFlights: RewardFlight[] = [];
  private digParticles: DigParticle[] = [];
  private backpackDetailLabel: Label | null = null;
  private selectedShopProductIndex = 0;
  private shopFeedback: Label | null = null;
  private previewDepthSpot = 0;
  private learningHall!: LearningHall;
  private regionTransitionManager: RegionTransitionManager | null = null;
  private regionInputLocked = false;
  private terrainElevation: TerrainElevation = 'UPPER';
  private terrainElevationDebugLabel: Label | null = null;
  private storyController!: StoryController;
  private storyDialogue!: DialoguePanel;
  private chapterBanner!: ChapterBanner;
  private questGuide!: QuestGuide;
  private storyNpc: Node | null = null;
  private storyNpcTwo: Node | null = null;
  private storyNpcThree: Node | null = null;
  private storyNpcFour: Node | null = null;
  private storyNpcFive: Node | null = null;
  private storyNpcSix: Node | null = null;
  private storyNpcSeven: Node | null = null;
  private storyNpcEight: Node | null = null;
  private storyNpcNine: Node | null = null;
  private presentedStoryStepId: string | null = null;
  private storyArrivalLocked = false;
  private storyWorldEntered = false;
  private lastGuidanceStepId: string | null = null;
  private storyPresentationToken = 0;
  private storyTestButtons: Node[] = [];

  onLoad() {
    // 学习机与普通横屏设备统一使用 16:9 设计画布。选择 SHOW_ALL，
    // 宁可留边也不拉伸或裁切学习界面，所有交互坐标保持一致。
    view.setDesignResolutionSize(1280, 720, ResolutionPolicy.SHOW_ALL);
    this.enabled = false;
    void this.initializeGame();
  }

  private async initializeGame() {
    this.save = await this.loadCitySave();
    // Android emits EVENT_HIDE when the app is backgrounded or closed from a
    // learning tablet. Flush before rendering so the first completed action is
    // protected even if the process is immediately reclaimed by the OS.
    game.on(Game.EVENT_HIDE, this.onApplicationHide, this);
    this.audioManager = GameAudioManager.ensure();
    this.audioManager.setMusicEnabled(this.save.musicOn);
    this.audioManager.setSfxEnabled(this.save.sfxOn);
    this.restoreSavedRegionPosition();
    this.buildWorld();
    this.relocatePlayerOutOfRiverWater();
    this.createRegionTransitionManager();
    this.updateBgmForRegion(this.regionTransitionManager.currentRegionId);
    this.updateOutskirtsVisibility();
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    view.on('canvas-resize', this.refreshExcavationLearningMask, this);
    view.on('design-resolution-changed', this.refreshExcavationLearningMask, this);
    this.learningHall = this.node.addComponent(LearningHall);
    this.learningHall.initialize({
      getCards: () => {
        const isPreview = this.unlockAllCatalogForPreview;
        const discoveryOrder = isPreview
          ? this.oracleCards.filter(card => this.hasRealOracleGlyph(card)).map(card => card.id)
          : this.save.unlockedOracleIds;
        // 图鉴始终返回全部带图卡（含未挖掘的待补字占位卡）；未解锁的由图鉴 UI 渲染成
        // 「尚未发现 / ？」占位格，已挖掘的显示真字形。preview 模式则全部标为已解锁，仅供调试。
        const catalogPool = this.oracleCards.filter(card => this.hasRealOracleGlyph(card)
          && !CATALOG_HIDDEN_LEGACY_DUPLICATE_IDS.has(card.id));
        // 展示层按现代字去重，避免图鉴出现重复字格（来自上游）。
        // 同字多卡时的取舍优先级（避免「已挖到却显示未解锁」，也保证字表卡不被 legacy 卡挤掉）：
        //   ① 玩家已解锁的那张 → ② 字表（主线/拾遗）内的那张 → ③ 先出现的那张。
        const unlockedIds = new Set(discoveryOrder);
        const rankOf = (card: (typeof catalogPool)[number]) => (unlockedIds.has(card.id) ? 2 : 0)
          + ((STORY_CARD_IDS.has(card.id) || SUPPLEMENT_CARD_IDS.has(card.id)) ? 1 : 0);
        const keptByModern = new Map<string, (typeof catalogPool)[number]>();
        for (const card of catalogPool) {
          const modern = this.oracleModernCharacter(card);
          const kept = keptByModern.get(modern);
          if (!kept || rankOf(card) > rankOf(kept)) keptByModern.set(modern, card);
        }
        return catalogPool
          .filter(card => keptByModern.get(this.oracleModernCharacter(card)) === card)
          .map(card => ({
            id: card.id, glyph: card.glyph, modern: this.oracleModernCharacter(card), pinyin: card.pinyin,
            quality: card.quality, meaning: card.meaning, evolution: this.learningEvolution(card), history: card.history,
            asset: card.asset,
            imageBounds: card.imageBounds,
            unlocked: discoveryOrder.includes(card.id),
          } satisfies HallCard))
          .sort((a, b) => {
            if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
            if (!a.unlocked) return 0;
            return discoveryOrder.indexOf(b.id) - discoveryOrder.indexOf(a.id);
          });
      },
      // 图鉴进度分层：主线甲骨(9 章 PLANS，250) + 甲骨拾遗(SUPPLEMENT_CHARS，50)。
      // story/supplement 各自独立计数；total/collected 为两者合计，兼容旧调用方。
      getCatalogProgress: () => {
        const unlocked = this.save.unlockedOracleIds;
        const storyCollected = [...STORY_CARD_IDS].filter(id => unlocked.includes(id)).length;
        const supplementCollected = [...SUPPLEMENT_CARD_IDS].filter(id => unlocked.includes(id)).length;
        const storyTotal = STORY_CARD_IDS.size;
        const supplementTotal = SUPPLEMENT_CARD_IDS.size;
        return {
          total: storyTotal + supplementTotal,
          collected: storyCollected + supplementCollected,
          story: { total: storyTotal, collected: storyCollected },
          supplement: { total: supplementTotal, collected: supplementCollected },
        };
      },
      getProgress: () => ({
        ink: this.save.ink,
        coins: this.save.coins,
        experience: this.save.experience,
        attempts: Object.values(this.save.mastery).reduce((sum, record) => sum + record.attempts, 0),
        correct: Object.values(this.save.mastery).reduce((sum, record) => sum + record.correctCount, 0),
      }),
      getStoryProgress: () => ({
        currentChapterId: this.save.story.currentChapterId,
        currentStepId: this.save.story.currentStepId,
        completedChapterIds: [...this.save.story.completedChapterIds],
        unlockedOracleIds: [...this.save.unlockedOracleIds],
        destinyPower: this.save.story.destinyPower,
      }),
      getProfile: () => ({
        playerName: this.save.playerName,
        avatarId: this.save.avatarId,
        avatarUrl: this.save.avatarUrl,
        characterChoiceCompleted: this.save.characterChoiceCompleted,
        musicOn: this.save.musicOn,
        sfxOn: this.save.sfxOn,
        nightMode: this.save.nightMode,
      }),
      setName: (name) => {
        const trimmed = name.trim();
        this.save.playerName = trimmed.length > 0 ? trimmed : '少年卜官';
        this.persistCitySave();
      },
      setAvatar: (avatarId, avatarUrl) => {
        this.save.avatarId = avatarId;
        if (avatarId === 'custom' && avatarUrl) {
          this.save.avatarUrl = avatarUrl;
        } else {
          delete this.save.avatarUrl;
        }
        this.persistCitySave();
        if (avatarId === 'oracle-boy-pixel' || avatarId === 'oracle-girl-pixel') {
          this.loadPlayerCharacterFrames();
        }
      },
      choosePlayerCharacter: (avatarId) => {
        this.save.avatarId = avatarId;
        delete this.save.avatarUrl;
        this.save.characterChoiceCompleted = true;
        this.loadPlayerCharacterFrames();
        this.persistCitySave();
      },
      toggleMusic: () => {
        this.save.musicOn = !this.save.musicOn;
        this.audioManager.setMusicEnabled(this.save.musicOn);
        this.persistCitySave();
      },
      toggleSfx: () => {
        this.save.sfxOn = !this.save.sfxOn;
        this.audioManager.setSfxEnabled(this.save.sfxOn);
        this.persistCitySave();
      },
      toggleNight: () => {
        this.save.nightMode = !this.save.nightMode;
        this.persistCitySave();
      },
      getWeakCards: () => {
        return Object.entries(this.save.mastery)
          .filter(([, record]) => record.attempts >= 1 && record.correctCount / record.attempts < 0.6)
          .map(([id, record]) => ({ id, rate: record.correctCount / record.attempts }))
          .sort((a, b) => a.rate - b.rate)
          .slice(0, 3)
          .map(entry => entry.id);
      },
      getWrongBook: () => Object.entries(this.save.wrongBook ?? {})
        .map(([cardId, entry]) => ({ cardId, wrongCount: entry.wrongCount, lastWrongAt: entry.lastWrongAt }))
        .sort((a, b) => b.lastWrongAt - a.lastWrongAt),
      clearWrongBook: (cardId: string) => {
        delete this.save.wrongBook[cardId];
        this.persistCitySave();
      },
      enterHall: () => this.audioManager.setHallMuted(true),
      resumeWorld: () => {
        this.updateBgmForRegion(this.regionTransitionManager.currentRegionId);
        this.audioManager.setHallMuted(false);
      },
      recordReview: (cardId, correct) => {
        const record = this.save.mastery[cardId] ?? { attempts: 0, bestStars: 0, correctCount: 0 };
        record.attempts++;
        if (correct) record.correctCount++;
        this.save.mastery[cardId] = record;
        if (!correct) {
          const wrong = this.save.wrongBook[cardId] ?? { wrongCount: 0, lastWrongAt: 0 };
          wrong.wrongCount++;
          wrong.lastWrongAt = Date.now();
          this.save.wrongBook[cardId] = wrong;
        }
        this.persistCitySave();
        const lessonStepId = this.storyController?.currentStep()?.id;
        const expectedLesson = this.allStoryFragmentCards.find(item =>
          item.lessonStepId === lessonStepId && item.cardId === cardId);
        if (correct && expectedLesson
          && this.storyController?.handle({ type: 'learning-completed', cardId, correct })) {
          this.scheduleOnce(() => {
            this.learningHall.returnToCity();
            this.presentStoryStep(this.storyController.currentStep());
          }, .08);
        }
        // Free-main cards are learned outside the linear scripted lesson
        // sequence. Once the final one is learned, reopen the pending chapter
        // challenge instead of leaving the player at an invisible gate.
        if (correct) {
          const chapterId = this.storyController?.snapshot().currentChapterId;
          this.showChapterCollectionMilestone(chapterId);
          const step = this.storyController?.currentStep();
          if (step?.id.endsWith('fragment-awakens') && CHAPTER_CHALLENGES[step.chapterId]) {
            this.tryOpenChapterChallenge(step.chapterId);
          }
        }
      },
      enterYinXu: () => {
        this.storyWorldEntered = true;
        // 重新进入殷墟时恢复上次存档坐标，让玩家接着原有位置继续，而不是每次都回到城门口原点。
        // 全新游戏尚无有效存档坐标时，restoreSavedRegionPosition 会自然落到 City 入口原点，行为不变。
        this.restoreSavedRegionPosition();
        this.updateBgmForRegion(this.regionTransitionManager.currentRegionId);
        this.audioManager.setHallMuted(false);
        this.beginChapterOneIfNeeded();
      },
    });
    this.initializeStoryInfrastructure();
    const previewSearch = (globalThis as { location?: { search?: string } }).location?.search ?? '';
    if (sys.isBrowser && /(?:^|[?&])oracleQa=1(?:&|$)/.test(previewSearch)) {
      this.scheduleOnce(() => this.openOracleQaPreview(), .65);
    }
    this.enabled = true;
  }

  onDestroy() {
    this.flushCitySave();
    game.off(Game.EVENT_HIDE, this.onApplicationHide, this);
    this.storyDialogue?.destroy();
    this.chapterBanner?.destroy();
    this.questGuide?.destroy();
    this.storyTestButtons.forEach(b => b.destroy());
    this.storyTestButtons = [];
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    view.off('canvas-resize', this.refreshExcavationLearningMask, this);
    view.off('design-resolution-changed', this.refreshExcavationLearningMask, this);
  }

  update(dt: number) {
    this.elapsed += dt;
    this.updateCityGameplay(dt);
    const movementAllowed = this.overlay === 'none' && !this.seated && this.toolActionTimer <= 0
      && !this.learningHall?.isOpen && !this.regionInputLocked && !this.storyDialogue?.isOpen;
    const direction = movementAllowed
      ? (this.keyboard.lengthSqr() > 0 ? this.keyboard.clone() : this.stick.clone())
      : new Vec2();
    if (direction.lengthSqr() > 1) direction.normalize();

    const oldX = this.playerPos.x;
    const oldY = this.playerPos.y;
    this.blocked = false;
    if (direction.lengthSqr() > .001) {
      const dx = direction.x * this.moveSpeed * dt;
      const dy = direction.y * this.moveSpeed * dt;
      // Sweep movement in every map, not only the temple.  A slow browser
      // frame used to test only the final outside position, so a player could
      // jump through a house wall or other thin collider in one update.
      this.movePlayerWithCollision(dx, dy);
    }

    const movedDistance = Math.hypot(this.playerPos.x - oldX, this.playerPos.y - oldY);
    const moving = movedDistance > .01;
    this.checkpointPlayerPosition(dt, moving);
    this.updatePlayerFootsteps(movedDistance, movementAllowed);
    this.updateTerrainElevationState();
    if (moving) this.playerMotion.set((this.playerPos.x - oldX) / movedDistance, (this.playerPos.y - oldY) / movedDistance);
    else this.playerMotion.set(0, 0);
    this.player.setPosition(Math.round(this.playerPos.x), Math.round(this.playerPos.y), 80);
    this.animatePlayer(moving, direction, movedDistance);
    this.updateHeldToolVisual();
    const pauseAmbientActors = this.overlay === 'shop' || this.overlay === 'shopConfirm';
    if (!pauseAmbientActors && this.worldMode === 'outside') {
      this.updateVillagers(dt);
      this.updateHorseCarts(dt);
    }
    this.updateRegionExitMarkerAnimation();
    if (this.worldMode === 'outside') {
      this.updateRestingVillager();
      this.animateEnvironment();
    }
    this.updateTreeDepthOrdering();
    if (this.worldMode === 'templeInterior' && this.templeCollisionDebugGraphics) {
      this.redrawTempleInteriorCollisionDebug();
    }
    this.updateTorches(dt);
    this.updateWeather(dt);
    this.updateToolEffects(dt);
    this.statusNoticeTimer = Math.max(0, this.statusNoticeTimer - dt);
    this.regionTransitionManager?.update(dt);
    if (this.storyTestButtons.length) {
      const showTest = this.overlay === 'none'
        && !this.storyDialogue?.isOpen
        && !this.chapterBanner?.isOpen;
      this.storyTestButtons.forEach(b => { if (b.isValid) b.active = showTest; });
    }
    this.followCamera(dt);
    this.updateChapterOneStory();
    this.updateChapterTwoStory();
    this.updateChapterThreeStory();
    this.updateChapterFourStory();
    this.updateChapterFiveStory();
    this.updateChapterSixStory();
    this.updateChapterSevenStory();
    this.updateChapterEightStory();
    this.updateChapterNineStory();
    const visibleSize = view.getVisibleSize();
    this.questGuide?.update(dt, this.playerPos, visibleSize.width, visibleSize.height);
    this.updateHud();
  }

  /**
   * Phase-one compatibility: these bounds stay in the existing global world
   * coordinate system. Only CITY <-> HIGHLAND has live exits in this build.
   */
  private createRegionTransitionManager() {
    const { definitions, entries, exits } = createPhaseOneRegionConfig();
    const entriesById = new Map(entries.map(entry => [entry.id, entry]));
    Object.values(STORY_LOCATIONS).forEach(location => {
      const entry = entriesById.get(location.entryId);
      if (!entry || entry.regionId !== location.regionId) {
        console.error('[StoryLocation] region entry registry mismatch; scripted travel will be cancelled.', {
          storyLocationId: location.id,
          regionId: location.regionId,
          entryId: location.entryId,
          entry,
        });
      }
    });
    const savedRegion = this.save.currentRegionId;
    const savedDefinition = savedRegion ? definitions.find(definition => definition.id === savedRegion) : undefined;
    const savedRegionContainsPlayer = !!savedDefinition && this.inRegion(this.playerPos.x, this.playerPos.y, {
      left: savedDefinition.currentWorldBounds.minX, right: savedDefinition.currentWorldBounds.maxX,
      bottom: savedDefinition.currentWorldBounds.minY, top: savedDefinition.currentWorldBounds.maxY,
    });
    const inferredInitialRegion = definitions.find(definition => this.inRegion(this.playerPos.x, this.playerPos.y, {
      left: definition.currentWorldBounds.minX, right: definition.currentWorldBounds.maxX,
      bottom: definition.currentWorldBounds.minY, top: definition.currentWorldBounds.maxY,
    }))?.id;
    if (!inferredInitialRegion) {
      console.warn('[YinXuCity] player position is outside known region bounds; using the existing CITY safe spawn.');
      this.playerPos.set(0, 20);
      this.player.setPosition(0, 20, 80);
      this.cameraPos.set(0, 20);
    }
    const initialRegion = savedRegionContainsPlayer ? savedRegion! : (inferredInitialRegion ?? RegionId.CITY);
    this.regionTransitionManager = new RegionTransitionManager(this.node, definitions, entries, exits, initialRegion, {
      getPlayerFootPosition: () => this.playerPos,
      getPlayerFacing: () => this.facing,
      setPlayerPosition: position => {
        // 落点提交保险：黑屏是异步的（fadeOut 0.22s），期间玩家仍可能处于宗庙内殿
        // （节点挂在 templeInterior 下、world 隐藏、相机冻结）。此时直接写世界坐标
        // 会导致「画面停在上一章、小人消失」，故提交前强制归位到外部 world。
        this.restoreOutsideWorldForScriptedTravel();
        this.playerPos.set(position.x, position.y);
        this.player.setPosition(position.x, position.y, 80);
        this.updateTerrainElevationState(true);
      },
      setPlayerFacing: facing => {
        this.facing = facing;
        this.displayedPlayerFrame = -1;
        this.showPlayerFrame(this.getIdleFrameIndex(facing));
      },
      canPlayerStand: position => this.canPlayerStand(position.x, position.y),
      // Scripted RegionEntry spawns are authored static landing points. They
      // must not be rejected merely because an NPC, cart, or temple mode from
      // the source scene is currently active; normal player movement and
      // exit validation keep using the dynamic canPlayerStand callback above.
      canScriptedEntryStand: entry => this.canScriptedEntryStand(entry),
      getCameraPosition: () => this.cameraPos,
      setCameraPosition: position => {
        this.cameraPos.set(position.x, position.y);
        this.followCamera(0);
      },
      syncCameraImmediately: () => this.syncCameraImmediately(),
      setRegionUi: () => this.updateHud(),
      setInputLocked: locked => {
        this.regionInputLocked = locked;
        if (locked) this.stopPlayerInput();
      },
      getWorldNode: () => this.world,
      onRegionChanged: (regionId) => {
        this.updateBgmForRegion(regionId);
        this.updateOutskirtsVisibility();
        this.persistCitySave();
        // A route calculated before a scripted transfer belongs to the old
        // region. Re-presenting the current step refreshes its waypoints from
        // the committed landing point without replaying its dialogue.
        if (this.storyWorldEntered && this.storyController?.currentStep()) {
          this.presentStoryStep(this.storyController.currentStep());
        }
      },
    });
    this.updateTerrainElevationState(true);
  }

  private updateBgmForRegion(regionId: RegionId) {
    const wildRegions = new Set<RegionId>([
      RegionId.HIGHLAND,
      RegionId.FIELDS,
      RegionId.ROYAL_TOMB,
      RegionId.RIVERBANK,
    ]);
    this.audioManager.setBgmTrack(wildRegions.has(regionId) ? 'wild' : 'main');
  }

  private updateOutskirtsVisibility() {
    const r = this.regionTransitionManager?.currentRegionId;
    const show = r === RegionId.CITY || r === RegionId.OUTSKIRTS;
    if (this.outskirtsGroundNode) this.outskirtsGroundNode.active = show;
    if (this.outskirtsTileContainer) this.outskirtsTileContainer.active = show;
    if (this.outskirtsNatureRoot) this.outskirtsNatureRoot.active = show;
    this.outskirtsNatureEntityNodes.forEach(node => { if (node.isValid) node.active = show; });
    this.regionExitMarkerRoots.forEach((root, regionId) => {
      if (root.isValid) root.active = regionId === RegionId.OUTSKIRTS ? show : r === regionId;
    });
    this.updateFieldVisibility();
    if (r !== RegionId.OUTSKIRTS) this.outskirtsSouthAirwallProbeReported = false;
    if (r === RegionId.OUTSKIRTS && !this.outskirtsSouthAirwallProbeReported) {
      // The reported blank wall was the old temporary-strip right-bottom
      // boundary at this point. Keep an auditable runtime record of every
      // overlapping obstacle after the duplicate has been removed.
      this.scanCollisionProbe('OutskirtsSouthRoadRightBlankAirwall', 627, -944, this.playerRadius);
      this.outskirtsSouthAirwallProbeReported = true;
    }
  }

  private updateFieldVisibility() {
    const r = this.regionTransitionManager?.currentRegionId;
    const show = !r || r === RegionId.FIELDS;
    this.fieldVisualNodes.forEach(node => { if (node.isValid) node.active = show; });
    this.excavationSites.forEach(site => {
      // 第一章教学坑(trial)横跨城内南门广场与南门外可达荒地，始终按自身 active 状态可见，
      // 不参与 FIELDS 的区域显隐（城内/城外的 trial 坑都不受 FIELDS 摄像机显隐控制）。
      if (site.region === 'trial') { site.root.active = site.active || site.holeTimer > 0; return; }
      if (site.region === 'field' && site.root.isValid) site.root.active = show && (site.active || site.holeTimer > 0);
    });
  }

  /**
   * Creates every road-exit cue directly from the registered trigger geometry.
   * Each marker hugs the source-side trigger edge with only a 10px inset, so
   * it reads as the actual road exit without being clipped by the map edge.
   */
  private createRegionExitMarkers() {
    const { exits } = createPhaseOneRegionConfig();
    exits.forEach((exit, index) => this.createRegionExitMarker(exit, index));
  }

  private createRegionExitMarker(exit: RegionExit, index: number) {
    const marker = new Node(`RegionExitMarker-${exit.id}`);
    marker.parent = this.getRegionExitMarkerRoot(exit.sourceRegionId);
    const position = this.getRegionExitMarkerPosition(exit);
    marker.setPosition(position.x, position.y, 0);
    marker.addComponent(UITransform).setContentSize(64, 48);

    const aura = new Node('Aura');
    aura.parent = marker;
    aura.addComponent(UITransform).setContentSize(64, 48);
    const auraGraphics = aura.addComponent(Graphics);
    auraGraphics.fillColor = new Color(123, 216, 255, 76);
    auraGraphics.ellipse(0, 0, 32, 24);
    auraGraphics.fill();
    const auraOpacity = aura.addComponent(UIOpacity);

    const bloom = new Node('Bloom');
    bloom.parent = marker;
    bloom.addComponent(UITransform).setContentSize(50, 38);
    const bloomGraphics = bloom.addComponent(Graphics);
    bloomGraphics.fillColor = new Color(157, 229, 255, 142);
    bloomGraphics.ellipse(0, 0, 25, 19);
    bloomGraphics.fill();
    const bloomOpacity = bloom.addComponent(UIOpacity);

    const core = new Node('Core');
    core.parent = marker;
    core.addComponent(UITransform).setContentSize(36, 27);
    const coreGraphics = core.addComponent(Graphics);
    coreGraphics.fillColor = new Color(224, 250, 255, 224);
    coreGraphics.ellipse(0, 0, 18, 13.5);
    coreGraphics.fill();
    const coreOpacity = core.addComponent(UIOpacity);

    this.regionExitMarkerAnimations.push({
      aura,
      auraOpacity,
      core,
      coreOpacity,
      bloom,
      bloomOpacity,
      phase: index * 0.73,
    });
  }

  private getRegionExitMarkerRoot(regionId: RegionId) {
    const existing = this.regionExitMarkerRoots.get(regionId);
    if (existing?.isValid) return existing;
    const root = new Node(`RegionExitMarkers-${regionId}`);
    root.parent = this.world;
    // Ground tiles use depths up to the low sixties; actors start at 80.
    root.setPosition(0, 0, 68);
    root.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);
    this.regionExitMarkerRoots.set(regionId, root);
    return root;
  }

  private getRegionExitMarkerPosition(exit: RegionExit) {
    const { minX, maxX, minY, maxY } = exit.triggerBounds;
    const position = new Vec2((minX + maxX) / 2, (minY + maxY) / 2);
    const sourceSideInset = 10;
    if (exit.travelDirection === 'up') position.y = maxY - sourceSideInset;
    else if (exit.travelDirection === 'down') position.y = minY + sourceSideInset;
    else if (exit.travelDirection === 'left') position.x = minX + sourceSideInset;
    else position.x = maxX - sourceSideInset;
    return position;
  }

  private updateRegionExitMarkerAnimation() {
    this.regionExitMarkerAnimations.forEach(marker => {
      if (!marker.aura.activeInHierarchy) return;
      const pulse = (Math.sin(this.elapsed * 1.45 + marker.phase) + 1) * .5;
      marker.aura.setScale(.98 + pulse * .08, .98 + pulse * .08, 1);
      marker.bloom.setScale(.985 + pulse * .045, .985 + pulse * .045, 1);
      marker.core.setScale(.99 + pulse * .025, .99 + pulse * .025, 1);
      marker.auraOpacity.opacity = Math.round(150 + pulse * 60);
      marker.bloomOpacity.opacity = Math.round(175 + pulse * 55);
      marker.coreOpacity.opacity = Math.round(205 + pulse * 40);
    });
  }

  private initializeStoryInfrastructure() {
    // 章节完成门槛（requiredCardIds）= 本章全部主线字（引导字 + 自由探索字）。
    // 玩家必须把本章所有字都学会后，才能进入宗庙占卜、推进到下一章。
    // 自由字通过 prepareChapterFreeExploration 开放的可挖坑学习，finishExcavationLearning
    // 会调用 storyController.markCardLearned 写 learned-card flag，避免学不到而卡章。
    const availableIds = new Set(this.oracleCards.map(card => card.id));
    const storyChaptersWithRequirements = STORY_CHAPTER_DEFINITIONS.map(chapter => ({
      ...chapter,
      requiredCardIds: allStoryMainCardIds(chapter.id).filter(id => availableIds.has(id)),
    }));
    this.storyController = new StoryController(storyChaptersWithRequirements, this.save.story, story => {
      this.save.story = story;
      this.persistCitySave();
    });
    this.storyDialogue = new DialoguePanel(this.node);
    this.chapterBanner = new ChapterBanner(this.node);
    this.questGuide = new QuestGuide(this.world, this.node);
    this.createChapterOneNpc();
    this.createChapterTwoNpc();
    this.createChapterThreeNpc();
    this.createChapterFourNpc();
    this.createChapterFiveNpc();
    this.createChapterSixNpc();
    this.createChapterSevenNpc();
    this.createChapterEightNpc();
    this.createChapterNineNpc();
    this.createStoryTestButtons();
    this.storyController.subscribe((_snapshot, step) => this.presentStoryStep(step));
  }

  private beginChapterOneIfNeeded() {
    const snapshot = this.storyController.snapshot();
    if (snapshot.currentChapterId) {
      this.presentStoryStep(this.storyController.currentStep());
      return;
    }
    // 找到第一个未完成的章节，先把它传送落到该章落点，再开章。
    // 顺序很关键：goToStoryLocation（先传送）先发生；即便随后的开场对话展示异常，
    // 小人也已经可靠落到下一章落点，绝不会停在上一章、人错位丢失。
    const nextChapterId = STORY_CHAPTER_IDS.find(id => !snapshot.completedChapterIds.includes(id));
    if (!nextChapterId) {
      this.presentStoryStep(this.storyController.currentStep());
      return;
    }
    const chapterNumber = (STORY_CHAPTER_IDS.indexOf(nextChapterId) + 1) as StoryTestChapter;
    const start = STORY_TEST_STARTS[chapterNumber];
    if (start) {
      this.goToStoryLocation(start.storyLocationId);
    }
    this.storyController.startChapter(nextChapterId);
  }

  // 是否还有未开始的章节（用于章末自动衔接，避免空 step 时无限递归）
  private hasUnstartedStoryChapter(): boolean {
    if (!this.storyController) return false;
    const completed = new Set(this.storyController.snapshot().completedChapterIds);
    return STORY_CHAPTER_IDS.some(chapterId => !completed.has(chapterId));
  }

  /**
   * 章完成后兜底推进下一章：不依赖 presentStoryStep(null) 监听器的调用时序。
   * 在「对话完成 / 占卜完成」两条章末路径的 handle 之后显式调用——
   * 若监听器路径已正常接章（currentChapterId 已是下一章），此处 early-return 不重复；
   * 若监听器路径因任何原因未触发接章（currentChapterId 仍为空、但有未开始章），则此处补上，
   * 保证小人一定被传送到下一章落点，绝不停留在上一章。
   */
  private advanceToNextChapterIfNeeded() {
    if (!this.storyWorldEntered) return;
    const snapshot = this.storyController?.snapshot();
    if (!snapshot) return;
    if (snapshot.currentChapterId) return; // 仍有进行中章节，不抢跑
    if (!this.hasUnstartedStoryChapter()) return;
    console.log('[Story] advanceToNextChapterIfNeeded: 本章已完成，自动衔接下一章。');
    this.beginChapterOneIfNeeded();
  }

  /**
   * 脚本化传送（章末自动接章 / 测试传送）提交落点前，必须先把玩家从「宗庙内殿」
   * 这类非外部世界模式强制归位到 world。内殿模式下：
   *   - `player.parent` 是 templeInterior、`world.active === false`；
   *   - `followCamera` 首行遇 templeInterior 直接 return（相机被冻结）。
   * 若不归位就写入下一章的世界坐标，画面会停在上一章的内殿、小人被甩出可见范围
   * 而「消失」——这正是章末接章脱节的第四层成因（前三层是 region 状态机层）。
   * 幂等：已在外部世界时直接返回，正常路径零开销。
   */
  private restoreOutsideWorldForScriptedTravel() {
    const alreadyOutside = this.worldMode === 'outside'
      && (!this.player?.isValid || this.player.parent === this.world);
    if (alreadyOutside) return;
    // 占卜席状态一并清除，避免归位后仍被判定「坐着」而锁住移动与出殿。
    this.seated = false;
    this.templePreSitPosition = null;
    this.templeLastRisePosition = null;
    // restorePlayerAfterStoryTestTravel 会顺手解开 regionInputLocked；若本次归位发生在
    // 黑屏切换途中（setPlayerPosition 保险路径），提前解锁会让玩家在黑屏里乱走并偏离落点，
    // 故保存并还原输入锁，交回状态机在 FADING_IN 结束时统一解锁。
    const inputLocked = this.regionInputLocked;
    this.restorePlayerAfterStoryTestTravel();
    this.regionInputLocked = inputLocked;
    // 引导箭头在进殿时被挂到内殿节点下，必须切回外部 world，否则新章指引不可见。
    this.questGuide?.setWorldNode(this.world);
  }

  // 把玩家传送到指定世界坐标（同步位置/相机/可视节点），用于章节间切换时直接落在 NPC 旁
  private goToStoryLocation(locationId: string) {
    const location = storyLocation(locationId);
    if (!location || !this.regionTransitionManager) {
      console.error('[StoryLocation] registered location is unavailable; scripted travel cancelled.', { locationId });
      return false;
    }
    // 章末接章时玩家通常正站在宗庙内殿（刚占卜完起身），必须归位到外部 world 才能落点。
    // 但归位**不能**在这里做：此刻黑屏遮罩尚未盖上（transitionToEntry 之后才进入 FADING_OUT），
    // 立刻退殿会让画面从内殿硬切到城中心（进殿时 playerPos 被置为内殿局部坐标 0,-265）再变黑，
    // 观感正是「视觉还停在上一章位置」。归位统一交给 setPlayerPosition 回调完成——
    // 那是所有落点提交的唯一出口（黑屏切换 / 即时兜底传送 / 快照恢复都经由它），
    // 且执行时画面已全黑，切换干净无闪帧。
    // 落点校验 canScriptedEntryStand 只做纯几何边界判断、不受内殿模式影响，故推迟归位不影响校验。
    const started = this.regionTransitionManager.transitionToEntry(location.entryId);
    if (started) {
      this.save.storyLocationId = location.id;
      this.audioManager.playSfx('map_transition');
      return true;
    }
    // 兜底：黑屏状态机被占用（非 IDLE/COOLDOWN）或校验未启动，改用同步直接传送，
    // 保证小人可靠落到目标着陆点、视觉立即跟随，绝不出现「界面停在上一章、人消失」。
    console.warn('[StoryLocation] blackout transition unavailable; immediate teleport fallback.', locationId);
    const ok = this.regionTransitionManager.teleportToEntryImmediate(location.entryId);
    if (ok) {
      this.save.storyLocationId = location.id;
      this.audioManager.playSfx('map_transition');
    } else {
      console.error('[StoryLocation] entry validation failed; no fallback available.', { locationId, entryId: location.entryId });
    }
    return ok;
  }

  /** 玩家实际坐标是否落在指定区域边界内（不依赖可能滞后的 currentRegionId）。 */
  private playerInRegionBounds(regionId: RegionId): boolean {
    const boundsByRegion: Partial<Record<RegionId, { left: number; right: number; bottom: number; top: number }>> = {
      [RegionId.HIGHLAND]: this.forestRegion,
      [RegionId.FIELDS]: this.fieldRegion,
      [RegionId.RIVERBANK]: this.riverRegion,
      [RegionId.ROYAL_TOMB]: this.tombRegion,
    };
    const bounds = boundsByRegion[regionId];
    if (!bounds) return false;
    return this.inRegion(this.playerPos.x, this.playerPos.y, bounds);
  }

  /** 给定任意地图坐标，反查它落在哪个大区（用于判断挖字碎甲实际所在区域，决定跨区引导）。 */
  private regionAtPoint(x: number, y: number): RegionId | null {
    const boundsByRegion: Partial<Record<RegionId, { left: number; right: number; bottom: number; top: number }>> = {
      [RegionId.HIGHLAND]: this.forestRegion,
      [RegionId.FIELDS]: this.fieldRegion,
      [RegionId.RIVERBANK]: this.riverRegion,
      [RegionId.ROYAL_TOMB]: this.tombRegion,
    };
    for (const key of Object.keys(boundsByRegion) as RegionId[]) {
      const bounds = boundsByRegion[key];
      if (bounds && this.inRegion(x, y, bounds)) return key;
    }
    return null;
  }

  /** 坑坐标离玩家极近（一眼可见、无需过图）时视为"已在目标"，直接指坑不跨区引导。 */
  private isDigSiteNearby(objective: StoryObjective): boolean {
    if (objective.targetX === undefined || objective.targetY === undefined) return false;
    const dx = objective.targetX - this.playerPos.x;
    const dy = objective.targetY - this.playerPos.y;
    const NEAR_DIG_SITE = 1600;
    return dx * dx + dy * dy < NEAR_DIG_SITE * NEAR_DIG_SITE;
  }

  /**
   * 统一的挖字 / 寻迹区域引导（宝宝 0731 拍板：同区域内直指坑，跨区先指传送标识、一步一步引导）。
   * - 优先用 objective.targetRegion（挖字坑自带 mapRegion，最可靠），兜底用坐标反查 regionAtPoint。
   * - 目标与玩家同区：return false → 由 buildQuestNavigationPath 走可通行路精确直指坑。
   * - 目标跨区：return true → 箭头改为指向「通往目标区域的下一个传送标识」（QuestGuide 画直线箭头），
   *   玩家进入该区域后，下一帧 currentRegionId 更新，自动重新判定：同区则直指坑、否则继续指下一段传送点。
   *   这样无论几步跨区（如 CITY→OUTSKIRTS→FIELDS），都逐级引导，绝不横跳、绝不死路。
   * - CITY 起点特殊处理：CITY 与 OUTSKIRTS 是连续地面过渡、没有 blackout 出口，故先指向南城门让玩家出城，
   *   出城进入 OUTSKIRTS 后由通用逻辑接管下一步传送点。
   */
  private routeNarrativeExcavationToMapExit(_chapterId: string, objective: StoryObjective, _kind: 'dig' | 'narrative' = 'narrative') {
    const manager = this.regionTransitionManager;
    if (!manager || objective.targetX === undefined || objective.targetY === undefined) return false;
    const pitRegion = objective.targetRegion ?? this.regionAtPoint(objective.targetX, objective.targetY);
    if (!pitRegion) return false; // 无法判定区域，退化直指坑坐标（由 BFS 处理）

    // 关键：用玩家实际坐标反查区域，避免 regionTransitionManager 状态机在 wilderness
    // 区域（洹水河畔/山林高地/王陵/郊外田野）与玩家真实位置不同步时，把同区误判成跨区。
    // 只要玩家实际站在目标坑所属区域内，箭头就必须直指该坑，绝不改指向传送标识。
    const playerRegionByPosition = this.regionAtPoint(this.playerPos.x, this.playerPos.y);
    if (playerRegionByPosition && playerRegionByPosition === pitRegion) return false;

    // 目标坑已在附近（一眼可见、无需过图）：直接直指坑，避免 region 状态机与玩家实际位置
    // 短暂不同步时，箭头被错误拉向跨区传送点。
    if (this.isDigSiteNearby(objective)) return false;
    const current = manager.currentRegionId;
    if (pitRegion === current) return false; // 同区直指坑

    // 跨区：先指往目标区域的下一步传送标识。
    if (current === RegionId.CITY) {
      // CITY 与 OUTSKIRTS 连续过渡、无 blackout 出口：先引玩家出南城门进入 OUTSKIRTS，
      // 之后若在 OUTSKIRTS 仍与目标区不同，由下方 getExitToward 接管指下一步传送点。
      objective.targetX = 0;
      objective.targetY = -300;
      objective.title = '前往城外';
      objective.detail = '沿金色箭头穿过南城门；到达城外后，箭头会指引你前往本章调查区。';
      return true;
    }
    const exit = manager.getExitToward(pitRegion);
    if (!exit) return false;
    objective.targetX = (exit.triggerBounds.minX + exit.triggerBounds.maxX) / 2;
    objective.targetY = (exit.triggerBounds.minY + exit.triggerBounds.maxY) / 2;
    objective.title = '前往目标区域';
    objective.detail = '沿金色箭头走到区域边缘的传送标识；进入目标区域后，箭头会精确指向待挖的碎甲。';
    return true;
  }

  private restoreSavedRegionPosition() {
    const position = this.save.playerWorldPosition;
    const hasValidPosition = !!position && Number.isFinite(position.x) && Number.isFinite(position.y);
    const fallbackLocation = storyLocation(this.save.storyLocationId);
    if (!hasValidPosition && !fallbackLocation) return;
    const x = hasValidPosition ? position!.x : fallbackLocation!.localPosition.x;
    const y = hasValidPosition ? position!.y : fallbackLocation!.localPosition.y;
    this.playerPos.set(x, y);
    this.cameraPos.set(x, y);
    if (this.save.playerFacing) this.facing = this.save.playerFacing;
  }

  /**
   * 章节传送只能落在可行走陆地。即使后续调整剧情坐标时误落到水面或障碍上，
   * 也会自动在附近寻找安全落点，避免玩家被困。
   */
  private resolveSafePlayerSpawn(x: number, y: number) {
    if (this.canPlayerStand(x, y)) return new Vec2(x, y);
    for (let radius = 72; radius <= 720; radius += 48) {
      for (let index = 0; index < 16; index++) {
        const angle = index / 16 * Math.PI * 2;
        const candidateX = Math.round(x + Math.cos(angle) * radius);
        const candidateY = Math.round(y + Math.sin(angle) * radius);
        if (this.canPlayerStand(candidateX, candidateY)) return new Vec2(candidateX, candidateY);
      }
    }
    console.warn('[YinXuCity] no safe spawn found; using requested story coordinate', x, y);
    return new Vec2(x, y);
  }

  /**
   * A save made while an older river layout was active can point into the new
   * water artwork. Move it to the nearest legal bank before input starts,
   * rather than leaving the player stranded in (or able to explore) water.
   */
  private relocatePlayerOutOfRiverWater() {
    if (this.worldMode !== 'outside' || !this.pointInWater(this.playerPos.x, this.playerPos.y, this.playerRadius)) return;
    const safe = this.resolveSafePlayerSpawn(this.playerPos.x, this.playerPos.y);
    this.playerPos.set(safe.x, safe.y);
    this.cameraPos.set(safe.x, safe.y);
    if (this.player?.isValid) this.player.setPosition(safe.x, safe.y, 80);
    this.save.playerWorldPosition = { x: safe.x, y: safe.y };
    console.info('[YinXuCity] relocated saved player from river water', { x: safe.x, y: safe.y });
  }

  private presentStoryStep(step: StoryStepDefinition | null) {
    if (!this.storyWorldEntered) {
      this.questGuide.setObjective(null);
      this.questGuide.setChapterProgress('');
      if (this.storyNpc?.isValid) this.storyNpc.active = false;
      return;
    }
    // Only the small guided set is part of the mandatory story route.  The
    // remaining chapter characters stay in the exploration pool, so a long
    // chapter never turns into dozens of identical forced excavations.
    if (this.advanceOptionalFragmentStep(step)) return;
    let objective = step?.objective ? { ...step.objective } : null;
    const configuredLocation = storyLocation(objective?.storyLocationId);
    if (configuredLocation && objective) {
      objective.targetX = configuredLocation.localPosition.x;
      objective.targetY = configuredLocation.localPosition.y;
    }
    const isChapterTwoFragment = CHAPTER_TWO_FRAGMENT_CARDS.some(item =>
      item.seekStepId === step?.id || item.lessonStepId === step?.id);
    const isChapterThreeFragment = CHAPTER_THREE_FRAGMENT_CARDS.some(item =>
      item.seekStepId === step?.id || item.lessonStepId === step?.id);
    const isChapterFourFragment = CHAPTER_FOUR_FRAGMENT_CARDS.some(item =>
      item.seekStepId === step?.id || item.lessonStepId === step?.id);
    const isChapterFiveFragment = CHAPTER_FIVE_FRAGMENT_CARDS.some(item =>
      item.seekStepId === step?.id || item.lessonStepId === step?.id);
    const isChapterSixFragment = CHAPTER_SIX_FRAGMENT_CARDS.some(item =>
      item.seekStepId === step?.id || item.lessonStepId === step?.id);
    const isChapterSevenFragment = CHAPTER_SEVEN_FRAGMENT_CARDS.some(item =>
      item.seekStepId === step?.id || item.lessonStepId === step?.id);
    const isChapterEightFragment = CHAPTER_EIGHT_FRAGMENT_CARDS.some(item =>
      item.seekStepId === step?.id || item.lessonStepId === step?.id);
    const isChapterNineFragment = CHAPTER_NINE_FRAGMENT_CARDS.some(item =>
      item.seekStepId === step?.id || item.lessonStepId === step?.id);
    const isChapterOneFragment = CHAPTER_ONE_FRAGMENT_CARDS.some(item =>
      item.seekStepId === step?.id || item.lessonStepId === step?.id);
    let site: ExcavationSite | null = null;
    if (isChapterOneFragment || isChapterTwoFragment || isChapterThreeFragment || isChapterFourFragment
      || isChapterFiveFragment || isChapterSixFragment || isChapterSevenFragment
      || isChapterEightFragment || isChapterNineFragment) {
      const chapterReserve = [
        { match: isChapterOneFragment, cards: CHAPTER_ONE_FRAGMENT_CARDS, id: CHAPTER_ONE_ID },
        { match: isChapterTwoFragment, cards: CHAPTER_TWO_FRAGMENT_CARDS, id: CHAPTER_TWO_ID },
        { match: isChapterThreeFragment, cards: CHAPTER_THREE_FRAGMENT_CARDS, id: CHAPTER_THREE_ID },
        { match: isChapterFourFragment, cards: CHAPTER_FOUR_FRAGMENT_CARDS, id: CHAPTER_FOUR_ID },
        { match: isChapterFiveFragment, cards: CHAPTER_FIVE_FRAGMENT_CARDS, id: CHAPTER_FIVE_ID },
        { match: isChapterSixFragment, cards: CHAPTER_SIX_FRAGMENT_CARDS, id: CHAPTER_SIX_ID },
        { match: isChapterSevenFragment, cards: CHAPTER_SEVEN_FRAGMENT_CARDS, id: CHAPTER_SEVEN_ID },
        { match: isChapterEightFragment, cards: CHAPTER_EIGHT_FRAGMENT_CARDS, id: CHAPTER_EIGHT_ID },
        { match: isChapterNineFragment, cards: CHAPTER_NINE_FRAGMENT_CARDS, id: CHAPTER_NINE_ID },
      ].find(entry => entry.match);
      site = chapterReserve
        ? this.reserveStoryExcavationSite(chapterReserve.cards, chapterReserve.id)
        : null;
      if (site && objective) {
        objective.targetX = site.x;
        objective.targetY = site.y;
        objective.targetRegion = site.mapRegion;
      }
    }
    let routingToMapExit = false;
    if (step && objective && this.isNarrativeExcavationStep(step.id)) {
      const isFragment = isChapterOneFragment || isChapterTwoFragment || isChapterThreeFragment
        || isChapterFourFragment || isChapterFiveFragment || isChapterSixFragment
        || isChapterSevenFragment || isChapterEightFragment || isChapterNineFragment;
      const hint = this.narrativeExcavationHint(step.chapterId);
      const kind: 'dig' | 'narrative' = isFragment ? 'dig' : 'narrative';
      // 挖字步骤由上面的 reserve 已锁定坑坐标：跨区时只覆盖为传送标识、
      // 保留任务标题，不覆盖成“·寻迹”文案；寻迹步骤按原提示展示。
      if (!isFragment) {
        objective.title = `${hint.title} · 寻迹`;
        objective.detail = hint.detail;
      }
      routingToMapExit = this.routeNarrativeExcavationToMapExit(step.chapterId, objective, kind);
    }
    // 宗庙内部 world 被隐藏，引导箭头节点已切到 templeInterior；改用内部坐标指向占卜席，覆盖外部 storyLocation 坐标。
    if (this.worldMode === 'templeInterior' && objective) {
      objective.targetX = 0;
      objective.targetY = -24;
    }
    // 最终目标（金色光环）永远锁在目标坑/占卜席上；箭头目标 objective.target 由 routeNarrative 决定：
    // 同区=坑，跨区=下一出口。这样过图后重跑 presentStoryStep 会自动切回同区指坑，绝不横跳。
    const ultimateTarget = site
      ? new Vec2(site.x, site.y)
      : (this.worldMode === 'templeInterior' && objective)
        ? new Vec2(0, -24)
        : (objective && objective.targetX !== undefined && objective.targetY !== undefined
          ? new Vec2(objective.targetX, objective.targetY)
          : null);
    this.questGuide.setObjective(objective, ultimateTarget ?? undefined);
    this.questGuide.setChapterProgress(this.chapterRequirementText(step?.chapterId));
    if (objective?.targetX !== undefined && objective.targetY !== undefined) {
      // 箭头直接指向当前航点（同区=坑，跨区=出口），像导游一样一段一段带路。
      // BFS 路径暂时不用，避免复杂地形把箭头拐向与目标坑相反的方向。
      this.questGuide.setNavigationPath([]);
    }
    // 轻量引导飘字：挖字进度提示 + 占卜提示（按 step 去重，避免跨区/重绘反复刷）。
    if (step && step.id !== this.lastGuidanceStepId) {
      this.lastGuidanceStepId = step.id;
      const chId = this.storyController.snapshot().currentChapterId;
      if (step.completeOn === 'divination-completed') {
        this.showStatusNotice('卜力已苏醒——在占卜席上挑选合适的甲骨，为求问的旅人占卜。', 4.8);
      } else if (step.completeOn === 'temple-entered') {
        this.showStatusNotice('循金色箭头前往宗庙内殿，为求问的旅人占卜。', 4.8);
        // 自动进殿前，若本章字未集齐则不要强送进殿；等玩家补齐后再由 enterTempleInterior 门控处理。
        const main = this.chapterMainProgress(step.chapterId);
        if (main.total > 0 && main.learned < main.total) {
          const missing = main.total - main.learned;
          this.showStatusNotice(`本章甲骨尚未集齐。请先循金色箭头继续挖掘，收集并学会剩余 ${missing} 枚甲骨后再回宗庙占卜。`, 5);
        } else if (this.worldMode === 'outside' && this.templeInterior?.isValid
          && this.overlay === 'none') {
          // 治本：玩家从城外回宗庙占卜时，直接送入内殿并登记“入殿”，
          // 避免被城墙/南门卡住、永远到不了宗庙祭台而卡死章节。
          // enterTempleInterior 内部会先 handle('temple-entered') 再回调 presentStoryStep，
          // 届时 currentStep 已变为 take-divination-seat，不会二次递归进殿。
          // 注意：这里**不要**用 regionInputLocked 拦截黑屏切换途中的自动进殿。
          // 一是外层有 lastGuidanceStepId 去重（每个 step 只进一次），一旦此处被拦下，
          // 该步骤将永久不再触发自动进殿，直接复活「卡在 enter-temple」的老 bug；
          // 二是玩家从挖字区走边界出口回城时，onRegionChanged 正是在黑屏中重放本步骤，
          // 此刻进殿反而是期望行为——淡入时人已在殿内，衔接自然。
          // 接章路径不受影响：各章首步都是「去找 NPC」，completeOn 不是 temple-entered。
          this.enterTempleInterior();
        }
      } else if (chId) {
        const isSeek = this.allStoryFragmentCards.some(item => item.seekStepId === step.id);
        if (isSeek) {
          const guided = this.chapterGuidedProgress(chId);
          const remaining = guided.total - guided.collected;
          if (remaining > 0) {
            this.showStatusNotice(`循金色箭头，挖掘本章下一枚碎甲（已挖 ${guided.collected}/${guided.total}，还有 ${remaining} 枚待寻）。`, 3.8);
          } else {
            this.showStatusNotice('这是本章最后一枚主线碎甲，挖出后甲骨卜力将重新苏醒。', 3.8);
          }
        }
      }
    }
    const xiaoShitouVisible = step?.id === 'chapter-1-meet-xiaoshitou'
      || step?.id === 'chapter-1-xiaoshitou-dialogue';
    const fisherVisible = this.storyController.snapshot().currentChapterId === CHAPTER_TWO_ID;
    const xiaZhiVisible = this.storyController.snapshot().currentChapterId === CHAPTER_THREE_ID;
    const aLanVisible = this.storyController.snapshot().currentChapterId === CHAPTER_FOUR_ID;
    const aGuiVisible = this.storyController.snapshot().currentChapterId === CHAPTER_FIVE_ID;
    const aZhuVisible = this.storyController.snapshot().currentChapterId === CHAPTER_SIX_ID;
    const aJianVisible = this.storyController.snapshot().currentChapterId === CHAPTER_SEVEN_ID;
    const aLingVisible = this.storyController.snapshot().currentChapterId === CHAPTER_EIGHT_ID;
    const aGui2Visible = this.storyController.snapshot().currentChapterId === CHAPTER_NINE_ID;
    if (this.storyNpc?.isValid) this.storyNpc.active = xiaoShitouVisible;
    if (this.storyNpcTwo?.isValid) this.storyNpcTwo.active = fisherVisible;
    if (this.storyNpcThree?.isValid) this.storyNpcThree.active = xiaZhiVisible;
    if (this.storyNpcFour?.isValid) this.storyNpcFour.active = aLanVisible;
    if (this.storyNpcFive?.isValid) this.storyNpcFive.active = aGuiVisible;
    if (this.storyNpcSix?.isValid) this.storyNpcSix.active = aZhuVisible;
    if (this.storyNpcSeven?.isValid) this.storyNpcSeven.active = aJianVisible;
    if (this.storyNpcEight?.isValid) this.storyNpcEight.active = aLingVisible;
    if (this.storyNpcNine?.isValid) this.storyNpcNine.active = aGui2Visible;
    this.storyArrivalLocked = false;

    if (!step) {
      this.questGuide.setChapterProgress('');
      // 章节完成、当前无进行中步骤：自动衔接下一章，无需退出重进殷墟。
      if (this.storyWorldEntered && this.hasUnstartedStoryChapter()) {
        this.beginChapterOneIfNeeded();
      }
      return;
    }
    if (!step.dialogue || this.presentedStoryStepId === step.id) return;
    this.presentedStoryStepId = step.id;
    const presentationToken = ++this.storyPresentationToken;
    const isPrologueOpening = step.id === 'prologue-silent-heaven';
    const isChapterOneOpening = step.id === 'chapter-1-opening';
    const isChapterTwoOpening = step.id === 'chapter-2-opening';
    const isChapterThreeOpening = step.id === 'chapter-3-opening';
    const isChapterFourOpening = step.id === 'chapter-4-opening';
    const isChapterFiveOpening = step.id === 'chapter-5-escort-home-opening';
    const isChapterSixOpening = step.id === 'chapter-6-ruins-lamp-opening';
    const isChapterSevenOpening = step.id === 'chapter-7-wrong-scroll-opening';
    const isChapterEightOpening = step.id === 'chapter-8-tomb-three-proofs-opening';
    const isChapterNineOpening = step.id === 'chapter-9-renew-covenant-opening';
    const hasOpeningBanner = isPrologueOpening || isChapterOneOpening || isChapterTwoOpening || isChapterThreeOpening || isChapterFourOpening
      || isChapterFiveOpening || isChapterSixOpening || isChapterSevenOpening || isChapterEightOpening || isChapterNineOpening;
    if (isPrologueOpening) {
      this.chapterBanner.show(
        '序章',
        '天道失语',
        '通天灵龟甲崩碎，天地、人神与先祖之间的声音一夜断绝。',
        'prologue',
      );
    } else if (isChapterOneOpening) {
      this.chapterBanner.show(
        '第一章',
        '失语的甲骨',
        '当所有龟甲失去兆纹，只有散落荒野的碎骨仍在低语。',
        'chapter',
      );
    } else if (isChapterTwoOpening) {
      this.chapterBanner.show(
        '第二章',
        '河畔初兆',
        '循着水声，你来到西侧河畔的渔村，计数卜骨的碎甲正等待重新开口。',
        'chapter',
      );
    } else if (isChapterThreeOpening) {
      this.chapterBanner.show(
        '第三章',
        '逆流寻踪',
        '循逆水裂纹深入上游峡谷，守峡人阿沚与失语的上游水文碎甲正在等待。',
        'chapter',
      );
    } else if (isChapterFourOpening) {
      this.chapterBanner.show(
        '第四章',
        '山林迷径',
        '循裂纹越过河水踏入幽林，守林人阿岚与失语的山林路径碎甲正在等待。',
        'chapter',
      );
    } else if (isChapterFiveOpening) {
      this.chapterBanner.show(
        '第五章',
        '护送归途',
        '循裂纹越过林线踏入山外护送道，归人·阿归与失语的行旅护送碎甲正在等待。',
        'chapter',
      );
    } else if (isChapterSixOpening) {
      this.chapterBanner.show(
        '第六章',
        '古墟残灯',
        '循兆纹拐进荒废宗庙，灯匠·阿烛与失语的废墟点灯碎甲正在等待。',
        'chapter',
      );
    } else if (isChapterSevenOpening) {
      this.chapterBanner.show(
        '第七章',
        '错册余火',
        '循裂纹深入将焚典册之库，守册·阿简与失语的文献辨伪碎甲正在等待。',
        'chapter',
      );
    } else if (isChapterEightOpening) {
      this.chapterBanner.show(
        '第八章',
        '王陵三证',
        '循裂纹直抵城外王陵，守陵·阿陵与失语的王陵三证碎甲正在等待。',
        'chapter',
      );
    } else if (isChapterNineOpening) {
      this.chapterBanner.show(
        '第九章',
        '重续通天之契',
        '循裂纹登上通天之阶，大卜·阿圭与失语的重续通天碎甲正在等待。',
        'chapter',
      );
    }
    this.scheduleOnce(() => {
      if (presentationToken !== this.storyPresentationToken
        || this.storyController.currentStep()?.id !== step.id) return;
      const openDialogue = () => {
        if (presentationToken !== this.storyPresentationToken
          || this.storyController.currentStep()?.id !== step.id) return;
        this.audioManager.playSfx('dialog_open');
        this.storyDialogue.open(
          this.withSceneAtmosphere(step, step.dialogue ?? []),
          () => this.completeStoryDialogue(step),
          isPrologueOpening,
        );
      };
      if (isPrologueOpening) {
        // Cross-fade both dark layers so the cinematic never flashes back to
        // the bright game world between the title and the first narration.
        openDialogue();
        this.chapterBanner.close();
      } else {
        this.chapterBanner.close(openDialogue);
      }
    }, hasOpeningBanner ? 2.8 : .08);
  }

  private advanceOptionalFragmentStep(step: StoryStepDefinition | null) {
    if (!step || !this.storyController) return false;
    const fragment = this.allStoryFragmentCards.find(item =>
      item.seekStepId === step.id || item.lessonStepId === step.id);
    if (!fragment || (fragment.cardId && GUIDED_STORY_CARD_IDS.has(fragment.cardId))) return false;

    if (step.completeOn === 'excavation-completed') {
      return this.storyController.handle({
        type: 'excavation-completed', cardId: fragment.cardId ?? undefined,
      });
    }
    if (step.completeOn === 'learning-completed') {
      // This only bypasses the obsolete linear story checkpoint.  It does not
      // mark the card as learned; players still collect and study it normally
      // from the chapter's free exploration pits.
      return this.storyController.handle({
        type: 'learning-completed', cardId: fragment.cardId ?? undefined, correct: false,
      });
    }
    return false;
  }

  /** Keep excavation targets mysterious: the player follows an in-world clue, not a character name. */
  private isNarrativeExcavationStep(stepId: string) {
    return stepId.includes('seek-') || stepId.includes('seek-first-fragment')
      || stepId.includes('seek-field-fragment') || stepId.includes('seek-water-fragment')
      || stepId.includes('seek-earth-fragment') || stepId.includes('seek-cloud-fragment');
  }

  /**
   * Builds a small grid route through walkable ground for every story target.
   * The quest arrow uses its next waypoint, so it points to a usable passage
   * instead of directly through walls, water, or a closed map boundary.
   */
  private buildQuestNavigationPath(targetX: number, targetY: number): Vec2[] {
    const start = this.playerPos.clone();
    const goal = this.resolveSafePlayerSpawn(targetX, targetY);
    const distance = Vec2.distance(start, goal);
    if (distance <= 150) return [];

    const cellSize = 64;
    const toCell = (point: Vec2) => ({ x: Math.round(point.x / cellSize), y: Math.round(point.y / cellSize) });
    const startCell = toCell(start);
    const goalCell = toCell(goal);
    const margin = 10;
    const minX = Math.min(startCell.x, goalCell.x) - margin;
    const maxX = Math.max(startCell.x, goalCell.x) + margin;
    const minY = Math.min(startCell.y, goalCell.y) - margin;
    const maxY = Math.max(startCell.y, goalCell.y) + margin;
    // Safety cap: if a malformed target is extremely far away, retain the
    // ordinary direction arrow rather than spending a frame on a huge search.
    if ((maxX - minX + 1) * (maxY - minY + 1) > 12000) return [];

    type Cell = { x: number; y: number };
    const key = (cell: Cell) => `${cell.x},${cell.y}`;
    const queue: Cell[] = [startCell];
    const previous = new Map<string, Cell>();
    const visited = new Set<string>([key(startCell)]);
    const directions: Cell[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    let found: Cell | null = null;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.x === goalCell.x && current.y === goalCell.y) {
        found = current;
        break;
      }
      for (const direction of directions) {
        const next = { x: current.x + direction.x, y: current.y + direction.y };
        if (next.x < minX || next.x > maxX || next.y < minY || next.y > maxY || visited.has(key(next))) continue;
        const worldX = next.x * cellSize;
        const worldY = next.y * cellSize;
        // Check the destination and midpoint to avoid a 64px grid step
        // visually jumping across a narrow wall or water edge.
        const midpointX = (current.x + next.x) * cellSize / 2;
        const midpointY = (current.y + next.y) * cellSize / 2;
        if (!this.canStandRadius(worldX, worldY, this.playerRadius)
          || !this.canStandRadius(midpointX, midpointY, this.playerRadius)) continue;
        visited.add(key(next));
        previous.set(key(next), current);
        queue.push(next);
      }
    }
    if (!found) return [];

    const cells: Cell[] = [];
    for (let cursor: Cell | undefined = found; cursor; cursor = previous.get(key(cursor))) cells.push(cursor);
    cells.reverse();
    const raw = cells.slice(1).map(cell => new Vec2(cell.x * cellSize, cell.y * cellSize));
    if (!raw.length) return [];
    raw[raw.length - 1] = goal;

    // Keep turns and every fourth grid point: enough precision around walls,
    // but not an overwhelming trail of tiny marker movements.
    const route: Vec2[] = [];
    for (let index = 0; index < raw.length; index++) {
      const previousPoint = raw[index - 1];
      const point = raw[index];
      const nextPoint = raw[index + 1];
      const isTurn = previousPoint && nextPoint
        && ((point.x - previousPoint.x) * (nextPoint.y - point.y)
          !== (point.y - previousPoint.y) * (nextPoint.x - point.x));
      if (index === raw.length - 1 || index % 4 === 3 || isTurn) route.push(point);
    }
    return route;
  }

  private narrativeExcavationHint(chapterId: string) {
    const hints: Record<string, { title: string; detail: string }> = {
      [CHAPTER_ONE_ID]: { title: '循异光查验土层', detail: '留意荒地上与雨痕、风声不相称的微光；它会在靠近时回应。' },
      [CHAPTER_TWO_ID]: { title: '顺着水声查找痕迹', detail: '观察潮线、湿沙与船桩附近的异样反光，别急着只看最亮的地方。' },
      [CHAPTER_THREE_ID]: { title: '沿逆流裂纹追查', detail: '村口与峡壁留着被水冲开的旧痕，碎甲常藏在地势转折处。' },
      [CHAPTER_FOUR_ID]: { title: '在林雾中辨认方向', detail: '月影、树根与浅水会给出不同的线索；沿着不合常理的微光前行。' },
      [CHAPTER_FIVE_ID]: { title: '查验护送道上的遗痕', detail: '在岔道、车辙和驿站残迹之间寻找被人匆忙掩过的土层。' },
      [CHAPTER_SIX_ID]: { title: '循残灯余温探查', detail: '断柱、灰烬与熄灭的灯盏旁仍留着微弱回应，先分辨风向再动手。' },
      [CHAPTER_SEVEN_ID]: { title: '从余烬中辨伪', detail: '别只追逐火光；纸灰、封泥和被搬动的书匣都可能留下真相。' },
      [CHAPTER_EIGHT_ID]: { title: '对照陵道三证', detail: '把脚印、器痕与墙上的旧刻放在一起看，矛盾之处往往更接近答案。' },
      [CHAPTER_NINE_ID]: { title: '循天阶残纹追寻', detail: '石阶上残留的光并不总指向高处；停下倾听，辨清它真正要引你去的地方。' },
    };
    return hints[chapterId] ?? { title: '调查异常土层', detail: '跟随附近微光与环境痕迹继续调查。' };
  }

  /** Adds a short environmental beat at chapter turning points without replacing existing dialogue. */
  private withSceneAtmosphere(step: StoryStepDefinition, lines: DialogueLine[]) {
    const phase = step.id.includes('midstream') ? 'mid' : step.id.includes('fragment-awakens') ? 'end'
      : step.id.endsWith('opening') ? 'open' : null;
    if (!phase) return lines;
    const scene: Record<string, Partial<Record<'open' | 'mid' | 'end', string>>> = {
      [CHAPTER_ONE_ID]: { open: '晨雾压在城外的荒地上，远处犬吠忽止，像有什么正在土层下屏息。', mid: '风从田埂掠过，碎骨相互轻碰，发出极细的回响。', end: '五处微光渐次暗下，荒地重新安静，却不再显得空无一物。' },
      [CHAPTER_TWO_ID]: { open: '河面浮着薄雾，系船的麻绳被水拍得一下一下敲在木桩上。', mid: '潮水漫过旧脚印，阿潍停下话头，望向父亲当年失踪的上游。', end: '水纹在滩涂上收束，像有人将散乱的记忆一笔笔理回原位。' },
      [CHAPTER_THREE_ID]: { open: '峡口的风裹着湿冷石屑，断壁间仍留有被洪水反复磨过的白痕。', mid: '山洪退去后，一段从未见光的壁面露了出来，阿沚沉默得比峡风更久。', end: '峡中的回声没有回答，却把众人的脚步声送向更深的山林。' },
      [CHAPTER_FOUR_ID]: { open: '林雾贴着地面流动，树冠遮住天光，只有断续月色落在潮湿的根须上。', mid: '雾忽然变浓，熟悉的小径被吞没；阿岚摸着树皮，讲起走散的人。', end: '云隙裂开，星月把林间的水脉照成一条安静的归路。' },
      [CHAPTER_FIVE_ID]: { open: '护送道上车辙交错，远处铃声时断时续，像有人正等着一支迟到的队伍。', mid: '一阵尘风卷过，阿归终于放下紧握的缰绳，肯把真正的担忧说出口。', end: '祭器的铜色在暮光里一闪，归途第一次有了可以相信的方向。' },
      [CHAPTER_SIX_ID]: { open: '废墟的风穿过断窗，吹得残灯芯忽明忽灭，墙上旧烟痕像未写完的句子。', mid: '灯火被风压低，阿烛用手护住火种，低声说起师父留下的规矩。', end: '一盏盏残灯接续亮起，黑暗没有退尽，却终于露出了可走的边界。' },
      [CHAPTER_SEVEN_ID]: { open: '书匣边的灰烬还带余温，空气里混着焦墨与潮纸的气味。', mid: '火舌舔过一页残册，阿简抢下它时手指沾满黑灰，也沾上了旧日的疑问。', end: '最后一点火星熄灭，真简与伪册终于不再混在同一片灰里。' },
      [CHAPTER_EIGHT_ID]: { open: '陵道深处没有风，只有脚步在石壁间来回折返，像三种说法互不相让。', mid: '壁灯摇晃，三处证据在光影里彼此抵牾，阿陵第一次承认自己也曾怀疑。', end: '石门后的回声渐止，留下的不是答案本身，而是能够判断答案的凭据。' },
      [CHAPTER_NINE_ID]: { open: '天阶上云影缓慢移动，脚下每一块石板都像在等候最后一次问答。', mid: '风从高处掠过，阿圭望着裂纹沉默良久，终于将选择交还给你。', end: '散光汇入天阶尽头，通天之契是否续写，已不再只由旧人的声音决定。' },
    };
    const text = phase ? scene[step.chapterId]?.[phase] : undefined;
        return text ? [{ speaker: '旁白', kind: 'narration' as const, text }, ...lines] : lines;
  }

  private completeStoryDialogue(step: StoryStepDefinition) {
    if (this.storyController?.currentStep()?.id !== step.id) return;
    // fragment-awakens 后必须集齐本章全部主线字，才推进到 first-request / 占卜。
    // 引导字已齐但自由字未齐时：开放自由探索坑、尝试开启本章挑战，并提示继续收集。
    if (step.id.endsWith('fragment-awakens')) {
      const main = this.chapterMainProgress(step.chapterId);
      const guided = this.chapterGuidedProgress(step.chapterId);
      const allLearned = main.total > 0 && main.learned >= main.total;
      const guidedLearned = guided.total > 0 && guided.learned >= guided.total;
      if (!allLearned) {
        if (guidedLearned) {
          this.prepareChapterFreeExploration(step.chapterId);
          this.tryOpenChapterChallenge(step.chapterId);
          const freeRemaining = main.total - main.learned;
          if (freeRemaining > 0) {
            this.showStatusNotice(
              `本章甲骨字已集齐。尚有 ${freeRemaining} 枚散落在附近；继续收集剩余甲骨字，方可回宗庙占卜。`,
              5,
            );
          }
        } else {
          this.showChapterCollectionMilestone(step.chapterId);
        }
        return;
      }
    }
    this.storyController?.handle({ type: 'dialogue-completed' });
    this.advanceToNextChapterIfNeeded();
  }

  /** 本章全部主线字（引导字 + 自由探索字），用于面板统计与全盘收集，不门控章完成。 */
  private chapterMainProgress(chapterId: string) {
    const plan = collectionPlanFor(chapterId);
    const cardIds = plan ? [...plan.guidedCardIds, ...plan.mainFreeCardIds] : [];
    const validIds = cardIds.filter(id => this.oracleCards.some(card => card.id === id));
    const excavatedCards = this.save.excavatedCardIds ?? [];
    const collected = validIds.filter(id => this.save.unlockedOracleIds.includes(id) || excavatedCards.includes(id)).length;
    const learned = validIds.filter(id => (this.save.mastery[id]?.correctCount ?? 0) > 0).length;
    return { total: validIds.length, collected, learned };
  }

  /** 本章必要引导字：金圈箭头带路、门控章完成、决定进度条与选择题触发。 */
  private chapterGuidedProgress(chapterId: string) {
    const cardIds = [...(collectionPlanFor(chapterId)?.guidedCardIds ?? [])];
    const validIds = cardIds.filter(id => this.oracleCards.some(card => card.id === id));
    const excavatedCards = this.save.excavatedCardIds ?? [];
    const collected = validIds.filter(id => this.save.unlockedOracleIds.includes(id) || excavatedCards.includes(id)).length;
    const learned = validIds.filter(id => (this.save.mastery[id]?.correctCount ?? 0) > 0).length;
    return { total: validIds.length, collected, learned };
  }

  private chapterRequirementText(chapterId: string | null | undefined) {
    if (!chapterId) return '';
    const guided = this.chapterGuidedProgress(chapterId);
    const main = this.chapterMainProgress(chapterId);
    if (guided.total <= 0 || main.total <= 0) return '';
    return `本章字：已挖 ${main.collected}/${main.total} · 已学 ${main.learned}/${main.total}`;
  }

  /** 当本章字收集进度变化时给出明确提示：甲骨字未集齐时循金色箭头挖掘；集齐并学会后回宗庙占卜。 */
  private showChapterCollectionMilestone(chapterId: string | undefined) {
    if (!chapterId) return;
    const snapshot = this.storyController?.snapshot();
    if (!snapshot || snapshot.completedChapterIds.includes(chapterId)) return;
    const guided = this.chapterGuidedProgress(chapterId);
    const main = this.chapterMainProgress(chapterId);
    if (guided.total <= 0 || main.total <= 0) return;
    const guidedLearned = guided.learned >= guided.total;
    const allCollected = main.collected >= main.total;
    const allLearned = main.learned >= main.total;
    if (allLearned) {
      this.showStatusNotice('本章甲骨皆已集齐并学会，回宗庙完成占卜，方能让本章功德圆满。', 5);
    } else if (guidedLearned && main.learned < main.total) {
      const freeMissing = main.total - main.learned;
      this.showStatusNotice(
        `本章甲骨字已集齐，尚有 ${freeMissing} 枚散落在附近；继续收集剩余甲骨字，方可回宗庙占卜。`,
        5,
      );
    } else if (allCollected) {
      const missing = guided.total - guided.learned;
      this.showStatusNotice(`本章碎甲已集齐，尚有 ${missing} 个甲骨字未学会；去辨认它们，再继续收集剩余甲骨。`, 5);
    } else {
      const missing = guided.total - guided.collected;
      this.showStatusNotice(`本章甲骨已收集 ${guided.collected}/${guided.total}，尚有 ${missing} 个甲骨字未挖出；循金色箭头继续挖掘。`, 5);
    }
    // 引导字全部学会后：开放本章自由探索坑（含本章剩余主线字，供“全必挖”），
    // 并尝试开启本章挑战。此前不提前点亮全章坑，避免“满场可挖=全指引”观感。
    // 自由探索坑只含已完成章/当前章字，绝不含尚未到达的后续章字（见 getUnlockedStoryCardIds 门控）。
    if (guidedLearned && !snapshot.completedChapterIds.includes(chapterId)) {
      this.prepareChapterFreeExploration(chapterId);
      this.tryOpenChapterChallenge(chapterId);
    }
    // 章末因「尚缺本章自由探索字」被阻塞的兜底：玩家补齐全部本章字后，
    // 此处补判章完成并自动衔接下一章，避免停在末步无人接管而软锁。
    if (this.storyController?.recheckChapterCompletion()) {
      this.advanceToNextChapterIfNeeded();
    }
  }

  private tryOpenChapterChallenge(chapterId: string) {
    const guided = this.chapterGuidedProgress(chapterId);
    if (guided.total > 0 && guided.learned < guided.total) {
      const missing = guided.total - guided.learned;
      this.showStatusNotice(
        `本章骨纹已收集 ${guided.collected}/${guided.total}，已学会 ${guided.learned}/${guided.total}；还需学习 ${missing} 个甲骨字。`,
        5,
      );
      return false;
    }
    this.openChapterChallenge(chapterId);
    return true;
  }

  /**
   * The linear story only guides the key words. Once it reaches the chapter
   * turn, immediately repopulate nearby ordinary sites with this chapter's
   * remaining main words so the player has a visible, playable collection
   * phase instead of waiting for the normal five-minute site respawn.
   */
  private prepareChapterFreeExploration(chapterId: string) {
    const regions: Record<string, ExcavationRegion[]> = {
      [CHAPTER_ONE_ID]: ['trial'],
      [CHAPTER_TWO_ID]: ['river'],
      [CHAPTER_THREE_ID]: ['royal'],
      [CHAPTER_FOUR_ID]: ['forest'],
      [CHAPTER_FIVE_ID]: ['field'],
      [CHAPTER_SIX_ID]: ['royal'],
      [CHAPTER_SEVEN_ID]: ['forest'],
      [CHAPTER_EIGHT_ID]: ['royal'],
      [CHAPTER_NINE_ID]: ['field'],
    };
    const plan = collectionPlanFor(chapterId);
    if (!plan) return;
    // 取本章未收集的自由探索字（含原待补字）：现已生成占位卡、可挖到，全部进入自由探索坑与完成门槛。
    const remaining = plan.mainFreeCardIds
      .filter(id => !this.save.unlockedOracleIds.includes(id))
      .map(id => this.oracleCards.find(card => card.id === id))
      .filter((card): card is OracleCardData => Boolean(card));
    if (!remaining.length) return;
    const allSites = this.excavationSites.filter(site =>
      regions[chapterId]?.includes(site.region) && !site.storyTarget && !site.awaitingStudy);
    if (!allSites.length) return;
    // 均匀散布：按到本章挖掘区中心的距离排序，等间隔取样 remaining.length 个坑，
    // 让可见坑覆盖整片挖掘区（玩家需走动探索），而不是全挤在 NPC 最近的一圈。
    const regionRect = this.regionForChapterExcavation(chapterId);
    const centerX = regionRect ? (regionRect.left + regionRect.right) / 2 : 0;
    const centerY = regionRect ? (regionRect.bottom + regionRect.top) / 2 : 0;
    const sorted = allSites.slice().sort((a, b) =>
      ((a.x - centerX) * (a.x - centerX) + (a.y - centerY) * (a.y - centerY)) -
      ((b.x - centerX) * (b.x - centerX) + (b.y - centerY) * (b.y - centerY)));
    const step = sorted.length / remaining.length;
    const chosen: ExcavationSite[] = [];
    for (let k = 0; k < remaining.length && k < sorted.length; k++) {
      chosen.push(sorted[Math.min(sorted.length - 1, Math.floor(k * step))]);
    }
    // 洗牌字序后一一对应分配，保证每个可见坑字唯一、绝不重复（彻底解决「四个坑全是金」）。
    const shuffled = remaining.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    chosen.forEach((site, i) => {
      const card = shuffled[i % shuffled.length];
      site.reward = { kind: 'oracle', quality: card.quality, cardId: card.id, amount: 0, experience: 0, coins: 0, tier: 'story' };
      site.active = true;
      site.revealed = true;
      site.respawnTimer = 0;
      site.holeTimer = 0;
      this.redrawExcavationSite(site);
    });
  }

  // 取某章专属挖掘区的矩形边界，用于自由探索坑的均匀散布计算。
  private regionForChapterExcavation(chapterId: string): { left: number; right: number; bottom: number; top: number } | null {
    switch (chapterId) {
      case CHAPTER_ONE_ID: return { left: -450, right: 220, bottom: -880, top: 300 };
      case CHAPTER_TWO_ID: return this.riverRegion;
      case CHAPTER_THREE_ID: return this.tombRegion;
      case CHAPTER_FOUR_ID: return this.forestRegion;
      case CHAPTER_FIVE_ID: return this.fieldRegion;
      case CHAPTER_SIX_ID: return this.tombRegion;
      case CHAPTER_SEVEN_ID: return this.forestRegion;
      case CHAPTER_EIGHT_ID: return this.tombRegion;
      case CHAPTER_NINE_ID: return this.fieldRegion;
      default: return null;
    }
  }

  private openChapterChallenge(chapterId: string) {
    const challenge = CHAPTER_CHALLENGES[chapterId];
    if (!challenge || this.overlay !== 'none') return;
    this.stopPlayerInput();
    this.overlay = 'chapterChallenge';
    this.destroyOverlayRoot();
    const root = new Node('ChapterChallengeOverlay');
    root.parent = this.node;
    root.setPosition(0, 0, 500);
    root.addComponent(UITransform).setContentSize(1280, 720);
    this.overlayRoot = root;
    this.drawWoodPanel(root, 'ChapterChallengePanel', 0, 0, 960, 590, 0, false);
    this.createUiLabel(root, 'ChapterChallengeTitle', challenge.title, 0, 235, 800, 44, 28, new Color(255, 224, 148));
    this.createUiLabel(root, 'ChapterChallengeHint', '学完本章核心字后，完成挑战才能继续问卜', 0, 196, 760, 28, 14, new Color(218, 194, 146));
    this.drawWoodPanel(root, 'ChapterChallengePromptPanel', 0, 105, 820, 120, 1, true);
    this.createUiLabel(root, 'ChapterChallengePrompt', challenge.prompt, 0, 105, 750, 92, 21, new Color(255, 239, 205));
    const positions: Array<[number, number]> = [[-215, 5], [215, 5], [-215, -90], [215, -90]];
    challenge.choices.forEach((choice, index) => {
      const [x, y] = positions[index];
      this.drawUiButton(root, `ChapterChallengeChoice-${index}`, choice, x, y, 360, 66, false);
    });
    this.createUiLabel(root, 'ChapterChallengeFeedback', '请选择最符合本章所学甲骨文线索的答案。', 0, -190, 760, 32, 15, new Color(221, 190, 124));
  }

  private answerChapterChallenge(index: number) {
    const chapterId = this.storyController?.currentStep()?.chapterId;
    const challenge = chapterId ? CHAPTER_CHALLENGES[chapterId] : undefined;
    if (!challenge || this.overlay !== 'chapterChallenge') return;
    const feedback = this.overlayRoot?.getChildByName('ChapterChallengeFeedback')?.getComponent(Label);
    if (index !== challenge.correctIndex) {
      if (feedback) feedback.string = '这条线索还不能解释骨纹的含义，再根据本章学到的字想一想。';
      return;
    }
    if (feedback) feedback.string = challenge.success;
    this.scheduleOnce(() => {
      this.destroyOverlayRoot();
      this.overlay = 'none';
      this.storyController?.handle({ type: 'dialogue-completed' });
    }, .7);
  }

  // 三个测试按钮：分别把存档重置到“重测第一/二/三章”的开头。
  private createStoryTestButtons() {
    if (!SHOW_STORY_TEST_BUTTONS || !sys.isBrowser || this.storyTestButtons.length > 0) return;
    const defs: Array<{ y: number; label: string; target: StoryTestChapter }> = [
      { y: 332, label: '测·第一章', target: 1 },
      { y: 282, label: '测·第二章', target: 2 },
      { y: 232, label: '测·第三章', target: 3 },
      { y: 182, label: '测·第四章', target: 4 },
      { y: 132, label: '测·第五章', target: 5 },
      { y: 82, label: '测·第六章', target: 6 },
      { y: 32, label: '测·第七章', target: 7 },
      { y: -18, label: '测·第八章', target: 8 },
      { y: -68, label: '测·第九章', target: 9 },
    ];
    for (const def of defs) {
      const root = new Node(`StoryTestButton-${def.target}`);
      root.parent = this.node;
      root.setPosition(-492, def.y, 720);
      root.addComponent(UITransform).setContentSize(200, 40);
      root.addComponent(BlockInputEvents);
      const background = root.addComponent(Graphics);
      background.fillColor = new Color(55, 39, 31, 242);
      background.roundRect(-98, -18, 196, 36, 9);
      background.fill();
      background.strokeColor = new Color(218, 170, 82, 255);
      background.lineWidth = 3;
      background.roundRect(-96, -16, 192, 32, 8);
      background.stroke();
      this.createUiLabel(
        root, `StoryTestButtonLabel-${def.target}`, def.label,
        0, 0, 184, 30, 15, new Color(255, 231, 177), 'center', 2,
      );
      const target = def.target;
      root.on(Node.EventType.TOUCH_END, () => this.resetStoryForTesting(target), this);
      this.storyTestButtons.push(root);
    }
  }

  // 重测指定章节：重置为全新存档，再标记其前置章已完成（其字视为已唤醒），
  // 直接进入目标章，无需重玩前置章。
  private resetStoryForTesting(target: StoryTestChapter) {
    if (this.overlay !== 'none' || this.learningHall.isOpen) return;
    this.prepareForStoryTestTravel();
    const testStart = STORY_TEST_STARTS[target];
    const testLocation = storyLocation(testStart?.storyLocationId);
    const transitionManager = this.regionTransitionManager;
    const registeredEntries = transitionManager?.getRegisteredEntries() ?? [];
    const entry = testLocation && transitionManager ? transitionManager.getEntry(testLocation.entryId) : null;
    if (target === 2 || target === 3 || target === 9) this.logStoryTestEntryDiagnostics(target, transitionManager, testLocation, entry);
    console.info('[StoryTest] launch requested.', {
      chapterNumber: target,
      chapterId: testStart?.chapterId ?? null,
      storyLocationId: testStart?.storyLocationId ?? null,
      regionId: testLocation?.regionId ?? null,
      entryId: testLocation?.entryId ?? null,
      transitionManagerReady: !!transitionManager,
      transitionState: transitionManager?.state ?? null,
      registeredEntries: registeredEntries.map(item => ({
        regionId: item.regionId,
        entryId: item.id,
        position: { x: item.worldPosition.x, y: item.worldPosition.y },
        source: 'createPhaseOneRegionConfig',
      })),
    });
    if (!testStart || !testLocation || !transitionManager || !entry || entry.regionId !== testLocation.regionId) {
      console.error('[StoryTest] chapter test entry is unavailable; story launch cancelled.', {
        chapterNumber: target,
        storyLocationId: testStart?.storyLocationId ?? null,
        regionId: testLocation?.regionId ?? null,
        entryId: testLocation?.entryId ?? null,
        transitionManagerReady: !!transitionManager,
        registeredEntry: entry,
        registeredEntries: registeredEntries.map(item => ({ regionId: item.regionId, entryId: item.id })),
      });
      this.showStatusNotice('测试起点未配置，已取消传送。', 4);
      return;
    }
    const resolvedLocation = testLocation;
    const resolvedEntry = entry;

    const startStoryAfterArrival = () => {
      if (target === 2 || target === 3 || target === 9) {
        this.logStoryTestTransitionResult('success', target, transitionManager, resolvedLocation, resolvedEntry);
      }
      this.startStoryTestAfterArrival(target, testStart.chapterId);
    };
    const transitionFailed = (reason: string) => {
      this.restorePlayerAfterStoryTestTravel();
      if (target === 2 || target === 3 || target === 9) {
        this.logStoryTestTransitionResult('failed', target, transitionManager, resolvedLocation, resolvedEntry, reason);
      }
      console.error('[StoryTest] chapter test travel failed; story launch cancelled.', {
        chapterNumber: target,
        storyLocationId: testLocation.id,
        regionId: testLocation.regionId,
        entryId: testLocation.entryId,
        reason,
        transitionState: transitionManager.state,
        registeredEntries: transitionManager.getRegisteredEntries().map(item => ({ regionId: item.regionId, entryId: item.id })),
      });
      this.showStatusNotice('测试区域入口不可用，已取消传送。', 4);
    };
    this.showStatusNotice(`正在进入第${target}章测试…`, 1.5);
    if (!transitionManager.transitionToEntry(resolvedEntry.id, { onCompleted: startStoryAfterArrival, onFailed: transitionFailed })) return;
  }

  private prepareForStoryTestTravel() {
    this.storyPresentationToken++;
    this.presentedStoryStepId = null;
    this.storyArrivalLocked = false;
    this.stopPlayerInput();
    this.chapterBanner.forceClose();
    this.storyDialogue.close();
    this.destroyOverlayRoot();
    this.overlay = 'none';
    this.divinationStage = 'none';
    this.currentQuestion = null;
    this.currentDivinationCards = [];
    this.seated = false;
    this.templePreSitPosition = null;
    this.templeLastRisePosition = null;
    if (this.fishingCastEffect) this.cancelFishingCast('', false);
    this.restorePlayerAfterStoryTestTravel();
  }

  private restorePlayerAfterStoryTestTravel() {
    this.worldMode = 'outside';
    if (this.templeInterior?.isValid) this.templeInterior.active = false;
    if (this.world?.isValid) this.world.active = true;
    if (this.player?.isValid && this.player.parent !== this.world) this.player.parent = this.world;
    if (this.player?.isValid) {
      this.player.active = true;
      const opacity = this.player.getComponent(UIOpacity) ?? this.player.addComponent(UIOpacity);
      opacity.opacity = 255;
      this.player.setPosition(this.playerPos.x, this.playerPos.y, 80);
      this.displayedPlayerFrame = -1;
      this.showPlayerFrame(this.getIdleFrameIndex(this.facing));
    }
    if (this.weatherParticleNode?.isValid) {
      this.weatherParticleNode.active = true;
      this.drawWeatherParticles(this.weather !== '晴');
    }
    this.regionInputLocked = false;
    this.stopPlayerInput();
    this.syncCameraImmediately();
  }

  /** Called only after RegionTransitionManager has committed the requested RegionEntry. */
  private startStoryTestAfterArrival(target: StoryTestChapter, chapterId: string) {
    this.prepareForStoryTestTravel();
    // 章顺序表：索引 = 章序-1；用于按 target 计算前置已完成章 + 需唤醒章 + 标签，加章只改这里。
    const chapterIdsInOrder = [
      CHAPTER_ONE_ID, CHAPTER_TWO_ID, CHAPTER_THREE_ID, CHAPTER_FOUR_ID, CHAPTER_FIVE_ID,
      CHAPTER_SIX_ID, CHAPTER_SEVEN_ID, CHAPTER_EIGHT_ID, CHAPTER_NINE_ID,
    ];
    const fragmentsInOrder = [
      CHAPTER_ONE_FRAGMENT_CARDS, CHAPTER_TWO_FRAGMENT_CARDS, CHAPTER_THREE_FRAGMENT_CARDS,
      CHAPTER_FOUR_FRAGMENT_CARDS, CHAPTER_FIVE_FRAGMENT_CARDS, CHAPTER_SIX_FRAGMENT_CARDS,
      CHAPTER_SEVEN_FRAGMENT_CARDS, CHAPTER_EIGHT_FRAGMENT_CARDS, CHAPTER_NINE_FRAGMENT_CARDS,
    ];
    // 1) 故事状态重置为全新，再按目标章把前置章节标记已完成
    // Keep the subscriber from auto-starting a chapter while the test state is
    // being rebuilt. The requested chapter is started explicitly below.
    this.storyWorldEntered = false;
    this.storyController.resetForTesting();
    const priorCompleted = chapterIdsInOrder.slice(0, target - 1);
    if (priorCompleted.length) this.storyController.startTestingAtChapter(priorCompleted);

    // 2) 清空全部剧情碎片卡（学习进度 + 解锁），稍后重新唤醒前置章
    const allStoryCards = this.allStoryFragmentCards;
    const allStoryIds = new Set<string>(
      allStoryCards.map(item => item.cardId ?? '').filter(id => id.length > 0));
    this.save.unlockedOracleIds = this.save.unlockedOracleIds.filter(id => !allStoryIds.has(id));
    allStoryCards.forEach(item => { if (item.cardId) delete this.save.mastery[item.cardId]; });

    // 3) 重置所有剧情挖掘坑位为可挖状态
    // 维护提示：STORY_REGIONS 覆盖全部剧情可用区域；新增章节若引入新区域，只需在此数组补充，
    // 否则会出现“加章漏重置”类回归（历史 bug：曾漏 forest）。
    const storyRegions: ExcavationRegion[] = ['river', 'field', 'lake', 'royal', 'forest'];
    this.excavationSites
      .filter(site => storyRegions.includes(site.region))
      .forEach(site => {
        site.active = true;
        site.awaitingStudy = false;
        site.respawnTimer = 0;
        site.holeTimer = 0;
        this.redrawExcavationSite(site);
      });

    // 4) 前置章的字视为已唤醒，使进度面板状态一致
    for (let i = 0; i < target - 1; i++) this.awakenStoryCards(fragmentsInOrder[i]);

    // The region is already switched at this point. Starting the chapter now
    // cannot activate dialogue or NPCs before its RegionEntry succeeds.
    this.storyWorldEntered = true;
    this.storyController.startChapter(chapterId);
    this.persistCitySave();
  }

  /** Detailed runtime diagnostics are intentionally limited to repaired test entries. */
  private logStoryTestEntryDiagnostics(
    chapterNumber: 2 | 3 | 9,
    transitionManager: RegionTransitionManager | undefined,
    location: ReturnType<typeof storyLocation>,
    entry: RegionEntry | null,
  ) {
    const targetRegion = entry?.regionId;
    const bounds = targetRegion ? createPhaseOneRegionConfig().definitions.find(definition => definition.id === targetRegion)?.currentWorldBounds : undefined;
    const position = entry?.worldPosition;
    const playerBoundsPass = !!bounds && !!position
      && position.x >= bounds.minX + this.playerRadius && position.x <= bounds.maxX - this.playerRadius
      && position.y >= bounds.minY + this.playerRadius && position.y <= bounds.maxY - this.playerRadius;
    const collisions = position && targetRegion ? this.obstacles.filter(obstacle => {
      if (obstacle.regionId && obstacle.regionId !== targetRegion) return false;
      return position.x + this.playerRadius > obstacle.x - obstacle.w / 2
        && position.x - this.playerRadius < obstacle.x + obstacle.w / 2
        && position.y + this.playerRadius > obstacle.y - obstacle.h / 2
        && position.y - this.playerRadius < obstacle.y + obstacle.h / 2;
    }).map(obstacle => ({
      name: obstacle.name,
      bounds: {
        minX: obstacle.x - obstacle.w / 2, maxX: obstacle.x + obstacle.w / 2,
        minY: obstacle.y - obstacle.h / 2, maxY: obstacle.y + obstacle.h / 2,
      },
    })) : [];
    const waterPass = !!position && !this.pointInWater(position.x, position.y, this.playerRadius);
    const staticStandPass = !!entry && this.canScriptedEntryStand(entry);
    console.info('[StoryTest] detailed entry diagnostics.', {
      chapterNumber,
      currentRegionId: transitionManager?.currentRegionId ?? null,
      targetRegionId: targetRegion ?? null,
      storyLocationId: location?.id ?? null,
      entryId: entry?.id ?? null,
      entryPosition: position ? { x: position.x, y: position.y } : null,
      transitionManagerReady: !!transitionManager,
      entryFound: !!entry,
      playerBoundsPass,
      canStandRadiusPass: staticStandPass,
      waterPass,
      blockingObstacles: collisions,
      failureStage: !transitionManager ? 'manager-unavailable'
        : !entry ? 'entry-not-registered'
          : !playerBoundsPass ? 'player-bounds'
            : collisions.length ? 'static-obstacle'
              : !waterPass ? 'water'
                : !staticStandPass ? 'static-standability'
                  : 'pending-blackout-transition',
    });
  }

  /** Emits the terminal phase for repaired test travels that previously failed at runtime. */
  private logStoryTestTransitionResult(
    result: 'success' | 'failed',
    chapterNumber: 2 | 3 | 9,
    transitionManager: RegionTransitionManager,
    location: NonNullable<ReturnType<typeof storyLocation>>,
    entry: RegionEntry,
    reason?: string,
  ) {
    const definition = createPhaseOneRegionConfig().definitions.find(item => item.id === location.regionId);
    const playerBoundsPass = !!definition && this.inRegion(entry.worldPosition.x, entry.worldPosition.y, {
      left: definition.currentWorldBounds.minX,
      right: definition.currentWorldBounds.maxX,
      bottom: definition.currentWorldBounds.minY,
      top: definition.currentWorldBounds.maxY,
    });
    console.info('[StoryTest] detailed entry transition result.', {
      chapterNumber,
      currentRegionId: transitionManager.currentRegionId,
      targetRegionId: location.regionId,
      storyLocationId: location.id,
      entryId: entry.id,
      entryPosition: { x: entry.worldPosition.x, y: entry.worldPosition.y },
      transitionManagerReady: true,
      entryFound: true,
      targetRegionSwitchSucceeded: result === 'success',
      playerBoundsPass,
      canStandRadiusPass: this.canScriptedEntryStand(entry),
      finalStage: result === 'success' ? 'region-entry-committed' : 'transition-failed',
      failureReason: reason ?? null,
    });
  }

  private reportNatureDecorVisible(name: string, asset: string, node: Node, regionId: RegionId, obstacleCreated: boolean) {
    const key = `${regionId}:${asset}`;
    const count = (this.natureDecorVisibleCounts.get(key) ?? 0) + 1;
    this.natureDecorVisibleCounts.set(key, count);
    console.info('[NatureDecor]', { name, asset, count, parent: node.parent?.name, regionId, active: node.active, spriteBound: true, obstacleCreated });
  }

  /**
   * Chapter 2 enters RIVERBANK's lower bank from a CITY test state. Its source
   * UPPER terrain hysteresis is not a collision at the authored landing point.
   * All other scripted entries retain the normal static terrain validation.
   */
  /**
   * 作者手工指定的落点是可信的着陆点，只做全局地图边界检查，跳过水域 / 障碍 /
   * NPC 碰撞 / 地形高程校验。否则像 chapter-2-riverbank-entry(-5060,-700) 这样落在
   * 河岸水边 / 礁石旁的落点会被 canStandRadius 的 pointInWater 误拒，导致章末接章的
   * scripted 传送站立校验失败、玩家被弹回上一章，而章节状态已切到新章——出现
   * 「视觉还停在上一个界面、小人错位丢失」的脱节。放宽后所有章节的接章落点统一可靠。
   */
  private canScriptedEntryStand(entry: Readonly<RegionEntry>) {
    const hw = this.mapWidth / 2 - 66;
    const hh = this.mapHeight / 2 - 66;
    const { x, y } = entry.worldPosition;
    return x >= -hw && x <= hw && y >= -hh && y <= hh;
  }

  // 把一批剧情碎片卡标记为已唤醒（解锁 + 学习进度），用于重测前置章时保持进度面板一致。
  private awakenStoryCards(cards: ReadonlyArray<{ cardId?: string | null }>) {
    cards.forEach(item => {
      if (!item.cardId) return;
      if (this.save.unlockedOracleIds.indexOf(item.cardId) < 0) {
        this.save.unlockedOracleIds.push(item.cardId);
      }
      this.save.mastery[item.cardId] = { attempts: 1, bestStars: 3, correctCount: 1 };
    });
  }

  private createChapterOneNpc() {
    const root = new Node('StoryNpc-XiaoShitou');
    root.parent = this.world;
    const location = storyLocation('chapter-1-city-guide')!;
    root.setPosition(location.localPosition.x, location.localPosition.y, 82);
    root.addComponent(UITransform).setContentSize(44, 60);
    const shadow = this.localGraphics('StoryNpc-XiaoShitou-Shadow', root, 0, 0, 34, 14, -3);
    shadow.fillColor = new Color(28, 34, 31, 72);
    shadow.ellipse(0, 1, 11, 3.5);
    shadow.fill();
    const visual = new Node('StoryNpc-XiaoShitou-Sprite');
    visual.parent = root;
    visual.setPosition(0, 30, 4);
    visual.addComponent(UITransform).setContentSize(64, 64);
    const sprite = visual.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    // Reuse the same pixel-character sheet as the city's authored NPCs so the
    // story guide cannot drift away from the established game art direction.
    this.requestSpriteFrame('characters/villager-farmer-v2/down-0/spriteFrame', frame => {
      if (sprite.isValid) sprite.spriteFrame = frame;
    });
    this.createStoryNpcWorldLabel(root, 'StoryNpc-XiaoShitou-Name', '小石头');
    root.active = false;
    this.storyNpc = root;
  }

  private createChapterTwoNpc() {
    const root = new Node('StoryNpc-Fisher');
    root.parent = this.world;
    const location = storyLocation('chapter-2-riverbank-npc')!;
    root.setPosition(location.localPosition.x, location.localPosition.y, 82);
    root.addComponent(UITransform).setContentSize(44, 60);
    const shadow = this.localGraphics('StoryNpc-Fisher-Shadow', root, 0, 0, 34, 14, -3);
    shadow.fillColor = new Color(28, 34, 31, 72);
    shadow.ellipse(0, 1, 11, 3.5);
    shadow.fill();
    const visual = new Node('StoryNpc-Fisher-Sprite');
    visual.parent = root;
    visual.setPosition(0, 30, 4);
    visual.addComponent(UITransform).setContentSize(64, 64);
    const sprite = visual.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.requestSpriteFrame('characters/villager-woman-v2/down-0/spriteFrame', frame => {
      if (sprite.isValid) sprite.spriteFrame = frame;
    });
    this.createStoryNpcWorldLabel(root, 'StoryNpc-Fisher-Name', '渔娘阿潍');
    // 脚下柔和金色光环 + 头顶微光：让玩家在河畔一眼定位渔娘（随 NPC 显隐而显隐）
    const guide = new Node('StoryNpc-Fisher-Guide');
    guide.parent = root;
    guide.setPosition(0, 0, 6);
    const guideG = guide.addComponent(Graphics);
    guideG.fillColor = new Color(255, 214, 120, 55);
    guideG.ellipse(0, 2, 26, 9);
    guideG.fill();
    guideG.strokeColor = new Color(255, 228, 150, 175);
    guideG.lineWidth = 2;
    guideG.ellipse(0, 2, 26, 9);
    guideG.stroke();
    // 头顶细小十字星，弱提示不抢视觉
    guideG.fillColor = new Color(255, 240, 190, 210);
    const drawStar = (cx: number, cy: number, r: number) => {
      guideG.moveTo(cx, cy + r);
      guideG.lineTo(cx + r * 0.25, cy + r * 0.25);
      guideG.lineTo(cx + r, cy);
      guideG.lineTo(cx + r * 0.25, cy - r * 0.25);
      guideG.lineTo(cx, cy - r);
      guideG.lineTo(cx - r * 0.25, cy - r * 0.25);
      guideG.lineTo(cx - r, cy);
      guideG.lineTo(cx - r * 0.25, cy + r * 0.25);
      guideG.close();
    };
    drawStar(0, 78, 7);
    guideG.fill();
    this.schedule(() => {
      if (!guide.isValid) return;
      const s = 1 + Math.sin(Date.now() / 350) * 0.08;
      guide.setScale(s, s, 1);
    }, 0.05);
    root.active = false;
    this.storyNpcTwo = root;
  }

  private createChapterThreeNpc() {
    const root = new Node('StoryNpc-GorgeKeeper');
    root.parent = this.world;
    const location = storyLocation('chapter-3-royal-tomb-npc')!;
    root.setPosition(location.localPosition.x, location.localPosition.y, 82);
    root.addComponent(UITransform).setContentSize(44, 60);
    const shadow = this.localGraphics('StoryNpc-GorgeKeeper-Shadow', root, 0, 0, 34, 14, -3);
    shadow.fillColor = new Color(28, 34, 31, 72);
    shadow.ellipse(0, 1, 11, 3.5);
    shadow.fill();
    const visual = new Node('StoryNpc-GorgeKeeper-Sprite');
    visual.parent = root;
    visual.setPosition(0, 30, 4);
    visual.addComponent(UITransform).setContentSize(64, 64);
    const sprite = visual.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.requestSpriteFrame('characters/villager-farmer-v2/down-0/spriteFrame', frame => {
      if (sprite.isValid) sprite.spriteFrame = frame;
    });
    this.createStoryNpcWorldLabel(root, 'StoryNpc-GorgeKeeper-Name', '守峡人阿沚');
    // 脚下柔和金色光环：让玩家在第三章一眼定位守峡人阿沚
    const guide = new Node('StoryNpc-GorgeKeeper-Guide');
    guide.parent = root;
    guide.setPosition(0, 0, 6);
    const guideG = guide.addComponent(Graphics);
    guideG.fillColor = new Color(255, 214, 120, 55);
    guideG.ellipse(0, 2, 26, 9);
    guideG.fill();
    guideG.strokeColor = new Color(255, 228, 150, 175);
    guideG.lineWidth = 2;
    guideG.ellipse(0, 2, 26, 9);
    guideG.stroke();
    this.schedule(() => {
      if (!guide.isValid) return;
      const s = 1 + Math.sin(Date.now() / 350) * 0.08;
      guide.setScale(s, s, 1);
    }, 0.05);
    // 点击阿沚也能触发对话：靠近判定 150 像素若因场景仍有遗漏，点击作为兜底
    root.on(Node.EventType.TOUCH_END, () => {
      const step = this.storyController?.currentStep();
      if (!step || step.id !== 'chapter-3-reach-gorge' || this.storyArrivalLocked) return;
      this.storyArrivalLocked = true;
      this.storyController.handle({ type: 'npc-reached', npcId: 'gorge-keeper' });
    }, this);
    root.active = false;
    this.storyNpcThree = root;
  }









  private markStoryTarget(site: ExcavationSite) {
    this.excavationSites.forEach(candidate => {
      if (candidate.storyTarget) {
        candidate.storyTarget = false;
        if (candidate.root.isValid) this.redrawExcavationSite(candidate);
      }
    });
    site.storyTarget = true;
    if (site.root.isValid) this.redrawExcavationSite(site);
  }

  // 全必挖后坑数 < 字数会复用坑位；若目标坑恰在冷却，必须立即激活让其可挖，
  // 否则等重生时 reward 被 rollExcavationReward 覆盖成随机字 → 当前字永远挖不到(死锁)。
  private activateStoryPit(site: ExcavationSite) {
    site.active = true;
    site.respawnTimer = 0;
    site.holeTimer = 0;
    if (site.root.isValid) site.root.active = true;
    this.redrawExcavationSite(site);
  }

  private updateChapterOneStory() {
    const step = this.storyController?.currentStep();
    if (!step || this.storyArrivalLocked) return;
    const isMeeting = step.id === 'chapter-1-meet-xiaoshitou';
    if (!isMeeting) return;
    const radius = step.objective?.targetRadius ?? 78;
    const location = storyLocation('chapter-1-city-guide')!;
    const dx = this.playerPos.x - location.localPosition.x;
    const dy = this.playerPos.y - location.localPosition.y;
    if (dx * dx + dy * dy > radius * radius) return;
    this.storyArrivalLocked = true;
    this.storyController.handle({ type: 'npc-reached', npcId: 'xiaoshitou' });
  }

  private updateChapterTwoStory() {
    const step = this.storyController?.currentStep();
    if (!step || this.storyArrivalLocked) return;
    const isMeeting = step.id === 'chapter-2-reach-river';
    if (!isMeeting) return;
    const radius = step.objective?.targetRadius ?? 78;
    const location = storyLocation('chapter-2-riverbank-npc')!;
    const dx = this.playerPos.x - location.localPosition.x;
    const dy = this.playerPos.y - location.localPosition.y;
    if (dx * dx + dy * dy > radius * radius) return;
    this.storyArrivalLocked = true;
    this.storyController.handle({ type: 'npc-reached', npcId: 'fisher' });
  }

  private updateChapterThreeStory() {
    const step = this.storyController?.currentStep();
    if (!step || this.storyArrivalLocked) return;
    const isMeeting = step.id === 'chapter-3-reach-gorge';
    if (!isMeeting) return;
    const radius = step.objective?.targetRadius ?? 78;
    const location = storyLocation('chapter-3-royal-tomb-npc')!;
    const dx = this.playerPos.x - location.localPosition.x;
    const dy = this.playerPos.y - location.localPosition.y;
    if (dx * dx + dy * dy > radius * radius) return;
    this.storyArrivalLocked = true;
    this.storyController.handle({ type: 'npc-reached', npcId: 'gorge-keeper' });
  }

  // 守林人阿岚（第四章）。采用 villager-woman-v2 女性立绘，脚下柔和金色光环便于定位。
  private createChapterFourNpc() {
    const root = new Node('StoryNpc-ForestKeeper');
    root.parent = this.world;
    const location = storyLocation('chapter-4-highland-npc')!;
    root.setPosition(location.localPosition.x, location.localPosition.y, 82);
    root.addComponent(UITransform).setContentSize(44, 60);
    const shadow = this.localGraphics('StoryNpc-ForestKeeper-Shadow', root, 0, 0, 34, 14, -3);
    shadow.fillColor = new Color(28, 34, 31, 72);
    shadow.ellipse(0, 1, 11, 3.5);
    shadow.fill();
    const visual = new Node('StoryNpc-ForestKeeper-Sprite');
    visual.parent = root;
    visual.setPosition(0, 30, 4);
    visual.addComponent(UITransform).setContentSize(64, 64);
    const sprite = visual.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.requestSpriteFrame('characters/villager-woman-v2/down-0/spriteFrame', frame => {
      if (sprite.isValid) sprite.spriteFrame = frame;
    });
    this.createStoryNpcWorldLabel(root, 'StoryNpc-ForestKeeper-Name', '守林人阿岚');
    // 脚下柔和金色光环：让玩家在第四章一眼定位守林人阿岚
    const guide = new Node('StoryNpc-ForestKeeper-Guide');
    guide.parent = root;
    guide.setPosition(0, 0, 6);
    const guideG = guide.addComponent(Graphics);
    guideG.fillColor = new Color(255, 214, 120, 55);
    guideG.ellipse(0, 2, 26, 9);
    guideG.fill();
    guideG.strokeColor = new Color(255, 228, 150, 175);
    guideG.lineWidth = 2;
    guideG.ellipse(0, 2, 26, 9);
    guideG.stroke();
    this.schedule(() => {
      if (!guide.isValid) return;
      const s = 1 + Math.sin(Date.now() / 350) * 0.08;
      guide.setScale(s, s, 1);
    }, 0.05);
    // 点击阿岚也能触发对话：靠近判定若因场景仍有遗漏，点击作为兜底
    root.on(Node.EventType.TOUCH_END, () => {
      const step = this.storyController?.currentStep();
      if (!step || step.id !== 'chapter-4-reach-forest' || this.storyArrivalLocked) return;
      this.storyArrivalLocked = true;
      this.storyController.handle({ type: 'npc-reached', npcId: 'forest-keeper' });
    }, this);
    root.active = false;
    this.storyNpcFour = root;
  }



  private updateChapterFourStory() {
    const step = this.storyController?.currentStep();
    if (!step || this.storyArrivalLocked) return;
    const isMeeting = step.id === 'chapter-4-reach-forest';
    if (!isMeeting) return;
    const radius = step.objective?.targetRadius ?? 78;
    const location = storyLocation('chapter-4-highland-npc')!;
    const dx = this.playerPos.x - location.localPosition.x;
    const dy = this.playerPos.y - location.localPosition.y;
    if (dx * dx + dy * dy > radius * radius) return;
    this.storyArrivalLocked = true;
    this.storyController.handle({ type: 'npc-reached', npcId: 'forest-keeper' });
  }

  // ===== 第五~九章通用装配（结构对称第四章：NPC 生成 / 到达判定 / 挖掘预约）=====
  // 五~九章 NPC 与守林人阿岚同构：阴影 + 精灵 + 名牌 + 脚下柔和金色光环 + 脉冲 + 点击兜底。
  private spawnStoryNpc(
    nodeName: string, pos: { x: number; y: number }, spriteFrame: string,
    labelText: string, reachStepId: string, npcId: string,
  ): Node {
    const root = new Node(nodeName);
    root.parent = this.world;
    root.setPosition(pos.x, pos.y, 82);
    root.addComponent(UITransform).setContentSize(44, 60);
    const shadow = this.localGraphics(`${nodeName}-Shadow`, root, 0, 0, 34, 14, -3);
    shadow.fillColor = new Color(28, 34, 31, 72);
    shadow.ellipse(0, 1, 11, 3.5);
    shadow.fill();
    const visual = new Node(`${nodeName}-Sprite`);
    visual.parent = root;
    visual.setPosition(0, 30, 4);
    visual.addComponent(UITransform).setContentSize(64, 64);
    const sprite = visual.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.requestSpriteFrame(spriteFrame, frame => {
      if (sprite.isValid) sprite.spriteFrame = frame;
    });
    this.createStoryNpcWorldLabel(root, `${nodeName}-Name`, labelText);
    const guide = new Node(`${nodeName}-Guide`);
    guide.parent = root;
    guide.setPosition(0, 0, 6);
    const guideG = guide.addComponent(Graphics);
    guideG.fillColor = new Color(255, 214, 120, 55);
    guideG.ellipse(0, 2, 26, 9);
    guideG.fill();
    guideG.strokeColor = new Color(255, 228, 150, 175);
    guideG.lineWidth = 2;
    guideG.ellipse(0, 2, 26, 9);
    guideG.stroke();
    this.schedule(() => {
      if (!guide.isValid) return;
      const s = 1 + Math.sin(Date.now() / 350) * 0.08;
      guide.setScale(s, s, 1);
    }, 0.05);
    root.on(Node.EventType.TOUCH_END, () => {
      const step = this.storyController?.currentStep();
      if (!step || step.id !== reachStepId || this.storyArrivalLocked) return;
      this.storyArrivalLocked = true;
      this.storyController.handle({ type: 'npc-reached', npcId });
    }, this);
    root.active = false;
    return root;
  }

  private createStoryNpcWorldLabel(source: Node, name: string, text: string) {
    if (!this.storyNpcLabelRoot?.isValid) {
      const root = new Node('WorldLabelRoot');
      root.parent = this.world;
      root.setPosition(0, 0, 118);
      root.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);
      this.storyNpcLabelRoot = root;
      this.fixedForegroundNodes.push(root);
    }
    const label = this.createUiLabel(
      this.storyNpcLabelRoot, name, text,
      source.position.x, source.position.y + 98, 116, 28, 16,
      new Color(255, 235, 177), 'center', 0,
    ).node;
    this.storyNpcWorldLabels.push({ source, label });
    this.updateStoryNpcWorldLabels();
  }

  private updateStoryNpcWorldLabels() {
    this.storyNpcWorldLabels = this.storyNpcWorldLabels.filter(({ source, label }) => {
      if (!source.isValid || !label.isValid) return false;
      label.active = source.activeInHierarchy;
      label.setPosition(source.position.x, source.position.y + 98, 0);
      return true;
    });
  }

  private createChapterFiveNpc() {
    this.storyNpcFive = this.spawnStoryNpc(
      'StoryNpc-EscortGuide', storyLocation('chapter-5-fields-npc')!.localPosition, 'characters/villager-woman-v2/down-0/spriteFrame',
      '归人·阿归', 'chapter-5-escort-home-reach-npc', 'escort-guide');
  }

  private createChapterSixNpc() {
    this.storyNpcSix = this.spawnStoryNpc(
      'StoryNpc-LampKeeper', storyLocation('chapter-6-royal-tomb-npc')!.localPosition, 'characters/villager-farmer-v2/down-0/spriteFrame',
      '灯匠·阿烛', 'chapter-6-ruins-lamp-reach-npc', 'lamp-keeper');
  }

  private createChapterSevenNpc() {
    this.storyNpcSeven = this.spawnStoryNpc(
      'StoryNpc-ScrollKeeper', storyLocation('chapter-7-highland-npc')!.localPosition, 'characters/oracle-apprentice/down-0/spriteFrame',
      '守册·阿简', 'chapter-7-wrong-scroll-reach-npc', 'scroll-keeper');
  }

  private createChapterEightNpc() {
    this.storyNpcEight = this.spawnStoryNpc(
      'StoryNpc-TombKeeper', storyLocation('chapter-8-royal-tomb-npc')!.localPosition, 'characters/villager-farmer-v2/down-0/spriteFrame',
      '守陵·阿陵', 'chapter-8-tomb-three-proofs-reach-npc', 'tomb-keeper');
  }

  private createChapterNineNpc() {
    this.storyNpcNine = this.spawnStoryNpc(
      'StoryNpc-GrandDiviner', storyLocation('chapter-9-city-npc')!.localPosition, 'characters/oracle-apprentice/down-0/spriteFrame',
      '大卜·阿圭', 'chapter-9-renew-covenant-reach-npc', 'grand-diviner');
  }

  // 全部章节（一~九）统一挖掘预约逻辑：字表参数化，坑由 takeChapterPit 跨区分散分配。
  // fragmentIndex 取模坑池长度，让大章（>坑数）也能均匀复用坑位、不会全挤在一个坑。
  private reserveStoryExcavationSite(
    fragmentCards: ReadonlyArray<{ seekStepId: string; lessonStepId: string; cardId?: string | null }>,
    chapterId: string,
  ) {
    const stepId = this.storyController.currentStep()?.id;
    const fragmentIndex = fragmentCards.findIndex(item =>
      item.seekStepId === stepId || item.lessonStepId === stepId);
    if (fragmentIndex < 0) return null;
    const fragment = fragmentCards[fragmentIndex];
    const site = this.takeChapterPit(chapterId, fragmentIndex);
    if (!site) return null;
    this.positionStorySiteForChapter(site, chapterId, fragmentIndex);
    const card = fragment.cardId ? this.oracleCards.find(item => item.id === fragment.cardId) : null;
    if (!card) {
      site.reward = { kind: 'oracle', quality: 'blue', cardId: fragment.cardId ?? '', amount: 0 };
      this.storyController.reserveStorySite(site.id);
      this.markStoryTarget(site);
      this.activateStoryPit(site);
      this.hideNonTargetChapterPits(chapterId, site);
      return site;
    }
    site.reward = { kind: 'oracle', quality: card.quality, cardId: fragment.cardId, amount: 0 };
    this.storyController.reserveStorySite(site.id);
    this.markStoryTarget(site);
    this.activateStoryPit(site);
    this.hideNonTargetChapterPits(chapterId, site);
    return site;
  }

  // 引导阶段：除金圈目标坑 + 正在学习的坑外，额外保留「少量（2~3个）邻近普通坑」，
  // 给玩家一点自由探索感而不“全指引”；其余本章坑与尚未到达的后续章坑一律隐藏。
  // 邻近坑填“已解锁章字”（含他章复习字，绝不含后续未到达章字，见 getUnlockedStoryCardIds 门控）。
  // 已通关章的坑仍保留可见（符合“可含已挖过的其他章字”的约定）。
  private hideNonTargetChapterPits(chapterId: string, target: ExcavationSite) {
    const currentIndex = STORY_CHAPTER_IDS.indexOf(chapterId);
    const pool = this.chapterPitPool(chapterId);
    const nearbyCount = 3;
    const candidates = pool
      .filter(s => s !== target && !s.storyTarget && !s.awaitingStudy)
      .sort((a, b) =>
        ((a.x - target.x) * (a.x - target.x) + (a.y - target.y) * (a.y - target.y)) -
        ((b.x - target.x) * (b.x - target.x) + (b.y - target.y) * (b.y - target.y)));
    const keepNearby = new Set(candidates.slice(0, Math.min(nearbyCount, candidates.length)));
    const toHide = new Set<ExcavationSite>();
    for (const otherId of STORY_CHAPTER_IDS) {
      const otherIdx = STORY_CHAPTER_IDS.indexOf(otherId);
      // 尚未到达的后续章坑：绝对隐藏，杜绝“未挖过的后面章节的字”出现。
      if (otherIdx > currentIndex) {
        this.chapterPitPool(otherId).forEach(s => toHide.add(s));
        continue;
      }
      // 当前章坑：仅保留目标坑 + 少量邻近坑，其余隐藏（避免满场可挖=全指引）。
      if (otherId === chapterId) {
        pool.forEach(s => { if (s !== target && !keepNearby.has(s)) toHide.add(s); });
      }
      // 已通关章坑：保留（符合“可含已挖过的其他章字”）。
    }
    toHide.forEach(site => {
      if (site === target || site.storyTarget || site.awaitingStudy) return;
      if (keepNearby.has(site)) return;
      // 拾遗坑（含 supplement 区挂的坑）不隐藏，避免永久消失。
      if (site.reward.kind === 'oracle' && site.reward.cardId && SUPPLEMENT_CARD_IDS.has(site.reward.cardId)) return;
      if (!site.active && !site.revealed) return;
      site.active = false;
      site.revealed = false;
      site.root.active = false;
      this.redrawExcavationSite(site);
    });
    // 点亮少量邻近普通坑（无金圈、不引导），填已解锁章字。
    keepNearby.forEach(site => this.lightFreePit(site));
  }

  // 把某个非剧情坑点亮为可挖，并填入“已解锁章字”（已通关章 ∪ 当前章，绝不含后续章字）。
  private lightFreePit(site: ExcavationSite) {
    if (site.storyTarget || site.awaitingStudy) return;
    if (!site.reward.cardId || site.reward.kind !== 'oracle') {
      const card = this.pickUnlockedStoryCard();
      if (card) {
        site.reward = { kind: 'oracle', quality: card.quality, cardId: card.id, amount: 0, experience: 0, coins: 0, tier: 'story' };
      }
    }
    site.active = true;
    site.revealed = true;
    site.holeTimer = 0;
    site.respawnTimer = 0;
    site.root.active = true;
    this.redrawExcavationSite(site);
  }

  // 从已解锁主线字池挑一个字（优先未收集的新字，无则任意已解锁字作复习），用于自由探索坑填充。
  private pickUnlockedStoryCard(): OracleCardData | null {
    const unlocked = this.getUnlockedStoryCardIds();
    const excavatable = this.oracleCards.filter(card =>
      card.excavatable && this.hasRealOracleGlyph(card) && STORY_CARD_IDS.has(card.id) && unlocked.has(card.id));
    if (!excavatable.length) return null;
    const uncollected = excavatable.filter(card =>
      !this.save.unlockedOracleIds.includes(card.id) && !this.excavationRollingReserved.has(card.id));
    const pool = uncollected.length ? uncollected : excavatable;
    const card = pool[Math.floor(Math.random() * pool.length)] ?? null;
    if (card) this.excavationRollingReserved.add(card.id); // 本帧已占用，邻近坑不再重复抽到它
    return card;
  }

  /**
   * Gives later chapters their own excavation route even when they share a broad
   * terrain type. The position is deterministic from chapter + fragment index,
   * so reloading a save returns the active story pit to the same place.
   */
  private positionStorySiteForChapter(site: ExcavationSite, chapterId: string, fragmentIndex: number) {
    void chapterId;
    void fragmentIndex; // 坑坐标由 reserve 阶段按章确定性分配（跨区域分散），此处只做可通行兜底
    // 本章的字如今散落在地图各处（reserve 时从跨区域坑池中为每个字挑了
    // 一个彼此分开、且经过 resolveExcavationPosition 校验可通行的坑位），
    // 不再把所有字重定位到 zone 中心导致堆叠。这里仅当预生成点意外不可
    // 通行时，在附近找一个可通行点兜底；绝不再按 zone 中心重排，避免重叠
    // 或把字锁死在一小块区域。
    if (this.isExcavationPositionValid(site.x, site.y, site.region, site, 170)) return;
    const safe = this.resolveExcavationPosition(site.x, site.y, site.region, site);
    site.x = safe.x;
    site.y = safe.y;
    site.root.setPosition(site.x, site.y, 21);
    this.redrawExcavationSite(site);
  }

  // 章节剧情坑分配：一~九所有章统一从“全图可通行坑池”分配，挖掘引导
  // 由 routeNarrativeExcavationToMapExit 统一处理（同区直指坑、跨区先指传送点），
  // 与后续章节完全一致。区别仅在取坑偏好：其余章按章名确定性打乱后分散到
  // 各地；第一章优先取离出生点(chapter-1-city-entry=188,20)近的坑，避免新手章
  // 过于分散。挖出的字严格绑定本章 fragmentCards（reserve 时写入 site.reward.cardId），
  // 不会混进他章字。
  private takeChapterPit(chapterId: string, fragmentIndex: number): ExcavationSite | null {
    const pool = this.chapterPitPool(chapterId);
    if (!pool.length) return null;
    return pool[fragmentIndex % pool.length] ?? null;
  }

  /** Maps an excavation pit's storage region to the gameplay RegionId used for navigation. */
  private excavationRegionToMapRegion(region: ExcavationRegion): RegionId {
    switch (region) {
      case 'river': return RegionId.RIVERBANK;
      case 'lake': return RegionId.OUTSKIRTS; // 湖在城南西南方，出南门直行即达，无需 blackout 传送
      case 'field': return RegionId.FIELDS;
      case 'royal': return RegionId.ROYAL_TOMB;
      case 'forest': return RegionId.HIGHLAND;
      case 'trial': return RegionId.OUTSKIRTS;
      default: return RegionId.OUTSKIRTS;
    }
  }

  private chapterPitPool(chapterId: string): ExcavationSite[] {
    const all = this.excavationSites.filter(s => s.region !== 'supplement');
    if (chapterId === CHAPTER_ONE_ID) {
      // 第一章（新手教学）：坑限定在独立的 trial 区域（城内南门广场 + 南门外可达荒地），
      // 避免进入 FIELDS 死区，也避免跨 CITY/OUTSKIRTS 边界横跳。按离出生点(188,20)
      // 的直线距离升序，前几个优先落在城内南门附近，后续逐步向南拉开。
      const ox = 188, oy = 20;
      return all.filter(s => s.region === 'trial')
        .sort((a, b) =>
          ((a.x - ox) * (a.x - ox) + (a.y - oy) * (a.y - oy)) -
          ((b.x - ox) * (b.x - ox) + (b.y - oy) * (b.y - oy)));
    }
    // 其余章：每章锁定自己的专属 region 坑池（与 prepareChapterFreeExploration 一致），
    // 字只在本章区域内散落不同位置，绝不会跨到别的章的区域、也不会散落全图导致跨区死路。
    // 池内按章名确定性 Fisher-Yates 打乱，大章（字数 > 坑数）取模复用坑位均匀分散。
    const regionsForChapter: Record<string, ExcavationRegion[]> = {
      [CHAPTER_TWO_ID]: ['river'],
      [CHAPTER_THREE_ID]: ['royal'],
      [CHAPTER_FOUR_ID]: ['forest'],
      [CHAPTER_FIVE_ID]: ['field'],
      [CHAPTER_SIX_ID]: ['royal'],
      [CHAPTER_SEVEN_ID]: ['forest'],
      [CHAPTER_EIGHT_ID]: ['royal'],
      [CHAPTER_NINE_ID]: ['field'],
    };
    const allowed = regionsForChapter[chapterId];
    if (!allowed || !allowed.length) return all.filter(s => s.region !== 'trial');
    const pool = all.filter(s => allowed.includes(s.region));
    if (!pool.length) return all.filter(s => s.region !== 'trial');
    let s = this.hashString(chapterId) >>> 0 || 1;
    const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const arr = pool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  private hashString(str: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // 五~九章到达判定通用逻辑：与第四章相同，只是 stepId / NPC 坐标 / npcId 参数化。
  private updateStoryChapterArrival(
    reachStepId: string, locationId: string, npcId: string,
  ) {
    const step = this.storyController?.currentStep();
    if (!step || this.storyArrivalLocked) return;
    if (step.id !== reachStepId) return;
    const location = storyLocation(locationId);
    if (!location) {
      console.error('[StoryLocation] NPC arrival location is missing; story event cancelled.', { reachStepId, locationId });
      return;
    }
    const radius = step.objective?.targetRadius ?? 78;
    const dx = this.playerPos.x - location.localPosition.x;
    const dy = this.playerPos.y - location.localPosition.y;
    if (dx * dx + dy * dy > radius * radius) return;
    this.storyArrivalLocked = true;
    this.storyController.handle({ type: 'npc-reached', npcId });
  }

  private updateChapterFiveStory() {
    this.updateStoryChapterArrival('chapter-5-escort-home-reach-npc', 'chapter-5-fields-npc', 'escort-guide');
  }

  private updateChapterSixStory() {
    this.updateStoryChapterArrival('chapter-6-ruins-lamp-reach-npc', 'chapter-6-royal-tomb-npc', 'lamp-keeper');
  }

  private updateChapterSevenStory() {
    this.updateStoryChapterArrival('chapter-7-wrong-scroll-reach-npc', 'chapter-7-highland-npc', 'scroll-keeper');
  }

  private updateChapterEightStory() {
    this.updateStoryChapterArrival('chapter-8-tomb-three-proofs-reach-npc', 'chapter-8-royal-tomb-npc', 'tomb-keeper');
  }

  private updateChapterNineStory() {
    this.updateStoryChapterArrival('chapter-9-renew-covenant-reach-npc', 'chapter-9-city-npc', 'grand-diviner');
  }

  // 九章碎片字表汇总：供挖掘完成 / 学习完成 / 辨识面板等处统一按当前步骤匹配，
  // 免去逐章 ?? 链、加章时不易漏改。
  private get allStoryFragmentCards(): ReadonlyArray<{ seekStepId: string; lessonStepId: string; cardId?: string | null }> {
    return ALL_STORY_FRAGMENT_CARDS;
  }

  private buildWorld() {
    this.node.children.filter(n => n.name !== 'Camera').forEach(n => n.destroy());
    this.obstacles = [];
    this.waterCircles = [];
    this.waterSegments = [];
    this.waterCrossings = [];
    this.sways = [];
    this.wetlandPlants = [];
    this.previousWetlandPlantVariant = -1;
    this.natureDecorVisibleCounts.clear();
    this.ripples = [];
    this.canalFlowMarks = [];
    this.depthTrees = [];
    this.outskirtsNatureEntityNodes = [];
    this.fieldVisualNodes = [];
    this.regionExitMarkerRoots.clear();
    this.regionExitMarkerAnimations = [];
    this.outskirtsNatureObstacleNames.clear();
    this.retiredOutskirtsNatureTreeNames.clear();
    this.depthOccluders = [];
    this.fixedForegroundNodes = [];
    this.storyNpcLabelRoot = null;
    this.storyNpcWorldLabels = [];
    this.southOutskirtsSurfaceNodes = [];
    this.staticCityBoundaryNodes = [];
    this.cityWallVisualRoot = null;
    this.staticStructureSprites = [];
    this.structureFootprintOwners.clear();
    this.wildlife = [];
    this.cropPlants = [];
    this.torchFlames = [];
    this.torchRenderTimer = 0;
    this.villagers = [];
    this.restingVillager = null;
    this.horseCarts = [];
    this.dugHoles = [];
    this.excavationSites = [];
    this.pendingExcavation = null;
    this.excavationLearningStage = 'none';
    this.excavationLearningSite = null;
    this.excavationLearningCard = null;
    this.excavationLearningOptions = [];
    this.excavationWrongChoices = [];
    this.excavationLearningAttempts = 0;
    this.excavationLearningFeedback = null;
    this.excavationLearningResult = '';
    this.rewardFlights = [];
    this.digParticles = [];
    this.toolActionTimer = 0;
    this.statusNotice = '';
    this.statusNoticeTimer = 0;
    this.worldMode = 'outside';
    this.interiorObstacles = [];
    this.templeInterior?.destroy();
    this.templeInterior = null;
    this.templeTableForegroundVisual = null;
    this.southGateForegroundVisual = null;

    this.world = new Node('DynamicWorld');
    this.world.parent = this.node;
    this.world.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);

    this.drawGroundTiles();
    this.drawPixelGroundOverlay();
    this.drawRoads();
    this.drawRiver();
    this.drawHuanLake();
    // Retired continuous-world transition art overlapped the new OUTSKIRTS
    // southwest bounds and registered small legacy tree collisions. Region
    // transitions now own this travel space, so do not instantiate the old map.
this.drawCityWallsAndGate();
    this.drawTemple();
    this.drawVillage();
    this.drawMarket();
    this.drawTownDetails();
    this.withObstacleRegion(RegionId.FIELDS, () => this.drawFields());
    this.drawForest();
    this.drawOraclePit();
    this.drawOutskirtsGroundAndRoads();
    this.createRegionExitMarkers();
    // OUTSKIRTS nature must be created after its tile surface so its parent is
    // above the grass layer while remaining independently region-toggleable.
    this.drawRegionalNatureDecorations();
    this.createExcavationSites();
    this.scatterDynamicGrass();
    this.drawWorldBoundary();
    // OUTSKIRTS west boundary colliders with road gap at Y=384-496 (exit trigger area)
    this.addObstacle(-2020, 1333, 64, 1674, 'OutskirtsWestBoundaryUpper', 'OUTSKIRTS');
    this.addObstacle(-2020, -288, 64, 1344, 'OutskirtsWestBoundaryLower', 'OUTSKIRTS');
    // OUTSKIRTS south boundary colliders with road gap at X=-56..56 (matching road width)
    this.addObstacle(-1038, -980, 1964, 32, 'OutskirtsSouthBoundaryLeft', 'OUTSKIRTS');
    this.addObstacle(1038, -980, 1964, 32, 'OutskirtsSouthBoundaryRight', 'OUTSKIRTS');
    // HIGHLAND boundary colliders are region-scoped.  The west band follows the
    // inside face of the visible wall and seals every segment, including ends.
    this.addObstacle(4350, -400, 2700, 64, 'HighlandNorthBoundary', RegionId.HIGHLAND);
    this.addObstacle(4350, -2200, 2700, 64, 'HighlandSouthBoundary', RegionId.HIGHLAND);
    this.addObstacle(3060, -1300, 32, 1760, 'HighlandWestWallInteriorBoundary', RegionId.HIGHLAND);
    // OUTSKIRTS north boundary colliders with road gap at X=-56..56
    this.addObstacle(-1038, 2165, 1964, 32, 'OutskirtsNorthBoundaryLeft', 'OUTSKIRTS');
    this.addObstacle(1038, 2165, 1964, 32, 'OutskirtsNorthBoundaryRight', 'OUTSKIRTS');
    // OUTSKIRTS east boundary colliders with road gap at Y=384..496 (east exit)
    this.addObstacle(2020, 1333, 64, 1674, 'OutskirtsEastBoundaryUpper', 'OUTSKIRTS');
    this.addObstacle(2020, -288, 64, 1344, 'OutskirtsEastBoundaryLower', 'OUTSKIRTS');
    // ROYAL_TOMB boundary colliders — north sealed, south at Y=-4100 with 112-px road gap (X=2234..2346)
    this.addObstacle(2900, -2484, 4600, 32, 'TombNorthBoundary');
    // South left wall: from tomb west edge (600) to road gap start
    this.addObstacle(1417, -4100, 1634, 32, 'TombSouthBoundaryLeft');
    // South right wall: from road gap end to tomb east edge (5200)
    this.addObstacle(3773, -4100, 2854, 32, 'TombSouthBoundaryRight');
    this.addObstacle(600, -3275, 32, 1650, 'TombWestBoundary');
    this.addObstacle(5200, -3275, 32, 1650, 'TombEastBoundary');
    this.auditStaticStructureFootprints();
    this.runSouthGateCollisionChecks();
    this.createWeatherOverlay();
    this.createTempleInterior();
    this.player = this.createAnimatedPlayer();
    this.player.setPosition(this.playerPos.x, this.playerPos.y, 80);
    this.createVillagers();
    // Field-only ambient actors remain implemented but stay out of the
    // temporary south OUTSKIRTS strip.
    this.stabilizeMainMapRenderOrder();
    this.drawOutdoorCollisionDebug();
    // UI renderers respect sibling order; keep fixed alpha-only foreground
    // pieces above actors after creating the player.
    this.fixedForegroundNodes.forEach(node => {
      if (node.isValid) node.setSiblingIndex(this.world.children.length - 1);
    });
    this.drawHud();
    this.equipTool(this.equippedTool);
    this.setWeather(this.pickRandomWeather(), true);
    this.updateOutskirtsVisibility();
    this.followCamera(1);
  }

  private drawGroundTiles() {
    const g = this.graphics('GroundTiles', this.world, 0);
    const halfW = this.mapWidth / 2;
    const halfH = this.mapHeight / 2;
    // Large procedural color fields keep the expanded world lightweight. Pixel
    // texture chunks and local props provide the close-up variation.
    g.fillColor = new Color(98, 148, 73); g.rect(-halfW, -halfH, this.mapWidth, this.mapHeight); g.fill();
    // CITY uses the same earth base across its complete authored bounds; the
    // fine overlay below supplies the visible pixel detail.
    g.fillColor = new Color(205, 169, 104);
    g.rect(this.cityBoundary.left, this.cityBoundary.bottom,
      this.cityBoundary.right - this.cityBoundary.left, this.cityBoundary.top - this.cityBoundary.bottom);
    g.fill();
    g.fillColor = new Color(110, 158, 85); g.rect(this.riverRegion.left, this.riverRegion.bottom, this.riverRegion.right - this.riverRegion.left, this.riverRegion.top - this.riverRegion.bottom); g.fill();
    g.fillColor = new Color(176, 143, 81); g.rect(this.fieldRegion.left, this.fieldRegion.bottom, this.fieldRegion.right - this.fieldRegion.left, this.fieldRegion.top - this.fieldRegion.bottom); g.fill();
    g.fillColor = new Color(128, 137, 74); g.rect(3000, -2200, 800, 1800); g.fill();
    g.fillColor = new Color(119, 121, 66); g.rect(3800, -2200, 900, 1800); g.fill();
    g.fillColor = new Color(145, 126, 70); g.rect(4700, -2200, 1000, 1800); g.fill();
    // The tomb keeps the shared earth/grass base beneath its authored ground
    // tiles.  Do not paint a region-sized brown panel here: it obscures the
    // yellow soil texture and reads as a walkable rectangular platform.

    // Broad, deterministic mottling replaces tens of thousands of 48 px draw calls.
    let seed = 18471;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 260; i++) {
      const x = -halfW + random() * this.mapWidth;
      const y = -4200 + random() * 5600;
      g.fillColor = i % 3 === 0 ? new Color(72, 118, 62, 45) : new Color(214, 181, 108, 32);
      g.rect(x, y, 28 + random() * 80, 18 + random() * 50); g.fill();
    }
  }

  /**
   * The base color grid guarantees an immediate frame while these shared pixel
   * textures stream from the resources bundle.  The overlay is deliberately
   * chunked (instead of creating thousands of tiny sprites) to keep batching and
   * mobile performance predictable.
   */
  /**
   * CITY and this south OUTSKIRTS strip are one continuous world. The late
   * compatibility layer masks the old river/field composition without moving
   * or deleting its source data, then restores one existing-style road.
   */
  private drawSouthOutskirtsTrial() {
    const bounds = this.southOutskirtsTrial;
    const ground = this.graphics('SouthOutskirtsTrialGround', this.world, 60);
    this.southOutskirtsSurfaceNodes.push(ground.node);
    ground.fillColor = new Color(98, 148, 73);
    ground.rect(bounds.left, bounds.bottom, bounds.right - bounds.left, bounds.top - bounds.bottom);
    ground.fill();

    for (let y = bounds.bottom + 96; y < bounds.top; y += 192) {
      for (let x = bounds.left + 96; x < bounds.right; x += 192) {
        const tile = this.pixelSprite('SouthOutskirtsGroundTile', 'grass-tile', this.world, x, y, 200, 200, 61);
        this.southOutskirtsSurfaceNodes.push(tile);
        tile.getComponent(Sprite)!.color = new Color(235, 245, 225, 224);
      }
    }

    const road = this.graphics('SouthOutskirtsMainRoad', this.world, 62);
    this.southOutskirtsSurfaceNodes.push(road.node);
    road.fillColor = new Color(177, 139, 78);
    road.rect(-56, bounds.bottom, 112, bounds.top - bounds.bottom);
    road.fill();
    road.strokeColor = new Color(122, 99, 59, 170);
    road.lineWidth = 3;
    road.moveTo(-56, bounds.bottom); road.lineTo(-56, bounds.top);
    road.moveTo(56, bounds.bottom); road.lineTo(56, bounds.top);
    road.stroke();
    for (let y = -910; y <= -310; y += 100) {
      const tile = this.pixelSprite('SouthOutskirtsRoadTile', 'road-straight', this.world, 0, y, 112, 112, 63);
      this.southOutskirtsSurfaceNodes.push(tile);
    }

    // Keep the real south gate and its plinths, but remove old wilderness
    // collision below them inside this temporary strip.
    this.obstacles = this.obstacles.filter(obstacle => obstacle.name === '古树根部基座'
      || obstacle.y >= -330
      || obstacle.x + obstacle.w / 2 <= bounds.left
      || obstacle.x - obstacle.w / 2 >= bounds.right
      || obstacle.y + obstacle.h / 2 <= bounds.bottom);
    const roadHalfWidth = 56;
    const leftBoundaryWidth = -roadHalfWidth - bounds.left;
    this.addObstacle(bounds.left + leftBoundaryWidth / 2, bounds.bottom + 16, leftBoundaryWidth, 32,
      'SouthOutskirtsTrialBoundaryLeft');
    // The former SouthOutskirtsTrialBoundaryRight was an unpainted duplicate
    // of the southern world edge.  At (627, -944) it became a standalone
    // airwall in open grass, so it is intentionally not registered.
    this.addObstacle(bounds.left + 16, (bounds.bottom - 330) / 2, 32, -330 - bounds.bottom, 'SouthOutskirtsTrialLeftBoundary');
    this.addObstacle(bounds.right - 16, (bounds.bottom - 330) / 2, 32, -330 - bounds.bottom, 'SouthOutskirtsTrialRightBoundary');

    if ((game.config?.debugMode ?? DebugMode.NONE) !== DebugMode.NONE) {
      const debug = this.graphics('SouthOutskirtsTrialBoundaryDebug', this.world, 150);
      debug.strokeColor = new Color(255, 90, 80, 220);
      debug.lineWidth = 4;
      debug.moveTo(bounds.left, bounds.bottom + 32);
      debug.lineTo(-roadHalfWidth, bounds.bottom + 32);
      debug.moveTo(bounds.left + 32, bounds.bottom); debug.lineTo(bounds.left + 32, -330);
      debug.moveTo(bounds.right - 32, bounds.bottom); debug.lineTo(bounds.right - 32, -330);
      debug.stroke();
    }
  }

  /**
   * Draw OUTSKIRTS ring around CITY: ground fill + four roads.
   * South arm already existed; now extended to full ring.
   */
  private drawOutskirtsGroundAndRoads() {
    const o = { left: -2020, right: 2020, bottom: -960, top: 2170 };
    const city = { left: -1300, right: 1300, bottom: -240, top: 1450 };
    const roadW = 112;
    const halfW = roadW / 2;

    // Ground fill for the four arms (Graphics, low z)
    const ground = this.graphics('OutskirtsGround', this.world, 60);
    this.outskirtsGroundNode = ground.node;
    ground.fillColor = new Color(98, 148, 73);

    // South arm
    ground.rect(o.left, o.bottom, o.right - o.left, city.bottom - o.bottom);
    // North arm
    ground.rect(o.left, city.top, o.right - o.left, o.top - city.top);
    // West arm
    ground.rect(o.left, o.bottom, city.left - o.left, o.top - o.bottom);
    // East arm
    ground.rect(city.right, o.bottom, o.right - city.right, o.top - o.bottom);
    ground.fill();

    this.outskirtsTileContainer = new Node('OutskirtsTileContainer');
    this.outskirtsTileContainer.parent = this.world;
    this.outskirtsTileContainer.setPosition(0, 0, 0);
    this.outskirtsTileContainer.addComponent(UITransform).setContentSize(o.right - o.left, o.top - o.bottom);

    // Grass tiles overlay (same pattern as south trial)
    const tileStep = 192;
    const tileSize = 200;
    for (let y = o.bottom + 96; y < o.top + tileStep; y += tileStep) {
      for (let x = o.left + 96; x < o.right + tileStep; x += tileStep) {
        // Only draw in the four arms (outside city rect)
        if (x > city.left && x < city.right && y > city.bottom && y < city.top) continue;
        const tile = this.pixelSprite('OutskirtsGroundTile', 'grass-tile', this.outskirtsTileContainer, x, y, tileSize, tileSize, 61);
        tile.getComponent(Sprite)!.color = new Color(235, 245, 225, 224);
      }
    }

    // Fill bare Y:1450~1532 north of city wall where main loop skipped at y=1440
    for (let x = city.left + 96; x < city.right; x += tileStep) {
      const tile = this.pixelSprite('OutskirtsNorthGapGrass', 'grass-tile', this.outskirtsTileContainer, x, 1490, tileSize, tileSize, 61);
      tile.getComponent(Sprite)!.color = new Color(235, 245, 225, 224);
    }

    // The raw OutskirtsGround fill was exposed at the extreme northwest tile
    // seam because the normal loop starts one half-step inward.  Cover that
    // exact seam with the same opaque grass tile rather than a color block.
    const northWestSeam = this.pixelSprite('OutskirtsNorthWestGrassSeam', 'grass-tile', this.outskirtsTileContainer, -1972, 2032, tileSize + 8, tileSize + 8, 63);
    northWestSeam.getComponent(Sprite)!.color = new Color(255, 255, 255, 255);
    // The legacy green Graphics patch occupies the extreme northwest corner
    // outside the regular tile loop.  This intentionally overlaps it on all
    // sides with the identical grass texture; it has no collision.
    const northWestGreenBlockCover = this.pixelSprite('OutskirtsNorthWestGreenBlockCover', 'grass-tile', this.outskirtsTileContainer, -2020, 2110, 256, 256, 64);
    northWestGreenBlockCover.getComponent(Sprite)!.color = new Color(255, 255, 255, 255);

    // This strip was formerly adjacent to the retired south-trial map.  Make
    // the active OUTSKIRTS tile layer the last visual owner of it so no old
    // world content can show through at the west/lower camera edge.  It is
    // deliberately visual-only: the current region boundary owns collision.
    const westLowerCleanup = new Node('OutskirtsWestLowerGrassCleanup');
    westLowerCleanup.parent = this.outskirtsTileContainer;
    for (let y = -864; y <= -288; y += tileStep) {
      for (let x = -1924; x <= -1348; x += tileStep) {
        const tile = this.pixelSprite('OutskirtsWestLowerGrassTile', 'grass-tile', westLowerCleanup, x, y, tileSize, tileSize, 62);
        tile.getComponent(Sprite)!.color = new Color(235, 245, 225, 224);
      }
    }

    // Four roads using road-straight sprites (matching city TownStreetTile: 92x112, rotated 90°, z=4, 100px spacing)
    const townRoadW = 92;
    const townRoadH = 112;
    const townRoadZ = 4;
    const townSpacing = 100;

    // South road: X=0, from city.bottom down to o.bottom. These matching
    // tiles overlap both existing runs through the south-gate threshold so
    // the grass-arm overlay cannot leave a visible seam at the stairs.
    [-250, -150].forEach((y, index) =>
      this.pixelSprite(`SouthGateRoadConnector${index}`, 'road-straight', this.world, 0, y, roadW, roadW, 63));
    for (let y = city.bottom - halfW; y >= o.bottom + halfW; y -= townSpacing) {
      this.pixelSprite('OutskirtsRoadSouth', 'road-straight', this.world, 0, y, roadW, roadW, 63);
    }

    // North road: X=0, from city.top up to o.top
    for (let y = city.top + halfW; y <= o.top - halfW; y += townSpacing) {
      this.pixelSprite('OutskirtsRoadNorth', 'road-straight', this.world, 0, y, roadW, roadW, 63);
    }

    // West road: Y = cityEastWestRoadCenterY (440), from city's last tile (-1220) left to o.left
    // Match TownStreetTile: 92x112, rotated 90°, z=4, spacing 100px
    // Continue until tile's left edge reaches o.left (-2020)
    for (let x = -1220; x - townRoadW / 2 >= o.left; x -= townSpacing) {
      const tile = this.pixelSprite('OutskirtsRoadWest', 'road-straight', this.world, x, this.cityEastWestRoadCenterY, townRoadW, townRoadH, townRoadZ);
      tile.setRotationFromEuler(0, 0, 90);
    }

    // East road: horizontal at cityEastWestRoadCenterY, from city's last tile (1220) right to o.right
    // 112x112 rotated 90 degrees gives full passage coverage (matches gate gap / boundary gap)
    const eastRoadW = roadW; // 112
    for (let x = 1220; x <= o.right; x += townSpacing) {
      const tile = this.pixelSprite('OutskirtsRoadEast', 'road-straight', this.world, x, this.cityEastWestRoadCenterY, eastRoadW, eastRoadW, townRoadZ);
      tile.setRotationFromEuler(0, 0, 90);
    }
  }

  private drawPixelGroundOverlay() {
    // 192px source tiles preserve the existing pixel-art density without the
    // coarse 384px floor grid that was visible in the playable regions.
    const chunk = 192;
    const halfW = this.mapWidth / 2;
    for (let y = -4200 + chunk / 2; y < 2200; y += chunk) {
      for (let x = -halfW + chunk / 2; x < halfW; x += chunk) {
        // Classify by overlap rather than centre so a grass tile never bleeds
        // through the authored earth regions at their edges.
        const overlaps = (region: { left: number; right: number; bottom: number; top: number }) => x + chunk / 2 > region.left
          && x - chunk / 2 < region.right
          && y + chunk / 2 > region.bottom
          && y - chunk / 2 < region.top;
        const insideCity = overlaps(this.cityBoundary);
        const insideField = overlaps(this.fieldRegion);
        const insideTomb = overlaps(this.tombRegion);
        const node = this.pixelSprite(
          insideCity || insideField || insideTomb ? 'EarthGroundTile' : 'WildGrassTile',
          insideCity || insideField || insideTomb ? 'earth-tile' : 'grass-tile',
          this.world,
          x,
          y,
          chunk + 2,
          chunk + 2,
          1,
        );
        const sprite = node.getComponent(Sprite)!;
        if (this.inRegion(x, y, this.mountainRegion)) sprite.color = new Color(213, 205, 155, 218);
        else if (insideTomb) sprite.color = new Color(206, 181, 139, 218);
        else if (insideField) sprite.color = new Color(244, 226, 176, 222);
        else sprite.color = new Color(255, 255, 255, 224);
      }
    }
  }

  private drawRoads() {
    const g = this.graphics('RoadLayer', this.world, 2);
    g.fillColor = new Color(177, 139, 78);
    g.rect(-56, -760, 112, 520); g.fill();
    g.rect(-56, -240, 112, 1140); g.fill();
    g.rect(-639, -20, 78, 1120); g.fill();
    g.rect(561, -20, 78, 1120); g.fill();
    [60, 440, 820].forEach(y => { g.rect(-1260, y - 46, 2520, 92); g.fill(); });

    // Subtle stone-and-grass edges keep the streets readable without making
    // the city look like a rigid modern grid.
    g.strokeColor = new Color(122, 99, 59, 170);
    g.lineWidth = 3;
    [-56, 56, -639, -561, 561, 639].forEach(x => { g.moveTo(x, -235); g.lineTo(x, 1110); });
    [14, 106, 394, 486, 774, 866].forEach(y => { g.moveTo(-1260, y); g.lineTo(1260, y); });
    g.stroke();

    for (let y = -710; y <= 900; y += 100) {
      this.pixelSprite('MainRoadTile', 'road-straight', this.world, 0, y, 112, 112, 4);
    }
    [-600, 600].forEach(x => {
      for (let y = 20; y <= 1120; y += 100) {
        this.pixelSprite('SideRoadTile', 'road-straight', this.world, x, y, 92, 112, 4);
      }
    });
    [60, 440, 820].forEach(y => {
      for (let x = -1220; x <= 1220; x += 100) {
        const tile = this.pixelSprite('TownStreetTile', 'road-straight', this.world, x, y, 92, 112, 4);
        tile.setRotationFromEuler(0, 0, 90);
      }
      [-600, 0, 600].forEach(x => this.pixelSprite('RoadCrossing', 'road-cross', this.world, x, y, 108, 108, 5));
    });
  }

  private drawRiver() {
    const riverPoints = this.riverbankPhaseOneRiverPoints;

    // This is a single authored river illustration: water, shallows, stone
    // mud lip and grass banks belong to the same continuous image.  Keeping
    // it as one sprite avoids the former concentric colour-band look and any
    // visible seam from separately repeated riverbank props.
    this.pixelSprite(
      'HuanRiverContinuousArt', 'huan-river-continuous-v1',
      // Keep river art beneath existing roads, bridges and map props.  It is
      // an environment layer, not an overlay over the rest of the map.
      this.world, -5100, -2000, 2200, 2200, 3,
    );

    for (let i = 0; i < riverPoints.length - 1; i++) {
      // The four broad capsules nearest the bridge used a fixed 150 px radius:
      // the south half covered visible grass while the north half stopped
      // inside the shallows.  Replace only that local span with the sampled
      // shoreline band below.
      if (i >= 2 && i <= 5) continue;
      const a = riverPoints[i]; const b = riverPoints[i + 1];
      this.waterSegments.push({
        ax: a[0], ay: a[1], bx: b[0], by: b[1],
        // Only the blue channel is blocked.  Its banks are walkable and the
        // bridge crossing below carves out the sole pass through the water.
        radius: 150,
        name: 'RiverbankPhaseOneDeepWater',
      });
    }
    this.drawRiverbankPhaseOneRoadAndBridge();
    this.drawRiverbankPhaseOneBoundary();
    this.drawRiverbankNorthShoreCollision();
    this.worldLabel('洹水河畔', -5470, -430, 25, new Color(226, 242, 206));
  }

  private drawRiverbankPhaseOneRoadAndBridge() {
    // Match the accepted OUTSKIRTS road exactly: the same SpriteFrame, 112 px
    // authored width and 100 px cadence. No late Graphics soil strip remains.
    for (let y = -300, index = 0; y >= -1300; y -= 100, index++) {
      this.pixelSprite(
        `RiverbankNorthRoadTile${index}`, 'road-straight',
        this.world, -4900, y, 112, 112, 12,
      );
    }
    const { x: bridgeX, y: bridgeY, w: bridgeWalkWidth, h: bridgeHeight } = this.riverbankPhaseOneBridge;
    // This asset is the only audited bridge PNG with a transparent background
    // and no baked grass/stone abutments.
    this.pixelSprite(
      'RiverbankNorthPureWoodBridge', 'canal-footbridge-v2',
      this.world, bridgeX, bridgeY, 135, bridgeHeight, 15,
    );
    // The old water exemption ended exactly at the sprite's south edge
    // (y=-1470).  The deep-water segment is still active there, so the next
    // southward step hit an invisible wall before the player's feet reached
    // grass.  Keep one collision-only passage from the deck through the whole
    // south landing.  Its effective player-centre width is 60 px after
    // pointInWater() applies its inset, exactly matching the corridor between
    // the two rail colliders; water immediately beside the bridge stays solid.
    const deckNorth = bridgeY + bridgeHeight / 2;
    const southLandingBottom = bridgeY - bridgeHeight / 2 - 200;
    this.waterCrossings.push({
      x: bridgeX,
      y: (deckNorth + southLandingBottom) / 2,
      w: bridgeWalkWidth - this.playerRadius * 2,
      h: deckNorth - southLandingBottom,
      name: 'RiverbankNorthPureWoodBridgeDeck',
    });
    // The art has longer timber tails so it reaches both grassy banks.  The
    // physical rails stop at the actual water span; otherwise their invisible
    // collision extended onto the landing and trapped the player beside it.
    // Player-center corridor = rail inner edge - player radius - 3 px safety.
    const railCollisionHeight = Math.min(bridgeHeight - 24, 390);
    const railOffset = 51 - 3;
    this.addObstacle(bridgeX - railOffset, bridgeY, 18, railCollisionHeight, 'RiverbankNorthBridgeWestRail', RegionId.RIVERBANK);
    this.addObstacle(bridgeX + railOffset, bridgeY, 18, railCollisionHeight, 'RiverbankNorthBridgeEastRail', RegionId.RIVERBANK);
  }

  private drawRiverbankPhaseOneBoundary() {
    const bounds = this.riverRegion;
    const highland = this.riverbankNorthHighland;
    const sideThickness = 64;
    this.addObstacle(
      bounds.left + sideThickness / 2, (bounds.bottom + bounds.top) / 2,
      sideThickness, bounds.top - bounds.bottom, 'RiverbankPhaseOneWestBoundary',
    );
    this.addObstacle(
      bounds.right - sideThickness / 2, (bounds.bottom + bounds.top) / 2,
      sideThickness, bounds.top - bounds.bottom, 'RiverbankPhaseOneEastBoundary',
    );
    this.addObstacle(
      (bounds.left + bounds.right) / 2, bounds.bottom + sideThickness / 2,
      bounds.right - bounds.left, sideThickness, 'RiverbankPhaseOneSouthBoundary',
    );
    this.addObstacle(
      (bounds.left + bounds.right) / 2, highland.north - 12,
      bounds.right - bounds.left, 24, 'RiverbankNorthMapBoundary',
    );

    this.drawRiverbankNorthHighlandEntrance();
  }

  private drawRiverbankNorthShoreCollision() {
    const points = this.riverbankNorthShorePoints;
    const bridge = this.riverbankPhaseOneBridge;

    // Bridge walkway corridor. The rails define the left/right walls, but they
    // only cover the real water span.  We extend the corridor all the way to
    // the north road end and the south landing so the player can step on and
    // off the bridge without hitting the bank barrier at the bridge seams.
    const railOffset = 48; // 51 - 3 (matches bridge rail placement)
    const westRailX = bridge.x - railOffset;
    const eastRailX = bridge.x + railOffset;
    const corridorLeft = westRailX + this.playerRadius;
    const corridorRight = eastRailX - this.playerRadius;
    const corridorTop = bridge.y + bridge.h / 2 + 56;       // reach the north road end (y≈-1335)
    const corridorBottom = bridge.y - bridge.h / 2 - 200;   // reach the south landing

    // Keep obstacles short and heavily overlapping so they hug every bend
    // without leaving walkable gaps between consecutive boxes.
    const shoreThickness = 60;
    const segmentLength = 24;
    const overlap = 24;

    const bridgeOpeningRect = {
      left: corridorLeft,
      right: corridorRight,
      bottom: corridorBottom,
      top: corridorTop,
    };

    // Track generated obstacles in order so we can post-process gaps.
    const generated: Array<{
      name: string; x: number; y: number; w: number; h: number;
      left: number; right: number; bottom: number; top: number;
    }> = [];

    this.withObstacleRegion(RegionId.RIVERBANK, () => {
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const length = Math.hypot(dx, dy);
        if (length < 1) continue;

        // Left-hand normal points toward land when the polyline runs
        // east-then-south along the north bank (clockwise winding).
        const landNormalX = -dy / length;
        const landNormalY = dx / length;
        const LANDWARD_OFFSET = 150;

        const steps = Math.max(1, Math.ceil(length / segmentLength));
        for (let s = 0; s < steps; s++) {
          const t0 = s / steps;
          const t1 = Math.min(1, (s + 1) / steps + overlap / length);
          const segStartX = a[0] + dx * t0;
          const segStartY = a[1] + dy * t0;
          const segEndX = a[0] + dx * t1;
          const segEndY = a[1] + dy * t1;
          const segCenterX = (segStartX + segEndX) / 2;
          const segCenterY = (segStartY + segEndY) / 2;
          const segLen = Math.hypot(segEndX - segStartX, segEndY - segStartY);

          // Obstacle offset toward land so the player can stand on the
          // stones/mud at the bank edge but cannot step into water.
          const obstacleX = segCenterX + landNormalX * LANDWARD_OFFSET;
          const obstacleY = segCenterY + landNormalY * LANDWARD_OFFSET;

          // Compute the axis-aligned bounds of this segment's obstacle so
          // we can detect an honest intersection with the bridge corridor
          // rather than skipping by a crude index-based zone test.
          const boxLen = segLen + overlap;
          const halfLen = boxLen / 2;
          const halfThick = shoreThickness / 2;
          const obstacleLeft = obstacleX - halfLen;
          const obstacleRight = obstacleX + halfLen;
          const obstacleBottom = obstacleY - halfThick;
          const obstacleTop = obstacleY + halfThick;

          // Only segments that genuinely overlap the bridge walkway are
          // removed.  The rails themselves provide the side walls, so any
          // segment outside the rail corridor remains intact and blocks
          // diagonal shortcuts into the river.
          const overlapsBridgeOpening =
            obstacleLeft < bridgeOpeningRect.right
            && obstacleRight > bridgeOpeningRect.left
            && obstacleBottom < bridgeOpeningRect.top
            && obstacleTop > bridgeOpeningRect.bottom;

          if (overlapsBridgeOpening) { continue; }

          const obstacleName = `RiverbankNorthShoreCollision${i}_${s}`;
          this.addObstacle(
            obstacleX, obstacleY,
            boxLen, shoreThickness,
            obstacleName,
            RegionId.RIVERBANK
          );
          generated.push({
            name: obstacleName, x: obstacleX, y: obstacleY,
            w: boxLen, h: shoreThickness,
            left: obstacleLeft, right: obstacleRight,
            bottom: obstacleBottom, top: obstacleTop,
          });
        }
      }

      // Auto gap-filling: ensure every pair of consecutive obstacles has
      // overlapping AABBs.  If two neighbours don't touch along their
      // chain-direction axis, insert one or more filler boxes between them.
      const chainDirLen = segmentLength + overlap;
      for (let g = 1; g < generated.length; g++) {
        const prev = generated[g - 1];
        const curr = generated[g];

        // Signed gap along the chain (x axis of the AABB is the primary
        // axis for chain-walking gaps).  Allow a small negative overlap
        // tolerance so boxes that already touch pass through.
        const gapRight = prev.right;
        const gapLeft = curr.left;
        const gapX = gapLeft - gapRight;
        const gapTop = Math.min(prev.top, curr.top);
        const gapBottom = Math.max(prev.bottom, curr.bottom);
        const gapYOverlap = gapTop > gapBottom; // boxes already overlap in Y

        // Also check if the two boxes are disjoint in the y-axis (one
        // sits entirely above the other, e.g. at a sharp bend).  In
        // that case we also need filler to cover the y-axis gap.
        const yGapTop = Math.min(prev.top, curr.top);
        const yGapBottom = Math.max(prev.bottom, curr.bottom);
        const yGapSize = yGapBottom - yGapTop; // positive means boxes don't overlap in Y

        const needXFiller = gapX > 0;
        const needYFiller = yGapSize > 0 && !gapYOverlap && gapX <= 0;

        if (!needXFiller && !needYFiller) continue;

        // Insert filler boxes spaced by chainDirLen so the chain stays
        // continuous across joints and bends.
        const insertCount = Math.max(1, Math.ceil(Math.max(gapX, yGapSize) / chainDirLen));
        for (let k = 1; k <= insertCount; k++) {
          const t = k / (insertCount + 1);
          const fillX = prev.x + (curr.x - prev.x) * t;
          const fillY = prev.y + (curr.y - prev.y) * t;
          const fillLeft = fillX - chainDirLen / 2;
          const fillRight = fillX + chainDirLen / 2;
          const fillBottom = fillY - shoreThickness / 2;
          const fillTop = fillY + shoreThickness / 2;

          // Skip filler that would land in the bridge opening.
          const fillerOverlapsBridge =
            fillLeft < bridgeOpeningRect.right
            && fillRight > bridgeOpeningRect.left
            && fillBottom < bridgeOpeningRect.top
            && fillTop > bridgeOpeningRect.bottom;
          if (fillerOverlapsBridge) continue;

          const fillerName = `RiverbankNorthShoreGapFill${g - 1}_${k}`;
          this.addObstacle(
            fillX, fillY,
            chainDirLen, shoreThickness,
            fillerName,
            RegionId.RIVERBANK
          );
          generated.splice(g, 0, {
            name: fillerName, x: fillX, y: fillY,
            w: chainDirLen, h: shoreThickness,
            left: fillLeft, right: fillRight,
            bottom: fillBottom, top: fillTop,
          });
          g++;
        }
      }
    });
  }

  private drawRiverbankNorthHighlandEntrance() {
    const highland = this.riverbankNorthHighland;
    // The north return route is now a continuous grass road. The former
    // plateau, rock-wall pieces and stone stair are intentionally omitted.
    for (let y = -200, index = 0; y <= highland.north; y += 100, index++) {
      this.pixelSprite(
        `RiverbankNorthReturnRoadTile${index}`, 'road-straight',
        this.world, highland.spawnX, y, 112, 112, 12,
      );
    }
    return;

    this.world.getChildByName('RiverbankNorthHighlandBoundary')?.destroy();
    const root = new Node('RiverbankNorthHighlandEntranceRoot');
    root.parent = this.world;
    root.setPosition(0, 0, 0);
    root.addComponent(UITransform).setContentSize(
      this.riverRegion.right - this.riverRegion.left,
      highland.north - highland.cliffTop,
    );

    // The upper shelf is a full highland space, not a thin strip behind a wall.
    // It extends for more than one 720 px viewport before reaching the cliff.
    let plateauIndex = 0;
    for (let y = -150; y <= 850; y += 200) {
      for (let x = -5900; x <= -3900; x += 200) {
        this.pixelSprite(
          `RiverbankNorthPlateauGround${plateauIndex++}`, 'grass-tile',
          root, x, y, 202, 202, 11,
        );
      }
    }

    for (let y = -200, index = 0; y <= 800; y += 100, index++) {
      this.pixelSprite(
        `RiverbankNorthPlateauRoadTile${index}`, 'road-straight',
        root, highland.spawnX, y, 112, 112, 12,
      );
    }

    const cliffY = (highland.cliffTop + highland.cliffBottom) / 2;
    const cliffParts: Array<[string, string, number, number]> = [
      ['RiverbankNorthCliffInnerLeft', 'highland_cliff_inner_left', -6009, 222],
      ['RiverbankNorthCliffStraightLeft0', 'highland_cliff_straight', -5730, 352],
      ['RiverbankNorthCliffStraightLeft1', 'highland_cliff_straight', -5387, 352],
      ['RiverbankNorthCliffRoadEndLeft', 'highland_cliff_road_end_left', -5085.5, 267],
      ['RiverbankNorthCliffRoadEndRight', 'highland_cliff_road_end_right', -4687, 322],
      ['RiverbankNorthCliffStraightRight0', 'highland_cliff_straight', -4358, 352],
      ['RiverbankNorthCliffStraightRight1', 'highland_cliff_straight', -4015, 352],
      ['RiverbankNorthCliffInnerRight', 'highland_cliff_inner_right', -3695, 306],
    ];
    cliffParts.forEach(([name, asset, x, width]) => {
      this.pixelSprite(name, asset, root, x, cliffY, width, 128, 13);
    });
    // Reuse the existing front-facing stone threshold as a prototype stair.
    // Its painted stair body is offset 28 px inside the source frame, hence
    // the compensated node X keeps the visible steps centered on -4900.
    this.pixelSprite(
      'RiverbankNorthCliffStoneStairs', 'south-gate-threshold-v2',
      root, highland.spawnX - 28, cliffY, 168, 150, 14,
    );
    const cliffForegroundLeft = this.pixelSprite(
      'RiverbankNorthCliffForegroundLeft', 'highland_cliff_road_end_left',
      this.world, -5085.5, cliffY, 267, 128, 96,
    );
    const cliffForegroundRight = this.pixelSprite(
      'RiverbankNorthCliffForegroundRight', 'highland_cliff_road_end_right',
      this.world, -4687, cliffY, 322, 128, 96,
    );
    this.fixedForegroundNodes.push(cliffForegroundLeft, cliffForegroundRight);

    const shrubs: Array<[number, number, string, number, number]> = [
      [-5860, 720, 'jujube-bush', 64, 60],
      [-5650, 545, 'roadside-grass-clump', 55, 38],
      [-5490, 270, 'grass-clump', 50, 52],
      [-5280, 685, 'jujube-bush', 62, 58],
      [-5100, 310, 'grass-clump', 48, 50],
      [-4680, 735, 'grass-clump', 48, 50],
      [-4490, 540, 'jujube-bush', 62, 58],
      [-4300, 260, 'roadside-grass-clump', 55, 38],
      [-4110, 700, 'grass-clump', 50, 52],
      [-3890, 430, 'jujube-bush', 62, 58],
      [-5780, 70, 'roadside-grass-clump', 55, 38],
      [-4200, 30, 'grass-clump', 50, 52],
    ];
    shrubs.forEach(([x, y, asset, w, h], index) => {
      this.pixelSprite(`RiverbankNorthPlateauShrub${index}`, asset, root, x, y, w, h, 16);
      if (asset === 'jujube-bush') this.addObstacle(x, y - 3, w, h - 8, `RiverbankNorthPlateauShrub${index}Solid`, RegionId.RIVERBANK);
    });

    const trees: Array<[number, number, number]> = [
      [-5800, 665, .68], [-5570, 495, .64], [-5350, 730, .70],
      [-5180, 355, .66], [-5670, 120, .65],
      [-4630, 670, .66], [-4440, 470, .70], [-4210, 735, .63],
      [-4040, 315, .67], [-4330, 95, .68],
    ];
    trees.forEach(([x, y, scale], index) => {
      this.createTreeSized(
        x, y, 900 + index, Math.max(1.25, scale),
        `RiverbankNorthPlateauTreeTrunk${index}`,
        RegionId.RIVERBANK,
      );
    });

    if ((game.config?.debugMode ?? DebugMode.NONE) !== DebugMode.NONE) {
      const debug = this.graphics('RiverbankNorthHighlandEntranceDebug', this.world, 169);
      debug.lineWidth = 3;
      debug.strokeColor = new Color(105, 255, 125, 235);
      debug.rect(
        this.riverbankElevationTransition.upperBounds.left,
        this.riverbankElevationTransition.upperBounds.bottom,
        this.riverbankElevationTransition.upperBounds.right
          - this.riverbankElevationTransition.upperBounds.left,
        this.riverbankElevationTransition.upperBounds.top
          - this.riverbankElevationTransition.upperBounds.bottom,
      );
      debug.stroke();
      debug.strokeColor = new Color(90, 155, 255, 220);
      debug.rect(
        this.riverbankElevationTransition.lowerBounds.left,
        this.riverbankElevationTransition.lowerBounds.bottom,
        this.riverbankElevationTransition.lowerBounds.right
          - this.riverbankElevationTransition.lowerBounds.left,
        this.riverbankElevationTransition.lowerBounds.top
          - this.riverbankElevationTransition.lowerBounds.bottom,
      );
      debug.stroke();
      debug.strokeColor = new Color(255, 90, 90, 245);
      debug.moveTo(this.riverRegion.left, highland.north);
      debug.lineTo(this.riverRegion.right, highland.north);
      debug.stroke();
      debug.rect(
        this.riverRegion.left, highland.cliffBottom,
        highland.roadLeft - this.riverRegion.left,
        highland.cliffTop - highland.cliffBottom,
      );
      debug.rect(
        highland.roadRight, highland.cliffBottom,
        this.riverRegion.right - highland.roadRight,
        highland.cliffTop - highland.cliffBottom,
      );
      debug.stroke();
      debug.strokeColor = new Color(80, 225, 255, 235);
      debug.rect(
        highland.roadLeft, highland.cliffBottom,
        highland.roadRight - highland.roadLeft,
        highland.cliffTop - highland.cliffBottom,
      );
      debug.stroke();
      debug.strokeColor = new Color(210, 100, 255, 245);
      debug.rect(
        this.riverbankElevationTransition.stairPassage.left,
        this.riverbankElevationTransition.stairPassage.bottom,
        this.riverbankElevationTransition.stairPassage.right
          - this.riverbankElevationTransition.stairPassage.left,
        this.riverbankElevationTransition.stairPassage.top
          - this.riverbankElevationTransition.stairPassage.bottom,
      );
      debug.moveTo(this.riverbankElevationTransition.stairPassage.left - 40,
        this.riverbankElevationTransition.upperCommitY);
      debug.lineTo(this.riverbankElevationTransition.stairPassage.right + 40,
        this.riverbankElevationTransition.upperCommitY);
      debug.moveTo(this.riverbankElevationTransition.stairPassage.left - 40,
        this.riverbankElevationTransition.lowerCommitY);
      debug.lineTo(this.riverbankElevationTransition.stairPassage.right + 40,
        this.riverbankElevationTransition.lowerCommitY);
      debug.stroke();
      debug.strokeColor = new Color(255, 210, 70, 245);
      debug.rect(
        this.riverbankPhaseOneReturnTrigger.left,
        this.riverbankPhaseOneReturnTrigger.bottom,
        this.riverbankPhaseOneReturnTrigger.right - this.riverbankPhaseOneReturnTrigger.left,
        this.riverbankPhaseOneReturnTrigger.top - this.riverbankPhaseOneReturnTrigger.bottom,
      );
      debug.stroke();
      debug.strokeColor = new Color(255, 255, 255, 245);
      debug.circle(highland.spawnX, highland.spawnY, 20);
      debug.stroke();
      const elevationLabelNode = new Node('TerrainElevationDebugLabel');
      elevationLabelNode.parent = this.node;
      elevationLabelNode.setPosition(-455, 170, 951);
      elevationLabelNode.addComponent(UITransform).setContentSize(430, 48);
      this.terrainElevationDebugLabel = elevationLabelNode.addComponent(Label);
      this.terrainElevationDebugLabel.fontSize = 14;
      this.terrainElevationDebugLabel.lineHeight = 18;
      this.terrainElevationDebugLabel.color = new Color(200, 255, 210);
      this.updateTerrainElevationState(true);
    }
    console.info('[YinXuCity] RIVERBANK north highland entrance ready', {
      root: root.name,
      cliffParts: cliffParts.length,
      plateau: {
        left: this.riverRegion.left, right: this.riverRegion.right,
        bottom: highland.cliffTop, top: highland.north,
      },
      spawn: { x: highland.spawnX, y: highland.spawnY },
      cliffDistance: highland.spawnY - highland.cliffTop,
      roadGap: {
        left: highland.roadLeft, right: highland.roadRight,
        width: highland.roadRight - highland.roadLeft,
      },
      trees: trees.length,
    });
  }

  private classifyRiverbankTerrain(x: number, y: number, clearance = 0): RiverbankTerrainKind {
    const bridge = this.riverbankPhaseOneBridge;
    if (Math.abs(x - bridge.x) <= bridge.w / 2 + clearance
      && Math.abs(y - bridge.y) <= bridge.h / 2 + clearance) return 'BRIDGE';

    const roadDistance = this.distanceToPath(x, y, this.riverbankPhaseOneRoadPoints);
    if (roadDistance <= 56 + clearance) return 'ROAD';

    const waterDistance = this.distanceToPath(x, y, this.riverbankPhaseOneRiverPoints);
    if (waterDistance <= 150 + clearance) return 'WATER';
    if (waterDistance <= 220 + clearance) return 'SHORE';

    const boundaryBand = 150 + clearance;
    if (x <= this.riverRegion.left + boundaryBand || x >= this.riverRegion.right - boundaryBand
      || y <= this.riverRegion.bottom + boundaryBand || y >= this.riverRegion.top - boundaryBand) {
      return 'BOUNDARY';
    }
    return 'LAND';
  }

  private canPlaceRiverbankObject(
    x: number,
    y: number,
    width: number,
    height: number,
    allowed: RiverbankTerrainKind[],
  ) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const samples: Array<[number, number]> = [];
    for (let row = 0; row < 5; row++) {
      for (let column = 0; column < 5; column++) {
        samples.push([
          x - halfWidth + width * column / 4,
          y - halfHeight + height * row / 4,
        ]);
      }
    }
    const trigger = this.riverbankPhaseOneReturnTrigger;
    const overlapsReturnTrigger = x + halfWidth > trigger.left - 24 && x - halfWidth < trigger.right + 24
      && y + halfHeight > trigger.bottom - 24 && y - halfHeight < trigger.top + 24;
    if (overlapsReturnTrigger) return false;
    return samples.every(sample => allowed.includes(this.classifyRiverbankTerrain(sample[0], sample[1])));
  }

  private distanceToPath(x: number, y: number, points: Array<[number, number]>) {
    let distance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < points.length - 1; index++) {
      const a = points[index];
      const b = points[index + 1];
      distance = Math.min(distance, this.pointToSegmentDistance(x, y, a[0], a[1], b[0], b[1]));
    }
    return distance;
  }

  private drawTransitionForest() {
    const floor = this.graphics('RiverFieldForestFloor', this.world, 2);
    floor.fillColor = new Color(49, 100, 55, 72);
    floor.ellipse(-2800, -1320, 1020, 760); floor.ellipse(-1450, -820, 900, 430); floor.ellipse(-370, -1450, 520, 720); floor.fill();
    floor.fillColor = new Color(111, 126, 63, 52);
    floor.ellipse(-2250, -1710, 720, 360); floor.ellipse(-650, -760, 500, 270); floor.fill();

    const trunkRoad: Array<[number, number]> = [[-3820, -815], [-3300, -785], [-2700, -810], [-2100, -790], [-1500, -775], [-900, -770], [-300, -760], [0, -760]];
    const trunkShadow = this.graphics('ForestTrunkRoadShadow', this.world, 6);
    trunkShadow.strokeColor = new Color(91, 67, 43, 190); trunkShadow.lineWidth = 56; this.strokeSmoothPath(trunkShadow, trunkRoad); trunkShadow.stroke();
    const trunkSoil = this.graphics('ForestTrunkRoadSoil', this.world, 7);
    trunkSoil.strokeColor = new Color(161, 119, 69); trunkSoil.lineWidth = 44; this.strokeSmoothPath(trunkSoil, trunkRoad); trunkSoil.stroke();
    const trunkCenter = this.graphics('ForestTrunkRoadRuts', this.world, 8);
    trunkCenter.strokeColor = new Color(197, 157, 91, 145); trunkCenter.lineWidth = 16; this.strokeSmoothPath(trunkCenter, trunkRoad); trunkCenter.stroke();
    const trunkPixels = this.graphics('ForestTrunkRoadPixelDetails', this.world, 9);
    const trunkSamples = this.sampleDetailedPath(trunkRoad, 32);
    trunkSamples.forEach((point, index) => {
      if (index === 0 || index === trunkSamples.length - 1) return;
      const previous = trunkSamples[index - 1]; const next = trunkSamples[index + 1];
      const dx = next[0] - previous[0]; const dy = next[1] - previous[1]; const length = Math.max(1, Math.hypot(dx, dy));
      const tx = dx / length; const ty = dy / length; const nx = -ty; const ny = tx;
      [-1, 1].forEach(side => {
        trunkPixels.fillColor = index % 4 === 0 ? new Color(94, 66, 42, 195) : new Color(222, 177, 99, 170);
        this.paintOrientedPatch(trunkPixels, point[0] + nx * side * 12, point[1] + ny * side * 12, tx, ty, nx, ny, 7 + index % 4 * 2, 3);
      });
    });

    const trails: Array<Array<[number, number]>> = [
      [[-3720, -760], [-3440, -560], [-3070, -500], [-2720, -630], [-2330, -510], [-1930, -590], [-1510, -470], [-1080, -600], [-650, -500], [-250, -760]],
      [[-3420, -760], [-3330, -1100], [-3080, -1430], [-2730, -1580], [-2380, -1410], [-2110, -1080], [-1900, -760]],
      [[-1850, -760], [-1710, -1050], [-1760, -1560], [-1610, -2050], [-1180, -2110], [-720, -2070], [-350, -1820], [-320, -1400], [-430, -1050], [-250, -760]],
      [[-2730, -1580], [-2360, -1850], [-1960, -1850], [-1760, -1560]],
    ];

    const trailShadow = this.graphics('ForestTrailShadow', this.world, 5);
    const trailSoil = this.graphics('ForestTrailSoil', this.world, 6);
    const trailCenter = this.graphics('ForestTrailCenter', this.world, 7);
    trails.forEach(path => {
      trailShadow.strokeColor = new Color(73, 62, 43, 185); trailShadow.lineWidth = 36;
      this.strokeSmoothPath(trailShadow, path); trailShadow.stroke();
      trailSoil.strokeColor = new Color(164, 128, 76); trailSoil.lineWidth = 26;
      this.strokeSmoothPath(trailSoil, path); trailSoil.stroke();
      trailCenter.strokeColor = new Color(202, 168, 103, 150); trailCenter.lineWidth = 8;
      this.strokeSmoothPath(trailCenter, path); trailCenter.stroke();
    });

    // Each route now terminates into an authored junction patch. These nodes
    // hide the doubled strokes produced by independent paths and preserve a
    // soft, trampled-earth shoulder instead of a sharp line-on-line overlap.
    [
      [-3720, -760], [-3420, -760], [-1900, -760], [-1850, -760], [-250, -760],
      [-2730, -1580], [-1760, -1560],
    ].forEach((point, index) => this.drawDirtRoadJunction(point[0], point[1], index, index < 5 ? 36 : 30, 9));

    const trailPixels = this.graphics('ForestTrailPixelDetails', this.world, 8);
    let seed = 21973;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const trailSamples: Array<[number, number]> = [];
    trails.forEach(path => {
      const samples = this.sampleDetailedPath(path, 34);
      trailSamples.push(...samples);
      samples.forEach((point, index) => {
        if (index === 0 || index === samples.length - 1) return;
        const previous = samples[index - 1]; const next = samples[index + 1];
        const dx = next[0] - previous[0]; const dy = next[1] - previous[1];
        const length = Math.max(1, Math.hypot(dx, dy));
        const tx = dx / length; const ty = dy / length; const nx = -ty; const ny = tx;
        const side = index % 2 === 0 ? -1 : 1;
        trailPixels.fillColor = index % 3 === 0 ? new Color(111, 77, 46, 190) : new Color(222, 186, 115, 175);
        this.paintOrientedPatch(trailPixels, point[0] + nx * side * (5 + random() * 7), point[1] + ny * side * (5 + random() * 7), tx, ty, nx, ny, 5 + random() * 9, 2 + random() * 3);
      });
    });

    const nearTrail = (x: number, y: number, margin: number) => trailSamples.some(point => Math.hypot(x - point[0], y - point[1]) < margin) ||
      (x > -3900 && x < 120 && Math.abs(y + 780) < margin);
    let treeCount = 0;
    for (let attempt = 0; attempt < 620 && treeCount < 96; attempt++) {
      const x = -3700 + random() * 3450;
      const y = -2130 + random() * 1690;
      if (nearTrail(x, y, 70) || this.pointInWater(x, y, 70)) continue;
      this.createTreeSized(x, y, 400 + treeCount, .52 + random() * .17);
      treeCount++;
    }

    let shrubCount = 0;
    for (let attempt = 0; attempt < 280 && shrubCount < 58; attempt++) {
      const x = -3750 + random() * 3600; const y = -2140 + random() * 1710;
      if (nearTrail(x, y, 62) || this.pointInWater(x, y, 55)) continue;
      this.pixelSprite(`TransitionForestShrub${shrubCount}`, shrubCount % 3 === 0 ? 'jujube-bush' : (shrubCount % 2 ? 'roadside-grass-clump' : 'grass-clump'), this.world, x, y, 54 + random() * 18, 52 + random() * 20, 14);
      shrubCount++;
    }
    this.worldLabel('林间曲径', -2450, -390, 19, new Color(229, 238, 197));
  }

  private drawCityWallsAndGate() {
    const boundary = this.cityBoundary;
    this.createCityWallCollisions();
    const visualRoot = this.createCityWallVisualRoot();
    if (!visualRoot) return;

    // North wall visual
    const northGate = boundary.gates.north;
    if (northGate.enabled) {
      const left = northGate.center - northGate.gatehouseHalfWidth;
      const right = northGate.center + northGate.gatehouseHalfWidth;
      if (left > boundary.left) this.createHorizontalWallVisual('NorthWallLeftVisual', visualRoot, boundary.left, left, boundary.top);
      if (right < boundary.right) this.createHorizontalWallVisual('NorthWallRightVisual', visualRoot, right, boundary.right, boundary.top);
    } else {
      this.createHorizontalWallVisual('NorthWallVisual', visualRoot, boundary.left, boundary.right, boundary.top);
    }

    // South wall visual
    const southGate = boundary.gates.south;
    const sLeft = southGate.center - southGate.gatehouseHalfWidth;
    const sRight = southGate.center + southGate.gatehouseHalfWidth;
    this.createHorizontalWallVisual('SouthWallLeftVisual', visualRoot, boundary.left, sLeft, boundary.bottom);
    this.createHorizontalWallVisual('SouthWallRightVisual', visualRoot, sRight, boundary.right, boundary.bottom);

    // West wall visual
    const westGate = boundary.gates.west;
    if (westGate.enabled) {
      const bottom = westGate.center - westGate.gatehouseHalfWidth;
      const top = westGate.center + westGate.gatehouseHalfWidth;
      if (bottom > boundary.bottom) this.createVerticalWallVisual('WestWallBottomVisual', visualRoot, boundary.left, boundary.bottom, bottom);
      if (top < boundary.top) this.createVerticalWallVisual('WestWallTopVisual', visualRoot, boundary.left, top, boundary.top);
    } else {
      this.createVerticalWallVisual('WestWallVisual', visualRoot, boundary.left, boundary.bottom, boundary.top);
    }

    // East wall visual
    const eastGate = boundary.gates.east;
    if (eastGate.enabled) {
      const bottom = eastGate.center - eastGate.gatehouseHalfWidth;
      const top = eastGate.center + eastGate.gatehouseHalfWidth;
      if (bottom > boundary.bottom) this.createVerticalWallVisual('EastWallBottomVisual', visualRoot, boundary.right, boundary.bottom, bottom);
      if (top < boundary.top) this.createVerticalWallVisual('EastWallTopVisual', visualRoot, boundary.right, top, boundary.top);
    } else {
      this.createVerticalWallVisual('EastWallVisual', visualRoot, boundary.right, boundary.bottom, boundary.top);
    }

    this.staticCityBoundaryNodes.push(visualRoot);

    // Reorder south wall visuals to render above west wall at corner intersection
    const southLeft = visualRoot.getChildByName('SouthWallLeftVisual');
    const southRight = visualRoot.getChildByName('SouthWallRightVisual');
    if (southLeft) southLeft.setSiblingIndex(visualRoot.children.length - 1);
    if (southRight) southRight.setSiblingIndex(visualRoot.children.length - 1);

    // The clipped third tile contains source-canvas remnant pixels above each
    // lower gate section. It is not part of either authored wall span.
    ['WestWallBottomVisual', 'EastWallBottomVisual'].forEach(stripName => {
      const strip = visualRoot.getChildByName(stripName);
      const residualTile = strip?.getChildByName(`${stripName}Tile2`);
      if (residualTile) residualTile.destroy();
    });

    // South gate detailed visuals (preserved)
    this.pixelSprite('SouthGateThreshold', 'south-gate-threshold-v2', visualRoot, -28, -252, 260, 180, 39);
    this.pixelSprite('SouthGatePixelArt', 'south-gate', visualRoot, 0, -165, 420, 325, 44);
    // Keep the transparent foreground independent from the solid gate bodies.
    // It is permanently above actors, but contains only source-image pixels.
    this.southGateForegroundVisual = this.createSouthGateForegroundOccluder();
    this.southGateForegroundVisual.active = true;
    this.fixedForegroundNodes.push(this.southGateForegroundVisual);

    // Gate collision bodies for all four gates
    this.addGateBodyCollisions('north', northGate, boundary);
    this.addGateBodyCollisions('south', southGate, boundary);
    this.addGateBodyCollisions('west', westGate, boundary);
    this.addGateBodyCollisions('east', eastGate, boundary);

    // South gate additional details (plinths, stairs)
    const passageHalf = southGate.passageWidth / 2;
    const sideWidth = southGate.gatehouseHalfWidth - passageHalf;
    this.addObstacle(-154, -296, 108, 34, 'SouthGateLeftPlinth');
    this.addObstacle(154, -296, 108, 34, 'SouthGateRightPlinth');
    this.addObstacle(southGate.center - passageHalf - 19, -286, 38, 90, 'SouthGateLeftStairRail');
    this.addObstacle(southGate.center + passageHalf + 19, -286, 38, 90, 'SouthGateRightStairRail');

    // Gate labels
    this.worldLabel('北城门', northGate.center, boundary.top - 38, 18, new Color(255, 239, 190));
    this.worldLabel('南城门', 0, -38, 18, new Color(255, 239, 190));
    this.worldLabel('西城门', boundary.left + 38, westGate.center, 18, new Color(255, 239, 190));
    this.worldLabel('东城门', boundary.right - 38, eastGate.center, 18, new Color(255, 239, 190));
  }

  private addGateBodyCollisions(key: string, gate: any, boundary: any) {
    if (!gate.enabled) return;
    const passageHalf = gate.passageWidth / 2;
    const sideWidth = gate.gatehouseHalfWidth - passageHalf;

    if (key === 'north' || key === 'south') {
      // These AABBs trace only the timber tower bodies, columns and stone
      // plinths. They deliberately leave the outward roof eaves, lintel and
      // banners visual-only, as well as the central 112px gate passage.
      if (key === 'north') return;
      // Mapped from the authored 299x282 frame's solid tower ranges:
      // left x=12..99/right x=200..287, y=74..276, scaled to 420x325.
      this.addObstacle(gate.center - 132, -204, 122, 232, `${key}GateLeftGatehouseSolid`);
      this.addObstacle(gate.center + 132, -204, 122, 232, `${key}GateRightGatehouseSolid`);
    } else {
      const x = key === 'west' ? boundary.left : boundary.right;
      const offsetX = key === 'west' ? 185 : -185;
      this.addObstacle(x + offsetX, gate.center - passageHalf - sideWidth / 2, 226, sideWidth, `${key}GateBottomBody`);
      this.addObstacle(x + offsetX, gate.center + passageHalf + sideWidth / 2, 226, sideWidth, `${key}GateTopBody`);
    }
  }

  private createCityWallCollisions() {
    const b = this.cityBoundary;
    const hThick = 142;
    const vThick = 100;

    // North wall
    const northGate = b.gates.north;
    if (northGate.enabled) {
      const left = northGate.center - northGate.gatehouseHalfWidth;
      const right = northGate.center + northGate.gatehouseHalfWidth;
      const leftW = left - b.left;
      const rightW = b.right - right;
      if (leftW > 0) this.addObstacle(b.left + leftW / 2, b.top, leftW, hThick, 'NorthWallLeftCollision');
      if (rightW > 0) this.addObstacle(right + rightW / 2, b.top, rightW, hThick, 'NorthWallRightCollision');
    } else {
      this.addObstacle((b.left + b.right) / 2, b.top, b.right - b.left, hThick, 'NorthWallCollision');
    }

    // South wall
    const southGate = b.gates.south;
    const sLeft = southGate.center - southGate.gatehouseHalfWidth;
    const sRight = southGate.center + southGate.gatehouseHalfWidth;
    const sLeftW = sLeft - b.left;
    const sRightW = b.right - sRight;
    if (sLeftW > 0) this.addObstacle(b.left + sLeftW / 2, b.bottom, sLeftW, hThick, 'SouthWallLeftCollision');
    if (sRightW > 0) this.addObstacle(sRight + sRightW / 2, b.bottom, sRightW, hThick, 'SouthWallRightCollision');

    // West wall
    const westGate = b.gates.west;
    if (westGate.enabled) {
      const bottom = westGate.center - westGate.gatehouseHalfWidth;
      const top = westGate.center + westGate.gatehouseHalfWidth;
      const bottomH = bottom - b.bottom;
      const topH = b.top - top;
      if (bottomH > 0) this.addObstacle(b.left, b.bottom + bottomH / 2, vThick, bottomH, 'WestWallBottomCollision');
      if (topH > 0) this.addObstacle(b.left, top + topH / 2, vThick, topH, 'WestWallTopCollision');
    } else {
      this.addObstacle(b.left, (b.bottom + b.top) / 2, vThick, b.top - b.bottom, 'WestWallCollision');
    }

    // East wall
    const eastGate = b.gates.east;
    if (eastGate.enabled) {
      const bottom = eastGate.center - eastGate.gatehouseHalfWidth;
      const top = eastGate.center + eastGate.gatehouseHalfWidth;
      const bottomH = bottom - b.bottom;
      const topH = b.top - top;
      if (bottomH > 0) this.addObstacle(b.right, b.bottom + bottomH / 2, vThick, bottomH, 'EastWallBottomCollision');
      if (topH > 0) this.addObstacle(b.right, top + topH / 2, vThick, topH, 'EastWallTopCollision');
    } else {
      this.addObstacle(b.right, (b.bottom + b.top) / 2, vThick, b.top - b.bottom, 'EastWallCollision');
    }
  }

  private createCityWallVisualRoot() {
    const duplicate = this.world.getChildByName('CityWallVisualRoot');
    if (duplicate) {
      console.error('[YinXuCity] duplicate CityWallVisualRoot blocked', duplicate);
      return null;
    }
    if ((game.config?.debugMode ?? DebugMode.NONE) !== DebugMode.NONE) {
      const legacy = this.world.children.filter(node => /SouthWall.*End|Corner|WallVisual|夯土城墙/.test(node.name));
      legacy.forEach(node => console.info('[YinXuCity] pre-wall visual node', {
        name: node.name, parent: node.parent?.name, worldPosition: node.worldPosition,
        active: node.active, activeInHierarchy: node.activeInHierarchy,
        opacity: node.getComponent(UIOpacity)?.opacity ?? 255, siblingIndex: node.getSiblingIndex(),
      }));
    }
    const root = new Node('CityWallVisualRoot');
    root.parent = this.world;
    root.setPosition(0, 0, 38);
    root.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);
    this.cityWallVisualRoot = root;
    return root;
  }

  /** Horizontal SpriteFrame visible content is 264x180; render 208x142. */
  private createHorizontalWallVisual(name: string, parent: Node, startX: number, endX: number, y: number) {
    const length = endX - startX;
    const strip = new Node(name);
    strip.parent = parent;
    strip.setPosition((startX + endX) / 2, y, 0);
    strip.addComponent(UITransform).setContentSize(length, 142);
    strip.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    const contentWidth = 208;
    const step = 206;
    for (let center = startX + contentWidth / 2, index = 0; center - contentWidth / 2 < endX; center += step, index++) {
      const tile = new Node(`${name}Tile${index}`);
      tile.parent = strip;
      tile.setPosition(center - (startX + endX) / 2, 0, 0);
      tile.addComponent(UITransform).setContentSize(contentWidth, 142);
      this.attachPixelSprite(tile, 'city-wall-horizontal-v2');
    }
  }

  /**
   * Vertical source main content is x=140..242, y=10..278. The unrelated
   * x=10..25 remnant and the off-centre transparent canvas are clipped here.
   */
  private createVerticalWallVisual(name: string, parent: Node, x: number, startY: number, endY: number) {
    const length = endY - startY;
    const strip = new Node(name);
    strip.parent = parent;
    strip.setPosition(x, (startY + endY) / 2, 0);
    strip.addComponent(UITransform).setContentSize(81, length);
    strip.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    const contentHeight = 212;
    const step = 210;
    for (let center = startY + contentHeight / 2, index = 0; center - contentHeight / 2 < endY; center += step, index++) {
      const tile = new Node(`${name}Tile${index}`);
      tile.parent = strip;
      tile.setPosition(-51, center - (startY + endY) / 2, 0);
      tile.addComponent(UITransform).setContentSize(184, contentHeight);
      this.attachPixelSprite(tile, 'city-wall-vertical-v2');
    }
  }

  private drawTemple() {
    this.createTempleForecourt();
    // The bespoke 440 x 375 sprite includes its own plinth, roof, and details;
    // do not leave the former procedural rectangular building behind it.
    this.pixelSprite('占卜宗庙PixelArt', 'divination-temple', this.world, 0, 1210 + this.templeMoveDeltaY, 440, 375, 34);
    this.worldLabel('占卜宗庙', 0, 1400 + this.templeMoveDeltaY, 22, new Color(100, 48, 31));
    // Remove every former temple footprint before rebuilding its outline. This
    // includes the old two-piece wall as well as any legacy named footprint.
    const templeY = 1210 + this.templeMoveDeltaY;
    this.obstacles = this.obstacles.filter(o =>
      !o.name.includes('占卜宗庙') && !o.name.startsWith('StructureFootprint:占卜宗庙PixelArt'));
    // Short, overlapping segments follow the painted outer roof, walls, and
    // front plinth. The central stair remains approachable; a narrow sill just
    // behind the enter zone prevents crossing into the painted doorway.
    [
      [0, templeY + 168, 70, 24, 'RearRidge'],
      [-60, templeY + 152, 76, 24, 'RearLeftEave'], [60, templeY + 152, 76, 24, 'RearRightEave'],
      [-118, templeY + 125, 74, 30, 'UpperLeftRoof'], [118, templeY + 125, 74, 30, 'UpperRightRoof'],
      [-158, templeY + 75, 36, 85, 'LeftRoofEdge'], [158, templeY + 75, 36, 85, 'RightRoofEdge'],
      [-172, templeY - 8, 30, 118, 'LeftOuterWall'], [172, templeY - 8, 30, 118, 'RightOuterWall'],
      [-155, templeY - 100, 32, 82, 'LeftLowerWall'], [155, templeY - 100, 32, 82, 'RightLowerWall'],
      [-115, templeY - 145, 125, 24, 'LeftFrontPlinth'], [115, templeY - 145, 125, 24, 'RightFrontPlinth'],
      [-88, templeY - 98, 108, 14, 'LeftDoorFacade'], [0, templeY - 98, 66, 14, 'DoorSill'],
      [88, templeY - 98, 108, 14, 'RightDoorFacade'],
    ].forEach(([x, y, w, h, suffix]) => this.addObstacle(
      x as number, y as number, w as number, h as number,
      `StructureFootprint:占卜宗庙PixelArt:${suffix as string}`,
    ));
  }

  private createTempleForecourt() {
    const court = this.graphics('TempleDetailedForecourt', this.world, 12);
    // Individual, slightly uneven paving stones let the original ground show
    // through. This avoids the flat rectangular placeholder that used to sit
    // in front of the temple.
    const stoneColors = [
      new Color(142, 119, 80), new Color(157, 132, 87), new Color(126, 107, 77), new Color(171, 144, 94),
    ];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        const x = -210 + col * 70 + (row % 2 === 0 ? 0 : 10);
        const y = (898 + this.templeMoveDeltaY) + row * 36 + ((col * 7 + row * 3) % 5 - 2);
        const width = 58 + (col + row) % 3 * 3;
        const height = 28 + (col * 2 + row) % 3 * 2;
        court.fillColor = stoneColors[(col + row * 2) % stoneColors.length];
        court.roundRect(x - width / 2, y - height / 2, width, height, 4); court.fill();
        court.strokeColor = new Color(79, 66, 50, 145); court.lineWidth = 2;
        court.moveTo(x - width * .18, y + height * .2);
        court.lineTo(x + width * .04, y + height * .02);
        court.lineTo(x + width * .2, y - height * .22); court.stroke();
      }
    }

    // The existing north-south road remains exposed through the center of the
    // forecourt. Do not add duplicate processional-road Graphics here.
    // The former green rectangle came from a separate grass pass at this
    // exact site. It is intentionally absent: no overlay or replacement node
    // is retained here, so the normal forecourt and road remain untouched.
    court.fillColor = new Color(86, 66, 47, 170);
    [-248, 248].forEach(x => {
      for (let y = (900 + this.templeMoveDeltaY); y <= (1005 + this.templeMoveDeltaY); y += 28) court.roundRect(x - 7, y - 9, 14, 19, 3);
    });
    court.fill();

    // The temple sprite already contains its own threshold and stairs. A
    // separate Graphics threshold here created the abnormal gray-green patch
    // immediately south of the steps, so no duplicate is drawn.
  }

  private createAnimatedTorch(x: number, y: number, index: number, regionId?: RegionId) {
    const root = new Node(`AnimatedBronzeTorch${index}`);
    root.parent = this.world;
    root.setPosition(x, y, 21);
    root.addComponent(UITransform).setContentSize(66, 92);

    // Clip the baked flame from the authored brazier, retaining its detailed
    // bronze bowl, timber post and grass base as the static lower body.
    const clip = new Node(`TorchBaseClip${index}`);
    clip.parent = root;
    clip.setPosition(0, -10, 0);
    clip.addComponent(UITransform).setContentSize(62, 60);
    const mask = clip.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;
    const base = new Node(`TorchBasePixelArt${index}`);
    base.parent = clip;
    base.setPosition(0, 10, 0);
    base.addComponent(UITransform).setContentSize(58, 78);
    this.attachPixelSprite(base, 'bronze-brazier-lamp');

    const glowNode = new Node(`TorchGlow${index}`);
    glowNode.parent = root; glowNode.setPosition(0, 24, 1); glowNode.addComponent(UITransform).setContentSize(92, 92);
    const glow = glowNode.addComponent(Graphics);
    const flameNode = new Node(`TorchFlame${index}`);
    flameNode.parent = root; flameNode.setPosition(0, 23, 3); flameNode.addComponent(UITransform).setContentSize(48, 54);
    const flame = flameNode.addComponent(Graphics);
    const emberNode = new Node(`TorchEmbers${index}`);
    emberNode.parent = root; emberNode.setPosition(0, 23, 4); emberNode.addComponent(UITransform).setContentSize(54, 62);
    const embers = emberNode.addComponent(Graphics);
    this.torchFlames.push({ root, flame, glow, embers, phase: index * 1.73 + x * .001, intensity: 1 });
    this.depthOccluders.push({ node: root, footY: y - 35, halfWidth: 32, coverHeight: 96, baseZ: 21, foregroundZ: 98 });
    if (regionId === RegionId.ROYAL_TOMB) {
      this.addObstacle(x, y - 3, 54, 74, `RoyalTombTorchSolid${index}`, regionId);
      return;
    }
    this.addObstacle(x, y - 18, 28, 32, '青铜火盆');
  }

  private createTempleInterior() {
    const root = new Node('DivinationTempleInterior');
    root.parent = this.node;
    root.setPosition(0, 0, 110);
    root.addComponent(UITransform).setContentSize(1280, 720);
    this.templeInterior = root;

    this.configureTempleInteriorObstacles();
    this.createTempleInteriorCollisionDebug(root);
    this.loadTempleInteriorSpriteSet(root);
    root.active = false;
  }

  private configureTempleInteriorObstacles() {
    this.interiorObstacles = [
      // Structural shell. The south wall is split so the existing doorway at
      // x=0 remains the only approach to the exit trigger.
      { x: -562, y: -34, w: 28, h: 496, name: '贞人卜室左墙' },
      { x: 562, y: -34, w: 28, h: 496, name: '贞人卜室右墙' },
      { x: -404, y: 184, w: 288, h: 72, name: '贞人卜室左后墙与墙角' },
      { x: 404, y: 184, w: 288, h: 72, name: '贞人卜室右后墙与墙角' },
      { x: -313, y: -277, w: 470, h: 20, name: '贞人卜室左侧南墙' },
      { x: 313, y: -277, w: 470, h: 20, name: '贞人卜室右侧南墙' },

      // Furniture rectangles use foot/ground projections. Tall transparent
      // pixels (flames, jars, chair back) deliberately do not enlarge them.
      { x: 0, y: 135, w: 520, h: 170, name: '后方木构主祭台' },
      { x: -407, y: 36, w: 300, h: 226, name: '双列甲骨档案柜' },
      { x: -335, y: -136, w: 118, h: 50, name: '左火盆石质底座' },
      { x: 335, y: -136, w: 118, h: 50, name: '右火盆石质底座' },
      { x: 466, y: 52, w: 220, h: 176, name: '右侧材料工具台' },
      // The tabletop projects farther toward the player than its opaque
      // center pixels.  This foot-sized rectangle seals the full tabletop and
      // apron, while stopping short of the scripted chair anchor at y=-24.
      { x: 0, y: -106, w: 236, h: 126, name: '中央占卜案桌' },
      // The visible chair content occupies roughly 88x104 inside its 94x112
      // display node. This blocks ordinary walking through the back, seat,
      // arms and feet while the scripted sit placement remains unrestricted.
      { x: 0, y: -24, w: 88, h: 104, name: '指定占卜座椅接地范围' },
    ];
  }

  private createTempleInteriorCollisionDebug(root: Node) {
    if (!SHOW_COLLISION_DEBUG) return;
    const debugMode = game.config?.debugMode ?? DebugMode.NONE;
    if (debugMode === DebugMode.NONE) return;
    const debugNode = new Node('TempleInteriorCollisionDebug');
    debugNode.parent = root;
    debugNode.setPosition(0, 0, 130);
    debugNode.addComponent(UITransform).setContentSize(1280, 720);
    this.templeCollisionDebug = debugNode;
    this.templeCollisionDebugGraphics = debugNode.addComponent(Graphics);
    this.redrawTempleInteriorCollisionDebug();
    this.runTempleCollisionDeterministicChecks();
  }

  private redrawTempleInteriorCollisionDebug() {
    const graphics = this.templeCollisionDebugGraphics;
    if (!graphics?.isValid) return;
    graphics.clear();
    graphics.lineWidth = 2;
    graphics.strokeColor = new Color(88, 235, 149, 220);
    const bounds = this.templeWalkBounds;
    graphics.rect(bounds.left, bounds.bottom, bounds.right - bounds.left, bounds.top - bounds.bottom);
    graphics.stroke();
    for (const obstacle of this.interiorObstacles) {
      // Orange is the authored furniture/structure footprint.
      graphics.strokeColor = new Color(255, 153, 64, 230);
      graphics.rect(obstacle.x - obstacle.w / 2, obstacle.y - obstacle.h / 2, obstacle.w, obstacle.h);
      graphics.stroke();
      // Magenta is the actual forbidden center region after Minkowski expansion
      // by the player's 40x18 foot rectangle.
      graphics.strokeColor = new Color(255, 71, 210, 220);
      graphics.rect(
        obstacle.x - obstacle.w / 2 - this.templeFootHalfWidth,
        obstacle.y - obstacle.h / 2 - this.templeFootHalfHeight,
        obstacle.w + this.templeFootHalfWidth * 2,
        obstacle.h + this.templeFootHalfHeight * 2,
      );
      graphics.stroke();
    }
    // Cyan baselines are ground-contact sort lines, not collision edges.
    graphics.strokeColor = new Color(69, 218, 255, 235);
    [
      { x: -407, y: -76, w: 300 },
      { x: 0, y: -156, w: 250 },
      { x: -335, y: -161, w: 118 },
      { x: 335, y: -161, w: 118 },
      { x: 466, y: -36, w: 220 },
    ].forEach(line => {
      graphics.moveTo(line.x - line.w / 2, line.y);
      graphics.lineTo(line.x + line.w / 2, line.y);
      graphics.stroke();
    });
    graphics.strokeColor = new Color(246, 207, 76, 230);
    graphics.circle(this.templeSeatPoint.x, this.templeSeatPoint.y, 76);
    graphics.stroke();
    // Current foot rectangle and its exact sort point.
    graphics.strokeColor = new Color(255, 255, 255, 235);
    graphics.rect(
      this.playerPos.x - this.templeFootHalfWidth,
      this.playerPos.y - this.templeFootHalfHeight,
      this.templeFootHalfWidth * 2,
      this.templeFootHalfHeight * 2,
    );
    graphics.stroke();
    graphics.fillColor = new Color(255, 255, 255, 245);
    graphics.circle(this.playerPos.x, this.playerPos.y, 3);
    graphics.fill();
    if (this.templePreSitPosition) {
      graphics.fillColor = new Color(104, 223, 255, 245);
      graphics.circle(this.templePreSitPosition.x, this.templePreSitPosition.y, 5);
      graphics.fill();
    }
    if (this.templeLastRisePosition) {
      graphics.fillColor = new Color(116, 255, 126, 245);
      graphics.circle(this.templeLastRisePosition.x, this.templeLastRisePosition.y, 5);
      graphics.fill();
    }
    graphics.fillColor = new Color(82, 194, 255, 150);
    graphics.circle(this.templeRiseSafePoint.x, this.templeRiseSafePoint.y, 5);
    graphics.fill();
  }

  /**
   * Loads the complete authored room as one transaction. Sprite nodes are
   * created only after every required frame succeeds, so failures cannot leave
   * a partially replaced room. No node here owns collision or interaction.
   */
  private loadTempleInteriorSpriteSet(root: Node) {
    const paths = {
      background: 'art/interior/divination_room/divination_room_background/spriteFrame',
      table: 'art/interior/divination_room/divination_table/spriteFrame',
      chair: 'art/interior/divination_room/divination_chair/spriteFrame',
      brazier: 'art/interior/divination_room/divination_brazier/spriteFrame',
      toolBench: 'art/interior/divination_room/divination_tool_bench/spriteFrame',
      cabinetA: 'tiles/temple-oracle-cabinet-a-v1/spriteFrame',
      cabinetB: 'tiles/temple-oracle-cabinet-b-v1/spriteFrame',
    } as const;
    const entries: Array<[keyof typeof paths, string]> = [
      ['background', paths.background], ['table', paths.table], ['chair', paths.chair],
      ['brazier', paths.brazier], ['toolBench', paths.toolBench],
      ['cabinetA', paths.cabinetA], ['cabinetB', paths.cabinetB],
    ];
    const loadFrame = (path: string) => new Promise<SpriteFrame>((resolve, reject) => {
      const cached = this.frameCache.get(path);
      if (cached) {
        resolve(cached);
        return;
      }
      resources.load(path, SpriteFrame, (error, frame) => {
        if (error || !frame) {
          reject(new Error(`[YinXuCity] divination room SpriteFrame failed: ${path}; ${String(error ?? 'empty frame')}`));
          return;
        }
        frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        this.frameCache.set(path, frame);
        resolve(frame);
      });
    });

    Promise.all(entries.map(async ([key, path]) => [key, await loadFrame(path)] as const))
      .then(loaded => {
        if (!root.isValid || root !== this.templeInterior) return;
        const frames = {} as Record<keyof typeof paths, SpriteFrame>;
        loaded.forEach(([key, frame]) => { frames[key] = frame; });
        // Keep furniture as direct room children, matching the existing render
        // hierarchy so their z values remain comparable with the player (z=80).
        this.createTempleSprite('TempleInteriorBackgroundSprite', frames.background, root, 0, 0, 1280, 720, 0);
        const cabinetA = this.createTempleSprite('TempleInteriorOracleCabinetA', frames.cabinetA, root, -482, 47, 138, 245, 76);
        const cabinetB = this.createTempleSprite('TempleInteriorOracleCabinetB', frames.cabinetB, root, -337, 47, 148, 240, 76);
        const table = this.createTempleSprite('TempleInteriorDivinationTableSprite', frames.table, root, 0, -91, 250, 130, 76);
        this.templeTableVisual = table;
        this.templeTableForegroundVisual = this.createTempleTableForegroundOccluder(root, frames.table);
        const brazierLeft = this.createTempleSprite('TempleInteriorBrazierLeftSprite', frames.brazier, root, -335, -105, 124, 112, 76);
        const brazierRight = this.createTempleSprite('TempleInteriorBrazierRightSprite', frames.brazier, root, 335, -105, 124, 112, 76);
        const toolBench = this.createTempleSprite('TempleInteriorToolBenchSprite', frames.toolBench, root, 466, 52, 220, 176, 76);
        [
          { node: cabinetA, footY: -76, halfWidth: 69, coverHeight: 245 },
          { node: cabinetB, footY: -76, halfWidth: 74, coverHeight: 245 },
          { node: brazierLeft, footY: -161, halfWidth: 58, coverHeight: 112 },
          { node: brazierRight, footY: -161, halfWidth: 58, coverHeight: 112 },
          { node: toolBench, footY: -36, halfWidth: 104, coverHeight: 176 },
        ].forEach(item => this.depthOccluders.push({ ...item, baseZ: 76, foregroundZ: 98 }));

        // The interaction continues to use the existing hard-coded (0, -24)
        // anchor. Only this visual child is attached to that immutable point.
        const seatFunctionRoot = new Node('TempleInteriorDivinationSeatFunctionRoot');
        seatFunctionRoot.parent = root;
        seatFunctionRoot.setPosition(0, -24, 68);
        seatFunctionRoot.addComponent(UITransform).setContentSize(94, 112);
        this.createTempleSprite('TempleInteriorRitualChairVisual', frames.chair, seatFunctionRoot, 0, 0, 94, 112, 0);
        this.templeChairVisualRoot = seatFunctionRoot;

        // Establish the same chair/player/table order used by every subsequent
        // frame before the authored nodes replace the legacy room.
        if (this.player?.isValid && this.player.parent === root) this.updateTreeDepthOrdering();
        else this.updateTempleSeatDepthOrdering();
        this.templeCollisionDebug?.setSiblingIndex(root.children.length - 1);
        console.info('[YinXuCity] divination room authored SpriteFrames ready:', entries.map(([, path]) => path).join(', '));
      })
      .catch(error => {
        console.error('[YinXuCity] divination room authored art was not activated; no room sprites were created.', error);
      });
  }

  private createTempleSprite(
    name: string,
    frame: SpriteFrame,
    parent: Node,
    x: number,
    y: number,
    width: number,
    height: number,
    z: number,
  ) {
    const node = new Node(name);
    node.parent = parent;
    node.setPosition(x, y, z);
    node.addComponent(UITransform).setContentSize(width, height);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = frame;
    frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
    return node;
  }

  private createTempleTableForegroundOccluder(parent: Node, frame: SpriteFrame) {
    const root = new Node('TempleInteriorDivinationTableForegroundOccluder');
    root.parent = parent;
    root.setPosition(0, -91, 98);
    root.addComponent(UITransform).setContentSize(250, 130);

    // The foreground must share the room root with the player. A child of the
    // table sprite would always render inside that earlier subtree and could
    // never reliably cover a later player sibling. These slices keep the
    // table's transform while remaining comparable with the player layer.
    // They reuse authored pixels rather than drawing an opaque rectangle.
    const addSlice = (name: string, x: number, y: number, width: number, height: number) => {
      const clip = new Node(name);
      clip.parent = root;
      clip.setPosition(x, y, 0);
      clip.addComponent(UITransform).setContentSize(width, height);
      clip.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
      const spriteNode = new Node(`${name}Pixels`);
      spriteNode.parent = clip;
      spriteNode.setPosition(-x, -y, 0);
      spriteNode.addComponent(UITransform).setContentSize(250, 130);
      const sprite = spriteNode.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = frame;
      frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
    };
    // This is the continuous painted tabletop front edge, deliberately kept in
    // a separate foreground root so a seated or north-side actor has their
    // lower body covered by the table instead of appearing on its surface.
    addSlice('TableFrontEdgeOcclusion', 0, 22, 244, 82);
    addSlice('TableFrontLeftLegOcclusion', -96, -48, 38, 42);
    addSlice('TableFrontRightLegOcclusion', 96, -48, 38, 42);
    root.active = true;
    return root;
  }

  private createSouthGateForegroundOccluder() {
    const root = new Node('SouthGateForegroundOccluder');
    root.parent = this.world;
    root.setPosition(0, -165, 106);
    root.addComponent(UITransform).setContentSize(420, 325);

    // Every foreground slice samples the same full-size source as
    // SouthGatePixelArt. This keeps the roof contours, lintel and banners
    // pixel-aligned with the base gate without introducing painted overlays.
    const addSlice = (name: string, x: number, y: number, width: number, height: number) => {
      const clip = new Node(name);
      clip.parent = root;
      clip.setPosition(x, y, 0);
      clip.addComponent(UITransform).setContentSize(width, height);
      clip.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
      const spriteNode = new Node(`${name}Pixels`);
      spriteNode.parent = clip;
      spriteNode.setPosition(-x, -y, 0);
      spriteNode.addComponent(UITransform).setContentSize(420, 325);
      this.attachPixelSprite(spriteNode, 'south-gate');
    };
    addSlice('SouthGateLeftUpperForeground', -143, 96, 136, 132);
    addSlice('SouthGateRightUpperForeground', 143, 96, 136, 132);
    addSlice('SouthGateLintelForeground', 0, 45, 148, 46);
    addSlice('SouthGateLeftBannerForeground', -61, -24, 40, 115);
    addSlice('SouthGateRightBannerForeground', 61, -24, 40, 115);
    root.active = true;
    return root;
  }

  private updateTempleSeatDepthOrdering() {
    const chair = this.templeChairVisualRoot;
    const table = this.templeTableVisual;
    const tableForeground = this.templeTableForegroundVisual;
    if (!chair?.isValid || !table?.isValid || chair.parent !== table.parent) return;

    const playerIsInRoom = this.player?.isValid && this.player.parent === table.parent;
    chair.setPosition(chair.position.x, chair.position.y, 68);
    table.setPosition(table.position.x, table.position.y, 76);
    if (tableForeground?.isValid) {
      tableForeground.setPosition(tableForeground.position.x, tableForeground.position.y, 98);
      // North/back of the tabletop is y >= -145. Sitting is always the north
      // use-case even while an interaction animation adjusts the player point.
      // South/front actors keep the normal in-front draw order.
      tableForeground.active = !playerIsInRoom || this.seated || this.playerPos.y >= -145;
    }

    const ensureBefore = (earlier: Node, later: Node) => {
      if (earlier.getSiblingIndex() > later.getSiblingIndex()) earlier.setSiblingIndex(later.getSiblingIndex());
    };
    if (!playerIsInRoom) {
      ensureBefore(chair, table);
      if (tableForeground?.isValid) ensureBefore(table, tableForeground);
      return;
    }
    ensureBefore(chair, table);
    ensureBefore(table, this.player);
    if (tableForeground?.isValid) ensureBefore(this.player, tableForeground);
    ensureBefore(chair, table);
  }

  private enterTempleInterior() {
    if (this.overlay !== 'none' || this.worldMode !== 'outside' || !this.templeInterior?.isValid) return;
    // fragment-awakens 后若本章字未集齐，禁止进入宗庙占卜；提示玩家先去自由探索。
    const step = this.storyController?.currentStep();
    if (step?.id.endsWith('fragment-awakens')) {
      const main = this.chapterMainProgress(step.chapterId);
      if (main.total > 0 && main.learned < main.total) {
        const missing = main.total - main.learned;
        this.showStatusNotice(`本章甲骨尚未集齐。请先循金色箭头继续挖掘，收集并学会剩余 ${missing} 枚甲骨后再回宗庙占卜。`, 5);
        return;
      }
    }
    if (this.fishingCastEffect) this.cancelFishingCast('已收回鱼钩。', false);
    this.stopPlayerInput();
    this.worldMode = 'templeInterior';
    this.player.parent = this.templeInterior;
    this.playerPos.set(0, -265);
    this.player.setPosition(0, -265, 80);
    this.facing = 'up'; this.displayedPlayerFrame = -1; this.showPlayerFrame(0);
    this.world.active = false;
    this.updateTreeDepthOrdering();
    this.templeInterior.active = true;
    if (this.weatherParticleNode?.isValid) this.weatherParticleNode.active = false;
    // 宗庙内部 world 被隐藏，切换到内部节点挂箭头，使占卜路仍可指示。
    this.questGuide.setWorldNode(this.templeInterior);
    this.storyController?.handle({ type: 'temple-entered' });
    if (this.storyController?.currentStep()) this.presentStoryStep(this.storyController.currentStep());
  }

  private exitTempleInterior() {
    if (this.overlay !== 'none' || this.seated || this.worldMode !== 'templeInterior') return;
    this.stopPlayerInput();
    if (this.templeInterior?.isValid) this.templeInterior.active = false;
    this.world.active = true;
    this.player.parent = this.world;
    this.worldMode = 'outside';
    this.playerPos.set(0, 950 + this.templeMoveDeltaY);
    this.player.setPosition(0, 950 + this.templeMoveDeltaY, 80);
    this.cameraPos.set(0, 950 + this.templeMoveDeltaY);
    this.facing = 'down'; this.displayedPlayerFrame = -1; this.showPlayerFrame(0);
    if (this.weatherParticleNode?.isValid) this.weatherParticleNode.active = true;
    this.drawWeatherParticles(this.weather !== '晴');
    // 离开宗庙：箭头节点切回外部 world，并按当前 step 刷新位置。
    this.questGuide.setWorldNode(this.world);
    if (this.storyController?.currentStep()) this.presentStoryStep(this.storyController.currentStep());
  }

  private drawVillage() {
    const homes: Array<[number, number, string]> = [
      // Twenty homes form compact neighbourhood rows. Each doorway is set
      // back from the street by a small yard and a short private footpath.
      [-1130, 245, 'small-house-a'], [-930, 245, 'small-house-b'], [-730, 245, 'small-house-c'],
      [-470, 245, 'small-house-a'], [-270, 245, 'small-house-b'],
      [270, 245, 'small-house-c'], [470, 245, 'small-house-a'],
      [730, 245, 'small-house-b'], [930, 245, 'small-house-c'], [1130, 245, 'small-house-a'],
      [-1130, 640, 'small-house-c'], [-930, 640, 'small-house-a'], [-730, 640, 'small-house-b'],
      [-470, 640, 'small-house-c'], [-270, 640, 'small-house-a'], [470, 640, 'small-house-b'],
      [-1130, 1045, 'small-house-b'], [-930, 1045, 'small-house-c'], [-730, 1045, 'small-house-a'],
      [470, 1045, 'small-house-c'],
    ];
    homes.forEach((home, index) => this.createTownHouse(`先民民居${index + 1}`, home[0], home[1], home[2], index));

    this.worldLabel('先民村落', -1000, 1368, 18, new Color(90, 59, 38));
  }

  private drawMarket() {
    this.worldLabel('商代集市', 1010, 1365, 19, new Color(90, 59, 38));
    this.createTownShop(1030, 630);
    this.createMarketStall(820, 1030, .72); this.createMarketStall(1060, 1030, .72);
    this.createVillageWell(245, 620, RegionId.CITY);
  }

  private drawTownDetails() {
    const flowers = [[-1010, 145], [-610, 300], [-505, 145], [-105, 305], [510, 145], [610, 675], [1010, 330]];
    flowers.forEach((p, index) => {
      const asset = index % 2 === 0 ? 'wildflower-patch' : 'roadside-grass-clump';
      this.pixelSprite('RoadsidePlant', asset, this.world, p[0], p[1], 54, 54, 9);
    });

    [[-205, 930], [205, 930], [790, 910], [1160, 910]].forEach((p, index) => this.createAnimatedTorch(p[0], p[1], index));

    this.pixelSprite('MarketPottery', 'pottery-jar-cluster', this.world, 1160, 540, 90, 76, 18);
    this.pixelSprite('MarketSupplies', 'barrel-crate-cluster', this.world, 820, 550, 88, 78, 18);
    // Full, grounded footprint for the combined barrels, crate and sacks.
    this.addObstacle(820, 528, 78, 58, 'CityMarketBarrelCrateSolid', RegionId.CITY);
    this.addObstacle(1160, 507, 48, 20, '集市陶罐底座');
    this.addObstacle(820, 512, 52, 22, '集市箱笼底座');
  }

  private drawFields() {
    const fieldVisualStartIndex = this.world.children.length;
    const boundary = this.graphics('FieldLowEarthBoundary', this.world, 4);
    boundary.fillColor = new Color(112, 77, 46);
    boundary.rect(200, -450, 2800, 70);
    boundary.rect(200, -2200, 2030, 70);
    boundary.fill();
    boundary.fillColor = new Color(151, 112, 61);
    boundary.rect(200, -435, 2800, 18); boundary.rect(200, -2165, 2030, 18); boundary.fill();
    // Extend west beyond the west air wall by more than one player diameter.
    this.addObstacle(1550, -2165, 2900, 70, 'FieldsSouthBoundarySealed', 'FIELDS');
    this.addObstacle(3000, -1325, 70, 1750, 'FieldsEastBoundarySealed', 'FIELDS');
    this.addObstacle(1570, -415, 2860, 70, 'FieldsNorthBoundarySealed', 'FIELDS');
    // Invisible west air walls overlap the north/south boundary colliders,
    // leaving only the 96px trunk-road exit gap.
    this.addObstacle(105, -538, 52, 347, 'FieldsWestBoundaryUpper', 'FIELDS');
    this.addObstacle(105, -1522, 52, 1427, 'FieldsWestBoundaryLower', 'FIELDS');
    this.addObstacle(1215, -2165, 2030, 70, '田野南侧土坡');
    this.addObstacle(2685, -2165, 630, 70, '田野南侧土坡');
    this.addObstacle(3000, -575, 70, 250, '田野东侧土坡');
    this.addObstacle(3000, -1520, 70, 1360, '田野东侧土坡');

    // Dress the collision ridge with authored pixel art. The graphics below it
    // supplies the continuous silhouette; these pieces break up the long edge
    // into grass-topped earth, exposed stones and irregular gaps.
    for (let x = 292; x <= 2912; x += 174) {
      this.pixelSprite('FieldNorthRidgePixel', 'wall-horizontal', this.world, x, -415, 180, 82, 13);
      if ((x / 174 | 0) % 3 === 0) {
        this.pixelSprite('FieldNorthRidgeGrass', 'foxtail-grass', this.world, x + 34, -382, 54, 58, 14);
      }
    }
    for (let x = 292; x <= 2110; x += 174) {
      this.pixelSprite('FieldSouthRidgePixel', 'wall-horizontal', this.world, x, -2165, 180, 82, 13);
    }
    for (let x = 2455; x <= 2912; x += 174) {
      this.pixelSprite('FieldSouthRidgePixel', 'wall-horizontal', this.world, x, -2165, 180, 82, 13);
    }
    this.pixelSprite('FieldSouthRidgeSealLeft', 'wall-horizontal', this.world, 2205, -2165, 180, 82, 13);
    this.pixelSprite('FieldSouthRidgeSealRight', 'wall-horizontal', this.world, 2325, -2165, 180, 82, 13);
    [-570, -930, -1100, -1270, -1440, -1610, -1780, -1950, -2110].forEach((y, i) => {
      this.pixelSprite('FieldEastRidgePixel', 'wall-vertical', this.world, 3000, y, 84, 178, 13);
      if (i % 3 === 1) {
        this.pixelSprite('FieldEastRidgeStone', 'field-stone-cluster', this.world, 2948, y + 34, 72, 60, 14);
      }
    });
    this.pixelSprite('FieldEastRidgeSeal', 'wall-vertical', this.world, 3000, -760, 84, 178, 13);

    const roads = this.graphics('FieldRoadNetwork', this.world, 5);
    roads.fillColor = new Color(174, 132, 73);
    roads.rect(0, -808, 2912, 96);
    [1100, 1700].forEach(x => roads.rect(x - 24, -2100, 48, 1270));
    roads.rect(300, -1729, 2660, 48); roads.fill();
    roads.strokeColor = new Color(119, 91, 56, 170); roads.lineWidth = 3;
    roads.moveTo(0, -712); roads.lineTo(2912, -712); roads.moveTo(0, -808); roads.lineTo(2912, -808); roads.stroke();
    for (let x = 100; x <= 2900; x += 120) {
      const tile = this.pixelSprite('FieldMainRoadTile', 'road-straight', this.world, x, -760, 104, 88, 6);
      tile.setRotationFromEuler(0, 0, 90);
    }
    [1100, 1700].forEach((x, index) => {
      this.drawDirtRoadJunction(x, -760, 50 + index, 46, 8);
      this.drawDirtRoadJunction(x, -1729, 60 + index, 35, 8);
    });

    // Half-height mud fencing follows the trunk road, with deliberate openings
    // for the three farm lanes and the eastern mountain pass.
    for (let x = 310; x <= 2870; x += 178) {
      if ([1100, 1700].some(gap => Math.abs(x - gap) < 105)) continue;
      this.pixelSprite('FieldRoadFenceNorth', 'mud-fence-straight', this.world, x, -675, 158, 76, 14);
      this.pixelSprite('FieldRoadFenceSouth', 'mud-fence-straight', this.world, x, -846, 158, 76, 14);
      // Block the complete visible wall body from every direction. Adjacent
      // footprints overlap slightly, while the authored lane openings remain.
      this.addObstacle(x, -675, 170, 64, 'FieldRoadFenceNorthSolid', RegionId.FIELDS);
      this.addObstacle(x, -846, 170, 64, 'FieldRoadFenceSouthSolid', RegionId.FIELDS);
    }

    const field = this.graphics('OrderedFarmPlots', this.world, 5);
    const plotColumns = [650, 950, 1250, 1550, 1850, 2150, 2450, 2750];
    const plotRows = [-1010, -1510, -1900];
    let cropIndex = 0;
    plotRows.forEach((y, row) => plotColumns.forEach((x, col) => {
      field.fillColor = (row + col) % 3 === 0 ? new Color(131, 89, 48) : new Color(146, 98, 50);
      field.roundRect(x - 118, y - 124, 236, 248, 9); field.fill();
      field.strokeColor = new Color(92, 66, 40, 190); field.lineWidth = 4;
      field.roundRect(x - 118, y - 124, 236, 248, 9); field.stroke();
      // Four compact rows per plot create a planted field rather than a handful
      // of oversized crop props. Back rows are created first for clean overlap.
      [88, 30, -28, -86].forEach(offsetY => {
        [-84, -28, 28, 84].forEach(offsetX => this.createCropPlant(
          x + offsetX, y + offsetY, cropIndex++,
        ));
      });
    }));

    // Layered irrigation water replaces the former flat blue rectangles. The
    // dry bank, wet soil lip, deep channel and moving highlights are separate
    // draw layers, which gives every branch an actual cut-earth profile.
    // The main canal now exits beneath the west boundary instead of terminating
    // at the removed well feeder. Its existing east end remains at x=2940.
    this.drawLayeredIrrigationCanal('FieldMainCanal', 1520, -1270, 2840, 88, true, 8);
    [800, 1400, 2000, 2600].forEach((x, branchIndex) => {
      this.drawLayeredIrrigationCanal(`FieldBranchCanal${branchIndex}`, x, -1725, 750, 30, false, 8);
      this.drawIrrigationJunction(x, -1270, branchIndex);
      this.drawIrrigationCanalEndCap(`FieldBranchCanal${branchIndex}SouthCap`, x, -2100, 30, 8, 'south');
      this.addObstacle(x, -1510, 28, 290, `FieldBranchCanal${branchIndex}NorthWater`, RegionId.FIELDS);
      this.addObstacle(x, -1925, 28, 350, `FieldBranchCanal${branchIndex}SouthWater`, RegionId.FIELDS);
      this.addObstacle(x, -1668, 28, 26, `FieldBranchCanal${branchIndex}RoadNorthWaterLip`, RegionId.FIELDS);
      this.addObstacle(x, -1739, 28, 22, `FieldBranchCanal${branchIndex}RoadSouthWaterLip`, RegionId.FIELDS);
    });
    // Water highlights are authored after the canal surface but before every
    // bridge and road crossing. Cocos UI respects sibling order for these
    // world children, so later deck/crossing nodes always cover the ripples.
    for (let x = 140, index = 0; x <= 2840; x += 145, index++) {
      this.createCanalFlowMark(x, -1270, true, index * .17, 72 + index % 3 * 8);
    }
    [800, 1400, 2000, 2600].forEach((x, branchIndex) => {
      for (let y = -1390, index = 0; y >= -2040; y -= 135, index++) {
        this.createCanalFlowMark(x, y, false, branchIndex * .21 + index * .16, 78);
      }
    });

    let canalStart = 100;
    [1100, 1700, 2300].forEach(gap => {
      const end = gap - 70;
      this.addObstacle((canalStart + end) / 2, -1270, end - canalStart, 108, '田野主干水渠');
      canalStart = gap + 70;
      const bridgeShadow = this.localGraphics('CanalBridgeWaterShadow', this.world, gap, -1270, 190, 178, 11);
      bridgeShadow.fillColor = new Color(31, 66, 73, 115); bridgeShadow.roundRect(-76, -76, 152, 152, 18); bridgeShadow.fill();
      const wide = gap === 2300;
      this.pixelSprite(
        wide ? 'WideCanalBridgePixel' : 'CanalFootbridgePixel',
        wide ? 'canal-bridge-wide-v2' : 'canal-footbridge-v2',
        this.world, gap, -1270, wide ? 218 : 146, 190, 15,
      );
      this.createCanalBridgeRails(gap, -1270, wide);
    });
    this.addObstacle((canalStart + 2940) / 2, -1270, 2940 - canalStart, 108, '田野主干水渠');
    this.drawIrrigationCanalEndCap('FieldMainCanalEastCap', 2940, -1270, 88, 8, 'east');

    [800, 1400, 2000, 2600].forEach((x, index) => {
      this.drawFieldRoadCanalCrossing(x, -1705, 80 + index);
    });

    this.createFieldStorehouse('东北粮仓一', 2180, -555, 'field-storehouse-a');
    this.createFieldStorehouse('东北粮仓二', 2520, -555, 'field-storehouse-b');
    this.createFieldStorehouse('东北草料仓', 2860, -555, 'field-shelter');
    [2035, 2215, 2395, 2575, 2755, 2935].forEach(x => {
      this.pixelSprite('GranaryFence', 'mud-fence-straight', this.world, x, -430, 150, 72, 15);
      this.addObstacle(x, -430, 170, 60, 'GranaryFenceSolid', RegionId.FIELDS);
    });

    this.pixelSprite('FieldStrawPileA', 'straw-stack', this.world, 690, -610, 112, 126, 18);
    this.addObstacle(690, -616, 82, 108, 'FieldStrawPileASolid', RegionId.FIELDS);
    this.pixelSprite('FieldStrawPileB', 'straw-stack', this.world, 2050, -885, 98, 112, 18);
    this.addObstacle(2050, -891, 72, 96, 'FieldStrawPileBSolid', RegionId.FIELDS);
    this.pixelSprite('FieldStoneMill', 'stone-mill', this.world, 1430, -620, 124, 112, 19);
    this.pixelSprite('FieldWaterUrnA', 'field-water-urn', this.world, 1850, -875, 102, 110, 19);
    this.addObstacle(1430, -633, 112, 84, 'FieldStoneMillSolid', RegionId.FIELDS);
    this.addObstacle(1850, -881, 80, 88, 'FieldWaterUrnASolid', RegionId.FIELDS);

    [[430, -510], [2870, -930], [430, -2040], [2860, -2035]].forEach((p, i) => this.createTree(p[0], p[1], 100 + i));
    // Keep roadside tree trunks behind the north fence so the two-tile trunk
    // road remains continuously traversable.
    [[520, -555], [1280, -560], [1910, -555]].forEach((p, i) => this.createTreeSized(p[0], p[1], 120 + i, .72));
    [[420, -880], [900, -1400], [1550, -1370], [2240, -1390], [2860, -1460]].forEach((p, i) => {
      this.pixelSprite(`JujubeBush${i}`, 'jujube-bush', this.world, p[0], p[1], 86, 78, 13);
      this.addObstacle(p[0], p[1] - 4, 86, 68, `JujubeBush${i}Solid`, RegionId.FIELDS);
    });
    [[300, -520], [580, -2110], [980, -2110], [1540, -2110], [2050, -2110], [2700, -2110], [2920, -1050]].forEach((p, i) => this.pixelSprite(`FoxtailGrass${i}`, 'foxtail-grass', this.world, p[0], p[1], 68, 74, 12));
    [[360, -2050], [1020, -2050], [1660, -2080], [2710, -2070], [2890, -1170]].forEach((p, i) => this.pixelSprite(`FieldBoundaryStone${i}`, 'field-stone-cluster', this.world, p[0], p[1], 92, 78, 12));
    this.worldLabel('郊外田野', 1420, -475, 25, new Color(92, 65, 38));
    this.fieldVisualNodes = this.world.children.slice(fieldVisualStartIndex);
    this.updateFieldVisibility();
  }

  private createCanalBridgeRails(x: number, y: number, wide: boolean) {
    // Move the physical rail 3 px inward so playerRadius stays inside the
    // painted rail interior without changing bridge sprites or entrances.
    const railX = (wide ? 76 : 53) - 3;
    const railWidth = wide ? 28 : 24;
    const halfHeight = 82;
    // The bridge sprite already carries authored rails. The old Graphics
    // duplicate is removed; only these narrow physical rail strips remain.
    this.addObstacle(x - railX, y, railWidth, halfHeight * 2 + 8, wide ? '宽桥西栏杆' : '木桥西栏杆');
    this.addObstacle(x + railX, y, railWidth, halfHeight * 2 + 8, wide ? '宽桥东栏杆' : '木桥东栏杆');
  }

  private drawLayeredIrrigationCanal(
    name: string,
    centerX: number,
    centerY: number,
    length: number,
    waterWidth: number,
    horizontal: boolean,
    z: number,
  ) {
    const outerWidth = waterWidth + 58;
    const g = this.localGraphics(name, this.world, centerX, centerY, length + 34, outerWidth + 26, z);
    const segments = Math.max(4, Math.ceil(length / 92));
    const drawBand = (width: number, color: Color, offsetY = 0) => {
      const top: Array<[number, number]> = [];
      const bottom: Array<[number, number]> = [];
      for (let index = 0; index <= segments; index++) {
        const px = -length / 2 + length * index / segments;
        // Straight parallel bank bands prevent the old independently-jittered
        // polygons from forming diamond-shaped seams at canal joins.
        top.push([Math.round(px / 3) * 3, Math.round((width / 2 + offsetY) / 3) * 3]);
        bottom.push([Math.round(px / 3) * 3, Math.round((-width / 2 + offsetY) / 3) * 3]);
      }
      g.fillColor = color;
      g.moveTo(top[0][0], top[0][1]);
      top.slice(1).forEach(point => g.lineTo(point[0], point[1]));
      bottom.slice().reverse().forEach(point => g.lineTo(point[0], point[1]));
      g.close(); g.fill();
    };
    drawBand(waterWidth + 58, new Color(82, 83, 69, 215), -2);
    drawBand(waterWidth + 48, new Color(111, 119, 67), 0);
    drawBand(waterWidth + 36, new Color(163, 112, 55), -1);
    drawBand(waterWidth + 23, new Color(211, 163, 84), 0);
    drawBand(waterWidth + 12, new Color(53, 72, 65), 0);
    drawBand(waterWidth, new Color(55, 128, 159), 1);
    drawBand(Math.max(12, waterWidth - 16), new Color(20, 72, 104, 105), 1);

    // Pixel-sized soil clods, damp bank shadows and staggered chevrons keep
    // the long water surface from reading as a single coloured strip.
    for (let i = 0; i < Math.max(4, Math.floor(length / 30)); i++) {
      const x = -length / 2 + 14 + i * 30;
      const side = i % 2 === 0 ? 1 : -1;
      g.fillColor = i % 3 === 0 ? new Color(192, 137, 67, 190) : new Color(93, 67, 43, 210);
      g.rect(x, side * (waterWidth / 2 + 9), 8 + i % 4 * 2, 4 + i % 3); g.fill();
      g.fillColor = i % 4 === 0 ? new Color(43, 68, 58, 210) : new Color(60, 78, 59, 175);
      g.rect(x - 5, side * (waterWidth / 2 + 2), 12 + i % 3 * 2, 3); g.fill();
      if (i % 3 === 0) {
        const waterY = -waterWidth * .2 + (i % 4) * Math.max(4, waterWidth * .12);
        g.strokeColor = i % 2 === 0 ? new Color(128, 194, 198, 160) : new Color(12, 69, 105, 175);
        g.lineWidth = 2;
        g.moveTo(x - 9, waterY + 3); g.lineTo(x, waterY); g.lineTo(x + 10, waterY + 3); g.stroke();
      }
      if (i % 7 === 2) {
        const grassY = side * (waterWidth / 2 + 15);
        g.strokeColor = new Color(74, 104, 55, 190); g.lineWidth = 2;
        g.moveTo(x, grassY); g.lineTo(x - 3, grassY + side * 9);
        g.moveTo(x + 4, grassY); g.lineTo(x + 8, grassY + side * 8); g.stroke();
      }
    }
    if (!horizontal) g.node.setRotationFromEuler(0, 0, 90);
  }

  private drawIrrigationCanalEndCap(
    name: string,
    x: number,
    y: number,
    waterWidth: number,
    z: number,
    orientation: 'south' | 'east',
  ) {
    const outerWidth = waterWidth + 58;
    const g = this.localGraphics(name, this.world, x, y, outerWidth + 38, outerWidth + 38, z);
    const bands: Array<[number, Color]> = [
      [waterWidth + 58, new Color(82, 83, 69, 215)],
      [waterWidth + 48, new Color(111, 119, 67)],
      [waterWidth + 36, new Color(163, 112, 55)],
      [waterWidth + 23, new Color(211, 163, 84)],
      [waterWidth + 12, new Color(53, 72, 65)],
      [waterWidth, new Color(55, 128, 159)],
      [Math.max(12, waterWidth - 16), new Color(20, 72, 104, 105)],
    ];
    bands.forEach(([diameter, color]) => {
      g.fillColor = color;
      if (orientation === 'south') {
        g.rect(-diameter / 2, -18, diameter, 36);
      } else {
        g.rect(-18, -diameter / 2, 36, diameter);
      }
      g.fill();
    });
    // Straight terminal faces keep the canal edge crisp without adding a round plug.
    g.fillColor = new Color(192, 137, 67, 190);
    g.rect(orientation === 'south' ? -outerWidth * .31 : -12, orientation === 'south' ? -24 : -outerWidth * .31, 9, 4); g.fill();
    g.fillColor = new Color(93, 67, 43, 210);
    g.rect(orientation === 'south' ? outerWidth * .22 : 8, orientation === 'south' ? 18 : outerWidth * .22, 7, 4); g.fill();
    g.strokeColor = new Color(128, 194, 198, 160); g.lineWidth = 2;
    if (orientation === 'south') {
      g.moveTo(-10, 4); g.lineTo(0, 1); g.lineTo(10, 4);
    } else {
      g.moveTo(-4, 10); g.lineTo(-1, 0); g.lineTo(-4, -10);
    }
    g.stroke();
  }

  private drawIrrigationJunction(x: number, y: number, variant: number) {
    const g = this.localGraphics(`IrrigationWaterJunction${variant}`, this.world, x, y, 112, 128, 11);
    // Blend the two water runs with a compact pool instead of the old stepped
    // cross-shaped cover.
    g.fillColor = new Color(55, 128, 159);
    g.roundRect(-45, -37, 90, 74, 9); g.fill();
    g.fillColor = new Color(20, 72, 104, 88);
    g.roundRect(-30, -23, 60, 46, 7); g.fill();
    g.strokeColor = new Color(121, 181, 187, 145); g.lineWidth = 2;
    [-26, -4, 19].forEach((py, index) => {
      const shift = (variant + index) % 2 === 0 ? 6 : -5;
      g.moveTo(-16 + shift, py + 3); g.lineTo(shift, py); g.lineTo(16 + shift, py + 3);
    });
    g.stroke();
    [-37, 37].forEach((px, index) => {
      g.fillColor = index === 0 ? new Color(126, 132, 105) : new Color(153, 139, 96);
      g.ellipse(px, -34 + ((variant + index) % 3) * 30, 7, 4); g.fill();
    });
  }

  private drawFieldRoadCanalCrossing(x: number, y: number, variant: number) {
    const g = this.localGraphics(`FieldRoadCanalCrossing${variant}`, this.world, x, y, 174, 60, 13);
    g.fillColor = new Color(174, 132, 73);
    g.rect(-87, -24, 174, 48); g.fill();
    g.strokeColor = new Color(119, 91, 56, 145); g.lineWidth = 2;
    g.moveTo(-87, 23); g.lineTo(87, 23);
    g.moveTo(-87, -23); g.lineTo(87, -23);
    g.stroke();
    for (let i = 0; i < 7; i++) {
      const px = -70 + i * 23;
      const py = ((variant + i * 17) % 33) - 16;
      g.fillColor = i % 2 === 0 ? new Color(95, 70, 45, 150) : new Color(216, 174, 101, 150);
      g.rect(px, py, 4 + i % 3, 2 + i % 2); g.fill();
    }
  }

  private createCanalFlowMark(x: number, y: number, horizontal: boolean, phase: number, distance: number) {
    const g = this.localGraphics('MovingCanalHighlight', this.world, x, y, 34, 18, 12);
    g.strokeColor = new Color(139, 199, 200, 185); g.lineWidth = 2;
    g.moveTo(-12, 3); g.lineTo(-2, 0); g.lineTo(8, 3);
    g.moveTo(-7, -4); g.lineTo(1, -6); g.lineTo(11, -3); g.stroke();
    if (!horizontal) g.node.setRotationFromEuler(0, 0, 90);
    this.canalFlowMarks.push({ node: g.node, startX: x, startY: y, distance, horizontal, phase, speed: .22 + (phase % .13) });
  }

  private drawForest() {
    const terrain = this.graphics('MountainThreeTierTerrain', this.world, 4);
    // Translucent tier tints retain the authored grass texture underneath.
    terrain.fillColor = new Color(128, 137, 74, 92); terrain.rect(3000, -2200, 800, 1800); terrain.fill();
    terrain.fillColor = new Color(114, 120, 67, 96); terrain.rect(3800, -2200, 900, 1800); terrain.fill();
    terrain.fillColor = new Color(145, 126, 70, 104); terrain.rect(4700, -2200, 1000, 1800); terrain.fill();

    const outerCliff = this.graphics('MountainOuterCliffs', this.world, 12);
    outerCliff.strokeColor = new Color(86, 61, 41, 82); outerCliff.lineWidth = 84;
    outerCliff.moveTo(3060, -420); outerCliff.lineTo(5700, -420);
    outerCliff.moveTo(3060, -2180); outerCliff.lineTo(5700, -2180);
    outerCliff.moveTo(5680, -420); outerCliff.lineTo(5680, -2180); outerCliff.stroke();
    outerCliff.strokeColor = new Color(158, 112, 61, 145); outerCliff.lineWidth = 36;
    outerCliff.moveTo(3060, -448); outerCliff.lineTo(5660, -448);
    outerCliff.moveTo(3060, -2152); outerCliff.lineTo(5660, -2152);
    outerCliff.moveTo(5652, -448); outerCliff.lineTo(5652, -2152); outerCliff.stroke();
    // HIGHLAND east boundary split for road gap at Y=-1346 to -1254 (exit trigger area)
    this.addObstacle(5700, -873, 64, 946, 'HighlandBoundaryEastTop', RegionId.HIGHLAND);
    this.addObstacle(5700, -1727, 64, 946, 'HighlandBoundaryEastBottom', RegionId.HIGHLAND);

    const mountainRoads = this.graphics('MountainLoopRoads', this.world, 14);
    const mainRoad: Array<[number, number]> = [[3110, -790], [3370, -820], [3730, -1030], [4100, -1210], [4600, -1320], [4920, -1300], [5350, -1120], [5580, -1260]];
    mountainRoads.strokeColor = new Color(94, 78, 57); mountainRoads.lineWidth = 98;
    this.strokeSmoothPath(mountainRoads, mainRoad); mountainRoads.stroke();
    mountainRoads.strokeColor = new Color(179, 158, 111); mountainRoads.lineWidth = 66;
    this.strokeSmoothPath(mountainRoads, mainRoad); mountainRoads.stroke();
    mountainRoads.strokeColor = new Color(154, 124, 77); mountainRoads.lineWidth = 42;
    const loops: Array<Array<[number, number]>> = [
      [[3340, -820], [3170, -1250], [3370, -1780], [3650, -1430], [3730, -1030]],
      [[4100, -1210], [4050, -760], [4430, -620], [4590, -980], [4600, -1320]],
      [[4050, -1530], [4300, -1910], [4560, -1700], [4600, -1320]],
      [[4920, -1300], [4960, -1860], [5400, -1870], [5580, -1260]],
      [[4920, -1300], [5200, -760], [5550, -820], [5580, -1260]],
    ];
    loops.forEach(path => { this.strokeSmoothPath(mountainRoads, path); mountainRoads.stroke(); });
    [[3260,-790],[3570,-930],[3920,-1120],[4290,-1260],[4480,-1280],[4870,-1280],[5210,-1170],[5480,-1220]].forEach((p, i) => {
      this.pixelSprite(`MountainRoadStone${i}`, 'field-stone-cluster', this.world, p[0], p[1], 58, 48, 16);
    });

    const landforms = this.graphics('MountainLandforms', this.world, 6);
    landforms.fillColor = new Color(93, 125, 68, 108); landforms.ellipse(4220, -880, 250, 145); landforms.ellipse(4440, -1750, 220, 130); landforms.fill();
    landforms.fillColor = new Color(183, 145, 83, 118); landforms.ellipse(5220, -1410, 330, 200); landforms.fill();
    [[3330, -520], [3650, -1980], [3970, -520], [4580, -2050], [4860, -520], [5550, -1980]].forEach((p, i) => {
      landforms.fillColor = i % 2 ? new Color(129, 100, 62) : new Color(146, 111, 64);
      landforms.circle(p[0], p[1], 88); landforms.fill();
    });

    // Low tier: scattered stones and sparse trees.
    [[3180, -580, .55], [3440, -1140, .62], [3200, -1720, .52], [3600, -1910, .68]].forEach(p => {
      this.createRock(p[0], p[1], p[2], RegionId.HIGHLAND);
    });
    [[3200, -920], [3510, -550], [3420, -1530], [3680, -1810]].forEach((p, i) => this.createTreeSized(p[0], p[1], 200 + i, .72 + (i % 2) * .12));
    // Middle tier: dense woodland and grouped rock masses.
    const middleTrees = [[3940,-560],[4180,-610],[4440,-560],[3990,-1050],[4320,-1110],[4520,-930],[3980,-1510],[4210,-1580],[4490,-1480],[4020,-1980],[4370,-2000],[4550,-1860]];
    middleTrees.forEach((p, i) => this.createTreeSized(p[0], p[1], 220 + i, .82 + (i % 3) * .08));
    [[4080, -1320, .88], [4340, -1360, 1.02], [4460, -760, .86], [4140, -1880, .94]].forEach(p => {
      this.createRock(p[0], p[1], p[2], RegionId.HIGHLAND);
    });
    // Summit: giant standing rocks, short grass, and only isolated trees.
    [[4920, -560, 1.22], [5350, -650, 1.35], [5520, -1540, 1.4], [5070, -1950, 1.18]].forEach(p => {
      this.createRock(p[0], p[1], p[2], RegionId.HIGHLAND);
    });
    [[4880, -960], [5480, -980], [5270, -1960]].forEach((p, i) => this.createTreeSized(p[0], p[1], 250 + i, .88));

    [[3110,-520],[3290,-1450],[3590,-720],[3890,-920],[4190,-1420],[4540,-560],[4860,-1680],[5200,-580],[5480,-1800]].forEach((p, i) => this.pixelSprite(`MountainGrass${i}`, i % 2 ? 'foxtail-grass' : 'roadside-grass-clump', this.world, p[0], p[1], 70, 72, 13));
    [[3150,-760],[3260,-1320],[3500,-1680],[3650,-660],[3950,-820],[4070,-980],[4170,-1760],[4400,-820],[4530,-1650],[4860,-820],[5010,-1100],[5140,-1700],[5400,-1420],[5520,-740]].forEach((p, i) => {
      const asset = i % 3 === 0 ? 'jujube-bush' : (i % 2 ? 'grass-clump' : 'foxtail-grass');
      const width = 66 + (i % 3) * 8;
      const height = 64 + (i % 2) * 10;
      this.pixelSprite(`MountainUnderbrush${i}`, asset, this.world, p[0], p[1], width, height, 16);
      if (asset === 'jujube-bush') this.addObstacle(p[0], p[1] - 3, width, height - 8, `MountainUnderbrush${i}Solid`, RegionId.HIGHLAND);
    });
    [[3820,-610],[3790,-820],[3800,-1360],[3790,-1900],[4700,-650],[4690,-1030],[4700,-1620],[4690,-2020],[3300,-430],[5200,-430]].forEach((p, i) => {
      this.pixelSprite(`MountainCliffGrass${i}`, i % 2 ? 'roadside-grass-clump' : 'foxtail-grass', this.world, p[0], p[1], 68, 74, 15);
    });

    [[4300, -430, 90, 52], [5150, -2170, 112, 58], [5480, -430, 72, 45]].forEach((p, i) => {
      const cave = this.localGraphics(`NaturalRockCave${i}`, this.world, p[0], p[1], p[2], p[3], 13);
      cave.fillColor = new Color(52, 43, 38); cave.ellipse(0, 0, p[2] / 2, p[3] / 2); cave.fill();
    });
    this.worldLabel('山林高地 · 三层台地', 4300, -475, 25, new Color(235, 230, 181));
  }

  private drawOraclePit() {
    // Reinforced full-width north wall with no opening; former gate deleted.
    this.createLayeredRitualWallSegment('北墙', 2900, -2484, 4600, true, 0);
    this.createLayeredRitualWallSegment('西墙', 646, -3270, 1662, false, 19);
    this.createLayeredRitualWallSegment('东墙', 5154, -3270, 1662, false, 25);

    const roadPaths: Array<Array<[number, number]>> = [
      [[2300, -2520], [2270, -2730], [2040, -2910], [1580, -3070]],
      [[2270, -2730], [2640, -2940], [2980, -3260], [2860, -3650], [2290, -3800]],
      [[2640, -2940], [3240, -2820], [3750, -2920], [4210, -3160]],
      [[1580, -3070], [1210, -3350], [1510, -3700], [2290, -3800]],
      [[4210, -3160], [4510, -3510], [4170, -3830], [2860, -3650]],
      [[2290, -3800], [2290, -4100]],
    ];
    const roadShadow = this.graphics('RoyalRitualPathShadow', this.world, 5);
    const roadSoil = this.graphics('RoyalRitualPathSoil', this.world, 6);
    const roadRuts = this.graphics('RoyalRitualPathRuts', this.world, 7);
    roadPaths.forEach(path => {
      roadShadow.strokeColor = new Color(52, 43, 36, 190); roadShadow.lineWidth = 66; this.strokeSmoothPath(roadShadow, path); roadShadow.stroke();
      roadSoil.strokeColor = new Color(151, 111, 66); roadSoil.lineWidth = 50; this.strokeSmoothPath(roadSoil, path); roadSoil.stroke();
      roadRuts.strokeColor = new Color(206, 160, 91, 115); roadRuts.lineWidth = 12; this.strokeSmoothPath(roadRuts, path); roadRuts.stroke();
    });
    [[2300,-2520],[2270,-2730],[2640,-2940],[1580,-3070],[2860,-3650],[2290,-3800],[4210,-3160]].forEach((p, index) =>
      this.drawDirtRoadJunction(p[0], p[1], 90 + index, index < 3 ? 39 : 31, 8));

    // Gate at north entry deleted — north wall is now continuous.

    // Royal-Tomb landmarks use authored transparent sprites.  Their physical
    // footprints stay deliberately below the visual crown/banners so collision
    // follows the real base instead of the full painted rectangle.
    this.createRoyalTombLandmark('RoyalTombRitualAltar', 'royal_tomb_ritual_altar', 1450, -3190, 720, 480, {
      footY: -3360, halfWidth: 292, coverHeight: 462,
    });
    this.addObstacle(1450, -3260, 584, 200, 'RoyalTombRitualAltarSolid', RegionId.ROYAL_TOMB);
    this.worldLabel('王陵祭祀台', 1450, -2840, 21, new Color(237, 202, 125));

    this.clearRoyalTombBurialMoundRecords();
    this.createRoyalTombStaticLandmark('RoyalTombBurialMound', 'royal_tomb_burial_mound', 2860, -3450, 900, 600);
    this.drawRoyalTombBurialMoundCollision();
    this.worldLabel('王陵封土', 2860, -3115, 20, new Color(224, 192, 125));

    // Eastern oracle-bone kiln/cellar uses the same low, grounded approach as
    // the altar: its contact base is solid, while its upper walls are visual.
    const pitX = 4300; const pitY = -3425; const pitW = 960; const pitH = 640;
    this.clearRoyalTombLandmarkRecords('RoyalTombOutdoorOracleKiln');
    this.createRoyalTombStaticLandmark('RoyalTombOutdoorOracleKiln', 'royal_tomb_oracle_kiln', pitX, pitY, pitW, pitH);
    // The kiln is a filled archaeological work area, not an enterable room.
    // Horizontal strata follow its stepped visible mass without an outer-box
    // collider or any dynamic occlusion record.
    [
      [pitX, -3700, 840, 70, 'SouthBase'], [pitX, -3618, 880, 80, 'SouthWorkFloor'],
      [pitX, -3536, 900, 80, 'LowerKilnBody'], [pitX, -3454, 900, 80, 'MiddleKilnBody'],
      [pitX, -3372, 900, 80, 'UpperKilnBody'], [pitX, -3290, 880, 80, 'NorthWorkFloor'],
      [pitX, -3208, 860, 80, 'NorthWallBase'], [pitX, -3135, 760, 70, 'NorthWallTop'],
    ].forEach(([x, y, w, h, suffix]) => this.addObstacle(
      x as number, y as number, w as number, h as number,
      `RoyalTombOutdoorOracleKiln${suffix as string}Solid`, RegionId.ROYAL_TOMB,
    ));
    this.worldLabel('室外甲骨窑穴', pitX, -2940, 21, new Color(235, 205, 139));

    [[840,-2800],[900,-3710],[2030,-2760],[3500,-2740],[4940,-2860],[4930,-3900]].forEach((p, i) => {
      const scale = .55 + (i % 3) * .14;
      this.createRock(p[0], p[1], scale, RegionId.ROYAL_TOMB);
    });
    [[930,-3480],[2020,-3520],[3510,-3880],[4830,-3160]].forEach((p, i) => {
      const isPottery = i % 2 === 1;
      this.pixelSprite(`RoyalRitualRelic${i}`, isPottery ? 'pottery-jar-cluster' : 'field-stone-cluster', this.world, p[0], p[1], 68, 62, 15);
      if (isPottery) this.addObstacle(p[0], p[1] - 4, 62, 56, `RoyalTombPotterySolid${i}`, RegionId.ROYAL_TOMB);
    });
    this.worldLabel('甲骨窑穴 · 王陵祭祀区', 3320, -2570, 27, new Color(248, 221, 151));
  }

  private createLayeredRitualWallSegment(
    name: string, x: number, y: number, length: number, horizontal: boolean, variant: number,
  ) {
    // Reuse the same low earthen ridge language as the field boundary. The
    // continuous graphics forms the collision silhouette and the authored
    // pixel tiles add the grass-topped soil/stone face used elsewhere.
    const ridge = this.localGraphics(
      `RitualEarthenWallBase-${name}`, this.world, x, y,
      horizontal ? length + 24 : 104,
      horizontal ? 104 : length + 24,
      12,
    );
    ridge.fillColor = new Color(68, 51, 37, 175);
    if (horizontal) ridge.roundRect(-length / 2 - 4, -39, length + 8, 74, 8);
    else ridge.roundRect(-39, -length / 2 - 4, 74, length + 8, 8);
    ridge.fill();
    ridge.fillColor = new Color(112, 76, 43);
    if (horizontal) ridge.rect(-length / 2, -32, length, 62);
    else ridge.rect(-32, -length / 2, 62, length);
    ridge.fill();
    ridge.fillColor = new Color(161, 120, 65);
    if (horizontal) ridge.rect(-length / 2, 14, length, 16);
    else ridge.rect(13, -length / 2, 17, length);
    ridge.fill();

    const tileStep = horizontal ? 174 : 170;
    const tileCount = Math.ceil(length / tileStep);
    for (let index = 0; index < tileCount; index++) {
      const offset = -length / 2 + (index + .5) * (length / tileCount);
      this.pixelSprite(
        `RitualEarthenWall-${name}-${index}`,
        horizontal ? 'wall-horizontal' : 'wall-vertical',
        this.world,
        horizontal ? x + offset : x,
        horizontal ? y : y + offset,
        horizontal ? Math.min(182, length / tileCount + 12) : 84,
        horizontal ? 82 : Math.min(182, length / tileCount + 12),
        14,
      );
      if (horizontal && (index + variant) % 5 === 1) {
        this.pixelSprite(`RitualWallGrass-${name}-${index}`, 'foxtail-grass', this.world, x + offset + 26, y + 28, 42, 46, 15);
      }
    }
    this.addObstacle(
      horizontal ? x : x,
      horizontal ? y - 29 : y,
      horizontal ? length : 24,
      horizontal ? 18 : length,
      `甲骨窑穴${name}基座`,
    );
  }

  private createLayeredRitualWallSegmentLegacy(
    name: string, x: number, y: number, length: number, horizontal: boolean, variant: number,
  ) {
    const g = this.localGraphics(
      `LayeredRitualWall-${name}`, this.world, x, y,
      horizontal ? length + 80 : 210,
      horizontal ? 210 : length + 90,
      12,
    );
    if (horizontal) {
      const chunkCount = Math.max(3, Math.ceil(length / 78));
      const chunkWidth = length / chunkCount;
      for (let index = 0; index < chunkCount; index++) {
        const left = -length / 2 + index * chunkWidth;
        const step = ((index + variant) % 7 === 0 ? 7 : (index + variant) % 5 === 0 ? -4 : (index + variant) % 3 === 0 ? 3 : 0)
          + (index === 0 || index === chunkCount - 1 ? 4 : 0);
        const width = chunkWidth + 2;

        // Lower terrain buffer and a dark contact shadow separate the raised
        // foundation from the lower map instead of cutting the ground flat.
        g.fillColor = new Color(91, 73, 49, 72);
        g.rect(left - 5, -108 + step, width + 10, 35); g.fill();
        g.fillColor = new Color(157, 120, 67);
        g.moveTo(left - 4, -88 + step); g.lineTo(left + width + 5, -91 + step);
        g.lineTo(left + width - 1, -57 + step); g.lineTo(left + 2, -54 + step); g.close(); g.fill();
        g.fillColor = new Color(69, 56, 44, 210);
        g.rect(left, -60 + step, width, 16); g.fill();

        // Projecting earthen foundation, darker than the wall face.
        g.fillColor = new Color(101, 72, 49);
        g.rect(left - 3, -48 + step, width + 6, 27); g.fill();
        g.fillColor = new Color(128, 88, 53);
        g.rect(left, -43 + step, width, 14); g.fill();

        // Main wall face: three value bands and alternating brick courses.
        g.fillColor = new Color(79, 54, 42);
        g.rect(left, -25 + step, width, 47); g.fill();
        g.fillColor = new Color(112, 71, 47);
        g.rect(left, -19 + step, width, 35); g.fill();
        g.fillColor = new Color(133, 85, 52, 190);
        g.rect(left, 7 + step, width, 9); g.fill();

        // Wide bright cap reads as the visible upper plane of the wall.
        g.fillColor = new Color(171, 126, 69);
        g.rect(left - 4, 19 + step, width + 8, 23); g.fill();
        g.fillColor = new Color(211, 166, 95);
        g.rect(left - 2, 32 + step, width + 4, 8); g.fill();
        g.fillColor = new Color(231, 190, 116, 165);
        g.rect(left + 3, 36 + step, Math.max(12, width * .42), 4); g.fill();

        // Brick joints are intentionally offset by row and occasionally
        // interrupted, preventing a repeated flat wallpaper pattern.
        g.strokeColor = new Color(55, 43, 37, 185); g.lineWidth = 2;
        [-14, 1, 15].forEach((rowY, row) => {
          g.moveTo(left, rowY + step); g.lineTo(left + width, rowY + step);
          const jointX = left + 16 + ((index + row + variant) % 3) * 13;
          g.moveTo(jointX, rowY - 12 + step); g.lineTo(jointX, rowY + step);
          if (jointX + 31 < left + width) { g.moveTo(jointX + 31, rowY + step); g.lineTo(jointX + 31, rowY + 12 + step); }
        });
        g.stroke();

        // Rubble, shallow soil flecks and two vegetation bands provide the
        // field-to-wall and foundation-to-lower-ground transitions.
        for (let stone = 0; stone < 3; stone++) {
          const sx = left + 11 + stone * Math.max(15, width / 3.2) + ((index + stone) % 2) * 5;
          const sy = -75 + step + ((index + stone) % 3) * 5;
          g.fillColor = stone === 0 ? new Color(85, 80, 67) : stone === 1 ? new Color(139, 127, 93) : new Color(181, 145, 84);
          g.ellipse(sx, sy, 5 + (index + stone) % 4, 3 + stone % 2); g.fill();
        }
        g.fillColor = new Color(80, 105, 58, 195);
        [left + 8, left + width * .54].forEach((grassX, grassIndex) => {
          if ((index + grassIndex + variant) % 3 === 1) return;
          g.rect(grassX, -101 + step, 3, 14 + (index + grassIndex) % 6);
          g.rect(grassX + 5, -99 + step, 2, 10); g.fill();
        });
        g.fillColor = new Color(102, 124, 68, 145);
        if ((index + variant) % 2 === 0) { g.rect(left + width * .28, 43 + step, 3, 10); g.rect(left + width * .28 + 5, 42 + step, 2, 7); g.fill(); }
      }
      this.addObstacle(x, y - 47, length, 22, `甲骨窑穴${name}基座`);
      this.depthOccluders.push({
        node: g.node, footY: y - 105, halfWidth: length / 2 + 8,
        coverHeight: 164, baseZ: 12, foregroundZ: 99,
      });
      return;
    }

    // Side walls use the same materials turned into a stepped vertical edge:
    // broad soil buffer, dark base, wall face and a narrow highlighted top.
    const chunkCount = Math.max(3, Math.ceil(length / 76));
    const chunkHeight = length / chunkCount;
    for (let index = 0; index < chunkCount; index++) {
      const bottom = -length / 2 + index * chunkHeight;
      const step = (index + variant) % 6 === 0 ? 7 : (index + variant) % 4 === 0 ? -5 : (index + variant) % 3 === 0 ? 3 : 0;
      const height = chunkHeight + 2;
      g.fillColor = new Color(112, 91, 57, 78); g.rect(-72 + step, bottom - 3, 144, height + 6); g.fill();
      g.fillColor = new Color(156, 116, 65); g.rect(-60 + step, bottom, 120, height); g.fill();
      g.fillColor = new Color(72, 55, 43, 205); g.rect(-48 + step, bottom, 96, height); g.fill();
      g.fillColor = new Color(106, 68, 46); g.rect(-34 + step, bottom, 68, height); g.fill();
      g.fillColor = new Color(172, 126, 69); g.rect(-14 + step, bottom - 2, 27, height + 4); g.fill();
      g.fillColor = new Color(216, 171, 99, 190); g.rect(-9 + step, bottom + 3, 7, height - 6); g.fill();
      g.strokeColor = new Color(55, 42, 36, 175); g.lineWidth = 2;
      g.moveTo(-33 + step, bottom + height * .52); g.lineTo(33 + step, bottom + height * .52);
      g.moveTo(step, bottom); g.lineTo(step, bottom + height * .52); g.stroke();
      if ((index + variant) % 2 === 0) {
        g.fillColor = new Color(87, 109, 59);
        g.rect(-69 + step, bottom + 10, 3, 14); g.rect(64 + step, bottom + height - 25, 3, 13); g.fill();
      }
      g.fillColor = new Color(132, 122, 91);
      g.circle(-57 + step, bottom + height * .72, 5); g.circle(55 + step, bottom + height * .25, 4); g.fill();
    }
    this.addObstacle(x, y, 24, length, `甲骨窑穴${name}基座`);
    this.depthOccluders.push({
      node: g.node, footY: y - length / 2 - 20, halfWidth: 82,
      coverHeight: length + 65, baseZ: 12, foregroundZ: 99,
    });
  }

  private createLayeredRitualGate(x: number, y: number) {
    // Raised gate platform and two stepped soil shoulders soften the wall gap.
    const terrain = this.localGraphics('RoyalRitualGateRaisedFoundation', this.world, x, y, 500, 300, 13);
    terrain.fillColor = new Color(62, 51, 42, 170);
    terrain.moveTo(-238, -111); terrain.lineTo(-182, 83); terrain.lineTo(-104, 70); terrain.lineTo(-82, -103); terrain.close(); terrain.fill();
    terrain.moveTo(238, -111); terrain.lineTo(182, 83); terrain.lineTo(104, 70); terrain.lineTo(82, -103); terrain.close(); terrain.fill();
    const terraceColors = [new Color(101, 71, 48), new Color(126, 87, 52), new Color(157, 116, 65), new Color(185, 142, 78)];
    for (let level = 0; level < 4; level++) {
      const inset = level * 18;
      terrain.fillColor = terraceColors[level];
      terrain.roundRect(-225 + inset, -98 + level * 17, 122 - inset * .42, 29, 6); terrain.fill();
      terrain.roundRect(103 + inset * .42, -98 + level * 17, 122 - inset * .42, 29, 6); terrain.fill();
      terrain.fillColor = new Color(219, 173, 98, 125);
      terrain.rect(-214 + inset, -78 + level * 17, 82 - inset * .34, 4); terrain.fill();
      terrain.rect(132 + inset * .34, -78 + level * 17, 82 - inset * .34, 4); terrain.fill();
    }
    // Deep tunnel recess and threshold levels establish an actual inward void.
    terrain.fillColor = new Color(39, 35, 33, 225); terrain.roundRect(-73, -104, 146, 180, 13); terrain.fill();
    terrain.fillColor = new Color(58, 48, 42, 220); terrain.roundRect(-61, -96, 122, 158, 10); terrain.fill();
    terrain.fillColor = new Color(111, 82, 54); terrain.rect(-58, -105, 116, 47); terrain.fill();
    terrain.fillColor = new Color(163, 123, 71);
    for (let step = 0; step < 4; step++) terrain.rect(-54 + step * 4, -106 + step * 12, 108 - step * 8, 8);
    terrain.fill();
    terrain.fillColor = new Color(78, 70, 58);
    [[-43,-87,8,5],[-19,-71,11,6],[13,-92,7,5],[34,-67,10,5],[-4,-101,6,4]].forEach(stone => {
      terrain.ellipse(stone[0], stone[1], stone[2], stone[3]); terrain.fill();
    });
    terrain.fillColor = new Color(90, 112, 59);
    [-205,-176,176,205].forEach((grassX, index) => {
      terrain.rect(grassX, -92 + index % 2 * 11, 3, 18); terrain.rect(grassX + 5, -88, 2, 11); terrain.fill();
    });

    const gate = this.localGraphics('RoyalRitualGateStructure', this.world, x, y, 360, 260, 27);
    // Stone plinths project forward from the raised wall base.
    [-96, 96].forEach((postX, index) => {
      gate.fillColor = new Color(57, 49, 43); gate.roundRect(postX - 38, -83, 76, 52, 7); gate.fill();
      gate.fillColor = index ? new Color(124, 105, 76) : new Color(137, 113, 79); gate.roundRect(postX - 33, -76, 66, 40, 5); gate.fill();
      gate.fillColor = new Color(193, 157, 94); gate.rect(postX - 28, -72, 42, 6); gate.fill();
      // Layered timber columns and inset panels.
      gate.fillColor = new Color(55, 39, 31); gate.rect(postX - 27, -44, 54, 116); gate.fill();
      gate.fillColor = new Color(111, 67, 41); gate.rect(postX - 20, -40, 40, 108); gate.fill();
      gate.fillColor = new Color(153, 94, 50); gate.rect(postX - 13, -35, 11, 98); gate.fill();
      gate.strokeColor = new Color(211, 158, 75); gate.lineWidth = 3;
      gate.moveTo(postX - 16, -18); gate.lineTo(postX + 16, 28); gate.moveTo(postX + 16, -18); gate.lineTo(postX - 16, 28); gate.stroke();
    });
    gate.fillColor = new Color(49, 34, 29); gate.roundRect(-145, 47, 290, 35, 6); gate.fill();
    gate.fillColor = new Color(125, 74, 41); gate.roundRect(-151, 53, 302, 25, 5); gate.fill();
    gate.fillColor = new Color(211, 150, 67); gate.rect(-139, 65, 278, 5); gate.fill();
    gate.strokeColor = new Color(64, 43, 32); gate.lineWidth = 5;
    [-67, 0, 67].forEach(beamX => { gate.moveTo(beamX - 24, 48); gate.lineTo(beamX, 76); gate.lineTo(beamX + 24, 48); }); gate.stroke();

    // Roof/eaves are a separate permanent foreground layer; the player walks
    // below them while the door recess and floor remain behind the actor.
    const eave = this.localGraphics('RoyalRitualGateForegroundEave', this.world, x, y, 440, 270, 108);
    eave.fillColor = new Color(42, 32, 28, 225);
    eave.moveTo(-190, 51); eave.lineTo(0, 128); eave.lineTo(190, 51); eave.lineTo(155, 20); eave.lineTo(-155, 20); eave.close(); eave.fill();
    eave.fillColor = new Color(89, 55, 37);
    eave.moveTo(-181, 58); eave.lineTo(0, 119); eave.lineTo(181, 58); eave.lineTo(150, 32); eave.lineTo(-150, 32); eave.close(); eave.fill();
    eave.fillColor = new Color(135, 81, 45);
    eave.moveTo(-162, 62); eave.lineTo(0, 108); eave.lineTo(162, 62); eave.lineTo(141, 46); eave.lineTo(-141, 46); eave.close(); eave.fill();
    eave.strokeColor = new Color(211, 151, 68); eave.lineWidth = 4;
    for (let beam = -128; beam <= 128; beam += 32) { eave.moveTo(beam, 49); eave.lineTo(beam * .62, 98 - Math.abs(beam) * .12); }
    eave.stroke();
    eave.fillColor = new Color(53, 37, 30); eave.rect(-165, 23, 330, 18); eave.fill();
    eave.fillColor = new Color(174, 105, 50); eave.rect(-154, 30, 308, 8); eave.fill();
    eave.fillColor = new Color(45, 31, 27, 210); eave.rect(-137, 14, 274, 9); eave.fill();
    this.fixedForegroundNodes.push(eave.node);

    this.addObstacle(x - 96, y - 77, 56, 24, '祭祀区城门西门楼基座');
    this.addObstacle(x + 96, y - 77, 56, 24, '祭祀区城门东门楼基座');
  }

  private createExcavationSites() {
    this.loadExcavationSpriteFrames();
    const layouts: Record<string, Array<[number, number]>> = {
      river: [
        // 洹水河畔·北岸河滩陆地（NPC 阿潍在(-4900,-700)、北桥在(-4900,795) 一带均为陆地）。
        // 原 river 坑坐标压在河道水域被整体 defer，现改布到北岸 y∈[-650,650] 河滩带，
        // 12 坑覆盖第二章 12 字，全部落在 RIVERBANK 同区，挖字箭头直接指向、不再跨区到城南。
        // 即便个别 seed 贴近水线，resolveExcavationPosition 会回退搜索到同 region 有效陆地。
        [-5800,-650],[-5400,-650],[-5000,-650],[-4600,-650],[-4200,-650],[-4000,-650],
        [-5600,0],[-5200,0],[-4800,0],[-4400,0],
        [-5400,650],[-4600,650],
      ],
      // field=FIELDS 内田野坑，现供第二/五/九章使用（玩家经脚本化 entry 直接落入 FIELDS）。
      // 第一章教学坑已迁出 FIELDS，改用下方 trial 区（出南城门直行即达的城南试炼场），
      // 因 FIELDS 北墙/地面从 x=140 起、南城门洞却在 x=0，玩家无法从 CITY 直行进入 FIELDS，
      // 原「出南城门直行即达」设计在实际 region 切换下是走不到的死区。
      field: [
        [200,-1100],[200,-1400],[480,-1100],[200,-1700],[480,-1400],
        [700,-1150],[1300,-1150],[1900,-1150],[2500,-1150],[2900,-1150],
        [700,-1500],[1300,-1500],[1900,-1500],[2500,-1500],[2900,-1500],
        [700,-1850],[1300,-1850],[1900,-1850],[2500,-1850],[2900,-1850],
      ],
      // 第一章教学坑(trial)：出南城门直行即达的城南试炼场(OUTSKIRTS 城南)中心 + 城内南门广场。
      // 玩家从 chapter-1-city-entry(188,20) 出南门后自己走几步即到，无需 teleport、
      // 不进 FIELDS，彻底避开 FIELDS 北墙/地面从 x=140 起、南城门却在 x=0 导致的死区。
      // 数组前 5 个（也是离出生点最近的 5 个）为教学坑（雨田水土地云），由
      // chapterPitPool 距离升序优先取；数组后 3 个（index>=5，城外更南处）为
      // 「拾遗补充坑」，createExcavationSites 里直接出拾遗字（见 reward 分支），
      // 让教学章挖完 5 字后还能在城南就近挖到拾遗字、不重复主线字。
      trial: [
        // 城内南门广场：让第一章前几字在教学区内就能挖到
        [-200, 80], [200, 160], [0, 280],
        // 南门外左侧可达荒地（x<140，避开 FIELDS 死区），逐步往南拉开距离
        [-250, -400], [80, -520], [-350, -700],
        // 以下 3 个为拾遗补充坑（index>=5，最远，挖完教学字再往南才到）
        [0, -860], [-450, -820],
      ],
      // lake 坑：城南西南湖湾（OUTSKIRTS 可达荒地）。坐标必须落在 OUTSKIRTS 可达区
      // (y in [-960,-240]，既在城南边界之上、又不进 CITY)，且 lakeRegion 边界已同步
      // 收紧到该可达带（bottom=-960,top=-300），resolveExcavationPosition 的 clamp 不会再
      // 把它拉回南墙死区(y<-960)。mapRegion=OUTSKIRTS，玩家经 RIVERBANK→北桥→OUTSKIRTS
      // 可步行到达，不再死循环。
      lake: [
        [-1500,-850],[-1050,-850],[-600,-850],
        [-1500,-600],[-1050,-600],[-600,-600],
        [-1500,-350],[-1050,-350],[-600,-350],
        [-1275,-500],
      ],
      royal: [
        [840,-2720],[1110,-2850],[850,-3330],[1120,-3820],[1980,-2760],
        [2100,-3350],[2450,-3910],[3380,-2870],[3510,-3760],[4820,-3780],
      ],
      forest: [
        [3300,-650],[3700,-650],[4100,-650],[4500,-650],[4900,-650],
        [3300,-1000],[3700,-1000],[4100,-1000],[4500,-1000],[4900,-1000],
        [3300,-1350],[3700,-1350],[4100,-1350],[4500,-1350],[4900,-1350],
        [3300,-1700],[3700,-1700],[4100,-1700],[4500,-1700],[4900,-1700],
        [3300,-2000],[3700,-2000],[4100,-2000],[4500,-2000],[4900,-2000],[5300,-2000],
      ],
    };
    // 不再排除 river 坑：现已改布到 RIVERBANK 北岸河滩陆地（见上方 river 布局），
    // 第二章挖字在河边同区完成，箭头直指，不再跨区到城南湖湾。
    (Object.keys(layouts) as ExcavationRegion[]).forEach(region => {
      layouts[region].forEach((seedPoint, index) => {
        const point = this.resolveExcavationPosition(seedPoint[0], seedPoint[1], region);
        const { root, sprite, glow } = this.spawnExcavationSiteNode(`${region}-${index}`, point.x, point.y);
        // 第一章教学坑(trial)只占用按距离排序后最近的 5 个（见 chapterPitPool）；
        // 其余 trial 坑作为「城内/城外近处的拾遗补充坑」，直接出拾遗字，避免教学章
        // 挖来挖去全是重复主线字。region 仍为 'trial'（可见可挖、不受主线后渐进
        // 揭示控制），仅 reward 走 rollSupplementReward（tier='supplement'）。
        const reward = (region === 'trial' && index >= 5)
          ? this.rollSupplementReward()
          : this.rollExcavationReward(region);
        const site: ExcavationSite = {
          id: `${region}-${index}`, root, sprite, glow, x: point.x, y: point.y,
          region,
          // trial 区横跨城内(CITY)与城南(OUTSKIRTS)：按坑实际坐标所属大区定 mapRegion，
          // 否则城内那几个教学坑会被误判成 OUTSKIRTS，导致玩家在城内时箭头却指向南城门、越走越远。
          mapRegion: region === 'trial'
            ? (this.inRegion(point.x, point.y, this.cityBoundary) ? RegionId.CITY : RegionId.OUTSKIRTS)
            : this.excavationRegionToMapRegion(region),
          active: true, revealed: true, respawnTimer: 0, holeTimer: 0, awaitingStudy: false,
          reward, storyTarget: false,
        };
        this.excavationSites.push(site);
        this.redrawExcavationSite(site);
      });
    });
    console.info('[YinXuCity] excavation sites ready:', this.excavationSites.length,
      '(RIVERBANK sites deferred until the content-migration phase)');
    this.createSupplementSites();
  }

  // 拾遗挖掘点：按需求散布整张可行走地图、彼此稀疏。开局隐藏，主线通关后才逐批现世。
  private createSupplementSites() {
    const target = RELIC_CARD_IDS.length; // 50 个拾遗字
    const bounds = this.supplementRegion;
    const MIN = YinXuCity.SUPPLEMENT_MIN_DISTANCE;
    // 确定性线性同余 PRNG：保证每次进游戏布局一致、可调试。
    let seed = 0x9e3779b9 >>> 0;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const points: Array<[number, number]> = [];
    const within = (x: number, y: number, spacing: number) =>
      this.isExcavationPositionValid(x, y, 'supplement', null, spacing) &&
      !points.some(p => Math.hypot(p[0] - x, p[1] - y) < spacing);
    const sample = (spacing: number) => {
      let guard = 0;
      while (points.length < target && guard < 60000) {
        guard++;
        const x = Math.round(bounds.left + 90 + rand() * (bounds.right - bounds.left - 180));
        const y = Math.round(bounds.bottom + 90 + rand() * (bounds.top - bounds.bottom - 180));
        if (within(x, y, spacing)) points.push([x, y]);
      }
    };
    sample(MIN);
    // 陆地分布不均时逐步放宽间距兜底，仍保证彼此不挤。
    for (let relaxed = 360; points.length < target && relaxed >= 260; relaxed -= 50) sample(relaxed);
    points.forEach((point, index) => {
      const { root, sprite, glow } = this.spawnExcavationSiteNode(`supplement-${index}`, point[0], point[1]);
      const site: ExcavationSite = {
        id: `supplement-${index}`, root, sprite, glow, x: point[0], y: point[1],
        region: 'supplement',
        mapRegion: RegionId.OUTSKIRTS,
        active: false, revealed: false, respawnTimer: 0, holeTimer: 0, awaitingStudy: false,
        reward: this.rollExcavationReward('supplement'), storyTarget: false,
      };
      this.excavationSites.push(site);
      this.supplementSites.push(site);
      this.redrawExcavationSite(site);
      root.active = false; // 开局隐藏，待主线通关后逐批揭示
    });
    console.info('[YinXuCity] supplement excavation sites prepared:', points.length, '/', target, '(hidden until main story complete, then revealed gradually)');
  }

  private spawnExcavationSiteNode(id: string, x: number, y: number): { root: Node; sprite: Sprite; glow: Graphics } {
    const root = new Node(`ExcavationSite-${id}`);
    root.parent = this.world;
    root.setPosition(x, y, 21);
    root.addComponent(UITransform).setContentSize(this.excavationNodeWidth, this.excavationNodeHeight);
    const spriteNode = new Node('ExcavationMoundSprite');
    const initialVisualHeight = this.EXCAVATION_VISUAL_HEIGHTS.idle;
    spriteNode.parent = root;
    spriteNode.setPosition(0, this.EXCAVATION_VISUAL_GROUND_Y + initialVisualHeight / 2, 0);
    spriteNode.addComponent(UITransform).setContentSize(this.EXCAVATION_VISUAL_WIDTH, initialVisualHeight);
    const sprite = spriteNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = true;
    sprite.color = Color.WHITE;
    const glowNode = new Node('ExcavationGlow');
    glowNode.parent = root; glowNode.setPosition(0, 0, -1);
    glowNode.addComponent(UITransform).setContentSize(this.excavationNodeWidth, this.excavationNodeHeight);
    const glow = glowNode.addComponent(Graphics);
    return { root, sprite, glow };
  }

  // 拾遗坑只产出拾遗字：未收集优先给新字，集满后重复转墨料，绝不混进主线字。
  private rollSupplementReward(): ExcavationReward {
    const pool = this.oracleCards.filter(card => SUPPLEMENT_CARD_IDS.has(card.id) && this.hasRealOracleGlyph(card));
    const uncollected = pool.filter(card => !this.save.unlockedOracleIds.includes(card.id));
    const finalPool = uncollected.length > 0 ? uncollected : pool;
    const card = finalPool[Math.floor(Math.random() * finalPool.length)];
    if (!card) {
      const minimum = 3;
      return { kind: 'ink', quality: null, cardId: null, amount: minimum + Math.floor(Math.random() * 4), tier: 'supplement', experience: 0, coins: 0 };
    }
    // 拾遗随机赏：墨料 / 卜官经验 / 不讲理（无额外赏）三选一。
    const r = Math.random();
    let amount = 0;
    let experience = 0;
    if (r < 0.4) {
      amount = 2 + Math.floor(Math.random() * 7); // 墨料 2~8
    } else if (r < 0.8) {
      experience = 3 + Math.floor(Math.random() * 7); // 卜官经验 3~9
    }
    // else：不讲理——仅拾得碎甲，无额外赏赐
    return { kind: 'oracle', quality: card.quality, cardId: card.id, amount, experience, coins: 0, tier: 'supplement' };
  }

  // 拾遗坑受主线通关后的渐进揭示调度控制（见 updateExcavationEffects / revealNextSupplementBatch）。

  private resolveExcavationPosition(seedX: number, seedY: number, region: ExcavationRegion, ignoreSite: ExcavationSite | null = null) {
    const bounds = region === 'supplement' ? this.supplementRegion
      : region === 'river' ? this.riverRegion : region === 'field' ? this.fieldRegion
      : region === 'lake' ? this.lakeRegion : region === 'forest' ? this.forestRegion
      : region === 'trial' ? this.trialRegion : this.tombRegion;
    // Authored seeds may sit exactly on a regional seam.  Pull them into the
    // usable interior before probing so world creation remains deterministic
    // and never performs hundreds of expensive full-map collision scans.
    seedX = this.clamp(seedX, bounds.left + 60, bounds.right - 60);
    seedY = this.clamp(seedY, bounds.bottom + 60, bounds.top - 60);
    const candidateIsValid = (x: number, y: number) => this.isExcavationPositionValid(x, y, region, ignoreSite);
    if (candidateIsValid(seedX, seedY)) return new Vec2(seedX, seedY);
    for (let radius = 36; radius <= 300; radius += 36) {
      for (let step = 0; step < 16; step++) {
        const angle = step / 16 * Math.PI * 2 + radius * .013;
        const x = Math.round(seedX + Math.cos(angle) * radius);
        const y = Math.round(seedY + Math.sin(angle) * radius);
        if (candidateIsValid(x, y)) return new Vec2(x, y);
      }
    }
    // If the authored seed sits on a region edge, search the complete region
    // instead of returning an unreachable fallback coordinate.
    for (let attempt = 0; attempt < 72; attempt++) {
      const x = Math.round(bounds.left + 60 + Math.random() * (bounds.right - bounds.left - 120));
      const y = Math.round(bounds.bottom + 60 + Math.random() * (bounds.top - bounds.bottom - 120));
      if (candidateIsValid(x, y)) return new Vec2(x, y);
    }
    for (const relaxedSpacing of [165, 140]) {
      for (let attempt = 0; attempt < 54; attempt++) {
        const x = Math.round(bounds.left + 60 + Math.random() * (bounds.right - bounds.left - 120));
        const y = Math.round(bounds.bottom + 60 + Math.random() * (bounds.top - bounds.bottom - 120));
        if (this.isExcavationPositionValid(x, y, region, ignoreSite, relaxedSpacing)) return new Vec2(x, y);
      }
    }
    // 最后保底：以粗网格扫描整个区域，只要"可站立、不在障碍内、不泡水"即可（忽略坑间距），
    // 绝不返回未经校验的坐标，避免土坑落在不可通行处或河里。
    const gridStep = 80;
    const fallbackWaterMargin = (region === 'river' || region === 'lake') ? 50 : 24;
    for (let gy = bounds.bottom + 60; gy <= bounds.top - 60; gy += gridStep) {
      for (let gx = bounds.left + 60; gx <= bounds.right - 60; gx += gridStep) {
        if (this.canStandRadius(gx, gy, 24) && !this.pointInAnyObstacle(gx, gy)
          && !this.pointInWater(gx, gy, fallbackWaterMargin)) {
          return new Vec2(gx, gy);
        }
      }
    }
    console.warn(`[YinXuCity] excavation site ${region} NO walkable fallback found`, seedX, seedY);
    return new Vec2(seedX, seedY);
  }

  private isExcavationPositionValid(
    x: number, y: number, region: ExcavationRegion, ignoreSite: ExcavationSite | null = null, minimumSpacing = 260,
  ) {
    const bounds = region === 'supplement' ? this.supplementRegion
      : region === 'river' ? this.riverRegion : region === 'field' ? this.fieldRegion
      : region === 'lake' ? this.lakeRegion : region === 'forest' ? this.forestRegion
      : region === 'trial' ? this.trialRegion : this.tombRegion;
    if ((region === 'river' || region === 'field') && this.inRegion(x, y, this.southOutskirtsTrial)) return false;
    if (x < bounds.left + 48 || x > bounds.right - 48 || y < bounds.bottom + 48 || y > bounds.top - 48) return false;
    if (!this.canStandRadius(x, y, 24) || this.pointInAnyObstacle(x, y)) return false;
    if (this.excavationSites.some(site => site !== ignoreSite && Math.hypot(site.x - x, site.y - y) < minimumSpacing)) return false;
    if (this.cropPlants.some(crop => Math.hypot(crop.x - x, crop.y - y) < 46)) return false;
    if (region === 'river' || region === 'lake') {
      // 土坑 sprite 会延伸到中心点外，必须整体落在岸上；lake 可贴湖岸但不能入水，
      // river 离河岸更远些，避免视觉上一半泡进河里。
      if (this.pointInWater(x, y, region === 'lake' ? 70 : 100)) return false;
    }
    const approachDistance = 68;
    const hasReachableApproach = [[approachDistance, 0], [-approachDistance, 0], [0, approachDistance], [0, -approachDistance]]
      .some(offset => this.canStandRadius(x + offset[0], y + offset[1], this.playerRadius + 2));
    return hasReachableApproach;
  }

  private moveExcavationSiteToRandomLocation(site: ExcavationSite) {
    const previousX = site.x; const previousY = site.y;
    const bounds = site.region === 'supplement' ? this.supplementRegion
      : site.region === 'river' ? this.riverRegion : site.region === 'field' ? this.fieldRegion
      : site.region === 'lake' ? this.lakeRegion : site.region === 'forest' ? this.forestRegion
      : site.region === 'trial' ? this.trialRegion : this.tombRegion;
    for (let attempt = 0; attempt < 84; attempt++) {
      const x = Math.round(bounds.left + 70 + Math.random() * (bounds.right - bounds.left - 140));
      const y = Math.round(bounds.bottom + 70 + Math.random() * (bounds.top - bounds.bottom - 140));
      if (!this.isExcavationPositionValid(x, y, site.region, site, site.region === 'supplement' ? 420 : 260)) continue;
      site.x = x; site.y = y;
      site.root.setPosition(x, y, 21);
      console.info(`[YinXuCity] excavation site ${site.id} refreshed in ${site.region}: ${previousX},${previousY} -> ${x},${y}`);
      return;
    }
    const fallback = this.resolveExcavationPosition(
      (bounds.left + bounds.right) / 2 + (Math.random() * 2 - 1) * (bounds.right - bounds.left) * .28,
      (bounds.bottom + bounds.top) / 2 + (Math.random() * 2 - 1) * (bounds.top - bounds.bottom) * .28,
      site.region,
      site,
    );
    site.x = fallback.x; site.y = fallback.y;
    site.root.setPosition(site.x, site.y, 21);
    console.info(`[YinXuCity] excavation site ${site.id} used safe refresh fallback: ${previousX},${previousY} -> ${site.x},${site.y}`);
  }

  // 章节解锁门控：返回「已解锁主线字」id 集合（已完成章 ∪ 当前章）。主线全完成时为全 250。
  private getUnlockedStoryCardIds(): Set<string> {
    // buildWorld() 会在 initializeStoryInfrastructure() 之前生成挖掘点。
    // 启动阶段控制器尚未创建，应读取已经完成迁移的存档状态；初始化完成后再读取实时快照。
    const snap = this.storyController?.snapshot() ?? this.save.story;
    const ids = new Set<string>();
    const currentIndex = snap.currentChapterId ? STORY_CHAPTER_IDS.indexOf(snap.currentChapterId) : -1;
    for (const p of CHAPTER_CHAR_PLANS) {
      const idx = STORY_CHAPTER_IDS.indexOf(p.chapterId);
      // 双保险：即便存档里 currentChapterId / completedChapterIds 因异常错乱跑到更后面的章，
      // 也绝不放行“玩家尚未到达的后续章”的字（idx > 当前章序号一律跳过）。
      if (currentIndex >= 0 && idx > currentIndex) continue;
      if (snap.completedChapterIds.includes(p.chapterId) || snap.currentChapterId === p.chapterId) {
        for (const c of p.chars) {
          const cardId = planCardId(c);
          if (STORY_CARD_IDS.has(cardId)) ids.add(cardId);
        }
      }
    }
    return ids;
  }

  // 主线是否全部通关：必须逐一包含全部已注册章节，不能只按数组长度判断。
  // 旧存档可能含已废弃章节 ID，按长度判断会导致拾遗系统提前解锁。
  private isMainStoryComplete(): boolean {
    if (!this.storyController) return false;
    const completed = new Set(this.storyController.snapshot().completedChapterIds);
    return STORY_CHAPTER_IDS.every(chapterId => completed.has(chapterId));
  }

  // 逐批揭示拾遗坑：每帧最多揭示一批，分散全图、错峰现世，避免一次性刷新。
  private revealNextSupplementBatch() {
    const end = Math.min(this.supplementRevealIndex + YinXuCity.SUPPLEMENT_REVEAL_BATCH, this.supplementSites.length);
    for (; this.supplementRevealIndex < end; this.supplementRevealIndex++) {
      const site = this.supplementSites[this.supplementRevealIndex];
      site.revealed = true;
      site.active = true;
      site.holeTimer = 0;
      site.respawnTimer = 0;
      site.root.active = true;
      this.redrawExcavationSite(site);
    }
  }

  private rollExcavationReward(region: ExcavationRegion): ExcavationReward {
    // 拾遗坑只产出拾遗字。
    if (region === 'supplement') return this.rollSupplementReward();
    // 普通坑只产出本章主线字或资源；拾遗字只会从隐藏拾遗坑产出，
    // 这样「发现拾遗」才是一次真正的探索奖励。
    const roll = Math.random();
    let quality: OracleQuality | null = null;
    if (region === 'river' || region === 'field' || region === 'trial') {
      if (roll < .70) quality = 'blue';
      else if (roll < .78) quality = 'red';
    } else if (region === 'lake') {
      if (roll < .25) quality = 'red';
      else if (roll < .80) quality = 'blue';
    } else {
      if (roll < .10) quality = 'gold';
      else if (roll < .42) quality = 'red';
      else if (roll < .82) quality = 'blue';
    }
    // 没挖到字：纯墨料（保持原行为）
    if (!quality) {
      const minimum = region === 'royal' ? 6 : region === 'lake' ? 4 : 3;
      return { kind: 'ink', quality: null, cardId: null, amount: minimum + Math.floor(Math.random() * 4), tier: 'story', experience: 0, coins: 0 };
    }
    // 抽到字：候选池 = 已解锁主线字（章节门控）。拾遗字仅偶发(上方12%)才出现，主体仍是主线字，杜绝主线被顺手挖光。
    const unlockedStory = this.getUnlockedStoryCardIds();
    const excavatableCards = this.oracleCards.filter(card => card.excavatable && this.hasRealOracleGlyph(card));
    const candidatePool = excavatableCards.filter(card =>
      STORY_CARD_IDS.has(card.id) && unlockedStory.has(card.id)
    );
    const reservedIds = new Set(this.excavationSites
      .filter(site => site.reward.kind === 'oracle' && !!site.reward.cardId)
      .map(site => site.reward.cardId as string));
    const uncollected = candidatePool.filter(card =>
      !this.save.unlockedOracleIds.includes(card.id) && !reservedIds.has(card.id) && !this.excavationRollingReserved.has(card.id));
    const collectionRatio = candidatePool.length > 0 ? uncollected.length / candidatePool.length : 1;
    // 候选池内未收集优先给新字；收集得越多越易抽到重复（重复走 completeExcavation 转墨料，不无限给奖励）。
    const duplicateChance = collectionRatio < .8 ? .05 : Math.min(.38, .05 + (collectionRatio - .8) * 1.65);
    const freshPool = uncollected.length > 0 ? uncollected : candidatePool;
    const finalPool = freshPool.length > 0 && Math.random() >= duplicateChance ? freshPool : candidatePool;
    const card = finalPool[Math.floor(Math.random() * finalPool.length)];
    if (card) this.excavationRollingReserved.add(card.id); // 本帧已占用，避免同帧其他坑再抽到它
    if (!card) {
      const minimum = region === 'royal' ? 6 : region === 'lake' ? 4 : 3;
      return { kind: 'ink', quality: null, cardId: null, amount: minimum + Math.floor(Math.random() * 4), tier: 'story', experience: 0, coins: 0 };
    }
    // 候选池只含主线字，故此处只可能是主线字——纯收集，不掉货币（保持主线纯粹）。
    return { kind: 'oracle', quality: card.quality, cardId: card.id, amount: 0, experience: 0, coins: 0, tier: 'story' };
  }

  private redrawExcavationSite(site: ExcavationSite) {
    site.glow.clear();
    site.glow.node.setScale(1, 1, 1);
    site.glow.node.setRotationFromEuler(0, 0, 0);
    const currentRegionId = this.regionTransitionManager?.currentRegionId;
    // 当前章节正在指引的剧情目标坑即便落在其它区域（本章的字散落各区域），
    // 也始终保持可见，保证金色箭头指向的碎甲不会被跨区隐藏逻辑藏掉。
    const hiddenFieldSite = site.region === 'field' && !!currentRegionId && currentRegionId !== RegionId.FIELDS && !site.storyTarget;
    site.root.active = true;
    if (!site.active) {
      if (site.holeTimer <= 0) {
        site.root.active = false;
        return;
      }
      this.applyExcavationVisualState(site, 'dug');
      if (hiddenFieldSite) site.root.active = false;
      return;
    }
    this.applyExcavationVisualState(site, 'idle');
    this.drawExcavationInteractionHint(site);
    if (hiddenFieldSite) site.root.active = false;
  }

  private applyExcavationVisualState(site: ExcavationSite, state: ExcavationVisualState) {
    const visualHeight = this.EXCAVATION_VISUAL_HEIGHTS[state];
    const transform = site.sprite.node.getComponent(UITransform);
    transform?.setContentSize(this.EXCAVATION_VISUAL_WIDTH, visualHeight);
    site.sprite.node.setPosition(0, this.EXCAVATION_VISUAL_GROUND_Y + visualHeight / 2, 0);
    site.sprite.spriteFrame = this.excavationFrames[state];
  }

  private loadExcavationSpriteFrames() {
    if (this.excavationFramesRequested) return;
    this.excavationFramesRequested = true;
    (Object.keys(this.excavationFramePaths) as ExcavationVisualState[]).forEach(state => {
      const path = this.excavationFramePaths[state];
      resources.load(path, SpriteFrame, (error, frame) => {
        if (error || !frame) {
          console.error(`[YinXuCity] excavation ${state} SpriteFrame failed to load: ${path}`, error);
          return;
        }
        frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        this.excavationFrames[state] = frame;
        this.excavationSites.forEach(site => {
          if (site.root.isValid) this.redrawExcavationSite(site);
        });
      });
    });
  }

  private drawExcavationInteractionHint(site: ExcavationSite) {
    const hint = site.glow;
    if (site.storyTarget) {
      // 剧情目标土坑：金色脉冲光环 + 中心亮点，老远就能定位
      hint.fillColor = new Color(255, 214, 120, 38);
      hint.circle(0, 6, 26);
      hint.fill();
      hint.strokeColor = new Color(255, 228, 150, 165);
      hint.lineWidth = 2.5;
      hint.circle(0, 6, 26);
      hint.stroke();
      hint.fillColor = new Color(255, 245, 200, 215);
      hint.circle(0, 6, 5);
      hint.fill();
      return;
    }
    const alpha = site.awaitingStudy ? 58 : 30;
    hint.strokeColor = new Color(151, 119, 70, alpha);
    hint.lineWidth = .75;
    hint.moveTo(-12, -10); hint.lineTo(-4, -12);
    hint.moveTo(5, -12); hint.lineTo(12, -9);
    hint.stroke();
  }

  private nearestActiveExcavationSite() {
    const direction = this.facingVector();
    let nearest: ExcavationSite | null = null; let nearestDistance = Infinity;
    for (const site of this.excavationSites) {
      if ((!site.active && !site.awaitingStudy) || !site.root.isValid || !site.root.active) continue;
      const dx = site.x - this.playerPos.x; const dy = site.y - this.playerPos.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 104 || distance < 8) continue;
      const facingDot = (dx * direction.x + dy * direction.y) / Math.max(1, distance);
      if (facingDot < -.12 || distance >= nearestDistance) continue;
      nearest = site; nearestDistance = distance;
    }
    return nearest;
  }

  private startExcavation(site: ExcavationSite) {
    const returningToLesson = site.awaitingStudy;
    this.toolActionDuration = .86;
    this.toolActionTimer = this.toolActionDuration;
    site.active = false;
    site.respawnTimer = 12;
    site.holeTimer = 8;
    this.redrawExcavationSite(site);
    this.pendingExcavation = { site, timer: .62, rewarded: false };
    this.createDigParticleBurst(site.x, site.y);
    this.audioManager.playShovelDig();
    if (returningToLesson) this.showStatusNotice('重新清理这个坑位，之前发现的甲骨文字仍保留在这里。', 1.1);
    this.showStatusNotice('正在清理土层……', 1.1);
  }

  // 拾遗字挖到时，若有额外赏(墨料/经验)则拼出提示文案，否则返回 null。
  private supplementRewardNotice(reward: ExcavationReward): string | null {
    if (reward.tier !== 'supplement') return null;
    if (!reward.amount && !reward.experience) return null;
    const parts: string[] = [];
    if (reward.amount) parts.push(`${reward.amount} 份墨料`);
    if (reward.experience) parts.push(`${reward.experience} 点卜官经验`);
    return parts.length > 0 ? `拾遗所得：${parts.join('、')}。` : null;
  }

  /** 统一发放卜官经验；跨段位阈值时播放升级音效。阈值与 LearningHall RANKS 对齐（0/1000/3000/6000/12000）。 */
  private gainExperience(amount: number) {
    if (!amount) return;
    const before = this.save.experience;
    this.save.experience += amount;
    const thresholds = [1000, 3000, 6000, 12000];
    const beforeRank = thresholds.filter(t => before >= t).length;
    const afterRank = thresholds.filter(t => this.save.experience >= t).length;
    if (afterRank > beforeRank) this.audioManager.playSfx('level_up');
  }

  private completeExcavation(site: ExcavationSite) {
    site.storyTarget = false;
    const reward = site.reward;
    if (reward.kind === 'oracle' && reward.cardId) {
      // 记录"已挖到的字"（含待补字）。进度条按此统计，避免待补字挖了却不计入收集数。
      if (!this.save.excavatedCardIds) this.save.excavatedCardIds = [];
      if (!this.save.excavatedCardIds.includes(reward.cardId)) {
        this.save.excavatedCardIds.push(reward.cardId);
      }
      const card = this.oracleCards.find(item => item.id === reward.cardId && (this.hasRealOracleGlyph(item) || Boolean(item.modern)));
      const currentStepId = this.storyController?.currentStep()?.id;
      const expectedFragment = this.allStoryFragmentCards.find(item =>
        item.seekStepId === currentStepId && item.cardId === reward.cardId);
      // 故事碎片：无论字卡是否已录入，都先推进「挖掘完成」步骤。
      if (expectedFragment) {
        this.storyController.handle({
          type: 'excavation-completed',
          cardId: reward.cardId,
          siteId: site.id,
        });
      }
      const chapterId = this.storyController?.snapshot().currentChapterId;
      this.showChapterCollectionMilestone(chapterId);
      if (card) {
        // 字卡已录入：弹出辨识学习面板，学完再推进「学习完成」。
        this.audioManager.playSfx('reward_get');
        site.awaitingStudy = true;
        // 拾遗字(supplement)挖到即发放档位奖励(墨料/经验)；主线字 amount/experience 为 0，发放无害。
        if (reward.amount) { this.save.ink += reward.amount; }
        if (reward.experience) { this.gainExperience(reward.experience); }
        this.persistCitySave();
        const rewardNotice = this.supplementRewardNotice(reward);
        if (rewardNotice) this.showStatusNotice(rewardNotice, 3.6);
        this.showExcavationLearning(site, card);
        return;
      }
      // 字卡尚未录入（待补字）：直接连带完成「学习完成」，避免卡死；拾遗档位奖励仍发放。
      site.awaitingStudy = false;
      if (reward.amount) { this.save.ink += reward.amount; }
      if (reward.experience) { this.gainExperience(reward.experience); }
      if (expectedFragment) {
        this.storyController.handle({ type: 'learning-completed', cardId: reward.cardId, correct: true });
      }
      let notice = '这枚碎甲的字迹尚待补全，已记入寻骨进度，可继续向下一枚。';
      const rewardNotice = this.supplementRewardNotice(reward);
      if (rewardNotice) notice += ` ${rewardNotice}`;
      this.showStatusNotice(notice, 3.8);
      return;
    }
    site.awaitingStudy = false;
    this.save.ink += reward.amount;
    if (reward.experience) { this.gainExperience(reward.experience); }
    this.persistCitySave();
    this.createExcavationRewardFlight(site.x, site.y, reward.experience ? '验' : '墨', null);
    let msg = `这处土层没有甲骨文，收集到 ${reward.amount} 份墨料。`;
    if (reward.experience) { msg += ` 并习得 ${reward.experience} 点卜官经验。`; }
    msg += `3分钟后坑位恢复，5分钟后在本地区重新刷新。`;
    this.showStatusNotice(msg, 4.2);
  }

  private completeExcavationLegacy(site: ExcavationSite) {
    const reward = site.reward;
    let flightText = '墨';
    let flightQuality: OracleQuality | null = null;
    if (reward.kind === 'oracle' && reward.cardId) {
      const card = this.oracleCards.find(item => item.id === reward.cardId && this.hasRealOracleGlyph(item));
      if (card) {
        flightText = card.glyph; flightQuality = card.quality;
        if (this.save.unlockedOracleIds.includes(card.id)) {
          const convertedInk = card.quality === 'gold' ? 14 : card.quality === 'red' ? 8 : 4;
          this.save.ink += convertedInk;
          this.showStatusNotice(`已收藏的${card.quality === 'gold' ? '金光' : card.quality === 'red' ? '红光' : '蓝光'}甲骨重复出土，转化为 ${convertedInk} 墨料。`, 4.2);
        } else {
          this.save.unlockedOracleIds.push(card.id);
          this.showStatusNotice(`发现新甲骨：${card.modern}！已飞入背包图鉴。`, 4.2);
        }
      }
    } else {
      this.save.ink += reward.amount;
      this.showStatusNotice(`这处没有甲骨，收集到 ${reward.amount} 墨料。`, 3.6);
    }
    this.persistCitySave();
    this.createExcavationRewardFlight(site.x, site.y, flightText, flightQuality);
  }

  private createDigParticleBurst(x: number, y: number) {
    for (let index = 0; index < 12; index++) {
      const root = new Node(`ExcavationSoilParticle-${Date.now()}-${index}`);
      root.parent = this.world; root.setPosition(x, y + 8, 86);
      root.addComponent(UITransform).setContentSize(18, 18);
      const g = root.addComponent(Graphics);
      g.fillColor = index % 3 === 0 ? new Color(188, 126, 61) : index % 2 ? new Color(111, 72, 43) : new Color(151, 96, 47);
      g.rect(-3 - index % 2, -2, 6 + index % 3, 4 + index % 2); g.fill();
      const angle = Math.PI * (.12 + index / 11 * .76);
      const speed = 65 + (index % 4) * 17;
      const life = .48 + (index % 4) * .06;
      this.digParticles.push({ root, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: 190, life, maxLife: life });
    }
  }

  private createExcavationRewardFlight(x: number, y: number, glyph: string, quality: OracleQuality | null, card: OracleCardData | null = null) {
    const start = new Vec2(x - this.cameraPos.x, y - this.cameraPos.y + 32);
    const end = new Vec2(380, -230);
    const root = new Node(`ExcavationRewardFlight-${Date.now()}`);
    root.parent = this.node; root.setPosition(start.x, start.y, 460);
    root.addComponent(UITransform).setContentSize(86, 100);
    const g = root.addComponent(Graphics);
    const color = quality === 'gold' ? new Color(255, 208, 74) : quality === 'red' ? new Color(228, 76, 59)
      : quality === 'blue' ? new Color(76, 169, 250) : new Color(195, 140, 73);
    g.fillColor = new Color(color.r, color.g, color.b, 48); g.circle(0, 0, 39); g.fill();
    g.strokeColor = new Color(color.r, color.g, color.b, 230); g.lineWidth = 4; g.circle(0, 0, 31); g.stroke();
    g.fillColor = new Color(224, 190, 126); g.moveTo(-24, -26); g.lineTo(-29, 12); g.lineTo(-15, 29); g.lineTo(19, 26); g.lineTo(29, 6); g.lineTo(21, -27); g.close(); g.fill();
    g.strokeColor = new Color(83, 55, 39); g.lineWidth = 3; g.moveTo(-24, -26); g.lineTo(-29, 12); g.lineTo(-15, 29); g.lineTo(19, 26); g.lineTo(29, 6); g.lineTo(21, -27); g.close(); g.stroke();
    if (card && this.hasRealOracleGlyph(card)) this.createOracleGlyphVisual('RewardGlyph', root, card, 0, 0, 43, 48, 5);
    else this.createUiLabel(root, 'RewardGlyph', glyph, 0, 0, 54, 56, glyph === '墨' ? 24 : 31, new Color(74, 43, 30));
    this.rewardFlights.push({ root, start, end, timer: 0, duration: 1.05, phase: Math.random() * Math.PI * 2 });
  }

  private updateExcavationEffects(dt: number) {
    // 主线通关后：拾遗坑逐批现世（渐进刷新，避免一次性点亮 / 集体刷新）。
    if (!this.supplementRevealStarted && this.isMainStoryComplete()) {
      this.supplementRevealStarted = true;
      this.supplementRevealTimer = 2; // 稍候即现首批
      this.showStatusNotice('主线功成，甲骨拾遗现世——散落殷墟各处的碎甲，将随你探索陆续浮现。', 5.5);
    }
    if (this.supplementRevealStarted) {
      this.supplementRevealTimer -= dt;
      if (this.supplementRevealTimer <= 0 && this.supplementRevealIndex < this.supplementSites.length) {
        this.revealNextSupplementBatch();
        this.supplementRevealTimer = YinXuCity.SUPPLEMENT_REVEAL_INTERVAL;
      }
    }
    // 每次刷新周期开始：清空本帧去重集合，让同帧重生的多个坑能各自拿到不同字，不再撞同一个字。
    this.excavationRollingReserved.clear();
    for (const site of this.excavationSites) {
      if (!site.root.isValid) continue;
      // 未现世的拾遗坑：保持隐藏、不参与刷新/挖掘，直到被逐批揭示。
      if (site.region === 'supplement' && !site.revealed) continue;
      if (!site.active) {
        site.holeTimer = Math.max(0, site.holeTimer - dt);
        if (site.holeTimer <= 0) {
          if (site.awaitingStudy) {
            // A deferred lesson reappears at the same reachable position and
            // keeps the exact same oracle character until the learner returns.
            site.active = true;
            this.redrawExcavationSite(site);
            continue;
          }
          site.root.active = false;
        }
        site.respawnTimer = Math.max(0, site.respawnTimer - dt);
        if (!site.awaitingStudy && site.respawnTimer <= 0) {
          if (site.storyTarget) {
            // 故事目标坑：保留 reserve 写入的特定字，不随机移位、不覆盖 reward，立即复活待挖。
            site.active = true;
            site.holeTimer = 0;
            site.root.active = true;
            this.redrawExcavationSite(site);
          } else {
            this.moveExcavationSiteToRandomLocation(site);
            // 拾遗型坑（trial 内的拾遗补充坑，reward.tier==='supplement'）刷新后仍出拾遗字，
            // 不回落成普通主线字，保证「城内/城外近处也能挖到拾遗」的体验延续。
            site.reward = site.reward.tier === 'supplement'
              ? this.rollSupplementReward()
              : this.rollExcavationReward(site.region);
            site.active = true;
            site.holeTimer = 0;
            site.root.active = true;
            this.redrawExcavationSite(site);
          }
        }
        continue;
      }
      // The idle marker is intentionally static. Pulsing scale and rotation
      // made the old excavation disk read like an active mechanism.
    }
    const pending = this.pendingExcavation;
    if (pending) {
      pending.timer -= dt;
      if (!pending.rewarded && pending.timer <= 0) {
        pending.rewarded = true;
        this.completeExcavation(pending.site);
        this.pendingExcavation = null;
      }
    }
    for (let index = this.digParticles.length - 1; index >= 0; index--) {
      const particle = this.digParticles[index];
      particle.life -= dt;
      if (particle.life <= 0 || !particle.root.isValid) {
        if (particle.root.isValid) particle.root.destroy();
        this.digParticles.splice(index, 1); continue;
      }
      particle.vy -= particle.gravity * dt;
      particle.root.setPosition(particle.root.position.x + particle.vx * dt, particle.root.position.y + particle.vy * dt, particle.root.position.z);
      const scale = this.clamp(particle.life / particle.maxLife, 0, 1);
      particle.root.setScale(scale, scale, 1);
    }
    for (let index = this.rewardFlights.length - 1; index >= 0; index--) {
      const flight = this.rewardFlights[index];
      flight.timer += dt;
      const t = this.clamp(flight.timer / flight.duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const x = flight.start.x + (flight.end.x - flight.start.x) * eased + Math.sin(t * Math.PI) * 52;
      const y = flight.start.y + (flight.end.y - flight.start.y) * eased + Math.sin(t * Math.PI) * 148;
      flight.root.setPosition(x, y, flight.root.position.z);
      flight.root.setRotationFromEuler(0, 0, Math.sin(t * Math.PI * 2 + flight.phase) * 7);
      const scale = t < .2 ? .72 + t * 2.1 : 1 - Math.max(0, t - .72) * 1.35;
      flight.root.setScale(scale, scale, 1);
      if (t >= 1 || !flight.root.isValid) {
        if (flight.root.isValid) flight.root.destroy();
        this.rewardFlights.splice(index, 1);
      }
    }
  }

  private createTownHouse(name: string, x: number, y: number, asset: string, index: number) {
    const yard = this.localGraphics(`${name}FrontYard`, this.world, x, y, 190, 170, 7);
    yard.fillColor = new Color(91, 114, 62, 180);
    [-74, -58, 56, 73].forEach((gx, grassIndex) => {
      yard.rect(gx, -98 + grassIndex % 2 * 5, 3, 13 + grassIndex % 3 * 4);
      yard.rect(gx + 5, -96, 2, 8); yard.fill();
    });

    const base = this.graphics(`${name}Base`, this.world, 30);
    base.fillColor = new Color(112, 83, 52, 150);
    base.roundRect(-70, -38, 140, 70, 8); base.fill();
    base.node.setPosition(x, y - 30);
    this.pixelSprite(`${name}PixelArt`, asset, this.world, x, y + 20, 200, 182, 33);
    this.addHouseFootprint(name, x, y + 26, 184, 160);

    if (index % 3 === 0) {
      this.pixelSprite('HouseholdPottery', 'pottery-jar-cluster', this.world, x + 72, y - 48, 48, 42, 18);
      this.addObstacle(x + 72, y - 60, 31, 21, `${name}陶罐`);
    }
    if (index % 3 === 1) this.pixelSprite('HouseholdFlowers', 'wildflower-patch', this.world, x - 69, y - 53, 40, 36, 9);
    if (index % 2 === 0) {
      this.pixelSprite(`${name}LeftFence`, 'fence-straight', this.world, x - 57, y - 75, 58, 40, 17);
      this.pixelSprite(`${name}RightFence`, 'fence-straight', this.world, x + 57, y - 75, 58, 40, 17);
      this.addObstacle(x - 57, y - 80, 60, 22, `${name}左院篱`);
      this.addObstacle(x + 57, y - 80, 60, 22, `${name}右院篱`);
    }
  }

  private createTownShop(x: number, y: number) {
    const base = this.graphics('VillageShopBase', this.world, 30);
    base.fillColor = new Color(118, 78, 45); base.roundRect(-90, -46, 180, 92, 10); base.fill();
    base.node.setPosition(x, y - 28);
    this.pixelSprite('VillageShopPixelArt', 'village-shop', this.world, x, y + 28, 232, 205, 34);
    this.addStructureFootprint('VillageShopPixelArt', x, y + 32, 214, 174);
  }

  private createVillageWell(x: number, y: number, regionId?: RegionId) {
    const fallback = this.graphics('VillageWellFallback', this.world, 21);
    fallback.fillColor = new Color(98, 87, 67); fallback.circle(0, 0, 34); fallback.fill();
    fallback.strokeColor = new Color(58, 47, 36); fallback.lineWidth = 7; fallback.circle(0, 0, 34); fallback.stroke();
    fallback.node.setPosition(x, y);
    this.pixelSprite('VillageWaterWell', 'village-well', this.world, x, y + 18, 112, 112, 28);
    if (regionId === RegionId.CITY) this.addObstacle(x, y + 10, 92, 88, 'CityVillageWellSolid', regionId);
    else this.addStructureFootprint('VillageWaterWell', x, y + 8, 76, 76);
    this.worldLabel('水井', x, y + 84, 14, new Color(80, 57, 38));
  }

  private createFieldStorehouse(name: string, x: number, y: number, asset: string) {
    const base = this.localGraphics(`${name}Base`, this.world, x, y - 36, 190, 90, 29);
    base.fillColor = new Color(105, 73, 45, 190); base.roundRect(-84, -32, 168, 64, 8); base.fill();
    this.pixelSprite(`${name}PixelArt`, asset, this.world, x, y + 20, 220, 198, 33);
    this.addStructureFootprint(`${name}PixelArt`, x, y + 18, 190, 170);
  }

  private createBuilding(name: string, x: number, y: number, w: number, h: number, wall: Color, roof: Color, asset: string | null = 'earthen-house') {
    const g = this.graphics(name, this.world, 31);
    g.fillColor = new Color(104, 82, 54); g.rect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16); g.fill();
    g.fillColor = wall; g.rect(-w / 2, -h / 2, w, h); g.fill();
    g.fillColor = roof; g.moveTo(-w / 2 - 24, h / 4); g.lineTo(0, h / 2 + 70); g.lineTo(w / 2 + 24, h / 4); g.lineTo(w / 2, -8); g.lineTo(-w / 2, -8); g.close(); g.fill();
    g.fillColor = new Color(64, 45, 34); g.rect(-28, -h / 2, 56, 85); g.fill();
    g.fillColor = new Color(219, 184, 108); g.rect(-w / 2 + 35, -h / 2 + 45, 38, 34); g.rect(w / 2 - 73, -h / 2 + 45, 38, 34); g.fill();
    g.node.setPosition(x, y);
    if (asset) this.pixelSprite(`${name}PixelArt`, asset, this.world, x, y + 22, w + 80, h + 120, 33);
    // Procedural buildings include a tall roof above their nominal wall box.
    // Keep the entrance apron clear while blocking the entire visible body.
    this.addStructureFootprint(`${name}PixelArt`, x, y + 35, w + 16, h + 140);
  }

  private addHouseFootprint(name: string, x: number, y: number, width: number, height: number) {
    this.structureFootprintOwners.add(`${name}PixelArt`);
    this.addObstacle(x, y, width, height, `HouseFootprint:${name}`);
  }

  private addStructureFootprint(ownerNodeName: string, x: number, y: number, width: number, height: number) {
    this.structureFootprintOwners.add(ownerNodeName);
    this.addObstacle(x, y, width, height, `StructureFootprint:${ownerNodeName}`);
  }

  private getUnregisteredStaticStructures() {
    return this.staticStructureSprites.filter(structure => !this.structureFootprintOwners.has(structure.node.name));
  }

  private auditStaticStructureFootprints() {
    const missing = this.getUnregisteredStaticStructures();
    if (missing.length) {
      console.warn('[YinXuCity] static structure sprites missing StructureFootprint:',
        missing.map(structure => `${structure.node.name} (${structure.asset})`));
    } else {
      console.info(`[YinXuCity] static structure footprint audit passed: ${this.staticStructureSprites.length} sprites registered.`);
    }
  }

  private createMarketStall(x: number, y: number, scale = 1) {
    const g = this.graphics('MarketStall', this.world, 29);
    g.fillColor = new Color(109, 68, 39); g.rect(-72 * scale, -55 * scale, 144 * scale, 92 * scale); g.fill();
    g.fillColor = new Color(176, 61, 49); g.rect(-84 * scale, 30 * scale, 168 * scale, 52 * scale); g.fill();
    g.fillColor = new Color(224, 166, 76); for (let px = -70; px < 70; px += 34) { g.circle(px * scale, -20 * scale, 10 * scale); g.fill(); }
    g.node.setPosition(x, y);
    const structureName = `MarketStallPixelArt-${x}-${y}`;
    this.pixelSprite(structureName, 'market-stall', this.world, x, y + 12 * scale, 205 * scale, 205 * scale, 32);
    this.addStructureFootprint(structureName, x, y + 12 * scale, 176 * scale, 168 * scale);
  }

  private createTree(x: number, y: number, index: number) {
    this.createTreeSized(x, y, index, 1);
  }

  private createTreeSized(
    x: number,
    y: number,
    index: number,
    scale: number,
    obstacleName = '古树根部基座',
    regionId?: RegionId,
  ) {
    const n = new Node(`Tree${index}`); n.parent = this.world; n.setPosition(x, y, 25); n.addComponent(UITransform).setContentSize(180 * scale, 220 * scale);
    this.attachPixelSprite(n, 'ancient-tree');
    this.addObstacle(x, y - 82 * scale, 132 * scale, 54 * scale, obstacleName, regionId);
    this.depthTrees.push({
      node: n,
      trunkY: y - 84 * scale,
      halfWidth: 82 * scale,
      canopyHeight: 184 * scale,
      baseZ: 25,
    });
  }

  /**
   * Large mountain-stock rocks share the tree-style depth contract: only the
   * grounded lower mass is solid, while the upper mass sorts around actors by
   * its visual foot.  That keeps a player behind the rock hidden without ever
   * allowing them to stand inside its base.
   */
  private createRock(x: number, y: number, scale: number, regionId: RegionId) {
    const rockName = `MountainRockSolid:${regionId}:${x}:${y}`;
    const g = this.graphics(`MountainRockFallback:${regionId}:${x}:${y}`, this.world, 18);
    g.fillColor = new Color(105, 111, 104); g.moveTo(-45 * scale, -22 * scale); g.lineTo(-18 * scale, 45 * scale); g.lineTo(28 * scale, 52 * scale); g.lineTo(52 * scale, -15 * scale); g.close(); g.fill();
    g.fillColor = new Color(151, 153, 137); g.moveTo(-18 * scale, 45 * scale); g.lineTo(9 * scale, 23 * scale); g.lineTo(28 * scale, 52 * scale); g.close(); g.fill();
    g.node.setPosition(x, y);
    const rockNode = this.pixelSprite(`MountainRockPixelArt:${regionId}:${x}:${y}`, 'mountain-rock', this.world,
      x, y + 12 * scale, 150 * scale, 150 * scale, 20);
    // The lower/middle stone mass is impassable.  The top remains a visual
    // occluder so a north-side actor is hidden rather than standing on it.
    this.addObstacle(x, y + 2 * scale, 102 * scale, 104 * scale, rockName, regionId);
    this.depthTrees.push({
      node: rockNode,
      trunkY: y - 58 * scale,
      halfWidth: 58 * scale,
      canopyHeight: 142 * scale,
      baseZ: 20,
    });
  }

  /**
   * Natural-prop creation is deliberately transactional: its collision is
   * registered only from the successful SpriteFrame callback.  This prevents
   * an unloaded or hidden decoration from ever becoming an invisible wall.
   */
  private createRegionalNatureSprite(
    name: string, asset: string, x: number, y: number, width: number, height: number,
    regionId: RegionId, obstacle?: { x: number; y: number; w: number; h: number; name: string },
  ) {
    const node = new Node(name);
    const isOutskirtsEntity = regionId === RegionId.OUTSKIRTS && !!obstacle;
    node.parent = isOutskirtsEntity ? this.world : (regionId === RegionId.OUTSKIRTS ? this.outskirtsNatureRoot ?? this.world : this.world);
    if (isOutskirtsEntity) this.outskirtsNatureEntityNodes.push(node);
    // OUTSKIRTS ground tiles render at z=61. Keep every small prop above that
    // terrain layer; actors are still depth-sorted above these props each frame.
    node.setPosition(x, y, 64);
    node.addComponent(UITransform).setContentSize(width, height);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    let obstacleCreated = false;
    this.requestFrame(asset, frame => {
      if (!node.isValid || !sprite.isValid) return;
      sprite.spriteFrame = frame;
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      node.setSiblingIndex((node.parent?.children.length ?? 1) - 1);
      if (obstacle && !obstacleCreated) {
        this.addObstacle(obstacle.x, obstacle.y, obstacle.w, obstacle.h, obstacle.name, regionId);
        if (regionId === RegionId.OUTSKIRTS) this.outskirtsNatureObstacleNames.add(obstacle.name);
        obstacleCreated = true;
      }
      this.reportNatureDecorVisible(name, asset, node, regionId, obstacleCreated);
    });
    return node;
  }

  private createRegionalNatureTree(
    name: string,
    x: number,
    y: number,
    index: number,
    scale: number,
    regionId: RegionId,
    obstacleName: string,
    extraRootObstacle?: { x: number; y: number; w: number; h: number; name: string },
  ) {
    const node = new Node(name);
    // Ground cover lives under OutskirtsNatureRoot, but an occluding tree must
    // be a direct world sibling of the player so both can share one foot-Y
    // ordering pass (the same arrangement already used by RIVERBANK).
    node.parent = this.world;
    if (regionId === RegionId.OUTSKIRTS) this.outskirtsNatureEntityNodes.push(node);
    node.setPosition(x, y, 64);
    node.addComponent(UITransform).setContentSize(180 * scale, 220 * scale);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    let obstacleCreated = false;
    let extraRootObstacleCreated = false;
    this.requestFrame('ancient-tree', frame => {
      if (this.retiredOutskirtsNatureTreeNames.has(name)) {
        if (node.isValid) node.destroy();
        return;
      }
      if (!node.isValid || !sprite.isValid) return;
      sprite.spriteFrame = frame;
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      node.setSiblingIndex((node.parent?.children.length ?? 1) - 1);
      if (!obstacleCreated) {
        // Cover trunk, roots and baked-in stones without blocking the canopy.
        // This callback runs only after SpriteFrame binding, so no invisible
        // tree obstacle survives a failed asset load.
        const nameWithOwner = `${obstacleName}:${name}`;
        this.addObstacle(x, y - 78 * scale, 150 * scale, 64 * scale, nameWithOwner, regionId);
        if (regionId === RegionId.OUTSKIRTS) this.outskirtsNatureObstacleNames.add(nameWithOwner);
        obstacleCreated = true;
      }
      if (extraRootObstacle && !extraRootObstacleCreated) {
        this.addObstacle(
          extraRootObstacle.x,
          extraRootObstacle.y,
          extraRootObstacle.w,
          extraRootObstacle.h,
          extraRootObstacle.name,
          regionId,
        );
        if (regionId === RegionId.OUTSKIRTS) this.outskirtsNatureObstacleNames.add(extraRootObstacle.name);
        extraRootObstacleCreated = true;
      }
      this.reportNatureDecorVisible(name, 'ancient-tree', node, regionId, obstacleCreated);
    });
    this.depthTrees.push({ node, trunkY: y - 84 * scale, halfWidth: 82 * scale, canopyHeight: 184 * scale, baseZ: 64 });
  }

  private createNatureShrub(name: string, asset: string, x: number, y: number, width: number, height: number, regionId: RegionId) {
    const rootY = y - height * .32;
    const isJujube = asset === 'jujube-bush';
    const node = this.createRegionalNatureSprite(name, asset, x, y, width, height, regionId, {
      x,
      y: isJujube ? y - height * .04 : rootY,
      w: isJujube ? Math.max(96, width * .84) : Math.max(96, width * .78),
      h: isJujube ? Math.max(64, height * .76) : Math.max(44, height * .34),
      name: `${name}Root`,
    });
    if (regionId === RegionId.OUTSKIRTS) {
      this.depthTrees.push({ node, trunkY: rootY, halfWidth: width * .42, canopyHeight: height * .76, baseZ: 64 });
    }
  }

  private createNatureGroundCover(name: string, asset: string, x: number, y: number, width: number, height: number, regionId: RegionId) {
    this.createRegionalNatureSprite(name, asset, x, y, width, height, regionId);
  }

  /** Visible replacement for a retired OUTSKIRTS blocker; kept under the regional visual root. */
  private createOutskirtsAirwallJujube(name: string, x: number, y: number) {
    const width = 142;
    const height = 142;
    const rootY = y - height * .32;
    const node = new Node(name);
    // These are solid shrubs, so they share the actor-depth layer with trees.
    node.parent = this.world;
    this.outskirtsNatureEntityNodes.push(node);
    node.setPosition(x, y, 64);
    node.addComponent(UITransform).setContentSize(width, height);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    let obstacleCreated = false;
    this.requestFrame('jujube-bush', frame => {
      if (!node.isValid || !sprite.isValid) return;
      sprite.spriteFrame = frame;
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      if (!obstacleCreated) {
        const obstacleName = `${name}Solid`;
        this.addObstacle(x, y - height * .04, 120, 108, obstacleName, RegionId.OUTSKIRTS);
        this.outskirtsNatureObstacleNames.add(obstacleName);
        obstacleCreated = true;
      }
      this.reportNatureDecorVisible(name, 'jujube-bush', node, RegionId.OUTSKIRTS, obstacleCreated);
    });
    this.depthTrees.push({ node, trunkY: rootY, halfWidth: 56, canopyHeight: height * .76, baseZ: 64 });
  }

  /** Keep decorative collision outside every road, entrance and map edge. */
  private canPlaceOutskirtsNature(x: number, y: number, margin = 110) {
    const o = { left: -2020, right: 2020, bottom: -960, top: 2170 };
    const city = { left: -1300, right: 1300, bottom: -240, top: 1450 };
    if (x < o.left + margin || x > o.right - margin || y < o.bottom + margin || y > o.top - margin) return false;
    if (x > city.left - margin && x < city.right + margin && y > city.bottom - margin && y < city.top + margin) return false;
    // The north/south spine and the east/west road are permanently clear,
    // including their approach to region entrances and the city gates.
    if (Math.abs(x) < 150 || Math.abs(y - this.cityEastWestRoadCenterY) < 150) return false;
    return true;
  }

  /**
   * A compact 5x4 meadow cluster.  Individual covers overlap slightly so the
   * result reads as one dense patch rather than scattered decoration dots.
   */
  private createNatureCluster(
    prefix: string,
    centerX: number,
    centerY: number,
    regionId: RegionId,
    canPlace: (x: number, y: number) => boolean,
  ) {
    const offsets: Array<[number, number]> = [
      [-76, 42], [-38, 44], [0, 42], [38, 44], [76, 42],
      [-76, 4], [-38, 2], [0, 4], [38, 1], [76, 4],
      [-76, -34], [-38, -38], [0, -34], [38, -38], [76, -34],
      [-56, -70], [-18, -72], [20, -70], [58, -72],
    ];
    offsets.forEach(([offsetX, offsetY], index) => {
      const x = centerX + offsetX;
      const y = centerY + offsetY;
      if (!canPlace(x, y)) return;
      const flower = index % 5 === 1 || index % 7 === 0;
      this.createNatureGroundCover(
        `${prefix}${index}`,
        flower ? 'wildflower-patch' : 'grass-clump',
        x,
        y,
        flower ? 84 : 92,
        flower ? 84 : 92,
        regionId,
      );
    });
  }

  /**
   * Six tightly joined meadow cells. This is intentionally a single large
   * biome patch (roughly 456 x 256), not a set of scattered decorations.
   */
  private createLargeNatureCluster(
    prefix: string,
    centerX: number,
    centerY: number,
    regionId: RegionId,
    canPlace: (x: number, y: number) => boolean,
  ) {
    const cells: Array<[number, number]> = [
      [-152, -70], [0, -70], [152, -70],
      [-152, 70], [0, 70], [152, 70],
    ];
    cells.forEach(([offsetX, offsetY], index) => {
      this.createNatureCluster(`${prefix}${index}-`, centerX + offsetX, centerY + offsetY, regionId, canPlace);
    });
  }

  /** Remove only the rebuildable OUTSKIRTS entities; terrain and FIELDS stay untouched. */
  private clearOutskirtsNatureEntities() {
    const entityNodes = new Set(this.outskirtsNatureEntityNodes);
    entityNodes.forEach(node => { if (node.isValid) node.destroy(); });
    this.depthTrees = this.depthTrees.filter(tree => !entityNodes.has(tree.node));
    this.obstacles = this.obstacles.filter(obstacle => !this.outskirtsNatureObstacleNames.has(obstacle.name));
    this.outskirtsNatureEntityNodes = [];
    this.outskirtsNatureObstacleNames.clear();
  }

  /** Retire a known bad grove node and make any late SpriteFrame callback inert. */
  private retireOutskirtsNatureTree(name: string) {
    this.retiredOutskirtsNatureTreeNames.add(name);
    const oldNodes = this.outskirtsNatureEntityNodes.filter(node => node.name === name);
    oldNodes.forEach(node => { if (node.isValid) node.destroy(); });
    this.outskirtsNatureEntityNodes = this.outskirtsNatureEntityNodes.filter(node => node.name !== name);
    this.depthTrees = this.depthTrees.filter(tree => tree.node.name !== name);
    this.obstacles = this.obstacles.filter(obstacle => obstacle.name !== `OutskirtsNatureTreeRoot:${name}`);
    this.outskirtsNatureObstacleNames.delete(`OutskirtsNatureTreeRoot:${name}`);
  }

  /** Dense, road-safe decoration with collisions isolated to the owning region. */
  private drawRegionalNatureDecorations() {
    this.clearOutskirtsNatureEntities();
    this.outskirtsNatureRoot?.destroy();
    this.outskirtsNatureRoot = new Node('OutskirtsNatureRoot');
    this.outskirtsNatureRoot.parent = this.world;
    this.outskirtsNatureRoot.setPosition(0, 0, 0);
    this.outskirtsNatureRoot.addComponent(UITransform).setContentSize(4040, 3130);
    this.withObstacleRegion(RegionId.OUTSKIRTS, () => {
      const place = (x: number, y: number, margin = 110) => {
        const allowed = this.canPlaceOutskirtsNature(x, y, margin);
        if (!allowed) console.debug('[NatureDecor] skipped OUTSKIRTS road/boundary placement', { x, y, margin });
        return allowed;
      };
      const trees: Array<[number, number, number]> = [
        [-1840, 1900, 1.22], [-1570, 1810, 1.16], [-1750, 1280, 1.2], [-1610, 940, 1.14], [-1740, -690, 1.18], [-1480, -720, 1.12],
        [1500, 1940, 1.2], [1810, 1790, 1.16], [1540, 1370, 1.18], [1810, 1080, 1.14], [1540, 780, 1.2], [1830, 720, 1.12],
        [-920, 1920, 1.16], [880, 1930, 1.18], [-650, 1700, 1.12], [640, 1710, 1.12],
      ];
      trees.forEach(([x, y, scale], index) => {
        if (place(x, y, 150)) this.createRegionalNatureTree(`OutskirtsNatureTree${index}`, x, y, 70 + index, Math.max(1.25, scale), RegionId.OUTSKIRTS, 'OutskirtsNatureTreeRoot');
      });
      [[492, -630], [492, -744], [1727, -629], [1727, -743]].forEach(([x, y], index) => {
        this.createOutskirtsAirwallJujube(`OutskirtsSouthAirwallJujube${index + 1}`, x, y);
      });
      const shrubs: Array<[number, number]> = [
        [-1820, 1710], [-1640, 1510], [-1810, 1210], [-1510, 1020], [-1800, 810], [-1510, 680], [-1810, -760], [-1510, -780],
        [1490, 1810], [1760, 1630], [1510, 1220], [1770, 1170], [1490, 920], [1780, 790], [1490, 620], [1800, 560],
      ];
      shrubs.forEach(([x, y], index) => { if (place(x, y)) this.createNatureShrub(`OutskirtsJujube${index}`, 'jujube-bush', x, y, 142, 142, RegionId.OUTSKIRTS); });
      [[-1730, 1590], [-1660, 1110], [-1710, 730], [-1640, -610], [1580, 1720], [1640, 1220], [1660, 820], [1450, 650]]
        .forEach(([x, y], index) => this.createNatureCluster(`OutskirtsMeadow${index}-`, x, y, RegionId.OUTSKIRTS, (px, py) => place(px, py, 90)));
      // Six broad road-safe groves fill the previously empty arms. Every
      // grove comprises six joined meadow cells, so its footprint is far
      // larger than the retained compact meadows above.
      [[1660, 120], [1440, -650], [720, -650], [-720, -690], [-1650, -120], [-1760, 920]]
        .forEach(([x, y], index) => this.createLargeNatureCluster(`OutskirtsGrove${index}-`, x, y, RegionId.OUTSKIRTS, (px, py) => place(px, py, 90)));
      // Retire the four previous grove nodes completely.  In particular, a
      // delayed ancient-tree frame must never recreate their former collider.
      ['OutskirtsGroveTree0', 'OutskirtsGroveTree3', 'OutskirtsGroveTree4', 'OutskirtsGroveTree5']
        .forEach(name => this.retireOutskirtsNatureTree(name));
      const rebuiltSouthRoadRightTrees: Array<[string, number, number, number]> = [
        ['OutskirtsSouthRoadRightTree1', 1800, 180, 150],
        ['OutskirtsSouthRoadRightTree2', -920, -720, 153],
        ['OutskirtsSouthRoadRightTree3', -1740, -100, 154],
        ['OutskirtsSouthRoadRightTree4', -1830, 980, 155],
      ];
      const southRoadRightTreeAirwalls = new Map<string, { x: number; y: number; w: number; h: number; name: string }>([
        ['OutskirtsSouthRoadRightTree1', { x: 1800, y: 75, w: 176, h: 68, name: 'OutskirtsSouthRoadRightTreeAirwall1' }],
        ['OutskirtsSouthRoadRightTree2', { x: -920, y: -825, w: 176, h: 68, name: 'OutskirtsSouthRoadRightTreeAirwall2' }],
        ['OutskirtsSouthRoadRightTree3', { x: -1740, y: -205, w: 176, h: 68, name: 'OutskirtsSouthRoadRightTreeAirwall3' }],
      ]);
      rebuiltSouthRoadRightTrees.forEach(([name, x, y, index]) => {
        if (place(x, y, 170)) {
          this.createRegionalNatureTree(
            name,
            x,
            y,
            index,
            1.35,
            RegionId.OUTSKIRTS,
            'OutskirtsNatureTreeRoot',
            southRoadRightTreeAirwalls.get(name),
          );
        }
      });
    });

    this.withObstacleRegion(RegionId.RIVERBANK, () => {
      const land = (x: number, y: number, width = 88, height = 88) => this.canPlaceRiverbankObject(x, y, width, height, ['LAND']);
      const shore = (x: number, y: number) => this.classifyRiverbankTerrain(x, y) === 'SHORE';
      const trees: Array<[number, number, number]> = [
        [-5750, 420, 1.25], [-5400, 300, 1.25], [-4500, 380, 1.25], [-4100, 260, 1.25],
        [-5750, -1720, 1.25], [-5480, -1550, 1.25], [-5160, -2020, 1.25], [-4860, -1710, 1.25], [-4540, -1530, 1.25], [-4210, -1780, 1.25],
        [-5700, -2470, 1.25], [-5350, -2640, 1.25], [-4600, -2460, 1.25], [-4140, -2310, 1.25],
      ];
      trees.forEach(([x, y, scale], index) => { if (land(x, y, 150, 160)) this.createRegionalNatureTree(`RiverbankNatureTree${index}`, x, y, 90 + index, scale, RegionId.RIVERBANK, 'RiverbankNatureTreeRoot'); });
      const shrubs: Array<[number, number]> = [
        [-5850, -1280], [-5600, -1170], [-5320, -1260], [-5050, -1390], [-4750, -1260], [-4470, -1390], [-4200, -1210], [-4020, -1450], [-5650, -2100], [-5360, -2200], [-5060, -2350], [-4540, -2200], [-4200, -2120],
      ];
      shrubs.forEach(([x, y], index) => { if (land(x, y, 118, 118)) this.createNatureShrub(`RiverbankJujube${index}`, 'jujube-bush', x, y, 138, 138, RegionId.RIVERBANK); });
      [[-5680, 310], [-5450, 120], [-4400, 160], [-4140, 420], [-5700, -1480], [-5350, -1800], [-4920, -1510], [-4520, -1820], [-4200, -1510], [-5500, -2260], [-4700, -2200]]
        .forEach(([x, y], index) => this.createNatureCluster(`RiverbankMeadow${index}-`, x, y, RegionId.RIVERBANK, (px, py) => land(px, py, 78, 78)));
      // Mid-riverbank: two broad groves on opposite sides of the central
      // north-bank road. They deliberately stay clear of the x=-4900 road.
      [[-5450, -620], [-4350, -620]]
        .forEach(([x, y], index) => this.createLargeNatureCluster(`RiverbankMidRoadGrove${index}-`, x, y, RegionId.RIVERBANK, (px, py) => land(px, py, 78, 78)));
      [[-5600, -650], [-4200, -650]]
        .forEach(([x, y], index) => { if (land(x, y, 170, 180)) this.createRegionalNatureTree(`RiverbankMidRoadTree${index}`, x, y, 180 + index, 1.35, RegionId.RIVERBANK, 'RiverbankNatureTreeRoot'); });
      [[-5750, 70], [-5590, 20], [-5420, 80], [-5200, 30], [-4700, 80], [-4520, 20], [-4300, 90], [-4110, 40], [-5650, -1120], [-5350, -1180], [-5050, -1210], [-4700, -1160], [-4380, -1220], [-4150, -1160]]
        .forEach(([x, y], index) => { if (shore(x, y)) this.createReeds(x, y, RegionId.RIVERBANK, `RiverbankNatureReedsB${index}`, 1); });
      [[-5680, -40], [-5500, -90], [-5280, -30], [-4900, -70], [-4620, -20], [-4420, -80], [-4200, -30], [-5520, -1260], [-5220, -1320], [-4920, -1280], [-4620, -1330], [-4320, -1270]]
        .forEach(([x, y], index) => { if (shore(x, y)) this.createReeds(x, y, RegionId.RIVERBANK, `RiverbankNatureWetGrassA${index}`, 3); });
    });

    this.withObstacleRegion(RegionId.ROYAL_TOMB, () => {
      [[900, -2900, 1.05], [960, -3820, 1.08], [1950, -2760, 1.02], [3600, -2760, 1.04], [620, -3150, 1.0], [2460, -2780, 1.0], [3660, -3850, 1.02]]
        .forEach(([x, y, scale], index) => this.createRegionalNatureTree(`RoyalTombNatureTree${index}`, x, y, 120 + index, scale, RegionId.ROYAL_TOMB, 'RoyalTombNatureTreeRoot'));
    });
  }

  private createReeds(x: number, y: number, natureRegionId?: RegionId, natureName?: string, forcedVariant?: number) {
    this.loadWetlandPlantSpriteFrames();
    const seed = this.wetlandReedSeed(x, y);
    if (forcedVariant === undefined && ((seed >>> 4) % 100) < this.wetlandPlantBlankPercent) return;

    const kind: WetlandPlantKind = forcedVariant !== undefined
      ? (forcedVariant < this.wetlandReedVariantCount ? 'reed' : 'grass')
      : ((seed >>> 24) % 100) < this.wetlandReedPercent ? 'reed' : 'grass';
    const firstVariant = kind === 'reed' ? 0 : this.wetlandReedVariantCount;
    const variantCount = kind === 'reed' ? this.wetlandReedVariantCount : 2;
    let variant = forcedVariant ?? (firstVariant + (seed % variantCount));
    // Generation order is fixed, so rotating a repeated choice remains fully
    // deterministic while preventing obvious runs of the same silhouette.
    if (forcedVariant === undefined && variant === this.previousWetlandPlantVariant) {
      variant = firstVariant + ((variant - firstVariant + 1) % variantCount);
    }
    this.previousWetlandPlantVariant = variant;

    const flipped = ((seed >>> 3) & 1) === 1;
    const jitterX = ((seed >>> 20) % 15) - 7;
    const jitterY = ((seed >>> 28) % 3) - 1;
    const [canvasWidth, canvasHeight] = this.wetlandPlantCanvasSizes[kind];
    const n = new Node(kind === 'reed' ? 'DynamicRiverReeds' : 'DynamicWetlandGrass');
    n.parent = this.world;
    n.setPosition(x + jitterX, y + jitterY, natureRegionId ? 64 : 12);
    n.addComponent(UITransform).setContentSize(canvasWidth, canvasHeight);

    const visual = new Node(kind === 'reed' ? 'WetlandReedSprite' : 'WetlandGrassSprite');
    visual.parent = n;
    visual.setPosition(0, this.wetlandPlantVisualOffsetY[kind], 0);
    visual.setScale(flipped ? -1 : 1, 1, 1);
    visual.addComponent(UITransform).setContentSize(canvasWidth, canvasHeight);
    const sprite = visual.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = false;
    sprite.color = Color.WHITE;
    sprite.spriteFrame = this.wetlandPlantFrames[variant];

    const plant: WetlandPlant = { root: n, sprite, variant, natureRegionId, natureName };
    this.wetlandPlants.push(plant);
    this.reportWetlandNatureVisible(plant);
    this.depthOccluders.push({
      node: n,
      footY: y + jitterY - 24,
      halfWidth: canvasWidth * (kind === 'reed' ? .42 : .46),
      coverHeight: kind === 'reed' ? 92 : 46,
      baseZ: natureRegionId ? 64 : 12,
      foregroundZ: 98,
    });
  }

  private reportWetlandNatureVisible(plant: WetlandPlant) {
    if (!plant.natureRegionId || plant.reported || !plant.sprite.spriteFrame || !plant.root.isValid) return;
    plant.root.setSiblingIndex((plant.root.parent?.children.length ?? 1) - 1);
    plant.reported = true;
    this.reportNatureDecorVisible(plant.natureName ?? plant.root.name, 'wetland-reeds', plant.root, plant.natureRegionId, false);
  }

  private wetlandReedSeed(x: number, y: number) {
    let hash = Math.imul(Math.round(x), 73856093) ^ Math.imul(Math.round(y), 19349663) ^ 0x51ed270b;
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d);
    hash ^= hash >>> 15;
    return hash >>> 0;
  }

  private loadWetlandPlantSpriteFrames() {
    if (this.wetlandPlantFramesRequested) return;
    this.wetlandPlantFramesRequested = true;
    this.wetlandPlantFramePaths.forEach((path, variant) => {
      resources.load(path, SpriteFrame, (error, frame) => {
        if (error || !frame) {
          console.error(`[YinXuCity] wetland plant SpriteFrame failed to load: ${path}`, error);
          return;
        }
        frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        this.wetlandPlantFrames[variant] = frame;
        this.wetlandPlants.forEach(plant => {
          if (plant.variant === variant && plant.root.isValid && plant.sprite.isValid) {
            plant.sprite.spriteFrame = frame;
            this.reportWetlandNatureVisible(plant);
          }
        });
      });
    });
  }

  private createCropPlant(x: number, y: number, index: number) {
    const root = new Node(`ReactiveMillet${index}`);
    root.parent = this.world;
    root.setPosition(x, y - 28, 9);
    root.addComponent(UITransform).setContentSize(62, 82);
    const visual = new Node(`ReactiveMilletVisual${index}`);
    visual.parent = root;
    visual.setPosition(0, 38, 0);
    visual.addComponent(UITransform).setContentSize(58, 76);
    const sprite = visual.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const plant: CropPlant = { root, visual, sprite, frames: [null, null, null, null], phase: index * .47, x, y, bend: 0, squash: 0 };
    for (let frameIndex = 0; frameIndex < 4; frameIndex++) {
      this.requestFrame(`millet-sway-${frameIndex}`, frame => {
        plant.frames[frameIndex] = frame;
        if (frameIndex === 0 && sprite.isValid && !sprite.spriteFrame) sprite.spriteFrame = frame;
      });
    }
    this.cropPlants.push(plant);
  }

  private createWildlifeSprite(name: string, asset: string, x: number, y: number, w: number, h: number, z: number, rangeX: number, rangeY: number, phase: number, speed: number) {
    const node = this.pixelSprite(name, asset, this.world, x, y, w, h, z);
    const motion: WildlifeMotion = name.includes('Frog') ? 'hop' : 'swim';
    this.wildlife.push({ node, baseX: x, baseY: y, phase, speed, rangeX, rangeY, lastX: x, motion });
    return node;
  }

  private createAnimatedDuckPair(name: string, x: number, y: number, z: number, rangeX: number, rangeY: number, phase: number, speed: number) {
    const root = new Node(name); root.parent = this.world; root.setPosition(x, y, z); root.addComponent(UITransform).setContentSize(112, 72);
    const wake = this.createAnimalWake(root, `${name}Wake`, -29, new Color(106, 166, 178, 165));
    const bodies: Node[] = [];
    const wings: Node[] = [];
    [[-18, 8, .9], [18, -8, 1]].forEach((data, index) => {
      const duck = new Node(`${name}Duck${index}`); duck.parent = root; duck.setPosition(data[0], data[1], 2); duck.addComponent(UITransform).setContentSize(58 * data[2], 42 * data[2]);
      const body = duck.addComponent(Graphics);
      body.fillColor = new Color(65, 47, 31); body.ellipse(5, -2, 21 * data[2], 12 * data[2]); body.fill();
      body.fillColor = new Color(146, 94, 47); body.ellipse(4, 0, 18 * data[2], 10 * data[2]); body.fill();
      body.fillColor = new Color(103, 66, 39); body.circle(-12 * data[2], 9 * data[2], 9 * data[2]); body.fill();
      body.fillColor = new Color(196, 139, 61); body.moveTo(-19 * data[2], 9 * data[2]); body.lineTo(-33 * data[2], 6 * data[2]); body.lineTo(-19 * data[2], 4 * data[2]); body.close(); body.fill();
      body.fillColor = new Color(235, 213, 157); body.circle(-15 * data[2], 12 * data[2], 2.2 * data[2]); body.fill();
      const wing = new Node(`${name}Wing${index}`); wing.parent = duck; wing.setPosition(7 * data[2], 1, 3); wing.addComponent(UITransform).setContentSize(30, 20);
      const wingGraphics = wing.addComponent(Graphics);
      wingGraphics.fillColor = new Color(101, 62, 37); wingGraphics.ellipse(0, 0, 12 * data[2], 6 * data[2]); wingGraphics.fill();
      wingGraphics.strokeColor = new Color(205, 150, 72); wingGraphics.lineWidth = 2; wingGraphics.moveTo(-7, 1); wingGraphics.lineTo(8, -2); wingGraphics.stroke();
      bodies.push(duck); wings.push(wing);
    });
    this.wildlife.push({ node: root, baseX: x, baseY: y, phase, speed, rangeX, rangeY, lastX: x, motion: 'swim', wake, bodyParts: bodies, wingParts: wings });
    return root;
  }

  private createAnimatedEgret(name: string, x: number, y: number, z: number, rangeX: number, rangeY: number, phase: number, speed: number) {
    const root = new Node(name); root.parent = this.world; root.setPosition(x, y, z); root.addComponent(UITransform).setContentSize(84, 108);
    const wake = this.createAnimalWake(root, `${name}FootRipples`, -29, new Color(96, 155, 166, 150));
    const legs: Node[] = [];
    [-7, 8].forEach((legX, index) => {
      const leg = new Node(`${name}Leg${index}`); leg.parent = root; leg.setPosition(legX, -8, 1); leg.addComponent(UITransform).setContentSize(18, 42);
      const legGraphics = leg.addComponent(Graphics);
      legGraphics.strokeColor = new Color(87, 55, 34); legGraphics.lineWidth = 3;
      legGraphics.moveTo(0, 8); legGraphics.lineTo(0, -19); legGraphics.lineTo(index === 0 ? -6 : 6, -23); legGraphics.stroke();
      legs.push(leg);
    });
    const body = new Node(`${name}Body`); body.parent = root; body.setPosition(0, 12, 3); body.addComponent(UITransform).setContentSize(78, 88);
    const g = body.addComponent(Graphics);
    g.strokeColor = new Color(77, 73, 61); g.lineWidth = 10; g.moveTo(-4, 5); g.bezierCurveTo(-18, 17, -14, 34, -23, 43); g.stroke();
    g.strokeColor = new Color(226, 224, 199); g.lineWidth = 7; g.moveTo(-4, 5); g.bezierCurveTo(-18, 17, -14, 34, -23, 43); g.stroke();
    g.fillColor = new Color(74, 73, 66); g.ellipse(8, 3, 24, 15); g.fill();
    g.fillColor = new Color(226, 224, 204); g.ellipse(7, 6, 21, 13); g.fill();
    g.fillColor = new Color(184, 185, 172); g.ellipse(12, 8, 13, 8); g.fill();
    g.fillColor = new Color(235, 232, 207); g.circle(-24, 44, 8); g.fill();
    g.fillColor = new Color(42, 42, 37); g.circle(-27, 46, 2); g.fill();
    g.fillColor = new Color(214, 148, 55); g.moveTo(-31, 44); g.lineTo(-48, 41); g.lineTo(-31, 39); g.close(); g.fill();
    this.wildlife.push({ node: root, baseX: x, baseY: y, phase, speed, rangeX, rangeY, lastX: x, motion: 'wade', wake, bodyParts: [body], legParts: legs });
    return root;
  }

  private createAnimalWake(parent: Node, name: string, y: number, color: Color) {
    const wake = new Node(name); wake.parent = parent; wake.setPosition(0, y, 0); wake.addComponent(UITransform).setContentSize(92, 34);
    const g = wake.addComponent(Graphics); g.strokeColor = color; g.lineWidth = 2.5;
    g.moveTo(-38, 0); g.quadraticCurveTo(-18, 9, 4, 1);
    g.moveTo(-28, -5); g.quadraticCurveTo(-6, 4, 30, -2);
    g.moveTo(-8, 6); g.quadraticCurveTo(12, 12, 38, 4); g.stroke();
    return wake;
  }

  private createJar(x: number, y: number, index: number) {
    const g = this.graphics(`Pottery${index}`, this.world, 22); g.fillColor = new Color(132, 77, 43); g.circle(0, 0, 22); g.fill(); g.fillColor = new Color(82, 52, 37); g.rect(-13, 15, 26, 9); g.fill(); g.node.setPosition(x, y);
    this.depthOccluders.push({ node: g.node, footY: y - 23, halfWidth: 25, coverHeight: 50, baseZ: 22, foregroundZ: 98 });
    this.addObstacle(x, y - 22, 38, 18, '陶罐基座');
  }

  private createBronzeDing(x: number, y: number) {
    const g = this.graphics('BronzeDing', this.world, 26); g.fillColor = new Color(45, 111, 103); g.roundRect(-28, -18, 56, 50, 11); g.fill(); g.strokeColor = new Color(204, 176, 91); g.lineWidth = 4; g.circle(0, 8, 17); g.stroke(); g.fillColor = new Color(69, 55, 39); g.rect(-20, -38, 8, 22); g.rect(12, -38, 8, 22); g.fill(); g.node.setPosition(x, y);
    this.depthOccluders.push({ node: g.node, footY: y - 40, halfWidth: 34, coverHeight: 80, baseZ: 26, foregroundZ: 98 });
    this.addObstacle(x, y - 39, 54, 22, '青铜鼎基座');
  }

  private scatterDynamicGrass() {
    let seed = 27183;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    // RIVERBANK receives authored vegetation only after its collision skeleton
    // is accepted. Do not scatter legacy grass into the phase-one layout.
    const zones = [this.mountainRegion, this.tombRegion];
    let created = 0;
    for (let attempt = 0; attempt < 1200 && created < 140; attempt++) {
      const zone = zones[attempt % zones.length];
      const x = zone.left + 80 + random() * (zone.right - zone.left - 160);
      const y = zone.bottom + 80 + random() * (zone.top - zone.bottom - 160);
      if (this.pointInAnyObstacle(x, y) || this.pointInWater(x, y, 36)) continue;
      const n = new Node(`StaticGrass${created}`); n.parent = this.world; n.setPosition(x, y, 8); n.addComponent(UITransform).setContentSize(44, 64);
      this.attachPixelSprite(n, 'grass-clump');
      created++;
    }
  }

  private drawWorldBoundary() {
    const t = 64; const hw = this.mapWidth / 2; const hh = this.mapHeight / 2;
    this.addObstacle(0, hh - t / 2, this.mapWidth, t, '北边界');
    this.addObstacle(0, -hh + t / 2, this.mapWidth, t, '南边界');
    this.addObstacle(-hw + t / 2, 0, t, this.mapHeight, '西边界');
    this.addObstacle(hw - t / 2, 0, t, this.mapHeight, '东边界');
  }

  private createAnimatedPlayer() {
    const root = new Node('AnimatedOracleApprentice');
    root.parent = this.world;
    root.addComponent(UITransform).setContentSize(44, 60);

    // The root is the character's foot/collision point. Every source frame is
    // normalized to the same raw canvas and foot baseline before import.
    const shadow = this.graphics('PlayerShadow', root, -3);
    shadow.fillColor = new Color(30, 37, 33, 88);
    shadow.ellipse(0, 1, 15, 5);
    shadow.fill();

    this.playerVisual = new Node('OracleApprenticeWalkFrames');
    this.playerVisual.parent = root;
    this.playerVisual.setPosition(0, 30, 4);
    // Keep the player distinct from villagers without visually overpowering
    // the map's buildings and authored NPCs.
    this.playerVisual.addComponent(UITransform).setContentSize(64, 64);
    this.playerSprite = this.playerVisual.addComponent(Sprite);
    this.playerSprite.sizeMode = Sprite.SizeMode.CUSTOM;

    this.heldToolNode = new Node('EquippedHandTool');
    this.heldToolNode.parent = this.playerVisual;
    this.heldToolNode.setPosition(15, -2, 8);
    this.heldToolNode.addComponent(UITransform).setContentSize(38, 58);
    this.heldToolGraphics = this.heldToolNode.addComponent(Graphics);
    this.heldToolNode.active = false;

    this.loadPlayerCharacterFrames();
    return root;
  }

  private playerCharacterFolder() {
    return this.save.avatarId === 'oracle-girl-pixel' ? 'oracle-girl-pixel' : 'oracle-boy-pixel';
  }

  private getIdleFrameIndex(facing: Facing): number {
    const folder = this.playerCharacterFolder();
    if (folder === 'oracle-girl-pixel') {
      return facing === 'left' || facing === 'right' ? 2 : 0;
    }
    return facing === 'left' || facing === 'right' ? 1 : 0;
  }

  private loadPlayerCharacterFrames() {
    if (!this.playerSprite?.isValid) return;
    const loadToken = ++this.playerSpriteLoadToken;
    this.displayedPlayerFrame = -1;
    this.playerFrames = {
      down: [null, null, null, null, null, null], left: [null, null, null, null, null, null],
      right: [null, null, null, null, null, null], up: [null, null, null, null, null, null],
    };
    const folder = this.playerCharacterFolder();
    (['down', 'left', 'right', 'up'] as Facing[]).forEach(direction => {
      for (let frameIndex = 0; frameIndex < this.playerFrameCount; frameIndex++) {
        this.requestSpriteFrame(`characters/${folder}/${direction}-${frameIndex}/spriteFrame`, frame => {
          if (loadToken !== this.playerSpriteLoadToken) return;
          this.playerFrames[direction][frameIndex] = frame;
          const idleIndex = this.getIdleFrameIndex(direction);
          if (direction === this.facing && frameIndex === idleIndex && this.playerSprite.isValid) {
            this.showPlayerFrame(idleIndex);
          }
        });
      }
    });
  }

  private animatePlayer(moving: boolean, direction: Vec2, movedDistance: number) {
    if (this.seated) {
      this.walkPhase = 0;
      // `down-*` is the front-facing sheet in the actual character resource;
      // screen-down is the room entrance direction.
      this.facing = 'down';
      this.showPlayerFrame(this.getIdleFrameIndex('down'));
      this.playerVisual.setPosition(0, 24, 4);
      this.playerVisual.setScale(.9, .78, 1);
      this.playerVisual.setRotationFromEuler(0, 0, 0);
      return;
    }
    this.playerVisual.setScale(1, 1, 1);
    if (direction.lengthSqr() > .001) {
      if (Math.abs(direction.x) > Math.abs(direction.y)) this.facing = direction.x < 0 ? 'left' : 'right';
      else this.facing = direction.y < 0 ? 'down' : 'up';
    }

    if (moving) {
      // Advance each pose every ~13.5 world pixels. At the player's travel
      // speed this gives each foot a fresh contact/passing pose before the
      // body has travelled a full stride, preventing a floating glide.
      this.walkPhase += movedDistance / 13.5;
      const walkSequence = [0, 1, 2, 3, 4, 5];
      const frameIndex = walkSequence[Math.floor(this.walkPhase) % walkSequence.length];
      this.showPlayerFrame(frameIndex);
      // The authored frames carry all gait motion.  Do not add a global bob or
      // torso lean here: it makes a planted walk read as hopping.
      this.playerVisual.setPosition(0, 30, 4);
      this.playerVisual.setRotationFromEuler(0, 0, 0);
    } else {
      this.walkPhase = 0;
      this.showPlayerFrame(this.getIdleFrameIndex(this.facing));
      this.playerVisual.setPosition(0, 30, 4);
      this.playerVisual.setRotationFromEuler(0, 0, 0);
    }
  }

  private showPlayerFrame(frameIndex: number) {
    const displayKey = (['down', 'left', 'right', 'up'].indexOf(this.facing) * this.playerFrameCount) + frameIndex;
    if (displayKey === this.displayedPlayerFrame) return;
    const frame = this.playerFrames[this.facing][frameIndex];
    if (!frame || !this.playerSprite?.isValid) return;
    this.playerSprite.spriteFrame = frame;
    this.displayedPlayerFrame = displayKey;
  }

  private updatePlayerFootsteps(movedDistance: number, movementAllowed: boolean) {
    const walkingOnOutdoorGround = movementAllowed
      && this.worldMode === 'outside'
      && !this.regionInputLocked
      && movedDistance > .01;
    if (!walkingOnOutdoorGround) {
      this.footstepDistance = 0;
      this.wasWalkingForAudio = false;
      return;
    }

    // 54 px at the current 158 px/s movement speed is roughly one step every
    // 0.34 seconds. Starting partway into the first stride avoids a long,
    // silent delay without producing an immediate click on direction changes.
    if (!this.wasWalkingForAudio) {
      this.footstepDistance = 26;
      this.wasWalkingForAudio = true;
    }
    this.footstepDistance += movedDistance;
    if (this.footstepDistance < 54) return;
    this.footstepDistance %= 54;
    this.audioManager.playFootstep();
  }

  private equipTool(tool: ToolKind) {
    this.equippedTool = tool;
    this.toolActionTimer = 0;
    if (tool === 'none') {
      if (this.heldToolNode?.isValid) this.heldToolNode.active = false;
      if (this.actionToolIconNode?.isValid) this.actionToolIconNode.active = false;
      return;
    }
    const asset = 'tool-shovel-v1';
    this.drawHeldTool(tool);
    // Equipping selects the action only.  The shovel should not be glued to
    // the character while walking; it appears solely for the brief dig swing.
    if (this.heldToolNode?.isValid) this.heldToolNode.active = false;
    this.requestFrame(asset, frame => {
      if (this.actionToolIconNode?.isValid) {
        const actionSprite = this.actionToolIconNode.getComponent(Sprite);
        this.actionToolIconNode.getComponent(UITransform)?.setContentSize(46, 58);
        if (actionSprite?.isValid) {
          actionSprite.spriteFrame = frame;
          actionSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
      }
    });
  }

  private drawHeldTool(tool: ToolKind) {
    const g = this.heldToolGraphics;
    if (!g?.isValid) return;
    g.clear();
    const outline = new Color(48, 38, 31);
    const woodDark = new Color(91, 57, 36);
    const woodLight = new Color(158, 104, 56);
    const bronze = new Color(72, 92, 77);
    const bronzeLight = new Color(145, 156, 105);

    if (tool === 'shovel') {
      g.fillColor = outline; g.rect(-3, -7, 7, 34); g.fill();
      g.fillColor = woodLight; g.rect(-1, -6, 3, 31); g.fill();
      g.fillColor = outline;
      g.moveTo(-9, -8); g.lineTo(-12, -22); g.lineTo(-7, -28); g.lineTo(8, -28); g.lineTo(12, -22); g.lineTo(8, -8); g.close(); g.fill();
      g.fillColor = bronze;
      g.moveTo(-6, -10); g.lineTo(-8, -21); g.lineTo(-4, -25); g.lineTo(6, -25); g.lineTo(8, -21); g.lineTo(5, -10); g.close(); g.fill();
      g.fillColor = bronzeLight; g.rect(-5, -21, 10, 2); g.fill();
    }

    // A two-tone hand is painted over the handle, so the tool reads as being
    // gripped by the character instead of pasted across the body sprite.
    const gripY = 3;
    g.fillColor = new Color(88, 48, 38); g.rect(-6, gripY - 4, 12, 9); g.fill();
    g.fillColor = new Color(222, 164, 96); g.rect(-4, gripY - 3, 8, 7); g.fill();
    g.fillColor = new Color(244, 190, 113); g.rect(-3, gripY + 2, 6, 2); g.fill();
  }

  private showStatusNotice(message: string, duration = 2.2) {
    this.statusNotice = message;
    this.statusNoticeTimer = duration;
    if (this.status?.isValid) this.status.string = message;
  }

  private updateHeldToolVisual() {
    if (!this.heldToolNode?.isValid) return;
    const active = this.toolActionTimer > 0;
    if (this.equippedTool === 'none' || this.seated || !active) {
      this.heldToolNode.active = false;
      return;
    }
    this.heldToolNode.active = true;
    const progress = active ? 1 - this.clamp(this.toolActionTimer / Math.max(.01, this.toolActionDuration), 0, 1) : 0;
    const swing = active ? Math.sin(progress * Math.PI) : 0;
    let x = 8; let y = -3; let z = 8; let rotation = -20;
    if (this.facing === 'left') { x = -8; y = -2; rotation = 26; }
    else if (this.facing === 'right') { x = 8; y = -2; rotation = -26; }
    else if (this.facing === 'up') { x = 6; y = 0; z = -1; rotation = 16; }
    else { x = 8; y = -4; rotation = -20; }
    const toolBias = 0;
    const actionArc = 76 * swing;
    this.heldToolNode.setPosition(x, y + swing * 4, z);
    this.heldToolNode.setScale(this.facing === 'left' ? -1 : 1, 1, 1);
    this.heldToolNode.setRotationFromEuler(0, 0, rotation + toolBias + actionArc);
  }

  private facingVector() {
    if (this.facing === 'left') return new Vec2(-1, 0);
    if (this.facing === 'right') return new Vec2(1, 0);
    if (this.facing === 'up') return new Vec2(0, 1);
    return new Vec2(0, -1);
  }

  private useEquippedTool() {
    if (this.overlay !== 'none' || this.seated || this.equippedTool === 'none' || this.toolActionTimer > 0) return;
    if (this.worldMode !== 'outside') {
      this.showStatusNotice('宗庙屋内不能使用野外工具。');
      return;
    }
    this.useShovel();
  }

  private useShovel() {
    const excavationSite = this.nearestActiveExcavationSite();
    if (excavationSite) {
      this.startExcavation(excavationSite);
      return;
    }
    const direction = this.facingVector();
    const x = this.playerPos.x + direction.x * 72;
    const y = this.playerPos.y + direction.y * 72;
    if (!this.canStandRadius(x, y, 12) || this.dugHoles.some(hole => Math.hypot(hole.x - x, hole.y - y) < 44)) {
      this.showStatusNotice('这里无法挖掘，请面向一块空地。');
      return;
    }
    this.toolActionDuration = .52;
    this.toolActionTimer = this.toolActionDuration;
    const hole = new Node(`TemporaryDugHole-${Date.now()}`);
    hole.parent = this.world;
    hole.setPosition(Math.round(x), Math.round(y), 13);
    hole.addComponent(UITransform).setContentSize(62, 38);
    const g = hole.addComponent(Graphics);
    g.fillColor = new Color(74, 48, 35, 105); g.ellipse(0, -4, 29, 12); g.fill();
    g.fillColor = new Color(67, 42, 31); g.ellipse(0, 0, 22, 9); g.fill();
    g.fillColor = new Color(104, 66, 39); g.ellipse(-20, 7, 9, 5); g.ellipse(19, 6, 10, 5); g.fill();
    g.fillColor = new Color(148, 96, 49); g.rect(-23, 9, 9, 3); g.rect(13, 9, 11, 3); g.fill();
    this.dugHoles.push({ node: hole, timer: 15, x, y });
    this.audioManager.playShovelDig();
    this.showStatusNotice('挖出了一处小土坑，约15秒后会自然填平。');
  }

  private useFishingHook() {
    if (this.fishingCastEffect) {
      this.toolActionDuration = .28;
      this.toolActionTimer = this.toolActionDuration;
      this.cancelFishingCast('已主动收回鱼钩。');
      return;
    }
    const direction = this.facingVector();
    let target: Vec2 | null = null;
    const perpendicular = new Vec2(-direction.y, direction.x);
    let lastWaterDistance = 0;
    // Keep sampling through the water body and retain the farthest valid point;
    // this produces an actual cast instead of dropping the hook at the bank.
    for (let distance = 84; distance <= 360; distance += 12) {
      let waterAtDistance = false;
      for (const lateral of [0, -28, 28, -52, 52]) {
        const x = this.playerPos.x + direction.x * distance + perpendicular.x * lateral;
        const y = this.playerPos.y + direction.y * distance + perpendicular.y * lateral;
        if (!this.pointInWater(x, y, -5)) continue;
        target = new Vec2(x, y);
        waterAtDistance = true;
        lastWaterDistance = distance;
        break;
      }
      if (!waterAtDistance && target && distance - lastWaterDistance > 48) break;
    }
    if (!target) {
      this.showStatusNotice('请靠近河流或湖泊，并面向水面抛钩。');
      return;
    }
    this.toolActionDuration = .82;
    this.toolActionTimer = this.toolActionDuration;
    const root = new Node('FishingHookWorldEffect');
    root.parent = this.world;
    root.setPosition(0, 0, 72);
    root.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);
    const line = root.addComponent(Graphics);
    const origin = new Vec2(this.playerPos.x + direction.x * 16, this.playerPos.y + 34 + direction.y * 9);
    const rippleNode = new Node('FishingHookWaterRipples');
    rippleNode.parent = root;
    rippleNode.setPosition(target.x, target.y, 1);
    rippleNode.addComponent(UITransform).setContentSize(180, 100);
    const ripple = rippleNode.addComponent(Graphics);
    const castDuration = .82;
    const waitDuration = 10;
    this.fishingCastEffect = {
      root, line, ripple, timer: castDuration + waitDuration, target, origin,
      playerOrigin: this.playerPos.clone(), castDuration, waitDuration,
    };
    this.showStatusNotice('甩杆中……鱼钩落水后将等待10秒。', 2.4);
  }

  private cancelFishingCast(message = '', showMessage = true) {
    const cast = this.fishingCastEffect;
    if (!cast) return;
    if (cast.root?.isValid) cast.root.destroy();
    this.fishingCastEffect = null;
    if (showMessage && message) this.showStatusNotice(message, 2.4);
  }

  private useMachete() {
    const direction = this.facingVector();
    let nearest: SwayObject | null = null;
    let nearestDistance = Infinity;
    for (const sway of this.sways) {
      if (!sway.node?.isValid || !sway.node.active || sway.node.parent !== this.world) continue;
      const plantName = sway.node.name.toLowerCase();
      if (/tree|crop|millet|wheat|vine|orchard|canopy|trunk/.test(plantName)) continue;
      if (this.cutPlantRegrowth.some(regrowth => regrowth.node === sway.node)) continue;
      const dx = sway.node.position.x - this.playerPos.x; const dy = sway.node.position.y - this.playerPos.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 20 || distance > 92) continue;
      const dot = (dx * direction.x + dy * direction.y) / distance;
      if (dot < .28 || distance >= nearestDistance) continue;
      nearest = sway; nearestDistance = distance;
    }
    this.toolActionDuration = .46;
    this.toolActionTimer = this.toolActionDuration;
    if (!nearest) {
      this.showStatusNotice('前方没有可清理的野生植物。');
      return;
    }
    nearest.node.active = false;
    this.cutPlantRegrowth.push({ node: nearest.node, timer: 22 });
    const clipping = this.localGraphics(`MacheteGrassClippings-${Date.now()}`, this.world, nearest.node.position.x, nearest.node.position.y, 90, 70, 70);
    clipping.fillColor = new Color(87, 126, 54);
    for (let i = 0; i < 9; i++) clipping.rect(-28 + i * 7, -5 + (i % 3) * 6, 4, 2 + i % 4);
    clipping.fill();
    this.scheduleOnce(() => { if (clipping.node.isValid) clipping.node.destroy(); }, .8);
    this.showStatusNotice('清理了一丛野生植物，它会在一段时间后重新生长。');
  }

  private updateToolEffects(dt: number) {
    this.toolActionTimer = Math.max(0, this.toolActionTimer - dt);
    this.updateExcavationEffects(dt);
    for (let index = this.dugHoles.length - 1; index >= 0; index--) {
      const hole = this.dugHoles[index];
      hole.timer -= dt;
      if (hole.timer <= 0 || !hole.node.isValid) {
        hole.node.destroy(); this.dugHoles.splice(index, 1); continue;
      }
      if (hole.timer < 1.8) {
        const scale = .78 + hole.timer / 1.8 * .22;
        hole.node.setScale(scale, scale, 1);
      }
    }
    for (let index = this.cutPlantRegrowth.length - 1; index >= 0; index--) {
      const regrowth = this.cutPlantRegrowth[index];
      regrowth.timer -= dt;
      if (regrowth.timer > 0 && regrowth.node.isValid) continue;
      if (regrowth.node.isValid) regrowth.node.active = true;
      this.cutPlantRegrowth.splice(index, 1);
    }
    const cast = this.fishingCastEffect;
    if (!cast?.root.isValid) { this.fishingCastEffect = null; return; }
        if (this.worldMode !== 'outside'
            || Vec2.distance(this.playerPos, cast.playerOrigin) > 10) {
      this.cancelFishingCast('你离开了钓位，鱼钩已经收回。');
      return;
    }
    cast.timer -= dt;
    const totalDuration = cast.castDuration + cast.waitDuration;
    const elapsed = totalDuration - cast.timer;
    const rawCastProgress = this.clamp(elapsed / cast.castDuration, 0, 1);
    const castProgress = 1 - Math.pow(1 - rawCastProgress, 3);
    const currentX = cast.origin.x + (cast.target.x - cast.origin.x) * castProgress;
    const currentY = cast.origin.y + (cast.target.y - cast.origin.y) * castProgress
      + Math.sin(rawCastProgress * Math.PI) * 76;

    cast.line.clear();
    cast.line.strokeColor = new Color(248, 233, 181, 245); cast.line.lineWidth = 3;
    cast.line.moveTo(cast.origin.x, cast.origin.y);
    cast.line.quadraticCurveTo(
      (cast.origin.x + currentX) / 2,
      Math.max(cast.origin.y, currentY) + (1 - rawCastProgress) * 28,
      currentX,
      currentY,
    );
    cast.line.stroke();
    cast.line.fillColor = rawCastProgress < 1 ? new Color(90, 88, 68) : new Color(197, 72, 48);
    cast.line.circle(currentX, currentY + 3, rawCastProgress < 1 ? 4 : 7); cast.line.fill();
    if (rawCastProgress >= 1) {
      cast.line.fillColor = new Color(246, 224, 158);
      cast.line.rect(currentX - 5, currentY + 7, 10, 6); cast.line.fill();
    }

    cast.ripple.clear();
    if (rawCastProgress >= 1) {
      const phase = (elapsed - cast.castDuration) * 2.4;
      for (let i = 0; i < 4; i++) {
        const cycle = (phase + i * .72) % 3.1;
        const radius = 8 + cycle * 17;
        const alpha = Math.max(0, 165 - cycle * 50);
        cast.ripple.strokeColor = new Color(196, 235, 229, Math.min(235, Math.round(alpha + 40)));
        cast.ripple.lineWidth = 3;
        cast.ripple.ellipse(0, 0, radius, radius * .42); cast.ripple.stroke();
      }
    }
    if (cast.timer <= 0) {
      this.toolActionDuration = .36;
      this.toolActionTimer = this.toolActionDuration;
      this.cancelFishingCast('十秒已到，鱼钩自动收回，这次没有钓到东西。');
    }
  }

  private createVillagers() {
    const definitions: Array<{ name: string; route: Array<[number, number]>; asset: string; speed: number; workIndices?: number[]; activityRegionId?: RegionId }> = [
      { name: '巡街陶匠', route: [[0, 440], [0, 820], [600, 820], [600, 440], [600, 60], [0, 60]], asset: 'villager-farmer-v2', speed: 74 },
      { name: '汲水妇人', route: [[-600, 60], [-600, 440], [-600, 820], [0, 820], [0, 440], [0, 60]], asset: 'villager-woman-v2', speed: 66 },
      { name: '集市商贩', route: [[600, 60], [600, 440], [0, 440], [-600, 440], [-600, 820], [0, 820], [600, 820]], asset: 'villager-woman-v2', speed: 70 },
      { name: '卜骨学徒', route: [[-600, 440], [0, 440], [600, 440], [600, 820]], asset: 'villager-farmer-v2', speed: 72 },
      { name: '田间老农', route: [[250, -760], [850, -760], [1100, -760], [1040, -980], [970, -1140]], asset: 'villager-farmer-v2', speed: 60, workIndices: [3, 4] },
      { name: '赶集妇人', route: [[600, 820], [600, 440], [0, 440], [0, 60], [0, -240], [0, -760], [500, -760], [900, -760]], asset: 'villager-woman-v2', speed: 68 },
      { name: '进城帮工', route: [[500, -760], [1100, -760], [1040, -980], [970, -1140]], asset: 'villager-farmer-v2', speed: 64, workIndices: [2, 3], activityRegionId: RegionId.FIELDS },
      { name: '南田雇农', route: [[1700, -760], [1640, -980], [1570, -1140]], asset: 'villager-farmer-v2', speed: 58, workIndices: [1, 2], activityRegionId: RegionId.FIELDS },
      { name: '东田雇农', route: [[2300, -760], [2240, -980], [2170, -1140]], asset: 'villager-farmer-v2', speed: 61, workIndices: [1, 2], activityRegionId: RegionId.FIELDS },
    ];
    definitions.forEach((definition, index) => {
      // Keep both cross-gate CITY villagers and their continuous routes. The
      // field-only farmer is not created inside the temporary OUTSKIRTS strip.
      if (index === 4) return;
      this.createWalkingVillager(
        definition.name,
        definition.route.map(point => new Vec2(point[0], point[1])),
        definition.asset,
        definition.speed,
        index,
        definition.workIndices ?? [],
        definition.activityRegionId,
      );
    });
  }

  private createWalkingVillager(
    name: string, route: Vec2[], asset: string, speed: number, variant: number,
    workIndices: number[], activityRegionId?: RegionId,
  ) {
    const root = new Node(name);
    root.parent = this.world;
    root.setPosition(route[0].x, route[0].y, 78);
    root.addComponent(UITransform).setContentSize(44, 60);

    const shadow = this.localGraphics(`${name}Shadow`, root, 0, 0, 34, 14, -3);
    shadow.fillColor = new Color(28, 34, 31, 72); shadow.ellipse(0, 1, 11, 3.5); shadow.fill();

    const visual = new Node(`${name}WalkFrames`);
    visual.parent = root;
    visual.setPosition(0, 30, 4);
    visual.addComponent(UITransform).setContentSize(64, 64);
    const sprite = visual.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    const frames: Record<Facing, Array<SpriteFrame | null>> = {
      down: [null, null, null, null], left: [null, null, null, null],
      right: [null, null, null, null], up: [null, null, null, null],
    };
    const villager: Villager = {
      root, visual, sprite, frames, route, routeIndex: 1, routeDirection: 1,
      target: route[1].clone(), facing: 'down', walkPhase: 0, displayedFrame: -1,
      velocity: new Vec2(), speed, pause: variant * .18, phase: variant * 1.37,
      facingHold: variant * .06, blockedTime: 0, avoidanceSign: variant % 2 === 0 ? 1 : -1, radius: this.actorRadius,
      workFrames: [null, null, null, null], workIndices, working: false, workTimer: 0, activityRegionId,
    };
    (['down', 'left', 'right', 'up'] as Facing[]).forEach(direction => {
      for (let frameIndex = 0; frameIndex < 4; frameIndex++) {
        this.requestSpriteFrame(`characters/${asset}/${direction}-${frameIndex}/spriteFrame`, frame => {
          villager.frames[direction][frameIndex] = frame;
          if (direction === villager.facing && frameIndex === 0 && sprite.isValid && !sprite.spriteFrame) sprite.spriteFrame = frame;
        });
      }
    });
    if (workIndices.length > 0) {
      for (let frameIndex = 0; frameIndex < 4; frameIndex++) {
        this.requestSpriteFrame(`characters/field-weeding-man-v1/work-${frameIndex}/spriteFrame`, frame => {
          villager.workFrames[frameIndex] = frame;
        });
      }
    }
    this.villagers.push(villager);
  }

  private updateVillagers(dt: number) {
    for (const villager of this.villagers) {
      const activeRegion = this.regionTransitionManager?.currentRegionId;
      if (villager.activityRegionId && activeRegion !== villager.activityRegionId) {
        villager.root.active = false;
        villager.working = false;
        continue;
      }
      villager.root.active = true;
      let movedDistance = 0;
      villager.facingHold = Math.max(0, villager.facingHold - dt);
      if (villager.working) {
        villager.workTimer -= dt;
        villager.velocity.multiplyScalar(Math.pow(.006, dt));
        this.animateWorkingVillager(villager);
        if (villager.workTimer <= 0) {
          villager.working = false;
          villager.displayedFrame = -1;
          villager.pause = .55 + Math.random() * .65;
          this.chooseNextVillagerTarget(villager);
        }
        continue;
      }
      if (villager.pause > 0) {
        villager.pause -= dt;
        const damping = Math.pow(.008, dt);
        villager.velocity.multiplyScalar(damping);
      } else {
        const dx = villager.target.x - villager.root.position.x;
        const dy = villager.target.y - villager.root.position.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 11) {
          villager.velocity.multiplyScalar(.18);
          if (villager.workIndices.includes(villager.routeIndex)
            && villager.workFrames.some(frame => frame !== null) && Math.random() < .82) {
            villager.working = true;
            villager.workTimer = 5.5 + Math.random() * 7.5;
            villager.displayedFrame = -1;
          } else {
            villager.pause = .75 + Math.random() * 1.65;
            this.chooseNextVillagerTarget(villager);
          }
        } else {
          const avoidance = this.dynamicAvoidance(villager.root, villager.root.position.x, villager.root.position.y, villager.radius);
          let steerX = dx / distance + avoidance.x * 1.7;
          let steerY = dy / distance + avoidance.y * 1.7;
          const steerLength = Math.max(.001, Math.hypot(steerX, steerY));
          steerX /= steerLength; steerY /= steerLength;

          const smoothing = 1 - Math.pow(.018, dt);
          villager.velocity.x += (steerX * villager.speed - villager.velocity.x) * smoothing;
          villager.velocity.y += (steerY * villager.speed - villager.velocity.y) * smoothing;
          const velocityLength = Math.max(.001, villager.velocity.length());
          const maxStep = Math.min(distance, velocityLength * dt);
          const baseX = villager.velocity.x / velocityLength;
          const baseY = villager.velocity.y / velocityLength;
          const angles = [0, .48 * villager.avoidanceSign, -.48 * villager.avoidanceSign, .92 * villager.avoidanceSign, -.92 * villager.avoidanceSign];
          let placed = false;
          for (const angle of angles) {
            const cos = Math.cos(angle); const sin = Math.sin(angle);
            const moveX = (baseX * cos - baseY * sin) * maxStep;
            const moveY = (baseX * sin + baseY * cos) * maxStep;
            const nextX = villager.root.position.x + moveX;
            const nextY = villager.root.position.y + moveY;
            if (!this.isNpcWalkable(villager, nextX, nextY)
              || !this.canNpcStep(villager.root.position.x, villager.root.position.y, nextX, nextY, villager.radius, villager.root)) continue;
            villager.root.setPosition(nextX, nextY, 78);
            villager.velocity.set(moveX / Math.max(dt, .001), moveY / Math.max(dt, .001));
            movedDistance = Math.hypot(moveX, moveY);
            villager.blockedTime = 0;
            placed = true;
            break;
          }
          if (!placed) {
            villager.velocity.multiplyScalar(.22);
            villager.blockedTime += dt;
            villager.avoidanceSign *= -1;
            if (villager.blockedTime > .7) {
              villager.pause = .45 + Math.random() * .55;
              this.chooseNextVillagerTarget(villager);
              villager.blockedTime = 0;
            }
          }
        }
      }
      this.updateVillagerFacing(villager);
      this.animateVillager(villager, movedDistance);
    }
  }

  private chooseNextVillagerTarget(villager: Villager) {
    // Villagers normally continue along their local street network. They only
    // reverse after stopping at an anchor, so direction changes never read as
    // an instantaneous mid-stride U-turn.
    if (Math.random() < .12 && villager.routeIndex > 0 && villager.routeIndex < villager.route.length - 1) villager.routeDirection *= -1;
    let nextIndex = villager.routeIndex + villager.routeDirection;
    if (nextIndex < 0 || nextIndex >= villager.route.length) {
      villager.routeDirection *= -1;
      nextIndex = villager.routeIndex + villager.routeDirection;
    }
    villager.routeIndex = this.clamp(nextIndex, 0, villager.route.length - 1);
    const anchor = villager.route[villager.routeIndex];
    const jitterX = (Math.random() - .5) * 10;
    const jitterY = (Math.random() - .5) * 10;
    const candidateX = anchor.x + jitterX;
    const candidateY = anchor.y + jitterY;
    if (this.isNpcWalkable(villager, candidateX, candidateY)
      && this.canStandRadius(candidateX, candidateY, villager.radius)) villager.target.set(candidateX, candidateY);
    else villager.target.set(anchor.x, anchor.y);
  }

  private animateWorkingVillager(villager: Villager) {
    const sequence = [0, 0, 1, 2, 2, 3];
    const frameIndex = sequence[Math.floor((this.elapsed + villager.phase) * 3.1) % sequence.length];
    const frame = villager.workFrames[frameIndex];
    if (frame && villager.sprite.isValid && villager.displayedFrame !== 100 + frameIndex) {
      villager.sprite.spriteFrame = frame;
      villager.displayedFrame = 100 + frameIndex;
    }
    const contact = frameIndex === 2 ? -1 : 0;
    villager.visual.setPosition(0, 30 + contact + Math.sin((this.elapsed + villager.phase) * 3.1) * .18, 4);
    villager.visual.setRotationFromEuler(0, 0, 0);
  }

  private updateVillagerFacing(villager: Villager) {
    if (villager.velocity.lengthSqr() < 36 || villager.facingHold > 0) return;
    const x = villager.velocity.x; const y = villager.velocity.y;
    let nextFacing = villager.facing;
    if (Math.abs(x) > Math.abs(y) * 1.18) nextFacing = x < 0 ? 'left' : 'right';
    else if (Math.abs(y) > Math.abs(x) * 1.18) nextFacing = y < 0 ? 'down' : 'up';
    if (nextFacing === villager.facing) return;
    villager.facing = nextFacing;
    villager.facingHold = .38 + (Math.sin(villager.phase) * .5 + .5) * .12;
  }

  private animateVillager(villager: Villager, movedDistance: number) {
    if (movedDistance > .01) {
      villager.walkPhase += movedDistance / 11.5;
      const walkSequence = [0, 1, 0, 3];
      const frameIndex = walkSequence[Math.floor(villager.walkPhase) % walkSequence.length];
      this.showVillagerFrame(villager, frameIndex);
      const stride = Math.sin(villager.walkPhase * Math.PI);
      villager.visual.setPosition(0, 30 + Math.abs(stride) * .55, 4);
      const lean = villager.facing === 'left' ? .45 : (villager.facing === 'right' ? -.45 : 0);
      villager.visual.setRotationFromEuler(0, 0, lean * stride);
    } else {
      villager.walkPhase = 0;
      this.showVillagerFrame(villager, 0);
      villager.visual.setPosition(0, 30 + Math.sin(this.elapsed * 1.8 + villager.phase) * .22, 4);
      villager.visual.setRotationFromEuler(0, 0, 0);
    }
  }

  private showVillagerFrame(villager: Villager, frameIndex: number) {
    const displayKey = (['down', 'left', 'right', 'up'].indexOf(villager.facing) * 4) + frameIndex;
    if (displayKey === villager.displayedFrame) return;
    const frame = villager.frames[villager.facing][frameIndex];
    if (!frame || !villager.sprite.isValid) return;
    villager.sprite.spriteFrame = frame;
    villager.displayedFrame = displayKey;
  }

  private createRestingTreeVillager() {
    const root = new Node('树下斗笠闲人');
    root.parent = this.world;
    root.setPosition(580, -635, 30);
    root.addComponent(UITransform).setContentSize(96, 72);

    const shadow = this.localGraphics('RestingVillagerShadow', root, 5, -8, 72, 18, 0);
    shadow.fillColor = new Color(35, 38, 31, 62); shadow.ellipse(0, 0, 28, 4); shadow.fill();

    const visual = new Node('斗笠闲人逐帧动画');
    visual.parent = root;
    visual.setPosition(0, 27, 4);
    visual.addComponent(UITransform).setContentSize(86, 64);
    const sprite = visual.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    const frames: Array<SpriteFrame | null> = [null, null, null, null];
    const resting: RestingVillager = { root, visual, sprite, frames, displayedFrame: -1, phase: 1.7 };
    for (let frameIndex = 0; frameIndex < 4; frameIndex++) {
      this.requestSpriteFrame(`characters/resting-douli-v3/idle-${frameIndex}/spriteFrame`, frame => {
        resting.frames[frameIndex] = frame;
        if (frameIndex === 0 && sprite.isValid && !sprite.spriteFrame) {
          sprite.spriteFrame = frame;
          resting.displayedFrame = 0;
        }
      });
    }

    this.restingVillager = resting;
    // This fixed resting NPC is authored inside FIELDS, but is created after
    // drawFields() has restored its obstacle-authoring scope.
    this.addObstacle(580, -635, 58, 28, '树下休息的村民', RegionId.FIELDS);
  }

  private updateRestingVillager() {
    const resting = this.restingVillager;
    if (!resting) return;
    const time = this.elapsed + resting.phase;
    const sequence = [0, 1, 0, 1, 0, 3, 0, 1, 0, 2];
    const frameIndex = sequence[Math.floor(time * 2.15) % sequence.length];
    const frame = resting.frames[frameIndex];
    if (frame && resting.sprite.isValid && resting.displayedFrame !== frameIndex) {
      resting.sprite.spriteFrame = frame;
      resting.displayedFrame = frameIndex;
    }
    const breath = Math.sin(time * 1.55);
    resting.visual.setPosition(0, 27 + breath * .18, 4);
    resting.visual.setRotationFromEuler(0, 0, Math.sin(time * .68) * .12);
  }

  private createHorseCarts() {
    const root = new Node('牵引运粮马车');
    root.parent = this.world;
    root.setPosition(500, -760, 76);
    root.addComponent(UITransform).setContentSize(192, 80);

    const shadow = this.localGraphics('HorseCartShadow', root, -8, -1, 188, 20, -2);
    shadow.fillColor = new Color(42, 34, 25, 54); shadow.ellipse(0, 0, 78, 5); shadow.fill();

    const visual = new Node('牵车人马车同步逐帧动画');
    visual.parent = root;
    visual.setPosition(0, 34, 4);
    visual.addComponent(UITransform).setContentSize(184, 70);
    const sprite = visual.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    const cart: HorseCart = {
      root, visual, sprite, frames: [null, null, null, null], displayedFrame: -1,
      leftX: 500, rightX: 2780, direction: 1, speed: 43, walkPhase: 0,
      pause: .8, phase: 4.1, radius: 76, turnPending: false,
    };
    for (let frameIndex = 0; frameIndex < 4; frameIndex++) {
      this.requestSpriteFrame(`characters/led-horse-cart-v1/walk-${frameIndex}/spriteFrame`, frame => {
        cart.frames[frameIndex] = frame;
        if (frameIndex === 0 && sprite.isValid && !sprite.spriteFrame) sprite.spriteFrame = frame;
      });
    }
    this.horseCarts.push(cart);
  }

  private updateHorseCarts(dt: number) {
    for (const cart of this.horseCarts) {
      if (cart.pause > 0) {
        cart.pause -= dt;
        if (cart.pause <= 0 && cart.turnPending) {
          cart.direction *= -1;
          cart.visual.setScale(cart.direction, 1, 1);
          cart.turnPending = false;
        }
        continue;
      }

      const step = cart.speed * dt * cart.direction;
      const nextX = cart.root.position.x + step;
      if (!this.canStandRadius(nextX, cart.root.position.y, 18)
        || !this.isDynamicClear(nextX, cart.root.position.y, cart.radius, cart.root)) {
        cart.pause = .38;
        continue;
      }

      cart.root.setPosition(nextX, cart.root.position.y, 76);
      cart.walkPhase += Math.abs(step) / 15;
      const frameIndex = Math.floor(cart.walkPhase) % 4;
      const frame = cart.frames[frameIndex];
      if (frame && cart.sprite.isValid && cart.displayedFrame !== frameIndex) {
        cart.sprite.spriteFrame = frame;
        cart.displayedFrame = frameIndex;
      }
      cart.visual.setPosition(0, 34 + Math.abs(Math.sin(cart.walkPhase * Math.PI)) * .25, 4);

      if ((cart.direction > 0 && nextX >= cart.rightX) || (cart.direction < 0 && nextX <= cart.leftX)) {
        cart.root.setPosition(cart.direction > 0 ? cart.rightX : cart.leftX, cart.root.position.y, 76);
        cart.pause = 2.2 + Math.random() * 1.3;
        cart.turnPending = true;
      }
    }
  }

  private animateEnvironment() {
    for (const sway of this.sways) {
      const dx = sway.node.position.x - this.playerPos.x;
      const dy = sway.node.position.y - this.playerPos.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > 1500 * 1500) continue;
      let rotation = Math.sin(this.elapsed * sway.speed + sway.phase) * sway.amplitude;
      if (sway.reactsToPlayer) {
        const distance = Math.sqrt(distanceSquared);
        if (distance < 78) rotation += this.clamp(dx / 78, -1, 1) * 18 * (1 - distance / 78);
      }
      sway.node.setRotationFromEuler(0, 0, rotation);
    }
    for (const ripple of this.ripples) {
      const dx = ripple.node.position.x - this.playerPos.x; const dy = ripple.node.position.y - this.playerPos.y;
      if (dx * dx + dy * dy > 1700 * 1700) continue;
      ripple.node.setPosition(ripple.baseX + Math.sin(this.elapsed * 1.2 + ripple.phase) * 13, ripple.node.position.y, ripple.node.position.z);
    }
    for (const flow of this.canalFlowMarks) {
      if (!flow.node.isValid) continue;
      const t = (this.elapsed * flow.speed + flow.phase) % 1;
      const x = flow.startX + (flow.horizontal ? flow.distance * t : 0);
      const y = flow.startY + (flow.horizontal ? 0 : -flow.distance * t);
      flow.node.setPosition(x, y, flow.node.position.z);
      const fade = Math.sin(Math.PI * t);
      flow.node.setScale(.82 + fade * .18, .82 + fade * .18, 1);
    }
    for (const animal of this.wildlife) {
      const dx = animal.baseX - this.playerPos.x; const dy = animal.baseY - this.playerPos.y;
      if (dx * dx + dy * dy > 1900 * 1900) continue;
      const time = this.elapsed * animal.speed + animal.phase;
      let nextX = animal.baseX;
      let nextY = animal.baseY;
      let rotation = 0;
      let scaleY = 1;
      if (animal.motion === 'wade') {
        const travel = Math.sin(time * .42);
        const stepPulse = Math.max(0, Math.sin(time * 4.2));
        const peck = this.clamp((Math.sin(time * .73) - .68) / .32, 0, 1);
        nextX = animal.baseX + travel * animal.rangeX;
        nextY = animal.baseY + Math.sin(time * .31 + animal.phase) * animal.rangeY + stepPulse * 2;
        rotation = -peck * 7;
        animal.bodyParts?.[0]?.setPosition(0, 12 - peck * 5 + stepPulse * 1.5, 3);
        animal.bodyParts?.[0]?.setRotationFromEuler(0, 0, -peck * 8);
        animal.legParts?.forEach((leg, index) => leg.setRotationFromEuler(0, 0, Math.sin(time * 4.2 + index * Math.PI) * 7 * (1 - peck)));
        animal.wake?.setScale(1 + stepPulse * .12, 1 - stepPulse * .08, 1);
      } else if (animal.motion === 'hop') {
        const hop = Math.max(0, Math.sin(time * 3.2));
        nextX = animal.baseX + Math.sin(time) * animal.rangeX;
        nextY = animal.baseY + Math.sin(time * .73 + animal.phase) * animal.rangeY + hop * 7;
        rotation = Math.sin(time * 2.1) * 3;
        scaleY = 1 - hop * .08;
      } else {
        const paddle = Math.sin(time * 4.6);
        nextX = animal.baseX + Math.sin(time) * animal.rangeX;
        nextY = animal.baseY + Math.sin(time * .73 + animal.phase * 1.6) * animal.rangeY + Math.abs(paddle) * 1.2;
        rotation = Math.sin(time * 1.7) * 1.35;
        scaleY = 1 + paddle * .012;
        animal.bodyParts?.forEach((part, index) => {
          const baseX = index === 0 ? -18 : 18; const baseY = index === 0 ? 8 : -8;
          part.setPosition(baseX, baseY + Math.sin(time * 5 + index * 1.8) * 1.4, 2);
          part.setRotationFromEuler(0, 0, Math.sin(time * 3.8 + index) * 1.8);
        });
        animal.wingParts?.forEach((wing, index) => wing.setRotationFromEuler(0, 0, Math.sin(time * 5.2 + index * 1.4) * 5));
        animal.wake?.setScale(1 + Math.abs(paddle) * .16, 1, 1);
      }
      const heading = nextX - animal.lastX;
      animal.node.setPosition(nextX, nextY, animal.node.position.z);
      // All authored/procedural wildlife faces left at rest: preserve that scale
      // while travelling left and mirror only when the animal moves right.
      const facingScale = Math.abs(heading) > .02 ? (heading < 0 ? 1 : -1) : (animal.node.scale.x || 1);
      animal.node.setScale(facingScale, scaleY, 1);
      animal.node.setRotationFromEuler(0, 0, rotation);
      animal.lastX = nextX;
    }
    for (const crop of this.cropPlants) {
      const dx = crop.x - this.playerPos.x; const dy = crop.y - this.playerPos.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > 1500 * 1500) continue;
      let frameIndex = Math.sin(this.elapsed * .9 + crop.phase) > 0 ? 0 : 2;
      let rotation = Math.sin(this.elapsed * 1.15 + crop.phase) * 1.8;
      let targetBend = 0;
      let targetSquash = 0;
      if (distanceSquared < 92 * 92) {
        const distance = Math.max(1, Math.sqrt(distanceSquared));
        const impact = 1 - distance / 92;
        // Crops are pushed away from the player's body. When entering from
        // above/below, neighbouring stalks alternate sides instead of locking
        // into the old left/right-only response.
        const side = Math.abs(dx) > 8 ? dx / distance : (Math.sin(crop.phase) >= 0 ? 1 : -1);
        frameIndex = side >= 0 ? 3 : 1;
        targetBend = (side * 12 + this.playerMotion.x * 8) * impact;
        targetSquash = (.16 + Math.abs(this.playerMotion.y) * .13) * impact;
      }
      // Keep a short impulse after contact so the field ripples behind the
      // player instead of snapping back as soon as the hit radius is left.
      crop.bend += (targetBend - crop.bend) * (targetBend === 0 ? .12 : .34);
      crop.squash += (targetSquash - crop.squash) * (targetSquash === 0 ? .14 : .38);
      if (distanceSquared >= 92 * 92 && Math.abs(crop.bend) > 2.2) frameIndex = crop.bend >= 0 ? 3 : 1;
      rotation += crop.bend;
      const frame = crop.frames[frameIndex];
      if (frame && crop.sprite.isValid && crop.sprite.spriteFrame !== frame) crop.sprite.spriteFrame = frame;
      crop.visual.setPosition(0, 38 - crop.squash * 38, 0);
      crop.visual.setScale(1 + crop.squash * .65, 1 - crop.squash, 1);
      crop.root.setRotationFromEuler(0, 0, rotation);
    }
  }

  /**
   * Trees use their trunk foot as the depth boundary. An actor north of that
   * point is behind the canopy; south of it the actor is drawn in front.
   * Collision remains limited to the trunk, so walking under foliage feels
   * natural instead of colliding with an invisible canopy rectangle.
   */
  private stabilizeMainMapRenderOrder() {
    if (!this.player?.isValid || this.player.parent !== this.world) return;
    // Static scene geometry is placed after all surface nodes exactly once.
    // It is never reordered in response to player or NPC distance.
    this.staticCityBoundaryNodes.forEach(node => {
      if (!node.isValid || node.parent !== this.world) return;
      node.setSiblingIndex((node.parent.children.length ?? 1) - 1);
    });
    this.updateTreeDepthOrdering();
  }

  private drawOutdoorCollisionDebug() {
    if (!SHOW_COLLISION_DEBUG) return;
    if ((game.config?.debugMode ?? DebugMode.NONE) === DebugMode.NONE) return;
    const shoreAndBridge = /RiverbankNorth(ShoreCollision|Bridge|BridgeWest|BridgeEast|PureWoodBridge)/;
    const labeled = /Wall|SouthGate|Corner|HouseFootprint|StructureFootprint|古树根部|SouthOutskirtsTrial|RiverbankNorthHighland/;
    const graphics = this.graphics('OutdoorCollisionDebug', this.world, 170);
    graphics.strokeColor = new Color(255, 72, 72, 225);
    graphics.lineWidth = 2;
    const drawLabeledOutline = (name: string, x: number, y: number, w: number, h: number) => {
      graphics.rect(x - w / 2, y - h / 2, w, h);
      const labelNode = new Node(`CollisionDebug-${name}`);
      labelNode.parent = this.world;
      labelNode.setPosition(x, y + h / 2 + 10, 171);
      labelNode.addComponent(UITransform).setContentSize(Math.max(120, w), 20);
      const label = labelNode.addComponent(Label);
      label.string = name;
      label.fontSize = 11;
      label.lineHeight = 13;
      label.horizontalAlign = Label.HorizontalAlign.CENTER;
      label.color = new Color(255, 225, 150);
    };
    const drawFilledOutline = (x: number, y: number, w: number, h: number, color: Color) => {
      graphics.strokeColor = color;
      graphics.rect(x - w / 2, y - h / 2, w, h);
    };
    this.obstacles.forEach(obstacle => {
      if (labeled.test(obstacle.name)) {
        drawLabeledOutline(obstacle.name, obstacle.x, obstacle.y, obstacle.w, obstacle.h);
      } else if (shoreAndBridge.test(obstacle.name)) {
        // Draw riverbank collision outlines without labels to keep the
        // scene readable.  Shore collision is green; bridge walls are blue.
        const isShore = /RiverbankNorthShoreCollision/.test(obstacle.name);
        const color = isShore
          ? new Color(80, 230, 120, 200)
          : new Color(90, 170, 255, 220);
        drawFilledOutline(obstacle.x, obstacle.y, obstacle.w, obstacle.h, color);
      }
    });
    // Overlay the bridge walkway opening (where collision is lifted so the
    // player can cross).  This rectangle is purely visual: it shows exactly
    // where the bank chain is broken for the bridge.
    if (this.riverbankPhaseOneBridge) {
      const bridge = this.riverbankPhaseOneBridge;
      const railOffset = 48;
      const westRailX = bridge.x - railOffset;
      const eastRailX = bridge.x + railOffset;
      const corridorLeft = westRailX + this.playerRadius;
      const corridorRight = eastRailX - this.playerRadius;
      const corridorTop = bridge.y + bridge.h / 2;
      const corridorBottom = bridge.y - bridge.h / 2;
      const w = corridorRight - corridorLeft;
      const h = corridorTop - corridorBottom;
      graphics.strokeColor = new Color(255, 180, 70, 240);
      graphics.lineWidth = 3;
      graphics.rect(corridorLeft, corridorBottom, w, h);
      graphics.stroke();
    }
    graphics.stroke();
    this.getUnregisteredStaticStructures().forEach(structure => {
      const size = structure.node.getComponent(UITransform)?.contentSize;
      drawLabeledOutline(`MISSING:${structure.node.name}`, structure.node.position.x, structure.node.position.y,
        size?.width ?? 80, size?.height ?? 80);
    });
    const b = this.cityBoundary;
    graphics.stroke();

    // Yellow is the imported horizontal-wall visual footprint. Collision
    // rectangles themselves are red above; this second red outline is the
    // forbidden player-foot-center range after adding radius.
    const southGate = b.gates.south;
    const leftWidth = southGate.center - southGate.gatehouseHalfWidth - b.left;
    const rightWidth = b.right - (southGate.center + southGate.gatehouseHalfWidth);
    const visual = this.graphics('SouthWallVisualBoundsDebug', this.world, 172);
    visual.strokeColor = new Color(255, 220, 70, 235); visual.lineWidth = 2;
    visual.rect(b.left, b.bottom - 71, leftWidth, 142);
    visual.rect(southGate.center + southGate.gatehouseHalfWidth, b.bottom - 71, rightWidth, 142);
    visual.stroke();
    const effective = this.graphics('SouthWallEffectiveCollisionDebug', this.world, 173);
    effective.strokeColor = new Color(255, 60, 60, 235); effective.lineWidth = 2;
    effective.rect(b.left - this.playerRadius, b.bottom - 80 - this.playerRadius,
      leftWidth + this.playerRadius * 2, 160 + this.playerRadius * 2);
    effective.rect(southGate.center + southGate.gatehouseHalfWidth - this.playerRadius,
      b.bottom - 80 - this.playerRadius, rightWidth + this.playerRadius * 2, 160 + this.playerRadius * 2);
    effective.stroke();
    const foot = this.localGraphics('PlayerFootCollisionDebug', this.player, 0, 0,
      this.playerRadius * 2, this.playerRadius * 2, 180);
    foot.strokeColor = new Color(80, 220, 255, 245); foot.lineWidth = 2;
    foot.circle(0, 0, this.playerRadius); foot.stroke();

    ['WestWallVisual', 'EastWallVisual', 'EastWallBottomVisual', 'EastWallTopVisual'].forEach(stripName => {
      const strip = this.cityWallVisualRoot?.getChildByName(stripName);
      strip?.children.forEach(tile => {
        const world = tile.worldPosition;
        const size = tile.getComponent(UITransform)?.contentSize;
        console.info(`[YinXuCity] ${stripName} tile`, {
          name: tile.name,
          parentPath: `${tile.parent?.parent?.name}/${tile.parent?.name}`,
          active: tile.active,
          activeInHierarchy: tile.activeInHierarchy,
          opacity: tile.getComponent(UIOpacity)?.opacity ?? 255,
          worldPosition: { x: world.x, y: world.y },
          aabb: size ? { minX: world.x - size.width / 2, maxX: world.x + size.width / 2, minY: world.y - size.height / 2, maxY: world.y + size.height / 2 } : null,
          createdBy: 'createVerticalWallVisual',
          siblingIndex: tile.getSiblingIndex(),
          valid: tile.isValid,
        });
        const labelNode = new Node(`WallTileDebug-${tile.name}`);
        labelNode.parent = this.world;
        labelNode.setPosition(strip.worldPosition.x, world.y + 20, 174);
        labelNode.addComponent(UITransform).setContentSize(190, 18);
        const label = labelNode.addComponent(Label);
        label.string = `${tile.name} (${Math.round(strip.worldPosition.x)},${Math.round(world.y)})`;
        label.fontSize = 10; label.lineHeight = 12;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.color = new Color(255, 245, 150);
      });
    });

    const blockedSamples: Array<[string, number, number]> = [];
    for (let x = b.left + 20; x <= b.right - 20; x += 64) {
      if (Math.abs(x - b.gates.south.center) <= b.gates.south.passageWidth / 2) continue;
      blockedSamples.push([`SouthWall@${x}`, x, -199]);
    }
    for (let y = b.bottom + 20; y <= b.top - 20; y += 64) {
      blockedSamples.push([`WestWall@${y}`, b.left, y], [`EastWall@${y}`, b.right, y]);
    }
    for (let x = b.left + 20; x <= b.right - 20; x += 64) blockedSamples.push([`NorthWall@${x}`, x, b.top]);
    blockedSamples.push(['SouthGateLeftGatehouseSolid', -132, -255], ['SouthGateRightGatehouseSolid', 132, -255]);
    const failedBlocked = blockedSamples.filter(([, x, y]) => this.canStandRadius(x, y, this.playerRadius));
    const passageSamples: Array<[string, number, number]> = [
      ['门洞外', 0, -330], ['台阶中央', 0, -286], ['门洞中央', 0, -220], ['门洞内', 0, -120],
    ];
    const failedPassage = passageSamples.filter(([, x, y]) => !this.canStandRadius(x, y, this.playerRadius));
    if (failedBlocked.length || failedPassage.length) {
      console.warn('[YinXuCity] city wall collision self-check failed', {
        unexpectedlyWalkable: failedBlocked.map(([name]) => name),
        unexpectedlyBlocked: failedPassage.map(([name]) => name),
      });
    } else {
      console.info(`[YinXuCity] city wall collision self-check passed: ${blockedSamples.length} wall/gate blockers, ${passageSamples.length} gate passage samples.`);
    }
  }

  /** Verifies all four interior approaches to both south gatehouse solids. */
  private runSouthGateCollisionChecks() {
    const gateBodies = this.obstacles.filter(obstacle =>
      obstacle.name === 'SouthGateLeftGatehouseSolid' || obstacle.name === 'SouthGateRightGatehouseSolid');
    const samples: Array<[string, number, number]> = [];
    gateBodies.forEach(body => {
      const inset = Math.max(this.playerRadius + 1, 12);
      samples.push(
        [`${body.name}:center`, body.x, body.y],
        [`${body.name}:north`, body.x, body.y + body.h / 2 - inset],
        [`${body.name}:south`, body.x, body.y - body.h / 2 + inset],
        [`${body.name}:west`, body.x - body.w / 2 + inset, body.y],
        [`${body.name}:east`, body.x + body.w / 2 - inset, body.y],
      );
    });
    const passage: Array<[string, number, number]> = [
      ['SouthGatePassageSouth', 0, -330],
      ['SouthGatePassageSteps', 0, -286],
      ['SouthGatePassageCenter', 0, -220],
      ['SouthGatePassageNorth', 0, -120],
    ];
    const failedSolid = samples.filter(([, x, y]) => this.canStandRadius(x, y, this.playerRadius));
    const failedPassage = passage.filter(([, x, y]) => !this.canStandRadius(x, y, this.playerRadius));
    if (failedSolid.length || failedPassage.length) {
      console.error('[YinXuCity] south gate AABB verification failed', {
        unexpectedlyWalkable: failedSolid.map(([name]) => name),
        unexpectedlyBlocked: failedPassage.map(([name]) => name),
      });
      return;
    }
    console.info(`[YinXuCity] south gate AABB verification passed: ${samples.length} solid samples, ${passage.length} passage samples.`);
  }

  private getSouthOutskirtsSurfaceCeilingIndex() {
    let ceiling = -1;
    this.southOutskirtsSurfaceNodes.forEach(node => {
      if (node.isValid && node.parent === this.world) ceiling = Math.max(ceiling, node.getSiblingIndex());
    });
    return ceiling;
  }

  private updateTreeDepthOrdering() {
    this.updateStoryNpcWorldLabels();
    if (!this.player?.isValid) return;
    if (this.player.parent !== this.world) {
      this.updateTempleSeatDepthOrdering();
      return;
    }
    const currentRegionId = this.regionTransitionManager?.currentRegionId;
    const actors: Array<{ node: Node; baselineY: number }> = [
      { node: this.player, baselineY: this.playerPos.y },
    ];
    this.villagers.forEach(villager => {
      if (villager.root.isValid && villager.root.activeInHierarchy && villager.root.parent === this.world) {
        actors.push({ node: villager.root, baselineY: villager.root.position.y });
      }
    });
    this.horseCarts.forEach(cart => {
      if (cart.root.isValid && cart.root.activeInHierarchy && cart.root.parent === this.world) {
        actors.push({ node: cart.root, baselineY: cart.root.position.y });
      }
    });
    for (const tree of this.depthTrees) {
      if (tree.node.isValid && tree.node.activeInHierarchy && tree.node.parent === this.world) {
        actors.push({ node: tree.node, baselineY: tree.trunkY });
      }
    }
    if (currentRegionId === RegionId.FIELDS || currentRegionId === RegionId.ROYAL_TOMB) {
      for (const occluder of this.depthOccluders) {
        if (occluder.regionId === currentRegionId
          && occluder.node.isValid
          && occluder.node.activeInHierarchy
          && occluder.node.parent === this.world) {
          actors.push({ node: occluder.node, baselineY: occluder.footY });
        }
      }
    }
    // Higher/northern baselines render first; lower/southern actors render on
    // top. FIELDS wall/prop sprites join this same foot-Y pass so objects behind
    // a wall stay behind it while foreground actors can still pass in front.
    actors.sort((a, b) => b.baselineY - a.baselineY || a.node.name.localeCompare(b.node.name));
    actors.forEach(actor => actor.node.setSiblingIndex((actor.node.parent?.children.length ?? 1) - 1));

    // Gate beams and bridge railings are intentionally split foreground
    // pieces. They must stay above every actor regardless of nearby props.
    this.fixedForegroundNodes.forEach(node => {
      if (node.isValid && node.parent === this.player.parent) node.setSiblingIndex((node.parent?.children.length ?? 1) - 1);
    });
    this.updateTempleSeatDepthOrdering();
    if (this.templeCollisionDebug?.isValid && this.templeCollisionDebug.parent === this.player.parent) {
      this.templeCollisionDebug.setSiblingIndex((this.templeCollisionDebug.parent?.children.length ?? 1) - 1);
    }
  }

  private updateTorches(dt: number) {
    const raining = this.weather === '小雨' || this.weather === '雨天' || this.weather === '中雨';
    this.torchRenderTimer += dt;
    const redraw = this.torchRenderTimer >= 1 / 24;
    if (redraw) this.torchRenderTimer %= 1 / 24;
    for (const torch of this.torchFlames) {
      if (!torch.root.isValid) continue;
      const exposedToRain = raining && !torch.sheltered;
      const target = exposedToRain ? 0 : 1;
      const response = 1 - Math.pow(exposedToRain ? .00004 : .035, dt);
      torch.intensity += (target - torch.intensity) * response;
      if (!redraw) continue;
      this.drawTorchFlame(torch, exposedToRain);
    }
  }

  private drawTorchFlame(torch: TorchFlame, raining: boolean) {
    const flame = torch.flame; const glow = torch.glow; const embers = torch.embers;
    if (!flame.isValid || !glow.isValid || !embers.isValid) return;
    flame.clear(); glow.clear(); embers.clear();
    const intensity = this.clamp(torch.intensity, 0, 1);
    const time = this.elapsed * 5.1 + torch.phase;

    // The ember bed stays visible after rain has killed the flame. A pair of
    // light smoke curls makes the state change readable without a screen tint.
    flame.fillColor = new Color(54, 40, 31, 255);
    flame.ellipse(0, -10, 17, 6); flame.fill();
    flame.fillColor = new Color(137, 62, 37, 210);
    flame.rect(-11, -10, 7, 3); flame.rect(2, -9, 8, 3); flame.fill();
    if (intensity < .06) {
      const drift = Math.sin(time * .42) * 3;
      embers.fillColor = new Color(152, 159, 145, raining ? 105 : 70);
      embers.circle(drift - 2, 2 + (time * 2 % 9), 2.2); embers.fill();
      embers.fillColor = new Color(112, 122, 115, raining ? 72 : 48);
      embers.circle(-drift + 3, 10 + (time * 1.4 % 12), 2.8); embers.fill();
      return;
    }

    const pulse = .88 + Math.sin(time * 1.9) * .07 + Math.sin(time * 3.7 + 1.2) * .05;
    const lean = Math.sin(time * .83) * 3.3 + Math.sin(time * 1.71 + .4) * 1.4;
    const height = (28 + Math.sin(time * 2.6) * 4) * intensity * pulse;
    const alpha = Math.round(225 * intensity);
    glow.fillColor = new Color(246, 146, 52, Math.round(30 * intensity));
    glow.circle(0, 0, 31 + Math.sin(time) * 3); glow.fill();

    flame.fillColor = new Color(191, 55, 27, alpha);
    flame.moveTo(-13 * intensity, -8);
    flame.bezierCurveTo(-17, 2, -7 + lean * .35, height * .56, lean, height);
    flame.bezierCurveTo(9 + lean * .35, height * .48, 17, 2, 13 * intensity, -8);
    flame.close(); flame.fill();
    flame.fillColor = new Color(246, 126, 34, Math.round(245 * intensity));
    flame.moveTo(-9, -8); flame.bezierCurveTo(-9, 2, -2 + lean * .3, height * .47, lean * .65, height * .76);
    flame.bezierCurveTo(7, height * .39, 11, 0, 8, -8); flame.close(); flame.fill();
    flame.fillColor = new Color(255, 220, 103, Math.round(255 * intensity));
    flame.moveTo(-4, -7); flame.bezierCurveTo(-5, 2, lean * .28, height * .35, lean * .35, height * .52);
    flame.bezierCurveTo(5, height * .25, 6, -1, 4, -7); flame.close(); flame.fill();

    for (let i = 0; i < 3; i++) {
      const rise = (time * (5.2 + i * .7) + i * 17) % 30;
      if (rise > 20 * intensity) continue;
      const emberX = Math.sin(time * 1.3 + i * 2.2) * (5 + i * 2) + lean * .3;
      embers.fillColor = i === 0 ? new Color(255, 206, 85, Math.round(190 * intensity)) : new Color(234, 100, 38, Math.round(150 * intensity));
      embers.rect(Math.round(emberX), Math.round(rise + 2), i === 0 ? 2 : 3, i === 0 ? 3 : 2); embers.fill();
    }
  }

  private followCamera(dt: number) {
    if (this.worldMode === 'templeInterior') return;
    const follow = 1 - Math.pow(.0012, dt);
    this.cameraPos.x += (this.playerPos.x - this.cameraPos.x) * follow;
    this.cameraPos.y += (this.playerPos.y - this.cameraPos.y) * follow;
    const visible = view.getVisibleSize();
    const regionBounds = this.regionTransitionManager?.cameraBounds;
    let bounds = regionBounds ?? {
      minX: -this.mapWidth / 2, maxX: this.mapWidth / 2,
      minY: -this.mapHeight / 2, maxY: this.mapHeight / 2,
    };
    // Expand CITY camera bounds westward to include OUTSKIRTS ring so player
    // can see the outside ground when standing at west/east/north gates.
    const currentRegion = this.regionTransitionManager?.currentRegionId;
    if (currentRegion === 'CITY') {
      bounds = {
        minX: -2020, maxX: 2020,
        minY: -960, maxY: 2170,
      };
    }
    const minCameraX = bounds.minX + visible.width / 2;
    const maxCameraX = bounds.maxX - visible.width / 2;
    const minCameraY = bounds.minY + visible.height / 2;
    const maxCameraY = bounds.maxY - visible.height / 2;
    const cameraX = minCameraX > maxCameraX ? (bounds.minX + bounds.maxX) / 2 : this.clamp(this.cameraPos.x, minCameraX, maxCameraX);
    const cameraY = minCameraY > maxCameraY ? (bounds.minY + bounds.maxY) / 2 : this.clamp(this.cameraPos.y, minCameraY, maxCameraY);
    this.world.setPosition(-Math.round(cameraX), -Math.round(cameraY), 0);
  }

  /** Region transitions call this only while the black overlay is opaque. */
  private syncCameraImmediately() {
    this.cameraPos.set(this.playerPos.x, this.playerPos.y);
    this.followCamera(1);
  }

  private canStand(x: number, y: number) {
    return this.canStandRadius(x, y, this.playerRadius);
  }

  private canStandRadius(x: number, y: number, radius: number, ignoreElevationHysteresis = false) {
    const hw = this.mapWidth / 2 - 66; const hh = this.mapHeight / 2 - 66;
    if (x < -hw || x > hw || y < -hh || y > hh) return false;
    if (!ignoreElevationHysteresis && !this.canStandInElevationTransition(x, y, radius, this.riverbankElevationTransition)) return false;
    const regionId = this.regionTransitionManager?.currentRegionId;
    for (const r of this.obstacles) {
      // A scoped obstacle never becomes global merely because this check runs
      // before a manager snapshot exists. CITY/OUTSKIRTS are the one intended
      // shared collision pair.
      if (r.regionId && r.regionId !== regionId) {
        // CITY may render nearby OUTSKIRTS nature, but its trees and jujube
        // roots must never become invisible CITY collision.  Other shared
        // CITY/OUTSKIRTS route and wall collision remains unchanged.
        if (regionId === RegionId.CITY && r.regionId === RegionId.OUTSKIRTS
          && /^(OutskirtsNatureTreeRoot|OutskirtsGroveTree|OutskirtsSouthAirwallTree|OutskirtsSouthAirwallJujube|OutskirtsSouthRoadRightTreeAirwall|OutskirtsJujube)/.test(r.name)) continue;
        const isShared = (regionId === 'CITY' || regionId === 'OUTSKIRTS') && (r.regionId === 'CITY' || r.regionId === 'OUTSKIRTS');
        if (!isShared) continue;
      }
      if (x + radius > r.x - r.w / 2 && x - radius < r.x + r.w / 2 && y + radius > r.y - r.h / 2 && y - radius < r.y + r.h / 2) {
        console.debug('[HIT]', { currentRegionId: regionId, obstacleName: r.name, obstacleRegionId: r.regionId, bounds: r, source: r.source, player: { x, y, radius } });
        return false;
      }
    }
    if (this.pointInWater(x, y, radius)) return false;
    return true;
  }

  /** Runtime audit for reported collision positions; mirrors canStandRadius filtering exactly. */
  private scanCollisionProbe(label: string, x: number, y: number, radius = 112) {
    const currentRegionId = this.regionTransitionManager?.currentRegionId;
    const overlaps = this.obstacles.map(r => {
      const intersects = x + radius > r.x - r.w / 2 && x - radius < r.x + r.w / 2
        && y + radius > r.y - r.h / 2 && y - radius < r.y + r.h / 2;
      const sharedCityOutskirts = (currentRegionId === RegionId.CITY || currentRegionId === RegionId.OUTSKIRTS)
        && (r.regionId === RegionId.CITY || r.regionId === RegionId.OUTSKIRTS);
      const skippedForRegion = !!r.regionId && r.regionId !== currentRegionId && !sharedCityOutskirts;
      return { r, intersects, skippedForRegion };
    }).filter(candidate => candidate.intersects);
    const waterSegments = this.waterSegments.filter(segment => this.pointToSegmentDistance(x, y, segment.ax, segment.ay, segment.bx, segment.by) < segment.radius + radius)
      .map(segment => ({ ax: segment.ax, ay: segment.ay, bx: segment.bx, by: segment.by, radius: segment.radius }));
    console.info('[CollisionProbe]', {
      label, currentRegionId: currentRegionId ?? 'UNINITIALIZED', point: { x, y, radius },
      obstacles: overlaps.map(({ r, skippedForRegion }) => ({ name: r.name, regionId: r.regionId ?? 'UNSCOPED', aabb: { x: r.x, y: r.y, width: r.w, height: r.h }, source: r.source ?? 'YinXuCity.addObstacle()', skippedForRegion, participatesInCanStandRadius: !skippedForRegion })),
      waterSegments,
    });
  }

  private canStandInElevationTransition(
    x: number,
    y: number,
    radius: number,
    config: ElevationTransitionConfig,
  ) {
    if (config.enabled === false) return true;
    // Destination validation runs before RegionTransitionManager commits the
    // target RegionId. Scope elevation rules to the candidate coordinates;
    // otherwise RIVERBANK -> OUTSKIRTS incorrectly validates (0,-860) as an
    // UPPER-cliff point and restores the riverbank source snapshot.
    if (!this.inRegion(x, y, this.riverRegion)) return true;
    const overlapsCliffBand = y + radius > config.cliffBand.bottom
      && y - radius < config.cliffBand.top;
    const centeredOnStairs = x - radius >= config.stairPassage.left
      && x + radius <= config.stairPassage.right
      && y + radius > config.stairPassage.bottom
      && y - radius < config.stairPassage.top;
    if (overlapsCliffBand && !centeredOnStairs) return false;

    // Hysteresis: an actor keeps its current terrain layer throughout the
    // stairs and commits only after its foot point clears the opposite line.
    if (this.terrainElevation === 'UPPER' && y < config.lowerCommitY && !centeredOnStairs) return false;
    if (this.terrainElevation === 'LOWER' && y > config.upperCommitY && !centeredOnStairs) return false;
    return true;
  }

  private updateTerrainElevationState(force = false) {
    const config = this.riverbankElevationTransition;
    const inRiverbank = this.regionTransitionManager?.currentRegionId === config.regionId
      || this.inRegion(this.playerPos.x, this.playerPos.y, this.riverRegion);
    if (!inRiverbank) {
      if (this.terrainElevationDebugLabel) this.terrainElevationDebugLabel.string = 'Elevation: —';
      return;
    }
    if (force) {
      this.terrainElevation = this.playerPos.y >= (config.upperCommitY + config.lowerCommitY) / 2
        ? 'UPPER' : 'LOWER';
    } else if (this.terrainElevation === 'UPPER' && this.playerPos.y <= config.lowerCommitY) {
      this.terrainElevation = 'LOWER';
    } else if (this.terrainElevation === 'LOWER' && this.playerPos.y >= config.upperCommitY) {
      this.terrainElevation = 'UPPER';
    }
    if (this.terrainElevationDebugLabel) {
      this.terrainElevationDebugLabel.string =
        `Elevation: ${this.terrainElevation}\nTransition: ${config.id}`;
    }
  }

  private canPlayerStand(x: number, y: number) {
    if (this.worldMode === 'templeInterior') return this.isTempleFootprintClear(x, y);
    return this.canStandRadius(x, y, this.playerRadius)
      && this.isDynamicClear(x, y, this.actorRadius, null);
  }

  private isTempleFootprintClear(x: number, y: number) {
    const bounds = this.templeWalkBounds;
    if (x - this.templeFootHalfWidth < bounds.left || x + this.templeFootHalfWidth > bounds.right
      || y - this.templeFootHalfHeight < bounds.bottom || y + this.templeFootHalfHeight > bounds.top) return false;
    return !this.interiorObstacles.some(obstacle => this.templeFootOverlapsObstacle(x, y, obstacle));
  }

  private templeFootOverlapsObstacle(x: number, y: number, obstacle: RectObstacle) {
    return x + this.templeFootHalfWidth > obstacle.x - obstacle.w / 2
      && x - this.templeFootHalfWidth < obstacle.x + obstacle.w / 2
      && y + this.templeFootHalfHeight > obstacle.y - obstacle.h / 2
      && y - this.templeFootHalfHeight < obstacle.y + obstacle.h / 2;
  }

  private runTempleCollisionDeterministicChecks() {
    const find = (name: string) => this.interiorObstacles.find(obstacle => obstacle.name.includes(name));
    const checks: Array<{ name: string; x: number; y: number }> = [];
    const addEdgeChecks = (label: string, obstacle: RectObstacle | undefined) => {
      if (!obstacle) return;
      const left = obstacle.x - obstacle.w / 2 - this.templeFootHalfWidth + 1;
      const right = obstacle.x + obstacle.w / 2 + this.templeFootHalfWidth - 1;
      const bottom = obstacle.y - obstacle.h / 2 - this.templeFootHalfHeight + 1;
      const top = obstacle.y + obstacle.h / 2 + this.templeFootHalfHeight - 1;
      checks.push(
        { name: `${label}:left`, x: left, y: obstacle.y },
        { name: `${label}:right`, x: right, y: obstacle.y },
        { name: `${label}:bottom`, x: obstacle.x, y: bottom },
        { name: `${label}:top`, x: obstacle.x, y: top },
        { name: `${label}:lower-left-diagonal`, x: left, y: bottom },
        { name: `${label}:lower-right-diagonal`, x: right, y: bottom },
        { name: `${label}:upper-left-diagonal`, x: left, y: top },
        { name: `${label}:upper-right-diagonal`, x: right, y: top },
        { name: `${label}:center-gap`, x: obstacle.x, y: obstacle.y },
      );
    };
    addEdgeChecks('left-brazier', find('左火盆'));
    addEdgeChecks('right-brazier', find('右火盆'));
    addEdgeChecks('cabinet-pair', find('双列甲骨'));
    addEdgeChecks('divination-table', find('中央占卜案桌'));
    addEdgeChecks('tool-bench', find('右侧材料工具台'));
    addEdgeChecks('divination-chair', find('指定占卜座椅'));
    // Explicit authored details called out by the acceptance screenshots.
    [-542, -421, -397, -274].forEach((x, index) => checks.push({ name: `cabinet-foot-${index + 1}`, x, y: -75 }));
    checks.push(
      { name: 'cabinet-center-seam', x: -410, y: -75 },
      { name: 'table-left-leg', x: -105, y: -150 },
      { name: 'table-right-leg', x: 105, y: -150 },
      { name: 'table-between-legs', x: 0, y: -150 },
      { name: 'tool-bench-left-leg', x: 370, y: -32 },
      { name: 'tool-bench-right-leg', x: 548, y: -32 },
      { name: 'tool-bench-between-legs', x: 466, y: -32 },
    );
    const failures = checks.filter(check => this.isTempleFootprintClear(check.x, check.y));
    if (failures.length > 0) console.error('[YinXuCity] temple collision edge checks failed:', failures);
    else console.info(`[YinXuCity] temple collision edge checks passed: ${checks.length}`);
  }

  private movePlayerWithCollision(dx: number, dy: number) {
    // Fixed-size sweep steps keep every authored wall, house footprint and
    // prop solid even during a long browser frame. Axis separation preserves
    // natural wall-sliding instead of making the player stick on corners.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    const stepX = dx / steps;
    const stepY = dy / steps;
    for (let index = 0; index < steps; index++) {
      if (this.canPlayerStand(this.playerPos.x + stepX, this.playerPos.y)) this.playerPos.x += stepX;
      else if (Math.abs(stepX) > .01) this.blocked = true;
      if (this.canPlayerStand(this.playerPos.x, this.playerPos.y + stepY)) this.playerPos.y += stepY;
      else if (Math.abs(stepY) > .01) this.blocked = true;
    }
  }

  private canNpcStep(fromX: number, fromY: number, x: number, y: number, radius: number, self: Node) {
    if (!this.canStandRadius(x, y, radius)) return false;
    const nextPenalty = this.dynamicOverlapPenalty(x, y, radius, self);
    if (nextPenalty <= .0001) return true;
    // If two agents are already too close, allow only steps that reduce the
    // overlap. This is what lets them peel away sideways instead of freezing.
    return nextPenalty < this.dynamicOverlapPenalty(fromX, fromY, radius, self) - .001;
  }

  private isNpcWalkable(villager: Villager, x: number, y: number) {
    if (villager.activityRegionId === RegionId.FIELDS) {
      if (this.regionTransitionManager?.currentRegionId !== RegionId.FIELDS || !this.inRegion(x, y, this.fieldRegion)) return false;
      const onFieldTrunkRoad = x >= 140 && x <= 3020 && Math.abs(y + 760) <= 42;
      const onFieldLane = [1100, 1700, 2300].some(roadX => Math.abs(x - roadX) <= 24)
        && y <= -805 && y >= -2110;
      const inWorkPlot = x >= 420 && x <= 2860 && y <= -845 && y >= -1205;
      return onFieldTrunkRoad || onFieldLane || inWorkPlot;
    }
    const onMainCityRoad = Math.abs(x) <= 48 && y >= -790 && y <= 930;
    const onSideCityRoad = (Math.abs(x - 600) <= 34 || Math.abs(x + 600) <= 34) && y >= -25 && y <= 1120;
    const onCityCrossStreet = [60, 440, 820].some(roadY => Math.abs(y - roadY) <= 38)
      && x >= -1270 && x <= 1270;
    const onFieldTrunkRoad = x >= -20 && x <= 3020 && Math.abs(y + 760) <= 42;
    const nearCart = this.horseCarts.some(cart => Math.abs(x - cart.root.position.x) <= 260
      && Math.abs(y - cart.root.position.y) <= 125);
    const alreadyOnShoulder = Math.abs(villager.root.position.y + 760) > 38
      && Math.abs(villager.root.position.y + 760) <= 112;
    const onFieldPassingShoulder = x >= -20 && x <= 3020 && Math.abs(y + 760) <= 112
      && (nearCart || alreadyOnShoulder);
    const onFieldLane = [1100, 1700, 2300].some(roadX => Math.abs(x - roadX) <= 24)
      && y <= -805 && y >= -2110;
    const inWorkPlot = villager.workIndices.length > 0
      && x >= 420 && x <= 2860 && y <= -845 && y >= -1205;
    return onMainCityRoad || onSideCityRoad || onCityCrossStreet || onFieldTrunkRoad
      || onFieldPassingShoulder || onFieldLane || inWorkPlot;
  }

  private isDynamicClear(x: number, y: number, radius: number, self: Node | null) {
    return this.dynamicOverlapPenalty(x, y, radius, self) <= .0001;
  }

  private dynamicOverlapPenalty(x: number, y: number, radius: number, self: Node | null) {
    let penalty = 0;
    const selfCart = this.horseCarts.find(cart => cart.root === self);
    const addCircle = (node: Node, otherRadius: number, padding = 20) => {
      if (!node.isValid || !node.activeInHierarchy || node === self) return;
      const required = radius + otherRadius + padding;
      const distance = Math.hypot(x - node.position.x, y - node.position.y);
      if (distance < required) penalty += (required - distance) / required;
    };
    const addCartRect = (centerX: number, centerY: number, otherX: number, otherY: number, otherRadius: number, padding = 8) => {
      const halfW = 92 + otherRadius + padding;
      const halfH = 31 + otherRadius + padding;
      const gapX = halfW - Math.abs(otherX - centerX);
      const gapY = halfH - Math.abs(otherY - centerY);
      if (gapX > 0 && gapY > 0) penalty += Math.min(gapX / halfW, gapY / halfH);
    };
    const addActorRect = (node: Node) => {
      if (!node.isValid || !node.activeInHierarchy || node === self) return;
      const halfW = 48;
      const halfH = 66;
      const gapX = halfW - Math.abs(x - node.position.x);
      const gapY = halfH - Math.abs(y - node.position.y);
      if (gapX > 0 && gapY > 0) penalty += Math.min(gapX / halfW, gapY / halfH);
    };
    const addPlayerRect = () => {
      const halfW = 48;
      const halfH = 66;
      const gapX = halfW - Math.abs(x - this.playerPos.x);
      const gapY = halfH - Math.abs(y - this.playerPos.y);
      if (gapX > 0 && gapY > 0) penalty += Math.min(gapX / halfW, gapY / halfH);
    };

    if (selfCart) {
      addCartRect(x, y, this.playerPos.x, this.playerPos.y, this.actorRadius, 16);
      this.villagers.forEach(villager => {
        if (villager.root !== self) addCartRect(x, y, villager.root.position.x, villager.root.position.y, villager.radius, 16);
      });
    } else {
      if (self) addPlayerRect();
      this.villagers.forEach(villager => addActorRect(villager.root));
      this.horseCarts.forEach(cart => {
        if (cart.root !== self) addCartRect(cart.root.position.x, cart.root.position.y, x, y, radius, 16);
      });
    }
    // Story speakers are stationary actors too. Keep a small personal space
    // so characters do not overlap, while still allowing the player inside
    // the 78px dialogue-trigger radius.
    [this.storyNpc, this.storyNpcTwo, this.storyNpcThree, this.storyNpcFour,
      this.storyNpcFive, this.storyNpcSix, this.storyNpcSeven, this.storyNpcEight, this.storyNpcNine]
      .forEach(npc => {
        if (npc?.activeInHierarchy) addCircle(npc, 24, 12);
      });
    if (this.restingVillager) addCircle(this.restingVillager.root, 25, 7);
    return penalty;
  }

  private dynamicAvoidance(self: Node, x: number, y: number, radius: number) {
    const result = new Vec2();
    const currentVillager = this.villagers.find(villager => villager.root === self);
    const currentIndex = this.villagers.findIndex(villager => villager.root === self);
    const laneSign = currentVillager?.avoidanceSign ?? 1;
    const repel = (node: Node, otherRadius: number, padding = 20) => {
      if (!node.isValid || node === self) return;
      const dx = x - node.position.x; const dy = y - node.position.y;
      const distance = Math.hypot(dx, dy);
      const range = radius + otherRadius + padding;
      if (distance >= range) return;
      const safeDistance = Math.max(distance, .01);
      const strength = 1 - distance / range;
      result.x += dx / safeDistance * strength;
      result.y += dy / safeDistance * strength;
    };
    if (self !== this.player) {
      const dx = x - this.playerPos.x; const dy = y - this.playerPos.y;
      const distance = Math.hypot(dx, dy); const range = radius + this.actorRadius + 30;
      if (distance < range) {
        const safeDistance = Math.max(distance, .01); const strength = 1 - distance / range;
        result.x += dx / safeDistance * strength;
        result.y += dy / safeDistance * strength;
      }
    }
    this.villagers.forEach((villager, otherIndex) => {
      repel(villager.root, villager.radius);
      if (villager.root === self) return;
      const dx = x - villager.root.position.x; const dy = y - villager.root.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= 72) return;
      const sideStrength = (1 - distance / 72) * 1.9;
      const pairSide = currentIndex <= otherIndex ? 1 : -1;
      if (Math.abs(dx) >= Math.abs(dy)) result.y += pairSide * sideStrength;
      else result.x += pairSide * sideStrength;
    });
    this.horseCarts.forEach(cart => {
      if (cart.root === self) return;
      const dx = x - cart.root.position.x; const dy = y - cart.root.position.y;
      const horizontalRange = 128 + radius;
      const verticalRange = 68 + radius;
      if (Math.abs(dx) >= horizontalRange || Math.abs(dy) >= verticalRange) return;
      const side = Math.abs(dy) > 4 ? Math.sign(dy) : laneSign;
      result.y += side * (1 - Math.abs(dy) / verticalRange) * 2.8;
      result.x += Math.sign(dx || laneSign) * .12;
    });
    if (this.restingVillager) repel(this.restingVillager.root, 25, 18);
    if (result.lengthSqr() > 1) result.normalize();
    return result;
  }

  private pointInWater(x: number, y: number, margin = 0) {
    if (this.waterCrossings.some(r => this.pointInRect(x, y, r, -margin * .2))) return false;
    if (this.pointInRiverbankNorthBridgeWater(x, y, margin)) return true;
    if (this.pointInRiverbankNorthShoreWater(x, y, margin)) return true;
    if (this.waterCircles.some(c => Math.hypot(x - c.x, y - c.y) < c.radius + margin)) return true;
    return this.waterSegments.some(s => this.pointToSegmentDistance(x, y, s.ax, s.ay, s.bx, s.by) < s.radius + margin);
  }

  private pointInRiverbankNorthBridgeWater(x: number, y: number, margin = 0) {
    const samples = this.riverbankNorthBridgeWaterPoints;
    const first = samples[0];
    const last = samples[samples.length - 1];
    if (x < first[0] - margin || x > last[0] + margin) return false;

    const sampleX = this.clamp(x, first[0], last[0]);
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      if (sampleX < a[0] || sampleX > b[0]) continue;
      const t = (sampleX - a[0]) / (b[0] - a[0]);
      const centerY = a[1] + (b[1] - a[1]) * t;
      const halfWidth = a[2] + (b[2] - a[2]) * t;
      return y > centerY - halfWidth - margin && y < centerY + halfWidth + margin;
    }
    return false;
  }

  private pointInRiverbankNorthShoreWater(x: number, y: number, margin = 0) {
    const points = this.riverbankNorthShorePoints;
    const waterDepth = 120;
    const joinOverlap = 8;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length = Math.hypot(dx, dy);
      const tangentX = dx / length;
      const tangentY = dy / length;
      // Points run east and then south. Their right-hand normal faces water.
      const inwardX = tangentY;
      const inwardY = -tangentX;
      const relativeX = x - a[0];
      const relativeY = y - a[1];
      const along = relativeX * tangentX + relativeY * tangentY;
      const inward = relativeX * inwardX + relativeY * inwardY;
      if (along >= -joinOverlap && along <= length + joinOverlap
        && inward > -margin && inward < waterDepth + margin) return true;
    }
    return false;
  }

  private pointInAnyObstacle(x: number, y: number) {
    return this.obstacles.some(r => x > r.x - r.w / 2 - 30 && x < r.x + r.w / 2 + 30 && y > r.y - r.h / 2 - 30 && y < r.y + r.h / 2 + 30);
  }

  private withObstacleRegion<T>(regionId: string, author: () => T): T {
    const previousRegionId = this.currentObstacleRegionId;
    this.currentObstacleRegionId = regionId;
    try {
      return author();
    } finally {
      this.currentObstacleRegionId = previousRegionId;
    }
  }

  private addObstacle(x: number, y: number, w: number, h: number, name: string, regionId?: string) {
    // The two trunk-road fence strips are authored by drawFields().  Keep that
    // ownership explicit even if a legacy caller invokes the helper outside
    // the synchronous FIELDS authoring scope.
    const isFieldTrunkFence = w === 170 && h === 18 && (y === -701 || y === -872)
      && x >= 310 && x <= 2870;
    const resolvedRegionId = regionId ?? (isFieldTrunkFence ? RegionId.FIELDS : this.currentObstacleRegionId);
    const source = isFieldTrunkFence
      ? `drawFields(): ${y === -701 ? 'FieldRoadFenceNorthCollision' : 'FieldRoadFenceSouthCollision'}`
      : undefined;
    this.obstacles.push({ x, y, w, h, name, regionId: resolvedRegionId, source });
  }

  private createWeatherOverlay() {
    const visible = view.getVisibleSize();
    const particleNode = new Node('DynamicWeatherParticles');
    // Particle simulation is entirely map-space. This small viewport renderer
    // only projects the currently visible map chunk, avoiding a map-sized
    // dynamic Graphics mesh while preserving world-anchored impacts.
    particleNode.parent = this.node;
    particleNode.setPosition(0, 0, 180);
    particleNode.addComponent(UITransform).setContentSize(visible.width + 220, visible.height + 220);
    this.weatherParticleNode = particleNode;
    this.weatherParticles = particleNode.addComponent(Graphics);
  }

  private pickRandomWeather() {
    const roll = Math.random();
    if (roll < .46) return '晴' as WeatherKind;
    if (roll < .68) return '小雨' as WeatherKind;
    if (roll < .86) return '雨天' as WeatherKind;
    return '中雨' as WeatherKind;
  }

  private setWeather(next: WeatherKind, initial = false) {
    this.weather = next;
    this.audioManager.setRainWeather(
      next === '小雨' ? 'light' : next === '雨天' ? 'normal' : next === '中雨' ? 'medium' : null,
    );
    this.weatherChangeTimer = initial ? 42 + Math.random() * 42 : 55 + Math.random() * 65;
    this.precipitation = [];
    this.rainSplashes = [];
    const count = next === '小雨' ? 72 : next === '雨天' ? 126 : next === '中雨' ? 196 : 0;
    const visible = view.getVisibleSize();
    for (let i = 0; i < count; i++) {
      const particle = this.makeWeatherParticle(visible, true);
      particle.phase = i * .618;
      this.precipitation.push(particle);
    }
    if (this.weatherLabel?.isValid) this.updateWeatherHud();
    if (this.weatherIcon?.isValid) this.drawWeatherIcon();
  }

  private makeWeatherParticle(visible: { width: number; height: number }, fillScreen = false): WeatherParticle {
    const centerX = -this.world.position.x;
    const centerY = -this.world.position.y;
    const x = centerX - visible.width / 2 - 40 + Math.random() * (visible.width + 80);
    const y = fillScreen
      ? centerY - visible.height / 2 + Math.random() * visible.height
      : centerY + visible.height / 2 + 20 + Math.random() * 80;
    return { x, y, vx: -(72 + Math.random() * 42), vy: -(430 + Math.random() * 250), size: .8 + Math.random() * .9, life: .28 + Math.random() * .72, phase: Math.random() * Math.PI * 2 };
  }

  private updateWeather(dt: number) {
    this.weatherChangeTimer -= dt;
    if (this.weatherChangeTimer <= 0) {
      let next = this.pickRandomWeather();
      if (next === this.weather) next = next === '晴' ? '小雨' : '晴';
      this.setWeather(next);
    }

    const raining = this.weather === '小雨' || this.weather === '雨天' || this.weather === '中雨';

    const visible = view.getVisibleSize();
    const centerX = -this.world.position.x;
    const centerY = -this.world.position.y;
    const outsideView = (particle: WeatherParticle) => particle.x < centerX - visible.width / 2 - 90 || particle.x > centerX + visible.width / 2 + 90 || particle.y < centerY - visible.height / 2 - 90 || particle.y > centerY + visible.height / 2 + 110;
    for (const particle of this.precipitation) {
      if (raining) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
        if (particle.life <= 0) {
          this.rainSplashes.push({ x: particle.x, y: particle.y, life: .22, maxLife: .22 });
          Object.assign(particle, this.makeWeatherParticle(visible));
        } else if (outsideView(particle)) {
          Object.assign(particle, this.makeWeatherParticle(visible));
        }
      }
    }
    for (let i = this.rainSplashes.length - 1; i >= 0; i--) {
      this.rainSplashes[i].life -= dt;
      if (this.rainSplashes[i].life <= 0) this.rainSplashes.splice(i, 1);
    }
    if (this.rainSplashes.length > 90) this.rainSplashes.splice(0, this.rainSplashes.length - 90);
    // Rebuild the vector mesh at 30 fps. Re-clearing a Cocos Graphics mesh on
    // every simulation tick can discard it before the UI renderer submits it.
    this.weatherRenderTimer += dt;
    if (this.weatherRenderTimer >= 1 / 30) {
      this.weatherRenderTimer %= 1 / 30;
      this.drawWeatherParticles(raining);
    }
    this.updateWeatherHud();
  }

  private drawWeatherParticles(raining: boolean) {
    if (!this.weatherParticles?.isValid) return;
    const graphics = this.weatherParticles;
    graphics.clear();
    if (this.worldMode === 'templeInterior') return;
    const cameraOffsetX = this.world.position.x;
    const cameraOffsetY = this.world.position.y;
    if (raining) {
      graphics.strokeColor = this.weather === '中雨' ? new Color(102, 164, 198, 255) : new Color(124, 181, 207, 238);
      graphics.lineWidth = this.weather === '中雨' ? 2.2 : 1.65;
      graphics.fillColor = this.weather === '中雨' ? new Color(164, 211, 229, 255) : new Color(176, 218, 233, 240);
      for (const drop of this.precipitation) {
        const length = this.weather === '小雨' ? 7 : this.weather === '雨天' ? 10 : 13;
        const screenX = drop.x + cameraOffsetX; const screenY = drop.y + cameraOffsetY;
        graphics.moveTo(screenX, screenY);
        graphics.lineTo(screenX + length * .22, screenY + length);
        // The bright 1–2 px head is the visible raindrop; the short stroke is
        // only its diagonal motion trail, matching a fine pixel-rain read.
        graphics.rect(Math.round(screenX) - 1, Math.round(screenY) - 1, this.weather === '中雨' ? 3.2 : 2.4, this.weather === '小雨' ? 2.2 : 3);
      }
      graphics.stroke();
      graphics.fill();
      for (const splash of this.rainSplashes) {
        const progress = 1 - splash.life / splash.maxLife;
        const radius = 1 + progress * 6;
        const screenX = splash.x + cameraOffsetX; const screenY = splash.y + cameraOffsetY;
        graphics.strokeColor = new Color(117, 181, 208, Math.round((1 - progress) * 245));
        graphics.lineWidth = 1.35;
        graphics.ellipse(screenX, screenY, radius, radius * .28);
        graphics.moveTo(screenX - radius * .55, screenY); graphics.lineTo(screenX - radius, screenY + 2 + progress * 2);
        graphics.moveTo(screenX + radius * .55, screenY); graphics.lineTo(screenX + radius, screenY + 2 + progress * 2);
        graphics.stroke();
      }
    }
  }

  private updateWeatherHud() {
    if (!this.weatherLabel?.isValid) return;
    this.weatherLabel.string = this.weather;
    this.weatherTimerLabel.string = `约 ${Math.max(1, Math.ceil(this.weatherChangeTimer))} 秒后变化`;
  }

  private drawWeatherIcon() {
    const graphics = this.weatherIcon;
    graphics.clear();
    if (this.weather === '晴') {
      graphics.fillColor = new Color(248, 194, 78); graphics.circle(0, 0, 10); graphics.fill();
      graphics.strokeColor = new Color(255, 224, 126); graphics.lineWidth = 3;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; graphics.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); graphics.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); }
      graphics.stroke();
      return;
    }
    graphics.fillColor = new Color(190, 205, 211); graphics.circle(-6, 2, 8); graphics.circle(3, 6, 10); graphics.circle(12, 1, 7); graphics.roundRect(-14, -4, 31, 10, 5); graphics.fill();
    graphics.strokeColor = new Color(111, 180, 215); graphics.lineWidth = 2;
    [-8, 2, 12].forEach((x, index) => { const y = -9 - index % 2 * 5; graphics.moveTo(x + 2, y + 5); graphics.lineTo(x - 2, y - 4); });
    graphics.stroke();
  }

  private async loadCitySave(): Promise<CitySave> {
    const databaseSave = await this.localSaveDatabase.get<Partial<CitySave>>(this.saveKey);
    if (databaseSave) {
      return this.normalizeCitySave(databaseSave);
    }

    const legacySave = this.loadLegacyCitySave();
    void this.localSaveDatabase.put(this.saveKey, legacySave);
    return legacySave;
  }

  private createDefaultCitySave(): CitySave {
    return {
      version: 3,
      ink: 8,
      coins: 0,
      experience: 0,
      // The teaching card remains the starter set. Field finds stay dark until excavated.
      unlockedOracleIds: ['sun'],
      excavatedStoryIds: [],
      excavatedCardIds: [],
      mastery: {},
      wrongBook: {},
      ownedProductIds: ['shell-clay'],
      equippedShellId: 'shell-clay',
      playerName: '少年卜官',
      // Entering the world prompts a first-time player to choose a protagonist.
      avatarId: 'unselected',
      characterChoiceCompleted: false,
      musicOn: true,
      sfxOn: true,
      nightMode: false,
      story: migrateStorySave(null),
    };
  }

  /** One-time mapping for saves created before RegionId/StoryLocationId existed. */
  private storyLocationForLegacySave(chapterId: string | null | undefined) {
    const chapterLocations: Record<string, string> = {
      [CHAPTER_ONE_ID]: 'chapter-1-city-entry',
      [CHAPTER_TWO_ID]: 'chapter-2-riverbank-entry',
      [CHAPTER_THREE_ID]: 'chapter-3-royal-tomb-entry',
      [CHAPTER_FOUR_ID]: 'chapter-4-highland-entry',
      [CHAPTER_FIVE_ID]: 'chapter-5-fields-entry',
      [CHAPTER_SIX_ID]: 'chapter-6-royal-tomb-entry',
      [CHAPTER_SEVEN_ID]: 'chapter-7-highland-entry',
      [CHAPTER_EIGHT_ID]: 'chapter-8-royal-tomb-entry',
      [CHAPTER_NINE_ID]: 'chapter-9-city-entry',
    };
    return storyLocation(chapterId ? chapterLocations[chapterId] : 'new-game-city-entry');
  }

  private normalizeCitySave(value: Partial<CitySave> | null | undefined): CitySave {
    const defaults = this.createDefaultCitySave();
    const source = value && typeof value === 'object' ? value : {};
    const nonNegativeInteger = (input: unknown, fallback: number) => {
      const parsed = Number(input);
      return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
    };
    const uniqueStrings = (input: unknown) => Array.isArray(input)
      ? Array.from(new Set(input.filter((item): item is string => typeof item === 'string' && item.length > 0)))
      : [];

    const mastery: Record<string, LearningRecord> = {};
    if (source.mastery && typeof source.mastery === 'object' && !Array.isArray(source.mastery)) {
      Object.entries(source.mastery).forEach(([cardId, record]) => {
        if (!record || typeof record !== 'object' || Array.isArray(record)) return;
        const attempts = nonNegativeInteger((record as Partial<LearningRecord>).attempts, 0);
        const correctCount = Math.min(attempts, nonNegativeInteger((record as Partial<LearningRecord>).correctCount, 0));
        mastery[cardId] = {
          attempts,
          correctCount,
          bestStars: Math.min(3, nonNegativeInteger((record as Partial<LearningRecord>).bestStars, 0)),
        };
      });
    }

    const wrongBook: Record<string, WrongBookEntry> = {};
    if (source.wrongBook && typeof source.wrongBook === 'object' && !Array.isArray(source.wrongBook)) {
      Object.entries(source.wrongBook).forEach(([cardId, record]) => {
        if (!record || typeof record !== 'object' || Array.isArray(record)) return;
        wrongBook[cardId] = {
          wrongCount: nonNegativeInteger((record as Partial<WrongBookEntry>).wrongCount, 0),
          lastWrongAt: nonNegativeInteger((record as Partial<WrongBookEntry>).lastWrongAt, 0),
        };
      });
    }

    const ownedProductIds = Array.from(new Set(['shell-clay', ...uniqueStrings(source.ownedProductIds)]));
    const unlockedOracleIds = uniqueStrings(source.unlockedOracleIds);
    const requestedShell = typeof source.equippedShellId === 'string' ? source.equippedShellId : defaults.equippedShellId;
    const equippedShellId = ownedProductIds.includes(requestedShell) ? requestedShell : defaults.equippedShellId;
    const playerName = typeof source.playerName === 'string' && source.playerName.trim().length > 0
      ? source.playerName.trim()
      : defaults.playerName;

    const migratedStory = migrateStorySave(source.story);
    const configuredLocation = storyLocation(typeof source.storyLocationId === 'string' ? source.storyLocationId : undefined)
      ?? this.storyLocationForLegacySave(migratedStory.currentChapterId);
    const sourceHasValidRegion = Object.values(RegionId).includes(source.currentRegionId as RegionId);
    const validRegionId = sourceHasValidRegion
      ? source.currentRegionId as RegionId
      : configuredLocation?.regionId;
    const rawPosition = source.playerWorldPosition;
    const hasPersistedPosition = !!rawPosition && Number.isFinite(rawPosition.x) && Number.isFinite(rawPosition.y)
      && sourceHasValidRegion;
    const migratedPosition = hasPersistedPosition
      ? { x: rawPosition!.x, y: rawPosition!.y }
      : configuredLocation
        ? { x: configuredLocation.localPosition.x, y: configuredLocation.localPosition.y }
        : undefined;

    return {
      version: 3,
      ink: nonNegativeInteger(source.ink, defaults.ink),
      coins: nonNegativeInteger(source.coins, defaults.coins),
      experience: nonNegativeInteger(source.experience, defaults.experience),
      unlockedOracleIds: unlockedOracleIds.length > 0
        ? unlockedOracleIds
        : [...defaults.unlockedOracleIds],
      excavatedStoryIds: uniqueStrings(source.excavatedStoryIds),
      excavatedCardIds: uniqueStrings(source.excavatedCardIds),
      mastery,
      wrongBook,
      ownedProductIds,
      equippedShellId,
      playerName,
      avatarId: typeof source.avatarId === 'string' && source.avatarId.length > 0 ? source.avatarId : defaults.avatarId,
      avatarUrl: typeof source.avatarUrl === 'string' && source.avatarUrl.length > 0 ? source.avatarUrl : undefined,
      characterChoiceCompleted: typeof source.characterChoiceCompleted === 'boolean' ? source.characterChoiceCompleted : false,
      musicOn: typeof source.musicOn === 'boolean' ? source.musicOn : defaults.musicOn,
      sfxOn: typeof source.sfxOn === 'boolean' ? source.sfxOn : defaults.sfxOn,
      nightMode: typeof source.nightMode === 'boolean' ? source.nightMode : defaults.nightMode,
      story: migratedStory,
      currentRegionId: validRegionId,
      storyLocationId: configuredLocation?.id,
      playerWorldPosition: migratedPosition,
      playerFacing: source.playerFacing === 'up' || source.playerFacing === 'down' || source.playerFacing === 'left' || source.playerFacing === 'right'
        ? source.playerFacing
        : configuredLocation?.facingDirection,
    };
  }

  private loadLegacyCitySave(): CitySave {
    const defaults = this.createDefaultCitySave();
    try {
      const raw = sys.localStorage.getItem(this.saveKey);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<CitySave>;
      return this.normalizeCitySave(parsed);
    } catch (error) {
      console.warn('[YinXuCity] save data could not be read, using a safe new profile.', error);
      return defaults;
    }
  }

  private persistCitySave() {
    if (!this.save) return;
    if (this.regionTransitionManager) {
      this.save.currentRegionId = this.regionTransitionManager.currentRegionId;
      this.save.playerWorldPosition = { x: this.playerPos.x, y: this.playerPos.y };
      this.save.playerFacing = this.facing;
    }
    this.saveCheckpointElapsed = 0;
    void this.localSaveDatabase.put(this.saveKey, this.save);
    try {
      sys.localStorage.setItem(this.saveKey, JSON.stringify(this.save));
    } catch (error) {
      console.warn('[YinXuCity] save data could not be written.', error);
    }
  }

  /** Periodically checkpoints walking progress, which previously only saved on transitions. */
  private checkpointPlayerPosition(dt: number, moving: boolean) {
    if (!moving || !this.save) return;
    this.saveCheckpointElapsed += dt;
    if (this.saveCheckpointElapsed >= this.saveCheckpointInterval) this.persistCitySave();
  }

  /** Kept synchronous at the storage boundary for safe Android lifecycle handling. */
  private flushCitySave() {
    if (this.save) this.persistCitySave();
  }

  private drawDivinationSeat() {
    const seat = this.localGraphics('DivinationSeatInteractive', this.world, 0, 828, 150, 105, 28);
    seat.fillColor = new Color(75, 52, 36, 115); seat.ellipse(0, -28, 60, 16); seat.fill();
    seat.fillColor = new Color(180, 119, 56); seat.roundRect(-52, -31, 104, 55, 8); seat.fill();
    seat.strokeColor = new Color(89, 53, 34); seat.lineWidth = 5; seat.roundRect(-52, -31, 104, 55, 8); seat.stroke();
    seat.strokeColor = new Color(231, 190, 101, 180); seat.lineWidth = 2;
    for (let x = -40; x <= 40; x += 20) { seat.moveTo(x, -24); seat.lineTo(x + 7, 15); }
    seat.stroke();
    const shell = this.localGraphics('DivinationSeatShell', this.world, 0, 856, 80, 58, 30);
    shell.fillColor = new Color(220, 188, 120); shell.ellipse(0, 0, 30, 21); shell.fill();
    shell.strokeColor = new Color(91, 57, 36); shell.lineWidth = 3; shell.ellipse(0, 0, 30, 21); shell.stroke();
    shell.moveTo(-6, 15); shell.lineTo(2, 4); shell.lineTo(-5, -8); shell.lineTo(7, -17); shell.stroke();
    this.worldLabel('占卜席', 0, 770, 15, new Color(99, 58, 37));
  }

  private createUiLabel(parent: Node, name: string, text: string, x: number, y: number, width: number, height: number, fontSize: number, color: Color, align: 'left' | 'center' = 'center', z = 2) {
    const node = new Node(name);
    node.parent = parent;
    node.setPosition(x, y, z);
    node.addComponent(UITransform).setContentSize(width, height);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 7;
    label.color = color;
    label.enableWrapText = true;
    label.overflow = Label.Overflow.SHRINK;
    label.horizontalAlign = align === 'left' ? Label.HorizontalAlign.LEFT : Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    return label;
  }

  private drawWoodPanel(parent: Node, name: string, x: number, y: number, width: number, height: number, z = 0, parchment = false) {
    const panel = this.localGraphics(name, parent, x, y, width, height, z);
    panel.fillColor = parchment ? new Color(223, 184, 113, 248) : new Color(103, 62, 38, 248);
    panel.roundRect(-width / 2, -height / 2, width, height, 14); panel.fill();
    panel.strokeColor = parchment ? new Color(91, 51, 31) : new Color(221, 167, 80);
    panel.lineWidth = 6; panel.roundRect(-width / 2 + 3, -height / 2 + 3, width - 6, height - 6, 12); panel.stroke();
    panel.strokeColor = parchment ? new Color(162, 106, 57) : new Color(64, 40, 29);
    panel.lineWidth = 2; panel.roundRect(-width / 2 + 11, -height / 2 + 11, width - 22, height - 22, 8); panel.stroke();
    return panel;
  }

  private drawUiButton(parent: Node, name: string, text: string, x: number, y: number, width: number, height: number, accent = false) {
    const graphics = this.localGraphics(name, parent, x, y, width, height, 4);
    graphics.fillColor = accent ? new Color(157, 64, 47, 245) : new Color(83, 62, 46, 245);
    graphics.roundRect(-width / 2, -height / 2, width, height, 10); graphics.fill();
    graphics.strokeColor = new Color(231, 187, 97); graphics.lineWidth = 3; graphics.roundRect(-width / 2, -height / 2, width, height, 10); graphics.stroke();
    return this.createUiLabel(parent, `${name}Label`, text, x, y, width - 12, height - 8, 19, new Color(255, 238, 197), 'center', 6);
  }

  private qualityColor(quality: OracleQuality) {
    if (quality === 'red') return new Color(202, 74, 61);
    if (quality === 'gold') return new Color(236, 184, 73);
    return new Color(75, 161, 205);
  }

  private updateCityGameplay(dt: number) {
    if (this.currencyLabel?.isValid) {
      this.currencyLabel.string = `墨料 ${this.save.ink}   ·   贝币 ${this.save.coins}   ·   卜官经验 ${this.save.experience}`;
    }
    if (this.supplicant?.isValid) this.updateSupplicant(dt);
    if (this.overlay !== 'divination') return;

    if (this.divinationStage === 'waiting' && !this.supplicant) {
      this.queueTimer -= dt;
      if (this.queueTimer <= 0) {
        if (this.save.ink < this.divinationInkCost) {
          if (this.divinationText?.isValid) {
            this.divinationText.string = `墨料不足。每次占卜需要 ${this.divinationInkCost} 点墨料，请起身后前往城外收集。`;
          }
          this.updateRiseButtonState();
        } else {
          this.spawnNextSupplicant();
        }
      }
    }

    if (this.divinationStage === 'question' && this.currentAttempts >= 2 && this.correctCardIndex >= 0) {
      const node = this.oracleCardNodes[this.correctCardIndex];
      if (node?.isValid && this.draggingCardIndex !== this.correctCardIndex) {
        const pulse = 1 + Math.sin(this.elapsed * 6.5) * .045;
        node.setScale(pulse, pulse, 1);
      }
    }

    if (this.divinationStage === 'animating') {
      this.divinationAnimationTimer += dt;
      const fusionProgress = this.clamp((this.divinationAnimationTimer - .12) / .82, 0, 1);
      if (this.divinationActiveCardNode?.isValid) {
        const opacity = this.divinationActiveCardNode.getComponent(UIOpacity);
        if (opacity) opacity.opacity = Math.round(255 * (1 - fusionProgress));
        const scale = .72 - fusionProgress * .18;
        this.divinationActiveCardNode.setScale(scale, scale, 1);
        if (fusionProgress >= 1) this.divinationActiveCardNode.active = false;
      }
      if (this.divinationFusedGlyph?.isValid) {
        const opacity = this.divinationFusedGlyph.getComponent(UIOpacity);
        if (opacity) opacity.opacity = Math.round(220 * this.easeOutCubic(fusionProgress));
        const settle = 1.28 - this.easeOutCubic(fusionProgress) * .5;
        this.divinationFusedGlyph.setScale(settle, settle, 1);
        this.divinationFusedGlyph.setPosition(0, 18 - fusionProgress * 6, 8);
        this.divinationFusedGlyph.setRotationFromEuler(0, 0, -7 * (1 - fusionProgress));
      }
      if (this.divinationShellNode?.isValid) {
        const heat = this.clamp((this.divinationAnimationTimer - 1.05) / .7, 0, 1);
        const pulse = 1 + Math.sin(this.divinationAnimationTimer * 13) * .018 * heat;
        this.divinationShellNode.setScale(pulse, pulse, 1);
      }
      if (this.divinationCracks?.isValid) this.drawAnimatedDivinationCracks(this.divinationAnimationTimer);
      if (this.divinationAnimationTimer >= 4.05) this.showDivinationReview();
    }
  }

  private beginDivination() {
    if (this.worldMode !== 'templeInterior' || !this.templeInterior?.isValid) return;
    const chapterId = this.storyController?.currentStep()?.chapterId;
    if (chapterId) {
      const main = this.chapterMainProgress(chapterId);
      // 剧情已进入占卜链（fragment-awakens 之后 → first-request → 进殿 → 落座 → 连续占卜），
      // 必须集齐本章全部甲骨字才能坐下占卜。
      if (this.currentStepRequiresFullCollection() && main.total > 0 && main.learned < main.total) {
        const missing = main.total - main.learned;
        this.showStatusNotice(`本章甲骨尚未集齐。请先循金色箭头继续挖掘，收集并学会剩余 ${missing} 枚甲骨后再回宗庙占卜。`, 5);
        return;
      }
      // 自由占卜（非剧情占卜链）的兜底：至少收集 3 个本章甲骨字，避免用旧章字跨章占卜。
      const guided = this.chapterGuidedProgress(chapterId);
      const required = Math.min(3, guided.total);
      if (required > 0 && guided.collected < required) {
        this.showStatusNotice(`本章尚未收集足够甲骨字。请先循金色箭头挖掘本章至少 ${required} 个甲骨字（当前 ${guided.collected}/${required}）。`, 4.5);
        return;
      }
    }
    this.templePreSitPosition = this.playerPos.clone();
    this.templePreSitFacing = this.facing;
    this.templePreSitWorldMode = this.worldMode;
    this.templeLastRisePosition = null;
    this.stopPlayerInput();
    this.overlay = 'divination';
    this.seated = true;
    this.playerPos.set(this.templeSeatPoint.x, this.templeSeatPoint.y);
    this.player.setPosition(this.templeSeatPoint.x, this.templeSeatPoint.y, 80);
    this.facing = 'down';
    this.displayedPlayerFrame = -1;
    this.showPlayerFrame(0);
    this.updateTempleSeatDepthOrdering();
    this.currentQuestion = null;
    this.storyDivinationRounds = 0;
    this.storyDivinationAnswerIds = [];
    this.currentAttempts = 0;
    this.divinationStage = 'waiting';
    this.queueTimer = .8;
    this.buildDivinationFrame();
    // 若当前步骤仍是“进宗庙内殿”（completeOn==='temple-entered'），说明玩家已身处殿内、
    // 未经外部祭台“进入”这一步；坐下即代表已入殿，先补登记 temple-entered，再登记落座，
    // 否则 enter-temple 步骤会永远卡住、章节无法推进。
    if (this.storyController?.currentStep()?.completeOn === 'temple-entered') {
      this.storyController.handle({ type: 'temple-entered' });
    }
    this.storyController?.handle({ type: 'temple-seat-reached' });
    if (this.save.ink < this.divinationInkCost && this.divinationText?.isValid) {
      this.divinationText.string = `墨料不足。每次占卜需要 ${this.divinationInkCost} 点墨料，请先去城外探索。`;
    }
  }

  private buildDivinationFrame() {
    this.destroyOverlayRoot();
    const root = new Node('DivinationOverlay');
    root.parent = this.node;
    root.setPosition(0, 0, 400);
    root.addComponent(UITransform).setContentSize(1280, 720);
    this.overlayRoot = root;

    const topStrip = this.drawWoodPanel(root, 'DivinationTopStrip', 0, 322, 580, 58, 0);
    topStrip.fillColor = new Color(77, 48, 34, 245);
    this.createUiLabel(root, 'DivinationTitle', '占卜宗庙 · 内殿问卜', 0, 322, 520, 42, 22, new Color(255, 222, 145));
    this.drawUiButton(root, 'RiseButton', '起身离开', 510, 300, 150, 58, false);
    this.riseButtonLabel = root.getChildByName('RiseButtonLabel')?.getComponent(Label) ?? null;

    this.drawWoodPanel(root, 'DivinationDialoguePanel', 0, -222, 1160, 236, 0, true);
    this.divinationText = this.createUiLabel(
      root,
      'DivinationDialogueText',
      this.save.ink >= this.divinationInkCost ? '请稍候，一位村民正在前来求卜……' : `墨料不足，无法接待村民。`,
      -190,
      -215,
      710,
      142,
      24,
      new Color(75, 43, 29),
      'left',
      4,
    );
    this.divinationName = this.createUiLabel(root, 'DivinationVillagerName', '宗庙执事', 430, -310, 190, 42, 19, new Color(255, 227, 168), 'center', 7);
    this.drawPortraitFrame(root, 'farmer');
    this.updateRiseButtonState();
  }

  private drawPortraitFrame(root: Node, kind: 'farmer' | 'woman') {
    root.getChildByName('DivinationPortraitFrame')?.destroy();
    root.getChildByName('DivinationPortraitSprite')?.destroy();
    this.drawWoodPanel(root, 'DivinationPortraitFrame', 430, -205, 188, 164, 3, false);
    const portrait = new Node('DivinationPortraitSprite');
    portrait.parent = root;
    portrait.setPosition(430, -196, 5);
    portrait.addComponent(UITransform).setContentSize(130, 130);
    const sprite = portrait.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const asset = kind === 'woman' ? 'villager-woman-v2' : 'villager-farmer-v2';
    this.requestSpriteFrame(`characters/${asset}/down-0/spriteFrame`, frame => {
      if (sprite.isValid) sprite.spriteFrame = frame;
    });
  }

  private updateRiseButtonState() {
    if (!this.riseButtonLabel?.isValid) return;
    const ceremonyInProgress = this.isActiveDivinationStep()
      && this.storyDivinationRounds > 0 && this.storyDivinationRounds < 3;
    const canRise = this.divinationStage === 'waiting' && !ceremonyInProgress;
    this.riseButtonLabel.string = canRise ? '起身离开' : '本轮进行中';
    this.riseButtonLabel.color = canRise ? new Color(255, 238, 197) : new Color(191, 173, 143);
  }

  // 判断当前步骤是否为「占卜步骤」（completeOn === 'divination-completed'）。
  // 章无关：第一/二/三……章任意章节的占卜轮都靠它判断是否仍在连续占卜中，
  // 从而支持多轮占卜（中间轮保持 overlay 自动续接，末轮才逼起身）。
  private isActiveDivinationStep(): boolean {
    const step = this.storyController?.currentStep();
    return step?.completeOn === 'divination-completed';
  }

  /**
   * 判断当前剧情步骤是否已经进入「必须集齐本章全部字才能进行」的占卜链。
   * 包括：fragment-awakens 之后、first-request、进殿、落座、连续占卜轮、起身确认。
   * 在这些步骤中若玩家还没集齐本章全部主线字，应禁止其坐下占卜或进入宗庙。
   */
  private currentStepRequiresFullCollection(): boolean {
    const step = this.storyController?.currentStep();
    if (!step) return false;
    if (step.id.endsWith('fragment-awakens')) return true;
    if (step.id.endsWith('first-request')) return true;
    if (step.completeOn === 'temple-entered') return true;
    if (step.completeOn === 'temple-seat-reached') return true;
    if (step.completeOn === 'divination-completed') return true;
    if (step.completeOn === 'result-confirmed') return true;
    return false;
  }

  private spawnNextSupplicant() {
    const unlockedCount = this.save.unlockedOracleIds.filter(id => this.oracleCards.some(card => card.id === id && (this.hasRealOracleGlyph(card) || Boolean(card.modern)))).length;
    if (unlockedCount < 3) {
      if (this.divinationText?.isValid) this.divinationText.string = '请先收集至少三枚甲骨文字，再开始三选一占卜。';
      return;
    }
    const available = this.divinationQuestions.filter(question => this.save.unlockedOracleIds.includes(question.answerId));
    if (available.length === 0) {
      if (this.divinationText?.isValid) this.divinationText.string = '背包中还没有能够回应村民问题的甲骨，请先去野外学习。';
      return;
    }
    const storyStep = this.storyController?.currentStep();
    const currentStepId = storyStep?.id;
    const chapterCardIds = storyStep ? STORY_CHAPTER_FRAGMENT_CARDS[storyStep.chapterId] ?? [] : [];
    // In a three-round story ceremony, avoid serving the same oracle card in
    // consecutive rounds when the player owns enough different cards.
    const unusedAvailable = this.isActiveDivinationStep()
      ? available.filter(question => !this.storyDivinationAnswerIds.includes(question.answerId))
      : available;
    const questionPool = unusedAvailable.length > 0 ? unusedAvailable : available;
    const scriptedQuestion = currentStepId ? CHAPTER_SIX_DIVINATION_QUESTIONS[currentStepId] : null;
    const storyQuestion = this.storyDivinationRounds === 0 && currentStepId === 'chapter-1-first-divination'
      ? questionPool.find(question => question.answerId === 'rain' && question.villager === '阿禾')
      : (this.storyDivinationRounds === 0 && scriptedQuestion && questionPool.some(question => question.answerId === scriptedQuestion.answerId)
        ? scriptedQuestion
        : (this.isActiveDivinationStep()
          ? questionPool.find(question => chapterCardIds.some(fragment => fragment.cardId === question.answerId))
          : null));
    let next = Math.floor(Math.random() * questionPool.length);
    if (questionPool.length > 1 && questionPool[next] === this.currentQuestion) next = (next + 1) % questionPool.length;
    this.currentQuestion = storyQuestion ?? questionPool[next];
    this.currentQuestionIndex = this.divinationQuestions.findIndex(question => question.answerId === this.currentQuestion?.answerId);
    this.createSupplicant(this.currentQuestion);
    if (this.divinationText?.isValid) this.divinationText.string = `${this.currentQuestion.villager}正向占卜席走来……`;
    if (this.divinationName?.isValid) this.divinationName.string = this.currentQuestion.villager;
    if (this.overlayRoot) this.drawPortraitFrame(this.overlayRoot, this.currentQuestion.portrait);
  }

  private createSupplicant(question: DivinationQuestion) {
    this.supplicant?.destroy();
    const root = new Node(`求卜村民-${question.villager}`);
    root.parent = this.templeInterior ?? this.world;
    root.setPosition(0, -272, 79);
    root.addComponent(UITransform).setContentSize(48, 64);
    const visual = new Node('求卜村民逐帧动画');
    visual.parent = root;
    visual.setPosition(0, 31, 4);
    visual.addComponent(UITransform).setContentSize(64, 64);
    const sprite = visual.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.supplicant = root;
    this.supplicantVisual = visual;
    this.supplicantSprite = sprite;
    this.supplicantFrames = { down: [null, null, null, null], left: [null, null, null, null], right: [null, null, null, null], up: [null, null, null, null] };
    this.supplicantFacing = 'right';
    this.supplicantWalkPhase = 0;
    this.supplicantDisplayedFrame = -1;
    this.supplicantLeaving = false;
    const asset = question.portrait === 'woman' ? 'villager-woman-v2' : 'villager-farmer-v2';
    (['down', 'left', 'right', 'up'] as Facing[]).forEach(direction => {
      for (let frameIndex = 0; frameIndex < 4; frameIndex++) {
        this.requestSpriteFrame(`characters/${asset}/${direction}-${frameIndex}/spriteFrame`, frame => {
          this.supplicantFrames[direction][frameIndex] = frame;
          if (direction === 'right' && frameIndex === 0 && sprite.isValid && !sprite.spriteFrame) sprite.spriteFrame = frame;
        });
      }
    });
  }

  private updateSupplicant(dt: number) {
    const root = this.supplicant;
    if (!root?.isValid) {
      this.supplicant = null;
      return;
    }
    const targetX = this.supplicantLeaving ? 0 : this.supplicantTarget.x;
    const targetY = this.supplicantLeaving ? -282 : this.supplicantTarget.y;
    const dx = targetX - root.position.x; const dy = targetY - root.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 4) {
      root.setPosition(targetX, targetY, 79);
      this.animateSupplicant(0, this.supplicantLeaving ? 'down' : 'left');
      if (this.supplicantLeaving) {
        root.destroy();
        this.supplicant = null;
        this.supplicantVisual = null;
        this.supplicantSprite = null;
      } else if (this.overlay === 'divination' && this.divinationStage === 'waiting') {
        this.startDivinationQuestion();
      }
      return;
    }
    const speed = this.supplicantLeaving ? 104 : 76;
    const stepLength = Math.min(distance, speed * dt);
    const stepX = dx / Math.max(distance, .001) * stepLength;
    const stepY = dy / Math.max(distance, .001) * stepLength;
    root.setPosition(root.position.x + stepX, root.position.y + stepY, 79);
    const facing: Facing = Math.abs(stepX) > Math.abs(stepY) ? (stepX > 0 ? 'right' : 'left') : (stepY > 0 ? 'up' : 'down');
    this.animateSupplicant(stepLength, facing);
  }

  private animateSupplicant(movedDistance: number, facing: Facing) {
    const sprite = this.supplicantSprite;
    const visual = this.supplicantVisual;
    if (!sprite?.isValid || !visual?.isValid) return;
    this.supplicantFacing = facing;
    let frameIndex = 0;
    if (movedDistance > .01) {
      this.supplicantWalkPhase += movedDistance / 10.5;
      const sequence = [0, 1, 0, 3];
      frameIndex = sequence[Math.floor(this.supplicantWalkPhase) % sequence.length];
      visual.setPosition(0, 31 + Math.abs(Math.sin(this.supplicantWalkPhase * Math.PI)) * .45, 4);
    }
    const displayKey = (['down', 'left', 'right', 'up'].indexOf(facing) * 4) + frameIndex;
    const frame = this.supplicantFrames[facing][frameIndex];
    if (frame && this.supplicantDisplayedFrame !== displayKey) {
      sprite.spriteFrame = frame;
      this.supplicantDisplayedFrame = displayKey;
    }
  }

  private startDivinationQuestion() {
    if (!this.currentQuestion || this.divinationStage !== 'waiting') return;
    this.divinationStage = 'question';
    this.currentAttempts = 0;
    this.currentRewardCoins = 0;
    this.currentRewardExperience = 0;
    this.currentMasteryStars = 0;
    if (this.divinationText?.isValid) this.divinationText.string = this.currentQuestion.prompt;
    if (this.divinationName?.isValid) this.divinationName.string = this.currentQuestion.villager;
    this.audioManager.playSfx('card_flip');
    this.buildOracleSelection();
    this.updateRiseButtonState();
  }

  private buildOracleSelection() {
    if (!this.overlayRoot || !this.currentQuestion) return;
    this.overlayRoot.getChildByName('OracleSelectionLayer')?.destroy();
    const layer = new Node('OracleSelectionLayer');
    layer.parent = this.overlayRoot;
    layer.setPosition(0, 0, 8);
    layer.addComponent(UITransform).setContentSize(1280, 720);
    this.oracleCardNodes = [];
    this.oracleCardHome = [];
    this.correctCardIndex = -1;
    this.divinationFusedGlyph = null;
    this.divinationActiveCardNode = null;
    this.divinationActiveCard = null;

    this.createUiLabel(layer, 'SelectionInstruction', '拖动一枚甲骨到右侧完整龟腹甲上', -160, 284, 650, 42, 20, new Color(255, 230, 168));
    // A divination card is never lent from the catalogue: the answer itself
    // must be a card the player has already excavated and learned to use.
    const answer = this.oracleCards.find(card => card.id === this.currentQuestion?.answerId
      && this.save.unlockedOracleIds.includes(card.id)
      && (this.hasRealOracleGlyph(card) || Boolean(card.modern)));
    const wrongCandidates = this.oracleCards.filter(card => card.id !== answer?.id
      && this.save.unlockedOracleIds.includes(card.id) && (this.hasRealOracleGlyph(card) || Boolean(card.modern)));
    if (!answer || wrongCandidates.length < 2) {
      if (this.divinationText?.isValid) this.divinationText.string = '甲骨数量不足，暂时无法组成三张不同的候选甲骨。';
      this.divinationStage = 'waiting';
      return;
    }
    const wrongCards = wrongCandidates
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    const cards = [answer, ...wrongCards].sort(() => Math.random() - 0.5);
    this.currentDivinationCards = cards;
    const positions = [-390, -195, 0];
    cards.forEach((card, index) => {
      const home = new Vec2(positions[index] ?? -390 + index * 195, 92);
      const node = this.createOracleCardNode(layer, card, index, home.x, home.y);
      this.oracleCardNodes.push(node);
      this.oracleCardHome.push(home);
      if (card.id === this.currentQuestion?.answerId) this.correctCardIndex = index;
    });

    const shell = new Node('DivinationDropShell');
    shell.parent = layer;
    shell.setPosition(360, 90, 5);
    shell.addComponent(UITransform).setContentSize(270, 300);
    const shellGraphics = shell.addComponent(Graphics);
    const shellColor = this.save.equippedShellId === 'shell-gold'
      ? new Color(220, 177, 73)
      : this.save.equippedShellId === 'shell-vermilion' ? new Color(179, 78, 55) : new Color(211, 176, 112);
    this.drawCompletePlastron(shellGraphics, shellColor);
    this.divinationShellNode = shell;
    this.divinationCracks = shellGraphics;
    this.createUiLabel(layer, 'ShellTargetLabel', '完整占卜龟腹甲', 360, -62, 240, 38, 18, new Color(255, 225, 164));
  }

  private drawCompletePlastron(g: Graphics, shellColor: Color) {
    // Full turtle plastron: irregular rim, paired scutes, drilled hollows and
    // old hairline cracks. It remains visible beneath the fused glyph.
    g.clear();
    g.fillColor = new Color(58, 39, 30, 95);
    g.moveTo(-74, 112); g.lineTo(-96, 78); g.lineTo(-91, 29); g.lineTo(-103, -17);
    g.lineTo(-88, -71); g.lineTo(-58, -119); g.lineTo(-20, -132); g.lineTo(0, -121);
    g.lineTo(22, -132); g.lineTo(61, -117); g.lineTo(89, -69); g.lineTo(103, -16);
    g.lineTo(92, 29); g.lineTo(97, 78); g.lineTo(74, 112); g.lineTo(28, 126); g.lineTo(0, 116); g.lineTo(-28, 126); g.close(); g.fill();
    g.fillColor = shellColor;
    g.moveTo(-69, 108); g.lineTo(-88, 76); g.lineTo(-84, 31); g.lineTo(-95, -15);
    g.lineTo(-81, -66); g.lineTo(-54, -109); g.lineTo(-18, -121); g.lineTo(0, -111);
    g.lineTo(19, -121); g.lineTo(55, -108); g.lineTo(82, -65); g.lineTo(95, -15);
    g.lineTo(85, 31); g.lineTo(89, 76); g.lineTo(69, 108); g.lineTo(27, 118); g.lineTo(0, 108); g.lineTo(-27, 118); g.close(); g.fill();
    g.strokeColor = new Color(78, 48, 34); g.lineWidth = 6;
    g.moveTo(-69, 108); g.lineTo(-88, 76); g.lineTo(-84, 31); g.lineTo(-95, -15);
    g.lineTo(-81, -66); g.lineTo(-54, -109); g.lineTo(-18, -121); g.lineTo(0, -111);
    g.lineTo(19, -121); g.lineTo(55, -108); g.lineTo(82, -65); g.lineTo(95, -15);
    g.lineTo(85, 31); g.lineTo(89, 76); g.lineTo(69, 108); g.lineTo(27, 118); g.lineTo(0, 108); g.lineTo(-27, 118); g.close(); g.stroke();
    g.strokeColor = new Color(119, 78, 46, 185); g.lineWidth = 2.5;
    g.moveTo(0, 106); g.lineTo(-2, -110);
    [-66, -23, 24, 67].forEach((y, row) => {
      const half = row === 0 || row === 3 ? 68 : 86;
      g.moveTo(-half, y); g.quadraticCurveTo(-34, y + (row % 2 ? 7 : -5), 0, y);
      g.quadraticCurveTo(34, y + (row % 2 ? -7 : 5), half, y);
    });
    g.moveTo(-69, 102); g.lineTo(-34, 67); g.lineTo(-83, 32);
    g.moveTo(69, 102); g.lineTo(34, 67); g.lineTo(83, 32);
    g.moveTo(-90, -17); g.lineTo(-40, -23); g.lineTo(-79, -65);
    g.moveTo(90, -17); g.lineTo(40, -23); g.lineTo(79, -65); g.stroke();
    g.fillColor = new Color(125, 79, 40, 32);
    g.ellipse(-42, 48, 27, 16); g.ellipse(46, -46, 31, 19); g.ellipse(-25, -88, 21, 11); g.fill();
    const holes: Array<[number, number, number]> = [[-2,88,5],[2,65,5],[-1,42,4.5],[2,18,5],[-2,-8,4.5],[2,-35,5],[-1,-63,5],[2,-91,5]];
    holes.forEach((hole, index) => {
      g.fillColor = new Color(75, 47, 34); g.circle(hole[0], hole[1], hole[2] + 2); g.fill();
      g.fillColor = index % 2 ? new Color(40, 31, 27) : new Color(56, 36, 29); g.circle(hole[0], hole[1], hole[2]); g.fill();
      g.strokeColor = new Color(236, 199, 126, 110); g.lineWidth = 1.5; g.circle(hole[0] - 1, hole[1] + 1, Math.max(2, hole[2] - 2)); g.stroke();
    });
    g.strokeColor = new Color(112, 72, 45, 150); g.lineWidth = 2;
    g.moveTo(-64, 87); g.lineTo(-45, 69); g.lineTo(-53, 51);
    g.moveTo(68, 50); g.lineTo(49, 34); g.lineTo(61, 13);
    g.moveTo(-72, -35); g.lineTo(-55, -51); g.lineTo(-64, -74); g.stroke();
  }

  private createOracleCardNode(parent: Node, card: OracleCardData, index: number, x: number, y: number) {
    const node = new Node(`OracleCard-${card.id}`);
    node.parent = parent;
    node.setPosition(x, y, 10 + index);
    node.addComponent(UITransform).setContentSize(156, 194);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(223, 190, 128); graphics.roundRect(-72, -91, 144, 182, 12); graphics.fill();
    graphics.strokeColor = this.qualityColor(card.quality); graphics.lineWidth = 7; graphics.roundRect(-72, -91, 144, 182, 12); graphics.stroke();
    graphics.fillColor = new Color(239, 213, 161); graphics.roundRect(-55, -48, 110, 114, 9); graphics.fill();
    graphics.strokeColor = new Color(118, 76, 45); graphics.lineWidth = 3; graphics.roundRect(-55, -48, 110, 114, 9); graphics.stroke();
    graphics.strokeColor = new Color(91, 57, 38, 180); graphics.lineWidth = 2;
    graphics.moveTo(-48, 56 - index * 4); graphics.lineTo(-16 + index * 5, 26); graphics.lineTo(-38, -3 + index * 7);
    graphics.moveTo(42, 53); graphics.lineTo(13 - index * 4, 12); graphics.lineTo(37, -46 + index * 5); graphics.stroke();
    this.createOracleGlyphVisual(`OracleGlyph-${card.id}`, node, card, 0, 9, 72, 84, 3);
    this.createUiLabel(node, `OracleQuality-${card.id}`, card.quality === 'blue' ? '平民卜骨' : card.quality === 'red' ? '涂朱卜甲' : '王室龟甲', 0, -69, 126, 28, 13, this.qualityColor(card.quality), 'center', 3);
    return node;
  }

  private completeCardDrop(cardIndex: number) {
    const node = this.oracleCardNodes[cardIndex];
    const home = this.oracleCardHome[cardIndex];
    if (!node?.isValid || !home || !this.currentQuestion) return;
    const droppedOnShell = Math.abs(node.position.x - 360) <= 125 && Math.abs(node.position.y - 90) <= 145;
    const card = this.currentDivinationCards[cardIndex];
    if (!droppedOnShell || !card) {
      node.setPosition(home.x, home.y, node.position.z);
      node.setScale(1, 1, 1);
      return;
    }
    if (card.id !== this.currentQuestion.answerId) {
      this.currentAttempts += 1;
      node.setPosition(home.x, home.y, node.position.z);
      node.setScale(1, 1, 1);
      if (this.divinationText?.isValid) {
        this.divinationText.string = this.currentAttempts === 1
          ? `这枚甲骨与所问之事不符。请将“${this.oracleCards.find(item => item.id === this.currentQuestion?.answerId)?.modern ?? ''}”字甲骨拖到龟甲上。`
          : `再看仔细些：正确的“${this.oracleCards.find(item => item.id === this.currentQuestion?.answerId)?.modern ?? ''}”字甲骨已经高亮。`;
      }
      return;
    }
    this.beginCorrectDivination(cardIndex, card);
  }

  private beginCorrectDivination(cardIndex: number, card: OracleCardData) {
    if (!this.currentQuestion) return;
    this.divinationStage = 'animating';
    this.draggingCardIndex = -1;
    this.divinationAnimationTimer = 0;
    const currentStepId = this.storyController?.currentStep()?.id;
    const isChapterOneDivination = currentStepId === 'chapter-1-first-divination';
    // 需求文档：占卜消耗 4 墨，仅「首卜」（第一章第一次，一次性标记 firstDivinationFreeUsed）免费；
    // 后续普通占卜（含第二章全部轮）恢复 4 墨消耗，不得直接把消耗改为 0。
    const inkCost = isChapterOneDivination && this.storyController.useFirstFreeDivination() ? 0 : this.divinationInkCost;
    this.save.ink = Math.max(0, this.save.ink - inkCost);
    this.currentMasteryStars = this.currentAttempts === 0 ? 3 : this.currentAttempts === 1 ? 2 : 1;
    const multiplier = card.quality === 'gold' ? 2 : card.quality === 'red' ? 1.5 : 1;
    this.currentRewardCoins = Math.round(20 * multiplier);
    this.currentRewardExperience = Math.round(10 * multiplier);
    this.save.coins += this.currentRewardCoins;
    this.gainExperience(this.currentRewardExperience);
    const previous = this.save.mastery[card.id] ?? { attempts: 0, bestStars: 0, correctCount: 0 };
    this.save.mastery[card.id] = {
      attempts: previous.attempts + this.currentAttempts,
      bestStars: Math.max(previous.bestStars, this.currentMasteryStars),
      correctCount: previous.correctCount + 1,
    };
    this.persistCitySave();
    this.oracleCardNodes.forEach((node, index) => {
      if (!node.isValid) return;
      node.active = index === cardIndex;
    });
    const correctNode = this.oracleCardNodes[cardIndex];
    if (correctNode?.isValid) {
      correctNode.setPosition(360, 90, 20);
      correctNode.setScale(.72, .72, 1);
      const opacity = correctNode.getComponent(UIOpacity) ?? correctNode.addComponent(UIOpacity);
      opacity.opacity = 255;
      this.divinationActiveCardNode = correctNode;
      this.divinationActiveCard = card;
    }
    if (this.divinationShellNode?.isValid) {
      const fusedGlyph = this.createOracleGlyphVisual(
        'DivinationFusedOracleGlyph', this.divinationShellNode, card, 0, 18, 56, 76, 8, new Color(72, 40, 27),
      );
      const glyphOpacity = fusedGlyph.getComponent(UIOpacity) ?? fusedGlyph.addComponent(UIOpacity);
      glyphOpacity.opacity = 12;
      fusedGlyph.setScale(1.28, 1.28, 1);
      fusedGlyph.setRotationFromEuler(0, 0, -7);
      this.divinationFusedGlyph = fusedGlyph;
    }
    if (this.divinationText?.isValid) this.divinationText.string = '甲骨已合于卜问，正在灼契龟甲、观察兆纹……';
    this.updateRiseButtonState();
  }

  private drawAnimatedDivinationCracks(time: number) {
    const g = this.divinationCracks;
    if (!g?.isValid) return;
    const shellColor = this.save.equippedShellId === 'shell-gold'
      ? new Color(220, 177, 73)
      : this.save.equippedShellId === 'shell-vermilion' ? new Color(179, 78, 55) : new Color(211, 176, 112);
    this.drawCompletePlastron(g, shellColor);
    const heatProgress = this.clamp((time - .9) / 2.7, 0, 1);
    const burnPoints: Array<[number, number, number]> = [[-2,65,1.05],[2,18,1.38],[2,-35,1.72],[2,-91,2.05]];
    burnPoints.forEach((point, index) => {
      const local = this.clamp((time - point[2]) / .72, 0, 1);
      if (local <= 0) return;
      const flicker = .84 + Math.sin(time * 17 + index * 2.4) * .16;
      g.fillColor = new Color(255, 112, 45, Math.round(70 * (1 - local * .45) * flicker));
      g.circle(point[0], point[1], 12 + local * 9); g.fill();
      g.strokeColor = new Color(255, 205, 96, Math.round(220 * (1 - local * .35)));
      g.lineWidth = 3 + (1 - local) * 3; g.circle(point[0], point[1], 5 + local * 6); g.stroke();
      g.fillColor = new Color(46, 28, 25, Math.round(110 + local * 130));
      g.circle(point[0], point[1], 4 + local * 3); g.fill();
    });

    const cracks: Array<{ delay: number; points: Array<[number, number]> }> = [
      { delay: 1.08, points: [[-2,65],[-19,56],[-31,38],[-24,21],[-43,8],[-55,-8]] },
      { delay: 1.30, points: [[-19,56],[-38,70],[-58,64],[-71,47]] },
      { delay: 1.42, points: [[2,18],[19,30],[35,19],[31,2],[51,-11]] },
      { delay: 1.64, points: [[19,30],[37,48],[57,43],[72,26]] },
      { delay: 1.82, points: [[2,-35],[-18,-27],[-33,-42],[-27,-59],[-48,-76]] },
      { delay: 2.02, points: [[2,-35],[19,-45],[35,-39],[48,-58],[39,-79]] },
      { delay: 2.24, points: [[2,-91],[-11,-78],[-5,-61],[-20,-48]] },
      { delay: 2.46, points: [[2,18],[-12,5],[2,-8],[16,-3],[31,-16]] },
    ];
    cracks.forEach((crack, index) => {
      const local = this.clamp((time - crack.delay) / .82, 0, 1);
      if (local <= 0) return;
      g.strokeColor = new Color(61, 34, 29, Math.round(175 + local * 70));
      g.lineWidth = index % 3 === 0 ? 3.7 : 2.7;
      this.strokeProgressivePolyline(g, crack.points, local); g.stroke();
      const glowingTip = this.clamp((local - .55) / .45, 0, 1);
      if (glowingTip > 0 && local < .98) {
        g.strokeColor = new Color(255, 104, 47, Math.round(210 * (1 - glowingTip)));
        g.lineWidth = 2.2;
        this.strokeProgressivePolyline(g, crack.points, local); g.stroke();
      }
    });

    // Heat shimmer and flying embers run late in the sequence, so the result
    // reads as an active divination rather than a single static crack decal.
    if (heatProgress > 0) {
      for (let index = 0; index < 9; index++) {
        const life = (time * .72 + index * .137) % 1;
        const x = Math.sin(index * 2.73 + time * 1.7) * (24 + index * 5);
        const y = -38 + life * 150;
        g.fillColor = new Color(255, index % 2 ? 183 : 104, 45, Math.round(150 * (1 - life) * heatProgress));
        g.circle(x, y, 1.5 + (index % 3)); g.fill();
      }
      g.strokeColor = new Color(255, 205, 114, Math.round(70 * (1 - this.clamp((time - 3.2) / .8, 0, 1))));
      g.lineWidth = 2;
      [-34, 0, 34].forEach((x, index) => {
        g.moveTo(x, -103); g.bezierCurveTo(x - 9, -72, x + 11, -44, x + Math.sin(time * 4 + index) * 8, -12);
      });
      g.stroke();
    }
  }

  private strokeProgressivePolyline(g: Graphics, points: Array<[number, number]>, progress: number) {
    if (points.length < 2 || progress <= 0) return;
    const segmentProgress = this.clamp(progress, 0, 1) * (points.length - 1);
    const completeSegments = Math.floor(segmentProgress);
    const partial = segmentProgress - completeSegments;
    g.moveTo(points[0][0], points[0][1]);
    for (let index = 1; index <= completeSegments && index < points.length; index++) g.lineTo(points[index][0], points[index][1]);
    if (completeSegments < points.length - 1) {
      const from = points[completeSegments]; const to = points[completeSegments + 1];
      g.lineTo(from[0] + (to[0] - from[0]) * partial, from[1] + (to[1] - from[1]) * partial);
    }
  }

  private showDivinationReview() {
    if (!this.overlayRoot || !this.currentQuestion || this.divinationStage !== 'animating') return;
    this.divinationStage = 'review';
    this.audioManager.playSfx('divine_success');
    this.overlayRoot.getChildByName('OracleSelectionLayer')?.destroy();
    this.oracleCardNodes = [];
    this.oracleCardHome = [];
    this.currentDivinationCards = [];
    const card = this.oracleCards.find(item => item.id === this.currentQuestion?.answerId && (this.hasRealOracleGlyph(item) || Boolean(item.modern)));
    if (!card) return;
    const review = new Node('DivinationReviewPanel');
    review.parent = this.overlayRoot;
    review.setPosition(0, 0, 20);
    review.addComponent(UITransform).setContentSize(980, 410);
    this.drawWoodPanel(review, 'ReviewWoodPanel', 0, 82, 980, 390, 0, true);
    const quality = card.quality === 'blue' ? '蓝光·平民卜骨' : card.quality === 'red' ? '红光·涂朱卜甲' : '金光·王室龟甲';
    this.createOracleGlyphVisual('ReviewGlyph', review, card, -350, 100, 105, 135, 3);
    this.createUiLabel(review, 'ReviewTitle', `${card.modern}  ·  ${card.pinyin}`, 70, 215, 620, 58, 34, new Color(91, 47, 28), 'left', 3);
    this.createUiLabel(
      review,
      'ReviewBody',
      `${quality}\n\n字义：${card.meaning}\n\n字形学习：${this.learningEvolution(card)}\n\n商代知识：${card.history}`,
      115,
      75,
      680,
      245,
      20,
      new Color(78, 48, 32),
      'left',
      3,
    );
    const stars = '★'.repeat(this.currentMasteryStars) + '☆'.repeat(3 - this.currentMasteryStars);
    this.createUiLabel(review, 'ReviewReward', `本次掌握 ${stars}   贝币 +${this.currentRewardCoins}   经验 +${this.currentRewardExperience}`, 0, -72, 720, 46, 20, new Color(137, 62, 38), 'center', 3);
    this.drawUiButton(review, 'FinishReviewButton', '完成学习', 380, -72, 150, 52, true);
    if (this.divinationText?.isValid) this.divinationText.string = `占卜完成。请查看“${card.modern}”字的完整解释与含义。`;
    this.updateRiseButtonState();
  }

  /**
   * 从当前占卜步骤起，沿 nextStepId 链式统计「剩余卜算轮数」（含当前步），
   * 直到遇到非 divination-completed 的步骤为止。用于占卜提示文案，
   * 避免用 storyDivinationRounds 反推导致出现负数或错位的「X 卜未完成」。
   */
  private remainingDivinationRounds(): number {
    let count = 0;
    let step = this.storyController?.currentStep() ?? null;
    while (step && step.completeOn === 'divination-completed') {
      count++;
      if (!step.nextStepId) break;
      step = this.storyController?.stepById(step.nextStepId) ?? null;
    }
    return Math.max(0, count);
  }

  private finishDivinationReview() {
    if (this.divinationStage !== 'review') return;
    const completedQuestion = this.currentQuestion;
    const storyRound = this.isActiveDivinationStep();
    if (storyRound) {
      this.storyDivinationRounds++;
      if (completedQuestion?.answerId && !this.storyDivinationAnswerIds.includes(completedQuestion.answerId)) {
        this.storyDivinationAnswerIds.push(completedQuestion.answerId);
      }
    }
    // 判定「当前占卜步骤是否为占卜链的最后一轮」：其后续步骤的 completeOn 不再是
    // 'divination-completed'（即下一步是「起身查看裂纹」）即代表占卜环节整体结束。
    // 该标记仅用于在「末轮」才标记 storyAdvanced 以触发章完成副作用（线索/命力/音效）。
    const lastDivinationRound = storyRound
      ? !this.storyController?.stepIsDivination(this.storyController?.currentStep()?.nextStepId)
      : true;
    // 在 handle 推进步骤之前记录「刚完成的是哪一章的占卜」，用于线索标记与文案。
    const finishedChapterId = this.storyController?.currentStep()?.chapterId;
    // 每一轮占卜完成都推进「当前这一轮」占卜步骤（divination-1→2→3→leave），
    // 让占卜链严格按步前进；旧逻辑只在末轮才推进，导致 divination-1/2 永不推进、
    // 玩家三轮都在重复第一轮、永远显示「第一次占卜 剩余两次」且不进章。
    let storyAdvanced = false;
    if (storyRound) {
      const ok = this.storyController?.handle({
        type: 'divination-completed',
        cardId: completedQuestion?.answerId,
        npcId: completedQuestion?.villager,
        correct: true,
      });
      storyAdvanced = lastDivinationRound && ok === true;
    }
    // 占卜结束若已触发章完成（currentChapterId 清空），兜底衔接下一章，
    // 与对话完成路径一致，确保小人被传送到下一章落点、绝不停留在上一章。
    this.advanceToNextChapterIfNeeded();
    // 各章占卜完成后的线索 flag 与「起身查看裂纹」文案：集中成映射，加章只改这里。
    const chapterClueFlags: Record<string, string> = {
      [CHAPTER_ONE_ID]: 'clue.west-river-fragment',
      [CHAPTER_TWO_ID]: 'clue.upstream-missing',
      [CHAPTER_THREE_ID]: 'clue.forest-bone',
      [CHAPTER_FOUR_ID]: 'clue.escort-route',
      [CHAPTER_FIVE_ID]: 'clue.ruins-lamp',
      [CHAPTER_SIX_ID]: 'clue.wrong-scroll',
      [CHAPTER_SEVEN_ID]: 'clue.tomb-proofs',
      [CHAPTER_EIGHT_ID]: 'clue.renew-covenant',
      [CHAPTER_NINE_ID]: 'clue.main-complete',
    };
    const chapterRiseTexts: Record<string, string> = {
      [CHAPTER_ONE_ID]: '兆纹之外浮现出一道陌生裂纹，似乎正指向西侧河畔。请起身查看。',
      [CHAPTER_TWO_ID]: '兆纹之外浮现出一道陌生裂纹，似乎正指向逆流而上的河源。请起身查看。',
      [CHAPTER_THREE_ID]: '兆纹之外浮现出一道裂纹，竟越过河水，指向对岸幽深的山林。请起身查看。',
      [CHAPTER_FOUR_ID]: '兆纹之外浮现出一道裂纹，竟越过林线，指向山外热闹的护送道。请起身查看。',
      [CHAPTER_FIVE_ID]: '兆纹之外浮现出一道裂纹，越过护送道，拐进一片荒废的宗庙。请起身查看。',
      [CHAPTER_SIX_ID]: '兆纹之外浮现出一道裂纹，照进废墟深处一卷将焚的典册。请起身查看。',
      [CHAPTER_SEVEN_ID]: '兆纹之外浮现出一道裂纹，越出城郭，直指城外幽深的王陵。请起身查看。',
      [CHAPTER_EIGHT_ID]: '兆纹之外浮现出一道裂纹，没入王陵最深处一具指天卜骨。请起身查看。',
      [CHAPTER_NINE_ID]: '三卜既毕，兆纹终于连成完整的通天之契。请起身，见证主线功成。',
    };
    if (storyAdvanced) {
      this.storyController.setFlag(
        (finishedChapterId && chapterClueFlags[finishedChapterId]) || 'clue.west-river-fragment', true);
      this.storyController.addDestinyPower(1);
      this.audioManager.playSfx('chapter_clear');
    }
    // handle 之后，若当前步骤仍是「占卜步骤」且本轮不是占卜链末轮，说明还有下一轮，
    // 保持 overlay 自动续接；否则（末轮）逼玩家起身查看裂纹。
    const stillDivining = this.isActiveDivinationStep() && !lastDivinationRound;
    const remainingRounds = this.remainingDivinationRounds();
    this.overlayRoot?.getChildByName('DivinationReviewPanel')?.destroy();
    if (this.divinationText?.isValid) {
      this.divinationText.string = stillDivining
        ? `本轮卜算已记入兆纹。请留在占卜席，下一位村民马上前来${remainingRounds > 1 ? `（尚余 ${Math.max(0, remainingRounds - 1)} 轮卜算）` : ''}。`
        : storyAdvanced
        ? ((finishedChapterId && chapterRiseTexts[finishedChapterId])
          || '“雨”字兆纹之外浮现出一道陌生裂纹，似乎正指向西侧河畔。请起身查看。')
        : this.save.ink >= this.divinationInkCost
        ? `${this.currentQuestion?.villager ?? '村民'}谢过卜官，下一位村民稍后前来。此时可以起身离开。`
        : '本次学习已经完成，但墨料不足，无法继续接待村民。现在可以起身离开。';
    }
    this.supplicantLeaving = true;
    this.currentQuestion = null;
    this.currentDivinationCards = [];
    this.divinationStage = 'waiting';
    this.queueTimer = stillDivining
      ? 1.15
      : storyAdvanced && !stillDivining ? 9999 : this.save.ink >= this.divinationInkCost ? 1.15 : 9999;
    this.updateRiseButtonState();
  }

  private exitDivination() {
    const ceremonyInProgress = this.isActiveDivinationStep()
      && this.storyDivinationRounds > 0 && this.storyDivinationRounds < 3;
    if (this.divinationStage !== 'waiting' || ceremonyInProgress) {
      if (this.divinationText?.isValid) this.divinationText.string = '当前占卜尚未完成，完成本轮教学后才能起身。';
      return;
    }
    this.supplicantLeaving = true;
    this.seated = false;
    this.overlay = 'none';
    this.divinationStage = 'none';
    this.currentQuestion = null;
    const risePoint = this.resolveTempleRisePoint();
    this.templeLastRisePosition = risePoint.clone();
    this.playerPos.set(risePoint.x, risePoint.y);
    this.player.setPosition(risePoint.x, risePoint.y, 80);
    this.facing = this.templePreSitFacing;
    this.displayedPlayerFrame = -1;
    this.showPlayerFrame(this.getIdleFrameIndex(this.facing));
    this.animatePlayer(false, new Vec2(), 0);
    this.updateTempleSeatDepthOrdering();
    this.destroyOverlayRoot();
    this.storyController?.handle({ type: 'result-confirmed' });
  }

  private resolveTempleRisePoint() {
    const origin = this.templePreSitWorldMode === 'templeInterior' && this.templePreSitPosition
      ? this.templePreSitPosition
      : null;
    const candidates: Vec2[] = [];
    if (origin) {
      // Restore the exact approach point first, then make small lateral moves
      // that preserve the player's perceived place beside the chair.
      candidates.push(
        origin.clone(),
        new Vec2(origin.x - 24, origin.y), new Vec2(origin.x + 24, origin.y),
        new Vec2(origin.x - 40, origin.y), new Vec2(origin.x + 40, origin.y),
      );
    }
    candidates.push(new Vec2(-70, -24), new Vec2(70, -24));
    if (origin) {
      const nearby: Vec2[] = [];
      for (const radius of [24, 40, 56, 72, 88]) {
        for (const [dx, dy] of [[-radius, 0], [radius, 0], [0, -radius], [0, radius],
          [-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]]) {
          nearby.push(new Vec2(origin.x + dx, origin.y + dy));
        }
      }
      nearby.sort((a, b) => Vec2.distance(a, origin) - Vec2.distance(b, origin));
      candidates.push(...nearby);
    }
    candidates.push(
      this.templeRiseSafePoint,
      new Vec2(-145, -185),
      new Vec2(145, -185),
      new Vec2(0, -220),
    );
    return candidates.find(point => this.canPlayerStand(point.x, point.y)) ?? this.templeRiseSafePoint;
  }

  private stopPlayerInput() {
    this.keyboard.set(0, 0);
    this.stick.set(0, 0);
    this.touchOrigin = null;
    this.joystickKnob?.setPosition(-500, -230, 202);
  }

  private destroyOverlayRoot() {
    this.overlayRoot?.destroy();
    this.overlayRoot = null;
    this.excavationLearningMask?.destroy();
    this.excavationLearningMask = null;
    this.divinationText = null;
    this.divinationName = null;
    this.riseButtonLabel = null;
    this.backpackDetailLabel = null;
    this.shopFeedback = null;
    this.excavationLearningFeedback = null;
    this.oracleCardNodes = [];
    this.oracleCardHome = [];
    this.draggingCardIndex = -1;
    this.correctCardIndex = -1;
    this.divinationShellNode = null;
    this.divinationCracks = null;
    this.divinationFusedGlyph = null;
    this.divinationActiveCardNode = null;
    this.divinationActiveCard = null;
  }

  private oracleModernCharacter(card: OracleCardData) {
    return card.modern.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').trim();
  }

  /** Only supplied, bundled oracle images may be used in learning gameplay. */
  private hasRealOracleGlyph(card: OracleCardData) {
    return Boolean(card.asset && card.imageBounds);
  }

  /** Never expose development placeholders in the learner-facing archive. */
  private learningEvolution(card: OracleCardData) {
    const text = card.evolution;
    if (!/(占位|临时|待后续|资料库接入|正式(?:版本|资料|字库).*(?:替换|补充|接入)|当前.*符号)/.test(text)) return text;
    return `甲骨文字形以可辨认的轮廓、笔画方向与构件组合传递意义。学习时可先观察它最突出的形状，再与现代字义和同类字形相互对照。`;
  }

  private showExcavationLearning(site: ExcavationSite, card: OracleCardData) {
    this.stopPlayerInput();
    this.overlay = 'excavationLearning';
    this.excavationLearningStage = 'question';
    this.excavationLearningSite = site;
    this.excavationLearningCard = card;
    this.excavationLearningAttempts = 0;
    this.excavationWrongChoices = [];
    this.excavationLearningResult = '';
    const distractors = this.oracleCards.filter(item => item.excavatable && item.id !== card.id && this.hasRealOracleGlyph(item));
    for (let index = distractors.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [distractors[index], distractors[swapIndex]] = [distractors[swapIndex], distractors[index]];
    }
    this.excavationLearningOptions = [card, ...distractors.slice(0, 3)];
    for (let index = this.excavationLearningOptions.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [this.excavationLearningOptions[index], this.excavationLearningOptions[swapIndex]] = [this.excavationLearningOptions[swapIndex], this.excavationLearningOptions[index]];
    }
    this.buildExcavationLearningUi();
  }

  /** Deterministic browser-only regression entry; never activates in the APK. */
  private openOracleQaPreview() {
    if (this.overlay !== 'none') return;
    const card = this.oracleCards.find(item => item.id === 'river-official' && item.excavatable && this.hasRealOracleGlyph(item));
    const site = this.excavationSites.find(item => item.active && item.root.isValid);
    if (!card || !site) return;
    site.reward = { kind: 'oracle', quality: card.quality, cardId: card.id, amount: 0 };
    this.showExcavationLearning(site, card);
  }

  private drawIncompleteScapula(g: Graphics, qualityColor: Color) {
    // The approved learning bone is a long, fan-headed cattle scapula with a
    // narrowed broken stem. It deliberately avoids the regular octagonal card
    // silhouette of the previous placeholder.
    g.clear();
    const outline = (offsetX: number, offsetY: number) => {
      g.moveTo(-30 + offsetX,-116 + offsetY); g.lineTo(-49 + offsetX,-82 + offsetY);
      g.lineTo(-45 + offsetX,-48 + offsetY); g.lineTo(-68 + offsetX,-33 + offsetY);
      g.lineTo(-55 + offsetX,-8 + offsetY); g.lineTo(-77 + offsetX,19 + offsetY);
      g.lineTo(-91 + offsetX,61 + offsetY); g.lineTo(-73 + offsetX,96 + offsetY);
      g.lineTo(-39 + offsetX,118 + offsetY); g.lineTo(2 + offsetX,123 + offsetY);
      g.lineTo(39 + offsetX,111 + offsetY); g.lineTo(70 + offsetX,89 + offsetY);
      g.lineTo(88 + offsetX,55 + offsetY); g.lineTo(72 + offsetX,33 + offsetY);
      g.lineTo(82 + offsetX,9 + offsetY); g.lineTo(59 + offsetX,-8 + offsetY);
      g.lineTo(63 + offsetX,-47 + offsetY); g.lineTo(43 + offsetX,-61 + offsetY);
      g.lineTo(47 + offsetX,-91 + offsetY); g.lineTo(18 + offsetX,-117 + offsetY);
      g.lineTo(-5 + offsetX,-108 + offsetY); g.close();
    };
    g.fillColor = new Color(66,45,34,100); outline(3,-4); g.fill();
    g.fillColor = new Color(218,193,145); outline(0,0); g.fill();
    g.strokeColor = new Color(77,52,39); g.lineWidth = 5; outline(0,0); g.stroke();

    // Bright fan ridge, translucent density islands and dirt-stained broken
    // edges produce the chalky layered bone material visible in the design.
    g.fillColor = new Color(239,218,171,145);
    g.moveTo(-70,73); g.lineTo(-43,104); g.lineTo(-5,112); g.lineTo(-23,78); g.lineTo(-53,57); g.close(); g.fill();
    g.fillColor = new Color(153,105,61,36);
    g.ellipse(35,76,34,21); g.ellipse(-49,27,24,33); g.ellipse(32,-28,28,30); g.ellipse(3,-86,27,17); g.fill();
    g.fillColor = new Color(98,61,41,55);
    g.ellipse(-75,54,9,20); g.ellipse(65,57,12,23); g.ellipse(-45,-61,8,19); g.fill();
    g.fillColor = new Color(89,57,42,115);
    g.moveTo(-49,-82); g.lineTo(-30,-116); g.lineTo(-5,-108); g.lineTo(-13,-93); g.close(); g.fill();
    g.moveTo(59,-8); g.lineTo(82,9); g.lineTo(72,33); g.lineTo(53,23); g.close(); g.fill();

    // Paired drilled/burnt pits follow a ritual column rather than floating
    // around the rim. Their asymmetric spacing copies the excavated specimen.
    const pits: Array<[number,number,number]> = [[18,91,5],[19,70,5],[17,48,4.5],[15,-67,5],[16,-88,5],[5,-103,4]];
    pits.forEach((pit,index) => {
      g.fillColor = new Color(78,49,35); g.circle(pit[0],pit[1],pit[2]+2); g.fill();
      g.fillColor = new Color(43,32,28); g.circle(pit[0],pit[1],pit[2]); g.fill();
      g.fillColor = new Color(244,220,169,135); g.circle(pit[0]-1.3,pit[1]+1.5,1.4); g.fill();
      if (index < 3) { g.fillColor = new Color(118,73,42,42); g.circle(pit[0],pit[1],pit[2]+8); g.fill(); }
    });
    // Dense ancient cracks are fine and irregular; two short quality-coloured
    // seams are the only modern visual hint.
    g.strokeColor = new Color(118,78,49,190); g.lineWidth = 2.2;
    g.moveTo(-63,89); g.lineTo(-39,67); g.lineTo(-48,43); g.lineTo(-20,28); g.lineTo(-25,4);
    g.moveTo(55,96); g.lineTo(34,75); g.lineTo(42,53); g.lineTo(17,34);
    g.moveTo(-71,9); g.lineTo(-48,-7); g.lineTo(-55,-29); g.lineTo(-31,-44); g.lineTo(-39,-70);
    g.moveTo(63,-13); g.lineTo(39,-27); g.lineTo(46,-48); g.lineTo(24,-65);
    g.moveTo(-16,109); g.lineTo(-6,83); g.lineTo(-13,61); g.stroke();
    g.strokeColor = new Color(qualityColor.r,qualityColor.g,qualityColor.b,145); g.lineWidth = 2;
    g.moveTo(-25,4); g.lineTo(-7,-7); g.lineTo(10,1);
    g.moveTo(-31,-44); g.lineTo(-13,-54); g.lineTo(4,-47); g.stroke();
  }

  private buildExcavationLearningUi() {
    const card = this.excavationLearningCard;
    if (!card) return;
    this.destroyOverlayRoot();
    const canvas = this.findCanvasNode();
    const mask = new Node('ExcavationLearningFullscreenMask');
    mask.parent = canvas;
    mask.setPosition(0, 0, 419);
    mask.addComponent(UITransform).setContentSize(1280, 720);
    const maskWidget = mask.addComponent(Widget);
    maskWidget.isAlignTop = maskWidget.isAlignBottom = maskWidget.isAlignLeft = maskWidget.isAlignRight = true;
    maskWidget.top = maskWidget.bottom = maskWidget.left = maskWidget.right = 0;
    maskWidget.updateAlignment();
    mask.addComponent(Graphics);
    this.excavationLearningMask = mask;
    this.refreshExcavationLearningMask();

    const root = new Node('ExcavationLearningOverlay');
    root.parent = this.node;
    root.setPosition(0, 0, 420);
    root.addComponent(UITransform).setContentSize(1280, 720);
    this.overlayRoot = root;
    this.drawWoodPanel(root, 'ExcavationLearningFrame', 0, 0, 1150, 650, 1, false);
    this.createUiLabel(root, 'ExcavationLearningTitle',
      this.excavationLearningStage === 'question' ? '新发现 · 甲骨文字辨识' : '甲骨文学习档案',
      0, 287, 780, 54, 31, new Color(255, 221, 148), 'center', 5);
    this.createUiLabel(root, 'ExcavationLearningRunningHint',
      'NPC、天气和地图时间继续运行 · 学习期间玩家暂时不能移动',
      0, 252, 780, 30, 14, new Color(205, 187, 157), 'center', 5);

    if (this.excavationLearningStage === 'detail') {
      this.buildExcavationLearningDetail(root, card);
      return;
    }

    this.drawWoodPanel(root, 'ExcavatedOracleCard', -360, -5, 330, 465, 2, true);
    const glow = this.localGraphics('ExcavatedOracleGlow', root, -360, 52, 250, 292, 3);
    const qualityColor = this.qualityColor(card.quality);
    glow.fillColor = new Color(70, 48, 35, 42); glow.ellipse(4, -10, 102, 125); glow.fill();
    glow.strokeColor = new Color(qualityColor.r, qualityColor.g, qualityColor.b, 105); glow.lineWidth = 2.5;
    glow.moveTo(-91,-53); glow.lineTo(-101,-18); glow.lineTo(-94,14);
    glow.moveTo(92,48); glow.lineTo(99,16); glow.lineTo(94,-12); glow.stroke();
    const bone = this.localGraphics('ExcavatedOracleBone', root, -360, 48, 220, 270, 4);
    this.drawIncompleteScapula(bone, qualityColor);
    this.createOracleGlyphVisual('ExcavatedOracleGlyph', root, card, -360, 48, 68, 88, 6);
    const qualityName = card.quality === 'gold' ? '金光 · 王室龟甲' : card.quality === 'red' ? '红光 · 涂朱卜甲' : '蓝光 · 普通卜骨';
    this.createUiLabel(root, 'ExcavatedOracleQuality', qualityName, -360, -171, 270, 34, 16, qualityColor, 'center', 6);

    this.drawWoodPanel(root, 'ExcavationQuestionPanel', 205, 42, 620, 390, 2, true);
    this.createUiLabel(root, 'ExcavationQuestionPrompt', '仔细观察左侧字形：\n这个甲骨文对应下面哪个现代汉字？',
      205, 176, 540, 84, 24, new Color(82, 47, 29), 'center', 5);
    const optionPositions: Array<[number, number]> = [[65, 72], [345, 72], [65, -25], [345, -25]];
    this.excavationLearningOptions.forEach((option, index) => {
      const position = optionPositions[index];
      const wrong = this.excavationWrongChoices.includes(index);
      this.drawUiButton(root, `ExcavationAnswer-${index}`,
        `${String.fromCharCode(65 + index)}. ${this.oracleModernCharacter(option)}`,
        position[0], position[1], 238, 70, wrong);
      if (wrong) this.createUiLabel(root, `ExcavationWrongMark-${index}`, '请再想一想', position[0], position[1] - 24, 190, 22, 12, new Color(255, 214, 173), 'center', 7);
    });
    const feedbackText = this.excavationWrongChoices.length > 0
      ? '这个答案与字形不符。答案不会更换，请继续观察并重新选择。'
      : '答对后才会正式收录，并打开完整教学档案。';
    this.excavationLearningFeedback = this.createUiLabel(root, 'ExcavationLearningFeedback', feedbackText,
      205, -115, 550, 52, 16, this.excavationWrongChoices.length > 0 ? new Color(157, 61, 45) : new Color(104, 75, 46), 'center', 6);
    this.drawUiButton(root, 'ExcavationLearnLaterButton', '稍后学习', 425, -257, 210, 58, false);
    this.createUiLabel(root, 'ExcavationLearnLaterHint', '稍后学习不会丢失该文字；重新挖掘此坑位仍是同一个字。',
      -55, -257, 690, 40, 14, new Color(218, 198, 165), 'left', 5);
  }

  private findCanvasNode() {
    let current: Node | null = this.node;
    while (current && !current.getComponent(Canvas)) current = current.parent;
    return current ?? this.node;
  }

  private refreshExcavationLearningMask() {
    if (this.overlay !== 'excavationLearning' || !this.excavationLearningMask?.isValid) return;
    const widget = this.excavationLearningMask.getComponent(Widget);
    widget?.updateAlignment();
    const transform = this.excavationLearningMask.getComponent(UITransform);
    const graphics = this.excavationLearningMask.getComponent(Graphics);
    if (!transform || !graphics) return;
    const { width, height } = transform.contentSize;
    graphics.clear();
    graphics.fillColor = new Color(0, 0, 0, 168);
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();
  }

  private answerExcavationLearning(optionIndex: number) {
    if (this.overlay !== 'excavationLearning' || this.excavationLearningStage !== 'question') return;
    const card = this.excavationLearningCard;
    const selected = this.excavationLearningOptions[optionIndex];
    if (!card || !selected || this.excavationWrongChoices.includes(optionIndex)) return;
    this.excavationLearningAttempts++;
    const record = this.save.mastery[card.id] ?? { attempts: 0, bestStars: 0, correctCount: 0 };
    record.attempts++;
    if (selected.id !== card.id) {
      this.excavationWrongChoices.push(optionIndex);
      this.save.mastery[card.id] = record;
      this.persistCitySave();
      this.buildExcavationLearningUi();
      return;
    }

    record.correctCount++;
    const stars = this.excavationLearningAttempts <= 1 ? 3 : this.excavationLearningAttempts <= 2 ? 2 : 1;
    record.bestStars = Math.max(record.bestStars, stars);
    this.save.mastery[card.id] = record;
    const alreadyCollected = this.save.unlockedOracleIds.includes(card.id);
    if (alreadyCollected) {
      const convertedInk = card.quality === 'gold' ? 14 : card.quality === 'red' ? 8 : 4;
      this.save.ink += convertedInk;
      this.excavationLearningResult = `该文字已经收录，本次重复卜骨已转化为 ${convertedInk} 份墨料。`;
    } else {
      this.save.unlockedOracleIds.push(card.id);
      this.excavationLearningResult = '辨识正确！该甲骨文字已经正式收录到背包图鉴。';
    }
    const unlockedOrder = this.oracleCards.filter(item => this.save.unlockedOracleIds.includes(item.id) && this.hasRealOracleGlyph(item));
    this.selectedBackpackIndex = Math.max(0, unlockedOrder.findIndex(item => item.id === card.id));
    this.codexPage = Math.floor(this.selectedBackpackIndex / 12);
    if (this.excavationLearningSite) {
      this.excavationLearningSite.awaitingStudy = false;
      if (this.excavationLearningSite.active) {
        this.excavationLearningSite.active = false;
        this.excavationLearningSite.holeTimer = 0;
        this.redrawExcavationSite(this.excavationLearningSite);
      }
    }
    this.persistCitySave();
    if (this.excavationLearningSite) {
      this.createExcavationRewardFlight(this.excavationLearningSite.x, this.excavationLearningSite.y, card.glyph, card.quality, card);
    }
    this.excavationLearningStage = 'detail';
    this.buildExcavationLearningUi();
  }

  private buildExcavationLearningDetail(root: Node, card: OracleCardData) {
    this.drawWoodPanel(root, 'ExcavationDetailGlyphPanel', -390, -5, 285, 470, 2, true);
    const qualityColor = this.qualityColor(card.quality);
    const archiveBone = this.localGraphics('ExcavationDetailScapula', root, -390, 92, 205, 245, 3);
    archiveBone.node.setScale(.82, .82, 1);
    this.drawIncompleteScapula(archiveBone, qualityColor);
    this.createOracleGlyphVisual('ExcavationDetailGlyph', root, card, -390, 96, 66, 86, 5);
    this.createUiLabel(root, 'ExcavationDetailModern', `${this.oracleModernCharacter(card)}  ·  ${card.pinyin}`,
      -390, -45, 240, 54, 28, new Color(91, 47, 29), 'center', 5);
    const qualityName = card.quality === 'gold' ? '王室金光龟甲' : card.quality === 'red' ? '贵族涂朱卜甲' : '平民普通卜骨';
    this.createUiLabel(root, 'ExcavationDetailQuality', qualityName, -390, -99, 235, 34, 16, qualityColor, 'center', 5);
    this.createUiLabel(root, 'ExcavationDetailResult', this.excavationLearningResult,
      -390, -172, 236, 92, 15, new Color(97, 64, 39), 'center', 5);

    this.drawWoodPanel(root, 'ExcavationTeachingArchive', 170, -3, 720, 480, 2, true);
    const teachingText = `现代汉字：${this.oracleModernCharacter(card)}\n读音：${card.pinyin}\n\n一、字义与象形来源\n${card.meaning}\n\n二、字形演变与辨识要点\n${this.learningEvolution(card)}\n\n三、历史来源与商代生活\n${card.history}\n\n学习提示：再次在背包“图鉴”中点击该字，可以随时复习以上内容。`;
    this.createUiLabel(root, 'ExcavationTeachingText', teachingText,
      170, -2, 660, 436, 16, new Color(74, 43, 29), 'left', 5);
    this.drawUiButton(root, 'ExcavationLearningCompleteButton', '完成学习', 430, -270, 220, 58, true);
  }

  private deferExcavationLearning() {
    if (this.overlay !== 'excavationLearning' || this.excavationLearningStage !== 'question') return;
    const card = this.excavationLearningCard;
    if (this.excavationLearningSite) this.excavationLearningSite.awaitingStudy = true;
    this.overlay = 'none';
    this.excavationLearningStage = 'none';
    this.excavationLearningSite = null;
    this.excavationLearningCard = null;
    this.excavationLearningOptions = [];
    this.excavationWrongChoices = [];
    this.destroyOverlayRoot();
    this.showStatusNotice(`已暂存“${card ? this.oracleModernCharacter(card) : '未知'}”字学习内容。重新挖掘原坑位即可继续，字不会改变。`, 5);
  }

  private finishExcavationLearning() {
    if (this.overlay !== 'excavationLearning' || this.excavationLearningStage !== 'detail') return;
    const card = this.excavationLearningCard;
    // 学完即让承载该字的坑挖空并重生，继续产出下一个未收集字。
    // 否则坑会永久停留在「已挖出待学」状态、不再刷新；royal/field 等区域坑位（10/20 个）
    // 少于本章主线字数（章三 19 / 章八 44 等），坑不轮替就永远集不齐全部字，章节卡死。
    const studiedSite = this.excavationLearningSite;
    this.overlay = 'none';
    this.excavationLearningStage = 'none';
    this.excavationLearningSite = null;
    this.excavationLearningCard = null;
    this.excavationLearningOptions = [];
    this.excavationWrongChoices = [];
    this.destroyOverlayRoot();
    this.showStatusNotice(`${card ? this.oracleModernCharacter(card) : '甲骨文'}的完整学习档案已收入背包图鉴。`, 4.2);
    const finishLessonStepId = this.storyController?.currentStep()?.id;
    const expectedLesson = this.allStoryFragmentCards.find(item =>
      item.lessonStepId === finishLessonStepId && item.cardId === card?.id);
    if (expectedLesson && card) {
      this.storyController?.handle({ type: 'learning-completed', cardId: card.id, correct: true });
    } else if (card) {
      // 自由探索字或无对应剧情步骤的字：直接标记为已学会，确保纳入本章完成门槛。
      this.storyController?.markCardLearned(card.id);
    }
    // 若当前停在 fragment-awakens，且学完这张卡后本章全部字已齐，自动推进到占卜委托。
    const chapterId = this.storyController?.currentStep()?.chapterId;
    if (chapterId && finishLessonStepId?.endsWith('fragment-awakens')) {
      const main = this.chapterMainProgress(chapterId);
      if (main.total > 0 && main.learned >= main.total) {
        this.storyController?.handle({ type: 'dialogue-completed' });
        this.advanceToNextChapterIfNeeded();
      } else {
        this.showChapterCollectionMilestone(chapterId);
      }
    }
    // 字已收入图鉴：让承载它的坑挖空并重置重生计时。下一帧 updateExcavationEffects
    // 会把它移走并重新 roll 一个未收集字，保证有限的坑位能轮替覆盖本章所有主线字。
    if (studiedSite) {
      studiedSite.awaitingStudy = false;
      studiedSite.active = false;
      studiedSite.holeTimer = 0;
      studiedSite.respawnTimer = 3;
    }
  }

  private openBackpack() {
    if (this.overlay !== 'none' || this.seated) return;
    this.stopPlayerInput();
    this.overlay = 'backpack';
    this.selectedBackpackIndex = this.clamp(this.selectedBackpackIndex, 0, Math.max(0, this.save.unlockedOracleIds.length - 1));
    this.buildBackpackUi();
  }

  private openChapterProgress() {
    if (this.overlay !== 'none' || this.seated) return;
    this.stopPlayerInput();
    this.overlay = 'chapterProgress';
    // 进度面板四周会透出场景，隐藏任务引导，避免标题落在面板外侧。
    this.questGuide.setVisible(false);
    this.buildChapterProgressUi();
  }

  private chapterStageName(stepId: string | null, completed: boolean, chapterId: string | null) {
    const isCh2 = chapterId === CHAPTER_TWO_ID;
    const isCh3 = chapterId === CHAPTER_THREE_ID;
    const isCh4 = chapterId === CHAPTER_FOUR_ID;
    const laterMeta = chapterId ? this.chapterProgressMeta()[chapterId] : undefined;
    const isLater = chapterId === CHAPTER_FIVE_ID || chapterId === CHAPTER_SIX_ID
      || chapterId === CHAPTER_SEVEN_ID || chapterId === CHAPTER_EIGHT_ID || chapterId === CHAPTER_NINE_ID;
    if (completed) {
      if (isLater && laterMeta) return `${laterMeta.label}已完成`;
      return isCh4 ? '第四章已完成' : isCh3 ? '第三章已完成' : isCh2 ? '第二章已完成' : '第一章已完成';
    }
    if (!stepId || stepId.startsWith('prologue-')) return '序章 · 天道失语';
    // 第五~九章共用模板步骤命名，按 stepId 模式给通用幕名。
    if (isLater) {
      if (stepId.indexOf('-opening') >= 0 || stepId.indexOf('-reach-npc') >= 0 || stepId.indexOf('-npc-dialogue') >= 0) {
        return '第一幕 · 启程';
      }
      if (stepId.indexOf('seek-') >= 0 || stepId.indexOf('lesson-') >= 0) return '第二幕 · 寻骨';
      if (stepId.indexOf('midstream') >= 0 || stepId.indexOf('fragment-awakens') >= 0 || stepId.indexOf('first-request') >= 0) {
        return '第三幕 · 碎甲共鸣';
      }
      if (stepId.indexOf('temple') >= 0 || stepId.indexOf('divination') >= 0 || stepId.indexOf('seat') >= 0) return '第四幕 · 问卜';
      return `尾声 · ${laterMeta?.name ?? ''}`;
    }
    if (isCh4) {
      if (['chapter-4-opening', 'chapter-4-reach-forest', 'chapter-4-npc-dialogue'].indexOf(stepId) >= 0) {
        return '第一幕 · 林口';
      }
      if (stepId.indexOf('seek-') >= 0 || stepId.indexOf('lesson') >= 0) return '第二幕 · 山林寻骨';
      if (['chapter-4-midstream-fog', 'chapter-4-fragment-awakens', 'chapter-4-first-request'].indexOf(stepId) >= 0) {
        return '第三幕 · 星月共鸣';
      }
      if (stepId.indexOf('temple') >= 0 || stepId.indexOf('divination') >= 0) return '第四幕 · 三卜归途';
      return '尾声 · 山外护送道';
    }
    if (isCh3) {
      if (['chapter-3-opening', 'chapter-3-reach-gorge', 'chapter-3-npc-dialogue'].indexOf(stepId) >= 0) {
        return '第一幕 · 峡口';
      }
      if (stepId.indexOf('seek-') >= 0 || stepId.indexOf('lesson') >= 0) return '第二幕 · 上游寻骨';
      if (['chapter-3-midstream-flood', 'chapter-3-fragment-awakens', 'chapter-3-first-request'].indexOf(stepId) >= 0) {
        return '第三幕 · 众志共鸣';
      }
      if (stepId.indexOf('temple') >= 0 || stepId.indexOf('divination') >= 0) return '第四幕 · 三卜悬案';
      return '尾声 · 林径深处';
    }
    if (isCh2) {
      if (['chapter-2-opening', 'chapter-2-reach-river', 'chapter-2-fisher-dialogue'].indexOf(stepId) >= 0) {
        return '第一幕 · 抵达河畔';
      }
      if (stepId.indexOf('seek-') >= 0 || stepId.indexOf('lesson') >= 0) return '第二幕 · 计数寻骨';
      if (['chapter-2-midstream-tide', 'chapter-2-fragment-awakens', 'chapter-2-first-request'].indexOf(stepId) >= 0) {
        return '第三幕 · 骨纹共鸣';
      }
      if (stepId.indexOf('temple') >= 0 || stepId.indexOf('divination') >= 0) return '第四幕 · 初卜潮期';
      return '尾声 · 逆流而上';
    }
    if (['chapter-1-opening', 'chapter-1-meet-xiaoshitou', 'chapter-1-xiaoshitou-dialogue'].indexOf(stepId) >= 0) {
      return '第一幕 · 异光之地';
    }
    if (stepId.indexOf('seek-') >= 0 || stepId.indexOf('lesson') >= 0) return '第二幕 · 五字寻骨';
    if (['chapter-1-fragment-awakens', 'chapter-1-first-request'].indexOf(stepId) >= 0) return '第三幕 · 卜力苏醒';
    if (stepId.indexOf('temple') >= 0 || stepId.indexOf('divination') >= 0) return '第四幕 · 第一次问卜';
    return '尾声 · 水声掩埋之处';
  }

  private chapterTaskText(stepId: string | null, completed: boolean, chapterId: string | null) {
    const isCh2 = chapterId === CHAPTER_TWO_ID;
    const isCh3 = chapterId === CHAPTER_THREE_ID;
    const isCh4 = chapterId === CHAPTER_FOUR_ID;
    const laterMeta = chapterId ? this.chapterProgressMeta()[chapterId] : undefined;
    const isLater = chapterId === CHAPTER_FIVE_ID || chapterId === CHAPTER_SIX_ID
      || chapterId === CHAPTER_SEVEN_ID || chapterId === CHAPTER_EIGHT_ID || chapterId === CHAPTER_NINE_ID;
    if (completed) {
      if (isLater && laterMeta) {
        return { title: `${laterMeta.label}完成`, detail: `「${laterMeta.name}」的碎甲已经重新回应你。` };
      }
      if (isCh4) return { title: '第四章完成', detail: '山林的路径碎甲已经重新回应你。' };
      if (isCh3) return { title: '第三章完成', detail: '上游的水文碎甲已经重新回应你。' };
      return isCh2
        ? { title: '第二章完成', detail: '河畔的计数碎甲已经重新回应你。' }
        : { title: '第一章完成', detail: '失语的甲骨已经重新回应你，第二章尚未开启。' };
    }
    // fragment-awakens 后需集齐本章全部甲骨字才进占卜。
    if (chapterId && stepId?.endsWith('fragment-awakens')) {
      const guided = this.chapterGuidedProgress(chapterId);
      const main = this.chapterMainProgress(chapterId);
      if (guided.learned < guided.total) {
        return {
          title: '整理本章骨纹',
          detail: `已挖到 ${guided.collected}/${guided.total}，已学 ${guided.learned}/${guided.total}。继续循金色箭头挖掘并学习剩余甲骨字。`,
        };
      }
      if (main.learned < main.total) {
        const freeMissing = main.total - main.learned;
        if (freeMissing > 0) {
          return {
            title: '继续收集剩余甲骨字',
            detail: `本章甲骨字已集齐，尚有 ${freeMissing} 枚散落在附近，收集全部后方可回宗庙占卜。`,
          };
        }
      }
      return {
        title: '回宗庙完成占卜',
        detail: '本章甲骨已全部集齐并学会，返回宗庙完成占卜，即可让本章功德圆满。',
      };
    }
    const step = this.storyController?.currentStep();
    if (step?.objective) {
      return {
        title: step.objective.title,
        detail: step.objective.detail ?? '跟随地图上的剧情标记继续调查。',
      };
    }
    const dialogueTasks: Record<string, { title: string; detail: string }> = {
      'prologue-silent-heaven': { title: '观看序章：天道失语', detail: '了解通天灵龟甲崩碎、世间占卜失声的开端。' },
      'chapter-1-opening': { title: '听取贞人师的指引', detail: '得知城外异光与失落碎甲的线索。' },
      'chapter-1-xiaoshitou-dialogue': { title: '询问异光落点', detail: '与城门外的小石头交谈，确认碎甲坠落的位置。' },
      'chapter-1-fragment-awakens': { title: '聆听碎甲低语', detail: '五枚骨纹已经聚拢，听清它们传来的声音。' },
      'chapter-1-first-request': { title: '接受阿禾的求雨委托', detail: '带着苏醒的卜力前往宗庙，替村民询问雨期。' },
      'chapter-1-clue-revealed': { title: '追查西侧河畔线索', detail: '卜兆指向水声掩埋之处，新的碎甲正在等待你。' },
      'chapter-2-opening': { title: '前往西侧河畔', detail: '循第一章卜兆的水声，抵达渔村寻找新的碎甲。' },
      'chapter-2-reach-river': { title: '走近河畔渔娘', detail: '在河滩找到渔娘阿潍，听她讲计数卜骨的故事。' },
      'chapter-2-fisher-dialogue': { title: '与阿潍交谈', detail: '了解渔家记渔获、潮期的计数甲骨。' },
      'chapter-2-midstream-tide': { title: '聆听潮汐与往事', detail: '潮水起落间，阿潍说起父亲与计数卜骨。' },
      'chapter-2-fragment-awakens': { title: '排列计数骨纹', detail: '将十二字按进位序排好，让计数碎甲共鸣。' },
      'chapter-2-first-request': { title: '答应阿潍的托付', detail: '带着计数卜力前往宗庙，为渔家卜算潮期。' },
      'chapter-2-clue-revealed': { title: '追查逆流而上的线索', detail: '卜兆指向河源方向，新的碎甲正在等待你。' },
      'chapter-3-opening': { title: '前往上游峡谷', detail: '循第二章卜兆的逆流裂纹，深入上游寻找新的碎甲。' },
      'chapter-3-reach-gorge': { title: '走近守峡人', detail: '在峡口找到守峡人阿沚，听她讲镇水卜骨的故事。' },
      'chapter-3-npc-dialogue': { title: '与阿沚交谈', detail: '了解上游支族记水脉、数岔流、辨方位的旧刻。' },
      'chapter-3-midstream-flood': { title: '聆听峡洪与往事', detail: '山洪冲开峡壁古图，阿沚说起镇水骨被人卷去。' },
      'chapter-3-fragment-awakens': { title: '排列上游骨纹', detail: '将十九字按人众—数序—方位—天地日排好，让众志碎甲共鸣。' },
      'chapter-3-first-request': { title: '答应阿沚的托付', detail: '带着上游卜力前往宗庙，为阿沚卜算镇水卜骨三桩悬案。' },
      'chapter-3-clue-revealed': { title: '追查林径深处的线索', detail: '卜兆指向对岸山林，新的碎甲正在等待你。' },
      'chapter-4-opening': { title: '前往山林迷径', detail: '循第三章卜兆越过的裂纹，踏入对岸幽林寻找新的碎甲。' },
      'chapter-4-reach-forest': { title: '走近守林人', detail: '在林口找到守林人阿岚，听她讲指路卜骨与走散亲人的旧事。' },
      'chapter-4-npc-dialogue': { title: '与阿岚交谈', detail: '了解山林支族记星月、认水脉、辨亲族的老刻。' },
      'chapter-4-midstream-fog': { title: '聆听迷雾与往事', detail: '林中起雾，阿岚说起一族因迷径失散的亲人。' },
      'chapter-4-fragment-awakens': { title: '排列山林骨纹', detail: '将二十六字按夜行—水脉—亲族排好，让星月碎甲照出归途。' },
      'chapter-4-first-request': { title: '答应阿岚的托付', detail: '带着山林卜力前往宗庙，为走散的亲人卜算归途。' },
      'chapter-4-clue-revealed': { title: '追查山外护送道', detail: '卜兆指向山外热闹的护送道，新的碎甲正在等待你。' },
    };
    return dialogueTasks[stepId ?? ''] ?? {
      title: '继续当前剧情',
      detail: '完成眼前的对话或互动，解锁下一段章节目标。',
    };
  }

  // 九章进度面板元数据（definition / 字表 / 标签 / 章名）：集中一处，加章只改这里。
  private chapterProgressMeta(): Record<string, {
    def: typeof chapterOneDefinition;
    cards: ReadonlyArray<{ cardId: string; character: string }>;
    label: string; name: string;
  }> {
    return {
      [CHAPTER_ONE_ID]: { def: chapterOneDefinition, cards: CHAPTER_ONE_FRAGMENT_CARDS, label: '第一章', name: '失语的甲骨' },
      [CHAPTER_TWO_ID]: { def: chapterTwoDefinition, cards: CHAPTER_TWO_FRAGMENT_CARDS, label: '第二章', name: '河畔初兆' },
      [CHAPTER_THREE_ID]: { def: chapterThreeDefinition, cards: CHAPTER_THREE_FRAGMENT_CARDS, label: '第三章', name: '逆流寻踪' },
      [CHAPTER_FOUR_ID]: { def: chapterFourDefinition, cards: CHAPTER_FOUR_FRAGMENT_CARDS, label: '第四章', name: '山林迷径' },
      [CHAPTER_FIVE_ID]: { def: chapterFiveDefinition, cards: CHAPTER_FIVE_FRAGMENT_CARDS, label: '第五章', name: '护送归途' },
      [CHAPTER_SIX_ID]: { def: chapterSixDefinition, cards: CHAPTER_SIX_FRAGMENT_CARDS, label: '第六章', name: '古墟残灯' },
      [CHAPTER_SEVEN_ID]: { def: chapterSevenDefinition, cards: CHAPTER_SEVEN_FRAGMENT_CARDS, label: '第七章', name: '错册余火' },
      [CHAPTER_EIGHT_ID]: { def: chapterEightDefinition, cards: CHAPTER_EIGHT_FRAGMENT_CARDS, label: '第八章', name: '王陵三证' },
      [CHAPTER_NINE_ID]: { def: chapterNineDefinition, cards: CHAPTER_NINE_FRAGMENT_CARDS, label: '第九章', name: '重续通天之契' },
    };
  }

  private buildChapterProgressUi() {
    this.destroyOverlayRoot();
    const root = new Node('ChapterProgressOverlay');
    root.parent = this.node;
    root.setPosition(0, 0, 400);
    root.addComponent(UITransform).setContentSize(1280, 720);
    this.overlayRoot = root;

    this.drawWoodPanel(root, 'ChapterProgressPanel', 0, 0, 920, 600, 0, false);
    this.drawUiButton(root, 'ChapterProgressCloseButton', '关闭', 392, 258, 104, 44, false);

    const snapshot = this.storyController?.snapshot();
    const currentChapterId = snapshot?.currentChapterId
      ?? snapshot?.completedChapterIds[snapshot.completedChapterIds.length - 1]
      ?? CHAPTER_ONE_ID;
    const chapterMeta = this.chapterProgressMeta();
    const meta = chapterMeta[currentChapterId] ?? chapterMeta[CHAPTER_ONE_ID];
    const activeDef = meta.def;
    const plannedCards = CHAPTER_CHAR_PLANS.find(plan => plan.chapterId === currentChapterId)?.chars
      .map(item => ({ cardId: planCardId(item), character: item.char }));
    // Use the 250-word collection plan as the authoritative list. The older
    // story definitions remain only for dialogue sequencing.
    const activeCards = plannedCards?.length ? plannedCards : meta.cards;
    this.createUiLabel(root, 'ChapterProgressTitle',
      `${meta.label} · ${meta.name}`,
      0, 252, 680, 48, 29, new Color(255, 224, 148));

    const completed = (snapshot?.completedChapterIds.indexOf(currentChapterId) ?? -1) >= 0;
    const stepId = snapshot?.currentStepId ?? null;
    // 章节进度按「本章全部主线字」计算：必须全部学会才能进占卜，
    // 因此进度条以已学字数为主，剧情推进为辅。
    const guided = this.chapterGuidedProgress(currentChapterId);
    const collection = this.chapterMainProgress(currentChapterId);
    const storyRatio = this.storyController?.currentStepProgress(currentChapterId) ?? 0;
    const mainRatio = collection.learned / Math.max(1, collection.total);
    const chapterPercent = completed
      ? 100
      : Math.min(90, Math.round(mainRatio * 70 + storyRatio * 20));

    // Keep every chapter-act title inside the 920 px panel: the label's left
    // edge is inset 36 px from the panel edge, regardless of its text length.
    const chapterStageLeft = -424;
    const chapterStageWidth = 400;
    this.createUiLabel(root, 'ChapterStage', this.chapterStageName(stepId, completed, currentChapterId),
      chapterStageLeft + chapterStageWidth / 2, 187, chapterStageWidth, 40, 22, new Color(250, 211, 125), 'left');
    this.createUiLabel(root, 'ChapterPercent', `章节进度 ${chapterPercent}%`,
      318, 187, 180, 36, 18, new Color(242, 216, 163));
    const progressBack = this.localGraphics('ChapterProgressBack', root, 0, 152, 730, 22, 3);
    progressBack.fillColor = new Color(48, 37, 31, 230); progressBack.roundRect(-365, -9, 730, 18, 9); progressBack.fill();
    const progressWidth = Math.max(10, 718 * chapterPercent / 100);
    const progressFill = this.localGraphics('ChapterProgressFill', root, -359 + progressWidth / 2, 152, progressWidth, 18, 4);
    progressFill.fillColor = new Color(211, 151, 65); progressFill.roundRect(-progressWidth / 2, -6, progressWidth, 12, 6); progressFill.fill();

    const task = this.chapterTaskText(stepId, completed, currentChapterId);
    this.drawWoodPanel(root, 'ChapterTaskPanel', 0, 68, 770, 126, 2, true);
    this.createUiLabel(root, 'ChapterTaskCaption', '当前任务', -300, 108, 140, 26, 15, new Color(119, 67, 37), 'left', 5);
    const taskTitleLabel = this.createUiLabel(root, 'ChapterTaskTitle', task.title, -10, 77, 660, 36, 20, new Color(84, 45, 28), 'left', 5);
    taskTitleLabel.overflow = Label.Overflow.CLAMP;
    taskTitleLabel.enableWrapText = false;
    this.createUiLabel(root, 'ChapterTaskDetail', task.detail, 0, 34, 690, 48, 16, new Color(96, 58, 38), 'left', 5);

    this.createUiLabel(root, 'ChapterGlyphCaption', '本章碎甲文字（上下滑动查看）', -280, -20, 330, 30, 17, new Color(245, 211, 145), 'left');
    this.buildChapterGlyphScrollView(root, activeCards);

    // 全盘收集：主线甲骨(250) + 甲骨拾遗(50) 合计已挖 / 总数，独立于当前章节。
    const excavatedCards = this.save.excavatedCardIds ?? [];
    const storyCollected = [...STORY_CARD_IDS].filter(id => excavatedCards.includes(id)).length;
    const supplementCollected = [...SUPPLEMENT_CARD_IDS].filter(id => excavatedCards.includes(id)).length;
    const storyTotal = STORY_CARD_IDS.size;
    const supplementTotal = SUPPLEMENT_CARD_IDS.size;
    const allCollected = storyCollected + supplementCollected;
    const allTotal = storyTotal + supplementTotal;
    const summaryLabel = this.createUiLabel(root, 'ChapterCollectionSummary',
      `本章字 已挖${collection.collected}/${collection.total}·已学${collection.learned}/${collection.total}`,
      0, -234, 760, 34, 16, new Color(247, 217, 154));
    summaryLabel.overflow = Label.Overflow.SHRINK;
    summaryLabel.enableWrapText = false;
    this.createUiLabel(root, 'ChapterProgressHint', `本章全部 ${collection.total} 个甲骨字由金色箭头带路，集齐并学会后方可回宗庙占卜。`,
      0, -256, 760, 22, 13, new Color(207, 186, 148));
    const globalLabel = this.createUiLabel(root, 'ChapterGlobalCollection',
      `全盘甲骨收集 已挖${allCollected}/${allTotal}　主线 ${storyCollected}/${storyTotal} · 拾遗 ${supplementCollected}/${supplementTotal}`,
      0, -278, 760, 24, 15, new Color(255, 232, 165));
    globalLabel.overflow = Label.Overflow.SHRINK;
    globalLabel.enableWrapText = false;
  }

  // 统一章节进度面板：甲骨文字网格，支持拖拽/滚轮上下滑动，字不出框
  private buildChapterGlyphScrollView(
    root: Node,
    cards: ReadonlyArray<{ cardId: string; character: string }>,
  ) {
    const perRow = 5;
    const rows = Math.ceil(cards.length / perRow);
    const cell = 94;
    const colGap = 168;
    const rowGap = 112;
    const viewW = 860;
    // 只完整展示一排卡牌；其余内容在蒙版内滚动，避免第二排与底部统计栏重叠。
    const viewH = 150;
    const viewCenterY = -130;
    const contentH = Math.max(viewH, rows * rowGap + 18);
    const maxScroll = Math.max(0, (contentH - viewH) / 2);

    const glyphViewport = new Node('ChapterGlyphScroll');
    glyphViewport.parent = root;
    glyphViewport.setPosition(0, viewCenterY, 2);
    glyphViewport.addComponent(UITransform).setContentSize(viewW, viewH);
    glyphViewport.addComponent(BlockInputEvents);
    const glyphMask = glyphViewport.addComponent(Mask);
    glyphMask.type = Mask.Type.GRAPHICS_RECT;

    const glyphContent = new Node('ChapterGlyphContent');
    glyphContent.parent = glyphViewport;
    glyphContent.addComponent(UITransform).setContentSize(viewW, contentH);
    glyphContent.setPosition(0, -maxScroll, 0);

    cards.forEach((fragment, index) => {
      const col = index % perRow;
      const row = Math.floor(index / perRow);
      const x = (col - (perRow - 1) / 2) * colGap;
      const y = contentH / 2 - rowGap / 2 - row * rowGap;
      const card = this.oracleCards.find(item => item.id === fragment.cardId && this.hasRealOracleGlyph(item));
      const unlocked = Boolean(card && this.save.unlockedOracleIds.indexOf(fragment.cardId) >= 0);
      const plate = this.localGraphics(`ChapterGlyphPlate-${fragment.cardId}`, glyphContent, x, y, cell, cell, 4);
      plate.fillColor = unlocked ? new Color(223, 195, 137) : new Color(65, 54, 47);
      plate.roundRect(-cell / 2, -cell / 2, cell, cell, 10); plate.fill();
      plate.strokeColor = unlocked ? new Color(238, 176, 71) : new Color(117, 94, 70);
      plate.lineWidth = 3; plate.roundRect(-cell / 2, -cell / 2, cell, cell, 10); plate.stroke();
      if (unlocked && card) {
        this.createOracleGlyphVisual(`ChapterGlyph-${fragment.cardId}`, glyphContent, card, x, y + 12, 36, 42, 5);
      } else {
        const charLabel = this.createUiLabel(glyphContent, `ChapterGlyph-${fragment.cardId}`, '？',
          x, y + 12, 86, 52, 34, new Color(157, 137, 108));
        charLabel.overflow = Label.Overflow.CLAMP;
        charLabel.enableWrapText = false;
      }
      const stateLabel = this.createUiLabel(glyphContent, `ChapterGlyphState-${fragment.cardId}`, unlocked ? '已唤醒' : '未发现',
        x, y - 27, 82, 18, 12, unlocked ? new Color(255, 221, 135) : new Color(169, 151, 124));
      stateLabel.overflow = Label.Overflow.CLAMP;
      stateLabel.enableWrapText = false;
    });

    let glyphDragging = false;
    let glyphDragStart = 0;
    let glyphDragContentY = 0;
    glyphViewport.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
      glyphDragging = true; glyphDragStart = e.getLocationY(); glyphDragContentY = glyphContent.getPosition().y;
    });
    glyphViewport.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
      if (!glyphDragging) return;
      const ny = this.clamp(glyphDragContentY + (e.getLocationY() - glyphDragStart), -maxScroll, maxScroll);
      glyphContent.setPosition(0, ny, 0);
    });
    glyphViewport.on(Node.EventType.TOUCH_END, () => { glyphDragging = false; });
    glyphViewport.on(Node.EventType.TOUCH_CANCEL, () => { glyphDragging = false; });
    glyphViewport.on(Node.EventType.MOUSE_WHEEL, (e: any) => {
      const delta = (e.getScrollY?.() ?? 0);
      const ny = this.clamp(glyphContent.getPosition().y - delta * 0.4, -maxScroll, maxScroll);
      glyphContent.setPosition(0, ny, 0);
    });
  }

  private buildBackpackUi() {
    this.destroyOverlayRoot();
    const root = new Node('BackpackOverlay');
    root.parent = this.node;
    root.setPosition(0, 0, 400);
    root.addComponent(UITransform).setContentSize(1280, 720);
    this.overlayRoot = root;
    // The panel intentionally leaves the world visible around all four sides.
    this.drawWoodPanel(root, 'BackpackMainPanel', 0, 0, 1020, 570, 0, false);
    const inner = this.localGraphics('BackpackInnerClay', root, 0, -22, 960, 430, 1);
    inner.fillColor = new Color(63, 45, 36, 244); inner.roundRect(-480, -215, 960, 430, 10); inner.fill();
    inner.strokeColor = new Color(164, 111, 63); inner.lineWidth = 3; inner.roundRect(-476, -211, 952, 422, 8); inner.stroke();
    this.createUiLabel(root, 'BackpackTitle', '行 囊', 0, 242, 420, 44, 29, new Color(255, 224, 148));
    this.createUiLabel(root, 'BackpackLiveHint', '打开期间村民、天气与时间继续运行', -335, -256, 520, 28, 14, new Color(210, 184, 139), 'left');
    this.drawUiButton(root, 'BackpackCloseButton', '关闭', 443, 240, 104, 44, false);

    const tabs: Array<{ id: BackpackTab; text: string; x: number }> = [
      { id: 'tools', text: '工具栏', x: -170 },
      { id: 'codex', text: '甲骨图鉴', x: 170 },
    ];
    tabs.forEach(tab => this.drawUiButton(root, `BackpackTab-${tab.id}`, tab.text, tab.x, 186, 300, 50, this.backpackTab === tab.id));

    if (this.backpackTab === 'tools') {
      const tools: Array<{ id: ToolKind; name: string; note: string; asset?: string; x: number }> = [
        { id: 'none', name: '空手', note: '收起当前工具', x: -350 },
        { id: 'shovel', name: '小铲子', note: '野外挖坑 · 15秒复原', asset: 'tool-shovel-v1', x: -118 },
      ];
      tools.forEach(tool => {
        const selected = this.equippedTool === tool.id;
        const tile = this.localGraphics(`ToolSlot-${tool.id}`, root, tool.x, -28, 205, 292, 4);
        tile.fillColor = selected ? new Color(165, 112, 55) : new Color(94, 64, 45);
        tile.roundRect(-98, -140, 196, 280, 10); tile.fill();
        tile.strokeColor = selected ? new Color(255, 213, 111) : new Color(191, 139, 75);
        tile.lineWidth = selected ? 5 : 3; tile.roundRect(-98, -140, 196, 280, 10); tile.stroke();
        const socket = this.localGraphics(`ToolSocket-${tool.id}`, root, tool.x, 24, 126, 142, 6);
        socket.fillColor = new Color(46, 39, 36, 225); socket.roundRect(-59, -67, 118, 134, 12); socket.fill();
        socket.strokeColor = new Color(118, 87, 58); socket.lineWidth = 3; socket.roundRect(-59, -67, 118, 134, 12); socket.stroke();
        if (tool.asset) {
          const iconSize = tool.id === 'shovel' ? [64, 92] : [58, 94];
          this.pixelSprite(`BackpackToolIcon-${tool.id}`, tool.asset, root, tool.x, 25, iconSize[0], iconSize[1], 8);
        } else {
          const hand = this.localGraphics('EmptyHandIcon', root, tool.x, 24, 90, 104, 8);
          hand.fillColor = new Color(217, 164, 99);
          hand.roundRect(-19, -30, 38, 58, 12); hand.rect(-29, 2, 12, 30); hand.rect(-13, 19, 10, 32); hand.rect(2, 21, 10, 30); hand.rect(17, 15, 10, 28); hand.fill();
          hand.strokeColor = new Color(93, 56, 39); hand.lineWidth = 3; hand.roundRect(-19, -30, 38, 58, 12); hand.stroke();
        }
        this.createUiLabel(root, `ToolName-${tool.id}`, tool.name, tool.x, -73, 170, 36, 22, new Color(255, 226, 164));
        this.createUiLabel(root, `ToolNote-${tool.id}`, tool.note, tool.x, -112, 172, 48, 14, new Color(215, 190, 145));
        if (selected) this.createUiLabel(root, `ToolEquipped-${tool.id}`, '已装备', tool.x, -146, 120, 28, 16, new Color(255, 221, 111));
      });
      this.createUiLabel(root, 'ToolUseHint', '选中工具后，地图右侧会出现对应工具按钮；再次选择“空手”即可收起。', 0, -212, 830, 34, 16, new Color(235, 207, 157));
      return;
    }

    const unlocked = this.oracleCards.filter(card => this.save.unlockedOracleIds.includes(card.id) && this.hasRealOracleGlyph(card));
    const codexPageCount = Math.max(1, Math.ceil(unlocked.length / 12));
    this.codexPage = this.clamp(this.codexPage, 0, codexPageCount - 1);
    const codexPageStart = this.codexPage * 12;
    const pageCards = unlocked.slice(codexPageStart, codexPageStart + 12);
    for (let index = 0; index < 12; index++) {
      const column = index % 3; const row = Math.floor(index / 3);
      const cardX = -385 + column * 118; const cardY = 105 - row * 92;
      const card = pageCards[index]; const selected = !!card && codexPageStart + index === this.selectedBackpackIndex;
      const tile = this.localGraphics(`CodexSlot-${index}`, root, cardX, cardY, 102, 80, 4);
      tile.fillColor = card
        ? (selected ? new Color(123, 82, 49) : new Color(91, 63, 46))
        : new Color(42, 39, 38);
      tile.roundRect(-48, -37, 96, 74, 8); tile.fill();
      tile.strokeColor = card ? this.qualityColor(card.quality) : new Color(82, 75, 69);
      tile.lineWidth = selected ? 5 : 2; tile.roundRect(-48, -37, 96, 74, 8); tile.stroke();
      if (card) {
        const plate = this.localGraphics(`CodexGlyphPlate-${index}`, root, cardX, cardY + 8, 62, 46, 5);
        plate.fillColor = new Color(229, 204, 153); plate.roundRect(-29, -21, 58, 42, 5); plate.fill();
        plate.strokeColor = new Color(139, 91, 51); plate.lineWidth = 2; plate.roundRect(-29, -21, 58, 42, 5); plate.stroke();
        this.createOracleGlyphVisual(`CodexGlyph-${index}`, root, card, cardX, cardY + 8, 34, 30, 6, new Color(70, 41, 28));
      } else this.createUiLabel(root, `CodexGlyph-${index}`, '尚未发现', cardX, cardY + 7, 74, 48, 13, new Color(104, 97, 91));
      this.createUiLabel(root, `CodexState-${index}`, card?.modern ?? '尚未发现', cardX, cardY - 24, 88, 22, 12,
        card ? new Color(244, 211, 153) : new Color(104, 97, 91));
    }
    this.createUiLabel(root, 'CodexPageLabel', `第 ${this.codexPage + 1} / ${codexPageCount} 页`, -270, -258, 170, 28, 14, new Color(218, 191, 145));
    if (this.codexPage > 0) this.drawUiButton(root, 'CodexPreviousPage', '上一页', -410, -258, 105, 42, false);
    if (this.codexPage < codexPageCount - 1) this.drawUiButton(root, 'CodexNextPage', '下一页', -130, -258, 105, 42, false);
    this.drawWoodPanel(root, 'BackpackDetailPanel', 205, -20, 490, 350, 3, true);
    this.backpackDetailLabel = this.createUiLabel(root, 'BackpackDetailText', '', 205, -20, 430, 310, 18, new Color(76, 44, 29), 'left', 5);
    this.updateBackpackDetail();
  }

  private updateBackpackDetail() {
    if (!this.backpackDetailLabel?.isValid) return;
    const unlocked = this.oracleCards.filter(card => this.save.unlockedOracleIds.includes(card.id) && this.hasRealOracleGlyph(card));
    const card = unlocked[this.selectedBackpackIndex];
    if (!card) {
      this.backpackDetailLabel.string = '尚未收录甲骨文字。请前往野外寻找发光点位。';
      return;
    }
    const record = this.save.mastery[card.id] ?? { attempts: 0, bestStars: 0, correctCount: 0 };
    const quality = card.quality === 'blue' ? '蓝光·平民普通卜骨' : card.quality === 'red' ? '红光·贵族涂朱卜甲' : '金光·王室传世龟甲';
    const stars = '★'.repeat(record.bestStars) + '☆'.repeat(3 - record.bestStars);
    this.backpackDetailLabel.string = `${card.modern}  ${card.pinyin}\n${quality}\n\n字义与象形：\n${card.meaning}\n\n字形演变：\n${this.learningEvolution(card)}\n\n商代历史：\n${card.history}\n\n学习记录：${stars}  ·  正确占卜 ${record.correctCount} 次`;
  }

  private showShopConfirmation() {
    if (this.overlay !== 'none') return;
    this.stopPlayerInput();
    this.overlay = 'shopConfirm';
    this.destroyOverlayRoot();
    const root = new Node('ShopEntryConfirmation');
    root.parent = this.node;
    root.setPosition(0, 0, 400);
    root.addComponent(UITransform).setContentSize(1280, 720);
    this.overlayRoot = root;
    this.drawWoodPanel(root, 'ShopConfirmPanel', 0, 20, 600, 280, 0, true);
    this.createUiLabel(root, 'ShopConfirmTitle', '商代集市', 0, 92, 470, 50, 29, new Color(91, 47, 29));
    this.createUiLabel(root, 'ShopConfirmText', '是否进入商店查看龟甲外观？', 0, 32, 490, 72, 20, new Color(93, 57, 37));
    this.drawUiButton(root, 'ShopCancelButton', '暂不进入', -125, -65, 180, 58, false);
    this.drawUiButton(root, 'ShopEnterButton', '进入商店', 125, -65, 180, 58, true);
  }

  private openShop() {
    this.overlay = 'shop';
    this.selectedShopProductIndex = 0;
    this.buildShopUi();
  }

  private buildShopUi(feedback = '') {
    this.destroyOverlayRoot();
    const root = new Node('OracleStyleShopOverlay');
    root.parent = this.node;
    root.setPosition(0, 0, 400);
    root.addComponent(UITransform).setContentSize(1280, 720);
    this.overlayRoot = root;
    this.drawWoodPanel(root, 'ShopMainPanel', 0, 0, 1160, 650, 0, false);
    this.createUiLabel(root, 'ShopTitle', '商代集市 · 甲骨藏珍', 0, 292, 630, 52, 28, new Color(255, 224, 147));
    this.createUiLabel(root, 'ShopCurrency', `贝币 ${this.save.coins}`, -440, 292, 200, 44, 20, new Color(242, 204, 114));
    this.drawUiButton(root, 'ShopCloseButton', '离开', 510, 292, 112, 48, false);

    const categoryY = 0;
    const tab = this.localGraphics('ShopCategory-shell', root, -470, categoryY, 170, 66, 3);
    tab.fillColor = new Color(165, 74, 49);
      tab.roundRect(-82, -30, 164, 60, 9); tab.fill();
    tab.strokeColor = new Color(244, 199, 104); tab.lineWidth = 3; tab.roundRect(-82, -30, 164, 60, 9); tab.stroke();
    this.createUiLabel(root, 'ShopCategoryLabel-shell', '龟甲外观', -470, categoryY, 150, 44, 19, new Color(255, 234, 182));

    const products = this.shopProducts;
    this.selectedShopProductIndex = this.clamp(this.selectedShopProductIndex, 0, Math.max(0, products.length - 1));
    products.forEach((product, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = -250 + col * 215;
      const y = 170 - row * 150;
      this.drawShopProductTile(root, product, index, x, y, index === this.selectedShopProductIndex);
    });

    const selected = products[this.selectedShopProductIndex];
    this.drawWoodPanel(root, 'ShopDetailPanel', 340, -20, 360, 480, 2, true);
    if (selected) {
      this.drawShopProductIcon(root, selected, 340, 135, 1.25);
      this.createUiLabel(root, 'ShopProductTitle', selected.name, 340, 35, 300, 52, 25, new Color(86, 44, 28));
      this.createUiLabel(root, 'ShopProductDescription', selected.description, 340, -45, 292, 100, 18, new Color(92, 57, 38), 'left');
      const owned = this.save.ownedProductIds.includes(selected.id);
      const equipped = this.save.equippedShellId === selected.id;
      const buttonText = equipped ? '使用中' : owned ? '装备' : `购买 · ${selected.price} 贝币`;
      this.drawUiButton(root, 'ShopPurchaseButton', buttonText, 340, -178, 250, 58, !owned || !equipped);
    }
    this.shopFeedback = this.createUiLabel(root, 'ShopFeedback', feedback, 340, -245, 320, 58, 16, new Color(255, 221, 157), 'center', 5);
  }

  private drawShopProductTile(root: Node, product: ShopProduct, index: number, x: number, y: number, selected: boolean) {
    const tile = this.localGraphics(`ShopProduct-${index}`, root, x, y, 190, 130, 3);
    tile.fillColor = selected ? new Color(216, 170, 96) : new Color(117, 76, 48);
    tile.roundRect(-92, -61, 184, 122, 11); tile.fill();
    tile.strokeColor = selected ? this.qualityColor(product.quality) : new Color(80, 52, 38); tile.lineWidth = selected ? 6 : 3; tile.roundRect(-92, -61, 184, 122, 11); tile.stroke();
    this.drawShopProductIcon(root, product, x - 48, y + 10, .55);
    this.createUiLabel(root, `ShopProductName-${index}`, product.name, x + 31, y + 18, 100, 44, 15, selected ? new Color(76, 43, 28) : new Color(255, 226, 170));
    const owned = this.save.ownedProductIds.includes(product.id);
    this.createUiLabel(root, `ShopProductPrice-${index}`, owned ? '已拥有' : `${product.price} 贝币`, x + 31, y - 31, 100, 28, 14, owned ? new Color(88, 115, 65) : new Color(234, 184, 86));
  }

  private drawShopProductIcon(parent: Node, product: ShopProduct, x: number, y: number, scale: number) {
    const holder = new Node(`ShopIcon-${product.id}-${x}-${y}`);
    holder.parent = parent;
    holder.setPosition(x, y, 5);
    holder.addComponent(UITransform).setContentSize(100 * scale, 110 * scale);
    const g = holder.addComponent(Graphics);
    g.fillColor = product.id === 'shell-gold' ? new Color(225, 179, 74) : product.id === 'shell-vermilion' ? new Color(181, 75, 53) : new Color(213, 179, 116);
    g.ellipse(0, 0, 35 * scale, 45 * scale); g.fill();
    g.strokeColor = new Color(78, 48, 33); g.lineWidth = 4 * scale; g.ellipse(0, 0, 35 * scale, 45 * scale); g.stroke();
    g.moveTo(-3 * scale, 30 * scale); g.lineTo(4 * scale, 9 * scale); g.lineTo(-8 * scale, -10 * scale); g.lineTo(7 * scale, -34 * scale); g.stroke();
  }

  private purchaseSelectedShopProduct() {
    if (this.overlay !== 'shop') return;
    const products = this.shopProducts;
    const product = products[this.selectedShopProductIndex];
    if (!product) return;
    const owned = this.save.ownedProductIds.includes(product.id);
    if (owned) {
      if (this.save.equippedShellId !== product.id) {
        this.save.equippedShellId = product.id;
        this.persistCitySave();
        this.buildShopUi(`已装备：${product.name}`);
      }
      return;
    }
    if (this.save.coins < product.price) {
      this.buildShopUi(`贝币不足，还需要 ${product.price - this.save.coins} 贝币。`);
      return;
    }
    this.save.coins -= product.price;
    this.save.ownedProductIds.push(product.id);
    this.save.equippedShellId = product.id;
    this.persistCitySave();
    this.buildShopUi(`已获得：${product.name}`);
  }

  private closeCityOverlay() {
    if (this.overlay === 'divination') return;
    if (this.overlay === 'excavationLearning') {
      if (this.excavationLearningStage === 'detail') this.finishExcavationLearning();
      else this.deferExcavationLearning();
      return;
    }
    const wasChapterProgress = this.overlay === 'chapterProgress';
    this.overlay = 'none';
    this.destroyOverlayRoot();
    if (wasChapterProgress) this.questGuide.setVisible(true);
  }

  private drawHud() {
    const topBg = this.graphics('TopHudBackground', this.node, 200); topBg.fillColor = new Color(42, 35, 31, 210); topBg.roundRect(-330, -34, 660, 68, 16); topBg.fill(); topBg.node.setPosition(0, 309, 200);
    this.region = this.screenLabel('殷墟城 · 南城门内', 0, 319, 22, new Color(255, 218, 132));
    this.status = this.screenLabel('', 0, 292, 14, new Color(255, 245, 218));

    const weatherPanel = this.localGraphics('WeatherHudPanel', this.node, 500, 309, 210, 72, 210);
    weatherPanel.fillColor = new Color(38, 47, 52, 226); weatherPanel.roundRect(-100, -34, 200, 68, 14); weatherPanel.fill();
    weatherPanel.strokeColor = new Color(218, 203, 157, 155); weatherPanel.lineWidth = 2; weatherPanel.roundRect(-100, -34, 200, 68, 14); weatherPanel.stroke();
    const weatherIconNode = new Node('WeatherHudIcon'); weatherIconNode.parent = this.node; weatherIconNode.setPosition(435, 312, 214); weatherIconNode.addComponent(UITransform).setContentSize(52, 52); this.weatherIcon = weatherIconNode.addComponent(Graphics);
    this.weatherLabel = this.screenSmallLabel('晴', 510, 319, 19, new Color(246, 235, 199), 115, 28, 214);
    this.weatherTimerLabel = this.screenSmallLabel('', 510, 296, 11, new Color(203, 218, 215), 140, 24, 214);
    this.drawWeatherIcon();

    const currencyPanel = this.localGraphics('LearningCurrencyPanel', this.node, -480, 309, 260, 72, 210);
    currencyPanel.fillColor = new Color(70, 48, 35, 232); currencyPanel.roundRect(-125, -34, 250, 68, 14); currencyPanel.fill();
    currencyPanel.strokeColor = new Color(224, 184, 98, 175); currencyPanel.lineWidth = 2; currencyPanel.roundRect(-125, -34, 250, 68, 14); currencyPanel.stroke();
    this.currencyLabel = this.screenSmallLabel('', -480, 309, 14, new Color(251, 224, 158), 228, 48, 214);

    const base = this.graphics('JoystickBase', this.node, 200); base.fillColor = new Color(45, 57, 64, 150); base.circle(0, 0, 72); base.fill(); base.strokeColor = new Color(255, 239, 197, 170); base.lineWidth = 3; base.circle(0, 0, 72); base.stroke(); base.node.setPosition(-500, -230, 200);
    this.joystickKnob = new Node('JoystickKnob'); this.joystickKnob.parent = this.node; this.joystickKnob.setPosition(-500, -230, 202); this.joystickKnob.addComponent(UITransform).setContentSize(72, 72);
    const knob = this.joystickKnob.addComponent(Graphics); knob.fillColor = new Color(221, 184, 112, 210); knob.circle(0, 0, 34); knob.fill();

    const backpack = this.graphics('BackpackButton', this.node, 200); backpack.fillColor = new Color(84, 67, 48, 225); backpack.circle(0, 0, 44); backpack.fill(); backpack.strokeColor = new Color(229, 192, 111); backpack.lineWidth = 4; backpack.circle(0, 0, 44); backpack.stroke(); backpack.node.setPosition(380, -230, 200);
    this.pixelSprite('BackpackButtonPixelIcon', 'backpack-icon-v1', this.node, 380, -222, 42, 49, 204);
    this.screenSmallLabel('背包', 380, -264, 13, new Color(255, 239, 202), 80, 24, 205);

    const chapter = this.graphics('ChapterProgressButton', this.node, 200);
    chapter.fillColor = new Color(91, 62, 43, 230); chapter.circle(0, 0, 44); chapter.fill();
    chapter.strokeColor = new Color(229, 192, 111); chapter.lineWidth = 4; chapter.circle(0, 0, 44); chapter.stroke();
    chapter.fillColor = new Color(225, 194, 130);
    chapter.roundRect(-23, -24, 46, 48, 5); chapter.fill();
    chapter.strokeColor = new Color(104, 65, 39); chapter.lineWidth = 3; chapter.roundRect(-23, -24, 46, 48, 5); chapter.stroke();
    chapter.moveTo(-13, 9); chapter.lineTo(13, 9); chapter.moveTo(-13, -1); chapter.lineTo(13, -1); chapter.moveTo(-13, -11); chapter.lineTo(7, -11); chapter.stroke();
    chapter.node.setPosition(260, -230, 200);
    this.screenSmallLabel('章节', 260, -264, 13, new Color(255, 239, 202), 80, 24, 205);

    const action = this.graphics('ActionButton', this.node, 200); action.fillColor = new Color(151, 61, 47, 220); action.circle(0, 0, 52); action.fill(); action.strokeColor = new Color(255, 222, 147); action.lineWidth = 4; action.circle(0, 0, 52); action.stroke(); action.node.setPosition(500, -230, 200);
    this.actionButtonNode = action.node;
    this.actionLabel = this.screenLabel('', 500, -230, 18, new Color(255, 245, 216));
    this.actionToolIconNode = new Node('DynamicToolActionIcon');
    this.actionToolIconNode.parent = this.node;
    this.actionToolIconNode.setPosition(500, -230, 204);
    this.actionToolIconNode.addComponent(UITransform).setContentSize(56, 62);
    const actionToolSprite = this.actionToolIconNode.addComponent(Sprite);
    actionToolSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.actionToolIconNode.active = false;
  }

  private updateHud() {
    const x = this.playerPos.x; const y = this.playerPos.y;
    let zone = '城外交通道';
    if (this.worldMode === 'templeInterior') {
      zone = '占卜宗庙 · 贞人卜室';
    } else if (y > -240 && y < 1450 && Math.abs(x) < 1300) {
      zone = '殷墟城内';
      if (y > (1010 + this.templeMoveDeltaY) && Math.abs(x) < 260) zone = '占卜宗庙';
      else if (x > 690 && y > 500) zone = '商代集市';
      else if (x > 175 && x < 375 && y > 510 && y < 730) zone = '村落水井';
    }
    else if (this.inRegion(x, y, this.tombRegion)) zone = '甲骨窑穴·王陵祭祀区';
    else if (this.inRegion(x, y, this.forestRegion)) zone = '山林迷径';
    else if (this.inRegion(x, y, this.mountainRegion)) zone = '山林高地';
    else if (this.inRegion(x, y, this.fieldRegion)) zone = '郊外田野';
    else if (this.inRegion(x, y, this.lakeRegion)) zone = '洹水湖湾';
    else if (this.inRegion(x, y, this.riverRegion)) zone = '洹水河畔';
    // Trial regions use explicit transition state rather than waiting for a
    // coordinate-based HUD pass after teleporting.
    if (this.worldMode === 'outside' && this.regionTransitionManager?.currentRegionId === RegionId.CITY) {
      zone = '殷墟城';
    }
    else if (this.worldMode === 'outside' && this.regionTransitionManager?.currentRegionId === RegionId.OUTSKIRTS) zone = '城外';
    else if (this.worldMode === 'outside' && this.regionTransitionManager?.currentRegionId === RegionId.RIVERBANK) zone = '洹水河畔';
    else if (this.worldMode === 'outside' && this.regionTransitionManager?.currentRegionId === RegionId.HIGHLAND) zone = '山林高地';
    this.region.string = zone;
    this.actionKind = 'none';
    if (this.overlay === 'none' && !this.seated) {
      if (this.worldMode === 'templeInterior') {
        if (Math.hypot(x, y + 265) <= 76) this.actionKind = 'templeExit';
        else if (Math.hypot(x - this.templeSeatPoint.x, y - this.templeSeatPoint.y) <= 76) this.actionKind = 'templeSeat';
      } else if (Math.hypot(x, y - (1010 + this.templeMoveDeltaY)) <= 105) this.actionKind = 'temple';
      else if (Math.hypot(x - 1030, y - 510) <= 150) this.actionKind = 'shop';
    }
    if (this.actionLabel?.isValid) {
      this.actionLabel.string = this.actionKind === 'temple' ? '进入'
        : this.actionKind === 'templeSeat' ? '坐下'
          : this.actionKind === 'templeExit' ? '离开'
            : this.actionKind === 'shop' ? '进入' : '';
      const contextAction = this.actionKind !== 'none';
      const toolAction = !contextAction && this.equippedTool !== 'none';
      if (this.actionButtonNode?.isValid) this.actionButtonNode.active = contextAction || toolAction;
      this.actionLabel.node.active = contextAction;
      if (this.actionToolIconNode?.isValid) this.actionToolIconNode.active = toolAction;
    }
    if (this.overlay === 'none') {
      const interactionHint = this.actionKind === 'temple'
        ? '点击“进入”直接进入宗庙内殿'
        : this.actionKind === 'templeSeat' ? '点击“坐下”开始接待一位求卜村民'
          : this.actionKind === 'templeExit' ? '点击“离开”返回宗庙前庭'
            : this.actionKind === 'shop' ? '点击“进入”打开商代集市' : '';
      this.status.string = this.statusNoticeTimer > 0
        ? this.statusNotice
        : interactionHint || (this.blocked ? '前方不可通行 · 寻找城门或绕开障碍' : `摇杆 · 坐标 ${Math.round(x)}, ${Math.round(y)}`);
    }
  }

  private performWorldAction() {
    if (this.overlay !== 'none' || this.regionInputLocked) return;
    if (this.actionKind === 'temple') this.enterTempleInterior();
    else if (this.actionKind === 'templeSeat') this.beginDivination();
    else if (this.actionKind === 'templeExit') this.exitTempleInterior();
    else if (this.actionKind === 'shop') this.showShopConfirmation();
  }

  private async resetLocalSave() {
    await this.localSaveDatabase.remove(this.saveKey);
    sys.localStorage.removeItem(this.saveKey);
    this.save = await this.loadCitySave();
    this.persistCitySave();
  }

  private onKeyDown(e: EventKeyboard) {
    this.audioManager.unlockFromUserGesture();
    if (this.regionInputLocked) return;
    if (sys.isBrowser && e.keyCode === KeyCode.ESCAPE) {
      if (this.overlay === 'divination') this.exitDivination();
      else if (this.overlay === 'excavationLearning') {
        if (this.excavationLearningStage === 'detail') this.finishExcavationLearning();
        else this.deferExcavationLearning();
      }
      else if (this.overlay !== 'none') this.closeCityOverlay();
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_R && this.overlay === 'none') {
      void this.resetLocalSave();
      this.status.string = '预览存档已恢复到初始学习进度。';
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_B) {
      if (this.overlay === 'backpack') this.closeCityOverlay();
      else if (this.overlay === 'none') this.openBackpack();
      return;
    }
    // Browser-preview shortcuts only: X cycles tools and F uses the equipped
    // tool, making every mobile interaction independently regression-testable.
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_X && this.overlay === 'none' && !this.seated) {
      const previewTools: ToolKind[] = ['none', 'shovel'];
      const nextTool = previewTools[(previewTools.indexOf(this.equippedTool) + 1) % previewTools.length];
      this.equipTool(nextTool);
      const toolName = nextTool === 'none' ? '空手' : '小铲子';
      if (this.status?.isValid) this.status.string = `预览：已切换为${toolName}`;
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_F && this.overlay === 'none') {
      this.useEquippedTool();
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_G && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      this.playerPos.set(this.riverbankNorthHighland.spawnX, this.riverbankNorthHighland.spawnY);
      this.player.setPosition(this.riverbankNorthHighland.spawnX, this.riverbankNorthHighland.spawnY, 80);
      this.facing = 'down';
      if (this.status?.isValid) this.status.string = '预览：已到达洹水河岸工具测试点';
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_H && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      const plant = this.sways.find(sway => {
        const name = sway.node?.name.toLowerCase() ?? '';
        return sway.node?.isValid && sway.node.active && sway.node.parent === this.world
          && !/tree|crop|millet|wheat|vine|orchard|canopy|trunk/.test(name);
      });
      if (plant?.node.isValid) {
        const candidates: Array<{ x: number; y: number; facing: Facing }> = [
          { x: plant.node.position.x - 64, y: plant.node.position.y, facing: 'right' },
          { x: plant.node.position.x + 64, y: plant.node.position.y, facing: 'left' },
          { x: plant.node.position.x, y: plant.node.position.y - 64, facing: 'up' },
          { x: plant.node.position.x, y: plant.node.position.y + 64, facing: 'down' },
        ];
        const point = candidates.find(candidate => this.canStandRadius(candidate.x, candidate.y, this.playerRadius)) ?? candidates[0];
        this.playerPos.set(point.x, point.y); this.player.setPosition(point.x, point.y, 80); this.facing = point.facing;
      }
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_E && this.overlay === 'none') {
      if (this.actionKind !== 'none') this.performWorldAction();
      else this.useEquippedTool();
      return;
    }
    // Preview-only direct entries keep the complete interaction flows testable
    // without changing the production Android controls or save rules.
    if (sys.isBrowser && e.keyCode === KeyCode.DIGIT_5 && this.overlay === 'none') {
      if (this.worldMode === 'outside') this.enterTempleInterior();
      this.playerPos.set(0, -24);
      this.player.setPosition(0, -24, 80);
      this.beginDivination();
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.DIGIT_6) {
      if (this.overlay === 'none') {
        if (this.worldMode === 'templeInterior') this.exitTempleInterior();
        this.playerPos.set(1030, 510);
        this.player.setPosition(1030, 510, 80);
        this.showShopConfirmation();
      } else if (this.overlay === 'shopConfirm') this.openShop();
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_V && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      this.playerPos.set(0, 1010 + this.templeMoveDeltaY);
      this.player.setPosition(0, 1010 + this.templeMoveDeltaY, 80);
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.DIGIT_9 && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      this.playerPos.set(1400, -1270);
      this.player.setPosition(1400, -1270, 80);
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.DIGIT_0 && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      this.playerPos.set(this.riverbankNorthHighland.spawnX, this.riverbankNorthHighland.spawnY);
      this.player.setPosition(this.riverbankNorthHighland.spawnX, this.riverbankNorthHighland.spawnY, 80);
      this.facing = 'down';
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_T && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      this.playerPos.set(430, -452);
      this.player.setPosition(430, -452, 80);
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_Y && this.overlay === 'none') {
      const site = this.excavationSites.find(item => item.active && item.root.isValid);
      if (site) {
        site.active = false; site.awaitingStudy = false; site.holeTimer = .45; site.respawnTimer = .9;
        this.redrawExcavationSite(site);
        this.showStatusNotice('预览：正在快速验证“坑消失→同地区随机可达位置刷新”。', 2);
      }
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_K && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      const site = this.excavationSites.find(item => item.region === 'royal' && item.active && item.reward.kind === 'oracle')
        ?? this.excavationSites.find(item => item.region === 'royal' && item.active);
      if (site) {
        this.playerPos.set(site.x, site.y - 72);
        this.player.setPosition(this.playerPos.x, this.playerPos.y, 80);
        this.facing = 'up';
        this.equipTool('shovel');
        this.showStatusNotice('预览：已到王陵发掘点，按 F 挥铲。', 3);
      }
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_L && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      this.playerPos.set(3280, -3000);
      this.player.setPosition(this.playerPos.x, this.playerPos.y, 80);
      this.facing = 'down';
      this.showStatusNotice('预览：王陵封土与甲骨窑穴全景检查点。', 3);
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_Q && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      this.playerPos.set(-1050, -980);
      this.player.setPosition(this.playerPos.x, this.playerPos.y, 80);
      this.facing = 'down';
      this.showStatusNotice('预览：湖泊北岸农田高地与石板边界。', 3);
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_O && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      this.playerPos.set(-1050, -2045);
      this.player.setPosition(this.playerPos.x, this.playerPos.y, 80);
      this.facing = 'up';
      this.showStatusNotice('预览：洹水湖泊五层岸滩与梯田高地。', 3);
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_U && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      this.playerPos.set(1630, -1455);
      this.player.setPosition(this.playerPos.x, this.playerPos.y, 80);
      this.facing = 'up';
      this.showStatusNotice('预览：田野灌渠分层水岸与动态水纹。', 3);
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_P && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      this.playerPos.set(2300, -2675);
      this.player.setPosition(this.playerPos.x, this.playerPos.y, 80);
      this.facing = 'up';
      this.showStatusNotice('预览：甲骨窑穴分层城门与地形坡台。', 3);
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_J && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      const spots: Array<{ x: number; y: number; facing: Facing; label: string }> = [
        { x: 0, y: -185, facing: 'up', label: '城门洞前景遮挡' },
        { x: 690, y: -555, facing: 'down', label: '草垛后方遮挡' },
        { x: 900, y: -365, facing: 'down', label: '田野北墙后方遮挡' },
        { x: 2300, y: -1270, facing: 'down', label: '宽桥中央可通行区' },
        { x: 666, y: -635, facing: 'down', label: '田野矮墙后方遮挡' },
      ];
      const spot = spots[this.previewDepthSpot++ % spots.length];
      this.playerPos.set(spot.x, spot.y); this.player.setPosition(spot.x, spot.y, 80); this.facing = spot.facing;
      this.showStatusNotice(`遮挡预览：${spot.label}`, 3);
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_C && this.overlay === 'none') {
      const checks = [
        !this.canStandRadius(-154, -165, this.playerRadius),
        !this.canStandRadius(154, -165, this.playerRadius),
        this.canStandRadius(0, -185, this.playerRadius),
        !this.canStandRadius(690, -653, this.playerRadius),
        !this.canStandRadius(666, -675, this.playerRadius),
        !this.canStandRadius(2376, -1270, this.playerRadius),
        this.canStandRadius(2300, -1270, this.playerRadius),
        !this.canStandRadius(900, -415, this.playerRadius),
      ];
      const passed = checks.filter(Boolean).length;
      this.showStatusNotice(`边界自检：${passed}/${checks.length} 项通过`, 4);
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.DIGIT_7 && this.overlay === 'divination' && this.divinationStage === 'question') {
      const wrongIndex = this.oracleCardNodes.findIndex((_node, index) => index !== this.correctCardIndex);
      if (wrongIndex >= 0) {
        this.oracleCardNodes[wrongIndex].setPosition(360, 90, 30);
        this.completeCardDrop(wrongIndex);
      }
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.DIGIT_8 && this.overlay === 'divination' && this.divinationStage === 'question') {
      if (this.correctCardIndex >= 0) {
        this.oracleCardNodes[this.correctCardIndex].setPosition(360, 90, 30);
        this.completeCardDrop(this.correctCardIndex);
      }
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.DIGIT_9 && this.overlay === 'divination' && this.divinationStage === 'review') {
      this.finishDivinationReview();
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.DIGIT_0 && this.overlay === 'shop') {
      this.save.coins += 500;
      this.persistCitySave();
      this.buildShopUi('预览测试：已补充 500 贝币。');
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_C && this.overlay === 'backpack') {
      this.backpackTab = 'codex';
      this.selectedBackpackIndex = Math.max(0, this.save.unlockedOracleIds.length - 1);
      this.codexPage = Math.floor(this.selectedBackpackIndex / 12);
      this.buildBackpackUi();
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_N && this.overlay === 'shop') {
      const products = this.shopProducts;
      this.selectedShopProductIndex = products.length > 0 ? (this.selectedShopProductIndex + 1) % products.length : 0;
      this.buildShopUi();
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_P && this.overlay === 'shop') {
      this.purchaseSelectedShopProduct();
      return;
    }
    if (sys.isBrowser && this.overlay === 'excavationLearning') {
      if (this.excavationLearningStage === 'question') {
        const answerKeys = [KeyCode.DIGIT_1, KeyCode.DIGIT_2, KeyCode.DIGIT_3, KeyCode.DIGIT_4];
        const optionIndex = answerKeys.indexOf(e.keyCode);
        if (optionIndex >= 0) {
          this.answerExcavationLearning(optionIndex);
          return;
        }
      } else if (this.excavationLearningStage === 'detail' && e.keyCode === KeyCode.ENTER) {
        this.finishExcavationLearning();
        return;
      }
    }
    const movementAllowed = this.overlay === 'none' && !this.seated && !this.learningHall?.isOpen;
    if (movementAllowed && (e.keyCode === KeyCode.KEY_A || e.keyCode === KeyCode.ARROW_LEFT)) this.keyboard.x = -1;
    if (movementAllowed && (e.keyCode === KeyCode.KEY_D || e.keyCode === KeyCode.ARROW_RIGHT)) this.keyboard.x = 1;
    if (movementAllowed && (e.keyCode === KeyCode.KEY_W || e.keyCode === KeyCode.ARROW_UP)) this.keyboard.y = 1;
    if (movementAllowed && (e.keyCode === KeyCode.KEY_S || e.keyCode === KeyCode.ARROW_DOWN)) this.keyboard.y = -1;
    // Number keys are intentionally kept as local preview switches so every
    // weather state can be checked without waiting for the random timer.
    if (e.keyCode === KeyCode.DIGIT_1) this.setWeather('晴');
    if (e.keyCode === KeyCode.DIGIT_2) this.setWeather('小雨');
    if (e.keyCode === KeyCode.DIGIT_3) this.setWeather('雨天');
    if (e.keyCode === KeyCode.DIGIT_4) this.setWeather('中雨');
  }

  private onKeyUp(e: EventKeyboard) {
    if (e.keyCode === KeyCode.KEY_A || e.keyCode === KeyCode.KEY_D || e.keyCode === KeyCode.ARROW_LEFT || e.keyCode === KeyCode.ARROW_RIGHT) this.keyboard.x = 0;
    if (e.keyCode === KeyCode.KEY_W || e.keyCode === KeyCode.KEY_S || e.keyCode === KeyCode.ARROW_UP || e.keyCode === KeyCode.ARROW_DOWN) this.keyboard.y = 0;
  }

  private onTouchStart(e: EventTouch) {
    this.audioManager.unlockFromUserGesture();
    if (this.regionInputLocked) return;
    const p = e.getUILocation(); const size = view.getVisibleSize();
    const localX = p.x - size.width / 2;
    const localY = p.y - size.height / 2;
    if (this.learningHall?.isOpen) return;
    if (this.overlay === 'divination' && this.divinationStage === 'question') {
      for (let index = this.oracleCardNodes.length - 1; index >= 0; index--) {
        const card = this.oracleCardNodes[index];
        if (!card?.isValid || !card.active) continue;
        if (Math.abs(localX - card.position.x) <= 78 && Math.abs(localY - card.position.y) <= 97) {
          this.draggingCardIndex = index;
          this.dragOffset.set(card.position.x - localX, card.position.y - localY);
          card.setSiblingIndex(card.parent?.children.length ? card.parent.children.length - 1 : index);
          return;
        }
      }
    }
    if (this.overlay !== 'none') {
      this.handleOverlayTap(localX, localY);
      return;
    }
    if (Math.hypot(localX - 500, localY + 230) <= 80) {
      if (this.actionKind !== 'none') {
        this.playUiClickSound(true);
        this.performWorldAction();
      } else if (this.equippedTool !== 'none') {
        this.playUiClickSound();
        this.useEquippedTool();
      }
      return;
    }
    if (Math.hypot(localX - 380, localY + 230) <= 66) {
      this.playUiClickSound();
      this.openBackpack();
      return;
    }
    if (Math.hypot(localX - 260, localY + 230) <= 66) {
      this.playUiClickSound();
      this.openChapterProgress();
      return;
    }
    const joystickCenter = new Vec2(size.width / 2 - 500, size.height / 2 - 230);
    if (Vec2.distance(new Vec2(p.x, p.y), joystickCenter) <= 115) {
      this.touchOrigin = new Vec2(p.x, p.y);
      this.updateStick(p.x, p.y);
      return;
    }
  }

  private onTouchMove(e: EventTouch) {
    if (this.regionInputLocked) return;
    if (this.draggingCardIndex >= 0) {
      const p = e.getUILocation(); const size = view.getVisibleSize();
      const card = this.oracleCardNodes[this.draggingCardIndex];
      if (card?.isValid) {
        card.setPosition(
          this.clamp(p.x - size.width / 2 + this.dragOffset.x, -540, 520),
          this.clamp(p.y - size.height / 2 + this.dragOffset.y, -60, 255),
          30,
        );
      }
      return;
    }
    if (this.touchOrigin) { const p = e.getUILocation(); this.updateStick(p.x, p.y); }
  }

  private onTouchEnd() {
    if (this.draggingCardIndex >= 0) {
      const index = this.draggingCardIndex;
      this.draggingCardIndex = -1;
      this.completeCardDrop(index);
    }
    this.touchOrigin = null;
    this.stick.set(0, 0);
    this.joystickKnob?.setPosition(-500, -230, 202);
  }

  private handleOverlayTap(x: number, y: number) {
    if (this.overlay === 'chapterChallenge') {
      const positions: Array<[number, number]> = [[-215, 5], [215, 5], [-215, -90], [215, -90]];
      for (let index = 0; index < positions.length; index++) {
        const [choiceX, choiceY] = positions[index];
        if (!this.pointInUiRect(x, y, choiceX, choiceY, 360, 66)) continue;
        this.playUiClickSound(true);
        this.answerChapterChallenge(index);
        return;
      }
      return;
    }
    if (this.overlay === 'chapterProgress') {
      if (this.pointInUiRect(x, y, 392, 258, 104, 44)) {
        this.playUiClickSound();
        this.closeCityOverlay();
      }
      return;
    }
    if (this.overlay === 'shopConfirm') {
      if (this.pointInUiRect(x, y, -125, -65, 180, 58)) {
        this.playUiClickSound();
        this.closeCityOverlay();
      } else if (this.pointInUiRect(x, y, 125, -65, 180, 58)) {
        this.playUiClickSound(true);
        this.openShop();
      }
      return;
    }
    if (this.overlay === 'backpack') {
      if (this.pointInUiRect(x, y, 443, 240, 104, 44)) {
        this.playUiClickSound();
        this.closeCityOverlay();
        return;
      }
      const tabs: Array<{ id: BackpackTab; x: number }> = [
        { id: 'tools', x: -170 }, { id: 'codex', x: 170 },
      ];
      for (const tab of tabs) {
        if (!this.pointInUiRect(x, y, tab.x, 186, 300, 50)) continue;
        this.playUiClickSound();
        this.backpackTab = tab.id;
        if (tab.id === 'codex') this.codexPage = Math.floor(this.selectedBackpackIndex / 12);
        this.buildBackpackUi();
        return;
      }
      if (this.backpackTab === 'tools') {
        const tools: Array<{ id: ToolKind; x: number }> = [
          // Keep the tap targets aligned with the cards drawn in buildBackpackUi.
          // They used to be shifted right by one card, so tapping the visible
          // shovel either did nothing or equipped empty hands instead.
          { id: 'none', x: -350 }, { id: 'shovel', x: -118 },
        ];
        for (const tool of tools) {
          if (!this.pointInUiRect(x, y, tool.x, -28, 205, 292)) continue;
          this.playUiClickSound(true);
          this.equipTool(tool.id);
          this.buildBackpackUi();
          return;
        }
      } else if (this.backpackTab === 'codex') {
        const unlocked = this.oracleCards.filter(card => this.save.unlockedOracleIds.includes(card.id) && this.hasRealOracleGlyph(card));
        const codexPageCount = Math.max(1, Math.ceil(unlocked.length / 12));
        if (this.codexPage > 0 && this.pointInUiRect(x, y, -410, -258, 105, 42)) {
          this.playUiClickSound();
          this.codexPage--; this.buildBackpackUi(); return;
        }
        if (this.codexPage < codexPageCount - 1 && this.pointInUiRect(x, y, -130, -258, 105, 42)) {
          this.playUiClickSound();
          this.codexPage++; this.buildBackpackUi(); return;
        }
        const codexPageStart = this.codexPage * 12;
        const pageLength = Math.min(12, Math.max(0, unlocked.length - codexPageStart));
        for (let index = 0; index < pageLength; index++) {
          const cardX = -385 + (index % 3) * 118;
          const cardY = 105 - Math.floor(index / 3) * 92;
          if (!this.pointInUiRect(x, y, cardX, cardY, 102, 80)) continue;
          this.playUiClickSound();
          this.selectedBackpackIndex = codexPageStart + index;
          this.buildBackpackUi();
          return;
        }
      }
      return;
    }
    if (this.overlay === 'excavationLearning') {
      if (this.excavationLearningStage === 'question') {
        const optionPositions: Array<[number, number]> = [[65, 72], [345, 72], [65, -25], [345, -25]];
        for (let index = 0; index < optionPositions.length; index++) {
          const position = optionPositions[index];
          if (!this.pointInUiRect(x, y, position[0], position[1], 238, 70)) continue;
          this.answerExcavationLearning(index);
          return;
        }
        if (this.pointInUiRect(x, y, 425, -257, 210, 58)) this.deferExcavationLearning();
      } else if (this.excavationLearningStage === 'detail'
        && this.pointInUiRect(x, y, 430, -270, 220, 58)) {
        this.finishExcavationLearning();
      }
      return;
    }
    if (this.overlay === 'shop') {
      if (this.pointInUiRect(x, y, 510, 292, 112, 48)) {
        this.closeCityOverlay();
        return;
      }
      if (this.pointInUiRect(x, y, -470, 0, 170, 66)) {
        this.selectedShopProductIndex = 0;
        this.buildShopUi();
        return;
      }
      const products = this.shopProducts;
      for (let index = 0; index < products.length; index++) {
        const productX = -250 + (index % 2) * 215;
        const productY = 170 - Math.floor(index / 2) * 150;
        if (!this.pointInUiRect(x, y, productX, productY, 190, 130)) continue;
        this.selectedShopProductIndex = index;
        this.buildShopUi();
        return;
      }
      if (this.pointInUiRect(x, y, 340, -178, 250, 58)) this.purchaseSelectedShopProduct();
      return;
    }
    if (this.overlay === 'divination') {
      if (this.pointInUiRect(x, y, 510, 300, 150, 58)) {
        this.exitDivination();
        return;
      }
      if (this.divinationStage === 'review' && this.pointInUiRect(x, y, 380, -72, 150, 52)) {
        this.finishDivinationReview();
      }
    }
  }

  /** Same short wooden click used by the Learning Hall buttons. */
  private playUiClickSound(confirmed = false) {
    if (!sys.isBrowser || !this.save?.sfxOn) return;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const context = this.uiAudioContext ?? (this.uiAudioContext = new Ctx());
      if (context.state === 'suspended') void context.resume();
      const now = context.currentTime;
      const duration = confirmed ? 0.016 : 0.013;
      const cutoff = confirmed ? 0.50 : 0.40;
      const decay = confirmed ? 340 : 380;
      const volume = confirmed ? 0.58 : 0.55;
      const sampleCount = Math.max(1, Math.floor(duration * context.sampleRate));
      const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
      const data = buffer.getChannelData(0);
      let lowPass = 0;
      for (let index = 0; index < sampleCount; index++) {
        const noise = Math.random() * 2 - 1;
        lowPass += (noise - lowPass) * cutoff;
        const time = index / context.sampleRate;
        const attack = time < 0.001 ? time / 0.001 : 1;
        data[index] = Math.max(-1, Math.min(1, lowPass * volume * attack * Math.exp(-(time - 0.001) * decay)));
      }
      const source = context.createBufferSource();
      const master = context.createGain();
      source.buffer = buffer;
      master.gain.value = 0.7;
      source.connect(master);
      master.connect(context.destination);
      source.start(now);
    } catch {
      // Audio feedback must never prevent a UI action on devices that block WebAudio.
    }
  }

  private pointInUiRect(x: number, y: number, centerX: number, centerY: number, width: number, height: number) {
    return Math.abs(x - centerX) <= width / 2 && Math.abs(y - centerY) <= height / 2;
  }

  private updateStick(x: number, y: number) {
    if (!this.touchOrigin) return;
    const delta = new Vec2(x - this.touchOrigin.x, y - this.touchOrigin.y);
    if (delta.length() > 58) delta.normalize().multiplyScalar(58);
    this.stick.set(delta.x / 58, delta.y / 58);
    this.joystickKnob.setPosition(-500 + delta.x, -230 + delta.y, 202);
  }

  /**
   * Adds a large ROYAL_TOMB landmark with an explicit foot line.  Unlike a
   * generic tile, these props have tall visual crowns but compact solid bases.
   */
  private createRoyalTombLandmark(
    name: string,
    asset: string,
    x: number,
    y: number,
    w: number,
    h: number,
    depth: Pick<DepthOccluder, 'footY' | 'halfWidth' | 'coverHeight'>,
  ) {
    const node = new Node(name);
    node.parent = this.world;
    node.setPosition(x, y, 18);
    node.addComponent(UITransform).setContentSize(w, h);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = false;
    this.requestSpriteFrame(`art/royal_tomb/${asset}/spriteFrame`, frame => {
      if (!node.isValid || !sprite.isValid) return;
      frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
      sprite.spriteFrame = frame;
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    });
    this.depthOccluders.push({
      node,
      ...depth,
      baseZ: 18,
      foregroundZ: 98,
      regionId: RegionId.ROYAL_TOMB,
    });
    return node;
  }

  /** Clears all former mound records, including unnamed legacy air-wall bodies in the painted footprint. */
  private clearRoyalTombBurialMoundRecords() {
    const overlapsMound = (x: number, y: number, w = 0, h = 0) =>
      x + w / 2 > 2360 && x - w / 2 < 3360 && y + h / 2 > -3780 && y - h / 2 < -3140;
    this.obstacles = this.obstacles.filter(obstacle =>
      !obstacle.name.startsWith('RoyalTombBurialMound')
      && !(obstacle.regionId === RegionId.ROYAL_TOMB && overlapsMound(obstacle.x, obstacle.y, obstacle.w, obstacle.h)));
    this.depthTrees = this.depthTrees.filter(tree =>
      !tree.node.name.startsWith('RoyalTombBurialMound')
      && !overlapsMound(tree.node.position.x, tree.node.position.y));
    this.depthOccluders = this.depthOccluders.filter(occluder =>
      !occluder.node.name.startsWith('RoyalTombBurialMound')
      && !overlapsMound(occluder.node.position.x, occluder.node.position.y));
    // Ground tiles are normal map surface, not former mound records. Leaving
    // them intact exposes the authored yellow earth and grass around the
    // transparent mound sprite instead of the base map's green fill.
    this.world.children
      .filter(node => node.name.startsWith('RoyalTombBurialMound'))
      .forEach(node => node.destroy());
  }

  private clearRoyalTombLandmarkRecords(prefix: 'RoyalTombOutdoorOracleKiln') {
    this.obstacles = this.obstacles.filter(obstacle => !obstacle.name.startsWith(prefix));
    this.depthTrees = this.depthTrees.filter(tree => !tree.node.name.startsWith(prefix));
    this.depthOccluders = this.depthOccluders.filter(occluder => !occluder.node.name.startsWith(prefix));
    this.world.children
      .filter(node => node.name.startsWith(prefix))
      .forEach(node => node.destroy());
  }

  /** A normal map sprite: deliberately excluded from all dynamic depth passes. */
  private createRoyalTombStaticLandmark(name: string, asset: string, x: number, y: number, w: number, h: number) {
    const node = new Node(name);
    node.parent = this.world;
    node.setPosition(x, y, 18);
    node.addComponent(UITransform).setContentSize(w, h);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = false;
    this.requestSpriteFrame(`art/royal_tomb/${asset}/spriteFrame`, frame => {
      if (!node.isValid || !sprite.isValid) return;
      frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
      sprite.spriteFrame = frame;
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    });
    return node;
  }

  /**
   * Build a sealed collision chain around the royal-tomb burial mound.
   *
   * The mound sprite (royal_tomb_burial_mound) is authored as a 512×342 raw
   * image trimmed to 462×280 and displayed at 900×600.  Visible content
   * (trimmed) occupies roughly 812×491 game pixels centred on (2860, -3450).
   * The actual earth mound base — the oval ring of stones visible at the
   * ground line — sits inside that visible area, not at the 900×600 edges.
   *
   * Control points below trace the OUTER EDGE of the mound base stones
   * (where the mound meets the surrounding yellow earth) as a closed oval
   * polyline.  We sample densely along this polyline with short, overlapping
   * AABB obstacles so the player can walk right up to the base but never
   * step onto a terrace, the entrance, or any painted surface.
   */
  private drawRoyalTombBurialMoundCollision() {
    // Control points tracing the visible mound base (outer edge of stones).
    // Clockwise from top (back) centre, with the entrance flattened at the
    // bottom front.  Coordinates are world positions (Cocos y-up).
    const moundOutline: Array<[number, number]> = [
      [2860, -3192], // 0  top (back) centre
      [3058, -3226], // 1  upper-right
      [3202, -3321], // 2  right-upper
      [3255, -3450], // 3  right
      [3202, -3579], // 4  right-lower
      [3058, -3674], // 5  lower-right
      [2940, -3708], // 6  entrance-right corner
      [2860, -3715], // 7  entrance bottom centre
      [2780, -3708], // 8  entrance-left corner
      [2662, -3674], // 9  lower-left
      [2518, -3579], // 10 left-lower
      [2465, -3450], // 11 left
      [2518, -3321], // 12 left-upper
      [2662, -3226], // 13 upper-left
    ];

    const segmentLength = 28;
    const overlap = 28;
    const shellThickness = 50;
    const generated: Array<{
      name: string; x: number; y: number; w: number; h: number;
      left: number; right: number; bottom: number; top: number;
    }> = [];

    // Close the polyline: append the first point so the last segment wraps
    // back to the start.
    const closed = [...moundOutline, moundOutline[0]];

    this.withObstacleRegion(RegionId.ROYAL_TOMB, () => {
      for (let i = 0; i < closed.length - 1; i++) {
        const a = closed[i];
        const b = closed[i + 1];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const length = Math.hypot(dx, dy);
        if (length < 1) continue;

        const steps = Math.max(1, Math.ceil(length / segmentLength));
        for (let s = 0; s < steps; s++) {
          const t0 = s / steps;
          const t1 = Math.min(1, (s + 1) / steps + overlap / length);
          const segStartX = a[0] + dx * t0;
          const segStartY = a[1] + dy * t0;
          const segEndX = a[0] + dx * t1;
          const segEndY = a[1] + dy * t1;
          const segCenterX = (segStartX + segEndX) / 2;
          const segCenterY = (segStartY + segEndY) / 2;
          const segLen = Math.hypot(segEndX - segStartX, segEndY - segStartY);

          const boxLen = segLen + overlap;
          const halfLen = boxLen / 2;
          const halfThick = shellThickness / 2;

          const obstacleName = `RoyalTombBurialMoundCollision_${i}_${s}`;
          this.addObstacle(
            segCenterX, segCenterY,
            boxLen, shellThickness,
            obstacleName,
            RegionId.ROYAL_TOMB,
          );
          generated.push({
            name: obstacleName,
            x: segCenterX, y: segCenterY,
            w: boxLen, h: shellThickness,
            left: segCenterX - halfLen,
            right: segCenterX + halfLen,
            bottom: segCenterY - halfThick,
            top: segCenterY + halfThick,
          });
        }
      }

      // Auto gap-filling — ensure every consecutive pair of obstacles (and
      // the wrap-around pair) has overlapping AABBs so no diagonal slits
      // remain between boxes.
      const chainDirLen = segmentLength + overlap;
      for (let g = 1; g < generated.length; g++) {
        const prev = generated[g - 1];
        const curr = generated[g];

        const gapX = curr.left - prev.right;
        const yGapTop = Math.min(prev.top, curr.top);
        const yGapBottom = Math.max(prev.bottom, curr.bottom);
        const yGapSize = yGapBottom - yGapTop;
        const gapYOverlap = yGapTop > yGapBottom;

        const needXFiller = gapX > 0;
        const needYFiller = yGapSize > 0 && !gapYOverlap && gapX <= 0;
        if (!needXFiller && !needYFiller) continue;

        const insertCount = Math.max(1, Math.ceil(Math.max(gapX, yGapSize) / chainDirLen));
        for (let k = 1; k <= insertCount; k++) {
          const t = k / (insertCount + 1);
          const fillX = prev.x + (curr.x - prev.x) * t;
          const fillY = prev.y + (curr.y - prev.y) * t;
          const fillLeft = fillX - chainDirLen / 2;
          const fillRight = fillX + chainDirLen / 2;
          const fillBottom = fillY - shellThickness / 2;
          const fillTop = fillY + shellThickness / 2;

          const fillerName = `RoyalTombBurialMoundGapFill_${g - 1}_${k}`;
          this.addObstacle(
            fillX, fillY,
            chainDirLen, shellThickness,
            fillerName,
            RegionId.ROYAL_TOMB,
          );
          generated.splice(g, 0, {
            name: fillerName,
            x: fillX, y: fillY,
            w: chainDirLen, h: shellThickness,
            left: fillLeft, right: fillRight,
            bottom: fillBottom, top: fillTop,
          });
          g++;
        }
      }

      // End-to-end closure check — the chain is a closed loop, so the last
      // and first obstacles must also overlap.  Fill any gap between them.
      if (generated.length >= 2) {
        const last = generated[generated.length - 1];
        const first = generated[0];

        const gapX = first.left - last.right;
        const yGapTop = Math.min(last.top, first.top);
        const yGapBottom = Math.max(last.bottom, first.bottom);
        const yGapSize = yGapBottom - yGapTop;
        const gapYOverlap = yGapTop > yGapBottom;

        const needXFiller = gapX > 0;
        const needYFiller = yGapSize > 0 && !gapYOverlap && gapX <= 0;

        if (needXFiller || needYFiller) {
          const insertCount = Math.max(1, Math.ceil(Math.max(gapX, yGapSize) / chainDirLen));
          for (let k = 1; k <= insertCount; k++) {
            const t = k / (insertCount + 1);
            const fillX = last.x + (first.x - last.x) * t;
            const fillY = last.y + (first.y - last.y) * t;

            const fillerName = `RoyalTombBurialMoundGapFill_${generated.length - 1}_end_${k}`;
            this.addObstacle(
              fillX, fillY,
              chainDirLen, shellThickness,
              fillerName,
              RegionId.ROYAL_TOMB,
            );
          }
        }
      }
    });

    // Debug display (temporarily visible when SHOW_COLLISION_DEBUG is true).
    if (SHOW_COLLISION_DEBUG) {
      const debug = this.graphics('RoyalTombBurialMoundCollisionDebug', this.world, 175);
      debug.strokeColor = new Color(255, 120, 60, 210);
      debug.lineWidth = 2;
      generated.forEach(ob => {
        debug.rect(ob.left, ob.bottom, ob.w, ob.h);
      });
      debug.stroke();
    }
  }

  private pixelSprite(name: string, asset: string, parent: Node, x: number, y: number, w: number, h: number, z: number) {
    const node = new Node(name);
    node.parent = parent;
    node.setPosition(x, y, z);
    node.addComponent(UITransform).setContentSize(w, h);
    this.attachPixelSprite(node, asset);
    if (parent === this.world) {
      this.registerPixelDepthOccluder(node, asset, x, y, w, h, z);
      if (/small-house|village-shop|divination-temple|market-stall|storehouse|field-shelter|village-well/.test(asset)) {
        this.staticStructureSprites.push({ node, asset });
      }
    }
    return node;
  }

  private registerPixelDepthOccluder(node: Node, asset: string, x: number, y: number, w: number, h: number, baseZ: number) {
    let footRatio = 0; let widthRatio = .48; let coverRatio = 1;
    if (/straw-stack/.test(asset)) { footRatio = .36; widthRatio = .46; coverRatio = 1.03; }
    else if (/wall-horizontal|mud-fence-straight|fence-straight|city-wall-end/.test(asset)) {
      footRatio = .38; widthRatio = .52; coverRatio = 1.02;
    } else if (/wall-vertical/.test(asset)) {
      footRatio = .47; widthRatio = .54; coverRatio = 1.02;
    } else if (/house|storehouse|shelter|village-shop|divination-temple|market-stall/.test(asset)) {
      footRatio = .43; widthRatio = .49; coverRatio = 1.06;
    } else if (/village-well|stone-mill|field-water-urn|pottery-jar|barrel-crate|mountain-rock|bronze-brazier/.test(asset)) {
      footRatio = .34; widthRatio = .48; coverRatio = .9;
    } else return;
    this.depthOccluders.push({
      node,
      footY: y - h * footRatio,
      halfWidth: w * widthRatio,
      coverHeight: h * coverRatio,
      baseZ,
      foregroundZ: 98,
      regionId: this.currentObstacleRegionId,
    });
  }

  private attachPixelSprite(node: Node, asset: string) {
    const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.requestFrame(asset, frame => {
      if (!node.isValid || !sprite.isValid) return;
      sprite.spriteFrame = frame;
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    });
    return sprite;
  }

  /** Renders the exact transparent PNG supplied for an oracle character.
   *  Cocos trims the transparent 200x200 source to the visible SpriteFrame.
   *  Therefore the final node uses only the visible aspect ratio and a fixed
   *  card-local box; this prevents a second enlargement and card overflow. */
  private createOracleGlyphVisual(
    name: string,
    parent: Node,
    card: OracleCardData,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    z: number,
    tint: Color = new Color(75, 43, 28),
  ) {
    const fallback = this.createUiLabel(parent, `${name}-Fallback`, '', x, y, maxWidth, maxHeight,
      Math.max(20, Math.round(Math.min(maxWidth, maxHeight) * .52)), tint, 'center', z);
    if (!card.asset || !card.imageBounds) {
      // 暂缺甲骨图片时，回退显示现代字占位，避免学习/图鉴面板出现空白字形。
      fallback.string = card.glyph ?? card.modern ?? '';
      return fallback.node;
    }

    const [left, top, right, bottom] = card.imageBounds;
    const visibleWidth = Math.max(1, right - left + 1);
    const visibleHeight = Math.max(1, bottom - top + 1);
    const scale = Math.min(maxWidth / visibleWidth, maxHeight / visibleHeight);
    const renderWidth = Math.max(1, visibleWidth * scale);
    const renderHeight = Math.max(1, visibleHeight * scale);
    const node = new Node(name);
    node.parent = parent;
    node.setPosition(x, y, z);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(renderWidth, renderHeight);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    // The supplied artwork is already black with a transparent background;
    // keep its source color untouched so no multiplying tint can hide strokes.
    sprite.color = Color.WHITE;
    this.requestSpriteFrame(`oracle/${card.asset}/spriteFrame`, frame => {
      if (!node.isValid || !sprite.isValid) return;
      frame.texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
      sprite.spriteFrame = frame;
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      transform.setContentSize(renderWidth, renderHeight);
      if (fallback.node.isValid) fallback.node.active = false;
    }, () => {
      // 甲骨图缺失（如待补字尚未提供字形图）时回退显示现代字，避免空白字形。
      if (node.isValid) node.active = false;
      if (fallback.node.isValid) {
        fallback.node.active = true;
        fallback.string = card.glyph ?? card.modern ?? '';
      }
    });
    return node;
  }

  /** Deduplicates async resource requests so 145 grass nodes share one load. */
  private requestFrame(asset: string, apply: (frame: SpriteFrame) => void) {
    const key = `tiles/${asset}/spriteFrame`;
    this.requestSpriteFrame(key, apply);
  }

  private requestSpriteFrame(key: string, apply: (frame: SpriteFrame) => void, onError?: () => void) {
    const cached = this.frameCache.get(key);
    if (cached) {
      apply(cached);
      return;
    }

    const waiting = this.frameWaiters.get(key);
    if (waiting) {
      waiting.push(apply);
      if (onError) {
        const errors = this.frameErrorWaiters.get(key) ?? [];
        errors.push(onError);
        this.frameErrorWaiters.set(key, errors);
      }
      return;
    }

    this.frameWaiters.set(key, [apply]);
    if (onError) this.frameErrorWaiters.set(key, [onError]);
    resources.load(key, SpriteFrame, (error, frame) => {
      const callbacks = this.frameWaiters.get(key) ?? [];
      const errors = this.frameErrorWaiters.get(key) ?? [];
      this.frameWaiters.delete(key);
      this.frameErrorWaiters.delete(key);
      if (error || !frame) {
        console.warn(`[YinXuCity] pixel resource failed: ${key}`, error);
        errors.forEach(e => e());
        return;
      }
      frame.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
      this.frameCache.set(key, frame);
      callbacks.forEach(callback => callback(frame));
    });
  }

  private graphics(name: string, parent: Node, z = 0) {
    const n = new Node(name); n.parent = parent; n.setPosition(0, 0, z); n.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight); return n.addComponent(Graphics);
  }

  private localGraphics(name: string, parent: Node, x: number, y: number, w: number, h: number, z = 0) {
    const n = new Node(name); n.parent = parent; n.setPosition(x, y, z); n.addComponent(UITransform).setContentSize(w, h); return n.addComponent(Graphics);
  }

  private strokeSmoothPath(graphics: Graphics, points: Array<[number, number]>) {
    if (points.length === 0) return;
    graphics.moveTo(points[0][0], points[0][1]);
    if (points.length === 1) return;
    for (let i = 1; i < points.length - 1; i++) {
      const next = points[i + 1];
      const midX = (points[i][0] + next[0]) / 2;
      const midY = (points[i][1] + next[1]) / 2;
      graphics.quadraticCurveTo(points[i][0], points[i][1], midX, midY);
    }
    graphics.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
  }

  private tileAlongPath(name: string, asset: string, points: Array<[number, number]>, spacing: number, w: number, h: number, z: number) {
    let index = 0;
    for (let segment = 0; segment < points.length - 1; segment++) {
      const [ax, ay] = points[segment];
      const [bx, by] = points[segment + 1];
      const dx = bx - ax; const dy = by - ay;
      const length = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(length / spacing));
      const rotation = 90 - Math.atan2(dy, dx) * 180 / Math.PI;
      for (let step = segment === 0 ? 0 : 1; step <= steps; step++) {
        const t = step / steps;
        const tile = this.pixelSprite(`${name}${index++}`, asset, this.world, ax + dx * t, ay + dy * t, w, h, z);
        tile.setRotationFromEuler(0, 0, rotation);
      }
    }
  }

  private drawDirtRoadJunction(x: number, y: number, variant: number, radius: number, z: number) {
    const g = this.localGraphics(`NaturalRoadJunction${variant}`, this.world, x, y, radius * 2.7, radius * 2.7, z);
    const raw: Array<[number, number]> = [
      [-1.18, -.13], [-.92, -.55], [-.31, -.66], [.13, -.49], [.76, -.57], [1.12, -.18],
      [.94, .34], [.36, .51], [-.16, .43], [-.79, .49], [-1.08, .19],
    ];
    const outline = (scale: number, offsetY = 0) => {
      raw.forEach((point, index) => {
        const jitter = Math.sin((index + 2) * (variant + 3) * .47) * radius * .035;
        const px = point[0] * radius * scale + jitter;
        const py = point[1] * radius * scale + offsetY - jitter * .35;
        if (index === 0) g.moveTo(px, py); else g.lineTo(px, py);
      });
      g.close();
    };
    g.fillColor = new Color(87, 66, 43, 118); outline(1.05, -3); g.fill();
    g.fillColor = variant >= 50 ? new Color(174, 132, 73) : new Color(161, 119, 69); outline(1); g.fill();
    g.fillColor = new Color(205, 164, 96, 72); outline(.67, 1); g.fill();

    // Ruts stop before the centre, so branches merge into one worn patch
    // instead of forming a geometric cross or radial badge.
    g.strokeColor = new Color(101, 74, 47, 125); g.lineWidth = 2.5;
    g.moveTo(-radius * .78, -2); g.lineTo(-radius * .24, 1);
    g.moveTo(radius * .22, -1); g.lineTo(radius * .77, 2);
    if (variant % 2 === 0) { g.moveTo(2, -radius * .42); g.lineTo(-1, -radius * .14); }
    else { g.moveTo(-3, radius * .13); g.lineTo(1, radius * .41); }
    g.stroke();
    for (let i = 0; i < 7; i++) {
      const px = Math.sin(i * 2.13 + variant) * radius * (.18 + (i % 3) * .17);
      const py = Math.cos(i * 1.77 + variant * .4) * radius * (.12 + (i % 2) * .19);
      g.fillColor = i % 3 === 0 ? new Color(92, 68, 47, 180) : new Color(221, 179, 105, 165);
      g.rect(Math.round(px), Math.round(py), 3 + i % 4, 2 + (i + 1) % 3); g.fill();
    }
  }

  private drawHuanLake() {
    // The lake sits in the eastern half of the river-to-field transition zone,
    // deliberately separated from the main Huan River channel.
    const centerX = -1050;
    const centerY = -1550;
    const outline: Array<[number, number]> = [
      [-510, -110], [-500, 90], [-440, 180], [-470, 280], [-330, 350], [-160, 338],
      [-20, 300], [120, 370], [285, 330], [355, 240], [485, 175], [455, 45],
      [510, -90], [420, -220], [270, -270], [120, -350], [-50, -325], [-210, -365],
      [-350, -295], [-470, -260],
    ];

    const lakeLayers: Array<[string, Color, number, number, number, number]> = [
      // Five visibly separated elevation/material bands: stone boundary,
      // raised grass, dry terrace, pale shallow sand, then the water basin.
      ['HuanLakeStoneBoundary', new Color(83, 87, 76), 1.22, 3, 0, -7],
      ['HuanLakeRaisedGrassland', new Color(119, 127, 69), 1.16, 4, 0, -2],
      ['HuanLakeDryTerraceBank', new Color(166, 120, 61), 1.09, 5, -3, 2],
      ['HuanLakePaleSandShallows', new Color(213, 166, 88), 1.01, 6, 1, 1],
      ['HuanLakeWetBankShadow', new Color(58, 72, 60), .945, 7, 3, -2],
      ['HuanLakeMainWater', new Color(55, 127, 160), .89, 8, -2, 3],
    ];
    lakeLayers.forEach(([name, color, scale, z, offsetX, offsetY]) => {
      const layer = this.localGraphics(name, this.world, centerX, centerY, 1180, 880, z);
      layer.fillColor = color;
      this.traceScaledLakeContour(layer, outline, scale, offsetX, offsetY);
      layer.fill();
    });

    // Distinct prop silhouettes make the lake read as a cultivated living
    // shore at close range, while the contour layers retain the broad terrain
    // shape at a distance. These are intentionally scattered, never tiled.
    [
      [-430, 170, 'riverbank-mud-edge-v1', 156], [392, 155, 'riverbank-mud-edge-v1', 150],
      [-325, -250, 'river-reed-clump-v1', 112], [308, -188, 'river-reed-clump-v1', 102],
      [-175, 330, 'river-reed-clump-v1', 92], [235, 322, 'paddy-stepping-embankment-v1', 136],
    ].forEach(([offsetX, offsetY, asset, size], index) => this.pixelSprite(
      `HuanLakeLivingShore-${index}`, asset as string, this.world,
      centerX + Number(offsetX), centerY + Number(offsetY), Number(size), Number(size), 12,
    ));

    this.drawHuanLakeTerraceEnvironment(centerX, centerY, outline);

    // A translucent deep-water basin sits over the lighter main surface. Its
    // offset lobes avoid a mechanical centred oval and create underwater depth.
    const deepBasin = this.localGraphics('HuanLakeDeepWaterBasin', this.world, centerX, centerY, 1100, 820, 9);
    deepBasin.fillColor = new Color(18, 67, 99, 108);
    this.traceScaledLakeContour(deepBasin, outline, .57, 18, -12); deepBasin.fill();
    deepBasin.fillColor = new Color(12, 53, 83, 68);
    deepBasin.ellipse(-95, -30, 245, 162); deepBasin.ellipse(128, 44, 176, 118); deepBasin.fill();

    // Shallow-water light follows the banks in irregular patches instead of
    // forming a flat gradient. This preserves distinct colour and depth bands.
    const shallows = this.localGraphics('HuanLakeShallowWaterPatches', this.world, centerX, centerY, 1100, 820, 9);
    shallows.fillColor = new Color(111, 181, 190, 72);
    shallows.moveTo(-360, 145); shallows.quadraticCurveTo(-255, 255, -88, 252);
    shallows.quadraticCurveTo(-180, 196, -330, 92); shallows.close(); shallows.fill();
    shallows.moveTo(185, -215); shallows.quadraticCurveTo(330, -186, 376, -80);
    shallows.quadraticCurveTo(245, -126, 112, -238); shallows.close(); shallows.fill();

    const texture = this.localGraphics('HuanLakePixelWaterTexture', this.world, centerX, centerY, 1100, 820, 10);
    const lakeChevrons = this.localGraphics('HuanLakeChevronWaterTexture', this.world, centerX, centerY, 1100, 820, 10);
    let seed = 71357;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const insideWater = (x: number, y: number) => (x * x) / (420 * 420) + (y * y) / (286 * 286) < 1 ||
      ((x + 245) * (x + 245)) / (205 * 205) + ((y - 35) * (y - 35)) / (230 * 230) < 1 ||
      ((x - 250) * (x - 250)) / (180 * 180) + ((y + 18) * (y + 18)) / (210 * 210) < 1;
    for (let i = 0; i < 150; i++) {
      const x = -430 + random() * 860;
      const y = -292 + random() * 584;
      if (!insideWater(x, y)) continue;
      texture.fillColor = random() > .58 ? new Color(91, 153, 166, 135) : new Color(10, 57, 91, 145);
      texture.rect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, 7 + Math.floor(random() * 18), random() > .5 ? 3 : 5);
      texture.fill();
      if (i % 2 === 0) {
        lakeChevrons.moveTo(x - 8, y + 4); lakeChevrons.lineTo(x, y); lakeChevrons.lineTo(x + 8, y + 4);
      }
    }
    for (let y = -246, row = 0; y <= 246; y += 24, row++) {
      for (let x = -390 + (row % 2) * 16; x <= 390; x += 32) {
        if (!insideWater(x, y)) continue;
        const direction = (row + Math.round(x / 32)) % 2 === 0 ? 1 : -1;
        lakeChevrons.moveTo(x - 7, y + direction * 3);
        lakeChevrons.lineTo(x, y);
        lakeChevrons.lineTo(x + 7, y + direction * 3);
      }
    }
    lakeChevrons.strokeColor = new Color(91, 157, 185, 92); lakeChevrons.lineWidth = 1.6; lakeChevrons.stroke();

    const shore = this.localGraphics('HuanLakePixelShoreDetails', this.world, centerX, centerY, 1180, 880, 11);
    const stones: Array<[number, number, number, number]> = [
      [-438, 126, 44, 27], [-370, 282, 38, 24], [-180, 350, 54, 29], [68, 337, 42, 25],
      [304, 269, 57, 31], [445, 94, 46, 27], [398, -190, 51, 29], [210, -304, 58, 32],
      [-42, -337, 43, 26], [-286, -300, 55, 30], [-440, -178, 45, 26],
    ];
    stones.forEach(([x, y, w, h], index) => {
      shore.fillColor = new Color(61, 70, 66, 220);
      shore.moveTo(x - w / 2 + 6, y - h / 2);
      shore.lineTo(x + w / 2 - 7, y - h / 2);
      shore.lineTo(x + w / 2, y - h / 2 + 6);
      shore.lineTo(x + w / 2 - 3, y + h / 2);
      shore.lineTo(x - w / 2 + 5, y + h / 2);
      shore.lineTo(x - w / 2, y + h / 2 - 6);
      shore.close(); shore.fill();
      shore.fillColor = index % 2 === 0 ? new Color(135, 135, 112) : new Color(112, 124, 105);
      shore.moveTo(x - w / 2 + 9, y - h / 2 + 5);
      shore.lineTo(x + w / 2 - 10, y - h / 2 + 5);
      shore.lineTo(x + w / 2 - 5, y - h / 2 + 9);
      shore.lineTo(x + w / 2 - 8, y + h / 2 - 5);
      shore.lineTo(x - w / 2 + 9, y + h / 2 - 5);
      shore.lineTo(x - w / 2 + 5, y + h / 2 - 9);
      shore.close(); shore.fill();
      shore.fillColor = new Color(196, 184, 139, 170);
      shore.rect(x - w * .22, y + 2, w * .38, 3); shore.fill();
    });

    const shallowStones: Array<[number, number, number]> = [
      [-315, 118, 10], [-220, -208, 8], [330, 92, 11], [245, -188, 9], [-28, 245, 8],
    ];
    shallowStones.forEach(([x, y, radius], index) => {
      shore.fillColor = new Color(26, 78, 96, 135); shore.ellipse(x + 3, y - 3, radius + 5, radius * .58); shore.fill();
      shore.fillColor = index % 2 === 0 ? new Color(127, 133, 111, 210) : new Color(105, 122, 107, 205);
      shore.ellipse(x, y, radius, radius * .52); shore.fill();
      shore.fillColor = new Color(205, 191, 145, 150); shore.rect(x - radius * .38, y + 1, radius * .55, 2); shore.fill();
    });

    [
      [-470, 150], [-385, 310], [-200, 375], [170, 355], [435, 180],
      [460, -120], [290, -295], [10, -380], [-300, -310], [-490, -135],
    ].forEach(([x, y]) => this.createReeds(centerX + x, centerY + y));

    const pads: Array<[number, number, number]> = [
      [-250, 90, 0], [-160, 170, 1], [60, 155, 2], [260, 20, 3], [120, -145, 4], [-110, -110, 5],
    ];
    pads.forEach(([x, y, phase], index) => {
      const pad = this.localGraphics(`HuanLakeLilyPad${index}`, this.world, centerX + x, centerY + y, 40, 28, 12);
      pad.fillColor = index % 2 === 0 ? new Color(68, 126, 69) : new Color(88, 142, 71);
      pad.circle(0, 0, 12 + index % 3); pad.fill();
      pad.fillColor = new Color(139, 176, 91, 190); pad.rect(-7, 2, 9, 3); pad.fill();
      this.sways.push({ node: pad.node, phase: phase * .72, amplitude: 2.2, speed: .46 });
    });

    [
      [-280, 20], [-130, 240], [70, 70], [270, 110], [180, -170], [-90, -215], [410, -30],
    ].forEach(([x, y], index) => {
      const rippleX = centerX + x; const rippleY = centerY + y;
      const ripple = this.localGraphics(`HuanLakeRipple${index}`, this.world, rippleX, rippleY, 84, 36, 13);
      ripple.strokeColor = new Color(126, 181, 188, 170); ripple.lineWidth = 3;
      ripple.moveTo(-22, 0); ripple.quadraticCurveTo(0, 8, 24, 0); ripple.stroke();
      this.ripples.push({ node: ripple.node, baseX: rippleX, phase: index * .83 + .25 });
    });

    this.createWildlifeSprite('HuanLakeFishA', 'river-fish', centerX - 160, centerY + 20, 78, 54, 15, 90, 30, .6, .38);
    this.createWildlifeSprite('HuanLakeFishB', 'river-fish', centerX + 150, centerY + 60, 72, 50, 15, 76, 24, 1.7, .44);
    this.createAnimatedDuckPair('HuanLakeDucks', centerX + 50, centerY + 220, 16, 92, 22, 2.5, .3);

    // Collision follows the water body rather than its rectangular map area.
    this.waterCircles.push(
      { x: centerX - 235, y: centerY + 20, radius: 210, name: '洹水湖西湾' },
      { x: centerX + 5, y: centerY, radius: 275, name: '洹水湖深水区' },
      { x: centerX + 250, y: centerY, radius: 200, name: '洹水湖东湾' },
      { x: centerX - 50, y: centerY + 200, radius: 165, name: '洹水湖北湾' },
      { x: centerX + 40, y: centerY - 195, radius: 180, name: '洹水湖南湾' },
    );
    this.worldLabel('洹水湖湾', centerX, centerY + 460, 24, new Color(230, 242, 208));
  }

  private drawHuanLakeTerraceEnvironment(centerX: number, centerY: number, outline: Array<[number, number]>) {
    const rim = this.localGraphics('HuanLakeStoneSlabRim', this.world, centerX, centerY, 1450, 1100, 5);
    rim.strokeColor = new Color(151, 146, 111, 220); rim.lineWidth = 15;
    this.traceScaledLakeContour(rim, outline, 1.205, 0, -6); rim.stroke();
    rim.strokeColor = new Color(69, 72, 65, 205); rim.lineWidth = 5;
    this.traceScaledLakeContour(rim, outline, 1.235, 0, -9); rim.stroke();

    // Two raised planting shelves occupy the high northern corners. Their
    // lower edges stop before the bank, keeping the broad southern mudflats open.
    const terrace = this.localGraphics('HuanLakeRaisedFarmTerraces', this.world, centerX, centerY, 1500, 1120, 5);
    const plots: Array<[number, number, number, number]> = [
      [-390, 486, 280, 142], [-82, 500, 272, 156], [224, 485, 278, 144],
    ];
    plots.forEach(([px, py, width, height], plotIndex) => {
      terrace.fillColor = new Color(74, 76, 54, 180);
      terrace.roundRect(px - width / 2 - 7, py - height / 2 - 7, width + 14, height + 14, 9); terrace.fill();
      terrace.fillColor = plotIndex % 2 === 0 ? new Color(126, 91, 48) : new Color(139, 96, 50);
      terrace.roundRect(px - width / 2, py - height / 2, width, height, 6); terrace.fill();
      for (let row = 0; row < 3; row++) {
        const cropY = py - height / 2 + 27 + row * 39;
        terrace.strokeColor = new Color(188, 137, 68, 155); terrace.lineWidth = 3;
        terrace.moveTo(px - width / 2 + 14, cropY - 9); terrace.lineTo(px + width / 2 - 14, cropY - 9); terrace.stroke();
        for (let cropX = px - width / 2 + 27; cropX < px + width / 2 - 14; cropX += 34) {
          terrace.fillColor = (row + plotIndex) % 2 === 0 ? new Color(54, 109, 57) : new Color(81, 122, 61);
          terrace.rect(cropX - 3, cropY - 5, 6, 17); terrace.rect(cropX - 10, cropY + 1, 8, 4); terrace.rect(cropX + 3, cropY + 4, 9, 4); terrace.fill();
          terrace.fillColor = new Color(159, 155, 70, 170); terrace.rect(cropX - 1, cropY + 10, 3, 4); terrace.fill();
        }
      }
    });

    // Pixel clods, flowers and dry grass break the large bank rings into local
    // details while retaining a readable clear route around the lake.
    const bankDetails = this.localGraphics('HuanLakeTerraceBankDetails', this.world, centerX, centerY, 1400, 1060, 11);
    const bankPoints: Array<[number, number]> = [
      [-520, 250], [-470, -10], [-430, -285], [-250, -405], [20, -430], [285, -385],
      [480, -250], [545, -25], [495, 225], [350, 370], [-315, 382],
    ];
    bankPoints.forEach(([px, py], index) => {
      bankDetails.fillColor = index % 3 === 0 ? new Color(201, 153, 80, 210) : new Color(91, 91, 62, 195);
      bankDetails.rect(px - 8, py - 3, 16 + index % 4 * 3, 5 + index % 2 * 2); bankDetails.fill();
      bankDetails.strokeColor = index % 2 === 0 ? new Color(74, 108, 56, 210) : new Color(136, 125, 61, 205);
      bankDetails.lineWidth = 3;
      bankDetails.moveTo(px, py + 2); bankDetails.lineTo(px - 5, py + 18 + index % 3 * 3);
      bankDetails.moveTo(px + 5, py + 1); bankDetails.lineTo(px + 11, py + 15); bankDetails.stroke();
    });

    const scarecrow = this.localGraphics('HuanLakeTerraceScarecrow', this.world, centerX + 385, centerY + 445, 90, 132, 14);
    scarecrow.fillColor = new Color(66, 45, 31); scarecrow.rect(-4, -48, 8, 91); scarecrow.rect(-31, 1, 62, 7); scarecrow.fill();
    scarecrow.fillColor = new Color(176, 126, 62); scarecrow.circle(0, 28, 14); scarecrow.fill();
    scarecrow.fillColor = new Color(78, 61, 38); scarecrow.moveTo(-26, 42); scarecrow.lineTo(23, 42); scarecrow.lineTo(13, 57); scarecrow.lineTo(-13, 57); scarecrow.close(); scarecrow.fill();
    scarecrow.fillColor = new Color(151, 73, 45); scarecrow.moveTo(-27, -2); scarecrow.lineTo(0, 16); scarecrow.lineTo(28, -2); scarecrow.lineTo(15, -31); scarecrow.lineTo(-15, -31); scarecrow.close(); scarecrow.fill();

    this.pixelSprite('HuanLakeWestFlowerBed', 'wildflower-patch', this.world, centerX - 510, centerY + 255, 92, 74, 12);
    this.pixelSprite('HuanLakeEastShelter', 'field-shelter', this.world, centerX + 555, centerY + 285, 126, 128, 14);
    this.addStructureFootprint('HuanLakeEastShelter', centerX + 555, centerY + 274, 108, 104);
  }

  private traceScaledLakeContour(graphics: Graphics, points: Array<[number, number]>, scale: number, offsetX = 0, offsetY = 0) {
    const scaled = points.map(([x, y], index) => {
      const warp = Math.sin((index + 1) * 2.17 + scale * 10) * .018 + Math.cos((index + 1) * .79 + scale * 3) * .012;
      return [x * (scale + warp) + offsetX, y * (scale - warp * .55) + offsetY] as [number, number];
    });
    const first = scaled[0];
    graphics.moveTo(Math.round(first[0] / 4) * 4, Math.round(first[1] / 4) * 4);
    let currentX = first[0]; let currentY = first[1];
    for (let i = 0; i < scaled.length; i++) {
      const next = scaled[(i + 1) % scaled.length];
      const dx = next[0] - currentX; const dy = next[1] - currentY;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 34));
      const startX = currentX; const startY = currentY;
      for (let step = 1; step <= steps; step++) {
        const targetX = Math.round((startX + dx * step / steps) / 4) * 4;
        const targetY = Math.round((startY + dy * step / steps) / 4) * 4;
        // Alternating orthogonal moves create the small inset/outset terraces
        // characteristic of hand-authored pixel shorelines.
        if ((i + step) % 2 === 0) {
          graphics.lineTo(targetX, currentY); graphics.lineTo(targetX, targetY);
        } else {
          graphics.lineTo(currentX, targetY); graphics.lineTo(targetX, targetY);
        }
        currentX = targetX; currentY = targetY;
      }
    }
    graphics.close();
  }

  private drawRiverPixelTexture(points: Array<[number, number]>) {
    const waterPixels = this.graphics('ContinuousRiverPixelTexture', this.world, 9);
    const deepPixels = this.graphics('ContinuousRiverDeepMottle', this.world, 8);
    const lightWaves = this.graphics('ContinuousRiverLightWaves', this.world, 10);
    const darkWaves = this.graphics('ContinuousRiverDarkWaves', this.world, 10);
    const lightChevrons = this.graphics('ContinuousRiverLightChevronTexture', this.world, 9);
    const darkChevrons = this.graphics('ContinuousRiverDarkChevronTexture', this.world, 9);
    let seed = 93281;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const samples = this.sampleDetailedPath(points, 25);

    for (let i = 1; i < samples.length - 1; i++) {
      const previous = samples[i - 1]; const point = samples[i]; const next = samples[i + 1];
      const dx = next[0] - previous[0]; const dy = next[1] - previous[1];
      const length = Math.max(1, Math.hypot(dx, dy));
      const tx = dx / length; const ty = dy / length;
      const nx = -ty; const ny = tx;

      for (let layer = 0; layer < 2; layer++) {
        const offset = (random() * 2 - 1) * (layer === 0 ? 112 : 82);
        const x = point[0] + nx * offset;
        const y = point[1] + ny * offset;
        const bright = random() > .54;
        waterPixels.fillColor = bright ? new Color(96, 158, 177, 92) : new Color(16, 68, 105, 108);
        this.paintOrientedPatch(waterPixels, x, y, tx, ty, nx, ny, 7 + random() * 14, bright ? 2 : 3);
      }
      const grainOffset = (random() * 2 - 1) * 132;
      waterPixels.fillColor = random() > .62 ? new Color(77, 139, 153, 88) : new Color(8, 50, 82, 105);
      this.paintOrientedPatch(
        waterPixels,
        point[0] + nx * grainOffset,
        point[1] + ny * grainOffset,
        tx,
        ty,
        nx,
        ny,
        4 + random() * 8,
        2 + random() * 2,
      );

      if (i % 2 === 0) {
        [-92, -46, 0, 46, 92].forEach((offset, band) => {
          const jitter = (random() * 2 - 1) * 7;
          const x = point[0] + nx * (offset + jitter); const y = point[1] + ny * (offset + jitter);
          const chevrons = (i + band) % 3 === 0 ? lightChevrons : darkChevrons;
          chevrons.moveTo(x - tx * 7 - nx * 3, y - ty * 7 - ny * 3);
          chevrons.lineTo(x, y);
          chevrons.lineTo(x + tx * 7 - nx * 3, y + ty * 7 - ny * 3);
        });
      }

      if (i % 3 === 0) {
        const offset = (random() * 2 - 1) * 126;
        deepPixels.fillColor = random() > .52 ? new Color(7, 43, 74, 92) : new Color(46, 111, 137, 70);
        this.paintOrientedPatch(deepPixels, point[0] + nx * offset, point[1] + ny * offset, tx, ty, nx, ny, 12 + random() * 20, 4 + random() * 4);
      }

      if (i % 7 === 0) {
        const offset = (random() * 2 - 1) * 105;
        const x = point[0] + nx * offset; const y = point[1] + ny * offset;
        lightWaves.moveTo(x - tx * 17, y - ty * 17);
        lightWaves.quadraticCurveTo(x + nx * 5, y + ny * 5, x + tx * 20, y + ty * 20);
      }
      if (i % 11 === 4) {
        const offset = (random() * 2 - 1) * 118;
        const x = point[0] + nx * offset; const y = point[1] + ny * offset;
        darkWaves.moveTo(x - tx * 12, y - ty * 12);
        darkWaves.quadraticCurveTo(x - nx * 4, y - ny * 4, x + tx * 16, y + ty * 16);
      }
    }
    lightWaves.strokeColor = new Color(112, 170, 181, 90); lightWaves.lineWidth = 2; lightWaves.stroke();
    darkWaves.strokeColor = new Color(5, 45, 77, 105); darkWaves.lineWidth = 2; darkWaves.stroke();
    lightChevrons.strokeColor = new Color(100, 164, 187, 135); lightChevrons.lineWidth = 2; lightChevrons.stroke();
    darkChevrons.strokeColor = new Color(18, 70, 110, 145); darkChevrons.lineWidth = 2; darkChevrons.stroke();
  }

  private drawDetailedRiverBanks(points: Array<[number, number]>) {
    const soilPixels = this.graphics('DetailedRiverSoilPixels', this.world, 10);
    const wetPixels = this.graphics('DetailedRiverWetEdgePixels', this.world, 11);
    const grassPixels = this.graphics('DetailedRiverGrassLip', this.world, 11);
    const waterline = this.graphics('DetailedRiverWaterlineHighlights', this.world, 11);
    const rocks = this.graphics('DetailedRiverBankRocks', this.world, 13);
    const samples = this.sampleDetailedPath(points, 27);
    let seed = 46821;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

    for (let i = 1; i < samples.length - 1; i++) {
      const previous = samples[i - 1]; const point = samples[i]; const next = samples[i + 1];
      const dx = next[0] - previous[0]; const dy = next[1] - previous[1];
      const length = Math.max(1, Math.hypot(dx, dy));
      const tx = dx / length; const ty = dy / length;
      const nx = -ty; const ny = tx;

      [-1, 1].forEach(side => {
        const jitter = Math.sin(i * .91 + side * 1.7) * 7 + (random() * 2 - 1) * 4;
        const soilOffset = side * (230 + jitter);
        const wetOffset = side * (198 + jitter * .35);
        const grassOffset = side * (258 + jitter);
        const waterOffset = side * (169 + jitter * .2);

        soilPixels.fillColor = i % 5 === 0 ? new Color(205, 154, 76, 225) : new Color(128, 87, 46, 215);
        this.paintOrientedPatch(soilPixels, point[0] + nx * soilOffset, point[1] + ny * soilOffset, tx, ty, nx, ny, 22 + random() * 23, 7 + random() * 6);
        wetPixels.fillColor = i % 4 === 0 ? new Color(39, 71, 65, 225) : new Color(57, 62, 47, 230);
        this.paintOrientedPatch(wetPixels, point[0] + nx * wetOffset, point[1] + ny * wetOffset, tx, ty, nx, ny, 20 + random() * 25, 6 + random() * 5);
        grassPixels.fillColor = i % 3 === 0 ? new Color(64, 111, 55, 220) : new Color(87, 128, 60, 205);
        this.paintOrientedPatch(grassPixels, point[0] + nx * grassOffset, point[1] + ny * grassOffset, tx, ty, nx, ny, 15 + random() * 19, 5 + random() * 5);

        if (i % 3 === 0) {
          waterline.fillColor = i % 6 === 0 ? new Color(88, 148, 158, 190) : new Color(11, 60, 87, 220);
          this.paintOrientedPatch(waterline, point[0] + nx * waterOffset, point[1] + ny * waterOffset, tx, ty, nx, ny, 13 + random() * 22, 3);
        }

        const clearOfFord = Math.hypot(point[0] - (-5220), point[1] - (-790)) > 290;
        if (i % 9 === 4 && side === (Math.floor(i / 9) % 2 === 0 ? 1 : -1) && clearOfFord && point[0] > -5920) {
          this.createReeds(point[0] + nx * side * 222, point[1] + ny * side * 222);
        }
        if (i % 15 === 7 && clearOfFord && point[0] > -5940) {
          const rockX = point[0] + nx * side * (236 + random() * 14);
          const rockY = point[1] + ny * side * (236 + random() * 14);
          this.drawRiverBankRock(rocks, rockX, rockY, 28 + random() * 23, 18 + random() * 12, i + side);
        }
      });
    }
  }

  /** Draws a single asymmetric river ribbon from its centre line. */
  private drawOrganicRiverBand(
    name: string,
    points: Array<[number, number]>,
    halfWidth: number,
    color: Color,
    z: number,
    variation: number,
  ) {
    const samples = this.sampleDetailedPath(points, 34);
    const left: Array<[number, number]> = [];
    const right: Array<[number, number]> = [];
    samples.forEach((point, index) => {
      const before = samples[Math.max(0, index - 1)];
      const after = samples[Math.min(samples.length - 1, index + 1)];
      const dx = after[0] - before[0]; const dy = after[1] - before[1];
      const length = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / length; const ny = dx / length;
      const pulse = Math.sin(index * .33) * variation + Math.sin(index * .11 + .7) * variation * .55;
      const leftWidth = halfWidth + pulse;
      const rightWidth = halfWidth - pulse * .72;
      left.push([point[0] + nx * leftWidth, point[1] + ny * leftWidth]);
      right.push([point[0] - nx * rightWidth, point[1] - ny * rightWidth]);
    });
    const band = this.graphics(name, this.world, z);
    band.fillColor = color;
    band.moveTo(left[0][0], left[0][1]);
    left.slice(1).forEach(([x, y]) => band.lineTo(x, y));
    right.slice().reverse().forEach(([x, y]) => band.lineTo(x, y));
    band.close(); band.fill();
  }

  private sampleDetailedPath(points: Array<[number, number]>, spacing: number) {
    let smooth = points.map(point => [point[0], point[1]] as [number, number]);
    for (let iteration = 0; iteration < 2; iteration++) {
      const refined: Array<[number, number]> = [smooth[0]];
      for (let i = 0; i < smooth.length - 1; i++) {
        const a = smooth[i]; const b = smooth[i + 1];
        refined.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25]);
        refined.push([a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
      }
      refined.push(smooth[smooth.length - 1]);
      smooth = refined;
    }

    const samples: Array<[number, number]> = [];
    for (let segment = 0; segment < smooth.length - 1; segment++) {
      const a = smooth[segment]; const b = smooth[segment + 1];
      const length = Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]));
      const steps = Math.max(1, Math.ceil(length / spacing));
      for (let step = segment === 0 ? 0 : 1; step <= steps; step++) {
        const t = step / steps;
        samples.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return samples;
  }

  private paintOrientedPatch(graphics: Graphics, x: number, y: number, tx: number, ty: number, nx: number, ny: number, length: number, width: number) {
    const halfLength = length / 2; const halfWidth = width / 2;
    graphics.moveTo(x - tx * halfLength - nx * halfWidth, y - ty * halfLength - ny * halfWidth);
    graphics.lineTo(x + tx * halfLength - nx * halfWidth, y + ty * halfLength - ny * halfWidth);
    graphics.lineTo(x + tx * halfLength + nx * halfWidth, y + ty * halfLength + ny * halfWidth);
    graphics.lineTo(x - tx * halfLength + nx * halfWidth, y - ty * halfLength + ny * halfWidth);
    graphics.close(); graphics.fill();
  }

  private drawRiverBankRock(graphics: Graphics, x: number, y: number, width: number, height: number, variant: number) {
    graphics.fillColor = new Color(52, 67, 65, 230);
    graphics.moveTo(x - width / 2 + 5, y - height / 2);
    graphics.lineTo(x + width / 2 - 6, y - height / 2);
    graphics.lineTo(x + width / 2, y - height / 2 + 5);
    graphics.lineTo(x + width / 2 - 3, y + height / 2);
    graphics.lineTo(x - width / 2 + 4, y + height / 2);
    graphics.lineTo(x - width / 2, y + height / 2 - 5);
    graphics.close(); graphics.fill();
    graphics.fillColor = variant % 2 === 0 ? new Color(135, 137, 113) : new Color(111, 127, 108);
    graphics.rect(x - width / 2 + 5, y - height / 2 + 5, width - 10, Math.max(5, height - 9)); graphics.fill();
    graphics.fillColor = new Color(202, 189, 144, 175);
    graphics.rect(x - width * .2, y + 1, width * .34, 3); graphics.fill();
  }

  private drawPixelFord(x: number, y: number) {
    const ford = this.localGraphics('HuanRiverPixelFord', this.world, x, y, 390, 160, 14);
    ford.node.setRotationFromEuler(0, 0, -12);
    const stones: Array<[number, number, number, number]> = [
      [-166, -25, 42, 24], [-126, -12, 48, 28], [-83, -28, 45, 25], [-40, -12, 52, 30],
      [8, -28, 46, 25], [52, -10, 52, 29], [101, -25, 46, 26], [148, -8, 44, 25],
      [-158, 18, 47, 27], [-111, 34, 43, 24], [-67, 17, 52, 29], [-19, 36, 45, 25],
      [26, 18, 50, 28], [73, 37, 44, 25], [115, 16, 49, 28], [159, 32, 40, 23],
    ];
    stones.forEach(([sx, sy, w, h], index) => {
      ford.fillColor = new Color(60, 72, 73, 205);
      ford.moveTo(sx - w / 2 + 5, sy - h / 2);
      ford.lineTo(sx + w / 2 - 5, sy - h / 2);
      ford.lineTo(sx + w / 2, sy - h / 2 + 5);
      ford.lineTo(sx + w / 2 - 3, sy + h / 2);
      ford.lineTo(sx - w / 2 + 4, sy + h / 2);
      ford.lineTo(sx - w / 2, sy + h / 2 - 6);
      ford.close(); ford.fill();

      const inset = 4;
      ford.fillColor = index % 3 === 0 ? new Color(154, 139, 113) : new Color(126, 126, 112);
      ford.moveTo(sx - w / 2 + inset + 4, sy - h / 2 + inset);
      ford.lineTo(sx + w / 2 - inset - 4, sy - h / 2 + inset);
      ford.lineTo(sx + w / 2 - inset, sy - h / 2 + inset + 4);
      ford.lineTo(sx + w / 2 - inset - 3, sy + h / 2 - inset);
      ford.lineTo(sx - w / 2 + inset + 3, sy + h / 2 - inset);
      ford.lineTo(sx - w / 2 + inset, sy + h / 2 - inset - 4);
      ford.close(); ford.fill();
      ford.fillColor = new Color(202, 188, 150, 195);
      ford.rect(sx - w * .24, sy + h * .06, Math.max(7, w * .35), 3); ford.fill();
    });
  }

  private inRegion(x: number, y: number, region: { left: number; right: number; bottom: number; top: number }) {
    return x >= region.left && x <= region.right && y >= region.bottom && y <= region.top;
  }

  private pointInRect(x: number, y: number, rect: RectObstacle, margin = 0) {
    return x >= rect.x - rect.w / 2 - margin && x <= rect.x + rect.w / 2 + margin && y >= rect.y - rect.h / 2 - margin && y <= rect.y + rect.h / 2 + margin;
  }

  private pointToSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
    const vx = bx - ax; const vy = by - ay;
    const lengthSquared = vx * vx + vy * vy;
    if (lengthSquared < .0001) return Math.hypot(px - ax, py - ay);
    const t = this.clamp(((px - ax) * vx + (py - ay) * vy) / lengthSquared, 0, 1);
    return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
  }

  private worldLabel(text: string, x: number, y: number, size: number, color: Color) {
    const n = new Node('WorldLabel'); n.parent = this.world; n.setPosition(x, y, 70); n.addComponent(UITransform).setContentSize(420, 70); const label = n.addComponent(Label); label.string = text; label.fontSize = size; label.lineHeight = size + 6; label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER; label.color = color; return label;
  }

  private screenLabel(text: string, x: number, y: number, size: number, color: Color) {
    const n = new Node('HudLabel'); n.parent = this.node; n.setPosition(x, y, 205); n.addComponent(UITransform).setContentSize(700, 58); const label = n.addComponent(Label); label.string = text; label.fontSize = size; label.lineHeight = size + 5; label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER; label.color = color; return label;
  }

  private screenSmallLabel(text: string, x: number, y: number, size: number, color: Color, width: number, height: number, z: number) {
    const n = new Node('WeatherHudLabel'); n.parent = this.node; n.setPosition(x, y, z); n.addComponent(UITransform).setContentSize(width, height);
    const label = n.addComponent(Label); label.string = text; label.fontSize = size; label.lineHeight = size + 3; label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER; label.color = color;
    return label;
  }

  private easeOutCubic(value: number) {
    const t = this.clamp(value, 0, 1);
    return 1 - Math.pow(1 - t, 3);
  }

  private clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
}
