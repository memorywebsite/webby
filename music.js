/* ============================================
   Memories & Photos — background song widget
   Uses the YouTube IFrame Player API to play a
   clipped section (1:00–3:00) of a chosen video
   as background audio, with play/pause and mute
   controls. Browsers (especially Safari/iOS) block
   audio-on autoplay, so this starts muted on load
   and unmutes on the visitor's first tap/click —
   the closest thing to "plays when you open it"
   that's actually allowed.
   ============================================ */

(function () {
  "use strict";

  const VIDEO_ID = "l5NQx0Ze6Mk";
  const CLIP_START = 60;   // 1:00
  const CLIP_END = 180;    // 3:00

  const els = {
    toggleBtn: document.getElementById("music-toggle"),
    muteBtn: document.getElementById("music-mute"),
    widget: document.getElementById("music-widget"),
  };

  let player = null;
  let isReady = false;
  let userPaused = false;
  let hasUnlockedAudio = false;
  let watcher = null;

  function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) {
      createPlayer();
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = createPlayer;
  }

  function createPlayer() {
    player = new YT.Player("music-player", {
      videoId: VIDEO_ID,
      playerVars: {
        start: CLIP_START,
        end: CLIP_END,
        autoplay: 1,
        mute: 1,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        fs: 0,
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  }

  function onPlayerReady() {
    isReady = true;
    player.mute();
    player.seekTo(CLIP_START, true);
    player.playVideo();
    updateIcons();
    startRangeWatcher();
  }

  function onPlayerStateChange(e) {
    // If the clip reaches the natural end of the embed (YT sometimes
    // ignores `end` right after a seek), loop it back to the start.
    if (e.data === YT.PlayerState.ENDED) {
      player.seekTo(CLIP_START, true);
      if (!userPaused) player.playVideo();
    }
    updateIcons();
  }

  // Poll current time so the clip loops within 1:00–3:00 even when
  // the `end` param doesn't catch it (happens after seeking/muting).
  function startRangeWatcher() {
    if (watcher) return;
    watcher = setInterval(() => {
      if (!isReady || !player.getCurrentTime) return;
      const t = player.getCurrentTime();
      if (t >= CLIP_END || t < CLIP_START - 1) {
        player.seekTo(CLIP_START, true);
      }
    }, 1000);
  }

  // First tap/click anywhere on the page: unlock real audio.
  function unlockAudio() {
    if (hasUnlockedAudio || !isReady) return;
    hasUnlockedAudio = true;
    if (!userPaused) {
      player.unMute();
      player.playVideo();
    }
    updateIcons();
  }

  function updateIcons() {
    if (!isReady) return;
    const muted = player.isMuted();
    const state = player.getPlayerState();
    const playing = state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING;

    els.toggleBtn.innerHTML = playing ? iconPause() : iconPlay();
    els.toggleBtn.setAttribute("aria-label", playing ? "Pause song" : "Play song");

    els.muteBtn.innerHTML = muted ? iconMuted() : iconUnmuted();
    els.muteBtn.setAttribute("aria-label", muted ? "Unmute song" : "Mute song");
    els.muteBtn.classList.toggle("is-muted", muted);
  }

  function togglePlay() {
    if (!isReady) return;
    hasUnlockedAudio = true;
    const state = player.getPlayerState();
    const playing = state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING;
    if (playing) {
      userPaused = true;
      player.pauseVideo();
    } else {
      userPaused = false;
      player.playVideo();
    }
    setTimeout(updateIcons, 80);
  }

  function toggleMute() {
    if (!isReady) return;
    hasUnlockedAudio = true;
    if (player.isMuted()) {
      player.unMute();
    } else {
      player.mute();
    }
    setTimeout(updateIcons, 80);
  }

  function iconPlay() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  }
  function iconPause() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
  }
  function iconUnmuted() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>';
  }
  function iconMuted() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M19 9l-4 4m0-4l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>';
  }

  els.toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePlay();
  });
  els.muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMute();
  });

  ["click", "touchend", "keydown"].forEach((evt) => {
    document.addEventListener(evt, unlockAudio, { once: false, passive: true });
  });

  loadYouTubeAPI();
})();
