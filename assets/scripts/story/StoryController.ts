import {
  StoryChapterDefinition,
  StoryEvent,
  StoryFlagValue,
  StorySaveState,
  StorySnapshot,
  StoryStepDefinition,
} from './StoryTypes';
import { migrateStorySave } from './StoryState';

type StoryListener = (snapshot: StorySnapshot, step: StoryStepDefinition | null) => void;

export class StoryController {
  private readonly chapters = new Map<string, StoryChapterDefinition>();
  private readonly listeners = new Set<StoryListener>();
  private state: StorySaveState;

  constructor(
    definitions: StoryChapterDefinition[],
    initialState: unknown,
    private readonly persist: (state: StorySaveState) => void,
  ) {
    this.validateDefinitions(definitions);
    definitions.forEach(chapter => {
      this.chapters.set(chapter.id, chapter);
    });
    this.state = migrateStorySave(initialState);
    if (this.repairCurrentStep()) {
      this.persist(this.snapshot() as StorySaveState);
    }
  }

  snapshot(): StorySnapshot {
    const npcArcStates: StorySaveState['npcArcStates'] = {};
    Object.keys(this.state.npcArcStates).forEach(npcId => {
      npcArcStates[npcId] = { ...this.state.npcArcStates[npcId] };
    });
    return {
      ...this.state,
      completedChapterIds: [...this.state.completedChapterIds],
      flags: { ...this.state.flags },
      eventHistory: this.state.eventHistory.map(entry => ({ ...entry, cardIds: [...entry.cardIds] })),
      eventSeenCounts: { ...this.state.eventSeenCounts },
      npcArcStates,
      recentNpcIds: [...this.state.recentNpcIds],
      recentCardIds: [...this.state.recentCardIds],
      worldFlags: { ...this.state.worldFlags },
      pendingEvent: this.state.pendingEvent ? { ...this.state.pendingEvent, cardIds: [...this.state.pendingEvent.cardIds] } : null,
    };
  }

  currentStep() {
    const chapter = this.state.currentChapterId ? this.chapters.get(this.state.currentChapterId) : undefined;
    return chapter?.steps.find(step => step.id === this.state.currentStepId) ?? null;
  }

  /** 当前章节剧情推进比例 0~1：当前步序号 / (总步数-1)。用于进度条“剧情进度”维度。 */
  currentStepProgress(chapterId: string = this.state.currentChapterId): number {
    const chapter = chapterId ? this.chapters.get(chapterId) : undefined;
    if (!chapter) return 0;
    if (chapter.steps.length <= 1) return 1;
    const idx = chapter.steps.findIndex(step => step.id === this.state.currentStepId);
    if (idx < 0) return 0;
    return idx / (chapter.steps.length - 1);
  }

  subscribe(listener: StoryListener) {
    this.listeners.add(listener);
    listener(this.snapshot(), this.currentStep());
    return () => this.listeners.delete(listener);
  }

  startChapter(chapterId: string) {
    const chapter = this.chapters.get(chapterId);
    if (!chapter || this.state.completedChapterIds.includes(chapterId)) return false;
    this.state.currentChapterId = chapter.id;
    this.state.currentStepId = chapter.firstStepId;
    this.commit();
    return true;
  }

  handle(event: StoryEvent) {
    const step = this.currentStep();
    if (!step || step.completeOn !== event.type) return false;
    if (event.type === 'learning-completed' && event.cardId && event.correct !== false) {
      this.state.flags[`learned-card:${event.cardId}`] = true;
    }
    if (step.nextStepId) {
      const chapter = this.chapters.get(step.chapterId);
      if (!chapter?.steps.some(candidate => candidate.id === step.nextStepId)) return false;
      this.state.currentStepId = step.nextStepId;
    } else {
      return this.completeCurrentChapter();
    }
    this.commit();
    return true;
  }

  setFlag(key: string, value: StoryFlagValue) {
    if (this.state.flags[key] === value) return;
    this.state.flags[key] = value;
    this.commit();
  }

  addDestinyPower(amount: number) {
    const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    if (safeAmount === 0) return;
    this.state.destinyPower += safeAmount;
    this.commit();
  }

  reserveStorySite(siteId: string | null) {
    if (this.state.reservedStorySiteId === siteId) return;
    this.state.reservedStorySiteId = siteId;
    this.commit();
  }

  useFirstFreeDivination() {
    if (this.state.firstDivinationFreeUsed) return false;
    this.state.firstDivinationFreeUsed = true;
    this.commit();
    return true;
  }

