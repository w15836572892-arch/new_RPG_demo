import {
  _decorator,
  Color,
  Component,
  DebugMode,
  EventKeyboard,
  EventTouch,
  Graphics,
  game,
  input,
  Input,
  KeyCode,
  Label,
  Mask,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  sys,
  Texture2D,
  UIOpacity,
  UITransform,
  Vec2,
  view,
} from 'cc';
import { HallCard, LearningHall } from './LearningHall';

const { ccclass } = _decorator;

type RectObstacle = { x: number; y: number; w: number; h: number; name: string };
type CircleObstacle = { x: number; y: number; radius: number; name: string };
type WaterSegment = { ax: number; ay: number; bx: number; by: number; radius: number; name: string };
type SwayObject = { node: Node; phase: number; amplitude: number; speed: number; reactsToPlayer?: boolean };
type Ripple = { node: Node; baseX: number; phase: number };
type CanalFlowMark = {
  node: Node; startX: number; startY: number; distance: number; horizontal: boolean; phase: number; speed: number;
};
type DepthTree = { node: Node; trunkY: number; halfWidth: number; canopyHeight: number; baseZ: number };
type DepthOccluder = {
  node: Node; footY: number; halfWidth: number; coverHeight: number; baseZ: number; foregroundZ: number;
};
type WildlifeMotion = 'swim' | 'wade' | 'hop';
type Wildlife = {
  node: Node; baseX: number; baseY: number; phase: number; speed: number; rangeX: number; rangeY: number; lastX: number;
  motion: WildlifeMotion; wake?: Node; bodyParts?: Node[]; wingParts?: Node[]; legParts?: Node[];
};
type WetlandPlantKind = 'reed' | 'grass';
type WetlandPlant = { root: Node; sprite: Sprite; variant: number };
type CropPlant = { root: Node; visual: Node; sprite: Sprite; frames: Array<SpriteFrame | null>; phase: number; x: number; y: number; bend: number; squash: number };
type TorchFlame = {
  root: Node; flame: Graphics; glow: Graphics; embers: Graphics; phase: number; intensity: number; sheltered?: boolean;
};
type Facing = 'down' | 'left' | 'right' | 'up';
type WorldMode = 'outside' | 'templeInterior';
type ToolKind = 'none' | 'shovel' | 'fishing' | 'machete';
type BackpackTab = 'tools' | 'clothing' | 'codex';
type DugHole = { node: Node; timer: number; x: number; y: number };
type ExcavationRegion = 'river' | 'field' | 'lake' | 'royal';
type ExcavationReward = {
  kind: 'oracle' | 'ink'; quality: OracleQuality | null; cardId: string | null; amount: number;
};
type ExcavationVisualState = 'idle' | 'dug';
type ExcavationSite = {
  id: string; root: Node; sprite: Sprite; glow: Graphics; x: number; y: number;
  region: ExcavationRegion; active: boolean; respawnTimer: number; holeTimer: number;
  awaitingStudy: boolean; reward: ExcavationReward;
};
type PendingExcavation = { site: ExcavationSite; timer: number; rewarded: boolean };
type RewardFlight = {
  root: Node; start: Vec2; end: Vec2; timer: number; duration: number; phase: number;
};
type DigParticle = { root: Node; vx: number; vy: number; gravity: number; life: number; maxLife: number };
type FishingCastEffect = {
  root: Node; line: Graphics; ripple: Graphics; timer: number; target: Vec2; origin: Vec2;
  playerOrigin: Vec2; castDuration: number; waitDuration: number;
};
type CutPlantRegrowth = { node: Node; timer: number };
type WeatherKind = '晴' | '雨天' | '小雨' | '中雨';
type WeatherParticle = { x: number; y: number; vx: number; vy: number; size: number; life: number; phase: number };
type RainSplash = { x: number; y: number; life: number; maxLife: number };
type Villager = {
  root: Node; visual: Node; sprite: Sprite; frames: Record<Facing, Array<SpriteFrame | null>>;
  route: Vec2[]; routeIndex: number; routeDirection: number; target: Vec2; facing: Facing; walkPhase: number; displayedFrame: number;
  velocity: Vec2; speed: number; pause: number; phase: number; facingHold: number; blockedTime: number;
  avoidanceSign: number; radius: number; workFrames: Array<SpriteFrame | null>; workIndices: number[];
  working: boolean; workTimer: number;
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
type CityOverlay = 'none' | 'shopConfirm' | 'shop' | 'backpack' | 'divination' | 'excavationLearning';
type DivinationStage = 'none' | 'waiting' | 'question' | 'animating' | 'review';
type ExcavationLearningStage = 'none' | 'question' | 'detail';
type ShopCategory = 'shell' | 'decoration' | 'rubbing';
type OracleCardData = {
  id: string; glyph: string; modern: string; pinyin: string; quality: OracleQuality;
  meaning: string; evolution: string; history: string;
  asset?: string; imageBounds?: readonly [number, number, number, number]; excavatable?: boolean;
};
type DivinationQuestion = { villager: string; prompt: string; answerId: string; portrait: 'farmer' | 'woman' };
type ShopProduct = {
  id: string; category: ShopCategory; name: string; price: number; description: string;
  quality: OracleQuality; slot?: number;
};
type LearningRecord = { attempts: number; bestStars: number; correctCount: number };
type CitySave = {
  version: number; ink: number; coins: number; experience: number;
  unlockedOracleIds: string[]; mastery: Record<string, LearningRecord>;
  ownedProductIds: string[]; equippedShellId: string; placedDecorationIds: string[];
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
  private readonly moveSpeed = 158;
  private readonly templeWalkBounds = { left: -548, right: 548, bottom: -282, top: 214 };
  private readonly templeSeatPoint = new Vec2(0, -24);
  private readonly templeRiseSafePoint = new Vec2(0, -185);
  private readonly excavationNodeWidth = 44;
  private readonly excavationNodeHeight = 32;
  private readonly EXCAVATION_VISUAL_WIDTH = 112;
  private readonly EXCAVATION_VISUAL_HEIGHTS: Record<ExcavationVisualState, number> = {
    // Preserve each trimmed PNG's exact visible-content aspect ratio.
    idle: 112 * 384 / 657,
    dug: 112 * 468 / 746,
  };
  private readonly EXCAVATION_VISUAL_GROUND_Y = -12;
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
  private readonly riverRegion = { left: -6000, right: -3800, bottom: -3000, top: -250 };
  private readonly lakeRegion = { left: -1600, right: -480, bottom: -1980, top: -1120 };
  private readonly fieldRegion = { left: 200, right: 3000, bottom: -2200, top: -400 };
  private readonly mountainRegion = { left: 3000, right: 5700, bottom: -2200, top: -400 };
  private readonly tombRegion = { left: 600, right: 5200, bottom: -4100, top: -2450 };

  private world!: Node;
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

  private playerPos = new Vec2(0, 20);
  private cameraPos = new Vec2(0, 20);
  private keyboard = new Vec2();
  private stick = new Vec2();
  private playerMotion = new Vec2();
  private touchOrigin: Vec2 | null = null;
  private obstacles: RectObstacle[] = [];
  private waterCircles: CircleObstacle[] = [];
  private waterSegments: WaterSegment[] = [];
  private waterCrossings: RectObstacle[] = [];
  private sways: SwayObject[] = [];
  private wetlandPlants: WetlandPlant[] = [];
  private wetlandPlantFrames: Array<SpriteFrame | null> = [null, null, null, null, null];
  private wetlandPlantFramesRequested = false;
  private previousWetlandPlantVariant = -1;
  private ripples: Ripple[] = [];
  private canalFlowMarks: CanalFlowMark[] = [];
  private depthTrees: DepthTree[] = [];
  private depthOccluders: DepthOccluder[] = [];
  private fixedForegroundNodes: Node[] = [];
  private wildlife: Wildlife[] = [];
  private cropPlants: CropPlant[] = [];
  private torchFlames: TorchFlame[] = [];
  private torchRenderTimer = 0;
  private villagers: Villager[] = [];
  private restingVillager: RestingVillager | null = null;
  private horseCarts: HorseCart[] = [];
  private frameCache = new Map<string, SpriteFrame>();
  private frameWaiters = new Map<string, Array<(frame: SpriteFrame) => void>>();
  private excavationFrames: Record<ExcavationVisualState, SpriteFrame | null> = { idle: null, dug: null };
  private excavationFramesRequested = false;
  private playerFrames: Record<Facing, Array<SpriteFrame | null>> = {
    down: [null, null, null, null],
    left: [null, null, null, null],
    right: [null, null, null, null],
    up: [null, null, null, null],
  };
  private facing: Facing = 'down';
  private displayedPlayerFrame = -1;
  private elapsed = 0;
  private walkPhase = 0;
  private blocked = false;
  private weather: WeatherKind = '晴';
  private weatherChangeTimer = 55;
  private precipitation: WeatherParticle[] = [];
  private rainSplashes: RainSplash[] = [];
  private weatherRenderTimer = 0;
  private readonly saveKey = 'yinxu-city-save-v1';
  private readonly divinationInkCost = 4;
  private readonly oracleCards: OracleCardData[] = [
    {
      id: 'rain', glyph: '⋮', modern: '雨', pinyin: 'yǔ', quality: 'blue',
      meaning: '表示从天空降下的雨水，是观察自然天气的重要文字。',
      evolution: '占位字形将在正式甲骨资料到位后替换；交互、题库和学习记录无需重写。',
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
      id: 'field', glyph: '⊞', modern: '田', pinyin: 'tián', quality: 'red',
      meaning: '表示划分整齐的耕地，与播种、收获和田猎活动有关。',
      evolution: '正式版本将替换为对应甲骨拓片和田块象形结构。',
      history: '甲骨卜辞中常见对收成、田猎和土地事务的占问。',
    },
    {
      id: 'water-temp', glyph: '◇', modern: '水（临）', pinyin: 'shuǐ', quality: 'blue',
      meaning: '临时收藏位：表示水流与水边生活，正式甲骨字形将后续替换。',
      evolution: '当前使用统一符号验证发掘、收藏与学习流程。',
      history: '洹水河畔出土的普通蓝光卜骨，与渔猎、水事记录相关。',
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
      id: 'earth-temp', glyph: '⊙', modern: '土（临）', pinyin: 'tǔ', quality: 'blue',
      meaning: '表现地面上隆起的土块或土堆，用于表示土地。',
      evolution: '临时符号强调地面与土堆；正式字库将展示字形逐渐规整的过程。',
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
  ];
  private readonly divinationQuestions: DivinationQuestion[] = [
    { villager: '阿禾', prompt: '卜官大人，明日是否会有雨？田里的禾苗正等着水呢。', answerId: 'rain', portrait: 'farmer' },
    { villager: '妣青', prompt: '云散了许久，何时才能重新见到太阳？', answerId: 'sun', portrait: 'woman' },
    { villager: '田伯', prompt: '今年新开的土地能否带来好收成？请替我们占问。', answerId: 'field', portrait: 'farmer' },
  ];
  private readonly shopProducts: ShopProduct[] = [
    { id: 'shell-clay', category: 'shell', name: '素面占卜龟甲', price: 0, description: '宗庙初始使用的朴素龟甲，保留自然灼裂纹理。', quality: 'blue' },
    { id: 'shell-vermilion', category: 'shell', name: '涂朱占卜龟甲', price: 180, description: '朱砂沿裂纹缓慢亮起，改变占卜龟甲与成功动画。', quality: 'red' },
    { id: 'shell-gold', category: 'shell', name: '鎏金王室龟甲', price: 420, description: '金色裂纹与祭祀光点环绕的珍贵龟甲外观。', quality: 'gold' },
    { id: 'decor-ding', category: 'decoration', name: '青铜鼎', price: 120, description: '放置在宗庙院落的固定陈设位。', quality: 'red', slot: 0 },
    { id: 'decor-oracle-stand', category: 'decoration', name: '甲骨展示台', price: 150, description: '放置在集市入口的固定陈设位。', quality: 'blue', slot: 1 },
    { id: 'decor-millet', category: 'decoration', name: '禾苗陶盆', price: 90, description: '放置在水井旁的固定陈设位。', quality: 'blue', slot: 2 },
    { id: 'decor-jars', category: 'decoration', name: '陶瓮组合', price: 110, description: '放置在民居街角的固定陈设位。', quality: 'blue', slot: 3 },
    { id: 'decor-lamp', category: 'decoration', name: '祭祀灯架', price: 220, description: '放置在宗庙外侧的固定陈设位。', quality: 'red', slot: 4 },
    { id: 'decor-banner', category: 'decoration', name: '卜官旗幡', price: 260, description: '放置在南北主路的固定陈设位。', quality: 'gold', slot: 5 },
    { id: 'rubbing-water', category: 'rubbing', name: '洹水卜辞拓片', price: 80, description: '收录洹水、求雨与渔猎主题的收藏页。', quality: 'blue' },
    { id: 'rubbing-harvest', category: 'rubbing', name: '丰收卜辞拓片', price: 140, description: '收录田猎与农耕主题的进阶收藏页。', quality: 'red' },
    { id: 'rubbing-royal', category: 'rubbing', name: '王室祭祀拓片', price: 300, description: '收录王室祭祀主题的鎏金收藏页。', quality: 'gold' },
  ];
  private save!: CitySave;
  private overlay: CityOverlay = 'none';
  private divinationStage: DivinationStage = 'none';
  private overlayRoot: Node | null = null;
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
  private templeCollisionDebug: Node | null = null;
  private templeCollisionDebugGraphics: Graphics | null = null;
  private templePreSitPosition: Vec2 | null = null;
  private templePreSitFacing: Facing = 'down';
  private templePreSitWorldMode: WorldMode = 'templeInterior';
  private templeLastRisePosition: Vec2 | null = null;
  private seated = false;
  private currentQuestion: DivinationQuestion | null = null;
  private currentQuestionIndex = -1;
  private currentAttempts = 0;
  private queueTimer = 0;
  private divinationAnimationTimer = 0;
  private divinationText: Label | null = null;
  private divinationName: Label | null = null;
  private riseButtonLabel: Label | null = null;
  private oracleCardNodes: Node[] = [];
  private oracleCardHome: Vec2[] = [];
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
  private rewardFlights: RewardFlight[] = [];
  private digParticles: DigParticle[] = [];
  private fishingCastEffect: FishingCastEffect | null = null;
  private cutPlantRegrowth: CutPlantRegrowth[] = [];
  private backpackDetailLabel: Label | null = null;
  private selectedShopCategory: ShopCategory = 'shell';
  private selectedShopProductIndex = 0;
  private shopFeedback: Label | null = null;
  private decorationNodes = new Map<string, Node>();
  private previewDepthSpot = 0;
  private learningHall!: LearningHall;

  onLoad() {
    this.save = this.loadCitySave();
    this.buildWorld();
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    this.learningHall = this.node.addComponent(LearningHall);
    this.learningHall.initialize({
      getCards: () => this.oracleCards.filter(card => Boolean(card.asset) || card.id === 'water-temp').map(card => ({
        id: card.id, glyph: card.glyph, modern: this.oracleModernCharacter(card), pinyin: card.pinyin,
        quality: card.quality, meaning: card.meaning, evolution: card.evolution, history: card.history,
        asset: card.asset ?? (card.id === 'water-temp' ? 'shui' : undefined),
        imageBounds: card.imageBounds ?? (card.id === 'water-temp' ? [24, 50, 76, 127] : undefined),
        unlocked: this.save.unlockedOracleIds.includes(card.id),
      } satisfies HallCard)),
      getProgress: () => ({
        ink: this.save.ink,
        attempts: Object.values(this.save.mastery).reduce((sum, record) => sum + record.attempts, 0),
        correct: Object.values(this.save.mastery).reduce((sum, record) => sum + record.correctCount, 0),
      }),
      recordReview: (cardId, correct) => {
        const record = this.save.mastery[cardId] ?? { attempts: 0, bestStars: 0, correctCount: 0 };
        record.attempts++;
        if (correct) record.correctCount++;
        this.save.mastery[cardId] = record;
        this.persistCitySave();
      },
      enterYinXu: () => {
        this.playerPos.set(0, 20);
        this.cameraPos.set(0, 20);
        this.player?.setPosition(0, 20, 80);
        this.followCamera(1);
      },
    });
    const previewSearch = (globalThis as { location?: { search?: string } }).location?.search ?? '';
    if (sys.isBrowser && /(?:^|[?&])oracleQa=1(?:&|$)/.test(previewSearch)) {
      this.scheduleOnce(() => this.openOracleQaPreview(), .65);
    }
  }

  onDestroy() {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  update(dt: number) {
    this.elapsed += dt;
    this.updateCityGameplay(dt);
    const movementAllowed = this.overlay === 'none' && !this.seated && this.toolActionTimer <= 0 && !this.learningHall?.isOpen;
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
      if (this.worldMode === 'templeInterior') this.moveTemplePlayerWithCollision(dx, dy);
      else {
        if (this.canPlayerStand(this.playerPos.x + dx, this.playerPos.y)) this.playerPos.x += dx;
        else if (Math.abs(dx) > .01) this.blocked = true;
        if (this.canPlayerStand(this.playerPos.x, this.playerPos.y + dy)) this.playerPos.y += dy;
        else if (Math.abs(dy) > .01) this.blocked = true;
      }
    }

    const movedDistance = Math.hypot(this.playerPos.x - oldX, this.playerPos.y - oldY);
    const moving = movedDistance > .01;
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
    this.followCamera(dt);
    this.updateHud();
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
    this.ripples = [];
    this.canalFlowMarks = [];
    this.depthTrees = [];
    this.depthOccluders = [];
    this.fixedForegroundNodes = [];
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
    this.fishingCastEffect = null;
    this.cutPlantRegrowth = [];
    this.toolActionTimer = 0;
    this.statusNotice = '';
    this.statusNoticeTimer = 0;
    this.worldMode = 'outside';
    this.interiorObstacles = [];
    this.templeInterior?.destroy();
    this.templeInterior = null;

    this.world = new Node('DynamicWorld');
    this.world.parent = this.node;
    this.world.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);

    this.drawGroundTiles();
    this.drawPixelGroundOverlay();
    this.drawRoads();
    this.drawRiver();
    this.drawTransitionForest();
    this.drawCityWallsAndGate();
    this.drawTemple();
    this.drawVillage();
    this.drawMarket();
    this.drawTownDetails();
    this.createDecorationSlots();
    this.drawFields();
    this.drawForest();
    this.drawOraclePit();
    this.createExcavationSites();
    this.scatterDynamicGrass();
    this.drawWorldBoundary();
    this.createWeatherOverlay();
    this.createTempleInterior();
    this.player = this.createAnimatedPlayer();
    this.player.setPosition(this.playerPos.x, this.playerPos.y, 80);
    this.createVillagers();
    this.createHorseCarts();
    this.createRestingTreeVillager();
    // UI renderers respect sibling order; move only the gate canopy in front
    // after creating the player so the body disappears beneath the lintel.
    this.fixedForegroundNodes.forEach(node => {
      if (node.isValid) node.setSiblingIndex(this.world.children.length - 1);
    });
    this.drawHud();
    this.equipTool(this.equippedTool);
    this.setWeather(this.pickRandomWeather(), true);
    this.followCamera(1);
  }

  private drawGroundTiles() {
    const g = this.graphics('GroundTiles', this.world, 0);
    const halfW = this.mapWidth / 2;
    const halfH = this.mapHeight / 2;
    // Large procedural color fields keep the expanded world lightweight. Pixel
    // texture chunks and local props provide the close-up variation.
    g.fillColor = new Color(98, 148, 73); g.rect(-halfW, -halfH, this.mapWidth, this.mapHeight); g.fill();
    g.fillColor = new Color(205, 169, 104); g.rect(-1080, -240, 2160, 1480); g.fill();
    g.fillColor = new Color(110, 158, 85); g.rect(this.riverRegion.left, this.riverRegion.bottom, this.riverRegion.right - this.riverRegion.left, this.riverRegion.top - this.riverRegion.bottom); g.fill();
    g.fillColor = new Color(176, 143, 81); g.rect(this.fieldRegion.left, this.fieldRegion.bottom, this.fieldRegion.right - this.fieldRegion.left, this.fieldRegion.top - this.fieldRegion.bottom); g.fill();
    g.fillColor = new Color(128, 137, 74); g.rect(3000, -2200, 800, 1800); g.fill();
    g.fillColor = new Color(119, 121, 66); g.rect(3800, -2200, 900, 1800); g.fill();
    g.fillColor = new Color(145, 126, 70); g.rect(4700, -2200, 1000, 1800); g.fill();
    g.fillColor = new Color(126, 89, 58); g.rect(this.tombRegion.left, this.tombRegion.bottom, this.tombRegion.right - this.tombRegion.left, this.tombRegion.top - this.tombRegion.bottom); g.fill();

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
  private drawPixelGroundOverlay() {
    const chunk = 384;
    const halfW = this.mapWidth / 2;
    for (let y = -4200 + chunk / 2; y < 1400; y += chunk) {
      for (let x = -halfW + chunk / 2; x < halfW; x += chunk) {
        const insideCity = y > -240 && y < 1240 && Math.abs(x) < 1080;
        const insideField = this.inRegion(x, y, this.fieldRegion);
        const insideTomb = this.inRegion(x, y, this.tombRegion);
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
    const riverPoints: Array<[number, number]> = [
      [-6150, -470], [-5660, -500], [-5200, -720], [-4680, -650], [-4120, -940],
      [-4520, -1230], [-5120, -1160], [-5660, -1450], [-5300, -1780],
      [-4700, -1700], [-4070, -2030], [-4520, -2350], [-5200, -2290],
      [-5670, -2570], [-6150, -2730],
    ];

    const bankShadow = this.graphics('HuanRiverOuterBankShadow', this.world, 3);
    bankShadow.strokeColor = new Color(82, 86, 68, 220); bankShadow.lineWidth = 548;
    this.strokeSmoothPath(bankShadow, riverPoints); bankShadow.stroke();
    const raisedGrass = this.graphics('HuanRiverRaisedGrassBank', this.world, 4);
    raisedGrass.strokeColor = new Color(112, 127, 67); raisedGrass.lineWidth = 516;
    this.strokeSmoothPath(raisedGrass, riverPoints); raisedGrass.stroke();
    const bank = this.graphics('HuanRiverSoilBank', this.world, 4);
    bank.strokeColor = new Color(168, 119, 59); bank.lineWidth = 474;
    this.strokeSmoothPath(bank, riverPoints); bank.stroke();
    const wetBank = this.graphics('HuanRiverWetBank', this.world, 5);
    wetBank.strokeColor = new Color(215, 167, 88); wetBank.lineWidth = 416;
    this.strokeSmoothPath(wetBank, riverPoints); wetBank.stroke();
    const deepWater = this.graphics('HuanRiverDeepWater', this.world, 6);
    deepWater.strokeColor = new Color(54, 72, 64); deepWater.lineWidth = 372;
    this.strokeSmoothPath(deepWater, riverPoints); deepWater.stroke();
    const flowingWater = this.graphics('HuanRiverFlowingWater', this.world, 7);
    flowingWater.strokeColor = new Color(54, 127, 160); flowingWater.lineWidth = 330;
    this.strokeSmoothPath(flowingWater, riverPoints); flowingWater.stroke();
    const riverDepth = this.graphics('HuanRiverDeepCurrentBasin', this.world, 8);
    riverDepth.strokeColor = new Color(17, 65, 99, 90); riverDepth.lineWidth = 170;
    this.strokeSmoothPath(riverDepth, riverPoints); riverDepth.stroke();
    const current = this.graphics('HuanRiverCurrent', this.world, 8);
    current.strokeColor = new Color(78, 145, 171, 34); current.lineWidth = 9;
    this.strokeSmoothPath(current, riverPoints); current.stroke();
    this.drawRiverPixelTexture(riverPoints);
    this.drawDetailedRiverBanks(riverPoints);
    this.drawHuanLake();

    for (let i = 0; i < riverPoints.length - 1; i++) {
      const a = riverPoints[i]; const b = riverPoints[i + 1];
      this.waterSegments.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], radius: 166, name: '洹水深水区' });
    }
    this.waterCrossings.push({ x: -5220, y: -790, w: 390, h: 124, name: '洹水浅滩' });

    const road = this.graphics('RiversideApproachRoad', this.world, 7);
    road.strokeColor = new Color(155, 119, 70); road.lineWidth = 76;
    this.strokeSmoothPath(road, [[0, -760], [-900, -770], [-1800, -820], [-2850, -770], [-3900, -820], [-5220, -790]]); road.stroke();
    this.drawPixelFord(-5220, -790);

    const ripplePositions = [
      [-5900, -480], [-5550, -530], [-5200, -735], [-4740, -665], [-4230, -930],
      [-4540, -1220], [-5100, -1170], [-5540, -1440], [-5280, -1770], [-4720, -1700],
      [-4170, -2030], [-4540, -2340], [-5140, -2295], [-5660, -2560],
    ];
    ripplePositions.forEach((p, i) => {
      const ripple = this.localGraphics(`WaterRipple${i}`, this.world, p[0], p[1], 90, 40, 10);
      ripple.strokeColor = new Color(126, 181, 190, 175); ripple.lineWidth = 3;
      ripple.moveTo(-24, 0); ripple.quadraticCurveTo(0, 9, 28, 0); ripple.stroke();
      this.ripples.push({ node: ripple.node, baseX: p[0], phase: i * .71 });
    });

    this.createWildlifeSprite('RiverFishA', 'river-fish', -5200, -1160, 112, 78, 16, 96, 22, .72, .42);
    this.createWildlifeSprite('RiverFishB', 'river-fish', -4520, -2350, 104, 72, 16, 82, 18, 1.8, .48);
    this.createAnimatedEgret('RiverEgretA', -4650, -820, 19, 36, 14, .4, .28);
    this.createAnimatedEgret('RiverEgretB', -5300, -1900, 19, 42, 12, 2.2, .25);
    this.createAnimatedDuckPair('RiverDucks', -4720, -1710, 18, 120, 34, 1.1, .34);
    this.createWildlifeSprite('RiverFrog', 'river-frog-dragonfly', -4100, -2110, 82, 72, 18, 28, 12, 2.7, .4);
    this.worldLabel('洹水河畔', -5700, -310, 25, new Color(226, 242, 206));
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
    this.createWallSegment('北夯土城墙', 0, 1450, 2600, 64);
    this.createWallSegment('西夯土城墙', -1300, 605, 64, 1690);
    this.createWallSegment('东夯土城墙', 1300, 605, 64, 1690);
    this.createWallSegment('南城墙左段', -745, -240, 1110, 64);
    this.createWallSegment('南城墙右段', 745, -240, 1110, 64);
    const leftWallEnd = this.pixelSprite('SouthWallLeftEnd', 'city-wall-end-v2', this.world, -190, -222, 132, 154, 40);
    const rightWallEnd = this.pixelSprite('SouthWallRightEnd', 'city-wall-end-v2', this.world, 190, -222, 132, 154, 40);
    rightWallEnd.setScale(-1, 1, 1);
    leftWallEnd.setScale(1, 1, 1);

    const gate = this.graphics('SouthGateVisual', this.world, 42);
    gate.fillColor = new Color(92, 57, 36);
    gate.rect(-169, -275, 48, 150); gate.rect(121, -275, 48, 150); gate.fill();
    gate.fillColor = new Color(143, 57, 43);
    gate.rect(-195, -146, 390, 42); gate.fill();
    gate.fillColor = new Color(67, 47, 34);
    for (let x = -158; x <= 158; x += 32) { gate.rect(x, -236, 7, 90); gate.fill(); }
    this.pixelSprite('SouthGateThreshold', 'south-gate-threshold-v2', this.world, 0, -252, 260, 180, 39);
    this.pixelSprite('SouthGatePixelArt', 'south-gate', this.world, 0, -165, 420, 325, 44);
    // The foreground canopy renders above the player so crossing the opening
    // reads as walking underneath a gatehouse rather than over a flat picture.
    const gateCanopy = this.pixelSprite('SouthGateForegroundCanopy', 'south-gate-canopy-v2', this.world, 0, -112, 400, 176, 106);
    this.fixedForegroundNodes.push(gateCanopy);
    // Only the two tower plinths collide. The tall art remains an occluder, so
    // an actor crossing north of the threshold walks underneath the gatehouse.
    this.addObstacle(-154, -296, 108, 34, '城门左门楼基座');
    this.addObstacle(154, -296, 108, 34, '城门右门楼基座');
    this.worldLabel('南城门', 0, -38, 18, new Color(255, 239, 190));
  }

  private createWallSegment(name: string, x: number, y: number, w: number, h: number) {
    const g = this.graphics(name, this.world, 35);
    g.fillColor = new Color(108, 72, 43, 175); g.roundRect(-w / 2, -h / 2, w, h, 9); g.fill();
    g.strokeColor = new Color(74, 53, 36, 190); g.lineWidth = 4; g.roundRect(-w / 2, -h / 2, w, h, 9); g.stroke();
    if (w > h) for (let px = -w / 2 + 20; px < w / 2; px += 70) { g.moveTo(px, -h / 2); g.lineTo(px + 18, h / 2); }
    else for (let py = -h / 2 + 20; py < h / 2; py += 70) { g.moveTo(-w / 2, py); g.lineTo(w / 2, py + 18); }
    g.stroke(); g.node.setPosition(x, y);

    const horizontal = w > h;
    const step = 190;
    const length = horizontal ? w : h;
    for (let offset = -length / 2 + step / 2; offset < length / 2; offset += step) {
      this.pixelSprite(
        `${name}Pixel`,
        horizontal ? 'city-wall-horizontal-v2' : 'city-wall-vertical-v2',
        this.world,
        horizontal ? x + offset : x,
        horizontal ? y : y + offset,
        horizontal ? step + 18 : 126,
        horizontal ? 142 : step + 18,
        38,
      );
    }
    this.addObstacle(
      horizontal ? x : x,
      horizontal ? y - h * .34 : y,
      horizontal ? w : Math.min(28, w),
      horizontal ? Math.max(18, h * .3) : h,
      `${name}基座`,
    );
  }

  private drawTemple() {
    this.createTempleForecourt();
    this.createBuilding('占卜宗庙', 0, 1190, 360, 210, new Color(181, 117, 68), new Color(86, 55, 39), null);
    this.pixelSprite('DivinationTemplePixelArt', 'divination-temple', this.world, 0, 1210, 440, 375, 34);
    this.worldLabel('占卜宗庙', 0, 1400, 22, new Color(100, 48, 31));
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
        const y = 898 + row * 36 + ((col * 7 + row * 3) % 5 - 2);
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

    // The central processional path continues the town road through a shallow
    // drain and up to the temple threshold.
    for (let row = 0; row < 7; row++) {
      const y = 858 + row * 29;
      const x = row % 2 === 0 ? -3 : 4;
      court.fillColor = row % 3 === 0 ? new Color(177, 149, 96) : new Color(151, 128, 88);
      court.roundRect(x - 34, y - 12, 68, 25, 4); court.fill();
      court.fillColor = new Color(213, 181, 116, 110);
      court.rect(x - 22, y + 5, 24, 2); court.fill();
    }
    court.fillColor = new Color(70, 71, 58, 180);
    court.rect(-245, 875, 490, 7); court.fill();
    court.fillColor = new Color(109, 126, 77, 190);
    for (let x = -235; x <= 235; x += 47) {
      if (Math.abs(x) < 48) continue;
      court.rect(x, 881 + Math.abs(x % 3), 3, 12 + Math.abs(x % 7));
      court.rect(x + 6, 880, 2, 8); court.fill();
    }
    court.fillColor = new Color(86, 66, 47, 170);
    [-248, 248].forEach(x => {
      for (let y = 900; y <= 1005; y += 28) court.roundRect(x - 7, y - 9, 14, 19, 3);
    });
    court.fill();

    const threshold = this.localGraphics('TempleDoorThresholdDetail', this.world, 0, 1025, 130, 42, 36);
    threshold.fillColor = new Color(63, 48, 38, 175); threshold.rect(-61, -12, 122, 24); threshold.fill();
    threshold.fillColor = new Color(177, 151, 101); threshold.rect(-55, -5, 110, 13); threshold.fill();
    threshold.strokeColor = new Color(91, 71, 50); threshold.lineWidth = 2;
    [-33, 4, 38].forEach(x => { threshold.moveTo(x, -4); threshold.lineTo(x + 8, 7); }); threshold.stroke();
  }

  private createAnimatedTorch(x: number, y: number, index: number) {
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
      { x: 0, y: -102, w: 250, h: 108, name: '中央占卜案桌' },
      // The visible chair content occupies roughly 88x104 inside its 94x112
      // display node. This blocks ordinary walking through the back, seat,
      // arms and feet while the scripted sit placement remains unrestricted.
      { x: 0, y: -24, w: 88, h: 104, name: '指定占卜座椅接地范围' },
    ];
  }

  private createTempleInteriorCollisionDebug(root: Node) {
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

  private updateTempleSeatDepthOrdering() {
    const chair = this.templeChairVisualRoot;
    const table = this.templeTableVisual;
    if (!chair?.isValid || !table?.isValid || chair.parent !== table.parent) return;

    const playerIsInRoom = this.player?.isValid && this.player.parent === table.parent;
    // The player node is its foot point. North/above the table foot line means
    // the tabletop must cover the actor; south of it the actor is in front.
    const playerOverlapsTable = Math.abs(this.playerPos.x) <= 125 + this.templeFootHalfWidth;
    const tableCoversPlayer = playerIsInRoom && (this.seated
      || (playerOverlapsTable && this.playerPos.y >= -156));
    chair.setPosition(chair.position.x, chair.position.y, 68);
    table.setPosition(table.position.x, table.position.y, tableCoversPlayer ? 98 : 76);

    const ensureBefore = (earlier: Node, later: Node) => {
      if (earlier.getSiblingIndex() > later.getSiblingIndex()) earlier.setSiblingIndex(later.getSiblingIndex());
    };
    if (!playerIsInRoom) {
      ensureBefore(chair, table);
      return;
    }
    if (tableCoversPlayer) {
      ensureBefore(chair, this.player);
      ensureBefore(this.player, table);
      // The first move can shift the other pair; normalize once more.
      ensureBefore(chair, this.player);
    } else {
      ensureBefore(chair, table);
      ensureBefore(table, this.player);
      ensureBefore(chair, table);
    }
  }

  private enterTempleInterior() {
    if (this.overlay !== 'none' || this.worldMode !== 'outside' || !this.templeInterior?.isValid) return;
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
  }

  private exitTempleInterior() {
    if (this.overlay !== 'none' || this.seated || this.worldMode !== 'templeInterior') return;
    this.stopPlayerInput();
    if (this.templeInterior?.isValid) this.templeInterior.active = false;
    this.world.active = true;
    this.player.parent = this.world;
    this.worldMode = 'outside';
    this.playerPos.set(0, 950);
    this.player.setPosition(0, 950, 80);
    this.cameraPos.set(0, 950);
    this.facing = 'down'; this.displayedPlayerFrame = -1; this.showPlayerFrame(0);
    if (this.weatherParticleNode?.isValid) this.weatherParticleNode.active = true;
    this.drawWeatherParticles(this.weather !== '晴');
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
    this.createVillageWell(245, 620);
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
    this.addObstacle(1160, 507, 48, 20, '集市陶罐底座');
    this.addObstacle(820, 512, 52, 22, '集市箱笼底座');
  }

  private drawFields() {
    const boundary = this.graphics('FieldLowEarthBoundary', this.world, 4);
    boundary.fillColor = new Color(112, 77, 46);
    boundary.rect(200, -450, 2800, 70);
    boundary.rect(200, -2200, 2030, 70); boundary.rect(2370, -2200, 630, 70);
    boundary.rect(2965, -690, 70, 240); boundary.rect(2965, -2200, 70, 1360); boundary.fill();
    boundary.fillColor = new Color(151, 112, 61);
    boundary.rect(200, -435, 2800, 18); boundary.rect(200, -2165, 2030, 18); boundary.rect(2370, -2165, 630, 18); boundary.fill();
    this.addObstacle(1600, -415, 2800, 70, '田野北侧土坡');
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
    [-570, -930, -1100, -1270, -1440, -1610, -1780, -1950, -2110].forEach((y, i) => {
      this.pixelSprite('FieldEastRidgePixel', 'wall-vertical', this.world, 3000, y, 84, 178, 13);
      if (i % 3 === 1) {
        this.pixelSprite('FieldEastRidgeStone', 'field-stone-cluster', this.world, 2948, y + 34, 72, 60, 14);
      }
    });

    const roads = this.graphics('FieldRoadNetwork', this.world, 5);
    roads.fillColor = new Color(174, 132, 73);
    roads.rect(0, -808, 3000, 96);
    [1100, 1700, 2300].forEach(x => roads.rect(x - 24, -2100, 48, 1270));
    roads.rect(300, -1729, 2660, 48); roads.fill();
    roads.strokeColor = new Color(119, 91, 56, 170); roads.lineWidth = 3;
    roads.moveTo(0, -712); roads.lineTo(3000, -712); roads.moveTo(0, -808); roads.lineTo(3000, -808); roads.stroke();
    for (let x = 100; x <= 2900; x += 120) {
      const tile = this.pixelSprite('FieldMainRoadTile', 'road-straight', this.world, x, -760, 104, 88, 6);
      tile.setRotationFromEuler(0, 0, 90);
    }
    [1100, 1700, 2300].forEach((x, index) => {
      this.drawDirtRoadJunction(x, -760, 50 + index, 46, 8);
      this.drawDirtRoadJunction(x, -1729, 60 + index, 35, 8);
    });

    // Half-height mud fencing follows the trunk road, with deliberate openings
    // for the three farm lanes and the eastern mountain pass.
    for (let x = 310; x <= 2870; x += 178) {
      if ([1100, 1700, 2300].some(gap => Math.abs(x - gap) < 105)) continue;
      this.pixelSprite('FieldRoadFenceNorth', 'mud-fence-straight', this.world, x, -675, 158, 76, 14);
      this.pixelSprite('FieldRoadFenceSouth', 'mud-fence-straight', this.world, x, -846, 158, 76, 14);
      // Adjacent collision strips overlap slightly, leaving openings only at
      // the authored lanes instead of tiny gaps where an actor can climb on.
      this.addObstacle(x, -701, 170, 18, '田野路边北矮墙基座');
      this.addObstacle(x, -872, 170, 18, '田野路边南矮墙基座');
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
    this.drawLayeredIrrigationCanal('FieldMainCanal', 1630, -1270, 2620, 88, true, 8);
    [800, 1400, 2000, 2600].forEach((x, branchIndex) => {
      this.drawLayeredIrrigationCanal(`FieldBranchCanal${branchIndex}`, x, -1725, 750, 30, false, 8);
      this.drawIrrigationJunction(x, -1270, branchIndex);
      this.addObstacle(x, -1510, 28, 290, '田间支渠');
      this.addObstacle(x, -1925, 28, 350, '田间支渠');
    });
    let canalStart = 320;
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

    this.createVillageWell(350, -1080);
    this.drawLayeredIrrigationCanal('WellFeederChannel', 350, -1200, 150, 24, false, 9);
    this.drawIrrigationJunction(350, -1270, 8);
    const outlet = this.localGraphics('AnimatedWellOutlet', this.world, 350, -1126, 72, 56, 13);
    outlet.fillColor = new Color(61, 52, 41); outlet.rect(-24, 8, 48, 13); outlet.fill();
    outlet.fillColor = new Color(39, 88, 111); outlet.rect(-15, -4, 30, 15); outlet.fill();
    outlet.fillColor = new Color(104, 174, 188, 220); outlet.rect(-9, -15, 18, 17); outlet.fill();

    for (let x = 420, index = 0; x <= 2840; x += 145, index++) {
      this.createCanalFlowMark(x, -1270, true, index * .17, 72 + index % 3 * 8);
    }
    [800, 1400, 2000, 2600].forEach((x, branchIndex) => {
      for (let y = -1390, index = 0; y >= -2040; y -= 135, index++) {
        this.createCanalFlowMark(x, y, false, branchIndex * .21 + index * .16, 78);
      }
    });
    this.createCanalFlowMark(350, -1144, false, .1, 96);

    this.createFieldStorehouse('东北粮仓一', 2180, -555, 'field-storehouse-a');
    this.createFieldStorehouse('东北粮仓二', 2520, -555, 'field-storehouse-b');
    this.createFieldStorehouse('东北草料仓', 2860, -555, 'field-shelter');
    [2035, 2215, 2395, 2575, 2755, 2935].forEach(x => {
      this.pixelSprite('GranaryFence', 'mud-fence-straight', this.world, x, -430, 150, 72, 15);
      this.addObstacle(x, -454, 170, 18, '粮仓外矮墙基座');
    });

    this.pixelSprite('FieldStrawPileA', 'straw-stack', this.world, 690, -610, 112, 126, 18);
    this.addObstacle(690, -667, 66, 22, '田野草垛底座');
    this.pixelSprite('FieldStrawPileB', 'straw-stack', this.world, 2050, -885, 98, 112, 18);
    this.addObstacle(2050, -936, 58, 20, '田野草垛底座');
    this.pixelSprite('FieldStoneMill', 'stone-mill', this.world, 1430, -620, 124, 112, 19);
    this.pixelSprite('FieldWaterUrnA', 'field-water-urn', this.world, 1850, -875, 102, 110, 19);
    this.addObstacle(1430, -667, 70, 24, '田野石磨基座'); this.addObstacle(1850, -924, 46, 22, '田野储水瓮基座');

    [[430, -510], [2870, -930], [430, -2040], [2860, -2035]].forEach((p, i) => this.createTree(p[0], p[1], 100 + i));
    // Keep roadside tree trunks behind the north fence so the two-tile trunk
    // road remains continuously traversable.
    [[520, -555], [1280, -560], [1910, -555]].forEach((p, i) => this.createTreeSized(p[0], p[1], 120 + i, .72));
    [[420, -880], [900, -1400], [1550, -1370], [2240, -1390], [2860, -1460]].forEach((p, i) => this.pixelSprite(`JujubeBush${i}`, 'jujube-bush', this.world, p[0], p[1], 86, 78, 13));
    [[300, -520], [580, -2110], [980, -2110], [1540, -2110], [2050, -2110], [2700, -2110], [2920, -1050]].forEach((p, i) => this.pixelSprite(`FoxtailGrass${i}`, 'foxtail-grass', this.world, p[0], p[1], 68, 74, 12));
    [[360, -2050], [1020, -2050], [1660, -2080], [2710, -2070], [2890, -1170]].forEach((p, i) => this.pixelSprite(`FieldBoundaryStone${i}`, 'field-stone-cluster', this.world, p[0], p[1], 92, 78, 12));
    this.worldLabel('郊外田野', 1420, -475, 25, new Color(92, 65, 38));
  }

  private createCanalBridgeRails(x: number, y: number, wide: boolean) {
    const railX = wide ? 76 : 53;
    const railWidth = wide ? 28 : 24;
    const halfHeight = 82;
    // Side rails are separate foreground geometry. The deck remains behind the
    // actor, while posts and ropes cover the actor only at the physical edge.
    const rails = this.localGraphics(
      wide ? 'WideBridgeForegroundRails' : 'FootbridgeForegroundRails',
      this.world, x, y, wide ? 220 : 150, 190, 106,
    );
    [-1, 1].forEach(side => {
      const px = railX * side;
      rails.fillColor = new Color(47, 35, 29, 130);
      rails.roundRect(px - railWidth / 2 - 3, -halfHeight - 3, railWidth + 6, halfHeight * 2 + 6, 7); rails.fill();
      rails.fillColor = new Color(105, 65, 36);
      rails.roundRect(px - railWidth / 2, -halfHeight, railWidth, halfHeight * 2, 6); rails.fill();
      rails.fillColor = new Color(176, 116, 55);
      rails.rect(px - railWidth * .27, -halfHeight + 8, railWidth * .54, halfHeight * 2 - 16); rails.fill();
      [-72, 0, 72].forEach(postY => {
        rails.fillColor = new Color(63, 43, 31); rails.roundRect(px - railWidth * .68, postY - 12, railWidth * 1.36, 24, 5); rails.fill();
        rails.fillColor = new Color(191, 131, 61); rails.roundRect(px - railWidth * .5, postY - 9, railWidth, 18, 4); rails.fill();
        rails.strokeColor = new Color(224, 172, 83); rails.lineWidth = 2;
        rails.moveTo(px - railWidth * .5, postY - 2); rails.lineTo(px + railWidth * .5, postY + 3); rails.stroke();
      });
    });
    this.fixedForegroundNodes.push(rails.node);
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
    const drawBand = (width: number, color: Color, offsetY = 0, seedOffset = 0) => {
      const top: Array<[number, number]> = [];
      const bottom: Array<[number, number]> = [];
      const amplitude = Math.max(2, Math.min(9, width * .09));
      for (let index = 0; index <= segments; index++) {
        const px = -length / 2 + length * index / segments;
        const topStep = (((index * 7 + name.length + seedOffset) % 5) - 2) * amplitude * .42;
        const bottomStep = (((index * 11 + name.length + seedOffset * 3) % 5) - 2) * amplitude * .42;
        top.push([Math.round(px / 3) * 3, Math.round((width / 2 + offsetY + topStep) / 3) * 3]);
        bottom.push([Math.round(px / 3) * 3, Math.round((-width / 2 + offsetY - bottomStep) / 3) * 3]);
      }
      g.fillColor = color;
      g.moveTo(top[0][0], top[0][1]);
      top.slice(1).forEach(point => g.lineTo(point[0], point[1]));
      bottom.slice().reverse().forEach(point => g.lineTo(point[0], point[1]));
      g.close(); g.fill();
    };
    drawBand(waterWidth + 58, new Color(82, 83, 69, 215), -2, 1);
    drawBand(waterWidth + 48, new Color(111, 119, 67), 0, 2);
    drawBand(waterWidth + 36, new Color(163, 112, 55), -1, 3);
    drawBand(waterWidth + 23, new Color(211, 163, 84), 0, 4);
    drawBand(waterWidth + 12, new Color(53, 72, 65), 0, 5);
    drawBand(waterWidth, new Color(55, 128, 159), 1, 6);
    drawBand(Math.max(12, waterWidth - 16), new Color(20, 72, 104, 105), 1, 7);

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

  private drawIrrigationJunction(x: number, y: number, variant: number) {
    const g = this.localGraphics(`IrrigationWaterJunction${variant}`, this.world, x, y, 112, 128, 11);
    // The branch and trunk bands already supply their own banks. This small
    // stepped water bay hides those overlapping banks without looking like a
    // rectangular cover plate at every intersection.
    g.fillColor = new Color(55, 128, 159);
    g.moveTo(-50, -39); g.lineTo(-20, -39); g.lineTo(-20, -55); g.lineTo(18, -55);
    g.lineTo(18, -39); g.lineTo(50, -39); g.lineTo(50, 39); g.lineTo(19, 39);
    g.lineTo(19, 54); g.lineTo(-19, 54); g.lineTo(-19, 39); g.lineTo(-50, 39); g.close(); g.fill();
    g.fillColor = new Color(20, 72, 104, 88);
    g.rect(-49, -12, 98, 24); g.rect(-9, -48, 18, 96); g.fill();
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
    outerCliff.moveTo(3000, -420); outerCliff.lineTo(5700, -420);
    outerCliff.moveTo(3000, -2180); outerCliff.lineTo(5700, -2180);
    outerCliff.moveTo(5680, -420); outerCliff.lineTo(5680, -2180); outerCliff.stroke();
    outerCliff.strokeColor = new Color(158, 112, 61, 145); outerCliff.lineWidth = 36;
    outerCliff.moveTo(3000, -448); outerCliff.lineTo(5660, -448);
    outerCliff.moveTo(3000, -2152); outerCliff.lineTo(5660, -2152);
    outerCliff.moveTo(5652, -448); outerCliff.lineTo(5652, -2152); outerCliff.stroke();
    this.addObstacle(4350, -410, 2700, 90, '山林北侧陡崖');
    this.addObstacle(4350, -2190, 2700, 90, '山林南侧陡崖');
    this.addObstacle(5690, -1300, 90, 1800, '山林东侧陡崖');

    for (let x = 3090; x <= 5600; x += 170) {
      this.pixelSprite('MountainNorthCliffPixel', 'wall-horizontal', this.world, x, -442, 178, 84, 13);
      this.pixelSprite('MountainSouthCliffPixel', 'wall-horizontal', this.world, x, -2158, 178, 84, 13);
    }
    for (let y = -540; y >= -2070; y -= 166) {
      this.pixelSprite('MountainEastCliffPixel', 'wall-vertical', this.world, 5655, y, 86, 174, 13);
    }

    const tierCliffs = this.graphics('MountainTierCliffs', this.world, 11);
    tierCliffs.strokeColor = new Color(83, 61, 42, 72); tierCliffs.lineWidth = 82;
    this.strokeSmoothPath(tierCliffs, [[3785, -420], [3820, -690], [3770, -950]]); tierCliffs.stroke();
    this.strokeSmoothPath(tierCliffs, [[3840, -1120], [3780, -1510], [3820, -2180]]); tierCliffs.stroke();
    this.strokeSmoothPath(tierCliffs, [[4685, -420], [4730, -820], [4675, -1230]]); tierCliffs.stroke();
    this.strokeSmoothPath(tierCliffs, [[4740, -1410], [4680, -1770], [4720, -2180]]); tierCliffs.stroke();
    tierCliffs.strokeColor = new Color(167, 118, 62, 132); tierCliffs.lineWidth = 30;
    this.strokeSmoothPath(tierCliffs, [[3760, -420], [3790, -690], [3740, -950]]); tierCliffs.stroke();
    this.strokeSmoothPath(tierCliffs, [[3810, -1120], [3750, -1510], [3790, -2180]]); tierCliffs.stroke();
    this.strokeSmoothPath(tierCliffs, [[4660, -420], [4700, -820], [4645, -1230]]); tierCliffs.stroke();
    this.strokeSmoothPath(tierCliffs, [[4710, -1410], [4650, -1770], [4690, -2180]]); tierCliffs.stroke();
    this.addObstacle(3800, -685, 105, 540, '第一层台地崖壁');
    this.addObstacle(3800, -1650, 105, 1060, '第一层台地崖壁');
    this.addObstacle(4700, -825, 105, 810, '第二层台地崖壁');
    this.addObstacle(4700, -1795, 105, 770, '第二层台地崖壁');

    // Pixel cliff faces leave intentional two-tile ramp gaps in each terrace.
    [-540, -705, -870, -1285, -1450, -1615, -1780, -1945, -2100].forEach(y => {
      this.pixelSprite('MountainTierOneCliffPixel', 'wall-vertical', this.world, 3800, y, 88, 176, 13);
    });
    [-540, -705, -870, -1035, -1585, -1750, -1915, -2080].forEach(y => {
      this.pixelSprite('MountainTierTwoCliffPixel', 'wall-vertical', this.world, 4700, y, 88, 176, 13);
    });

    const mountainRoads = this.graphics('MountainLoopRoads', this.world, 14);
    const mainRoad: Array<[number, number]> = [[3000, -760], [3370, -820], [3730, -1030], [4100, -1210], [4600, -1320], [4920, -1300], [5350, -1120], [5580, -1260]];
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
    [[3180, -580, .55], [3440, -1140, .62], [3200, -1720, .52], [3600, -1910, .68]].forEach(p => this.createRock(p[0], p[1], p[2]));
    [[3200, -920], [3510, -550], [3420, -1530], [3680, -1810]].forEach((p, i) => this.createTreeSized(p[0], p[1], 200 + i, .72 + (i % 2) * .12));
    // Middle tier: dense woodland and grouped rock masses.
    const middleTrees = [[3940,-560],[4180,-610],[4440,-560],[3990,-1050],[4320,-1110],[4520,-930],[3980,-1510],[4210,-1580],[4490,-1480],[4020,-1980],[4370,-2000],[4550,-1860]];
    middleTrees.forEach((p, i) => this.createTreeSized(p[0], p[1], 220 + i, .82 + (i % 3) * .08));
    [[4080, -1320, .88], [4340, -1360, 1.02], [4460, -760, .86], [4140, -1880, .94]].forEach(p => this.createRock(p[0], p[1], p[2]));
    // Summit: giant standing rocks, short grass, and only isolated trees.
    [[4920, -560, 1.22], [5350, -650, 1.35], [5520, -1540, 1.4], [5070, -1950, 1.18]].forEach(p => this.createRock(p[0], p[1], p[2]));
    [[4880, -960], [5480, -980], [5270, -1960]].forEach((p, i) => this.createTreeSized(p[0], p[1], 250 + i, .88));

    [[3110,-520],[3290,-1450],[3590,-720],[3890,-920],[4190,-1420],[4540,-560],[4860,-1680],[5200,-580],[5480,-1800]].forEach((p, i) => this.pixelSprite(`MountainGrass${i}`, i % 2 ? 'foxtail-grass' : 'roadside-grass-clump', this.world, p[0], p[1], 70, 72, 13));
    [[3150,-760],[3260,-1320],[3500,-1680],[3650,-660],[3950,-820],[4070,-980],[4170,-1760],[4400,-820],[4530,-1650],[4860,-820],[5010,-1100],[5140,-1700],[5400,-1420],[5520,-740]].forEach((p, i) => {
      this.pixelSprite(`MountainUnderbrush${i}`, i % 3 === 0 ? 'jujube-bush' : (i % 2 ? 'grass-clump' : 'foxtail-grass'), this.world, p[0], p[1], 66 + (i % 3) * 8, 64 + (i % 2) * 10, 16);
    });
    [[3820,-610],[3790,-820],[3800,-1360],[3790,-1900],[4700,-650],[4690,-1030],[4700,-1620],[4690,-2020],[3300,-430],[5200,-430]].forEach((p, i) => this.createCliffVine(p[0], p[1], i));

    [[4300, -430, 90, 52], [5150, -2170, 112, 58], [5480, -430, 72, 45]].forEach((p, i) => {
      const cave = this.localGraphics(`NaturalRockCave${i}`, this.world, p[0], p[1], p[2], p[3], 13);
      cave.fillColor = new Color(52, 43, 38); cave.ellipse(0, 0, p[2] / 2, p[3] / 2); cave.fill();
    });
    this.worldLabel('山林高地 · 三层台地', 4300, -475, 25, new Color(235, 230, 181));
  }

  private drawOraclePit() {
    // This is the existing large zone directly below the fields.  It remains
    // one continuous outdoor map, divided by paths and terrain rather than by
    // scene transitions or a pasted background image.
    const ground = this.graphics('RoyalRitualMottledGround', this.world, 3);
    ground.fillColor = new Color(105, 75, 53, 150);
    ground.roundRect(680, -4020, 4440, 1480, 44); ground.fill();
    let seed = 91357;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 270; i++) {
      const x = 720 + random() * 4320; const y = -3970 + random() * 1360;
      const palette = i % 4;
      ground.fillColor = palette === 0 ? new Color(61, 55, 45, 90)
        : palette === 1 ? new Color(171, 123, 68, 78)
          : palette === 2 ? new Color(82, 93, 59, 54) : new Color(201, 156, 86, 45);
      const width = 5 + Math.floor(random() * 19); const height = 3 + Math.floor(random() * 9);
      ground.rect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, width, height); ground.fill();
    }

    // Five-stage raised boundary: field buffer -> bright cap -> masonry face ->
    // projecting foundation -> rubble/grass slope. The north opening stays
    // aligned to the field pass, but the wall itself is no longer a flat bar.
    this.createLayeredRitualWallSegment('北墙西段', 1402, -2484, 1605, true, 0);
    this.createLayeredRitualWallSegment('北墙东段', 3798, -2484, 2805, true, 7);
    this.createLayeredRitualWallSegment('南墙', 2900, -4052, 4600, true, 13);
    this.createLayeredRitualWallSegment('西墙', 646, -3270, 1662, false, 19);
    this.createLayeredRitualWallSegment('东墙', 5154, -3270, 1662, false, 25);

    const roadPaths: Array<Array<[number, number]>> = [
      [[2300, -2150], [2300, -2520], [2270, -2730], [2040, -2910], [1580, -3070]],
      [[2270, -2730], [2640, -2940], [2980, -3260], [2860, -3650], [2290, -3800]],
      [[2640, -2940], [3240, -2820], [3750, -2920], [4210, -3160]],
      [[1580, -3070], [1210, -3350], [1510, -3700], [2290, -3800]],
      [[4210, -3160], [4510, -3510], [4170, -3830], [2860, -3650]],
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

    this.createLayeredRitualGate(2300, -2505);

    // Western ritual court: three stepped earthen levels, bronze vessels,
    // braziers and banner posts form a legible ceremonial composition.
    const altar = this.localGraphics('LayeredRoyalSacrificeAltar', this.world, 1450, -3190, 720, 520, 16);
    altar.fillColor = new Color(56, 47, 41, 135); altar.roundRect(-344, -224, 688, 448, 26); altar.fill();
    altar.fillColor = new Color(112, 91, 67); altar.roundRect(-320, -200, 640, 400, 20); altar.fill();
    altar.fillColor = new Color(141, 111, 70); altar.roundRect(-256, -148, 512, 296, 14); altar.fill();
    altar.fillColor = new Color(174, 139, 80); altar.roundRect(-178, -92, 356, 184, 10); altar.fill();
    altar.strokeColor = new Color(68, 53, 42, 210); altar.lineWidth = 5;
    [-256, -178, 178, 256].forEach(x => { altar.moveTo(x, -160); altar.lineTo(x, 160); });
    altar.moveTo(-292, 0); altar.lineTo(292, 0); altar.stroke();
    altar.strokeColor = new Color(220, 177, 91, 190); altar.lineWidth = 3;
    altar.moveTo(-92, 0); altar.lineTo(-46, 50); altar.lineTo(0, 0); altar.lineTo(46, 50); altar.lineTo(92, 0); altar.lineTo(46, -50); altar.lineTo(0, 0); altar.lineTo(-46, -50); altar.close(); altar.stroke();
    this.addObstacle(1450, -3190, 360, 180, '王陵中心祭台');
    this.createBronzeDing(1370, -3170); this.createBronzeDing(1530, -3170);
    [[1130,-2960],[1770,-2960],[1130,-3420],[1770,-3420]].forEach((p, i) => this.createAnimatedTorch(p[0], p[1], 20 + i));
    [[1070,-3170],[1830,-3170]].forEach((p, index) => {
      const banner = this.localGraphics(`RoyalRitualBanner${index}`, this.world, p[0], p[1], 84, 210, 23);
      banner.fillColor = new Color(58, 43, 34); banner.rect(-6, -92, 12, 184); banner.fill();
      banner.fillColor = index ? new Color(111, 42, 38) : new Color(72, 58, 41); banner.moveTo(4, 76); banner.lineTo(index ? 64 : -64, 55); banner.lineTo(index ? 54 : -54, -18); banner.lineTo(4, 3); banner.close(); banner.fill();
      banner.strokeColor = new Color(207, 157, 72); banner.lineWidth = 3; banner.moveTo(index ? 17 : -17, 45); banner.lineTo(index ? 43 : -43, 25); banner.lineTo(index ? 20 : -20, 2); banner.stroke();
      this.sways.push({ node: banner.node, phase: index * 1.7, amplitude: 1.1, speed: .58 });
    });
    this.worldLabel('王陵祭祀台', 1450, -2840, 21, new Color(237, 202, 125));

    // Central royal burial mound. Layered rims and a sealed stone face read as
    // raised terrain; collision is only on the mound body, never on the path.
    const mound = this.localGraphics('LayeredRoyalBurialMound', this.world, 2860, -3450, 900, 600, 12);
    mound.fillColor = new Color(48, 43, 37, 180); mound.ellipse(0, -34, 420, 250); mound.fill();
    mound.fillColor = new Color(91, 72, 52); mound.ellipse(0, -4, 395, 230); mound.fill();
    mound.fillColor = new Color(127, 91, 56); mound.ellipse(0, 28, 344, 192); mound.fill();
    mound.fillColor = new Color(151, 112, 65); mound.ellipse(0, 58, 276, 145); mound.fill();
    mound.strokeColor = new Color(193, 147, 78, 150); mound.lineWidth = 5;
    for (let ring = 0; ring < 3; ring++) { mound.ellipse(0, 22 + ring * 13, 318 - ring * 38, 174 - ring * 22); mound.stroke(); }
    mound.fillColor = new Color(50, 44, 40); mound.roundRect(-84, -171, 168, 92, 16); mound.fill();
    mound.fillColor = new Color(113, 91, 65); mound.rect(-64, -153, 128, 61); mound.fill();
    mound.strokeColor = new Color(206, 166, 91); mound.lineWidth = 4; mound.moveTo(-45, -121); mound.lineTo(0, -92); mound.lineTo(45, -121); mound.lineTo(0, -150); mound.close(); mound.stroke();
    this.addObstacle(2860, -3405, 660, 305, '王陵封土主体');
    this.worldLabel('王陵封土', 2860, -3115, 20, new Color(224, 192, 125));

    // Eastern oracle-bone kiln/cellar is an exposed archaeological cut, not an
    // interior room. The southern stair keeps the lower terrace accessible.
    const pitX = 4300; const pitY = -3425; const pitW = 1240; const pitH = 780;
    const pit = this.localGraphics('OutdoorOracleKilnTerraces', this.world, pitX, pitY, pitW + 120, pitH + 120, 11);
    pit.fillColor = new Color(50, 45, 40, 195); pit.roundRect(-pitW / 2, -pitH / 2, pitW, pitH, 60); pit.fill();
    pit.fillColor = new Color(91, 64, 45); pit.roundRect(-pitW / 2 + 32, -pitH / 2 + 32, pitW - 64, pitH - 64, 48); pit.fill();
    pit.fillColor = new Color(127, 86, 50); pit.roundRect(-pitW / 2 + 78, -pitH / 2 + 82, pitW - 156, pitH - 164, 36); pit.fill();
    pit.fillColor = new Color(75, 57, 46); pit.roundRect(-pitW / 2 + 132, -pitH / 2 + 140, pitW - 264, pitH - 278, 28); pit.fill();
    pit.fillColor = new Color(101, 76, 55); pit.roundRect(-pitW / 2 + 180, -pitH / 2 + 188, pitW - 360, pitH - 380, 20); pit.fill();
    // Three dark kiln/cellar mouths with laid bone shelves.
    [-285, 0, 285].forEach((offset, index) => {
      pit.fillColor = new Color(39, 35, 34); pit.ellipse(offset, 132, 112, 72); pit.fill();
      pit.fillColor = new Color(73, 50, 38); pit.ellipse(offset, 113, 84, 51); pit.fill();
      pit.fillColor = new Color(211, 177, 112); 
      for (let shard = 0; shard < 5; shard++) {
        const sx = offset - 55 + shard * 27; const sy = 98 + (shard % 2) * 15;
        pit.moveTo(sx - 9, sy - 5); pit.lineTo(sx + 7, sy - 7); pit.lineTo(sx + 11, sy + 4); pit.lineTo(sx - 5, sy + 8); pit.close(); pit.fill();
      }
      pit.strokeColor = new Color(158, 112, 63); pit.lineWidth = 5; pit.ellipse(offset, 128, 108, 68); pit.stroke();
    });
    // A real stair breaks the south rim and communicates walkable depth.
    pit.fillColor = new Color(155, 115, 69);
    for (let step = 0; step < 7; step++) pit.rect(-92 + step * 7, -382 + step * 23, 184 - step * 14, 18);
    pit.fill();
    pit.strokeColor = new Color(69, 52, 42, 210); pit.lineWidth = 3;
    for (let step = 0; step < 7; step++) { pit.moveTo(-92 + step * 7, -364 + step * 23); pit.lineTo(92 - step * 7, -364 + step * 23); }
    pit.stroke();
    this.addObstacle(pitX, pitY + pitH / 2 - 26, pitW - 100, 52, '甲骨窑穴北沿');
    this.addObstacle(pitX - pitW / 2 + 25, pitY, 50, pitH, '甲骨窑穴西沿');
    this.addObstacle(pitX + pitW / 2 - 25, pitY, 50, pitH, '甲骨窑穴东沿');
    this.addObstacle(pitX - 345, pitY - pitH / 2 + 26, 350, 52, '甲骨窑穴南沿');
    this.addObstacle(pitX + 345, pitY - pitH / 2 + 26, 350, 52, '甲骨窑穴南沿');
    this.worldLabel('室外甲骨窑穴', pitX, -2940, 21, new Color(235, 205, 139));

    [[840,-2800],[900,-3710],[2030,-2760],[2260,-3930],[3500,-2740],[4940,-2860],[4930,-3900]].forEach((p, i) => this.createRock(p[0], p[1], .55 + (i % 3) * .14));
    [[930,-3480],[2020,-3520],[3510,-3880],[4830,-3160]].forEach((p, i) => this.pixelSprite(`RoyalRitualRelic${i}`, i % 2 ? 'pottery-jar-cluster' : 'field-stone-cluster', this.world, p[0], p[1], 68, 62, 15));
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
    const layouts: Record<ExcavationRegion, Array<[number, number]>> = {
      river: [
        [-5940,-250],[-5590,-255],[-5210,-430],[-4710,-380],[-4090,-620],
        [-4200,-1320],[-5470,-1770],[-4920,-1980],[-4200,-2320],[-5440,-2790],
      ],
      field: [
        [390,-920],[420,-1450],[435,-1870],[720,-2070],[1080,-940],
        [1450,-900],[1780,-2050],[2180,-930],[2860,-1410],[2850,-1880],
      ],
      lake: [
        [-1530,-1510],[-1470,-1240],[-1270,-1140],[-940,-1135],[-615,-1300],
        [-505,-1580],[-650,-1835],[-900,-1940],[-1210,-1935],[-1490,-1800],
      ],
      royal: [
        [840,-2720],[1110,-2850],[850,-3330],[1120,-3820],[1980,-2760],
        [2100,-3350],[2450,-3910],[3380,-2870],[3510,-3760],[4820,-3780],
      ],
    };
    (Object.keys(layouts) as ExcavationRegion[]).forEach(region => {
      layouts[region].forEach((seedPoint, index) => {
        const point = this.resolveExcavationPosition(seedPoint[0], seedPoint[1], region);
        const root = new Node(`ExcavationSite-${region}-${index}`);
        root.parent = this.world;
        root.setPosition(point.x, point.y, 21);
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
        const site: ExcavationSite = {
          id: `${region}-${index}`, root, sprite, glow, x: point.x, y: point.y,
          region,
          active: true, respawnTimer: 0, holeTimer: 0, awaitingStudy: false,
          reward: this.rollExcavationReward(region),
        };
        this.excavationSites.push(site);
        this.redrawExcavationSite(site);
      });
    });
    console.info('[YinXuCity] excavation sites ready:', this.excavationSites.length, '(10 per outdoor region)');
  }

  private resolveExcavationPosition(seedX: number, seedY: number, region: ExcavationRegion, ignoreSite: ExcavationSite | null = null) {
    const bounds = region === 'river' ? this.riverRegion : region === 'field' ? this.fieldRegion
      : region === 'lake' ? this.lakeRegion : this.tombRegion;
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
    console.warn(`[YinXuCity] excavation site ${region} used fallback position`, seedX, seedY);
    return new Vec2(seedX, seedY);
  }

  private isExcavationPositionValid(
    x: number, y: number, region: ExcavationRegion, ignoreSite: ExcavationSite | null = null, minimumSpacing = 190,
  ) {
    const bounds = region === 'river' ? this.riverRegion : region === 'field' ? this.fieldRegion
      : region === 'lake' ? this.lakeRegion : this.tombRegion;
    if (x < bounds.left + 48 || x > bounds.right - 48 || y < bounds.bottom + 48 || y > bounds.top - 48) return false;
    if (!this.canStandRadius(x, y, 24) || this.pointInAnyObstacle(x, y)) return false;
    if (this.excavationSites.some(site => site !== ignoreSite && Math.hypot(site.x - x, site.y - y) < minimumSpacing)) return false;
    if (this.cropPlants.some(crop => Math.hypot(crop.x - x, crop.y - y) < 46)) return false;
    if (region === 'river' || region === 'lake') {
      // Waterside finds stay close enough to the shoreline for their regional
      // identity, but never occupy water or an inaccessible bank decoration.
      if (!this.pointInWater(x, y, region === 'lake' ? 205 : 260) || this.pointInWater(x, y, 34)) return false;
    }
    const approachDistance = 68;
    const hasReachableApproach = [[approachDistance, 0], [-approachDistance, 0], [0, approachDistance], [0, -approachDistance]]
      .some(offset => this.canStandRadius(x + offset[0], y + offset[1], this.playerRadius + 2));
    return hasReachableApproach;
  }

  private moveExcavationSiteToRandomLocation(site: ExcavationSite) {
    const previousX = site.x; const previousY = site.y;
    const bounds = site.region === 'river' ? this.riverRegion : site.region === 'field' ? this.fieldRegion
      : site.region === 'lake' ? this.lakeRegion : this.tombRegion;
    for (let attempt = 0; attempt < 84; attempt++) {
      const x = Math.round(bounds.left + 70 + Math.random() * (bounds.right - bounds.left - 140));
      const y = Math.round(bounds.bottom + 70 + Math.random() * (bounds.top - bounds.bottom - 140));
      if (!this.isExcavationPositionValid(x, y, site.region, site)) continue;
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

  private rollExcavationReward(region: ExcavationRegion): ExcavationReward {
    const roll = Math.random();
    let quality: OracleQuality | null = null;
    if (region === 'river' || region === 'field') {
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
    if (!quality) {
      const minimum = region === 'royal' ? 6 : region === 'lake' ? 4 : 3;
      return { kind: 'ink', quality: null, cardId: null, amount: minimum + Math.floor(Math.random() * 4) };
    }
    const excavatableCards = this.oracleCards.filter(card => card.excavatable);
    const pool = excavatableCards.filter(card => card.quality === quality);
    const uncollected = pool.filter(card => !this.save.unlockedOracleIds.includes(card.id));
    const reservedIds = new Set(this.excavationSites
      .filter(site => site.reward.kind === 'oracle' && !!site.reward.cardId)
      .map(site => site.reward.cardId as string));
    const uncollectedAndUnreserved = uncollected.filter(card => !reservedIds.has(card.id));
    const collectionRatio = excavatableCards.length > 0
      ? this.save.unlockedOracleIds.filter(id => excavatableCards.some(card => card.id === id)).length / excavatableCards.length
      : 1;
    // New learning content receives a 95% preference until most of the codex
    // has been completed. Duplicate frequency only rises late in collection.
    const duplicateChance = collectionRatio < .8 ? .05 : Math.min(.38, .05 + (collectionRatio - .8) * 1.65);
    const freshPool = uncollectedAndUnreserved.length > 0 ? uncollectedAndUnreserved : uncollected;
    const candidatePool = freshPool.length > 0 && Math.random() >= duplicateChance ? freshPool : pool;
    const card = candidatePool[Math.floor(Math.random() * candidatePool.length)];
    return card
      ? { kind: 'oracle', quality, cardId: card.id, amount: 0 }
      : { kind: 'ink', quality: null, cardId: null, amount: quality === 'gold' ? 10 : quality === 'red' ? 6 : 4 };
  }

  private redrawExcavationSite(site: ExcavationSite) {
    site.glow.clear();
    site.glow.node.setScale(1, 1, 1);
    site.glow.node.setRotationFromEuler(0, 0, 0);
    site.root.active = true;
    if (!site.active) {
      if (site.holeTimer <= 0) {
        site.root.active = false;
        return;
      }
      this.applyExcavationVisualState(site, 'dug');
      return;
    }
    this.applyExcavationVisualState(site, 'idle');
    this.drawExcavationInteractionHint(site);
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
    site.respawnTimer = 300;
    site.holeTimer = 180;
    this.redrawExcavationSite(site);
    this.pendingExcavation = { site, timer: .62, rewarded: false };
    this.createDigParticleBurst(site.x, site.y);
    if (returningToLesson) this.showStatusNotice('重新清理这个坑位，之前发现的甲骨文字仍保留在这里。', 1.1);
    this.showStatusNotice('正在清理土层……', 1.1);
  }

  private completeExcavation(site: ExcavationSite) {
    const reward = site.reward;
    if (reward.kind === 'oracle' && reward.cardId) {
      const card = this.oracleCards.find(item => item.id === reward.cardId);
      if (card) {
        site.awaitingStudy = true;
        this.showExcavationLearning(site, card);
        return;
      }
    }
    site.awaitingStudy = false;
    this.save.ink += reward.amount;
    this.persistCitySave();
    this.createExcavationRewardFlight(site.x, site.y, '墨', null);
    this.showStatusNotice(`这处土层没有甲骨文，收集到 ${reward.amount} 份墨料。3分钟后坑位恢复，5分钟后在本地区重新刷新。`, 4.2);
  }

  private completeExcavationLegacy(site: ExcavationSite) {
    const reward = site.reward;
    let flightText = '墨';
    let flightQuality: OracleQuality | null = null;
    if (reward.kind === 'oracle' && reward.cardId) {
      const card = this.oracleCards.find(item => item.id === reward.cardId);
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
    if (card?.asset) this.createOracleGlyphVisual('RewardGlyph', root, card, 0, 0, 43, 48, 5);
    else this.createUiLabel(root, 'RewardGlyph', glyph, 0, 0, 54, 56, glyph === '墨' ? 24 : 31, new Color(74, 43, 30));
    this.rewardFlights.push({ root, start, end, timer: 0, duration: 1.05, phase: Math.random() * Math.PI * 2 });
  }

  private updateExcavationEffects(dt: number) {
    for (const site of this.excavationSites) {
      if (!site.root.isValid) continue;
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
          this.moveExcavationSiteToRandomLocation(site);
          site.reward = this.rollExcavationReward(site.region);
          site.active = true;
          site.holeTimer = 0;
          site.root.active = true;
          this.redrawExcavationSite(site);
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
    yard.fillColor = index % 2 === 0 ? new Color(136, 119, 73, 92) : new Color(113, 126, 72, 78);
    yard.moveTo(-82, -91); yard.lineTo(-70, -37); yard.lineTo(-45, -23); yard.lineTo(48, -25);
    yard.lineTo(78, -42); yard.lineTo(84, -92); yard.lineTo(52, -108); yard.lineTo(-55, -106); yard.close(); yard.fill();
    yard.fillColor = new Color(183, 145, 84, 210);
    yard.roundRect(-18, -140, 36, 105, 6); yard.fill();
    yard.fillColor = new Color(220, 178, 104, 120);
    for (let step = 0; step < 4; step++) {
      const py = -127 + step * 23;
      yard.rect(-13 + (step % 2) * 5, py, 18 + (step % 3) * 4, 3); yard.fill();
    }
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
    // Use the complete visible house footprint, not only the doorstep. This
    // prevents feet positions behind a roof from rendering as if a character
    // had climbed onto the building.
    this.addObstacle(x, y - 65, 154, 30, `${name}基座`);

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
    this.addObstacle(x, y - 68, 184, 36, '集市商店基座');
  }

  private createVillageWell(x: number, y: number) {
    const fallback = this.graphics('VillageWellFallback', this.world, 21);
    fallback.fillColor = new Color(98, 87, 67); fallback.circle(0, 0, 34); fallback.fill();
    fallback.strokeColor = new Color(58, 47, 36); fallback.lineWidth = 7; fallback.circle(0, 0, 34); fallback.stroke();
    fallback.node.setPosition(x, y);
    this.pixelSprite('VillageWaterWell', 'village-well', this.world, x, y + 18, 112, 112, 28);
    this.addObstacle(x, y - 34, 58, 22, '村落水井基座');
    this.worldLabel('水井', x, y + 84, 14, new Color(80, 57, 38));
  }

  private createFieldStorehouse(name: string, x: number, y: number, asset: string) {
    const base = this.localGraphics(`${name}Base`, this.world, x, y - 36, 190, 90, 29);
    base.fillColor = new Color(105, 73, 45, 190); base.roundRect(-84, -32, 168, 64, 8); base.fill();
    this.pixelSprite(`${name}PixelArt`, asset, this.world, x, y + 20, 220, 198, 33);
    this.addObstacle(x, y - 72, 170, 34, `${name}基座`);
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
    this.addObstacle(x, y - h * .5 - 4, w + 4, Math.max(26, h * .16), `${name}基座`);
  }

  private createMarketStall(x: number, y: number, scale = 1) {
    const g = this.graphics('MarketStall', this.world, 29);
    g.fillColor = new Color(109, 68, 39); g.rect(-72 * scale, -55 * scale, 144 * scale, 92 * scale); g.fill();
    g.fillColor = new Color(176, 61, 49); g.rect(-84 * scale, 30 * scale, 168 * scale, 52 * scale); g.fill();
    g.fillColor = new Color(224, 166, 76); for (let px = -70; px < 70; px += 34) { g.circle(px * scale, -20 * scale, 10 * scale); g.fill(); }
    g.node.setPosition(x, y);
    this.pixelSprite('MarketStallPixelArt', 'market-stall', this.world, x, y + 12 * scale, 205 * scale, 205 * scale, 32);
    this.addObstacle(x, y - 54 * scale, 138 * scale, 28 * scale, '集市货摊基座');
  }

  private createTree(x: number, y: number, index: number) {
    this.createTreeSized(x, y, index, 1);
  }

  private createTreeSized(x: number, y: number, index: number, scale: number) {
    const n = new Node(`Tree${index}`); n.parent = this.world; n.setPosition(x, y, 25); n.addComponent(UITransform).setContentSize(180 * scale, 220 * scale);
    this.attachPixelSprite(n, 'ancient-tree');
    this.addObstacle(x, y - 85 * scale, 40 * scale, 22 * scale, '古树根部基座');
    this.sways.push({ node: n, phase: index * .63, amplitude: 1.4, speed: .75 });
    this.depthTrees.push({
      node: n,
      trunkY: y - 84 * scale,
      halfWidth: 82 * scale,
      canopyHeight: 184 * scale,
      baseZ: 25,
    });
  }

  private createRock(x: number, y: number, scale: number) {
    const g = this.graphics('MountainRock', this.world, 18);
    g.fillColor = new Color(105, 111, 104); g.moveTo(-45 * scale, -22 * scale); g.lineTo(-18 * scale, 45 * scale); g.lineTo(28 * scale, 52 * scale); g.lineTo(52 * scale, -15 * scale); g.close(); g.fill();
    g.fillColor = new Color(151, 153, 137); g.moveTo(-18 * scale, 45 * scale); g.lineTo(9 * scale, 23 * scale); g.lineTo(28 * scale, 52 * scale); g.close(); g.fill();
    g.node.setPosition(x, y);
    this.pixelSprite('MountainRockPixelArt', 'mountain-rock', this.world, x, y + 12, 150 * scale, 150 * scale, 20);
    this.addObstacle(x, y - 34 * scale, 78 * scale, 24 * scale, '山石基座');
  }

  private createReeds(x: number, y: number) {
    this.loadWetlandPlantSpriteFrames();
    const seed = this.wetlandReedSeed(x, y);
    if (((seed >>> 4) % 100) < this.wetlandPlantBlankPercent) return;

    const kind: WetlandPlantKind = ((seed >>> 24) % 100) < this.wetlandReedPercent ? 'reed' : 'grass';
    const firstVariant = kind === 'reed' ? 0 : this.wetlandReedVariantCount;
    const variantCount = kind === 'reed' ? this.wetlandReedVariantCount : 2;
    let variant = firstVariant + (seed % variantCount);
    // Generation order is fixed, so rotating a repeated choice remains fully
    // deterministic while preventing obvious runs of the same silhouette.
    if (variant === this.previousWetlandPlantVariant) {
      variant = firstVariant + ((variant - firstVariant + 1) % variantCount);
    }
    this.previousWetlandPlantVariant = variant;

    const flipped = ((seed >>> 3) & 1) === 1;
    const jitterX = ((seed >>> 20) % 15) - 7;
    const jitterY = ((seed >>> 28) % 3) - 1;
    const [canvasWidth, canvasHeight] = this.wetlandPlantCanvasSizes[kind];
    const n = new Node(kind === 'reed' ? 'DynamicRiverReeds' : 'DynamicWetlandGrass');
    n.parent = this.world;
    n.setPosition(x + jitterX, y + jitterY, 12);
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

    this.wetlandPlants.push({ root: n, sprite, variant });
    this.depthOccluders.push({
      node: n,
      footY: y + jitterY - 24,
      halfWidth: canvasWidth * (kind === 'reed' ? .42 : .46),
      coverHeight: kind === 'reed' ? 92 : 46,
      baseZ: 12,
      foregroundZ: 98,
    });
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
          if (plant.variant === variant && plant.root.isValid && plant.sprite.isValid) plant.sprite.spriteFrame = frame;
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

  private createCliffVine(x: number, y: number, index: number) {
    const vine = this.localGraphics(`CliffVine${index}`, this.world, x, y, 64, 112, 15);
    vine.strokeColor = new Color(66, 105, 50); vine.lineWidth = 5;
    for (let i = -2; i <= 2; i++) {
      vine.moveTo(i * 10, 38); vine.bezierCurveTo(i * 14, 10, i * 5, -20, i * 9, -48);
    }
    vine.stroke();
    this.sways.push({ node: vine.node, phase: index * .82, amplitude: 2.2, speed: .62 });
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
    const zones = [this.riverRegion, this.mountainRegion, this.tombRegion];
    let created = 0;
    for (let attempt = 0; attempt < 1200 && created < 140; attempt++) {
      const zone = zones[attempt % zones.length];
      const x = zone.left + 80 + random() * (zone.right - zone.left - 160);
      const y = zone.bottom + 80 + random() * (zone.top - zone.bottom - 160);
      const onRiversideRoad = x < 100 && x > -5100 && Math.abs(y + 780) < 100;
      if (onRiversideRoad || this.pointInAnyObstacle(x, y) || this.pointInWater(x, y, 36)) continue;
      const n = new Node(`SwayGrass${created}`); n.parent = this.world; n.setPosition(x, y, 8); n.addComponent(UITransform).setContentSize(44, 64);
      this.attachPixelSprite(n, 'grass-clump');
      this.sways.push({ node: n, phase: random() * Math.PI * 2, amplitude: 5 + random() * 4, speed: .9 + random() * .55, reactsToPlayer: true });
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
    shadow.ellipse(0, 1, 12, 4);
    shadow.fill();

    this.playerVisual = new Node('OracleApprenticeWalkFrames');
    this.playerVisual.parent = root;
    this.playerVisual.setPosition(0, 30, 4);
    this.playerVisual.addComponent(UITransform).setContentSize(64, 64);
    this.playerSprite = this.playerVisual.addComponent(Sprite);
    this.playerSprite.sizeMode = Sprite.SizeMode.CUSTOM;

    this.heldToolNode = new Node('EquippedHandTool');
    this.heldToolNode.parent = this.playerVisual;
    this.heldToolNode.setPosition(15, -2, 8);
    this.heldToolNode.addComponent(UITransform).setContentSize(38, 58);
    this.heldToolGraphics = this.heldToolNode.addComponent(Graphics);
    this.heldToolNode.active = false;

    const directions: Facing[] = ['down', 'left', 'right', 'up'];
    directions.forEach(direction => {
      for (let frameIndex = 0; frameIndex < 4; frameIndex++) {
        const key = `characters/oracle-apprentice/${direction}-${frameIndex}/spriteFrame`;
        this.requestSpriteFrame(key, frame => {
          this.playerFrames[direction][frameIndex] = frame;
          if (direction === this.facing && frameIndex === 0 && this.playerSprite.isValid) {
            this.playerSprite.spriteFrame = frame;
          }
        });
      }
    });
    return root;
  }

  private animatePlayer(moving: boolean, direction: Vec2, movedDistance: number) {
    if (this.seated) {
      this.walkPhase = 0;
      // `down-*` is the front-facing sheet in the actual character resource;
      // screen-down is the room entrance direction.
      this.facing = 'down';
      this.showPlayerFrame(0);
      this.playerVisual.setPosition(0, 17, 4);
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
      this.walkPhase += movedDistance / 11.5;
      const walkSequence = [0, 1, 0, 3];
      const frameIndex = walkSequence[Math.floor(this.walkPhase) % walkSequence.length];
      this.showPlayerFrame(frameIndex);
      const stride = Math.sin(this.walkPhase * Math.PI);
      this.playerVisual.setPosition(0, 30 + Math.abs(stride) * .55, 4);
      const lean = this.facing === 'left' ? .45 : (this.facing === 'right' ? -.45 : 0);
      this.playerVisual.setRotationFromEuler(0, 0, lean * stride);
    } else {
      this.walkPhase = 0;
      this.showPlayerFrame(0);
      this.playerVisual.setPosition(0, 30, 4);
      this.playerVisual.setRotationFromEuler(0, 0, 0);
    }
  }

  private showPlayerFrame(frameIndex: number) {
    const displayKey = (['down', 'left', 'right', 'up'].indexOf(this.facing) * 4) + frameIndex;
    if (displayKey === this.displayedPlayerFrame) return;
    const frame = this.playerFrames[this.facing][frameIndex];
    if (!frame || !this.playerSprite?.isValid) return;
    this.playerSprite.spriteFrame = frame;
    this.displayedPlayerFrame = displayKey;
  }

  private equipTool(tool: ToolKind) {
    if (this.fishingCastEffect && tool !== 'fishing') this.cancelFishingCast('已收回鱼钩。', false);
    this.equippedTool = tool;
    this.toolActionTimer = 0;
    if (tool === 'none') {
      if (this.heldToolNode?.isValid) this.heldToolNode.active = false;
      if (this.actionToolIconNode?.isValid) this.actionToolIconNode.active = false;
      return;
    }
    const asset = tool === 'shovel' ? 'tool-shovel-v1' : tool === 'fishing' ? 'tool-fishing-hook-v1' : 'tool-machete-v1';
    this.drawHeldTool(tool);
    if (this.heldToolNode?.isValid) this.heldToolNode.active = !this.seated;
    this.requestFrame(asset, frame => {
      if (this.actionToolIconNode?.isValid) {
        const actionSprite = this.actionToolIconNode.getComponent(Sprite);
        const actionSize = tool === 'fishing' ? [61, 61] : [46, 58];
        this.actionToolIconNode.getComponent(UITransform)?.setContentSize(actionSize[0], actionSize[1]);
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
    } else if (tool === 'machete') {
      g.fillColor = outline; g.roundRect(-5, -24, 10, 24, 3); g.fill();
      g.fillColor = woodDark; g.rect(-3, -21, 6, 18); g.fill();
      g.fillColor = outline;
      g.moveTo(-6, -1); g.lineTo(-5, 25); g.lineTo(2, 29); g.lineTo(8, 23); g.lineTo(6, -1); g.close(); g.fill();
      g.fillColor = bronze;
      g.moveTo(-3, 1); g.lineTo(-2, 23); g.lineTo(2, 26); g.lineTo(5, 22); g.lineTo(3, 1); g.close(); g.fill();
      g.strokeColor = bronzeLight; g.lineWidth = 2; g.moveTo(3, 3); g.lineTo(4, 21); g.stroke();
    } else {
      g.strokeColor = outline; g.lineWidth = 5; g.moveTo(0, -23); g.lineTo(1, 27); g.stroke();
      g.strokeColor = woodLight; g.lineWidth = 2; g.moveTo(0, -21); g.lineTo(1, 26); g.stroke();
      g.fillColor = woodDark; g.rect(-5, -23, 10, 17); g.fill();
      g.fillColor = new Color(191, 148, 72); g.rect(-5, -11, 10, 3); g.fill();
    }

    // A two-tone hand is painted over the handle, so the tool reads as being
    // gripped by the character instead of pasted across the body sprite.
    const gripY = tool === 'shovel' ? 3 : tool === 'machete' ? -5 : -4;
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
    if (this.equippedTool === 'none' || this.seated) {
      this.heldToolNode.active = false;
      return;
    }
    this.heldToolNode.active = true;
    const active = this.toolActionTimer > 0;
    const progress = active ? 1 - this.clamp(this.toolActionTimer / Math.max(.01, this.toolActionDuration), 0, 1) : 0;
    const swing = active ? Math.sin(progress * Math.PI) : 0;
    let x = 8; let y = -3; let z = 8; let rotation = -20;
    if (this.facing === 'left') { x = -8; y = -2; rotation = 26; }
    else if (this.facing === 'right') { x = 8; y = -2; rotation = -26; }
    else if (this.facing === 'up') { x = 6; y = 0; z = -1; rotation = 16; }
    else { x = 8; y = -4; rotation = -20; }
    const toolBias = this.equippedTool === 'fishing' ? -14 : this.equippedTool === 'machete' ? 7 : 0;
    const actionArc = this.equippedTool === 'fishing' ? -58 * swing : 76 * swing;
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
    if (this.equippedTool === 'shovel') this.useShovel();
    else if (this.equippedTool === 'fishing') this.useFishingHook();
    else this.useMachete();
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
      this.showStatusNotice('砍刀挥过空气，前方没有可清理的野草或灌木。');
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
    if (this.worldMode !== 'outside' || this.equippedTool !== 'fishing'
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
    const definitions: Array<{ name: string; route: Array<[number, number]>; asset: string; speed: number; workIndices?: number[] }> = [
      { name: '巡街陶匠', route: [[0, 440], [0, 820], [600, 820], [600, 440], [600, 60], [0, 60]], asset: 'villager-farmer-v2', speed: 74 },
      { name: '汲水妇人', route: [[-600, 60], [-600, 440], [-600, 820], [0, 820], [0, 440], [0, 60]], asset: 'villager-woman-v2', speed: 66 },
      { name: '集市商贩', route: [[600, 60], [600, 440], [0, 440], [-600, 440], [-600, 820], [0, 820], [600, 820]], asset: 'villager-woman-v2', speed: 70 },
      { name: '卜骨学徒', route: [[-600, 440], [0, 440], [600, 440], [600, 820]], asset: 'villager-farmer-v2', speed: 72 },
      { name: '田间老农', route: [[250, -760], [850, -760], [1100, -760], [1040, -980], [970, -1140]], asset: 'villager-farmer-v2', speed: 60, workIndices: [3, 4] },
      { name: '赶集妇人', route: [[600, 820], [600, 440], [0, 440], [0, 60], [0, -240], [0, -760], [500, -760], [900, -760]], asset: 'villager-woman-v2', speed: 68 },
      { name: '进城帮工', route: [[-600, 820], [-600, 440], [0, 440], [0, 60], [0, -240], [0, -760], [500, -760], [1100, -760], [1040, -980], [970, -1140]], asset: 'villager-farmer-v2', speed: 64, workIndices: [8, 9] },
      { name: '南田雇农', route: [[1700, -760], [1640, -980], [1570, -1140]], asset: 'villager-farmer-v2', speed: 58, workIndices: [1, 2] },
      { name: '东田雇农', route: [[2300, -760], [2240, -980], [2170, -1140]], asset: 'villager-farmer-v2', speed: 61, workIndices: [1, 2] },
    ];
    definitions.forEach((definition, index) => this.createWalkingVillager(
      definition.name,
      definition.route.map(point => new Vec2(point[0], point[1])),
      definition.asset,
      definition.speed,
      index,
      definition.workIndices ?? [],
    ));
  }

  private createWalkingVillager(name: string, route: Vec2[], asset: string, speed: number, variant: number, workIndices: number[]) {
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
      workFrames: [null, null, null, null], workIndices, working: false, workTimer: 0,
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
    if (this.canStandRadius(candidateX, candidateY, villager.radius)) villager.target.set(candidateX, candidateY);
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
    this.addObstacle(580, -635, 58, 28, '树下休息的村民');
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
  private updateTreeDepthOrdering() {
    const actors: Array<{ x: number; y: number }> = [{ x: this.playerPos.x, y: this.playerPos.y }];
    this.villagers.forEach(villager => {
      if (villager.root.isValid && villager.root.parent === this.player.parent) {
        actors.push({ x: villager.root.position.x, y: villager.root.position.y });
      }
    });
    this.horseCarts.forEach(cart => {
      if (cart.root.isValid && cart.root.parent === this.player.parent) {
        actors.push({ x: cart.root.position.x, y: cart.root.position.y });
      }
    });

    for (const tree of this.depthTrees) {
      if (!tree.node.isValid || tree.node.parent !== this.player.parent) continue;
      const treeX = tree.node.position.x;
      const playerOverlaps = Math.abs(this.playerPos.x - treeX) <= tree.halfWidth;
      const playerBehind = playerOverlaps
        && this.playerPos.y >= tree.trunkY - 5
        && this.playerPos.y <= tree.trunkY + tree.canopyHeight;
      const otherActorBehind = actors.slice(1).some(actor =>
        Math.abs(actor.x - treeX) <= tree.halfWidth
        && actor.y >= tree.trunkY - 5
        && actor.y <= tree.trunkY + tree.canopyHeight,
      );
      // A nearby NPC must never pull the whole prop in front of a player who
      // is standing on its south/front side. The local player owns the depth
      // decision whenever their horizontal footprint overlaps the object.
      const actorBehindCanopy = playerOverlaps ? playerBehind : otherActorBehind;
      const targetZ = actorBehindCanopy ? 94 : tree.baseZ;
      if (tree.node.position.z !== targetZ) {
        tree.node.setPosition(tree.node.position.x, tree.node.position.y, targetZ);
      }
      // UI render components primarily follow sibling order. Keep the z value
      // for transform depth, but also move only overlapping trees across the
      // player in the render list so this works in both WebGL and Android.
      const playerIndex = this.player.getSiblingIndex();
      const treeIndex = tree.node.getSiblingIndex();
      if (actorBehindCanopy && treeIndex < playerIndex) {
        tree.node.setSiblingIndex((tree.node.parent?.children.length ?? 1) - 1);
      } else if (!actorBehindCanopy && treeIndex > playerIndex) {
        tree.node.setSiblingIndex(playerIndex);
      }
    }

    // The same foot-line rule applies to architecture and solid props. Only
    // the visual node changes layers; collision always remains at its base.
    for (const occluder of this.depthOccluders) {
      if (!occluder.node.isValid || occluder.node.parent !== this.player.parent) continue;
      const objectX = occluder.node.position.x;
      const playerProjection = this.worldMode === 'templeInterior' ? this.templeFootHalfWidth : 0;
      const playerOverlaps = Math.abs(this.playerPos.x - objectX) <= occluder.halfWidth + playerProjection;
      const playerBehind = playerOverlaps
        && this.playerPos.y >= occluder.footY - 4
        && this.playerPos.y <= occluder.footY + occluder.coverHeight;
      const otherActorBehind = actors.slice(1).some(actor =>
        Math.abs(actor.x - objectX) <= occluder.halfWidth
        && actor.y >= occluder.footY - 4
        && actor.y <= occluder.footY + occluder.coverHeight,
      );
      const actorBehind = playerOverlaps ? playerBehind : otherActorBehind;
      const targetZ = actorBehind ? occluder.foregroundZ : occluder.baseZ;
      if (occluder.node.position.z !== targetZ) {
        occluder.node.setPosition(occluder.node.position.x, occluder.node.position.y, targetZ);
      }
      const playerIndex = this.player.getSiblingIndex();
      const objectIndex = occluder.node.getSiblingIndex();
      if (actorBehind && objectIndex < playerIndex) {
        occluder.node.setSiblingIndex((occluder.node.parent?.children.length ?? 1) - 1);
      } else if (!actorBehind && objectIndex > playerIndex) {
        occluder.node.setSiblingIndex(playerIndex);
      }
    }

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
    const maxX = this.mapWidth / 2 - visible.width / 2;
    const maxY = this.mapHeight / 2 - visible.height / 2;
    const cameraX = this.clamp(this.cameraPos.x, -maxX, maxX);
    const cameraY = this.clamp(this.cameraPos.y, -maxY, maxY);
    this.world.setPosition(-Math.round(cameraX), -Math.round(cameraY), 0);
  }

  private canStand(x: number, y: number) {
    return this.canStandRadius(x, y, this.playerRadius);
  }

  private canStandRadius(x: number, y: number, radius: number) {
    const hw = this.mapWidth / 2 - 66; const hh = this.mapHeight / 2 - 66;
    if (x < -hw || x > hw || y < -hh || y > hh) return false;
    for (const r of this.obstacles) {
      if (x + radius > r.x - r.w / 2 && x - radius < r.x + r.w / 2 && y + radius > r.y - r.h / 2 && y - radius < r.y + r.h / 2) return false;
    }
    if (this.pointInWater(x, y, radius)) return false;
    return true;
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

  private moveTemplePlayerWithCollision(dx: number, dy: number) {
    // Fixed-size sweep steps prevent a long frame from jumping across a thin
    // brazier base or table edge. Axis separation retains the existing smooth
    // wall-sliding behaviour and does not change movement speed or input.
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
      if (!node.isValid || node === self) return;
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
      if (!node.isValid || node === self) return;
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
    if (this.waterCircles.some(c => Math.hypot(x - c.x, y - c.y) < c.radius + margin)) return true;
    return this.waterSegments.some(s => this.pointToSegmentDistance(x, y, s.ax, s.ay, s.bx, s.by) < s.radius + margin);
  }

  private pointInAnyObstacle(x: number, y: number) {
    return this.obstacles.some(r => x > r.x - r.w / 2 - 30 && x < r.x + r.w / 2 + 30 && y > r.y - r.h / 2 - 30 && y < r.y + r.h / 2 + 30);
  }

  private addObstacle(x: number, y: number, w: number, h: number, name: string) { this.obstacles.push({ x, y, w, h, name }); }

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

  private loadCitySave(): CitySave {
    const defaults: CitySave = {
      version: 1,
      ink: 8,
      coins: 0,
      experience: 0,
      // The three teaching cards remain the starter set. Temporary field finds
      // stay dark in the codex until the player actually excavates them.
      unlockedOracleIds: ['rain', 'sun', 'field'],
      mastery: {},
      ownedProductIds: ['shell-clay'],
      equippedShellId: 'shell-clay',
      placedDecorationIds: [],
    };
    try {
      const raw = sys.localStorage.getItem(this.saveKey);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<CitySave>;
      return {
        ...defaults,
        ...parsed,
        ink: Math.max(0, Number(parsed.ink ?? defaults.ink)),
        coins: Math.max(0, Number(parsed.coins ?? defaults.coins)),
        experience: Math.max(0, Number(parsed.experience ?? defaults.experience)),
        unlockedOracleIds: Array.isArray(parsed.unlockedOracleIds) ? parsed.unlockedOracleIds : defaults.unlockedOracleIds,
        mastery: parsed.mastery && typeof parsed.mastery === 'object' ? parsed.mastery : {},
        ownedProductIds: Array.from(new Set(['shell-clay', ...(Array.isArray(parsed.ownedProductIds) ? parsed.ownedProductIds : [])])),
        placedDecorationIds: Array.isArray(parsed.placedDecorationIds) ? parsed.placedDecorationIds : [],
      };
    } catch (error) {
      console.warn('[YinXuCity] save data could not be read, using a safe new profile.', error);
      return defaults;
    }
  }

  private persistCitySave() {
    try {
      sys.localStorage.setItem(this.saveKey, JSON.stringify(this.save));
    } catch (error) {
      console.warn('[YinXuCity] save data could not be written.', error);
    }
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

  private createDecorationSlots() {
    this.decorationNodes.clear();
    const positions: Array<[number, number]> = [
      [-330, 890], [575, 940], [390, 610], [-1035, 500], [330, 890], [1045, 820],
    ];
    this.shopProducts.filter(product => product.category === 'decoration').forEach(product => {
      const slot = product.slot ?? 0;
      const position = positions[slot] ?? positions[0];
      const root = new Node(`PlacedDecoration-${product.id}`);
      root.parent = this.world;
      root.setPosition(position[0], position[1], 27);
      root.addComponent(UITransform).setContentSize(92, 100);
      this.drawDecorationIcon(root, product.id, 1);
      root.active = this.save.placedDecorationIds.includes(product.id);
      this.decorationNodes.set(product.id, root);
    });
  }

  private drawDecorationIcon(parent: Node, id: string, scale: number) {
    const g = this.localGraphics(`${id}-PixelDecoration`, parent, 0, 0, 90 * scale, 96 * scale, 0);
    const brown = new Color(99, 61, 38); const bronze = new Color(104, 116, 72); const gold = new Color(205, 155, 70);
    if (id === 'decor-ding') {
      g.fillColor = bronze; g.roundRect(-25 * scale, -8 * scale, 50 * scale, 36 * scale, 6 * scale); g.fill();
      g.fillColor = brown; g.rect(-19 * scale, -28 * scale, 7 * scale, 22 * scale); g.rect(12 * scale, -28 * scale, 7 * scale, 22 * scale); g.fill();
      g.strokeColor = gold; g.lineWidth = 3 * scale; g.moveTo(-25 * scale, 8 * scale); g.lineTo(25 * scale, 8 * scale); g.stroke();
    } else if (id === 'decor-oracle-stand') {
      g.fillColor = brown; g.rect(-30 * scale, -25 * scale, 60 * scale, 12 * scale); g.rect(-22 * scale, -13 * scale, 8 * scale, 40 * scale); g.rect(14 * scale, -13 * scale, 8 * scale, 40 * scale); g.fill();
      g.fillColor = new Color(222, 190, 126); g.roundRect(-18 * scale, 2 * scale, 36 * scale, 34 * scale, 5 * scale); g.fill();
    } else if (id === 'decor-millet') {
      g.fillColor = new Color(154, 91, 48); g.roundRect(-24 * scale, -27 * scale, 48 * scale, 28 * scale, 6 * scale); g.fill();
      g.strokeColor = new Color(101, 132, 61); g.lineWidth = 5 * scale;
      [-16, -7, 3, 13].forEach((x, index) => { g.moveTo(x * scale, 0); g.lineTo((x + (index % 2 ? 8 : -5)) * scale, (31 + index % 3 * 5) * scale); }); g.stroke();
    } else if (id === 'decor-jars') {
      g.fillColor = new Color(156, 88, 49); g.circle(-15 * scale, -6 * scale, 18 * scale); g.circle(15 * scale, -10 * scale, 14 * scale); g.fill();
      g.fillColor = brown; g.rect(-25 * scale, 9 * scale, 20 * scale, 7 * scale); g.rect(8 * scale, 2 * scale, 15 * scale, 6 * scale); g.fill();
    } else if (id === 'decor-lamp') {
      g.fillColor = brown; g.rect(-5 * scale, -28 * scale, 10 * scale, 54 * scale); g.fill();
      g.fillColor = bronze; g.moveTo(-22 * scale, 9 * scale); g.lineTo(22 * scale, 9 * scale); g.lineTo(14 * scale, 30 * scale); g.lineTo(-14 * scale, 30 * scale); g.close(); g.fill();
      g.fillColor = new Color(242, 163, 62); g.circle(0, 22 * scale, 9 * scale); g.fill();
    } else {
      g.fillColor = brown; g.rect(-4 * scale, -30 * scale, 8 * scale, 65 * scale); g.fill();
      g.fillColor = new Color(157, 55, 45); g.moveTo(4 * scale, 30 * scale); g.lineTo(32 * scale, 20 * scale); g.lineTo(4 * scale, 6 * scale); g.close(); g.fill();
      g.strokeColor = gold; g.lineWidth = 2 * scale; g.moveTo(9 * scale, 22 * scale); g.lineTo(26 * scale, 18 * scale); g.stroke();
    }
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
    this.decorationNodes.forEach((node, id) => {
      if (node.isValid) node.active = this.save.placedDecorationIds.includes(id);
    });

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
    this.currentAttempts = 0;
    this.divinationStage = 'waiting';
    this.queueTimer = .8;
    this.buildDivinationFrame();
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
    const canRise = this.divinationStage === 'waiting';
    this.riseButtonLabel.string = canRise ? '起身离开' : '本轮进行中';
    this.riseButtonLabel.color = canRise ? new Color(255, 238, 197) : new Color(191, 173, 143);
  }

  private spawnNextSupplicant() {
    const available = this.divinationQuestions.filter(question => this.save.unlockedOracleIds.includes(question.answerId));
    if (available.length === 0) {
      if (this.divinationText?.isValid) this.divinationText.string = '背包中还没有能够回应村民问题的甲骨，请先去野外学习。';
      return;
    }
    let next = Math.floor(Math.random() * available.length);
    if (available.length > 1 && available[next] === this.currentQuestion) next = (next + 1) % available.length;
    this.currentQuestion = available[next];
    this.currentQuestionIndex = this.divinationQuestions.indexOf(this.currentQuestion);
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
    const cards = this.oracleCards.filter(card => this.save.unlockedOracleIds.includes(card.id)).slice(0, 3);
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
    const card = this.oracleCards.filter(item => this.save.unlockedOracleIds.includes(item.id)).slice(0, 3)[cardIndex];
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
    this.save.ink = Math.max(0, this.save.ink - this.divinationInkCost);
    this.currentMasteryStars = this.currentAttempts === 0 ? 3 : this.currentAttempts === 1 ? 2 : 1;
    const multiplier = card.quality === 'gold' ? 2 : card.quality === 'red' ? 1.5 : 1;
    this.currentRewardCoins = Math.round(20 * multiplier);
    this.currentRewardExperience = Math.round(10 * multiplier);
    this.save.coins += this.currentRewardCoins;
    this.save.experience += this.currentRewardExperience;
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
    this.overlayRoot.getChildByName('OracleSelectionLayer')?.destroy();
    this.oracleCardNodes = [];
    this.oracleCardHome = [];
    const card = this.oracleCards.find(item => item.id === this.currentQuestion?.answerId);
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
      `${quality}\n\n字义：${card.meaning}\n\n字形学习：${card.evolution}\n\n商代知识：${card.history}`,
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

  private finishDivinationReview() {
    if (this.divinationStage !== 'review') return;
    this.overlayRoot?.getChildByName('DivinationReviewPanel')?.destroy();
    if (this.divinationText?.isValid) {
      this.divinationText.string = this.save.ink >= this.divinationInkCost
        ? `${this.currentQuestion?.villager ?? '村民'}谢过卜官，下一位村民稍后前来。此时可以起身离开。`
        : '本次学习已经完成，但墨料不足，无法继续接待村民。现在可以起身离开。';
    }
    this.supplicantLeaving = true;
    this.currentQuestion = null;
    this.divinationStage = 'waiting';
    this.queueTimer = this.save.ink >= this.divinationInkCost ? 1.15 : 9999;
    this.updateRiseButtonState();
  }

  private exitDivination() {
    if (this.divinationStage !== 'waiting') {
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
    this.showPlayerFrame(0);
    this.animatePlayer(false, new Vec2(), 0);
    this.updateTempleSeatDepthOrdering();
    this.destroyOverlayRoot();
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

  private showExcavationLearning(site: ExcavationSite, card: OracleCardData) {
    this.stopPlayerInput();
    this.overlay = 'excavationLearning';
    this.excavationLearningStage = 'question';
    this.excavationLearningSite = site;
    this.excavationLearningCard = card;
    this.excavationLearningAttempts = 0;
    this.excavationWrongChoices = [];
    this.excavationLearningResult = '';
    const distractors = this.oracleCards.filter(item => item.excavatable && item.id !== card.id);
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
    const card = this.oracleCards.find(item => item.id === 'river-official' && item.excavatable);
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
    const root = new Node('ExcavationLearningOverlay');
    root.parent = this.node;
    root.setPosition(0, 0, 420);
    root.addComponent(UITransform).setContentSize(1280, 720);
    this.overlayRoot = root;
    const shade = this.localGraphics('LearningMapShade', root, 0, 0, 1280, 720, 0);
    shade.fillColor = new Color(31, 27, 24, 112); shade.rect(-640, -360, 1280, 720); shade.fill();
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
    const unlockedOrder = this.oracleCards.filter(item => this.save.unlockedOracleIds.includes(item.id));
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
    const teachingText = `现代汉字：${this.oracleModernCharacter(card)}\n读音：${card.pinyin}\n\n一、字义与象形来源\n${card.meaning}\n\n二、字形演变与辨识要点\n${card.evolution}\n\n三、历史来源与商代生活\n${card.history}\n\n学习提示：再次在背包“图鉴”中点击该字，可以随时复习以上内容。`;
    this.createUiLabel(root, 'ExcavationTeachingText', teachingText,
      170, -2, 650, 420, 18, new Color(74, 43, 29), 'left', 5);
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
    this.overlay = 'none';
    this.excavationLearningStage = 'none';
    this.excavationLearningSite = null;
    this.excavationLearningCard = null;
    this.excavationLearningOptions = [];
    this.excavationWrongChoices = [];
    this.destroyOverlayRoot();
    this.showStatusNotice(`${card ? this.oracleModernCharacter(card) : '甲骨文'}的完整学习档案已收入背包图鉴。`, 4.2);
  }

  private openBackpack() {
    if (this.overlay !== 'none' || this.seated) return;
    this.stopPlayerInput();
    this.overlay = 'backpack';
    this.selectedBackpackIndex = this.clamp(this.selectedBackpackIndex, 0, Math.max(0, this.save.unlockedOracleIds.length - 1));
    this.buildBackpackUi();
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
      { id: 'tools', text: '工具栏', x: -285 },
      { id: 'clothing', text: '服装栏', x: 0 },
      { id: 'codex', text: '甲骨图鉴', x: 285 },
    ];
    tabs.forEach(tab => this.drawUiButton(root, `BackpackTab-${tab.id}`, tab.text, tab.x, 186, 220, 50, this.backpackTab === tab.id));

    if (this.backpackTab === 'tools') {
      const tools: Array<{ id: ToolKind; name: string; note: string; asset?: string; x: number }> = [
        { id: 'none', name: '空手', note: '收起当前工具', x: -350 },
        { id: 'shovel', name: '小铲子', note: '野外挖坑 · 15秒复原', asset: 'tool-shovel-v1', x: -118 },
        { id: 'fishing', name: '钓鱼钩', note: '临水抛钩 · 水面涟漪', asset: 'tool-fishing-hook-v1', x: 118 },
        { id: 'machete', name: '砍刀', note: '清理野草与矮灌木', asset: 'tool-machete-v1', x: 350 },
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
          const iconSize = tool.id === 'fishing' ? [96, 104] : tool.id === 'shovel' ? [64, 92] : [58, 94];
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

    if (this.backpackTab === 'clothing') {
      const hanger = this.localGraphics('ClothingPlaceholder', root, 0, 0, 220, 180, 4);
      hanger.strokeColor = new Color(210, 170, 101); hanger.lineWidth = 6;
      hanger.arc(0, 58, 20, Math.PI * .1, Math.PI * 1.6, false); hanger.moveTo(-6, 37); hanger.lineTo(-76, -37); hanger.lineTo(76, -37); hanger.lineTo(6, 37); hanger.stroke();
      this.createUiLabel(root, 'ClothingEmptyTitle', '服装栏暂未开放', 0, -100, 460, 46, 25, new Color(255, 224, 164));
      this.createUiLabel(root, 'ClothingEmptyHint', '该栏位已经预留，后续服装资源可直接接入。', 0, -146, 620, 34, 16, new Color(208, 184, 143));
      return;
    }

    const unlocked = this.oracleCards.filter(card => this.save.unlockedOracleIds.includes(card.id));
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
      } else this.createUiLabel(root, `CodexGlyph-${index}`, '◇', cardX, cardY + 7, 74, 48, 28, new Color(72, 68, 65));
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
    const unlocked = this.oracleCards.filter(card => this.save.unlockedOracleIds.includes(card.id));
    const card = unlocked[this.selectedBackpackIndex];
    if (!card) {
      this.backpackDetailLabel.string = '尚未收录甲骨文字。请前往野外寻找发光点位。';
      return;
    }
    const record = this.save.mastery[card.id] ?? { attempts: 0, bestStars: 0, correctCount: 0 };
    const quality = card.quality === 'blue' ? '蓝光·平民普通卜骨' : card.quality === 'red' ? '红光·贵族涂朱卜甲' : '金光·王室传世龟甲';
    const stars = '★'.repeat(record.bestStars) + '☆'.repeat(3 - record.bestStars);
    this.backpackDetailLabel.string = `${card.modern}  ${card.pinyin}\n${quality}\n\n字义与象形：\n${card.meaning}\n\n字形演变：\n${card.evolution}\n\n商代历史：\n${card.history}\n\n学习记录：${stars}  ·  正确占卜 ${record.correctCount} 次`;
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
    this.createUiLabel(root, 'ShopConfirmText', '是否进入商店查看龟甲外观、村落装饰和收藏拓片？', 0, 32, 490, 72, 20, new Color(93, 57, 37));
    this.drawUiButton(root, 'ShopCancelButton', '暂不进入', -125, -65, 180, 58, false);
    this.drawUiButton(root, 'ShopEnterButton', '进入商店', 125, -65, 180, 58, true);
  }

  private openShop() {
    this.overlay = 'shop';
    this.selectedShopCategory = 'shell';
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

    const categories: Array<[ShopCategory, string]> = [
      ['shell', '龟甲外观'], ['decoration', '村落装饰'], ['rubbing', '收藏拓片'],
    ];
    categories.forEach(([category, label], index) => {
      const y = 150 - index * 90;
      const selected = category === this.selectedShopCategory;
      const tab = this.localGraphics(`ShopCategory-${category}`, root, -470, y, 170, 66, 3);
      tab.fillColor = selected ? new Color(165, 74, 49) : new Color(75, 52, 39);
      tab.roundRect(-82, -30, 164, 60, 9); tab.fill();
      tab.strokeColor = selected ? new Color(244, 199, 104) : new Color(143, 103, 65); tab.lineWidth = 3; tab.roundRect(-82, -30, 164, 60, 9); tab.stroke();
      this.createUiLabel(root, `ShopCategoryLabel-${category}`, label, -470, y, 150, 44, 19, selected ? new Color(255, 234, 182) : new Color(210, 188, 148));
    });

    const products = this.shopProducts.filter(product => product.category === this.selectedShopCategory);
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
      const equipped = selected.category === 'shell' && this.save.equippedShellId === selected.id;
      const buttonText = equipped ? '使用中' : owned ? (selected.category === 'shell' ? '装备' : '已拥有') : `购买 · ${selected.price} 贝币`;
      this.drawUiButton(root, 'ShopPurchaseButton', buttonText, 340, -178, 250, 58, !owned || (selected.category === 'shell' && !equipped));
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
    if (product.category === 'decoration') {
      this.drawDecorationIcon(holder, product.id, scale);
      return;
    }
    const g = holder.addComponent(Graphics);
    if (product.category === 'shell') {
      g.fillColor = product.id === 'shell-gold' ? new Color(225, 179, 74) : product.id === 'shell-vermilion' ? new Color(181, 75, 53) : new Color(213, 179, 116);
      g.ellipse(0, 0, 35 * scale, 45 * scale); g.fill();
      g.strokeColor = new Color(78, 48, 33); g.lineWidth = 4 * scale; g.ellipse(0, 0, 35 * scale, 45 * scale); g.stroke();
      g.moveTo(-3 * scale, 30 * scale); g.lineTo(4 * scale, 9 * scale); g.lineTo(-8 * scale, -10 * scale); g.lineTo(7 * scale, -34 * scale); g.stroke();
    } else {
      g.fillColor = new Color(226, 194, 132); g.roundRect(-38 * scale, -43 * scale, 76 * scale, 86 * scale, 7 * scale); g.fill();
      g.strokeColor = this.qualityColor(product.quality); g.lineWidth = 4 * scale; g.roundRect(-38 * scale, -43 * scale, 76 * scale, 86 * scale, 7 * scale); g.stroke();
      g.strokeColor = new Color(89, 55, 36); g.lineWidth = 2 * scale;
      for (let row = 0; row < 3; row++) { g.moveTo(-24 * scale, (20 - row * 18) * scale); g.lineTo(24 * scale, (20 - row * 18) * scale); }
      g.stroke();
    }
  }

  private purchaseSelectedShopProduct() {
    if (this.overlay !== 'shop') return;
    const products = this.shopProducts.filter(product => product.category === this.selectedShopCategory);
    const product = products[this.selectedShopProductIndex];
    if (!product) return;
    const owned = this.save.ownedProductIds.includes(product.id);
    if (owned) {
      if (product.category === 'shell' && this.save.equippedShellId !== product.id) {
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
    if (product.category === 'shell') this.save.equippedShellId = product.id;
    if (product.category === 'decoration' && !this.save.placedDecorationIds.includes(product.id)) {
      this.save.placedDecorationIds.push(product.id);
    }
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
    this.overlay = 'none';
    this.destroyOverlayRoot();
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
      if (y > 1010 && Math.abs(x) < 260) zone = '占卜宗庙';
      else if (x > 690 && y > 500) zone = '商代集市';
      else if (x > 175 && x < 375 && y > 510 && y < 730) zone = '村落水井';
    }
    else if (this.inRegion(x, y, this.tombRegion)) zone = '甲骨窑穴·王陵祭祀区';
    else if (this.inRegion(x, y, this.mountainRegion)) zone = '山林高地';
    else if (this.inRegion(x, y, this.fieldRegion)) zone = '郊外田野';
    else if (this.inRegion(x, y, this.lakeRegion)) zone = '洹水湖湾';
    else if (this.inRegion(x, y, this.riverRegion)) zone = '洹水河畔';
    this.region.string = zone;
    this.actionKind = 'none';
    if (this.overlay === 'none' && !this.seated) {
      if (this.worldMode === 'templeInterior') {
        if (Math.hypot(x, y + 265) <= 76) this.actionKind = 'templeExit';
        else if (Math.hypot(x - this.templeSeatPoint.x, y - this.templeSeatPoint.y) <= 76) this.actionKind = 'templeSeat';
      } else if (Math.hypot(x, y - 1010) <= 105) this.actionKind = 'temple';
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
        : interactionHint || (this.blocked ? '前方不可通行 · 寻找城门或绕开障碍' : `摇杆 / WASD 移动  ·  坐标 ${Math.round(x)}, ${Math.round(y)}`);
    }
  }

  private performWorldAction() {
    if (this.overlay !== 'none') return;
    if (this.actionKind === 'temple') this.enterTempleInterior();
    else if (this.actionKind === 'templeSeat') this.beginDivination();
    else if (this.actionKind === 'templeExit') this.exitTempleInterior();
    else if (this.actionKind === 'shop') this.showShopConfirmation();
  }

  private onKeyDown(e: EventKeyboard) {
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
      sys.localStorage.removeItem(this.saveKey);
      this.save = this.loadCitySave();
      this.persistCitySave();
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
      const previewTools: ToolKind[] = ['none', 'shovel', 'fishing', 'machete'];
      const nextTool = previewTools[(previewTools.indexOf(this.equippedTool) + 1) % previewTools.length];
      this.equipTool(nextTool);
      const toolName = nextTool === 'none' ? '空手' : nextTool === 'shovel' ? '小铲子' : nextTool === 'fishing' ? '钓鱼钩' : '砍刀';
      if (this.status?.isValid) this.status.string = `预览：已切换为${toolName}`;
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_F && this.overlay === 'none') {
      this.useEquippedTool();
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_G && this.overlay === 'none') {
      if (this.worldMode === 'templeInterior') this.exitTempleInterior();
      this.playerPos.set(-3920, -940);
      this.player.setPosition(-3920, -940, 80);
      this.facing = 'left';
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
      this.playerPos.set(0, 1010);
      this.player.setPosition(0, 1010, 80);
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
      this.playerPos.set(-3420, -820);
      this.player.setPosition(-3420, -820, 80);
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
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_C && this.overlay === 'shop') {
      const categories: ShopCategory[] = ['shell', 'decoration', 'rubbing'];
      const current = categories.indexOf(this.selectedShopCategory);
      this.selectedShopCategory = categories[(current + 1) % categories.length];
      this.selectedShopProductIndex = 0;
      this.buildShopUi();
      return;
    }
    if (sys.isBrowser && e.keyCode === KeyCode.KEY_N && this.overlay === 'shop') {
      const products = this.shopProducts.filter(product => product.category === this.selectedShopCategory);
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
      if (this.actionKind !== 'none') this.performWorldAction();
      else if (this.equippedTool !== 'none') this.useEquippedTool();
      return;
    }
    if (Math.hypot(localX - 380, localY + 230) <= 66) {
      this.openBackpack();
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
    if (this.overlay === 'shopConfirm') {
      if (this.pointInUiRect(x, y, -125, -65, 180, 58)) this.closeCityOverlay();
      else if (this.pointInUiRect(x, y, 125, -65, 180, 58)) this.openShop();
      return;
    }
    if (this.overlay === 'backpack') {
      if (this.pointInUiRect(x, y, 443, 240, 104, 44)) {
        this.closeCityOverlay();
        return;
      }
      const tabs: Array<{ id: BackpackTab; x: number }> = [
        { id: 'tools', x: -285 }, { id: 'clothing', x: 0 }, { id: 'codex', x: 285 },
      ];
      for (const tab of tabs) {
        if (!this.pointInUiRect(x, y, tab.x, 186, 220, 50)) continue;
        this.backpackTab = tab.id;
        if (tab.id === 'codex') this.codexPage = Math.floor(this.selectedBackpackIndex / 12);
        this.buildBackpackUi();
        return;
      }
      if (this.backpackTab === 'tools') {
        const tools: Array<{ id: ToolKind; x: number }> = [
          { id: 'none', x: -350 }, { id: 'shovel', x: -118 }, { id: 'fishing', x: 118 }, { id: 'machete', x: 350 },
        ];
        for (const tool of tools) {
          if (!this.pointInUiRect(x, y, tool.x, -28, 205, 292)) continue;
          this.equipTool(tool.id);
          this.buildBackpackUi();
          return;
        }
      } else if (this.backpackTab === 'codex') {
        const unlocked = this.oracleCards.filter(card => this.save.unlockedOracleIds.includes(card.id));
        const codexPageCount = Math.max(1, Math.ceil(unlocked.length / 12));
        if (this.codexPage > 0 && this.pointInUiRect(x, y, -410, -258, 105, 42)) {
          this.codexPage--; this.buildBackpackUi(); return;
        }
        if (this.codexPage < codexPageCount - 1 && this.pointInUiRect(x, y, -130, -258, 105, 42)) {
          this.codexPage++; this.buildBackpackUi(); return;
        }
        const codexPageStart = this.codexPage * 12;
        const pageLength = Math.min(12, Math.max(0, unlocked.length - codexPageStart));
        for (let index = 0; index < pageLength; index++) {
          const cardX = -385 + (index % 3) * 118;
          const cardY = 105 - Math.floor(index / 3) * 92;
          if (!this.pointInUiRect(x, y, cardX, cardY, 102, 80)) continue;
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
      const categories: ShopCategory[] = ['shell', 'decoration', 'rubbing'];
      for (let index = 0; index < categories.length; index++) {
        if (!this.pointInUiRect(x, y, -470, 150 - index * 90, 170, 66)) continue;
        this.selectedShopCategory = categories[index];
        this.selectedShopProductIndex = 0;
        this.buildShopUi();
        return;
      }
      const products = this.shopProducts.filter(product => product.category === this.selectedShopCategory);
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

  private pixelSprite(name: string, asset: string, parent: Node, x: number, y: number, w: number, h: number, z: number) {
    const node = new Node(name);
    node.parent = parent;
    node.setPosition(x, y, z);
    node.addComponent(UITransform).setContentSize(w, h);
    this.attachPixelSprite(node, asset);
    if (parent === this.world) this.registerPixelDepthOccluder(node, asset, x, y, w, h, z);
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
    const fallback = this.createUiLabel(parent, `${name}-Fallback`, card.glyph, x, y, maxWidth, maxHeight,
      Math.max(20, Math.round(Math.min(maxWidth, maxHeight) * .52)), tint, 'center', z);
    if (!card.asset || !card.imageBounds) return fallback.node;

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
    });
    return node;
  }

  /** Deduplicates async resource requests so 145 grass nodes share one load. */
  private requestFrame(asset: string, apply: (frame: SpriteFrame) => void) {
    const key = `tiles/${asset}/spriteFrame`;
    this.requestSpriteFrame(key, apply);
  }

  private requestSpriteFrame(key: string, apply: (frame: SpriteFrame) => void) {
    const cached = this.frameCache.get(key);
    if (cached) {
      apply(cached);
      return;
    }

    const waiting = this.frameWaiters.get(key);
    if (waiting) {
      waiting.push(apply);
      return;
    }

    this.frameWaiters.set(key, [apply]);
    resources.load(key, SpriteFrame, (error, frame) => {
      const callbacks = this.frameWaiters.get(key) ?? [];
      this.frameWaiters.delete(key);
      if (error || !frame) {
        console.warn(`[YinXuCity] pixel resource failed: ${key}`, error);
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
    this.addObstacle(centerX + 555, centerY + 257, 78, 54, '湖岸高地小屋');
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
