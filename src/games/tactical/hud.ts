import type { UpgradeDef } from './types';
import type { PerkDef, TacticalMeta } from './meta';
import { gameUtilBarHtml } from '../../gameChrome';

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
        ${gameUtilBarHtml()}
        <div class="tactical-canvas-wrap" id="tacCanvasWrap">
          <canvas id="tacticalCanvas"></canvas>
          <div class="tactical-boss-bar-wrap" id="tacBossBar" style="display:none">
            <div class="tactical-boss-name" id="tacBossName">ARMORED COMMANDER</div>
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

export function updateWeaponChip(name: string): void {
  const el = document.getElementById('tacWeaponChip');
  if (el) el.textContent = name.toUpperCase();
}

export function updateBossName(name: string): void {
  const el = document.getElementById('tacBossName');
  if (el) el.textContent = name;
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
    <div class="modal" style="max-width:560px" role="dialog" aria-modal="true" aria-labelledby="levelUpModalTitle">
      <div class="hero-tag" style="margin-bottom:6px">LEVEL OP</div>
      <h2 id="levelUpModalTitle">Vælg en opgradering</h2>
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

const VAULT_OPTIONS: { id: 'heal' | 'currency' | 'upgrade'; icon: string; name: string; desc: string }[] = [
  { id: 'heal', icon: '❤️', name: 'Fuld Helbredelse', desc: 'Genopfyld dit HP til maks. med det samme.' },
  { id: 'currency', icon: '🔷', name: 'Fragmenter', desc: 'Modtag 40 Fragmenter til brug i næste run.' },
  { id: 'upgrade', icon: '⭐', name: 'Garanteret Opgradering', desc: 'Vælg med det samme blandt 3 opgraderinger.' },
];

export function showVaultModal(onPick: (choice: 'heal' | 'currency' | 'upgrade') => void): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" style="max-width:560px" role="dialog" aria-modal="true" aria-labelledby="vaultModalTitle">
      <div class="hero-tag" style="margin-bottom:6px">HVÆLV FUNDET</div>
      <h2 id="vaultModalTitle">Vælg din belønning</h2>
      <div class="upgrade-grid">
        ${VAULT_OPTIONS.map(
          (o, i) => `
          <button class="upgrade-card rarity-rare" data-idx="${i}">
            <div class="icon">${o.icon}</div>
            <div class="name">${o.name}</div>
            <div class="desc">${o.desc}</div>
          </button>
        `,
        ).join('')}
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
      onPick(VAULT_OPTIONS[idx].id);
    });
  });
}

/**
 * `onBuy` performs the actual purchase (mutate meta + persist + feedback)
 * and returns whether it succeeded — the modal only re-renders itself on a
 * true result, so a failed purchase (insufficient currency) just leaves the
 * modal as-is instead of silently "closing" the attempt.
 */
export function showPerkShopModal(meta: TacticalMeta, perks: PerkDef[], onBuy: (perkId: string) => boolean, onClose: () => void): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  function renderContent(): void {
    backdrop.innerHTML = `
      <div class="modal" style="max-width:480px" role="dialog" aria-modal="true" aria-labelledby="perkShopModalTitle">
        <div class="hero-tag" style="margin-bottom:6px">PERMANENTE PERKS</div>
        <h2 id="perkShopModalTitle">Perk-butik</h2>
        <p style="margin-top:-6px">Din saldo: <b style="color:var(--lime)">🔷 ${meta.currency}</b></p>
        <div class="perk-list">
          ${perks
            .map((p) => {
              const owned = meta.unlockedPerks.includes(p.id);
              const afford = meta.currency >= p.cost;
              return `
            <div class="perk-row ${owned ? 'owned' : ''}">
              <div class="perk-icon">${p.icon}</div>
              <div class="perk-info">
                <div class="perk-name">${p.name}</div>
                <div class="perk-desc">${p.desc}</div>
              </div>
              ${
                owned
                  ? '<div class="perk-owned-tag">EJET</div>'
                  : `<button class="btn btn-ghost perk-buy-btn" data-perk="${p.id}" ${afford ? '' : 'disabled style="opacity:.4"'}>🔷 ${p.cost}</button>`
              }
            </div>
          `;
            })
            .join('')}
        </div>
        <button class="btn btn-primary btn-block" id="perkShopCloseBtn" style="margin-top:14px">LUK</button>
      </div>
    `;
    backdrop.querySelectorAll<HTMLButtonElement>('[data-perk]').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        if (!(e as PointerEvent).isPrimary) return;
        e.preventDefault();
        const bought = onBuy(btn.dataset.perk!);
        if (bought) renderContent();
      });
    });
    backdrop.querySelector<HTMLButtonElement>('#perkShopCloseBtn')!.addEventListener('click', () => {
      backdrop.remove();
      onClose();
    });
  }

  document.body.appendChild(backdrop);
  renderContent();
}
