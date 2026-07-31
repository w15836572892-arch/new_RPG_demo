import {
  Color,
  Graphics,
  Label,
  Node,
  UITransform,
  Vec2,
} from 'cc';
import { StoryObjective } from './StoryTypes';

export class QuestGuide {
  private readonly marker: Node;
  private readonly markerGraphics: Graphics;
  private readonly hudRoot: Node;
  private readonly arrowGraphics: Graphics;
  private readonly objectiveLabel: Label;
  /** Persistent chapter requirement line, kept separate from the story prose. */
  private readonly progressLabel: Label;
  private readonly taskAnnouncement: Node;
  private readonly taskAnnouncementTitle: Label;
  private readonly taskAnnouncementDetail: Label;
  private objective: StoryObjective | null = null;
  /** 最终目标（金色光环坑）坐标，与箭头下一航点分离：光环永远锁在目标坑上。 */
  private ultimateTarget: Vec2 | null = null;
  /** Walkable waypoints supplied by the world controller for obstacle-aware guidance. */
  private navigationPath: Vec2[] = [];
  private elapsed = 0;
  private announcementTimer = 0;
  /** 章节、背包等全屏面板打开时暂时隐藏，避免任务文字压在面板边缘。 */
  private visible = true;

  constructor(world: Node, hudParent: Node) {
    this.marker = new Node('StoryQuestMarker');
    this.marker.parent = world;
    this.marker.addComponent(UITransform).setContentSize(120, 120);
    this.markerGraphics = this.marker.addComponent(Graphics);
    this.marker.active = false;

    this.hudRoot = new Node('StoryQuestGuideHud');
    this.hudRoot.parent = hudParent;
    this.hudRoot.setPosition(0, 0, 250);
    this.hudRoot.addComponent(UITransform).setContentSize(1280, 720);
    this.arrowGraphics = this.hudRoot.addComponent(Graphics);
    const labelNode = new Node('StoryQuestObjectiveLabel');
    labelNode.parent = this.hudRoot;
    labelNode.setPosition(0, 250, 1);
    labelNode.addComponent(UITransform).setContentSize(680, 42);
    this.objectiveLabel = labelNode.addComponent(Label);
    this.objectiveLabel.fontSize = 18;
    this.objectiveLabel.lineHeight = 24;
    this.objectiveLabel.color = new Color(255, 239, 197);
    this.objectiveLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.objectiveLabel.verticalAlign = Label.VerticalAlign.CENTER;
    this.objectiveLabel.overflow = Label.Overflow.SHRINK;

    const progressNode = new Node('StoryQuestProgressLabel');
    progressNode.parent = this.hudRoot;
    progressNode.setPosition(0, 226, 1);
    progressNode.addComponent(UITransform).setContentSize(760, 24);
    this.progressLabel = progressNode.addComponent(Label);
    this.progressLabel.fontSize = 14;
    this.progressLabel.lineHeight = 20;
    this.progressLabel.color = new Color(245, 211, 133);
    this.progressLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.progressLabel.verticalAlign = Label.VerticalAlign.CENTER;
    this.progressLabel.overflow = Label.Overflow.SHRINK;

    this.taskAnnouncement = new Node('StoryTaskAnnouncement');
    this.taskAnnouncement.parent = this.hudRoot;
    this.taskAnnouncement.setPosition(0, 168, 8);
    this.taskAnnouncement.addComponent(UITransform).setContentSize(620, 106);
    const announcementBackground = this.taskAnnouncement.addComponent(Graphics);
    announcementBackground.fillColor = new Color(49, 34, 25, 242);
    announcementBackground.roundRect(-310, -53, 620, 106, 14);
    announcementBackground.fill();
    announcementBackground.strokeColor = new Color(218, 170, 82, 255);
    announcementBackground.lineWidth = 4;
    announcementBackground.roundRect(-307, -50, 614, 100, 12);
    announcementBackground.stroke();
    this.taskAnnouncementTitle = this.createLabel(
      this.taskAnnouncement, 'StoryTaskAnnouncementTitle',
      0, 21, 560, 32, 22, new Color(248, 207, 119),
    );
    this.taskAnnouncementDetail = this.createLabel(
      this.taskAnnouncement, 'StoryTaskAnnouncementDetail',
      0, -19, 560, 30, 16, new Color(255, 240, 207),
    );
    this.taskAnnouncement.active = false;
    this.hudRoot.active = false;
  }