  resetForTesting() {
    this.state = migrateStorySave(null);
    this.commit();
  }

  // 测试用：重置为全新存档，再按目标章把其前置章节标记为已完成，
  // 这样 beginChapterOneIfNeeded 会直接从目标章开始，无需重玩前置章。
  startTestingAtChapter(priorCompletedIds: string[]) {
    this.state = migrateStorySave(null);
    this.state.completedChapterIds = [...new Set(priorCompletedIds)];
    this.commit();
  }

  missingRequiredCards(chapterId = this.state.currentChapterId): string[] {
    const chapter = chapterId ? this.chapters.get(chapterId) : undefined;
    return (chapter?.requiredCardIds ?? []).filter(cardId => this.state.flags[`learned-card:${cardId}`] !== true);
  }

  /** 判断某步骤是否为「占卜步骤」（completeOn === 'divination-completed'）。用于占卜满轮判定。 */
  stepIsDivination(stepId: string | null | undefined): boolean {
    if (!stepId) return false;
    for (const chapter of this.chapters.values()) {
      const step = chapter.steps.find(s => s.id === stepId);
      if (step) return step.completeOn === 'divination-completed';
    }
    return false;
  }

  /**
   * 章末已走到末步（无下一跳）、却因「尚缺未学字」被 completeCurrentChapter 阻塞时，
   * 玩家补齐本章全部字后调用此方法补判章完成，杜绝软锁。
   * 仅当当前步骤已是末步（无 nextStepId）才允许补判——中途步骤一律 no-op。
   */
  recheckChapterCompletion(): boolean {
    const chapterId = this.state.currentChapterId;
    if (!chapterId) return false;
    const step = this.currentStep();
    if (step?.nextStepId) return false;
    return this.completeCurrentChapter();
  }

  private completeCurrentChapter() {
    const chapterId = this.state.currentChapterId;
    const missing = this.missingRequiredCards(chapterId);
    if (missing.length > 0) {
      this.state.flags[`chapter-blocked:${chapterId}`] = missing.length;
      this.commit();
      return false;
    }
    if (chapterId && !this.state.completedChapterIds.includes(chapterId)) {
      this.state.completedChapterIds.push(chapterId);
    }
    this.state.currentChapterId = null;
    this.state.currentStepId = null;
    this.state.reservedStorySiteId = null;
    this.commit();
    return true;
  }

  private repairCurrentStep() {
    const chapterId = this.state.currentChapterId;
    if (!chapterId) {
      const changed = this.state.currentStepId !== null;
      this.state.currentStepId = null;
      return changed;
    }
    const chapter = this.chapters.get(chapterId);
    if (!chapter) {
      this.state.currentChapterId = null;
      this.state.currentStepId = null;
      return true;
    }
    if (!chapter.steps.some(step => step.id === this.state.currentStepId)) {
      this.state.currentStepId = chapter.firstStepId;
      return true;
    }
    return false;
  }

  private validateDefinitions(definitions: StoryChapterDefinition[]) {
    const chapterIds = new Set<string>();
    const globalStepIds = new Set<string>();
    definitions.forEach(chapter => {
      if (!chapter.id || chapterIds.has(chapter.id)) {
        throw new Error(`[StoryController] 章节 ID 缺失或重复：${chapter.id || '(empty)'}`);
      }
      chapterIds.add(chapter.id);

      const stepIds = new Set<string>();
      chapter.steps.forEach(step => {
        if (!step.id || stepIds.has(step.id) || globalStepIds.has(step.id)) {
          throw new Error(`[StoryController] 剧情步骤 ID 缺失或重复：${step.id || '(empty)'}`);
        }
        if (step.chapterId !== chapter.id) {
          throw new Error(`[StoryController] 步骤 ${step.id} 的 chapterId 与章节 ${chapter.id} 不一致。`);
        }
        stepIds.add(step.id);
        globalStepIds.add(step.id);
      });

      if (!stepIds.has(chapter.firstStepId)) {
        throw new Error(`[StoryController] 章节 ${chapter.id} 的首步骤 ${chapter.firstStepId} 不存在。`);
      }
      chapter.steps.forEach(step => {
        if (step.nextStepId && !stepIds.has(step.nextStepId)) {
          throw new Error(`[StoryController] 步骤 ${step.id} 指向不存在的下一步骤 ${step.nextStepId}。`);
        }
      });
    });
  }

  private commit() {
    const snapshot = this.snapshot();
    this.persist(snapshot as StorySaveState);
    this.listeners.forEach(listener => listener(snapshot, this.currentStep()));
  }
}
