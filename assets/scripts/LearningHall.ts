import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  input,
  Input,
  Label,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
  view,
} from 'cc';

const { ccclass } = _decorator;

export type HallCard = {
  id: string;
  glyph: string;
  modern: string;
  pinyin: string;
  quality: 'blue' | 'red' | 'gold';
  meaning: string;
  evolution: string;
  history: string;
  asset?: string;
  imageBounds?: readonly [number, number, number, number];
  unlocked: boolean;
};

type HallMode = 'home' | 'codex' | 'review' | 'reviewResult' | 'progress' | 'parent' | 'settings';
type HallCallbacks = {
  getCards: () => HallCard[];
  getProgress: () => { ink: number; attempts: number; correct: number };
  recordReview: (cardId: string, correct: boolean) => void;
  enterYinXu: () => void;
};

/**
 * Standalone learning-hall controller. It owns all launch, review and codex UI;
 * YinXuCity only supplies saved data and the transition back into the world.
 */
@ccclass('LearningHall')
export class LearningHall extends Component {
  private callbacks: HallCallbacks | null = null;
  private root: Node | null = null;
  private homeButton: Node | null = null;
  private mode: HallMode = 'home';
  private selectedCardId: string | null = null;
  private reviewQuestions: HallCard[] = [];
  private reviewOptions: HallCard[] = [];
  private reviewIndex = 0;
  private reviewCorrect = 0;
  private reviewMistakes: HallCard[] = [];
  private reviewLibraryOpen = false;
  private hiddenGameNodes: Node[] = [];
  private viewportScale = 1;

  get isOpen() {
    return this.root?.isValid ?? false;
  }

  initialize(callbacks: HallCallbacks) {
    this.callbacks = callbacks;
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    this.createHomeButton();
    this.open();
  }

  onDestroy() {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
  }

  open() {
    this.render('home');
  }

  private cards() {
    return this.callbacks?.getCards() ?? [];
  }

  private progress() {
    return this.callbacks?.getProgress() ?? { ink: 0, attempts: 0, correct: 0 };
  }

  private createRoot(name: string, mode: HallMode) {
    this.root?.destroy();
    this.mode = mode;
    const visible = view.getVisibleSize();
    this.viewportScale = Math.min(visible.width / 1280, visible.height / 720);
    const root = new Node(name);
    root.parent = this.node;
    root.setPosition(0, 0, 600);
    root.addComponent(UITransform).setContentSize(1280, 720);
    root.setScale(this.viewportScale, this.viewportScale, 1);
    this.root = root;
    if (this.homeButton?.isValid) this.homeButton.active = false;
    this.hideGameNodes();
    this.drawBackground(root);
    return root;
  }

  private close() {
    this.root?.destroy();
    this.root = null;
    this.hiddenGameNodes.forEach(node => { if (node.isValid) node.active = true; });
    this.hiddenGameNodes = [];
    if (this.homeButton?.isValid) this.homeButton.active = true;
  }

  /** Keeps the gameplay world out of the launch screen without disabling Canvas' camera. */
  private hideGameNodes() {
    if (this.hiddenGameNodes.length > 0) return;
    this.hiddenGameNodes = this.node.children.filter(node => node !== this.root && node !== this.homeButton && node.name !== 'Camera' && node.active);
    this.hiddenGameNodes.forEach(node => { node.active = false; });
  }

  private createHomeButton() {
    const button = new Node('ReturnLearningHallButton');
    button.parent = this.node;
    button.setPosition(295, 309, 300);
    button.addComponent(UITransform).setContentSize(120, 52);
    const graphics = button.addComponent(Graphics);
    graphics.fillColor = new Color(66, 58, 91, 238); graphics.roundRect(-58, -24, 116, 48, 12); graphics.fill();
    graphics.strokeColor = new Color(232, 192, 107); graphics.lineWidth = 2; graphics.roundRect(-58, -24, 116, 48, 12); graphics.stroke();
    this.label(button, 'ReturnLearningHallLabel', '学习大厅', 0, 0, 104, 36, 16, new Color(255, 237, 192));
    button.active = false;
    this.homeButton = button;
  }

