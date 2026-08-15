import { profile, saveProfile } from '../state';
import { refreshHeader } from '../header';
import { toast } from '../toast';
import { Sound } from '../sound';
import { Haptics } from '../haptics';
import { AVATARS, TITLES, type AvatarDef, type TitleDef } from '../shop';

let shopTab: 'avatars' | 'titles' = 'avatars';

export async function renderShop(): Promise<void> {
  const main = document.getElementById('main')!;
  if (!profile) return;
  main.innerHTML = `
    <div class="page">
      <div class="section-label">Brug din XP</div>
      <div class="section-title">Butik</div>

      <div class="shop-balance">
        <div class="shop-balance-label">DIN SALDO</div>
        <div class="shop-balance-value">✦ ${profile.xpBalance} XP</div>
      </div>

      <div class="tabs" style="margin-top:18px">
        <button class="tab-btn ${shopTab === 'avatars' ? 'active' : ''}" data-tab="avatars">AVATARER</button>
        <button class="tab-btn ${shopTab === 'titles' ? 'active' : ''}" data-tab="titles">TITLER</button>
      </div>

      <div id="shopGrid"></div>
    </div>
  `;
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => {
    b.addEventListener('click', () => {
      shopTab = b.dataset.tab as 'avatars' | 'titles';
      renderShop();
    });
  });
  renderGrid();
}

function renderGrid(): void {
  const grid = document.getElementById('shopGrid');
  if (!grid || !profile) return;
  if (shopTab === 'avatars') {
    grid.className = 'shop-avatar-grid';
    grid.innerHTML = AVATARS.map((a) => avatarCardHtml(a)).join('');
    grid.querySelectorAll<HTMLElement>('[data-avatar]').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        if (!(e as PointerEvent).isPrimary) return;
        e.preventDefault();
        handleAvatarTap(el.dataset.avatar!);
      });
    });
  } else {
    grid.className = 'shop-title-grid';
    grid.innerHTML = TITLES.map((t) => titleCardHtml(t)).join('');
    grid.querySelectorAll<HTMLElement>('[data-title]').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        if (!(e as PointerEvent).isPrimary) return;
        e.preventDefault();
        handleTitleTap(el.dataset.title!);
      });
    });
  }
}

function avatarCardHtml(a: AvatarDef): string {
  const owned = profile!.unlockedAvatars.includes(a.id);
  const equipped = profile!.equippedAvatar === a.id;
  const affordable = profile!.xpBalance >= a.cost;
  return `
    <button class="shop-avatar-card ${equipped ? 'equipped' : ''} ${!owned && !affordable ? 'unaffordable' : ''}" data-avatar="${a.id}">
      <div class="shop-avatar-emoji">${a.emoji}</div>
      ${equipped ? '<div class="shop-equipped-tag">TAGET PÅ</div>' : owned ? '<div class="shop-owned-tag">EJET</div>' : `<div class="shop-cost-tag">✦ ${a.cost}</div>`}
    </button>
  `;
}

function titleCardHtml(t: TitleDef): string {
  const owned = profile!.unlockedTitles.includes(t.id);
  const equipped = profile!.equippedTitle === t.id;
  const affordable = profile!.xpBalance >= t.cost;
  return `
    <button class="shop-title-card ${equipped ? 'equipped' : ''} ${!owned && !affordable ? 'unaffordable' : ''}" data-title="${t.id}">
      <div class="shop-title-label">${t.label}</div>
      ${equipped ? '<div class="shop-equipped-tag">TAGET PÅ</div>' : owned ? '<div class="shop-owned-tag">EJET</div>' : `<div class="shop-cost-tag">✦ ${t.cost}</div>`}
    </button>
  `;
}

async function handleAvatarTap(id: string): Promise<void> {
  if (!profile) return;
  const def = AVATARS.find((a) => a.id === id);
  if (!def) return;
  const owned = profile.unlockedAvatars.includes(id);
  if (owned) {
    profile.equippedAvatar = profile.equippedAvatar === id ? null : id;
    Sound.click();
  } else {
    if (profile.xpBalance < def.cost) {
      toast('Ikke nok XP til den her avatar endnu');
      return;
    }
    profile.xpBalance -= def.cost;
    profile.unlockedAvatars.push(id);
    profile.equippedAvatar = id;
    Sound.pb();
    Haptics.personalBest();
    toast(`${def.emoji} Avatar låst op og taget på`);
  }
  await saveProfile();
  refreshHeader();
  renderGrid();
}

async function handleTitleTap(id: string): Promise<void> {
  if (!profile) return;
  const def = TITLES.find((t) => t.id === id);
  if (!def) return;
  const owned = profile.unlockedTitles.includes(id);
  if (owned) {
    profile.equippedTitle = profile.equippedTitle === id ? null : id;
    Sound.click();
  } else {
    if (profile.xpBalance < def.cost) {
      toast('Ikke nok XP til den her titel endnu');
      return;
    }
    profile.xpBalance -= def.cost;
    profile.unlockedTitles.push(id);
    profile.equippedTitle = id;
    Sound.pb();
    Haptics.personalBest();
    toast(`"${def.label}" låst op og taget på`);
  }
  await saveProfile();
  refreshHeader();
  renderGrid();
}
