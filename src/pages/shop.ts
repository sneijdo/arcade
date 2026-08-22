import { profile, saveProfile, getMyLegendarySlots, checkAchievements, avatarFrameHtml } from '../state';
import { refreshHeader } from '../header';
import { toast } from '../toast';
import { Sound } from '../sound';
import { Haptics } from '../haptics';
import {
  AVATARS,
  FRAMES,
  TITLES,
  SECRET_TITLES,
  NAME_EFFECTS,
  SOUND_PACKS,
  TAUNTS,
  findAvatar,
  findTitle,
  type AvatarDef,
  type FrameDef,
  type TitleDef,
  type NameEffectDef,
  type SoundPackDef,
  type TauntDef,
} from '../shop';
import { levelInfo } from '../xp';
import type { Rarity } from '../types';

type ShopTab = 'avatars' | 'frames' | 'titles' | 'nameEffects' | 'soundPacks' | 'taunts';
type ShopItem = AvatarDef | FrameDef | TitleDef | NameEffectDef | SoundPackDef | TauntDef;

/** Tabs whose items are text/description-based (row layout, reuses .shop-title-card) rather than
 * image-thumbnail-based (square grid, .shop-avatar-card). */
const ROW_STYLE_TABS: ShopTab[] = ['titles', 'nameEffects', 'soundPacks', 'taunts'];

let shopTab: ShopTab = 'avatars';
/** Fetched once per renderShop() call — the legendary-cosmetics gate needs it synchronously in every card's render, so it's resolved up front rather than per-card. Earned via LEGENDARY_WEEK_THRESHOLD in state.ts (#1 in 4+ games in the same week), NOT spent directly here — "spent" is just derived from how many legendary items the player already owns. */
let myLegendarySlots = 0;

function myLevel(): number {
  return profile ? levelInfo(profile.xp).level : 1;
}

/** How many legendary items this player already owns, across every category — each one "spends" one earned slot. */
function ownedLegendaryCount(): number {
  if (!profile) return 0;
  const counts = [
    [AVATARS, profile.unlockedAvatars],
    [FRAMES, profile.unlockedFrames],
    [TITLES, profile.unlockedTitles],
    [NAME_EFFECTS, profile.unlockedNameEffects],
    [SOUND_PACKS, profile.unlockedSoundPacks],
    [TAUNTS, profile.unlockedTaunts],
  ] as const;
  return counts.reduce((sum, [defs, owned]) => sum + defs.filter((x) => x.rarity === 'legendary' && owned.includes(x.id)).length, 0);
}

/** Display order for every shop grid — common → rare → epic → legendary → secret, cost
 * ascending within a tier. Catalogs in shop.ts are grouped this way too, but a later batch
 * tacked onto the end of an array (as happened with the 4 new "Cast V1" avatars) would
 * otherwise render as its own out-of-order tail instead of slotting into its rarity's
 * section — sorting at display time makes that structurally impossible instead of relying
 * on every future catalog edit to hand-splice new entries into the right spot. */
const RARITY_ORDER: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3, secret: 4 };

function byRarityThenCost(a: ShopItem, b: ShopItem): number {
  return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.cost - b.cost;
}

function itemsFor(tab: ShopTab): ShopItem[] {
  if (tab === 'avatars') return [...AVATARS].sort(byRarityThenCost);
  if (tab === 'frames') return [...FRAMES].sort(byRarityThenCost);
  if (tab === 'nameEffects') return [...NAME_EFFECTS].sort(byRarityThenCost);
  if (tab === 'soundPacks') return [...SOUND_PACKS].sort(byRarityThenCost);
  if (tab === 'taunts') return [...TAUNTS].sort(byRarityThenCost);
  // Secret titles are invisible until owned (see checkAchievements in state.ts) — once granted
  // they need to appear here like any other title, or they'd be permanently unequippable.
  const ownedSecrets = SECRET_TITLES.filter((t) => profile?.unlockedTitles.includes(t.id));
  return [...TITLES, ...ownedSecrets].sort(byRarityThenCost);
}

