let vault = JSON.parse(localStorage.getItem('clipvault') || '[]');

document.addEventListener('DOMContentLoaded', render);

function addClip() {
  const url = document.getElementById('linkInput').value.trim();
  const name = document.getElementById('nameInput').value.trim() || 'Untitled Clip';

  if (!url) { alert('Paste a Google Drive link first!'); return; }

  // Extract Google Drive file ID
  let id = null;
  if (url.includes('/d/')) {
    id = url.split('/d/')[1].split('/')[0].split('?')[0];
  } else if (url.includes('id=')) {
    id = url.split('id=')[1].split('&')[0];
  }

  if (!id) { alert('Not a valid Google Drive link. Make sure you copied the Share link!'); return; }

  vault.unshift({ id: Date.now(), driveId: id, name });
  save();

  document.getElementById('linkInput').value = '';
  document.getElementById('nameInput').value = '';
}

function save() {
  localStorage.setItem('clipvault', JSON.stringify(vault));
  render();
}

function render() {
  const grid = document.getElementById('videoGrid');
  const count = document.getElementById('clipCount');
  count.textContent = `${vault.length} clip${vault.length !== 1 ? 's' : ''}`;

  if (vault.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div>🎬</div>
        <p>No clips yet. Paste a Google Drive link above!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = '';
  vault.forEach(clip => {
    const card = document.createElement('div');
    card.className = 'video-card';

    const thumb = `https://drive.google.com/thumbnail?id=${clip.driveId}&sz=w400`;

    card.innerHTML = `
      <div class="thumb-wrap">
        <img src="${thumb}" alt="${clip.name}" onerror="this.style.display='none'">
        <div class="play-overlay">
          <div class="play-btn">▶</div>
        </div>
      </div>
      <div class="card-info">
        <div class="clip-name">${clip.name}</div>
        <button class="delete-btn" onclick="event.stopPropagation(); removeClip(${clip.id})">🗑</button>
      </div>
    `;

    card.addEventListener('click', () => play(clip));
    grid.appendChild(card);
  });
}

function play(clip) {
  const modal = document.getElementById('playerModal');
  const container = document.getElementById('playerContainer');

  document.getElementById('playerTitle').textContent = clip.name;
  container.innerHTML = `<iframe src="https://drive.google.com/file/d/${clip.driveId}/preview" allow="autoplay" allowfullscreen></iframe>`;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePlayer() {
  document.getElementById('playerModal').style.display = 'none';
  document.getElementById('playerContainer').innerHTML = '';
  document.body.style.overflow = '';
}

function removeClip(id) {
  if (!confirm('Remove this clip from vault?')) return;
  vault = vault.filter(c => c.id !== id);
  save();
}

function exportVault() {
  if (vault.length === 0) { alert('No clips to export!'); return; }
  const code = btoa(JSON.stringify(vault));
  navigator.clipboard.writeText(code).then(() => {
    alert('✅ Sync code copied! Paste it on your iPhone using Import Sync Code.');
  }).catch(() => {
    prompt('Copy this sync code manually:', code);
  });
}

function importVault() {
  const code = prompt('Paste your Sync Code here:');
  if (!code) return;
  try {
    const data = JSON.parse(atob(code.trim()));
    if (!Array.isArray(data)) throw new Error();
    vault = data;
    save();
    alert(`✅ Imported ${vault.length} clips!`);
  } catch {
    alert('❌ Invalid sync code. Try copying it again.');
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePlayer();
});
