import type { TowerDef, TowerId, TowerInstance } from './types';
import { gameUtilBarHtml } from '../../gameChrome';

export function renderShell(main: HTMLElement): void {
  main.innerHTML = `
    <div class="page">
      <div class="td-shell">
        <div class="td-hud-top">
          <div class="td-stat"><span class="td-stat-icon">💰</span><span id="tdGold">0</span></div>
          <div class="td-stat"><span class="td-stat-icon">❤️</span><span id="tdLives">20</span></div>
          <div class="td-stat td-wave-label" id="tdWaveLabel">BØLGE 1/30</div>
        </div>
        ${gameUtilBarHtml()}
        <div class="td-canvas-wrap" id="tdCanvasWrap">
          <canvas id="tdCanvas"></canvas>
          <div class="td-boss-bar-wrap" id="tdBossBar" style="display:none">
            <div class="td-boss-name" id="tdBossName">TROLD</div>
            <div class="td-boss-bar-track"><div class="td-boss-bar-fill" id="tdBossFill" style="width:100%"></div></div>
          </div>
        </div>
        <div class="td-bottombar">
          <button class="btn btn-primary" id="tdStartWaveBtn">START BØLGE</button>
          <div class="td-autostart" id="tdAutoStart"></div>
        </div>
      </div>
    </div>
  `;
}

export function updateGold(gold: number): void {
  const el = document.getElementById('tdGold');
  if (el) el.textContent = `${Math.round(gold)}`;
}

export function updateLives(lives: number): void {
  const el = document.getElementById('tdLives');
  if (el) el.textContent = `${Math.max(0, Math.round(lives))}`;
}

export function updateWaveLabel(text: string): void {
  const el = document.getElementById('tdWaveLabel');
  if (el) el.textContent = text;
}

export function showBossBar(show: boolean): void {
  const el = document.getElementById('tdBossBar');
  // block, not flex — the name label and bar track stack vertically and the track needs to fill
  // 100% of the wrap's width; as a flex row with no explicit widths, the empty (childless) track
  // shrank to fit its own zero-width content instead.
  if (el) el.style.display = show ? 'block' : 'none';
}

export function updateBossName(name: string): void {
  const el = document.getElementById('tdBossName');
  if (el) el.textContent = name;
}

export function updateBossBar(hp: number, maxHp: number): void {
  const fill = document.getElementById('tdBossFill');
  if (fill) fill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
}

export function setStartWaveButton(enabled: boolean, label: string): void {
  const btn = document.getElementById('tdStartWaveBtn') as HTMLButtonElement | null;
  if (!btn) return;
  btn.disabled = !enabled;
  btn.textContent = label;
}

export function updateAutoStartLabel(text: string): void {
  const el = document.getElementById('tdAutoStart');
  if (el) el.textContent = text;
}

/** Tower-picker modal for an empty build slot — shown on tap, one card per tower def, each showing
 * its tier-1 (placement) cost and disabled if the player can't afford it. */
export function showTowerPickerModal(towers: TowerDef[], gold: number, onPick: (id: TowerId) => void): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" style="max-width:520px" role="dialog" aria-modal="true" aria-labelledby="towerPickerTitle">
      <div class="hero-tag" style="margin-bottom:6px">BYG TÅRN</div>
      <h2 id="towerPickerTitle">Vælg et tårn</h2>
      <div class="td-tower-grid">
        ${towers
          .map((t) => {
            const cost = t.tiers[0].cost;
            const afford = gold >= cost;
            return `
          <button class="td-tower-card" data-tower="${t.id}" style="--td-color:${t.color}" ${afford ? '' : 'disabled'}>
            <div class="icon">${t.icon}</div>
            <div class="name">${t.name}</div>
            <div class="tagline">${t.tagline}</div>
            <div class="cost">💰 ${cost}</div>
          </button>
        `;
          })
          .join('')}
      </div>
      <button class="btn btn-ghost btn-block" id="towerPickerCancelBtn" style="margin-top:14px">ANNULLER</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelectorAll<HTMLButtonElement>('[data-tower]').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      if (!(e as PointerEvent).isPrimary || btn.disabled) return;
      e.preventDefault();
      backdrop.remove();
      onPick(btn.dataset.tower as TowerId);
    });
  });
  backdrop.querySelector<HTMLButtonElement>('#towerPickerCancelBtn')!.addEventListener('click', () => backdrop.remove());
  return backdrop;
}

/** Upgrade/sell popup for a placed tower — shown on tap, offers the next tier (if not maxed) and a
 * sell-for-partial-refund option. */
export function showTowerInfoModal(
  def: TowerDef,
  instance: TowerInstance,
  gold: number,
  sellValue: number,
  onUpgrade: () => void,
  onSell: () => void,
): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const maxed = instance.tier >= 3;
  const nextTier = maxed ? null : def.tiers[instance.tier];
  const afford = nextTier ? gold >= nextTier.cost : false;
  backdrop.innerHTML = `
    <div class="modal" style="max-width:420px" role="dialog" aria-modal="true" aria-labelledby="towerInfoTitle">
      <div class="hero-tag" style="margin-bottom:6px">${def.icon} ${def.name.toUpperCase()} — TIER ${instance.tier}</div>
      <h2 id="towerInfoTitle">${maxed ? 'Fuldt opgraderet' : 'Opgradér eller sælg'}</h2>
      <div class="td-tower-stats">
        <div>Skade forvoldt: <b>${Math.round(instance.totalDamageDealt)}</b></div>
        <div>Kills: <b>${instance.kills}</b></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
        ${nextTier ? `<button class="btn btn-primary btn-block" id="towerUpgradeBtn" ${afford ? '' : 'disabled'}>OPGRADÉR TIL TIER ${nextTier.tier} — 💰 ${nextTier.cost}</button>` : ''}
        <button class="btn btn-ghost btn-block" id="towerSellBtn">SÆLG — 💰 ${sellValue}</button>
        <button class="btn btn-ghost btn-block" id="towerInfoCloseBtn">LUK</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  document.getElementById('towerUpgradeBtn')?.addEventListener('click', () => {
    backdrop.remove();
    onUpgrade();
  });
  document.getElementById('towerSellBtn')!.addEventListener('click', () => {
    backdrop.remove();
    onSell();
  });
  document.getElementById('towerInfoCloseBtn')!.addEventListener('click', () => backdrop.remove());
  return backdrop;
}
