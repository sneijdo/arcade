import type { UpgradeDef } from './types';

export function renderShell(main: HTMLElement): void {
  main.innerHTML = `
    <div class="page">
      <div class="tactical-shell">
        <div class="tactical-hud-top">
          <div class="tactical-room-label" id="tacRoomLabel">RUM 1/7</div>
          <div class="tactical-bar-group">
            <div class="tactical-bar-track"><div class="tactical-bar-fill hp" id="tacHpFill" style="width:100%"></div></div>
            <div class="tactical-bar-label" id="tacHpLabel">100 / 100 HP</div>
          </div>
          <div class="tactical-bar-group">
            <div class="tactical-bar-track"><div class="tactical-bar-fill xp" id="tacXpFill" style="width:0%"></div></div>
            <div class="tactical-bar-label" id="tacXpLabel">LEVEL 1</div>
          </div>
        </div>
        <div class="tactical-canvas-wrap" id="tacCanvasWrap">
          <canvas id="tacticalCanvas"></canvas>
          <div class="tactical-boss-bar-wrap" id="tacBossBar" style="display:none">
            <div class="tactical-boss-name">ARMORED COMMANDER</div>
            <div class="tactical-boss-bar-track"><div class="tactical-boss-bar-fill" id="tacBossFill" style="width:100%"></div></div>
          </div>
          <div class="tactical-joystick" id="tacJoystick"><div class="tactical-joystick-knob" id="tacJoystickKnob"></div></div>
          <div class="tactical-weapon-chip" id="tacWeaponChip">VIPER AR</div>
        </div>
      </div>
    </div>
  `;
}

export function updateHpBar(hp: number, maxHp: number): void {
  const fill = document.getElementById('tacHpFill');
  const label = document.getElementById('tacHpLabel');
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  if (fill) fill.style.width = `${pct}%`;
  if (label) label.textContent = `${Math.max(0, Math.round(hp))}/${maxHp} HP`;
}

export function updateXpBar(level: number, into: number, need: number): void {
  const fill = document.getElementById('tacXpFill');
  const label = document.getElementById('tacXpLabel');
  const pct = Math.max(0, Math.min(100, (into / need) * 100));
  if (fill) fill.style.width = `${pct}%`;
  if (label) label.textContent = `LEVEL ${level}`;
}

export function updateRoomLabel(text: string): void {
  const el = document.getElementById('tacRoomLabel');
  if (el) el.textContent = text;
}

export function showBossBar(show: boolean): void {
  const el = document.getElementById('tacBossBar');
  if (el) el.style.display = show ? 'block' : 'none';
}

export function updateBossBar(hp: number, maxHp: number): void {
  const fill = document.getElementById('tacBossFill');
  if (fill) fill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
}

export function showJoystickIfTouch(): void {
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const el = document.getElementById('tacJoystick');
  if (el && isTouch) el.classList.add('visible');
}

const RARITY_LABEL: Record<string, string> = { common: 'ALMINDELIG', rare: 'SJÆLDEN', epic: 'EPISK' };

export function showLevelUpModal(choices: UpgradeDef[], onPick: (u: UpgradeDef) => void): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" style="max-width:560px">
      <div class="hero-tag" style="margin-bottom:6px">LEVEL OP</div>
      <h2>Vælg en opgradering</h2>
      <div class="upgrade-grid">
        ${choices
          .map(
            (u, i) => `
          <button class="upgrade-card rarity-${u.rarity}" data-idx="${i}">
            <div class="icon">${u.icon}</div>
            <div class="name">${u.name}</div>
            <div class="desc">${u.desc}</div>
            <div class="rarity-tag">${RARITY_LABEL[u.rarity]}</div>
          </button>
        `,
          )
          .join('')}
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelectorAll<HTMLButtonElement>('[data-idx]').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      if (!(e as PointerEvent).isPrimary) return;
      e.preventDefault();
      const idx = Number(btn.dataset.idx);
      backdrop.remove();
      onPick(choices[idx]);
    });
  });
  return backdrop;
}
