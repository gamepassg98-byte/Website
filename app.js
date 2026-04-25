const API_BASE = '';
let videos = [];

document.addEventListener('DOMContentLoaded', () => {
  loadSavedPassword();
  loadVideos();
  setupDragDrop();
  setupFileInput();
});

function loadSavedPassword() {
  const saved = localStorage.getItem('clipvault_password');
  if (saved) document.getElementById('uploadPassword').value = saved;
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
  const info = 
