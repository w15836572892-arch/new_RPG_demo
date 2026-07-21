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
  EditBox,
  Texture2D,
  UITransform,
  view,
} from 'cc';

const { ccclass } = _decorator;

const RANKS = [
  { name: '见习卜童', threshold: 0, icon: '🪶', c1: '#b8a368', c2: '#8a7038', bd: '#ffe4a5' },
  { name: '御用卜史', threshold: 1000, icon: '📜', c1: '#c49e58', c2: '#9a6e30', bd: '#ffe4a5' },
  { name: '太卜掌礼', threshold: 3000, icon: '🔱', c1: '#b080d0', c2: '#6a3a9a', bd: '#e8c8ff' },
  { name: '高阶殷卜士', threshold: 6000, icon: '🌟', c1: '#e07050', c2: '#a03020', bd: '#ffd0a0' },
  { name: '首席大卜正', threshold: 12000, icon: '👑', c1: '#d04040', c2: '#701010', bd: '#ffb0b0' },
] as const;

const AVATARS = [
  { id: 'oracle-apprentice', name: '小卜官', emoji: '🧑', path: 'characters/oracle-apprentice/down-0/spriteFrame' },
  { id: 'villager-farmer-v2', name: '乡民', emoji: '🧒', path: 'characters/villager-farmer-v2/down-0/spriteFrame' },
  { id: 'villager-woman-v2', name: '织女', emoji: '👦', path: 'characters/villager-woman-v2/down-0/spriteFrame' },
  { id: 'resting-douli-v3', name: '行者', emoji: '👧', path: 'characters/resting-douli-v3/idle-0/spriteFrame' },
] as const;

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