  private drawBackground(root: Node) {
    const visible = view.getVisibleSize();
    const width = visible.width / this.viewportScale;
    const height = visible.height / this.viewportScale;
    const graphics = this.graphics(root, 'HallBackground', 0, 0, width, height, 0);
    graphics.fillColor = new Color(18, 22, 49, 253); graphics.rect(-width / 2, -height / 2, width, height); graphics.fill();
    const bands: Array<[number, Color]> = [
      [272, new Color(57, 57, 104, 150)], [82, new Color(49, 69, 114, 110)], [-116, new Color(35, 50, 83, 115)],
    ];
    bands.forEach(([y, color]) => { graphics.fillColor = color; graphics.rect(-width / 2, y - 94, width, 188); graphics.fill(); });
    graphics.strokeColor = new Color(226, 190, 110, 46); graphics.lineWidth = 2;
    for (let x = -width / 2; x < width / 2; x += 110) { graphics.moveTo(x, -height / 2); graphics.lineTo(x + 190, -height / 2 + 210); }
    for (let y = -height / 2 + 40; y < height / 2; y += 105) { graphics.moveTo(-width / 2, y); graphics.lineTo(width / 2, y); }
    graphics.stroke();
    this.label(root, 'HallPattern', '甲  骨  文  ·  殷  商  探  索', 0, -height / 2 + 32, 920, 28, 14, new Color(244, 205, 132, 115));
  }

  private drawHeader(root: Node, title: string, subtitle: string, back = false) {
    const header = this.graphics(root, 'HallHeader', 0, 286, 1150, 104, 2);
    header.fillColor = new Color(60, 57, 101, 240); header.roundRect(-575, -52, 1150, 104, 22); header.fill();
    header.strokeColor = new Color(219, 180, 108, 176); header.lineWidth = 2; header.roundRect(-575, -52, 1150, 104, 22); header.stroke();
    const avatarFrame = new Node('HallAvatarFrame'); avatarFrame.parent = root; avatarFrame.setPosition(-505, 286, 4); avatarFrame.addComponent(UITransform).setContentSize(74, 74);
    const avatarFallback = avatarFrame.addComponent(Graphics); avatarFallback.fillColor = new Color(232, 190, 118); avatarFallback.circle(0, 0, 35); avatarFallback.fill();
    const avatar = new Node('HallAvatar'); avatar.parent = root; avatar.setPosition(-505, 286, 5); avatar.addComponent(UITransform).setContentSize(64, 64);
    const avatarSprite = avatar.addComponent(Sprite); avatarSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.loadSprite('characters/oracle-apprentice/down-0/spriteFrame', avatar, avatarSprite, true);
    this.label(root, 'HallPlayerName', '甲骨小学生', -325, 304, 220, 34, 22, new Color(255, 239, 201), 'left', 6);
    this.label(root, 'HallPlayerStatus', subtitle, -300, 272, 280, 28, 13, new Color(214, 206, 226), 'left', 6);
    this.label(root, 'HallTitle', title, 190, 291, 530, 44, 29, new Color(255, 236, 185), 'center', 6);
    if (back) this.button(root, 'HallBack', '返回大厅', 480, 286, 150, 48, false);
  }

  private drawModule(root: Node, name: string, title: string, detail: string, x: number, y: number, color: Color, glyph: string) {
    const card = this.graphics(root, name, x, y, 330, 178, 2);
    card.fillColor = color; card.roundRect(-165, -89, 330, 178, 20); card.fill();
    card.strokeColor = new Color(255, 240, 207, 145); card.lineWidth = 2; card.roundRect(-162, -86, 324, 172, 18); card.stroke();
    card.fillColor = new Color(255, 248, 222, 40); card.circle(113, 24, 64); card.fill();
    this.label(root, `${name}Glyph`, glyph, x + 112, y + 14, 94, 94, 46, new Color(255, 244, 211), 'center', 5);
    // Labels are center-anchored in Cocos, so their centre sits at -70 rather
    // than their left edge. This leaves a fixed gap before the glyph zone.
    this.label(root, `${name}Title`, title, x - 70, y + 36, 155, 42, 24, new Color(255, 247, 222), 'left', 5);
    this.label(root, `${name}Detail`, detail, x - 70, y - 27, 158, 70, 14, new Color(246, 238, 223), 'left', 5);
  }

  private render(mode: HallMode, selectedId: string | null = this.selectedCardId) {
    if (!this.callbacks) return;
    if (mode === 'home') this.renderHome();
    else if (mode === 'codex') this.renderCodex(selectedId);
    else if (mode === 'review') this.renderReview();
    else if (mode === 'reviewResult') this.renderReviewResult();
    else if (mode === 'progress') this.renderProgress();
    else this.renderPlaceholder(mode);
  }

