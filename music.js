/* ============================================
   Memories & Photos — background song widget
   Uses the YouTube IFrame Player API to play the
   full song as background audio, with play/pause,
   mute, and a YouTube-style scrub bar.

   Autoplay note: no browser (Safari, Chrome, Firefox,
   or in-app browsers like Instagram/TikTok/Facebook)
   allows audio to autoplay WITH SOUND — that's a
   platform-level rule that can't be coded around. The
   only autoplay every browser allows is MUTED autoplay.
   So this widget starts muted the instant the page
   loads (so something is always already playing), then
   unmutes automatically on the visitor's very first
   tap/scroll/click/keypress anywhere on the page — which
   in practice feels instant. This is the same trick
   Instagram/TikTok themselves use for video autoplay.
   ============================================ */

(function () {
  "use strict";

  const VIDEO_ID = "l5NQx0Ze6Mk";

  const els = {
    toggleBtn: document.getElementById("music-toggle"),
    muteBtn: document.getElementById("music-mute"),
    widget: document.getElementById("music-widget"),
    seek: document.getElementById("music-seek"),
    time: document.getElementById("music-time"),
    title: document.getElementById("music-title"),
  };

  const SEEK_MAX = 1000; // slider resolution (steps), independent of song length

  let player = null;
  let isReady = false;
  let userPaused = false;
  let hasUnlockedAudio = false;
  let duration = 0;
  let isScrubbing = false;
  let progressTimer = null;
  let retryTimer = null;

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
        autoplay: 1,
        mute: 1,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        playsinline: 1, // required so iOS Safari plays inline instead of blocking/fullscreening
        rel: 0,
        fs: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
        onError: onPlayerError,
      },
    });
  }

  function onPlayerReady() {
    isReady = true;
    duration = player.getDuration() || 0;
    player.mute();
    player.playVideo();
    updateIcons();
    loadSongTitle();
    startProgressLoop();
    startAutoplayWatchdog();
  }

  // Pull the real song title so it's never hardcoded / out of sync with
  // VIDEO_ID. Try the player's own metadata first (instant, no network);
  // fall back to YouTube's public oEmbed endpoint if that's not filled
  // in yet (happens on some slower connections/in-app browsers).
  function loadSongTitle() {
    if (!els.title) return;
    try {
      const data = player.getVideoData && player.getVideoData();
      if (data && data.title) {
        els.title.textContent = data.title;
        return;
      }
    } catch (e) {
      /* ignore, fall through to oEmbed */
    }
    fetch(
      "https://www.youtube.com/oembed?url=" +
        encodeURIComponent("https://www.youtube.com/watch?v=" + VIDEO_ID) +
        "&format=json"
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && json.title) els.title.textContent = json.title;
      })
      .catch(() => {
        /* leave title blank rather than show an error */
      });
  }

  function onPlayerError() {
    // Retry once in case of a transient embed hiccup (common in some
    // in-app browsers on first load).
    setTimeout(() => {
      if (player && player.playVideo) player.playVideo();
    }, 1000);
  }

  function onPlayerStateChange(e) {
    if (!duration) duration = player.getDuration() || duration;
    // Loop the full song when it ends, unless the user paused it.
    if (e.data === YT.PlayerState.ENDED) {
      player.seekTo(0, true);
      if (!userPaused) player.playVideo();
    }
    updateIcons();
  }

  // Some in-app / embedded browsers (Instagram, TikTok, Facebook, etc.)
  // silently ignore the autoplay param even when muted. This watchdog
  // keeps nudging playVideo() until it actually catches, without
  // fighting the user if they've deliberately paused.
  function startAutoplayWatchdog() {
    let attempts = 0;
    retryTimer = setInterval(() => {
      attempts++;
      if (!isReady || userPaused || attempts > 15) {
        clearInterval(retryTimer);
        return;
      }
      const state = player.getPlayerState();
      const playing = state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING;
      if (!playing) {
        player.mute();
        player.playVideo();
      } else {
        clearInterval(retryTimer);
      }
    }, 800);
  }

  // Keep the scrub bar + time display in sync with playback.
  function startProgressLoop() {
    if (progressTimer) return;
    progressTimer = setInterval(() => {
      if (!isReady || isScrubbing || !player.getCurrentTime) return;
      if (!duration) duration = player.getDuration() || 0;
      const current = player.getCurrentTime() || 0;
      renderProgress(current, duration);
    }, 250);
  }

  function renderProgress(current, total) {
    const pct = total > 0 ? Math.min(1, current / total) : 0;
    if (els.seek && !isScrubbing) {
      els.seek.value = String(Math.round(pct * SEEK_MAX));
      els.seek.style.setProperty("--seek-pct", (pct * 100).toFixed(2) + "%");
    }
    if (els.time) {
      els.time.textContent = formatTime(current) + " / " + formatTime(total);
    }
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  // First tap/click/scroll/keypress anywhere on the page: unlock real audio.
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
      player.unMute();
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

  // --- Scrub bar handlers ---
  function onSeekInput() {
    // Live-update the time label and fill while dragging, without
    // spamming seekTo on every pixel of drag.
    isScrubbing = true;
    if (!duration) duration = player.getDuration() || 0;
    const pct = Number(els.seek.value) / SEEK_MAX;
    const target = pct * duration;
    els.seek.style.setProperty("--seek-pct", (pct * 100).toFixed(2) + "%");
    if (els.time) els.time.textContent = formatTime(target) + " / " + formatTime(duration);
  }

  function onSeekCommit() {
    if (!isReady) {
      isScrubbing = false;
      return;
    }
    hasUnlockedAudio = true;
    if (!duration) duration = player.getDuration() || 0;
    const pct = Number(els.seek.value) / SEEK_MAX;
    const target = pct * duration;
    player.seekTo(target, true);
    player.unMute();
    if (!userPaused) player.playVideo();
    isScrubbing = false;
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

  if (els.seek) {
    els.seek.addEventListener("input", (e) => {
      e.stopPropagation();
      onSeekInput();
    });
    els.seek.addEventListener("change", (e) => {
      e.stopPropagation();
      onSeekCommit();
    });
    // Touch devices don't always fire "change" reliably; cover touchend too.
    els.seek.addEventListener("touchend", (e) => {
      e.stopPropagation();
      onSeekCommit();
    });
    els.seek.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      isScrubbing = true;
    });
    els.seek.addEventListener("keydown", (e) => e.stopPropagation());
  }

  // Broad set of "first interaction" signals so audio unlocks as fast as
  // possible on every platform, including in-app browsers that don't
  // always fire the same event ordering as a regular mobile browser.
  ["pointerdown", "touchstart", "click", "keydown", "scroll"].forEach((evt) => {
    document.addEventListener(evt, unlockAudio, { once: false, passive: true, capture: true });
  });

  // Some in-app browsers suspend/resume playback when the page is
  // backgrounded then re-shown (e.g. switching tabs in a webview);
  // resume automatically if it wasn't the user who paused it.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isReady && !userPaused) {
      const state = player.getPlayerState();
      const playing = state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING;
      if (!playing) player.playVideo();
    }
  });

  // Instagram/Facebook's built-in in-app browser sometimes blocks audio
  // for embedded content outright, even muted-then-unmuted — a platform
  // restriction, not something JS can force past. Detect it and offer a
  // one-tap way to open the page in the visitor's real browser instead.
  function setupInAppBrowserBanner() {
    const banner = document.getElementById("iab-banner");
    const openBtn = document.getElementById("iab-open-btn");
    if (!banner || !openBtn) return;

    const ua = navigator.userAgent || "";
    const isInApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|Twitter|TikTok/i.test(ua);
    if (!isInApp) return;

    banner.classList.remove("hidden");

    openBtn.addEventListener("click", () => {
      const url = window.location.href;
      const isAndroid = /Android/i.test(ua);

      if (isAndroid) {
        // Force-launch Chrome directly via an Android intent URL.
        const stripped = url.replace(/^https?:\/\//, "");
        window.location.href =
          "intent://" + stripped + "#Intent;scheme=https;package=com.android.chrome;end";
      } else {
        // iOS in-app browsers can't be force-redirected to Safari from
        // JS, so copy the link and tell the visitor what to do with it.
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).catch(() => {});
        }
        openBtn.textContent = "Link copied — paste in Safari";
      }
    });
  }

  setupInAppBrowserBanner();
  loadYouTubeAPI();
})();