function ownedIds(tab: ShopTab): string[] {
  if (!profile) return [];
  if (tab === 'avatars') return profile.unlockedAvatars;
  if (tab === 'frames') return profile.unlockedFrames;
  if (tab === 'nameEffects') return profile.unlockedNameEffects;
  if (tab === 'soundPacks') return profile.unlockedSoundPacks;
  if (tab === 'taunts') return profile.unlockedTaunts;
  return profile.unlockedTitles;
}

function equippedId(tab: ShopTab): string | null {
  if (!profile) return null;
  if (tab === 'avatars') return profile.equippedAvatar;
  if (tab === 'frames') return profile.equippedFrame;
  if (tab === 'nameEffects') return profile.equippedNameEffect;
  if (tab === 'soundPacks') return profile.equippedSoundPack;
  if (tab === 'taunts') return profile.equippedTaunt;
  return profile.equippedTitle;
}

function displayName(item: ShopItem): string {
  if ('label' in item) return item.label;
  if ('text' in item) return item.text;
  return item.name;
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

      <div class="tabs shop-tabs" style="margin-top:18px">
        <button class="tab-btn ${shopTab === 'avatars' ? 'active' : ''}" data-tab="avatars">AVATARER</button>
        <button class="tab-btn ${shopTab === 'frames' ? 'active' : ''}" data-tab="frames">RAMMER</button>
        <button class="tab-btn ${shopTab === 'titles' ? 'active' : ''}" data-tab="titles">TITLER</button>
        <button class="tab-btn ${shopTab === 'nameEffects' ? 'active' : ''}" data-tab="nameEffects">NAVNE</button>
        <button class="tab-btn ${shopTab === 'soundPacks' ? 'active' : ''}" data-tab="soundPacks">LYDE</button>
        <button class="tab-btn ${shopTab === 'taunts' ? 'active' : ''}" data-tab="taunts">TAUNTS</button>
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
    <span class="shop-legendary-hint">${myLegendarySlots > legendarySpent ? 'Du har et ledigt slot, vælg en legendary nedenfor!' : 'Slut en uge som nr. 1 i 4+ spil for at optjene et nyt slot'}</span>
    <a class="shop-legendary-hint" href="#/guide" data-nav="guide" style="text-decoration:underline;cursor:pointer">Læs mere om hvordan det virker →</a>
  `;
}

/** Small thumbnail for the "next up" teaser card — image-based items use their own asset;
 * text/description-based items (name effects, sound packs, taunts) get a representative preview
 * instead since they have no art asset. */
function nextThumbHtml(item: ShopItem, tab: ShopTab): string {
  if ('asset' in item) return `<img src="${item.asset}" alt="" class="shop-next-thumb">`;
  if (tab === 'nameEffects') return `<span class="${(item as NameEffectDef).cssClass}" style="font-size:15px">Aa</span>`;
  if (tab === 'soundPacks') return '🔊';
  return '💬';
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
      <div class="shop-next-emoji">${nextThumbHtml(next, shopTab)}</div>
      <div class="shop-next-body">
        <div class="shop-next-label">NÆSTE: "${displayName(next)}"</div>
        <div class="shop-next-cost mono">${next.cost - balance} XP mangler</div>
      </div>
    </div>
  `;
}

const RARITY_LABEL: Record<string, string> = { common: 'COMMON', rare: 'RARE', epic: 'EPIC', legendary: 'LEGENDARY', secret: '???' };

/** Card/reveal media for a given item — the visual identity varies by tab since not every
 * category has an art asset (name effects/sound packs/taunts are pure text). `size` only matters
 * for the frames tab (composited avatar preview); everything else sizes via CSS. */
