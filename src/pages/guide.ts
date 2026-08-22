interface GuideSection {
  icon: string;
  title: string;
  body: string;
}

const SECTIONS: GuideSection[] = [
  {
    icon: '✦',
    title: 'XP & Level',
    body: 'Du optjener XP hver gang du spiller en runde, mere for en ny personlig rekord, endnu mere for en top 3-placering. XP hæver dit level (vist i headeren) og lægges samtidig til din butiks-saldo, som du bruger til at købe cosmetics for.',
  },
  {
    icon: '🔥',
    title: 'Daglig stime',
    body: 'Spil mindst én runde hver dag for at holde din stime i live, den vises som en lille ildchip i headeren. Ved 3, 7, 14 og 30 dage får du en engangsbonus i XP.',
  },
  {
    icon: '🎯',
    title: 'Dagens udfordring',
    body: 'Hver dag er der én konkret udfordring i et bestemt spil, vist på forsiden. Gennemfør den for en ekstra XP-bonus, oveni det du normalt ville få.',
  },
  {
    icon: '🏅',
    title: 'Bedrifter & Badges',
    body: 'Bedrifter er specifikke mål i hvert spil (fx "20+ hits i Aim Trainer"), de giver XP med det samme, du låser dem op. Badges er lidt bredere medaljer (fx "spil 50 runder i alt") og findes på din profil.',
  },
  {
    icon: '🎭',
    title: 'Butikken: avatarer, rammer & titler',
    body: 'Alt i butikken har en sjældenhed: common, rare, epic eller legendary. Common/rare koster kun XP. Epic kræver også et bestemt level. Legendary er en helt anden sag, se nedenfor.',
  },
  {
    icon: '🏆',
    title: 'Leaderboard: denne uge & all-time',
    body: 'Hvert spils leaderboard nulstilles automatisk hver søndag ("DENNE UGE"-fanen), så der altid er en frisk konkurrence, uanset hvor længe du har spillet. "ALL-TIME"-fanen viser stadig din bedste nogensinde.',
  },
  {
    icon: '⭐',
    title: 'Mod Legendary',
    body: 'Denne fane viser live, hvem der lige nu er #1 i hvor mange forskellige spil i den igangværende uge, så du kan følge med i din egen (eller andres) vej mod et legendary-slot, mens ugen stadig kører.',
  },
  {
    icon: '👑',
    title: 'Hall of Fame',
    body: 'Slutter du en uge som #1 i et spil, tæller det som en sejr i Hall of Fame, synligt på leaderboardets sidste fane. Sejre tæller på tværs af alle spil og uger.',
  },
  {
    icon: '🔓',
    title: 'Legendary: sådan låser du op',
    body: 'Legendary avatarer, rammer og titler kan IKKE bare købes for XP, uanset hvor meget du har. Du skal først optjene et "slot": slut en uge som #1 i mindst 4 forskellige spil på samme tid. Hvert slot lader dig vælge præcis én legendary ting i butikken, resten venter til din næste store uge.',
  },
];

export function renderGuide(): void {
  const main = document.getElementById('main')!;
  main.innerHTML = `
    <div class="page">
      <div class="section-label">Hjælp</div>
      <h1 class="section-title">Sådan virker det</h1>
      <div class="guide-list">
        ${SECTIONS.map(
          (s) => `
          <div class="panel guide-section">
            <div class="guide-icon">${s.icon}</div>
            <div>
              <h2 class="guide-title">${s.title}</h2>
              <div class="guide-body">${s.body}</div>
            </div>
          </div>
        `,
        ).join('')}
      </div>
    </div>
  `;
}
