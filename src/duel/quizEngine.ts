import { supabase } from '../supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { pickQuestions, type PickedQuestion, type QuizQuestion } from './questionBank';

/**
 * Quiz Duel's netcode — much simpler than a physics duel would need, deliberately.
 * There's no continuous simulation to keep in lockstep, so instead of a fixed-tick
 * engine with an input-delay buffer, each client just runs its own phase timers and
 * waits for the *real* message from the opponent before advancing — self-correcting
 * against network jitter rather than assuming a shared clock. The only thing that
 * has to be deterministic is which 10 questions the match uses (see
 * questionBank.ts's pickQuestions) — everything else is "wait for both sides,
 * then move on."
 */

export type Slot = 'sender' | 'recipient';
export type QuizPhase = 'waiting' | 'category' | 'leadin' | 'question' | 'reveal' | 'ended';

const LEAD_IN_MS = 3000;
/** Exported so the page's purely-cosmetic CSS timer-bar animation can match the engine's real deadline. */
export const QUESTION_TIME_MS = 12000;
const QUESTION_MS = QUESTION_TIME_MS;
const REVEAL_MS = 2500;
const FORFEIT_GRACE_MS = 5000;
const BASE_POINTS = 10;
const MAX_BONUS = 10;
const TOTAL_QUESTIONS = 10;

export interface RoundState {
  index: number;
  total: number;
  categoryId: string;
  question: QuizQuestion;
}

export interface RevealState extends RoundState {
  correctIndex: number;
  myAnswer: number | null;
  oppAnswer: number | null;
  myGain: number;
  oppGain: number;
  myTotal: number;
  oppTotal: number;
}

export type MatchOutcome = { winner: Slot | 'draw' | null; reason: 'score' | 'forfeit'; myTotal: number; oppTotal: number };

type BroadcastMsg =
  | { kind: 'category'; slot: Slot; categoryId: string }
  | { kind: 'answer'; slot: Slot; qIndex: number; optionIndex: number | null; elapsedMs: number }
  | { kind: 'result'; winner: Slot | 'draw' | null; reason: MatchOutcome['reason'] };

function otherSlot(s: Slot): Slot {
  return s === 'sender' ? 'recipient' : 'sender';
}

export class QuizEngine {
  private channel: RealtimeChannel;
  private matchId: string;
  private mySlot: Slot;
  private oppId: string;
  private phase: QuizPhase = 'waiting';
  private categories: Partial<Record<Slot, string>> = {};
  private questions: PickedQuestion[] = [];
  private roundIndex = -1;
  private answered = false;
  private questionShownAt = 0;
  private scores: Record<Slot, number> = { sender: 0, recipient: 0 };
  private roundAnswers: Partial<Record<Slot, { optionIndex: number | null; elapsedMs: number }>> = {};
  private questionTimer: ReturnType<typeof setTimeout> | null = null;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private leadinTimer: ReturnType<typeof setTimeout> | null = null;
  private forfeitTimer: ReturnType<typeof setTimeout> | null = null;

  private onPhaseChange: (phase: QuizPhase) => void;
  private onCategoryState: (mine: string | null, theirs: string | null) => void;
  private onRound: (state: RoundState) => void;
  private onLocked: (optionIndex: number | null) => void;
  private onReveal: (state: RevealState) => void;
  private onEnd: (outcome: MatchOutcome) => void;