function mediaHtmlFor(item: ShopItem, tab: ShopTab, size: number): string {
  if (tab === 'titles') return `<img src="${(item as TitleDef).asset}" alt="${displayName(item)}" class="shop-title-thumb">`;
  if (tab === 'frames') return avatarFrameHtml(profile!.name, profile!.equippedAvatar, item.id, size);
  if (tab === 'avatars') return `<img src="${(item as AvatarDef).asset}" alt="${displayName(item)}" class="shop-item-thumb">`;
  if (tab === 'nameEffects') return `<span class="${(item as NameEffectDef).cssClass} shop-nameeffect-preview">${displayName(item)}</span>`;
  if (tab === 'soundPacks') return `<div class="shop-soundpack-preview"><span class="shop-soundpack-icon">🔊</span><span class="shop-soundpack-desc">${(item as SoundPackDef).desc}</span></div>`;
  return `<div class="shop-taunt-preview">&ldquo;${(item as TauntDef).text}&rdquo;</div>`;
}

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
  const cardClass = ROW_STYLE_TABS.includes(tab) ? 'shop-title-card' : 'shop-avatar-card';
  const media = mediaHtmlFor(item, tab, 44);
  return `
    <button class="${cardClass} rarity-${item.rarity} ${equipped ? 'equipped' : ''} ${!owned && !affordable ? 'unaffordable' : ''} ${gate ? 'level-locked' : ''}" data-item-id="${item.id}">
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
      <span>✨ ${profile.unlockedNameEffects.length} / ${NAME_EFFECTS.length} navne</span>
      <span>🔊 ${profile.unlockedSoundPacks.length} / ${SOUND_PACKS.length} lyde</span>
      <span>💬 ${profile.unlockedTaunts.length} / ${TAUNTS.length} taunts</span>
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
  grid.className = ROW_STYLE_TABS.includes(shopTab) ? 'shop-title-grid' : 'shop-avatar-grid';
  grid.innerHTML = itemsFor(shopTab)
    .map((it) => itemCardHtml(it, shopTab))
    .join('');
  grid.querySelectorAll<HTMLElement>('[data-item-id]').forEach((el) => {
    el.addEventListener('click', () => handleTap(shopTab, el.dataset.itemId!));
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
      <div class="purchase-media">${mediaHtmlFor(item, tab, 168)}</div>
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
    else if (tab === 'titles') profile.equippedTitle = profile.equippedTitle === id ? null : id;
    else if (tab === 'nameEffects') profile.equippedNameEffect = profile.equippedNameEffect === id ? null : id;
    else if (tab === 'soundPacks') {
      profile.equippedSoundPack = profile.equippedSoundPack === id ? null : id;
      Sound.setPack(profile.equippedSoundPack);
    } else profile.equippedTaunt = profile.equippedTaunt === id ? null : id;
    Sound.click();
  } else {
    const gate = gateReason(def);
    if (gate) {
      const owned = ownedLegendaryCount();
      toast(
        def.rarity === 'legendary'
          ? def.requiresOwnedLegendary && owned < def.requiresOwnedLegendary
            ? `Kræver ${def.requiresOwnedLegendary} andre ejede legendary ting, du har ${owned}`
            : myLegendarySlots === 0
              ? 'Legendary kræver mindst 1 uge som nr. 1 i 4+ forskellige spil'
              : `Ingen ledige legendary-slots, du har brugt alle ${myLegendarySlots}`
          : `Låst op ved level ${def.unlockLevel}, du er level ${myLevel()}`,
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
    } else if (tab === 'titles') {
      profile.unlockedTitles.push(id);
      profile.equippedTitle = id;
    } else if (tab === 'nameEffects') {
      profile.unlockedNameEffects.push(id);
      profile.equippedNameEffect = id;
    } else if (tab === 'soundPacks') {
      profile.unlockedSoundPacks.push(id);
      profile.equippedSoundPack = id;
      Sound.setPack(id);
    } else {
      profile.unlockedTaunts.push(id);
      profile.equippedTaunt = id;
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