type HallMode = 'home' | 'codex' | 'review' | 'reviewResult' | 'progress' | 'parent' | 'settings' | 'ranks';
type HallCallbacks = {
  getCards: () => HallCard[];
  getProgress: () => { ink: number; coins: number; experience: number; attempts: number; correct: number };
  recordReview: (cardId: string, correct: boolean) => void;
  enterYinXu: () => void;
  getProfile: () => { playerName: string; avatarId: string; musicOn: boolean; sfxOn: boolean; nightMode: boolean };
  setName: (name: string) => void;
  setAvatar: (avatarId: string) => void;
  toggleMusic: () => void;
  toggleSfx: () => void;
  toggleNight: () => void;
  getWeakCards: () => string[];
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

  /** Home uses the player's chosen day/night background image; sub-pages keep the
   *  original deep-night sky so only the lobby skin changes (the YinXu world is untouched). */
  private drawBackground(root: Node) {
    const visible = view.getVisibleSize();
    const width = visible.width / this.viewportScale;
    const height = visible.height / this.viewportScale;
    if (this.mode === 'home' || this.mode === 'ranks' || this.mode === 'settings') {
      const night = this.callbacks?.getProfile().nightMode ?? false;
      const fallback = this.graphics(root, 'HallBgFallback', 0, 0, width, height, -1);
      fallback.fillColor = night ? new Color(12, 18, 40, 255) : new Color(205, 224, 230, 255);
      fallback.rect(-width / 2, -height / 2, width, height); fallback.fill();
      const bgNode = new Node('HallBackground');
      bgNode.parent = root; bgNode.setPosition(0, 0, 0);
      bgNode.addComponent(UITransform).setContentSize(width, height);
      const bgSprite = bgNode.addComponent(Sprite);
      bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;
      const key = night ? 'art/hall_bg/dark_bg/spriteFrame' : 'art/hall_bg/hall_bg/spriteFrame';
      this.loadSprite(key, bgNode, bgSprite, true);
      this.label(root, 'HallPattern', '甲  骨  文  ·  殷  商  探  索', 0, -height / 2 + 32, 920, 28, 14, night ? new Color(244, 205, 132, 120) : new Color(90, 70, 50, 120));
      return;
    }
    // Sub-pages: keep the original deep-night sky untouched.
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
    else if (mode === 'ranks') this.renderRanks();
    else this.renderPlaceholder(mode);
  }

  private renderHome() {
    const root = this.createRoot('LearningHall', 'home');
    const cards = this.cards(); const total = cards.length; const collected = cards.filter(card => card.unlocked).length;
    const t = this.theme();
    this.drawTopBar(root, t);
    this.drawCharacterCard(root, -442, -6, t);
    this.drawEnterYinXu(root, -16, -6, t);
    this.drawReviewSuggestion(root, 424, 55, t);
    this.drawCodexEntry(root, total, collected, 424, -77, t);
    this.drawBottomNav(root, 'home', t);
  }

  /** Day/night-aware palette, mirrored from hall_full.html CSS.
   *  Home cards are DARK translucent (rgba(28,24,18,.62)) on the bright backdrop,
   *  with pale-gold text inside; the backdrop text itself is deep brown.
   *  Night mode flips cards to dark indigo and text to pale gold. */
  private theme() {
    const night = this.callbacks?.getProfile().nightMode ?? false;
    return {
      night,
      ink: night ? new Color(255, 233, 200) : new Color(58, 36, 16),     // #3a2410 backdrop text
      sub: night ? new Color(230, 216, 188) : new Color(74, 48, 24),     // #4a3018
      card: night ? new Color(40, 34, 58, 205) : new Color(28, 24, 18, 158), // rgba(28,24,18,.62)
      cardStroke: night ? new Color(231, 187, 97, 200) : new Color(255, 215, 150, 72), // rgba(255,215,150,.28)
      goldInk: night ? new Color(255, 230, 189) : new Color(255, 230, 189), // #ffe6bd in-card text
      goldSub: night ? new Color(230, 216, 188) : new Color(230, 216, 188), // #e6d8bc
    };
  }

  private hexToColor(hex: string, alpha = 255): Color {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return new Color(r, g, b, alpha);
  }

  /** Layout helpers: percentages of the 1280x720 design resolution, mirroring
   *  the vw/vh clamps used in hall_full.html. */
  private vw(ratio: number) { return 1280 * ratio; }
  private vh(ratio: number) { return 720 * ratio; }

  private currentRank(): number {
    const exp = this.progress().experience;
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) if (exp >= RANKS[i].threshold) idx = i;
    if (idx === RANKS.length - 1) {
      const cards = this.cards(); const total = cards.length; const collected = cards.filter(c => c.unlocked).length;
      if (collected < total) idx = RANKS.length - 2;
    }
    return idx;
  }

  private drawTopBar(root: Node, t: ReturnType<LearningHall['theme']>) {
    const profile = this.callbacks!.getProfile();
    const progress = this.progress();
    const rankIdx = this.currentRank();
    const collected = this.cards().filter(c => c.unlocked).length;
    const topY = this.vh(0.445);
    // 头像：conic 金渐变圆 + 内圈 emoji 圆 + 外发光（对齐 .avatar / .avatar i）
    const avR = this.vh(0.058);
    const avX = -this.vw(0.426);
    const glow = this.graphics(root, 'HallTopAvatarGlow', avX, topY, (avR + 8) * 2, (avR + 8) * 2, 4);
    glow.fillColor = new Color(255, 210, 140, 77); glow.circle(0, 0, avR + 6); glow.fill();
    const avBg = this.graphics(root, 'HallTopAvatarBg', avX, topY, avR * 2, avR * 2, 5);
    avBg.fillColor = new Color(212, 167, 106, 255); avBg.circle(0, 0, avR); avBg.fill();
    const avInner = this.graphics(root, 'HallTopAvatarInner', avX, topY, avR * 1.62, avR * 1.62, 5);
    avInner.fillColor = new Color(110, 94, 78, 255); avInner.circle(0, 0, avR * 0.81); avInner.fill();
    avInner.strokeColor = new Color(200, 184, 152, 255); avInner.lineWidth = 2; avInner.circle(0, 0, avR * 0.81 - 1); avInner.stroke();
    const av = AVATARS.find(a => a.id === profile.avatarId) ?? AVATARS[0];
    this.label(root, 'HallTopAvatarEmoji', av.emoji, avX, topY, avR * 1.4, avR * 1.4, avR * 0.95, new Color(255, 233, 200), 'center', 6);
    this.label(root, 'HallPlayerName', profile.playerName || '少年卜官', -this.vw(0.376), this.vh(0.465), 220, 28, 18, t.ink, 'left', 6);
    this.drawRankBadge(root, rankIdx, -this.vw(0.352), this.vh(0.414), t);
    this.label(root, 'HallCollectedHint', `已识 ${collected} 字`, -this.vw(0.268), this.vh(0.414), 120, 22, 13, t.sub, 'left', 6);
    // 右侧货币（纯文字，对齐 .rightbar .cur）+ 家长按钮
    this.drawCurrencies(root, progress, this.vw(0.150), topY, t);
    this.drawParentBtn(root, this.vw(0.422), topY, t);
  }

  private drawRankBadge(root: Node, rankIdx: number, x: number, y: number, t: ReturnType<LearningHall['theme']>) {
    // 固定金棕渐变（对齐 .rankbadge，不随段位变色）
    const rank = RANKS[rankIdx];
    const w = 128, h = 28;
    const node = this.graphics(root, 'HallRankBadge', x, y, w, h, 6);
    node.fillColor = new Color(168, 124, 64, 255); node.roundRect(-w / 2, -h / 2, w, h, 14); node.fill();
    node.fillColor = new Color(122, 84, 42, 230); node.roundRect(-w / 2, 2, w, h / 2 - 2, 0); node.fill();
    node.strokeColor = new Color(255, 228, 165, 230); node.lineWidth = 1; node.roundRect(-w / 2, -h / 2, w, h, 14); node.stroke();
    this.label(root, 'HallRankIcon', rank.icon, x - w / 2 + 18, y, 26, 26, 15, new Color(255, 248, 236), 'center', 7);
    this.label(root, 'HallRankName', rank.name, x + 4, y, w - 30, 22, 13, new Color(255, 248, 236), 'left', 7);
  }

  private drawCurrencies(root: Node, progress: { ink: number; coins: number; experience: number }, startX: number, y: number, t: ReturnType<LearningHall['theme']>) {
    // 对齐 .rightbar .cur：纯文字 名(ck #4a3018) + 值(cv #3a2410)，无胶囊
    const items: Array<[string, number]> = [
      ['墨料', progress.ink],
      ['贝币', progress.coins],
      ['经验', progress.experience],
    ];
    items.forEach(([name, val], i) => {
      const x = startX + i * 116;
      this.label(root, `HallCurName-${i}`, name, x, y + 9, 44, 20, 13, t.sub, 'left', 6);
      this.label(root, `HallCurVal-${i}`, `${val}`, x, y - 9, 60, 22, 16, t.ink, 'left', 6);
    });
  }

  private drawParentBtn(root: Node, x: number, y: number, t: ReturnType<LearningHall['theme']>) {
    // 对齐 .par：rgba(40,30,20,.5) 暗底 + #ffe9c8 字
    const w = 74, h = 30;
    const node = this.graphics(root, 'HallParentBtn', x, y, w, h, 6);
    node.fillColor = new Color(40, 30, 20, 128); node.roundRect(-w / 2, -h / 2, w, h, 4); node.fill();
    node.strokeColor = new Color(255, 210, 140, 128); node.lineWidth = 1; node.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 4); node.stroke();
    this.label(root, 'HallParentBtnLabel', '🧑 家长', x, y, w - 4, 22, 13, new Color(255, 233, 200), 'center', 6);
  }

  private drawCharacterCard(root: Node, x: number, y: number, t: ReturnType<LearningHall['theme']>) {
    const profile = this.callbacks!.getProfile();
    const rankIdx = this.currentRank();
    const w = this.vh(0.22), h = this.vh(0.30);
    const node = this.graphics(root, 'HallCharacterCard', x, y, w, h, 3);
    node.fillColor = t.card; node.roundRect(-w / 2, -h / 2, w, h, 14); node.fill();
    node.strokeColor = t.cardStroke; node.lineWidth = 1; node.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 13); node.stroke();
    const av = AVATARS.find(a => a.id === profile.avatarId) ?? AVATARS[0];
    const avR = this.vh(0.055);
    const avY = y + this.vh(0.100);
    const avBg = this.graphics(root, 'HallCharAvatarBg', x, avY, avR * 2, avR * 2, 5);
    avBg.fillColor = new Color(255, 245, 220, 230); avBg.circle(0, 0, avR); avBg.fill();
    avBg.strokeColor = new Color(180, 130, 70, 200); avBg.lineWidth = 2; avBg.circle(0, 0, avR - 2); avBg.stroke();
    this.label(root, 'HallCharEmoji', av.emoji, x, avY, avR * 2 - 6, avR * 2 - 6, avR * 1.2, new Color(120, 80, 40), 'center', 6);
    this.label(root, 'HallCharName', profile.playerName || '少年卜官', x, y + this.vh(0.028), 170, 24, 17, t.goldInk, 'center', 6);
    this.label(root, 'HallCharRole', '殷墟小卜官', x, y + this.vh(0.002), 150, 18, 11, t.goldSub, 'center', 6);
    const nextRank = RANKS[Math.min(rankIdx + 1, RANKS.length - 1)];
    const need = Math.max(0, nextRank.threshold - this.progress().experience);
    const rankTip = rankIdx >= RANKS.length - 1 ? '已达最高段位' : `距${nextRank.name}还需 ${need} 经验`;
    this.label(root, 'HallCharRankTip', rankTip, x, y - this.vh(0.034), 170, 20, 11, t.goldSub, 'center', 6);
    // 段位经验条（对齐 .rbar：底 rgba(70,55,40,.5) 填充 #d9a85a）
    const prevThreshold = RANKS[rankIdx].threshold;
    const pct = rankIdx >= RANKS.length - 1 ? 1 : Math.min(1, Math.max(0, (this.progress().experience - prevThreshold) / (nextRank.threshold - prevThreshold)));
    const barW = this.vh(0.18), barH = 6;
    const barY = y - this.vh(0.054);
    const barBg = this.graphics(root, 'HallCharRankBarBg', x, barY, barW, barH, 5);
    barBg.fillColor = new Color(70, 55, 40, 128); barBg.roundRect(-barW / 2, -barH / 2, barW, barH, 3); barBg.fill();
    if (pct > 0) {
      const barFill = this.graphics(root, 'HallCharRankBarFill', x - barW / 2 + (barW * pct) / 2, barY, barW * pct, barH, 6);
      barFill.fillColor = new Color(217, 168, 90, 255); barFill.roundRect(-(barW * pct) / 2, -barH / 2, barW * pct, barH, 3); barFill.fill();
    }
    this.label(root, 'HallCharHint', '点击查看五阶段位', x, y - this.vh(0.090), 160, 18, 11, t.goldSub, 'center', 6);
  }

  private drawEnterYinXu(root: Node, x: number, y: number, t: ReturnType<LearningHall['theme']>) {
    const r = this.vh(0.10);
    this.label(root, 'HallEnterSupertitle', '殷商寻字', x, y + r + this.vh(0.028), 280, 30, 20, t.ink, 'center', 6);
    // 外黑环 + 橙红发光（对齐 box-shadow: 0 0 0 5px rgba(0,0,0,.25), 0 6px 30px rgba(220,80,40,.5)）
    const ring = this.graphics(root, 'HallEnterRing', x, y, (r + 5) * 2, (r + 5) * 2, 3);
    ring.fillColor = new Color(0, 0, 0, 64); ring.circle(0, 0, r + 5); ring.fill();
    const glow = this.graphics(root, 'HallEnterGlow', x, y, (r + 12) * 2, (r + 12) * 2, 3);
    glow.fillColor = new Color(220, 80, 40, 128); glow.circle(0, 0, r + 12); glow.fill();
    // 三层径向渐变 radial(circle at 35% 30%,#e85a44,#c83e2c,#8a2618)
    const node = this.graphics(root, 'HallEnterYinXu', x, y, r * 2, r * 2, 4);
    node.fillColor = new Color(232, 90, 68, 255); node.circle(0, 0, r); node.fill();
    node.fillColor = new Color(200, 62, 44, 255); node.circle(0, 0, r * 0.72); node.fill();
    node.fillColor = new Color(138, 38, 24, 255); node.circle(0, 0, r * 0.42); node.fill();
    node.strokeColor = new Color(255, 242, 216, 255); node.lineWidth = 3; node.circle(0, 0, r - 3); node.stroke();
    this.label(root, 'HallEnterEmoji', '🏛', x, y + this.vh(0.016), 64, 50, 30, new Color(255, 242, 216), 'center', 6);
    this.label(root, 'HallEnterTitle', '进入殷墟', x, y - this.vh(0.028), 150, 24, 14, new Color(255, 240, 220), 'center', 6);
    this.label(root, 'HallEnterSub', '探索草野河畔，发掘甲骨遗存', x, y - r - this.vh(0.018), 420, 22, 12, t.sub, 'center', 6);
  }

  private drawReviewSuggestion(root: Node, x: number, y: number, t: ReturnType<LearningHall['theme']>) {
    const weakIds = this.callbacks?.getWeakCards() ?? [];
    const weak = weakIds.map(id => this.cards().find(c => c.id === id)).filter((c): c is HallCard => !!c).slice(0, 3);
    const w = 340, h = 132;
    const node = this.graphics(root, 'HallReviewSug', x, y, w, h, 3);
    node.fillColor = t.card; node.roundRect(-w / 2, -h / 2, w, h, 10); node.fill();
    node.strokeColor = t.cardStroke; node.lineWidth = 1; node.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 9); node.stroke();
    // 顶部：badge "复习" + 标题（对齐 .card .badge / .ct）
    const topY = y + h / 2 - 16;
    const badge = this.graphics(root, 'HallSugBadge', x - w / 2 + 40, topY, 44, 16, 6);
    badge.fillColor = new Color(168, 124, 64, 255); badge.roundRect(-22, -8, 44, 16, 3); badge.fill();
    this.label(root, 'HallSugBadgeTxt', '复习', x - w / 2 + 40, topY, 40, 14, 9, new Color(255, 233, 200), 'center', 7);
    this.label(root, 'HallSugTitle', '建议复习', x - w / 2 + 64, topY, 120, 20, 14, new Color(255, 240, 214), 'left', 6);
    // chips（对齐 .chips：rgba(70,55,40,.6)）
    if (weak.length === 0) {
      this.label(root, 'HallSugEmpty', '暂无需复习', x, y - 8, w - 40, 22, 12, new Color(216, 200, 168), 'center', 6);
    } else {
      weak.forEach((card, i) => {
        const cx = x - 104 + i * 104;
        const chip = this.graphics(root, `HallSugChip-${i}`, cx, y - 8, 88, 34, 6);
        chip.fillColor = new Color(70, 55, 40, 153); chip.roundRect(-44, -17, 88, 34, 5); chip.fill();
        chip.strokeColor = new Color(255, 215, 150, 46); chip.lineWidth = 1; chip.roundRect(-43, -16, 86, 32, 4); chip.stroke();
        this.oracleGlyph(root, `HallSugGlyph-${i}`, card, cx, y - 8, 30, 28, 6);
      });
    }
    this.label(root, 'HallSugNote', `易错 ${weak.length} 字`, x - w / 2 + 20, y - h / 2 + 18, 90, 18, 12, new Color(216, 200, 168), 'left', 6);
    this.button(root, 'HallSugGo', '去复习 ›', x + w / 2 - 54, y - h / 2 + 18, 80, 28, true);
  }

  private drawCodexEntry(root: Node, total: number, collected: number, x: number, y: number, t: ReturnType<LearningHall['theme']>) {
    const w = 340, h = 112;
    const node = this.graphics(root, 'HallCodexEntry', x, y, w, h, 3);
    node.fillColor = t.card; node.roundRect(-w / 2, -h / 2, w, h, 10); node.fill();
    node.strokeColor = t.cardStroke; node.lineWidth = 1; node.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 9); node.stroke();
    // 顶部：badge "图鉴" + 标题 + 计数（对齐 .card .badge / .ct）
    const topY = y + h / 2 - 16;
    const badge = this.graphics(root, 'HallCodexBadge', x - w / 2 + 40, topY, 44, 16, 6);
    badge.fillColor = new Color(168, 124, 64, 255); badge.roundRect(-22, -8, 44, 16, 3); badge.fill();
    this.label(root, 'HallCodexBadgeTxt', '图鉴', x - w / 2 + 40, topY, 40, 14, 9, new Color(255, 233, 200), 'center', 7);
    this.label(root, 'HallCodexEntryTitle', '图鉴进度', x - w / 2 + 64, topY, 120, 20, 14, new Color(255, 240, 214), 'left', 6);
    this.label(root, 'HallCodexEntryCount', `${collected} / ${total}`, x + w / 2 - 18, topY, 90, 22, 16, new Color(255, 240, 214), 'right', 6);
    // 进度条（对齐 .bar：底 rgba(70,55,40,.5) 填充 #d9a85a）
    const barW = 300, barH = 6; const pct = total > 0 ? collected / total : 0;
    const barY = y + 2;
    const barBg = this.graphics(root, 'HallCodexBarBg', x, barY, barW, barH, 5);
    barBg.fillColor = new Color(70, 55, 40, 128); barBg.roundRect(-barW / 2, -barH / 2, barW, barH, 3); barBg.fill();
    if (pct > 0) {
      const barFill = this.graphics(root, 'HallCodexBarFill', x - barW / 2 + (barW * pct) / 2, barY, barW * pct, barH, 6);
      barFill.fillColor = new Color(217, 168, 90, 255); barFill.roundRect(-(barW * pct) / 2, -barH / 2, barW * pct, barH, 3); barFill.fill();
    }
    this.label(root, 'HallCodexEntryPct', `${Math.round(pct * 100)}%`, x + w / 2 - 18, barY - 20, 50, 18, 12, new Color(216, 200, 168), 'right', 6);
    this.label(root, 'HallCodexEntrySub', '已收集真实字形', x - w / 2 + 18, y - h / 2 + 18, 150, 18, 12, new Color(216, 200, 168), 'left', 6);
  }

  private drawBottomNav(root: Node, mode: HallMode, t: ReturnType<LearningHall['theme']>) {
    const items: Array<[HallMode, string, string, boolean]> = [
      ['home', '🏠', '大厅', mode === 'home'],
      ['review', '📖', '复习', mode === 'review' || mode === 'reviewResult'],
      ['codex', '🏺', '图鉴', mode === 'codex'],
      ['parent', '⭐', '任务', mode === 'parent'],
      ['progress', '📈', '进度', mode === 'progress'],
      ['settings', '⚙', '设置', mode === 'settings'],
    ];
    const y = -this.vh(0.456); const gap = this.vh(0.118); const startX = -this.vh(0.295);
    items.forEach(([m, icon, label, active], i) => {
      const x = startX + i * gap;
      const r = this.vh(0.044);
      const padY = y + this.vh(0.006);
      // 浅米 radial 圆垫（对齐 .icon-pad）
      const pad = this.graphics(root, `HallNavPad-${i}`, x, padY, r * 2, r * 2, 5);
      pad.fillColor = active ? new Color(255, 233, 176, 255) : new Color(255, 247, 230, 255);
      pad.circle(0, 0, r); pad.fill();
      pad.strokeColor = active ? new Color(160, 106, 46, 255) : new Color(110, 76, 40, 255);
      pad.lineWidth = 2; pad.circle(0, 0, r - 2); pad.stroke();
      this.label(root, `HallNavIcon-${i}`, icon, x, padY, r * 2 - 4, r * 2 - 4, 22, new Color(80, 60, 40), 'center', 6);
      if (active) {
        const dot = this.graphics(root, `HallNavDot-${i}`, x, y + this.vh(0.038), 18, 4, 6);
        dot.fillColor = new Color(255, 217, 138, 255); dot.roundRect(-9, -2, 18, 4, 2); dot.fill();
      }
      this.label(root, `HallNavLabel-${i}`, label, x, y - this.vh(0.030), 64, 18, 13, active ? new Color(122, 74, 20) : new Color(58, 36, 16), 'center', 6);
    });
  }

  private renderRanks() {
    const root = this.createRoot('HallRanks', 'ranks');
    const rankIdx = this.currentRank();
    const t = this.theme();
    const mask = this.graphics(root, 'HallRanksMask', 0, 0, 1180, 680, 1);
    mask.fillColor = new Color(12, 8, 3, 128); mask.rect(-590, -340, 1180, 680); mask.fill();
    const pw = 560, ph = 600;
    const panel = this.graphics(root, 'HallRanksPanel', 0, 0, pw, ph, 3);
    panel.fillColor = t.night ? new Color(24, 18, 12, 183) : new Color(255, 248, 228, 183);
    panel.roundRect(-pw / 2, -ph / 2, pw, ph, 24); panel.fill();
    panel.strokeColor = t.night ? new Color(255, 210, 140, 102) : new Color(255, 210, 140, 128);
    panel.lineWidth = 3; panel.roundRect(-pw / 2 + 1, -ph / 2 + 1, pw - 2, ph - 2, 23); panel.stroke();
    this.label(root, 'HallRanksTitle', '五阶卜官', 0, ph / 2 - 44, 400, 40, t.night ? new Color(255, 233, 176) : new Color(90, 58, 26), 'center', 6);
    const titleLine = this.graphics(root, 'HallRanksTitleLine', 0, ph / 2 - 70, 80, 3, 6);
    titleLine.fillColor = new Color(154, 106, 48, 255); titleLine.roundRect(-40, -1.5, 80, 3, 1.5); titleLine.fill();
    RANKS.forEach((rank, i) => {
      const y = ph / 2 - 116 - i * 96;
      const w = 480, h = 84;
      const isCur = i === rankIdx;
      const isDone = i < rankIdx;
      const node = this.graphics(root, `HallRankRow-${i}`, 0, y, w, h, 5);
      const rowFill = t.night ? new Color(255, 255, 255, 20) : new Color(255, 255, 255, 89);
      node.fillColor = isCur ? (t.night ? new Color(255, 255, 255, 36) : new Color(255, 255, 255, 140)) : rowFill;
      node.roundRect(-w / 2, -h / 2, w, h, 12); node.fill();
      node.strokeColor = isCur ? new Color(200, 62, 44, 255) : (t.night ? new Color(255, 210, 140, 46) : new Color(110, 76, 40, 30));
      node.lineWidth = isCur ? 2 : 1; node.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 11); node.stroke();
      // 图标圆形渐变背景（对齐 HTML .ric）
      const iconR = 24;
      const iconX = -w / 2 + 52;
      const iconBg = this.graphics(root, `HallRankRowIconBg-${i}`, iconX, y, iconR * 2, iconR * 2, 6);
      const c1 = this.hexToColor(rank.c1), c2 = this.hexToColor(rank.c2);
      iconBg.fillColor = c1; iconBg.circle(0, 0, iconR); iconBg.fill();
      iconBg.strokeColor = this.hexToColor(rank.bd); iconBg.lineWidth = 2; iconBg.circle(0, 0, iconR - 1); iconBg.stroke();
      this.label(root, `HallRankRowIcon-${i}`, rank.icon, iconX, y, iconR * 1.6, iconR * 1.6, iconR * 1.1, new Color(255, 248, 236), 'center', 7);
      // 文字在图标右侧垂直居中
      const nameColor = isDone ? new Color(90, 138, 58) : (t.night ? new Color(255, 240, 214) : new Color(58, 36, 16));
      this.label(root, `HallRankRowName-${i}`, rank.name, -w / 2 + 98, y + 10, 300, 30, 18, nameColor, 'left', 6);
      const reqColor = isDone ? new Color(90, 138, 58) : (t.night ? new Color(216, 200, 168) : new Color(106, 74, 42));
      this.label(root, `HallRankRowReq-${i}`, isDone ? '已达成' : `需 ${rank.threshold} 经验`, -w / 2 + 98, y - 16, 300, 22, 13, reqColor, 'left', 6);
    });
    this.button(root, 'HallRanksBack', '返回大厅', 0, -ph / 2 + 44, 220, 50, true);
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
    const t = this.theme();
    this.reviewLibraryOpen = true;
    this.drawHeader(root, '复习所学', `已收集 ${unlocked.length} 个甲骨文字 · 浏览字卡后完成随机 5 题`, true);
    this.panel(root, 'HallReviewLibraryPanel', 0, 3, 1040, 430, t.card, false);
    if (unlocked.length === 0) {
      this.label(root, 'HallReviewEmptyTitle', '还没有可复习的真实甲骨字', 0, 62, 600, 48, 29, t.goldInk);
      this.label(root, 'HallReviewEmptyText', '在殷墟的考古坑完成辨识后，已收集的甲骨文字会自动出现在这里。', 0, -4, 590, 70, 19, t.goldSub);
      this.button(root, 'HallReviewGoCity', '进入殷墟探索', 0, -110, 220, 58, true);
      return;
    }
    unlocked.slice(0, 6).forEach((card, index) => {
      const x = -350 + (index % 3) * 350; const y = 76 - Math.floor(index / 3) * 155;
      const item = this.graphics(root, `HallReviewCard-${index}`, x, y, 300, 128, 4);
      item.fillColor = t.card; item.roundRect(-150, -64, 300, 128, 14); item.fill();
      item.strokeColor = t.cardStroke; item.lineWidth = 2; item.roundRect(-148, -62, 296, 124, 12); item.stroke();
      // 去掉甲骨文字 glyph，只保留现代汉字与释义，色调统一为大厅主题
      this.label(root, `HallReviewCardModern-${index}`, card.modern, x, y + 22, 260, 34, 28, t.goldInk, 'center', 6);
      this.label(root, `HallReviewCardMeaning-${index}`, card.meaning, x, y - 26, 260, 56, 14, t.goldSub, 'center', 6);
    });
    this.button(root, 'HallReviewStart', '开始随机 5 题', 0, -226, 230, 58, true);
  }

  private renderReview() {
    const question = this.reviewQuestions[this.reviewIndex];
    if (!question) { this.render('reviewResult'); return; }
    const root = this.createRoot('HallReview', 'review');
    const t = this.theme();
    this.drawHeader(root, '复习所学', `第 ${this.reviewIndex + 1} / 5 题 · 选择这个甲骨文对应的现代汉字`, true);
    this.panel(root, 'HallReviewGlyphPanel', -340, -20, 350, 430, t.card, false);
    this.label(root, 'HallReviewHint', '这个甲骨文字的意思是？', -340, 160, 280, 36, 20, t.goldInk);
    this.oracleGlyph(root, 'HallReviewGlyph', question, -340, 45, 155, 190, 5);
    this.label(root, 'HallReviewCaption', '观察字形，再选择现代汉字', -340, -155, 270, 42, 16, t.goldSub);
    const other = this.shuffle(this.cards().filter(card => card.id !== question.id));
    this.reviewOptions = this.shuffle([question, ...other.slice(0, 3)]);
    this.label(root, 'HallReviewOptionsTitle', '选择正确答案', 150, 160, 560, 38, 25, t.goldInk);
    const positions: Array<[number, number]> = [[5, 72], [295, 72], [5, -52], [295, -52]];
    this.reviewOptions.forEach((card, index) => this.button(root, `HallReviewOption-${index}`, `${String.fromCharCode(65 + index)}.  ${card.modern}`, positions[index][0], positions[index][1], 250, 88, false));
    this.label(root, 'HallReviewTip', '答题结果会计入学习进度；本期不消耗任何资源。', 150, -185, 560, 30, 15, t.goldSub);
  }

  private renderReviewResult() {
    const root = this.createRoot('HallReviewResult', 'reviewResult');
    const t = this.theme();
    this.drawHeader(root, '复习完成', '随机 5 题已完成', true);
    this.panel(root, 'HallReviewResultPanel', 0, -5, 1000, 440, t.card, false);
    const scorePanel = this.graphics(root, 'HallReviewScorePanel', -290, 40, 330, 250, 4);
    scorePanel.fillColor = t.card; scorePanel.roundRect(-165, -125, 330, 250, 18); scorePanel.fill();
    scorePanel.strokeColor = t.cardStroke; scorePanel.lineWidth = 2; scorePanel.roundRect(-163, -123, 326, 246, 16); scorePanel.stroke();
    this.label(root, 'HallReviewScoreTitle', '本轮复习成绩', -290, 121, 250, 30, 18, t.goldInk);
    this.label(root, 'HallReviewScore', `${this.reviewCorrect} / 5`, -290, 50, 270, 92, 62, t.goldInk);
    this.label(root, 'HallReviewResultText', this.reviewCorrect === 5 ? '太棒了，全部答对！' : '记住易错字，下次会更棒。', -290, -35, 260, 46, 19, t.goldSub);
    this.label(root, 'HallReviewMistakeTitle', this.reviewMistakes.length ? '本轮易错甲骨 · 下次优先复习' : '本轮没有易错字', 155, 130, 490, 34, 22, t.goldInk);
    if (this.reviewMistakes.length === 0) {
      this.label(root, 'HallReviewPerfect', '全部答对，已经掌握得很好了！', 155, 43, 470, 56, 24, t.goldSub);
    } else {
      this.reviewMistakes.slice(0, 5).forEach((card, index) => {
        const x = 45 + (index % 2) * 222; const y = 73 - Math.floor(index / 2) * 72;
        const item = this.graphics(root, `HallReviewMistake-${index}`, x, y, 204, 60, 4);
        item.fillColor = t.card; item.roundRect(-102, -30, 204, 60, 12); item.fill();
        item.strokeColor = t.cardStroke; item.lineWidth = 2; item.roundRect(-100, -28, 200, 56, 10); item.stroke();
        this.oracleGlyph(root, `HallReviewMistakeGlyph-${index}`, card, x - 70, y, 34, 40, 6);
        this.label(root, `HallReviewMistakeModern-${index}`, `正确：${card.modern}`, x + 20, y + 8, 120, 22, 16, t.goldInk, 'left', 6);
        this.label(root, `HallReviewMistakePinyin-${index}`, card.pinyin, x + 20, y - 13, 120, 19, 12, t.goldSub, 'left', 6);
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
    if (mode === 'settings') { this.drawSettingsPanel(); return; }
    const root = this.createRoot('HallParentManagement', mode);
    this.drawHeader(root, '家长管理', '管理功能将随学习报告系统一同开放', true);
    this.panel(root, 'HallPlaceholderPanel', 0, -8, 900, 430, new Color(76, 57, 62), false);
    const rows = [
      ['学习报告', '查看本周学习字数与复习情况'],
      ['时长设置', '设置每日学习目标与休息提醒'],
      ['夜间限制', '设定可学习时间范围'],
    ];
    rows.forEach((row, index) => {
      const y = 105 - index * 110;
      this.button(root, `HallPlaceholder-${index}`, row[0], -270, y, 190, 64, false);
      this.label(root, `HallPlaceholderDetail-${index}`, row[1], 115, y, 500, 52, 19, new Color(255, 231, 176), 'left');
      this.label(root, `HallPlaceholderSoon-${index}`, '暂未启用', 360, y, 120, 30, 15, new Color(205, 204, 220));
    });
  }

  private drawSettingsPanel() {
    const root = this.createRoot('HallSettings', 'settings');
    const profile = this.callbacks!.getProfile();
    const t = this.theme();
    const mask = this.graphics(root, 'HallSettingsMask', 0, 0, 1280, 720, 1);
    mask.fillColor = new Color(8, 8, 16, 180); mask.rect(-640, -360, 1280, 720); mask.fill();
    const pw = 560, ph = 560;
    const panel = this.graphics(root, 'HallSettingsPanel', 0, 0, pw, ph, 3);
    panel.fillColor = t.night ? new Color(38, 32, 56, 245) : new Color(250, 242, 228, 248);
    panel.roundRect(-pw / 2, -ph / 2, pw, ph, 22); panel.fill();
    panel.strokeColor = t.cardStroke; panel.lineWidth = 4; panel.roundRect(-pw / 2 + 2, -ph / 2 + 2, pw - 4, ph - 4, 19); panel.stroke();
    // 标题 + 金色下划线
    this.label(root, 'HallSettingsTitle', '设置', 0, ph / 2 - 40, 400, 40, 32, t.ink, 'center', 6);
    const titleLine = this.graphics(root, 'HallSettingsTitleLine', 0, ph / 2 - 64, 80, 3, 6);
    titleLine.fillColor = new Color(255, 180, 70, 255); titleLine.roundRect(-40, -1.5, 80, 3, 1.5); titleLine.fill();

    // 重新排布 section，避免重叠：头像 90、昵称 58、声音 196、关于 80，间距 8
    const secAvatarY = 161, secNameY = 79, secSoundY = -56, secAboutY = -202;

    // Section: avatar picker
    this.drawSettingsSection(root, 'HallSetSecAvatar', 0, secAvatarY, 520, 90, t);
    this.label(root, 'HallSetAvatarLabel', '选择头像', -pw / 2 + 70, secAvatarY + 29, 120, 22, 16, t.ink, 'left', 7);
    AVATARS.forEach((av, i) => {
      const x = -pw / 2 + 110 + i * 74;
      this.drawAvatarCircle(root, `HallSetAvatar-${i}`, x, secAvatarY - 6, 26, av.emoji, av.id === profile.avatarId, t);
    });

    // Section: nickname
    this.drawSettingsSection(root, 'HallSetSecName', 0, secNameY, 520, 58, t);
    this.label(root, 'HallSetNameLabel', '昵称', -pw / 2 + 70, secNameY + 16, 60, 24, 16, t.ink, 'left', 7);
    this.drawNicknameInput(root, profile.playerName, 80, secNameY - 6, t);

    // Section: sound & display
    this.drawSettingsSection(root, 'HallSetSecSound', 0, secSoundY, 520, 196, t);
    this.label(root, 'HallSetSoundTitle', '声音与显示', -pw / 2 + 70, secSoundY + 76, 200, 24, 16, t.ink, 'left', 7);
    this.drawToggle(root, 'night', '夜间模式', -pw / 2 + 70, secSoundY + 36, profile.nightMode, t);
    this.drawToggle(root, 'music', '背景音乐', -pw / 2 + 70, secSoundY - 14, profile.musicOn, t);
    this.drawToggle(root, 'sfx', '音效', -pw / 2 + 70, secSoundY - 64, profile.sfxOn, t);

    // Section: about
    this.drawSettingsSection(root, 'HallSetSecAbout', 0, secAboutY, 520, 80, t);
    this.label(root, 'HallSetAboutTitle', '关于游戏', -pw / 2 + 70, secAboutY + 27, 200, 20, 14, t.ink, 'left', 7);
    this.label(root, 'HallSetAboutText', '殷墟甲骨文学习工具 · 开发中\n版本 V3.1 · 新国风探索 RPG', 0, secAboutY - 6, 480, 44, 12, t.sub, 'center', 7);

    this.button(root, 'HallSetBack', '返回大厅', 0, -ph / 2 + 42, 220, 50, true);
  }

  private drawSettingsSection(root: Node, name: string, x: number, y: number, w: number, h: number, t: ReturnType<LearningHall['theme']>) {
    const sec = this.graphics(root, name, x, y, w, h, 2);
    sec.fillColor = t.night ? new Color(255, 248, 228, 18) : new Color(120, 90, 60, 18);
    sec.roundRect(-w / 2, -h / 2, w, h, 14); sec.fill();
    sec.strokeColor = t.night ? new Color(255, 210, 140, 55) : new Color(150, 110, 70, 55);
    sec.lineWidth = 1; sec.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 13); sec.stroke();
  }

  private drawAvatarCircle(root: Node, name: string, x: number, y: number, r: number, emoji: string, selected: boolean, t: ReturnType<LearningHall['theme']>) {
    if (selected) {
      const ring = this.graphics(root, `${name}Ring`, x, y, (r + 6) * 2, (r + 6) * 2, 4);
      ring.strokeColor = new Color(255, 180, 70, 220); ring.lineWidth = 3; ring.circle(0, 0, r + 4); ring.stroke();
    }
    const node = this.graphics(root, name, x, y, r * 2, r * 2, 5);
    node.fillColor = new Color(255, 250, 235, 255); node.circle(0, 0, r); node.fill();
    node.strokeColor = selected ? new Color(180, 120, 50) : new Color(180, 165, 145, 200); node.lineWidth = selected ? 3 : 2; node.circle(0, 0, r - 2); node.stroke();
    this.label(root, `${name}Emoji`, emoji, x, y, r * 2 - 6, r * 2 - 6, r * 1.2, new Color(100, 70, 40), 'center', 6);
  }

  private drawNicknameInput(root: Node, name: string, x: number, y: number, t: ReturnType<LearningHall['theme']>) {
    const w = 240, h = 38;
    const bg = this.graphics(root, 'HallSetNameBg', x, y, w, h, 5);
    bg.fillColor = new Color(255, 255, 255, 235); bg.roundRect(-w / 2, -h / 2, w, h, h / 2); bg.fill();
    bg.strokeColor = new Color(200, 160, 100, 220); bg.lineWidth = 2; bg.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, h / 2 - 1); bg.stroke();
    const editNode = new Node('HallSetNameEdit'); editNode.parent = root; editNode.setPosition(x, y, 7);
    editNode.addComponent(UITransform).setContentSize(w - 20, h - 10);
    const edit = editNode.addComponent(EditBox) as EditBox;
    edit.string = name;
    edit.maxLength = 12;
    edit.fontSize = 16;
    edit.placeholder = '输入昵称';
    edit.inputMode = EditBox.InputMode.SINGLE_LINE;
    edit.editingDidEnded = (editbox: EditBox) => { this.callbacks?.setName(editbox.string); };
  }

  private drawToggle(root: Node, key: string, label: string, x: number, y: number, on: boolean, t: ReturnType<LearningHall['theme']>) {
    this.label(root, `HallSetToggleLabel-${key}`, label, x, y, 200, 26, 16, t.ink, 'left', 6);
    const bw = 52, bh = 28; const bx = 138;
    const node = this.graphics(root, `HallSetToggle-${key}`, bx, y, bw, bh, 6);
    node.fillColor = on ? new Color(90, 170, 120, 255) : new Color(160, 160, 170, 220);
    node.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2); node.fill();
    const knobR = 10;
    const knobX = on ? bx + bw / 2 - 13 : bx - bw / 2 + 13;
    const knob = this.graphics(root, `HallSetToggleKnob-${key}`, knobX, y, knobR * 2, knobR * 2, 7);
    knob.fillColor = new Color(255, 255, 255, 255); knob.circle(0, 0, knobR); knob.fill();
  }

  private onTouchStart(event: EventTouch) {
    const point = event.getUILocation(); const size = view.getVisibleSize();
    const x = point.x - size.width / 2; const y = point.y - size.height / 2;
    if (!this.isOpen) {
      if (this.hit(x, y, 295, 309, 120, 52)) this.open();
      return;
    }
    if (this.mode === 'home') {
      if (this.hitCircle(x, y, -16, -6, 72)) { this.callbacks?.enterYinXu(); this.close(); }
      else if (this.hit(x, y, -442, -6, 158, 216)) this.render('ranks');
      else if (this.hit(x, y, 538, 11, 86, 30)) this.openReviewLibrary();
      else if (this.hit(x, y, 424, -77, 340, 112)) this.render('codex');
      else if (this.hit(x, y, 540, 320, 74, 30)) this.render('parent');
      else if (this.hit(x, y, -212, -324, 66, 66)) this.render('home');
      else if (this.hit(x, y, -127, -324, 66, 66)) this.openReviewLibrary();
      else if (this.hit(x, y, -42, -324, 66, 66)) this.render('codex');
      else if (this.hit(x, y, 42, -324, 66, 66)) this.render('parent');
      else if (this.hit(x, y, 127, -324, 66, 66)) this.render('progress');
      else if (this.hit(x, y, 212, -324, 66, 66)) this.render('settings');
      return;
    }
    if (this.mode === 'ranks') {
      if (this.hit(x, y, 0, -256, 220, 50)) this.render('home');
      return;
    }
    if (this.mode === 'settings') {
      AVATARS.forEach((av, i) => { if (this.hit(x, y, -170 + i * 74, 128, 56, 56)) { this.callbacks?.setAvatar(av.id); this.render('settings'); } });
      if (this.hit(x, y, 138, 0, 52, 28)) { this.callbacks?.toggleNight(); this.render('settings'); }
      else if (this.hit(x, y, 138, -50, 52, 28)) { this.callbacks?.toggleMusic(); this.render('settings'); }
      else if (this.hit(x, y, 138, -100, 52, 28)) { this.callbacks?.toggleSfx(); this.render('settings'); }
      else if (this.hit(x, y, 0, -238, 220, 50)) this.render('home');
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

  private hitCircle(x: number, y: number, centerX: number, centerY: number, radius: number) {
    return (x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2;
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
