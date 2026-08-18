import { profile, saveProfile, getMyLegendarySlots, checkAchievements, avatarFrameHtml } from '../state';
import { refreshHeader } from '../header';
import { toast } from '../toast';
import { Sound } from '../sound';
import { Haptics } from '../haptics';
import { AVATARS, FRAMES, TITLES, SECRET_TITLES, findAvatar, findTitle, type AvatarDef, type FrameDef, type TitleDef } from '../shop';
import { levelInfo } from '../xp';
import type { Rarity } from '../types';

type ShopTab = 'avatars' | 'frames' | 'titles';
type ShopItem = AvatarDef | FrameDef | TitleDef;

let shopTab: ShopTab = 'avatars';
/** Fetched once per renderShop() call — the legendary-cosmetics gate needs it synchronously in every card's render, so it's resolved up front rather than per-card. Earned via LEGENDARY_WEEK_THRESHOLD in state.ts (#1 in 4+ games in the same week), NOT spent directly here — "spent" is just derived from how many legendary items the player already owns. */
let myLegendarySlots = 0;

function myLevel(): number {
  return profile ? levelInfo(profile.xp).level : 1;
}

/** How many legendary avatars/frames/titles this player already owns — each one "spends" one earned slot. */
function ownedLegendaryCount(): number {
  if (!profile) return 0;
  const a = AVATARS.filter((x) => x.rarity === 'legendary' && profile!.unlockedAvatars.includes(x.id)).length;
  const f = FRAMES.filter((x) => x.rarity === 'legendary' && profile!.unlockedFrames.includes(x.id)).length;
  const t = TITLES.filter((x) => x.rarity === 'legendary' && profile!.unlockedTitles.includes(x.id)).length;
  return a + f + t;
}

function itemsFor(tab: ShopTab): ShopItem[] {
  if (tab === 'avatars') return AVATARS;
  if (tab === 'frames') return FRAMES;
  // Secret titles are invisible until owned (see checkAchievements in state.ts) — once granted
  // they need to appear here like any other title, or they'd be permanently unequippable.
  const ownedSecrets = SECRET_TITLES.filter((t) => profile?.unlockedTitles.includes(t.id));
  return [...TITLES, ...ownedSecrets];
}

function ownedIds(tab: ShopTab): string[] {
  if (!profile) return [];
  return tab === 'avatars' ? profile.unlockedAvatars : tab === 'frames' ? profile.unlockedFrames : profile.unlockedTitles;
}

function equippedId(tab: ShopTab): string | null {
  if (!profile) return null;
  return tab === 'avatars' ? profile.equippedAvatar : tab === 'frames' ? profile.equippedFrame : profile.equippedTitle;
}

function displayName(item: ShopItem): string {
  return 'label' in item ? item.label : item.name;
}

/**
 * Why an unowned item can't be bought yet, if at all — null means it's just a normal cost-gated
 * buy. Kept deliberately short: this renders inside an 84px-wide shop card (an earlier "🏆 HALL
 * OF FAME 10" overflowed the card entirely) — the full explanation still shows in the toast on tap.
 */
function gateReason(item: ShopItem): string | null {
  if (item.rarity === 'legendary') {
    const owned = ownedLegendaryCount();
    if (item.requiresOwnedLegendary && owned < item.requiresOwnedLegendary) return `🔒 ${owned}/${item.requiresOwnedLegendary} LEG`;
    const available = myLegendarySlots - owned;
    if (available <= 0) return `⭐ ${Math.max(0, available)}/${myLegendarySlots}`;
    return null;
  }
  if (item.unlockLevel && myLevel() < item.unlockLevel) return `🔒 LVL ${item.unlockLevel}`;
  return null;
}

export async function renderShop(): Promise<void> {
  const main = document.getElementById('main')!;
  if (!profile) return;
  myLegendarySlots = await getMyLegendarySlots();
  // Bail if the player navigated away while that fetch was in flight.
  if (!document.getElementById('main') || !profile) return;

  main.innerHTML = `
    <div class="page">
      <div class="section-label">Brug din XP</div>
      <h1 class="section-title">Butik</h1>

      <div class="shop-balance">
        <div class="shop-balance-label">DIN SALDO</div>
        <div class="shop-balance-value" id="shopBalanceValue">✦ ${profile.xpBalance} XP</div>
      </div>

      <div class="shop-legendary-row" id="shopLegendaryRow"></div>

      <div class="shop-collection-row" id="shopCollectionRow"></div>

      <div class="tabs" style="margin-top:18px">
        <button class="tab-btn ${shopTab === 'avatars' ? 'active' : ''}" data-tab="avatars">AVATARER</button>
        <button class="tab-btn ${shopTab === 'frames' ? 'active' : ''}" data-tab="frames">RAMMER</button>
        <button class="tab-btn ${shopTab === 'titles' ? 'active' : ''}" data-tab="titles">TITLER</button>
      </div>

      <div id="shopNext"></div>
      <div id="shopGrid"></div>
    </div>
  `;
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => {
    b.addEventListener('click', () => {
      shopTab = b.dataset.tab as ShopTab;
      renderShop();
    });
  });
  renderGrid();
}