  setObjective(objective: StoryObjective | null, ultimateTarget?: Vec2) {
    const previousKey = this.objective
      ? `${this.objective.title}|${this.objective.detail ?? ''}`
      : '';
    const nextKey = objective ? `${objective.title}|${objective.detail ?? ''}` : '';
    this.objective = objective;
    this.ultimateTarget = ultimateTarget ?? (objective && objective.targetX !== undefined && objective.targetY !== undefined
      ? new Vec2(objective.targetX, objective.targetY)
      : null);
    this.navigationPath = [];
    this.elapsed = 0;
    if (objective && previousKey !== nextKey) this.showTaskAnnouncement(objective);
    if (!objective || objective.targetX === undefined || objective.targetY === undefined) {
      this.marker.active = false;
      this.hudRoot.active = this.visible && Boolean(objective);
      this.objectiveLabel.string = objective?.detail ? `${objective.title} · ${objective.detail}` : objective?.title ?? '';
      this.arrowGraphics.clear();
      return;
    }
    // marker（金色光环）永远画在最终目标坑上；箭头单独指向 navigationPath[0] / objective.target。
    const markerX = this.ultimateTarget?.x ?? objective.targetX;
    const markerY = this.ultimateTarget?.y ?? objective.targetY;
    this.marker.setPosition(markerX, markerY, 120);
    this.marker.active = true;
    this.hudRoot.active = this.visible;
    this.objectiveLabel.string = objective.detail ? `${objective.title} · ${objective.detail}` : objective.title;
    this.redrawMarker(0);
  }

  /** The arrow advances through walkable waypoints; the world ring stays on the final goal. */
  setNavigationPath(points: ReadonlyArray<Vec2>) {
    this.navigationPath = points.map(point => point.clone());
  }

  /** 进/出宗庙时切换箭头节点所在的父节点（world ↔ templeInterior），使室内占卜路也能指示。 */
  setWorldNode(node: Node) {
    this.marker.parent = node;
  }

  /** Shows collection requirements without crowding the narrative task text. */
  setChapterProgress(text: string) {
    this.progressLabel.string = text;
    this.progressLabel.node.active = Boolean(text);
  }

  /**
   * 只控制任务引导的显示，不清除当前任务；关闭面板后可无缝恢复。
   */
  setVisible(visible: boolean) {
    this.visible = visible;
    this.hudRoot.active = visible && Boolean(this.objective);
  }

  update(dt: number, playerPosition: Vec2, viewportWidth = 1280, viewportHeight = 720) {
    if (this.announcementTimer > 0) {
      this.announcementTimer = Math.max(0, this.announcementTimer - dt);
      this.taskAnnouncement.active = this.announcementTimer > 0;
    }
    if (!this.objective || this.objective.targetX === undefined || this.objective.targetY === undefined) return;
    this.elapsed += dt;
    while (this.navigationPath.length > 0
      && Vec2.distance(playerPosition, this.navigationPath[0]) <= 78) {
      this.navigationPath.shift();
    }
    this.redrawMarker(this.elapsed);
    this.drawOffscreenArrow(playerPosition, viewportWidth, viewportHeight);
  }

  destroy() {
    this.marker.destroy();
    this.hudRoot.destroy();
  }

  private showTaskAnnouncement(objective: StoryObjective) {
    this.taskAnnouncementTitle.string = `新任务  ${objective.title}`;
    this.taskAnnouncementDetail.string = objective.detail ?? '查看任务指引并完成目标';
    this.taskAnnouncement.active = true;
    this.announcementTimer = 3.6;
  }

  private createLabel(
    parent: Node,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    color: Color,
  ) {
    const node = new Node(name);
    node.parent = parent;
    node.setPosition(x, y, 1);
    node.addComponent(UITransform).setContentSize(width, height);
    const label = node.addComponent(Label);
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 6;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    return label;
  }

  private redrawMarker(time: number) {
    const pulse = 1 + Math.sin(time * 3.4) * 0.08;
    const radius = 35 * pulse;
    this.markerGraphics.clear();
    this.markerGraphics.fillColor = new Color(242, 190, 77, 42);
    this.markerGraphics.circle(0, 0, radius);
    this.markerGraphics.fill();
    this.markerGraphics.strokeColor = new Color(255, 224, 126, 230);
    this.markerGraphics.lineWidth = 4;
    this.markerGraphics.circle(0, 0, radius);
    this.markerGraphics.stroke();
  }

  private drawOffscreenArrow(playerPosition: Vec2, viewportWidth: number, viewportHeight: number) {
    const waypoint = this.navigationPath[0];
    const targetX = waypoint?.x ?? this.objective?.targetX ?? playerPosition.x;
    const targetY = waypoint?.y ?? this.objective?.targetY ?? playerPosition.y;
    const dx = targetX - playerPosition.x;
    const dy = targetY - playerPosition.y;
    const margin = 72;
    const halfWidth = viewportWidth / 2 - margin;
    const halfHeight = viewportHeight / 2 - margin;
    this.arrowGraphics.clear();
    if (Math.abs(dx) <= halfWidth && Math.abs(dy) <= halfHeight) return;

    const scale = Math.min(halfWidth / Math.max(1, Math.abs(dx)), halfHeight / Math.max(1, Math.abs(dy)));
    const x = dx * scale;
    const y = dy * scale;
    const angle = Math.atan2(dy, dx);
    const size = 22;
    const left = angle + Math.PI * 0.78;
    const right = angle - Math.PI * 0.78;
    this.arrowGraphics.fillColor = new Color(250, 205, 91, 245);
    this.arrowGraphics.moveTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
    this.arrowGraphics.lineTo(x + Math.cos(left) * size, y + Math.sin(left) * size);
    this.arrowGraphics.lineTo(x + Math.cos(right) * size, y + Math.sin(right) * size);
    this.arrowGraphics.close();
    this.arrowGraphics.fill();
  }
}
