(() => {
  const card = document.querySelector('#spotify-card');
  if (!card) return;

  const status = document.querySelector('#spotify-status');
  const title = document.querySelector('#spotify-title');
  const artist = document.querySelector('#spotify-artist');
  const cover = document.querySelector('#spotify-cover');
  const link = document.querySelector('#spotify-link');
  const endpoint = card.dataset.endpoint?.trim();
  if (!endpoint) return;

  const safeUrl = (value, host) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === host ? url.href : null;
    } catch { return null; }
  };

  const storageKey = `spotify:last-track:${endpoint}`;
  const validTrack = track => typeof track?.title === 'string' && track.title.trim()
    && typeof track?.artist === 'string' && track.artist.trim();
  let lastTrack;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (validTrack(saved)) lastTrack = saved;
  } catch { /* The card also works when browser storage is unavailable. */ }

  function showTrack(track, isPlaying = false) {
    if (!validTrack(track)) {
      status.textContent = 'Spotify';
      title.textContent = 'No recent track yet';
      artist.textContent = 'Check back later.';
      cover.replaceChildren('♫');
      link.hidden = true;
      return;
    }
    status.textContent = isPlaying ? 'Spotify · playing now' : 'Spotify · last played';
    title.textContent = track.title;
    artist.textContent = track.artist;
    const image = safeUrl(track.image, 'i.scdn.co');
    if (image) {
      const img = document.createElement('img');
      img.src = image;
      img.alt = '';
      img.loading = 'lazy';
      cover.replaceChildren(img);
    } else cover.replaceChildren('♫');
    const trackUrl = safeUrl(track.url, 'open.spotify.com');
    link.hidden = !trackUrl;
    if (trackUrl) link.href = trackUrl;
  }

  async function update() {
    if (document.hidden) return;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      let response;
      try { response = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' }); }
      finally { clearTimeout(timeout); }
      if (!response.ok) throw new Error(`Spotify endpoint: ${response.status}`);
      const data = await response.json();
      if (validTrack(data?.track)) {
        lastTrack = {
          title: data.track.title,
          artist: data.track.artist,
          image: safeUrl(data.track.image, 'i.scdn.co'),
          url: safeUrl(data.track.url, 'open.spotify.com')
        };
        try { localStorage.setItem(storageKey, JSON.stringify(lastTrack)); } catch {}
        showTrack(lastTrack, Boolean(data.isPlaying));
      } else showTrack(lastTrack);
    } catch {
      showTrack(lastTrack);
    }
  }

  if (lastTrack) showTrack(lastTrack);
  update();
  setInterval(update, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
})();