/** Kept separate from the rest of renderShop()'s one-shot HTML so it can be refreshed after a
 * purchase (via renderGrid()) without needing another async myLegendarySlots fetch — spent count
 * is derived live from already-loaded profile data. */
function updateLegendaryRow(): void {
  const el = document.getElementById('shopLegendaryRow');
  if (!el) return;
  const legendarySpent = ownedLegendaryCount();
  el.innerHTML = `
    <span>⭐ ${legendarySpent} / ${myLegendarySlots} legendary-slots brugt</span>
    <span class="shop-legendary-hint">${myLegendarySlots > legendarySpent ? 'Du har et ledigt slot — vælg en legendary nedenfor!' : 'Slut en uge som nr. 1 i 4+ spil for at optjene et nyt slot'}</span>
    <a class="shop-legendary-hint" href="#/guide" data-nav="guide" style="text-decoration:underline;cursor:pointer">Læs mere om hvordan det virker →</a>
  `;
}

/** The cheapest not-yet-owned item that's gate-unlocked but still short on XP — a concrete "you're this close" hook. Items still behind a level/Hall of Fame gate are skipped: earning more XP doesn't get you any closer to those, so the message would be misleading. */
function nextItemHtml(): string {
  if (!profile) return '';
  const balance = profile.xpBalance;
  const owned = ownedIds(shopTab);
  const next = itemsFor(shopTab)
    .filter((it) => !owned.includes(it.id) && it.cost > balance && !gateReason(it))
    .sort((a, b) => a.cost - b.cost)[0];
  if (!next) return '';
  return `
    <div class="shop-next-card">
      <div class="shop-next-emoji"><img src="${next.asset}" alt="" class="shop-next-thumb"></div>
      <div class="shop-next-body">
        <div class="shop-next-label">NÆSTE — "${displayName(next)}"</div>
        <div class="shop-next-cost mono">${next.cost - balance} XP mangler</div>
      </div>
    </div>
  `;
}

const RARITY_LABEL: Record<string, string> = { common: 'COMMON', rare: 'RARE', epic: 'EPIC', legendary: 'LEGENDARY', secret: '???' };

function itemCardHtml(item: ShopItem, tab: ShopTab): string {
  const owned = ownedIds(tab).includes(item.id);
  const equipped = equippedId(tab) === item.id;
  const affordable = profile!.xpBalance >= item.cost;
  const gate = !owned ? gateReason(item) : null;
  const tag = equipped
    ? '<div class="shop-equipped-tag">TAGET PÅ</div>'
    : owned
      ? '<div class="shop-owned-tag">EJET</div>'
      : gate
        ? `<div class="shop-locked-tag">${gate}</div>`
        : `<div class="shop-cost-tag">✦ ${item.cost}</div>`;
  const attr = tab === 'titles' ? 'data-title' : tab === 'frames' ? 'data-frame' : 'data-avatar';
  const cardClass = tab === 'titles' ? 'shop-title-card' : 'shop-avatar-card';
  const media =
    tab === 'titles'
      ? `<img src="${item.asset}" alt="${displayName(item)}" class="shop-title-thumb">`
      : tab === 'frames'
        // A bare frame ring on its own is mostly transparent and unreadable — preview it
        // composited over the player's own avatar so the card actually shows what they'd get.
        ? avatarFrameHtml(profile!.name, profile!.equippedAvatar, item.id, 44)
        : `<div class="shop-avatar-emoji"><img src="${item.asset}" alt="${displayName(item)}" class="shop-item-thumb"></div>`;
  return `
    <button class="${cardClass} rarity-${item.rarity} ${equipped ? 'equipped' : ''} ${!owned && !affordable ? 'unaffordable' : ''} ${gate ? 'level-locked' : ''}" ${attr}="${item.id}">
      <div class="rarity-tag rarity-${item.rarity}">${RARITY_LABEL[item.rarity]}</div>
      ${media}
      ${tag}
    </button>
  `;
}

