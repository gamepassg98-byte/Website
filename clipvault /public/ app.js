// ==========================================
// ClipVault - Main App Logic
// ==========================================

const API_BASE = '';
let videos = [];

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  loadSavedPassword();
  loadVideos();
  setupDragDrop();
  setupFileInput();
});

// ---- Password ----
function loadSavedPassword() {
  const saved = localStorage.getItem('clipvault_password');
  if (saved) {
    document.getElementById('uploadPassword').value = saved;
  }
}

function rememberPassword() {
  const pw = document.getElementById('uploadPassword').value;
  if (pw) {
    localStorage.setItem('clipvault_password', pw);
    flashButton('rememberBtn', '✓ Saved');
  }
}

function getPassword() {
  return document.getElementById('uploadPassword').value;
}

// ---- Drag & Drop ----
function setupDragDrop() {
  const dropZone = document.getElementById('dropZone');

  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
    if (files.length > 0) uploadFiles(files);
  });

  dropZone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') {
      document.getElementById('fileInput').click();
    }
  });
}

function setupFileInput() {
  document.getElementById('fileInput').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) uploadFiles(files);
    e.target.value = '';
  });
}

// ---- Upload ----
async function uploadFiles(files) {
  const password = getPassword();
  if (!password) {
    alert('Enter the upload password first!');
    return;
  }

  const progressArea = document.getElementById('uploadProgress');
  progressArea.style.display = 'block';

  for (const file of files) {
    const id = 'upload-' + Date.now() + Math.random();
    const sizeStr = formatSize(file.size);

    progressArea.innerHTML += `
      <div class="progress-item" id="${id}">
        <div class="filename">${file.name} (${sizeStr})</div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="${id}-bar"></div>
        </div>
        <div class="status" id="${id}-status">Starting upload...</div>
      </div>
    `;

    try {
      await uploadFile(file, password, id);
    } catch (err) {
      const bar = document.getElementById(`${id}-bar`);
      const status = document.getElementById(`${id}-status`);
      if (bar) bar.classList.add('error');
      if (status) status.textContent = '✗ ' + err.message;
    }
  }

  // Refresh the video list
  setTimeout(loadVideos, 1000);
}

function uploadFile(file, password, id) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const bar = document.getElementById(`${id}-bar`);
    const status = document.getElementById(`${id}-status`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        if (bar) bar.style.width = pct + '%';
        if (status) status.textContent = `Uploading... ${pct}% (${formatSize(e.loaded)} / ${formatSize(e.total)})`;
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        if (bar) { bar.style.width = '100%'; bar.classList.add('done'); }
        if (status) status.textContent = '✓ Uploaded successfully!';
        resolve();
      } else {
        let msg = 'Upload failed';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch(e) {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Aborted')));

    xhr.open('POST', `${API_BASE}/api/upload`);
    xhr.setRequestHeader('x-filename', file.name);
    xhr.setRequestHeader('x-password', password);
    xhr.send(file);
  });
}

// ---- Load Videos ----
async function loadVideos() {
  const grid = document.getElementById('videoGrid');
  grid.innerHTML = '<div class="loading">Loading clips...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/videos`);
    const data = await res.json();
    videos = data.videos || [];

    if (videos.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🎬</div>
          <p>No clips yet. Upload some videos!</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    videos.forEach((video, index) => {
      const card = createVideoCard(video, index);
      grid.appendChild(card);
    });

  } catch (err) {
    grid.innerHTML = `<div class="loading">Failed to load videos: ${err.message}</div>`;
  }
}

function createVideoCard(video, index) {
  const card = document.createElement('div');
  card.className = 'video-card';
  card.style.animationDelay = `${index * 0.05}s`;

  const displayName = cleanFilename(video.filename);
  const sizeStr = formatSize(video.size);
  const dateStr = formatDate(video.uploaded);

  card.innerHTML = `
    <div class="video-thumb">
      <video src="${video.url}#t=1" muted preload="metadata" playsinline></video>
      <div class="play-overlay">
        <div class="play-btn">▶</div>
      </div>
    </div>
    <div class="video-info">
      <div class="name" title="${displayName}">${displayName}</div>
      <div class="meta">
        <span>${sizeStr} · ${dateStr}</span>
        <button class="delete-btn" onclick="event.stopPropagation(); deleteVideo('${video.url}')" title="Delete">🗑</button>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openPlayer(video));

  return card;
}

// ---- Player ----
function openPlayer(video) {
  const modal = document.getElementById('playerModal');
  const player = document.getElementById('videoPlayer');
  const title = document.getElementById('playerTitle');
  const download = document.getElementById('downloadLink');
  const info = document.getElementById('modalInfo');

  const displayName = cleanFilename(video.filename);

  title.textContent = displayName;
  download.href = video.url;
  download.download = video.filename;
  info.textContent = `${formatSize(video.size)} · Uploaded ${formatDate(video.uploaded)}`;

  // Set video source - direct URL means full quality, native player
  player.src = video.url;
  player.load();

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Auto play
  player.play().catch(() => {});
}

function closePlayer() {
  const modal = document.getElementById('playerModal');
  const player = document.getElementById('videoPlayer');

  player.pause();
  player.removeAttribute('src');
  player.load();

  modal.style.display = 'none';
  document.body.style.overflow = '';
}

// Close modal on escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePlayer();
});

// ---- Delete ----
async function deleteVideo(url) {
  if (!confirm('Delete this clip?')) return;

  const password = getPassword();
  if (!password) {
    alert('Enter the upload password to delete videos');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-password': password,
      },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();

    if (res.ok) {
      loadVideos();
    } else {
      alert('Delete failed: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}

// ---- Helpers ----
function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function cleanFilename(name) {
  if (!name) return 'Untitled';
  // Remove timestamp prefix and extension
  return name
    .replace(/^\d+-/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/_/g, ' ');
}

function flashButton(id, text) {
  const btn = document.getElementById(id);
  const original = btn.textContent;
  btn.textContent = text;
  btn.style.background = 'var(--success)';
  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = '';
  }, 1500);
}
