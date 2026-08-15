import type { Vec2 } from './types';
import { vLen } from './types';

/**
 * Unifies keyboard (desktop) and a virtual joystick (mobile) into one
 * normalized move vector, so gameplay code never needs to know which
 * input method is active — same "architecture supports both without
 * rewriting gameplay systems" goal the spec asks for.
 */
export class InputController {
  private keys = new Set<string>();
  private joystickVec: Vec2 = { x: 0, y: 0 };
  private joystickActive = false;
  private joystickBase: Vec2 = { x: 0, y: 0 };
  private joystickPointerId: number | null = null;

  private keydownHandler = (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase());
  private keyupHandler = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  private joystickKnobEl: HTMLElement | null = null;
  private readonly joystickRadius = 46;

  attachKeyboard(): void {
    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
  }

  detachKeyboard(): void {
    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);
  }

  /** Wires up a joystick base+knob pair already present in the DOM (see hud.ts). */
  attachJoystick(baseEl: HTMLElement, knobEl: HTMLElement): void {
    this.joystickKnobEl = knobEl;

    const onDown = (e: PointerEvent) => {
      if (this.joystickPointerId !== null) return;
      this.joystickPointerId = e.pointerId;
      this.joystickActive = true;
      const rect = baseEl.getBoundingClientRect();
      this.joystickBase = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      updateFromPointer(e);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      updateFromPointer(e);
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = null;
      this.joystickActive = false;
      this.joystickVec = { x: 0, y: 0 };
      if (this.joystickKnobEl) this.joystickKnobEl.style.transform = 'translate(0px, 0px)';
    };
    const updateFromPointer = (e: PointerEvent) => {
      const dx = e.clientX - this.joystickBase.x;
      const dy = e.clientY - this.joystickBase.y;
      const dist = Math.min(Math.hypot(dx, dy), this.joystickRadius);
      const angle = Math.atan2(dy, dx);
      const kx = Math.cos(angle) * dist;
      const ky = Math.sin(angle) * dist;
      if (this.joystickKnobEl) this.joystickKnobEl.style.transform = `translate(${kx}px, ${ky}px)`;
      this.joystickVec = { x: kx / this.joystickRadius, y: ky / this.joystickRadius };
    };

    baseEl.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    // stash for detach
    this.detachJoystickFns.push(
      () => baseEl.removeEventListener('pointerdown', onDown),
      () => window.removeEventListener('pointermove', onMove),
      () => window.removeEventListener('pointerup', onUp),
      () => window.removeEventListener('pointercancel', onUp),
    );
  }

  private detachJoystickFns: Array<() => void> = [];

  detachJoystick(): void {
    this.detachJoystickFns.forEach((fn) => fn());
    this.detachJoystickFns = [];
  }

  /** Normalized (-1..1 per axis, magnitude clamped to 1) movement vector for this frame. */
  getMoveVector(): Vec2 {
    if (this.joystickActive) return this.joystickVec;
    let x = 0;
    let y = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    const v = { x, y };
    const len = vLen(v);
    return len > 1 ? { x: v.x / len, y: v.y / len } : v;
  }

  isMoving(): boolean {
    return vLen(this.getMoveVector()) > 0.05;
  }

  destroy(): void {
    this.detachKeyboard();
    this.detachJoystick();
  }
}