/** Balance + collection counters, kept separate from renderShop()'s one-shot HTML for the same
 * reason as updateLegendaryRow() — refreshed after every purchase/equip via renderGrid() instead
 * of going stale until the player navigates away and back. */
function updateBalanceAndCollection(): void {
  if (!profile) return;
  const balanceEl = document.getElementById('shopBalanceValue');
  if (balanceEl) balanceEl.textContent = `✦ ${profile.xpBalance} XP`;
  const collectionEl = document.getElementById('shopCollectionRow');
  if (collectionEl) {
    collectionEl.innerHTML = `
      <span>🎭 ${profile.unlockedAvatars.filter((id) => findAvatar(id)).length} / ${AVATARS.length} avatarer</span>
      <span>🖼️ ${profile.unlockedFrames.length} / ${FRAMES.length} rammer</span>
      <span>🏷️ ${profile.unlockedTitles.filter((id) => findTitle(id)).length} / ${TITLES.length + SECRET_TITLES.length} titler</span>
    `;
  }
}

function renderGrid(): void {
  const grid = document.getElementById('shopGrid');
  const next = document.getElementById('shopNext');
  if (!grid || !next || !profile) return;
  updateLegendaryRow();
  updateBalanceAndCollection();
  next.innerHTML = nextItemHtml();
  grid.className = shopTab === 'titles' ? 'shop-title-grid' : 'shop-avatar-grid';
  grid.innerHTML = itemsFor(shopTab)
    .map((it) => itemCardHtml(it, shopTab))
    .join('');
  const attr = shopTab === 'titles' ? 'data-title' : shopTab === 'frames' ? 'data-frame' : 'data-avatar';
  grid.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
    el.addEventListener('click', () => handleTap(shopTab, el.dataset[attr === 'data-title' ? 'title' : attr === 'data-frame' ? 'frame' : 'avatar']!));
  });
}

/** How hard the reveal celebrates, keyed by rarity — particle count, the Sound.purchase() tier
 * (see sound.ts), whether the rotating ray burst shows, and whether the screen kicks with a
 * shake. Common still gets a real moment, just a quieter one; legendary gets everything. */
const REVEAL_CONFIG: Record<Rarity, { particles: number; soundTier: 0 | 1 | 2 | 3; rays: boolean; shake: boolean; haptic: 'personalBest' | 'legendary' }> = {
  common: { particles: 16, soundTier: 0, rays: false, shake: false, haptic: 'personalBest' },
  rare: { particles: 24, soundTier: 1, rays: false, shake: false, haptic: 'personalBest' },
  epic: { particles: 34, soundTier: 2, rays: true, shake: true, haptic: 'personalBest' },
  legendary: { particles: 48, soundTier: 3, rays: true, shake: true, haptic: 'legendary' },
  secret: { particles: 34, soundTier: 2, rays: true, shake: true, haptic: 'personalBest' },
};

function purchaseMediaHtml(item: ShopItem, tab: ShopTab): string {
  if (tab === 'titles') return `<img src="${item.asset}" alt="${displayName(item)}" class="shop-title-thumb">`;
  if (tab === 'frames') return avatarFrameHtml(profile!.name, profile!.equippedAvatar, item.id, 168);
  return `<img src="${item.asset}" alt="${displayName(item)}" class="shop-item-thumb">`;
}

/**
 * The "big flashy" moment on an actual purchase — deliberately absent from the plain
 * equip/unequip path (see handleTap), so it stays tied to "you just spent XP on something" and
 * doesn't wear out from overuse. Appended straight to <body> rather than #main so it survives
 * renderGrid() re-rendering the shop underneath it, and removes itself on tap or after ~2.4s.
 */
