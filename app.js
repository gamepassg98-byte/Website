const API_BASE = '';
let videos = [];

document.addEventListener('DOMContentLoaded', () => {
  loadVideos();
  setupDragDrop();
  setupFileInput();
});

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
    if (files.length > 0) {
      uploadFiles(files);
    } else {
      alert('Drop video files only!');
    }
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

async function uploadFiles(files) {
  const progressArea = document.getElementById('uploadProgress');

  for (const file of files) {
    const id = 'upload-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const sizeStr = formatSize(file.size);

    const progressHTML = `
      <div class="progress-item" id="${id}">
        <div class="progress-header">
          <div class="filename">📎 ${file.name}</div>
          <div class="progress-pct" id="${id}-pct">0%</div>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="${id}-bar"></div>
        </div>
        <div class="progress-details">
          <span class="status" id="${id}-status">Preparing upload...</span>
          <span class="size-info" id="${id}-size">0 B / ${sizeStr}</span>
        </div>
        <div class="progress-speed" id="${id}-speed"></div>
      </div>
    `;
    progressArea.insertAdjacentHTML('afterbegin', progressHTML);

    try {
      await uploadFile(file, id);
    } catch (err) {
      const bar = document.getElementById(`${id}-bar`);
      const status = document.getElementById(`${id}-status`);
      const pct = document.getElementById(`${id}-pct`);
      if (bar) bar.classList.add('error');
      if (status) status.textContent = '✗ Failed: ' + err.message;
      if (pct) { pct.textContent = 'ERROR'; pct.style.color = '#ef4444'; }
    }
  }

  setTimeout(loadVideos, 1500);
}

function uploadFile(file, id) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const bar = document.getElementById(`${id}-bar`);
    const status = document.getElementById(`${id}-status`);
    const pct = document.getElementById(`${id}-pct`);
    const sizeInfo = document.getElementById(`${id}-size`);
    const speedEl = document.getElementById(`${id}-speed`);
    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;

        let speedText = '';
        if (timeDiff > 0.5) {
          const bytesDiff = e.loaded - lastLoaded;
          const speed = bytesDiff / timeDiff;
          speedText = `⚡ ${formatSize(speed)}/s`;

          const remaining = e.total - e.loaded;
          if (speed > 0) {
            const eta = Math.round(remaining / speed);
            if (eta < 60) {
              speedText += ` · ~${eta}s left`;
            } else {
              speedText += ` · ~${Math.round(eta / 60)}m left`;
            }
          }

          lastLoaded = e.loaded;
          lastTime = now;
        }

        if (bar) bar.style.width = percent + '%';
        if (pct) pct.textContent = percent + '%';
        if (status) status.textContent = percent < 100 ? 'Uploading...' : 'Processing...';
        if (sizeInfo) sizeInfo.textContent = `${formatSize(e.loaded)} / ${formatSize(e.total)}`;
        if (speedEl && speedText) speedEl.textContent = speedText;
      }
    });

    xhr.addEventListener('load', () => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (xhr.status === 200) {
        if (bar) { bar.style.width = '100%'; bar.classList.add('done'); }
        if (pct) { pct.textContent = '✓'; pct.style.color = '#22c55e'; }
        if (status) status.textContent = `✓ Done in ${elapsed}s`;
        if (speedEl) speedEl.textContent = '';
        if (sizeInfo) sizeInfo.textContent = formatSize(file.size);
        resolve();
      } else {
        let msg = 'Upload failed';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch(e) {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error - check connection')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.open('POST', `${API_BASE}/api/upload`);
    xhr.setRequestHeader('x-filename', file.name);
    xhr.send(file);
  });
}

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
    grid.innerHTML = `<div class="loading">Failed to load: ${err.message}</div>`;
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

  player.src = video.url;
  player.load();
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
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

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePlayer();
});

async function deleteVideo(url) {
  if (!confirm('Delete this clip?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  return name
    .replace(/^\d+-/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/_/g, ' ');
}
