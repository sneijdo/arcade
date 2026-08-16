import { supabase } from '../supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Light Cycles' netcode: no dedicated server, only a per-match Supabase Realtime
 * Broadcast+Presence channel. Both clients run an identical deterministic
 * simulation — the only thing ever sent over the wire is "I turned at tick N,"
 * never a position — so there is no reconciliation/rollback to implement, at
 * the cost of a small, fixed, symmetric input-delay (every steer, including
 * your own, is applied INPUT_DELAY_TICKS in the future) that guarantees both
 * clients always have an input before they need to simulate the tick it
 * applies to. See supabase/schema_duels.sql for the invite table this hands
 * off from (see challenges.ts), and src/pages/duel.ts for the render layer.
 */

export const GRID_W = 28;
export const GRID_H = 18;
const TICK_MS = 100;
const INPUT_DELAY_TICKS = 3;
const LEAD_IN_MS = 3000;
const FORFEIT_GRACE_MS = 5000;
/** How often (in ticks) a desync-detection hash is broadcast — cheap, and only ever used to *notice* divergence, never to correct it (see endMatch's 'desync' reason). */
const SYNC_EVERY_TICKS = 20;

export type Dir = { x: number; y: number };
export type Slot = 'sender' | 'recipient';
export type Cell = { x: number; y: number };
export type MatchPhase = 'waiting' | 'leadin' | 'playing' | 'ended';
export type MatchOutcome = { winner: Slot | 'draw' | null; reason: 'crash' | 'draw' | 'forfeit' | 'desync' };
export interface MatchSnapshot {
  tick: number;
  trails: Record<Slot, Cell[]>;
}

interface PlayerRuntime {
  trail: Cell[];
  dir: Dir;
  /** Turns already committed to a specific future tick — keyed by tick so a rapid
   * double-input within one input-delay window overwrites rather than queues, and so
   * the exact same tick-indexed schedule is unambiguous to apply on both clients. */
  pendingTurns: Map<number, Dir>;
}

type BroadcastMsg =
  | { kind: 'start'; leadInMs: number }
  | { kind: 'turn'; slot: Slot; dir: Dir; tick: number }
  | { kind: 'sync'; tick: number; hash: string }
  | { kind: 'result'; winner: Slot | 'draw' | null; reason: MatchOutcome['reason'] };

function isReversal(next: Dir, current: Dir): boolean {
  return next.x === -current.x && next.y === -current.y;
}

function otherSlot(s: Slot): Slot {
  return s === 'sender' ? 'recipient' : 'sender';
}

export class DuelEngine {
  private channel: RealtimeChannel;
  private mySlot: Slot;
  private oppId: string;
  private players: Record<Slot, PlayerRuntime>;
  private phase: MatchPhase = 'waiting';
  private localTick0At: number | null = null;
  private lastSimulatedTick = -1;
  private rafId: number | null = null;
  private forfeitTimer: ReturnType<typeof setTimeout> | null = null;
  private startSent = false;

  private onPhaseChange: (phase: MatchPhase) => void;
  private onLeadIn: (msLeftMs: number) => void;
  private onTick: (snap: MatchSnapshot) => void;
  private onEnd: (outcome: MatchOutcome) => void;