  private renderHome() {
    const root = this.createRoot('LearningHall', 'home');
    const cards = this.cards(); const collected = cards.filter(card => card.unlocked).length;
    this.drawHeader(root, '甲骨学习大厅', `已收集 ${collected} 个甲骨文字 · 今天从一个字开始`);
    this.label(root, 'HallMotto', '每一个字，都是一次穿越三千年的学习', 0, 208, 920, 50, 33, new Color(255, 239, 197));
    this.label(root, 'HallDescription', '进入殷墟探索、收集甲骨文字，并通过复习巩固它们的现代含义。', 0, 170, 850, 32, 17, new Color(218, 223, 235));
    this.drawModule(root, 'HallEnter', '进入殷墟', '从城内出生点出发，继续探索田野、河流与宗庙。', -370, 55, new Color(181, 97, 58), '城');
    this.drawModule(root, 'HallReview', '复习所学', `随机 5 题 · 已掌握 ${collected} 字`, 0, 55, new Color(88, 118, 167), '习');
    this.drawModule(root, 'HallCodex', '甲骨图鉴', `收录 ${collected} / ${cards.length} 个真实字形`, 370, 55, new Color(104, 82, 145), '册');
    this.drawModule(root, 'HallProgress', '学习进度', '查看收集数量、复习正确数与掌握记录。', -370, -156, new Color(65, 132, 118), '进');
    this.drawModule(root, 'HallParent', '家长管理', '学习报告、时长设置和休息提醒将在后续开放。', 0, -156, new Color(104, 145, 99), '家');
    this.drawModule(root, 'HallSettings', '设置', '头像、昵称、声音与更多偏好设置。', 370, -156, new Color(116, 96, 130), '设');
  }

  /** The launch screen intentionally has one clear primary action and lighter secondary actions. */
  private drawHomeHero(root: Node) {
    const hero = this.graphics(root, 'HallHeroRibbon', 0, 196, 1000, 56, 2);
    hero.fillColor = new Color(43, 78, 109, 224); hero.roundRect(-500, -28, 1000, 56, 18); hero.fill();
    hero.strokeColor = new Color(242, 199, 118, 142); hero.lineWidth = 2; hero.roundRect(-497, -25, 994, 50, 15); hero.stroke();
    for (let x = -440; x <= 440; x += 55) {
      hero.fillColor = new Color(255, 229, 163, 25); hero.circle(x, 0, 3); hero.fill();
    }
    this.label(root, 'HallMotto', '每一个字，都是一次穿越三千年的学习', 0, 201, 820, 30, 25, new Color(255, 239, 197));
    this.label(root, 'HallDescription', '探索殷墟、收集甲骨文字，在游戏中读懂它们的现代含义。', 0, 173, 820, 24, 14, new Color(211, 225, 235));
  }