  constructor(opts: {
    matchId: string;
    myId: string;
    mySlot: Slot;
    oppId: string;
    onPhaseChange: (phase: QuizPhase) => void;
    onCategoryState: (mine: string | null, theirs: string | null) => void;
    onRound: (state: RoundState) => void;
    onLocked: (optionIndex: number | null) => void;
    onReveal: (state: RevealState) => void;
    onEnd: (outcome: MatchOutcome) => void;
  }) {
    this.matchId = opts.matchId;
    this.mySlot = opts.mySlot;
    this.oppId = opts.oppId;
    this.onPhaseChange = opts.onPhaseChange;
    this.onCategoryState = opts.onCategoryState;
    this.onRound = opts.onRound;
    this.onLocked = opts.onLocked;
    this.onReveal = opts.onReveal;
    this.onEnd = opts.onEnd;

    if (!supabase) throw new Error('duel requires Supabase');
    this.channel = supabase.channel('duel-' + opts.matchId, { config: { broadcast: { self: false }, presence: { key: opts.myId } } });

    this.channel.on('broadcast', { event: 'duel' }, ({ payload }) => this.handleMessage(payload as BroadcastMsg));
    this.channel.on('presence', { event: 'sync' }, () => this.handlePresenceSync(opts.myId));
    this.channel.on('presence', { event: 'leave' }, ({ key }) => {
      if (key !== opts.oppId) return;
      if (this.phase === 'ended') return;
      this.forfeitTimer = setTimeout(() => {
        if (this.phase === 'ended') return;
        this.finish(this.mySlot, 'forfeit');
        void this.broadcast({ kind: 'result', winner: this.mySlot, reason: 'forfeit' });
      }, FORFEIT_GRACE_MS);
    });
    this.channel.on('presence', { event: 'join' }, ({ key }) => {
      if (key !== opts.oppId) return;
      if (this.forfeitTimer) {
        clearTimeout(this.forfeitTimer);
        this.forfeitTimer = null;
      }
    });
    this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await this.channel.track({ joinedAt: Date.now() });
    });
  }

  private setPhase(p: QuizPhase): void {
    this.phase = p;
    this.onPhaseChange(p);
  }

  private async broadcast(msg: BroadcastMsg): Promise<void> {
    await this.channel.send({ type: 'broadcast', event: 'duel', payload: msg });
  }

  private handlePresenceSync(myId: string): void {
    if (this.phase !== 'waiting') return;
    const present = Object.keys(this.channel.presenceState());
    if (!present.includes(this.oppId) || !present.includes(myId)) return;
    this.setPhase('category');
    this.onCategoryState(this.categories[this.mySlot] ?? null, this.categories[otherSlot(this.mySlot)] ?? null);
  }

  private handleMessage(msg: BroadcastMsg): void {
    if (msg.kind === 'category') {
      this.categories[msg.slot] = msg.categoryId;
      this.maybeAdvanceFromCategory();
      return;
    }
    if (msg.kind === 'answer') {
      if (msg.qIndex !== this.roundIndex) return; // stale/duplicate — ignore
      this.roundAnswers[msg.slot] = { optionIndex: msg.optionIndex, elapsedMs: msg.elapsedMs };
      this.maybeReveal();
      return;
    }
    if (msg.kind === 'result' && this.phase !== 'ended') this.finish(msg.winner, msg.reason);
  }

  /** Only picks questions once BOTH categories are known, and always in fixed
   * sender-then-recipient order (never "mine then theirs") — the two clients would
   * otherwise pass reversed arguments to pickQuestions() and compute a different
   * interleave order for the same underlying two question sets. */
  private maybeAdvanceFromCategory(): void {
    this.onCategoryState(this.categories[this.mySlot] ?? null, this.categories[otherSlot(this.mySlot)] ?? null);
    if (this.phase !== 'category') return;
    const senderCat = this.categories.sender;
    const recipientCat = this.categories.recipient;
    if (!senderCat || !recipientCat) return;
    this.questions = pickQuestions(this.matchId, senderCat, recipientCat);
    this.setPhase('leadin');
    this.leadinTimer = setTimeout(() => this.startRound(0), LEAD_IN_MS);
  }

  private startRound(index: number): void {
    if (index >= TOTAL_QUESTIONS) {
      this.finishByScore();
      return;
    }
    this.roundIndex = index;
    this.roundAnswers = {};
    this.answered = false;
    this.questionShownAt = performance.now();
    this.setPhase('question');
    const picked = this.questions[index];
    this.onRound({ index, total: TOTAL_QUESTIONS, categoryId: picked.categoryId, question: picked.question });
    this.questionTimer = setTimeout(() => {
      if (this.phase === 'question' && !this.answered) this.submitAnswer(null);
    }, QUESTION_MS);
  }

  private maybeReveal(): void {
    if (this.phase !== 'question') return;
    if (!this.roundAnswers[this.mySlot] || !this.roundAnswers[otherSlot(this.mySlot)]) return;
    this.revealRound();
  }

  private scoreFor(answer: { optionIndex: number | null; elapsedMs: number }, correctIndex: number): number {
    if (answer.optionIndex !== correctIndex) return 0;
    const timeLeftMs = Math.max(0, QUESTION_MS - answer.elapsedMs);
    return BASE_POINTS + Math.round(MAX_BONUS * (timeLeftMs / QUESTION_MS));
  }

  private revealRound(): void {
    const picked = this.questions[this.roundIndex];
    const correctIndex = picked.question.correct;
    const mine = this.roundAnswers[this.mySlot]!;
    const theirs = this.roundAnswers[otherSlot(this.mySlot)]!;
    const myGain = this.scoreFor(mine, correctIndex);
    const oppGain = this.scoreFor(theirs, correctIndex);
    this.scores[this.mySlot] += myGain;
    this.scores[otherSlot(this.mySlot)] += oppGain;
    this.setPhase('reveal');
    this.onReveal({
      index: this.roundIndex,
      total: TOTAL_QUESTIONS,
      categoryId: picked.categoryId,
      question: picked.question,
      correctIndex,
      myAnswer: mine.optionIndex,
      oppAnswer: theirs.optionIndex,
      myGain,
      oppGain,
      myTotal: this.scores[this.mySlot],
      oppTotal: this.scores[otherSlot(this.mySlot)],
    });
    const next = this.roundIndex + 1;
    this.revealTimer = setTimeout(() => this.startRound(next), REVEAL_MS);
  }

  private finishByScore(): void {
    const mine = this.scores[this.mySlot];
    const theirs = this.scores[otherSlot(this.mySlot)];
    const winner: Slot | 'draw' | null = mine === theirs ? 'draw' : mine > theirs ? this.mySlot : otherSlot(this.mySlot);
    this.finish(winner, 'score');
    void this.broadcast({ kind: 'result', winner, reason: 'score' });
  }

  private finish(winner: Slot | 'draw' | null, reason: MatchOutcome['reason']): void {
    if (this.phase === 'ended') return;
    this.setPhase('ended');
    if (this.questionTimer) clearTimeout(this.questionTimer);
    if (this.revealTimer) clearTimeout(this.revealTimer);
    if (this.leadinTimer) clearTimeout(this.leadinTimer);
    if (this.forfeitTimer) clearTimeout(this.forfeitTimer);
    this.onEnd({ winner, reason, myTotal: this.scores[this.mySlot], oppTotal: this.scores[otherSlot(this.mySlot)] });
  }

  chooseCategory(categoryId: string): void {
    if (this.phase !== 'category' || this.categories[this.mySlot]) return;
    this.categories[this.mySlot] = categoryId;
    void this.broadcast({ kind: 'category', slot: this.mySlot, categoryId });
    this.maybeAdvanceFromCategory();
  }

  /** null = explicit "time's up, no pick" (auto-submitted by the question timer).
   * The question timer and the page's cosmetic CSS timer-bar animation are two
   * independent clocks (see this file's module doc) that can drift under real-world
   * jank — without onLocked, a click that lands just after the engine's own timer
   * already auto-submitted null would silently no-op here (the `this.answered` guard
   * below) while the page had no idea and kept the button clickable, making it look
   * like the late click worked when it didn't. onLocked is the single place the page
   * learns "your answer is locked in" regardless of which path (click vs. timeout) did it. */
  submitAnswer(optionIndex: number | null): void {
    if (this.phase !== 'question' || this.answered) return;
    this.answered = true;
    if (this.questionTimer) {
      clearTimeout(this.questionTimer);
      this.questionTimer = null;
    }
    const elapsedMs = performance.now() - this.questionShownAt;
    this.roundAnswers[this.mySlot] = { optionIndex, elapsedMs };
    this.onLocked(optionIndex);
    void this.broadcast({ kind: 'answer', slot: this.mySlot, qIndex: this.roundIndex, optionIndex, elapsedMs });
    this.maybeReveal();
  }

  destroy(): void {
    if (this.questionTimer) clearTimeout(this.questionTimer);
    if (this.revealTimer) clearTimeout(this.revealTimer);
    if (this.leadinTimer) clearTimeout(this.leadinTimer);
    if (this.forfeitTimer) clearTimeout(this.forfeitTimer);
    supabase?.removeChannel(this.channel);
  }
}