  constructor(opts: {
    matchId: string;
    myId: string;
    mySlot: Slot;
    oppId: string;
    onPhaseChange: (phase: MatchPhase) => void;
    onLeadIn: (msLeftMs: number) => void;
    onTick: (snap: MatchSnapshot) => void;
    onEnd: (outcome: MatchOutcome) => void;
  }) {
    this.mySlot = opts.mySlot;
    this.oppId = opts.oppId;
    this.onPhaseChange = opts.onPhaseChange;
    this.onLeadIn = opts.onLeadIn;
    this.onTick = opts.onTick;
    this.onEnd = opts.onEnd;
    this.players = {
      sender: { trail: [{ x: 3, y: GRID_H - 4 }], dir: { x: 1, y: 0 }, pendingTurns: new Map() },
      recipient: { trail: [{ x: GRID_W - 4, y: 3 }], dir: { x: -1, y: 0 }, pendingTurns: new Map() },
    };

    if (!supabase) throw new Error('duel requires Supabase');
    this.channel = supabase.channel('duel-' + opts.matchId, { config: { broadcast: { self: false }, presence: { key: opts.myId } } });

    this.channel.on('broadcast', { event: 'duel' }, ({ payload }) => this.handleMessage(payload as BroadcastMsg));
    this.channel.on('presence', { event: 'sync' }, () => this.handlePresenceSync(opts.myId));
    this.channel.on('presence', { event: 'leave' }, ({ key }) => {
      if (key !== opts.oppId) return;
      if (this.phase === 'ended') return;
      this.forfeitTimer = setTimeout(() => {
        if (this.phase === 'ended') return;
        this.endMatch(this.mySlot, 'forfeit');
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

  private setPhase(p: MatchPhase): void {
    this.phase = p;
    this.onPhaseChange(p);
  }

  private async broadcast(msg: BroadcastMsg): Promise<void> {
    await this.channel.send({ type: 'broadcast', event: 'duel', payload: msg });
  }

  private handlePresenceSync(myId: string): void {
    if (this.phase !== 'waiting') return;
    const state = this.channel.presenceState();
    const present = Object.keys(state);
    if (!present.includes(this.oppId) || !present.includes(myId)) return;
    // Whichever id sorts first elects itself to kick off the match, once — avoids a
    // double-send race where both clients see the sync at once and both try to start.
    if (this.startSent || myId >= this.oppId) return;
    this.startSent = true;
    void this.broadcast({ kind: 'start', leadInMs: LEAD_IN_MS });
    this.beginLeadIn(LEAD_IN_MS);
  }

  private handleMessage(msg: BroadcastMsg): void {
    if (msg.kind === 'start') {
      if (this.phase === 'waiting') this.beginLeadIn(msg.leadInMs);
      return;
    }
    if (msg.kind === 'turn') {
      if (msg.tick <= this.lastSimulatedTick) return; // arrived too late — dropped, not reconciled (see module doc)
      this.players[msg.slot].pendingTurns.set(msg.tick, msg.dir);
      return;
    }
    if (msg.kind === 'sync') {
      if (msg.tick !== this.lastSimulatedTick) return;
      if (msg.hash !== this.computeHash() && this.phase === 'playing') this.endMatch(null, 'desync');
      return;
    }
    if (msg.kind === 'result') {
      if (this.phase !== 'ended') this.endMatch(msg.winner, msg.reason);
    }
  }

  private beginLeadIn(leadInMs: number): void {
    this.localTick0At = performance.now() + leadInMs;
    this.setPhase('leadin');
    this.rafId = requestAnimationFrame(this.loop);
  }

  /** currentTick() is only meaningful once localTick0At is set (leadin/playing) — negative during leadin, which is fine since queueTurn() only runs while phase==='playing'. */
  private currentTick(): number {
    return Math.floor((performance.now() - this.localTick0At!) / TICK_MS);
  }

  private loop = (): void => {
    if (this.phase === 'ended') return;
    if (this.phase === 'leadin') {
      const msLeft = this.localTick0At! - performance.now();
      this.onLeadIn(Math.max(0, msLeft));
      if (msLeft <= 0) this.setPhase('playing');
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }
    if (this.phase === 'playing') {
      const target = this.currentTick();
      while (this.lastSimulatedTick < target && (this.phase as MatchPhase) === 'playing') {
        this.simulateTick(this.lastSimulatedTick + 1);
      }
      if (this.phase === 'playing') {
        this.onTick(this.snapshot());
        if (this.lastSimulatedTick % SYNC_EVERY_TICKS === 0) void this.broadcast({ kind: 'sync', tick: this.lastSimulatedTick, hash: this.computeHash() });
        this.rafId = requestAnimationFrame(this.loop);
      }
    }
  };

  private simulateTick(tick: number): void {
    this.lastSimulatedTick = tick;
    for (const slot of ['sender', 'recipient'] as Slot[]) {
      const p = this.players[slot];
      const scheduled = p.pendingTurns.get(tick);
      p.pendingTurns.delete(tick);
      if (scheduled && !isReversal(scheduled, p.dir)) p.dir = scheduled;
    }

    const newHeads: Record<Slot, Cell> = {
      sender: { x: this.players.sender.trail[this.players.sender.trail.length - 1].x + this.players.sender.dir.x, y: this.players.sender.trail[this.players.sender.trail.length - 1].y + this.players.sender.dir.y },
      recipient: {
        x: this.players.recipient.trail[this.players.recipient.trail.length - 1].x + this.players.recipient.dir.x,
        y: this.players.recipient.trail[this.players.recipient.trail.length - 1].y + this.players.recipient.dir.y,
      },
    };

    const deaths = new Set<Slot>();
    for (const slot of ['sender', 'recipient'] as Slot[]) {
      const h = newHeads[slot];
      if (h.x < 0 || h.x >= GRID_W || h.y < 0 || h.y >= GRID_H) {
        deaths.add(slot);
        continue;
      }
      if (this.players[slot].trail.some((c) => c.x === h.x && c.y === h.y)) {
        deaths.add(slot);
        continue;
      }
      if (this.players[otherSlot(slot)].trail.some((c) => c.x === h.x && c.y === h.y)) deaths.add(slot);
    }
    // Head-on / pass-through: same target cell, or the two heads swap places — both crash, a draw.
    const prevSenderHead = this.players.sender.trail[this.players.sender.trail.length - 1];
    const prevRecipientHead = this.players.recipient.trail[this.players.recipient.trail.length - 1];
    const sameCell = newHeads.sender.x === newHeads.recipient.x && newHeads.sender.y === newHeads.recipient.y;
    const swapped =
      newHeads.sender.x === prevRecipientHead.x && newHeads.sender.y === prevRecipientHead.y && newHeads.recipient.x === prevSenderHead.x && newHeads.recipient.y === prevSenderHead.y;
    if (sameCell || swapped) {
      deaths.add('sender');
      deaths.add('recipient');
    }

    for (const slot of ['sender', 'recipient'] as Slot[]) this.players[slot].trail.push(newHeads[slot]);

    if (deaths.size > 0) {
      const winner: Slot | 'draw' | null = deaths.size === 2 ? 'draw' : deaths.has('sender') ? 'recipient' : 'sender';
      this.onTick(this.snapshot());
      this.endMatch(winner, deaths.size === 2 ? 'draw' : 'crash');
      void this.broadcast({ kind: 'result', winner, reason: deaths.size === 2 ? 'draw' : 'crash' });
    }
  }

  private computeHash(): string {
    const s = this.players.sender.trail[this.players.sender.trail.length - 1];
    const r = this.players.recipient.trail[this.players.recipient.trail.length - 1];
    return `${s.x},${s.y},${this.players.sender.dir.x},${this.players.sender.dir.y}|${r.x},${r.y},${this.players.recipient.dir.x},${this.players.recipient.dir.y}`;
  }

  private snapshot(): MatchSnapshot {
    return { tick: this.lastSimulatedTick, trails: { sender: this.players.sender.trail, recipient: this.players.recipient.trail } };
  }

  private endMatch(winner: Slot | 'draw' | null, reason: MatchOutcome['reason']): void {
    if (this.phase === 'ended') return;
    this.setPhase('ended');
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.forfeitTimer) clearTimeout(this.forfeitTimer);
    this.forfeitTimer = null;
    this.onEnd({ winner, reason });
  }

  /** Steer input — applies to the caller's own bike INPUT_DELAY_TICKS in the future,
   * exactly like an opponent's turn would, so both players feel identical input latency
   * and the simulation never needs to reconcile a locally-instant move against what the
   * remote side eventually agrees happened. No-ops outside 'playing' (e.g. during lead-in). */
  queueTurn(dir: Dir): void {
    if (this.phase !== 'playing') return;
    const tick = this.currentTick() + INPUT_DELAY_TICKS;
    this.players[this.mySlot].pendingTurns.set(tick, dir);
    void this.broadcast({ kind: 'turn', slot: this.mySlot, dir, tick });
  }

  destroy(): void {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    if (this.forfeitTimer) clearTimeout(this.forfeitTimer);
    supabase?.removeChannel(this.channel);
  }
}