  private drawHomeFeature(root: Node, collected: number) {
    const x = -280; const y = 62; const width = 570; const height = 190;
    const card = this.graphics(root, 'HallEnter', x, y, width, height, 2);
    card.fillColor = new Color(165, 77, 49, 248); card.roundRect(-width / 2, -height / 2, width, height, 23); card.fill();
    card.fillColor = new Color(110, 47, 45, 120); card.roundRect(52, -height / 2, width / 2 - 52, height, 0); card.fill();
    card.strokeColor = new Color(255, 220, 153, 202); card.lineWidth = 3; card.roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 20); card.stroke();
    card.fillColor = new Color(255, 244, 211, 42); card.circle(177, 9, 78); card.fill();
    card.strokeColor = new Color(255, 235, 187, 92); card.lineWidth = 2; card.circle(177, 9, 65); card.stroke();
    this.label(root, 'HallEnterTag', '推荐探索', -470, 125, 125, 24, 13, new Color(255, 236, 188), 'left', 5);
    this.label(root, 'HallEnterTitle', '进入殷墟', -420, 82, 220, 44, 31, new Color(255, 248, 224), 'left', 5);
    this.label(root, 'HallEnterDetail', '从城内出生点出发，继续探索田野、河流与宗庙。', -420, 33, 232, 48, 15, new Color(255, 234, 210), 'left', 5);
    this.label(root, 'HallEnterCount', `已发现 ${collected} 个甲骨文字`, -420, -26, 230, 25, 14, new Color(255, 218, 160), 'left', 5);
    this.label(root, 'HallEnterGlyph', '城', -103, 67, 62, 62, 36, new Color(255, 244, 210), 'center', 5);
    this.button(root, 'HallEnterAction', '立即探索  ›', -405, -62, 190, 44, true);
  }

  private drawHomeQuick(root: Node, name: string, title: string, detail: string, x: number, y: number, color: Color, glyph: string) {
    const width = 360; const height = 94;
    const card = this.graphics(root, name, x, y, width, height, 2);
    card.fillColor = color; card.roundRect(-width / 2, -height / 2, width, height, 18); card.fill();
    card.strokeColor = new Color(239, 218, 179, 155); card.lineWidth = 2; card.roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 16); card.stroke();
    card.fillColor = new Color(255, 247, 219, 36); card.circle(122, 0, 42); card.fill();
    this.label(root, `${name}Title`, title, x - 77, y + 16, 185, 30, 22, new Color(255, 247, 221), 'left', 5);
    this.label(root, `${name}Detail`, detail, x - 77, y - 18, 185, 28, 13, new Color(239, 234, 224), 'left', 5);
    this.label(root, `${name}Glyph`, glyph, x + 122, y, 70, 70, 33, new Color(255, 246, 215), 'center', 5);
  }

  private drawHomeStatus(root: Node, name: string, title: string, detail: string, x: number, y: number, color: Color, glyph: string) {
    const width = 300; const height = 114;
    const card = this.graphics(root, name, x, y, width, height, 2);
    card.fillColor = color; card.roundRect(-width / 2, -height / 2, width, height, 18); card.fill();
    card.strokeColor = new Color(235, 225, 197, 135); card.lineWidth = 2; card.roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 16); card.stroke();
    card.fillColor = new Color(255, 246, 213, 38); card.circle(95, 0, 36); card.fill();
    this.label(root, `${name}Title`, title, x - 52, y + 20, 172, 30, 21, new Color(255, 248, 224), 'left', 5);
    this.label(root, `${name}Detail`, detail, x - 52, y - 19, 172, 32, 13, new Color(239, 237, 226), 'left', 5);
    this.label(root, `${name}Glyph`, glyph, x + 95, y, 58, 58, 28, new Color(255, 247, 217), 'center', 5);
  }

  private renderCodex(selectedId: string | null) {
    const root = this.createRoot('HallCodex', 'codex');
    const cards = this.cards(); const unlocked = cards.filter(card => card.unlocked);
    this.selectedCardId = selectedId && cards.some(card => card.id === selectedId && card.unlocked) ? selectedId : unlocked[0]?.id ?? null;
    this.drawHeader(root, '甲骨图鉴', `已收集 ${unlocked.length} / ${cards.length} 个真实甲骨文字`, true);
    this.panel(root, 'HallCodexGrid', -190, -30, 760, 480, new Color(76, 57, 62), false);
    cards.forEach((card, index) => {
      const x = -430 + (index % 4) * 160; const y = 105 - Math.floor(index / 4) * 200;
      const item = this.graphics(root, `HallCodex-${index}`, x, y, 138, 168, 4);
      item.fillColor = card.unlocked ? new Color(231, 209, 157, 248) : new Color(54, 54, 67, 245);
      item.roundRect(-69, -84, 138, 168, 12); item.fill();
      item.strokeColor = card.unlocked ? this.qualityColor(card.quality) : new Color(122, 119, 140); item.lineWidth = 3; item.roundRect(-67, -82, 134, 164, 10); item.stroke();
      if (card.unlocked) {
        this.oracleGlyph(root, `HallCodexGlyph-${index}`, card, x, y + 22, 60, 75, 6);
        this.label(root, `HallCodexModern-${index}`, card.modern, x, y - 41, 116, 25, 20, new Color(78, 45, 28));
        this.label(root, `HallCodexPinyin-${index}`, card.pinyin, x, y - 63, 116, 22, 13, new Color(108, 65, 42));
      } else {
        this.label(root, `HallCodexLocked-${index}`, '尚未发现', x, y + 10, 116, 40, 17, new Color(180, 177, 193));
        this.label(root, `HallCodexUnknown-${index}`, '？', x, y - 35, 70, 58, 36, new Color(115, 112, 132));
      }
    });
    this.panel(root, 'HallCodexDetail', 405, -30, 330, 480, new Color(223, 184, 113), true);
    const selected = cards.find(card => card.id === this.selectedCardId);
    if (!selected) {
      this.label(root, 'HallCodexEmpty', '先前往殷墟探索，\n发现第一片甲骨文字吧！', 405, 0, 260, 100, 21, new Color(95, 57, 36));
      return;
    }
    this.oracleGlyph(root, 'HallCodexSelectedGlyph', selected, 405, 120, 100, 126, 5);
    this.label(root, 'HallCodexSelectedTitle', `${selected.modern}  ·  ${selected.pinyin}`, 405, 38, 278, 38, 26, new Color(85, 47, 30));
    this.label(root, 'HallCodexSelectedDetail', `字义：${selected.meaning}\n\n演变：${selected.evolution}\n\n商代生活：${selected.history}`, 405, -120, 270, 270, 16, new Color(92, 56, 35), 'left');
  }

  private beginReview() {
    const unlocked = this.cards().filter(card => card.unlocked);
    if (unlocked.length === 0) {
      this.openReviewLibrary();
      return;
    }
    this.reviewLibraryOpen = false;
    this.reviewQuestions = Array.from({ length: 5 }, () => unlocked[Math.floor(Math.random() * unlocked.length)]);
    this.reviewIndex = 0; this.reviewCorrect = 0; this.reviewMistakes = [];
    this.render('review');
  }

  private openReviewLibrary() {
    const root = this.createRoot('HallReviewLibrary', 'review');
    const unlocked = this.cards().filter(card => card.unlocked);
    this.reviewLibraryOpen = true;
    this.drawHeader(root, '复习所学', `已收集 ${unlocked.length} 个甲骨文字 · 浏览字卡后完成随机 5 题`, true);
    this.panel(root, 'HallReviewLibraryPanel', 0, 3, 1040, 430, new Color(76, 57, 62), false);
    if (unlocked.length === 0) {
      this.label(root, 'HallReviewEmptyTitle', '还没有可复习的真实甲骨字', 0, 62, 600, 48, 29, new Color(255, 230, 176));
      this.label(root, 'HallReviewEmptyText', '在殷墟的考古坑完成辨识后，已收集的甲骨文字会自动出现在这里。', 0, -4, 590, 70, 19, new Color(226, 218, 220));
      this.button(root, 'HallReviewGoCity', '进入殷墟探索', 0, -110, 220, 58, true);
      return;
    }
    unlocked.slice(0, 6).forEach((card, index) => {
      const x = -350 + (index % 3) * 350; const y = 76 - Math.floor(index / 3) * 155;
      const item = this.graphics(root, `HallReviewCard-${index}`, x, y, 300, 128, 4);
      item.fillColor = new Color(225, 201, 148, 244); item.roundRect(-150, -64, 300, 128, 14); item.fill();
      item.strokeColor = this.qualityColor(card.quality); item.lineWidth = 3; item.roundRect(-147, -61, 294, 122, 12); item.stroke();
      this.oracleGlyph(root, `HallReviewCardGlyph-${index}`, card, x - 96, y + 2, 52, 72, 6);
      this.label(root, `HallReviewCardModern-${index}`, card.modern, x - 9, y + 24, 152, 30, 23, new Color(78, 45, 28), 'left', 6);
      this.label(root, `HallReviewCardMeaning-${index}`, card.meaning, x - 9, y - 18, 152, 48, 14, new Color(99, 60, 37), 'left', 6);
    });
    this.button(root, 'HallReviewStart', '开始随机 5 题', 0, -226, 230, 58, true);
  }

  private renderReview() {
    const question = this.reviewQuestions[this.reviewIndex];
    if (!question) { this.render('reviewResult'); return; }
    const root = this.createRoot('HallReview', 'review');
    this.drawHeader(root, '复习所学', `第 ${this.reviewIndex + 1} / 5 题 · 选择这个甲骨文对应的现代汉字`, true);
    this.panel(root, 'HallReviewGlyphPanel', -340, -20, 350, 430, new Color(223, 184, 113), true);
    this.label(root, 'HallReviewHint', '这个甲骨文字的意思是？', -340, 160, 280, 36, 20, new Color(84, 48, 29));
    this.oracleGlyph(root, 'HallReviewGlyph', question, -340, 45, 155, 190, 5);
    this.label(root, 'HallReviewCaption', '观察字形，再选择现代汉字', -340, -155, 270, 42, 16, new Color(104, 63, 39));
    const other = this.shuffle(this.cards().filter(card => card.id !== question.id));
    this.reviewOptions = this.shuffle([question, ...other.slice(0, 3)]);
    this.label(root, 'HallReviewOptionsTitle', '选择正确答案', 150, 160, 560, 38, 25, new Color(255, 234, 180));
    const positions: Array<[number, number]> = [[5, 72], [295, 72], [5, -52], [295, -52]];
    this.reviewOptions.forEach((card, index) => this.button(root, `HallReviewOption-${index}`, `${String.fromCharCode(65 + index)}.  ${card.modern}`, positions[index][0], positions[index][1], 250, 88, false));
    this.label(root, 'HallReviewTip', '答题结果会计入学习进度；本期不消耗任何资源。', 150, -185, 560, 30, 15, new Color(206, 208, 226));
  }

  private renderReviewResult() {
    const root = this.createRoot('HallReviewResult', 'reviewResult');
    this.drawHeader(root, '复习完成', '随机 5 题已完成', true);
    this.panel(root, 'HallReviewResultPanel', 0, -5, 1000, 440, new Color(223, 184, 113), true);
    const scorePanel = this.graphics(root, 'HallReviewScorePanel', -290, 40, 330, 250, 4);
    scorePanel.fillColor = new Color(248, 229, 184, 180); scorePanel.roundRect(-165, -125, 330, 250, 18); scorePanel.fill();
    scorePanel.strokeColor = new Color(170, 103, 59); scorePanel.lineWidth = 2; scorePanel.roundRect(-163, -123, 326, 246, 16); scorePanel.stroke();
    this.label(root, 'HallReviewScoreTitle', '本轮复习成绩', -290, 121, 250, 30, 18, new Color(115, 66, 37));
    this.label(root, 'HallReviewScore', `${this.reviewCorrect} / 5`, -290, 50, 270, 92, 62, new Color(148, 68, 47));
    this.label(root, 'HallReviewResultText', this.reviewCorrect === 5 ? '太棒了，全部答对！' : '记住易错字，下次会更棒。', -290, -35, 260, 46, 19, new Color(103, 59, 35));
    this.label(root, 'HallReviewMistakeTitle', this.reviewMistakes.length ? '本轮易错甲骨 · 下次优先复习' : '本轮没有易错字', 155, 130, 490, 34, 22, new Color(95, 54, 34));
    if (this.reviewMistakes.length === 0) {
      this.label(root, 'HallReviewPerfect', '全部答对，已经掌握得很好了！', 155, 43, 470, 56, 24, new Color(139, 75, 45));
    } else {
      this.reviewMistakes.slice(0, 5).forEach((card, index) => {
        const x = 45 + (index % 2) * 222; const y = 73 - Math.floor(index / 2) * 72;
        const item = this.graphics(root, `HallReviewMistake-${index}`, x, y, 204, 60, 4);
        item.fillColor = new Color(246, 229, 192, 225); item.roundRect(-102, -30, 204, 60, 12); item.fill();
        item.strokeColor = this.qualityColor(card.quality); item.lineWidth = 2; item.roundRect(-100, -28, 200, 56, 10); item.stroke();
        this.oracleGlyph(root, `HallReviewMistakeGlyph-${index}`, card, x - 70, y, 34, 40, 6);
        this.label(root, `HallReviewMistakeModern-${index}`, `正确：${card.modern}`, x + 20, y + 8, 120, 22, 16, new Color(87, 49, 31), 'left', 6);
        this.label(root, `HallReviewMistakePinyin-${index}`, card.pinyin, x + 20, y - 13, 120, 19, 12, new Color(135, 83, 50), 'left', 6);
      });
    }
    this.button(root, 'HallReviewAgain', '再复习一次', -130, -175, 210, 58, true);
    this.button(root, 'HallReviewCodex', '查看甲骨图鉴', 130, -175, 210, 58, false);
  }

  private renderProgress() {
    const root = this.createRoot('HallProgress', 'progress');
    const cards = this.cards(); const collected = cards.filter(card => card.unlocked).length; const progress = this.progress();
    this.drawHeader(root, '学习进度', '你的甲骨文字收集与复习记录', true);
    this.panel(root, 'HallProgressPanel', 0, -10, 980, 440, new Color(76, 57, 62), false);
    const items: Array<[string, string, string, number, Color]> = [
      ['收集图鉴', `${collected} / ${cards.length}`, '已发现真实甲骨文字', -310, new Color(86, 133, 174)],
      ['复习答题', `${progress.correct} / ${progress.attempts}`, '累计答对 / 累计作答', 0, new Color(180, 105, 61)],
      ['探索资源', `${progress.ink}`, '当前持有墨料', 310, new Color(104, 145, 99)],
    ];
    items.forEach(([title, value, detail, x, color]) => {
      const card = this.graphics(root, `HallProgress-${title}`, x, 30, 260, 260, 4);
      card.fillColor = color; card.roundRect(-130, -130, 260, 260, 20); card.fill();
      this.label(root, `HallProgressTitle-${title}`, title, x, 84, 220, 35, 22, new Color(255, 244, 218));
      this.label(root, `HallProgressValue-${title}`, value, x, 15, 220, 72, 40, new Color(255, 245, 218));
      this.label(root, `HallProgressDetail-${title}`, detail, x, -65, 220, 45, 15, new Color(246, 238, 220));
    });
  }

  private renderPlaceholder(mode: 'parent' | 'settings') {
    const root = this.createRoot(mode === 'parent' ? 'HallParentManagement' : 'HallSettings', mode);
    const isParent = mode === 'parent';
    this.drawHeader(root, isParent ? '家长管理' : '设置', isParent ? '管理功能将随学习报告系统一同开放' : '个性化与声音设置将在后续版本开放', true);
    this.panel(root, 'HallPlaceholderPanel', 0, -8, 900, 430, new Color(76, 57, 62), false);
    const rows = isParent
      ? [['学习报告', '查看本周学习字数与复习情况'], ['时长设置', '设置每日学习目标与休息提醒'], ['夜间限制', '设定可学习时间范围']]
      : [['头像与昵称', '当前使用默认头像：甲骨小学生'], ['声音设置', '音乐与音效开关将在后续提供'], ['关于游戏', '殷墟甲骨文学习工具 · 开发中']];
    rows.forEach((row, index) => {
      const y = 105 - index * 110;
      this.button(root, `HallPlaceholder-${index}`, row[0], -270, y, 190, 64, false);
      this.label(root, `HallPlaceholderDetail-${index}`, row[1], 115, y, 500, 52, 19, new Color(255, 231, 176), 'left');
      this.label(root, `HallPlaceholderSoon-${index}`, '暂未启用', 360, y, 120, 30, 15, new Color(205, 204, 220));
    });
  }

  private onTouchStart(event: EventTouch) {
    const point = event.getUILocation(); const size = view.getVisibleSize();
    const x = point.x - size.width / 2; const y = point.y - size.height / 2;
    if (!this.isOpen) {
      if (this.hit(x, y, 295, 309, 120, 52)) this.open();
      return;
    }
    if (this.mode === 'home') {
      if (this.hit(x, y, -370, 55, 330, 178)) { this.callbacks?.enterYinXu(); this.close(); }
      else if (this.hit(x, y, 0, 55, 330, 178)) this.openReviewLibrary();
      else if (this.hit(x, y, 370, 55, 330, 178)) this.render('codex');
      else if (this.hit(x, y, -370, -156, 330, 178)) this.render('progress');
      else if (this.hit(x, y, 0, -156, 330, 178)) this.render('parent');
      else if (this.hit(x, y, 370, -156, 330, 178)) this.render('settings');
      return;
    }
    if (this.hit(x, y, 480, 286, 150, 48)) { this.render('home'); return; }
    if (this.mode === 'codex') {
      this.cards().forEach((card, index) => {
        const cardX = -430 + (index % 4) * 160; const cardY = 105 - Math.floor(index / 4) * 200;
        if (card.unlocked && this.hit(x, y, cardX, cardY, 138, 168)) this.render('codex', card.id);
      });
    } else if (this.mode === 'review') {
      if (this.reviewLibraryOpen) {
        if (this.cards().filter(card => card.unlocked).length === 0 && this.hit(x, y, 0, -110, 220, 58)) { this.callbacks?.enterYinXu(); this.close(); }
        else if (this.hit(x, y, 0, -226, 230, 58)) this.beginReview();
        return;
      }
      const positions: Array<[number, number]> = [[5, 72], [295, 72], [5, -52], [295, -52]];
      positions.forEach(([optionX, optionY], index) => {
        if (!this.hit(x, y, optionX, optionY, 250, 88)) return;
        const selected = this.reviewOptions[index]; const question = this.reviewQuestions[this.reviewIndex];
        if (!selected || !question) return;
        const correct = selected.id === question.id;
        this.callbacks?.recordReview(question.id, correct);
        if (correct) this.reviewCorrect++;
        else if (!this.reviewMistakes.some(card => card.id === question.id)) this.reviewMistakes.push(question);
        this.reviewIndex++;
        this.render('review');
      });
    } else if (this.mode === 'reviewResult') {
      if (this.hit(x, y, -130, -125, 210, 58)) this.beginReview();
      else if (this.hit(x, y, 130, -125, 210, 58)) this.render('codex');
    }
  }

  private hit(x: number, y: number, centerX: number, centerY: number, width: number, height: number) {
    return Math.abs(x - centerX) <= width / 2 && Math.abs(y - centerY) <= height / 2;
  }

  private shuffle<T>(items: T[]) {
    for (let index = items.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1)); [items[index], items[swap]] = [items[swap], items[index]];
    }
    return items;
  }

  private oracleGlyph(parent: Node, name: string, card: HallCard, x: number, y: number, maxWidth: number, maxHeight: number, z: number) {
    const fallback = this.label(parent, `${name}Fallback`, card.glyph, x, y, maxWidth, maxHeight, Math.max(20, Math.round(Math.min(maxWidth, maxHeight) * .52)), new Color(75, 43, 28), 'center', z);
    if (!card.asset || !card.imageBounds) return;
    const [left, top, right, bottom] = card.imageBounds;
    const scale = Math.min(maxWidth / Math.max(1, right - left + 1), maxHeight / Math.max(1, bottom - top + 1));
    const node = new Node(name); node.parent = parent; node.setPosition(x, y, z);
    node.addComponent(UITransform).setContentSize(Math.max(1, (right - left + 1) * scale), Math.max(1, (bottom - top + 1) * scale));
    const sprite = node.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.loadSprite(`oracle/${card.asset}/spriteFrame`, node, sprite, false, () => { if (fallback.node.isValid) fallback.node.active = false; });
  }

  private loadSprite(key: string, node: Node, sprite: Sprite, linear: boolean, complete?: () => void) {
    resources.load(key, SpriteFrame, (error, frame) => {
      if (error || !frame || !node.isValid || !sprite.isValid) return;
      frame.texture.setFilters(linear ? Texture2D.Filter.LINEAR : Texture2D.Filter.NEAREST, linear ? Texture2D.Filter.LINEAR : Texture2D.Filter.NEAREST);
      sprite.spriteFrame = frame; sprite.sizeMode = Sprite.SizeMode.CUSTOM; complete?.();
    });
  }

  private graphics(parent: Node, name: string, x: number, y: number, width: number, height: number, z = 0) {
    const node = new Node(name); node.parent = parent; node.setPosition(x, y, z); node.addComponent(UITransform).setContentSize(width, height); return node.addComponent(Graphics);
  }

  private label(parent: Node, name: string, text: string, x: number, y: number, width: number, height: number, fontSize: number, color: Color, align: 'left' | 'center' = 'center', z = 2) {
    const node = new Node(name); node.parent = parent; node.setPosition(x, y, z); node.addComponent(UITransform).setContentSize(width, height);
    const label = node.addComponent(Label); label.string = text; label.fontSize = fontSize; label.lineHeight = fontSize + 7; label.color = color;
    label.enableWrapText = true; label.overflow = Label.Overflow.SHRINK;
    label.horizontalAlign = align === 'left' ? Label.HorizontalAlign.LEFT : Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER;
    return label;
  }

  private panel(parent: Node, name: string, x: number, y: number, width: number, height: number, color: Color, parchment: boolean) {
    const panel = this.graphics(parent, name, x, y, width, height, 2); panel.fillColor = color; panel.roundRect(-width / 2, -height / 2, width, height, 16); panel.fill();
    panel.strokeColor = parchment ? new Color(91, 51, 31) : new Color(221, 167, 80); panel.lineWidth = 5; panel.roundRect(-width / 2 + 3, -height / 2 + 3, width - 6, height - 6, 12); panel.stroke();
  }

  private button(parent: Node, name: string, text: string, x: number, y: number, width: number, height: number, accent: boolean) {
    const button = this.graphics(parent, name, x, y, width, height, 4); button.fillColor = accent ? new Color(157, 64, 47, 245) : new Color(83, 62, 46, 245); button.roundRect(-width / 2, -height / 2, width, height, 10); button.fill();
    button.strokeColor = new Color(231, 187, 97); button.lineWidth = 3; button.roundRect(-width / 2, -height / 2, width, height, 10); button.stroke();
    this.label(parent, `${name}Label`, text, x, y, width - 12, height - 8, 19, new Color(255, 238, 197), 'center', 6);
  }

  private qualityColor(quality: HallCard['quality']) {
    return quality === 'red' ? new Color(202, 74, 61) : quality === 'gold' ? new Color(236, 184, 73) : new Color(75, 161, 205);
  }
}