function showPurchaseReveal(item: ShopItem, tab: ShopTab): void {
  // Only one at a time — a rapid double-tap on the (now-disabled-looking) card shouldn't stack
  // two overlays fighting for the same dismiss listener.
  document.querySelector('.purchase-reveal')?.remove();

  const cfg = REVEAL_CONFIG[item.rarity];
  const particles = Array.from({ length: cfg.particles }, (_, i) => {
    const angle = (i / cfg.particles) * 360 + (Math.random() * 14 - 7);
    const dist = 90 + Math.random() * 150;
    const rad = (angle * Math.PI) / 180;
    const tx = Math.cos(rad) * dist;
    const ty = Math.sin(rad) * dist;
    const size = 5 + Math.random() * 6;
    const rot = 180 + Math.random() * 540;
    const delay = Math.random() * 0.12;
    const palette = ['var(--rarity-color)', 'var(--text)', 'var(--rarity-color)'];
    const color = palette[i % palette.length];
    return `<div class="purchase-particle" style="--tx:${tx.toFixed(1)}px;--ty:${ty.toFixed(1)}px;--size:${size.toFixed(1)}px;--rot:${rot.toFixed(0)}deg;--delay:${delay.toFixed(2)}s;--pcolor:${color}"></div>`;
  }).join('');

  const el = document.createElement('div');
  el.className = `purchase-reveal rarity-${item.rarity}`;
  el.innerHTML = `
    <div class="purchase-flash"></div>
    <div class="purchase-stage">
      ${cfg.rays ? '<div class="purchase-rays"></div>' : ''}
      <div class="purchase-burst-ring"></div>
      <div class="purchase-particles">${particles}</div>
      <div class="purchase-media">${purchaseMediaHtml(item, tab)}</div>
      <div class="purchase-rarity-label">${RARITY_LABEL[item.rarity]}</div>
      <div class="purchase-name">${displayName(item)}</div>
      <div class="purchase-unlocked-tag">✦ LÅST OP & TAGET PÅ</div>
    </div>
    <div class="purchase-hint">TRYK FOR AT FORTSÆTTE</div>
  `;
  document.body.appendChild(el);

  Sound.purchase(cfg.soundTier);
  Haptics[cfg.haptic]();

  let dismissed = false;
  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    el.classList.remove('in');
    el.classList.add('closing');
    setTimeout(() => el.remove(), 260);
  };
  el.addEventListener('click', dismiss);
  const autoTimer = setTimeout(dismiss, 2400);
  el.addEventListener('click', () => clearTimeout(autoTimer), { once: true });

  // Two rAFs (not one) so the browser commits the pre-transition state — width:0 opacity:0 etc —
  // as a real paint before .in flips every transition/animation on, or the enter plays instantly
  // instead of animating from its start state.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add('in');
      if (cfg.shake) el.classList.add('shake');
    });
  });
}

async function handleTap(tab: ShopTab, id: string): Promise<void> {
  if (!profile) return;
  const def = itemsFor(tab).find((it) => it.id === id);
  if (!def) return;
  const owned = ownedIds(tab).includes(id);
  let justPurchased = false;

  if (owned) {
    if (tab === 'avatars') profile.equippedAvatar = profile.equippedAvatar === id ? null : id;
    else if (tab === 'frames') profile.equippedFrame = profile.equippedFrame === id ? null : id;
    else profile.equippedTitle = profile.equippedTitle === id ? null : id;
    Sound.click();
  } else {
    const gate = gateReason(def);
    if (gate) {
      const owned = ownedLegendaryCount();
      toast(
        def.rarity === 'legendary'
          ? def.requiresOwnedLegendary && owned < def.requiresOwnedLegendary
            ? `Kræver ${def.requiresOwnedLegendary} andre ejede legendary ting — du har ${owned}`
            : myLegendarySlots === 0
              ? 'Legendary kræver mindst 1 uge som nr. 1 i 4+ forskellige spil'
              : `Ingen ledige legendary-slots — du har brugt alle ${myLegendarySlots}`
          : `Låst op ved level ${def.unlockLevel} — du er level ${myLevel()}`,
      );
      return;
    }
    if (profile.xpBalance < def.cost) {
      toast('Ikke nok XP endnu');
      return;
    }
    profile.xpBalance -= def.cost;
    if (tab === 'avatars') {
      profile.unlockedAvatars.push(id);
      profile.equippedAvatar = id;
    } else if (tab === 'frames') {
      profile.unlockedFrames.push(id);
      profile.equippedFrame = id;
    } else {
      profile.unlockedTitles.push(id);
      profile.equippedTitle = id;
    }
    showPurchaseReveal(def, tab);
    justPurchased = true;
  }
  await saveProfile();
  refreshHeader();
  // Owning the last legendary item can itself unlock a secret title (see checkAchievements in
  // state.ts) — check right away instead of leaving it stale until the player's next game.
  if (justPurchased) await checkAchievements();
  renderGrid();
}
