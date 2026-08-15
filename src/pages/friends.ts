export function renderFriends(): void {
  const main = document.getElementById('main')!;
  main.innerHTML = `
    <div class="page">
      <div class="section-label">Din kreds</div>
      <div class="section-title">Venner</div>
      <div class="panel" style="text-align:center;padding:48px 24px;display:flex;flex-direction:column;align-items:center;gap:10px">
        <div style="font-size:32px">🤝</div>
        <div class="featured-title" style="font-size:20px">Venner kommer snart</div>
        <p style="color:var(--text-dim);font-size:13.5px;max-width:340px">Følg venner, se hvem der lige har slået din rekord, og udfordr dem direkte. Under udvikling.</p>
      </div>
    </div>
  `;
}
