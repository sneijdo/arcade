export const MOCK_LEADERBOARD = [
  { id: 'm1', name: 'Anders', score: 142 },
  { id: 'm2', name: 'Mikkel', score: 157 },
  { id: 'm3', name: 'Sofie', score: 171 },
  { id: 'm4', name: 'Jonas', score: 198 },
  { id: 'm5', name: 'Freja', score: 205 },
  { id: 'm6', name: 'Emil', score: 223 },
  { id: 'm7', name: 'Ida', score: 241 },
];

export const MOCK_FRIENDS = [
  { name: 'Anders', online: true, best: 142 },
  { name: 'Mikkel', online: true, best: 157 },
  { name: 'Sofie', online: false, best: 171 },
  { name: 'Jonas', online: false, best: 198 },
];

export const MOCK_FEED = [
  { icon: '🟢', html: '<b>Mikkel</b> just played Reaction', time: '2m' },
  { icon: '🏆', html: '<b>Anders</b> beat your score in Reaction', time: '14m' },
  { icon: '🔥', html: '<b>Sofie</b> is on a 3-day streak', time: '1h' },
  { icon: '⚡', html: '<b>Jonas</b> hit a new personal best — 178ms', time: '3h' },
];
