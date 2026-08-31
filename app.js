/* ============================================
   Memories & Photos — app logic
   Uses Firebase Firestore (free "Spark" plan) to
   store posts. Images are compressed client-side
   and stored as base64 inside the Firestore
   document itself, so no paid Storage bucket is
   needed — everything runs on the free tier.
   ============================================ */

(function () {
  "use strict";

  const MAX_DIMENSION = 1000;   // longest side, px, after resize
  const JPEG_QUALITY = 0.72;
  const MAX_DOC_BYTES = 900000; // stay safely under Firestore's 1MiB doc limit
  const MAX_CAPTION_LEN = 280;
  const MAX_NAME_LEN = 40;

  const els = {
    board: document.getElementById("board"),
    empty: document.getElementById("empty-state"),
    loading: document.getElementById("loading-state"),
    status: document.getElementById("status-banner"),
    openBtn: document.getElementById("open-upload"),
    closeBtn: document.getElementById("close-upload"),
    backdrop: document.getElementById("upload-backdrop"),
    dialog: document.getElementById("upload-dialog"),
    form: document.getElementById("upload-form"),
    dropZone: document.getElementById("drop-zone"),
    dropZoneText: document.getElementById("drop-zone-text"),
    photoInput: document.getElementById("photo-input"),
    previewImg: document.getElementById("preview-img"),
    captionInput: document.getElementById("caption-input"),
    charCount: document.getElementById("char-count"),
    modeToggle: document.getElementById("mode-toggle"),
    nameInput: document.getElementById("name-input"),
    formError: document.getElementById("form-error"),
    submitBtn: document.getElementById("submit-btn"),
  };

  let selectedDataUrl = null;
  let postMode = "name"; // "name" | "anon"
  let db = null;
  let auth = null;
  let uid = null;
  let firebaseReady = false;

  // ---------- Firebase bootstrap ----------

  function showStatus(msg) {
    els.status.hidden = false;
    els.status.textContent = msg;
  }

  function initFirebase() {
    if (
      typeof firebaseConfig === "undefined" ||
      !firebaseConfig.apiKey ||
      firebaseConfig.apiKey.startsWith("REPLACE_")
    ) {
      showStatus(
        "This board isn't connected to a database yet. Open firebase-config.js and add your free Firebase project keys — see README.md."
      );
      els.loading.hidden = true;
      els.openBtn.disabled = true;
      els.openBtn.style.opacity = "0.5";
      return;
    }

    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();

    auth.signInAnonymously().catch((err) => {
      console.error(err);
      showStatus("Couldn't connect right now. Refresh to try again.");
    });

    auth.onAuthStateChanged((user) => {
      if (user) {
        uid = user.uid;
        firebaseReady = true;
        listenToBoard();
      }
    });
  }

  // ---------- Rendering ----------

  function formatStamp(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function renderCard(id, data) {
    const card = document.createElement("article");
    card.className = "card";

    const frame = document.createElement("div");
    frame.className = "photo-frame";
    const img = document.createElement("img");
    img.src = data.image;
    img.alt = data.caption ? `Photo: ${data.caption}` : "Photo memory";
    img.loading = "lazy";
    frame.appendChild(img);
    card.appendChild(frame);

    const body = document.createElement("div");
    body.className = "card-body";

    const meta = document.createElement("div");
    meta.className = "card-meta";

    const badge = document.createElement("span");
    if (data.anonymous || !data.displayName) {
      badge.className = "author-badge anon";
      badge.textContent = "Anonymous";
    } else {
      badge.className = "author-badge named";
      badge.textContent = data.displayName;
    }
    meta.appendChild(badge);

    const time = document.createElement("span");
    time.className = "card-time";
    time.textContent = formatStamp(data.createdAt);
    meta.appendChild(time);

    body.appendChild(meta);

    if (data.caption) {
      const caption = document.createElement("p");
      caption.className = "card-caption";
      caption.textContent = data.caption;
      body.appendChild(caption);
    }

    if (data.uid && uid && data.uid === uid) {
      const footer = document.createElement("div");
      footer.className = "card-footer";
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "delete-own";
      delBtn.textContent = "remove";
      delBtn.addEventListener("click", () => removePost(id));
      footer.appendChild(delBtn);
      body.appendChild(footer);
    }

    card.appendChild(body);
    return card;
  }

  function listenToBoard() {
    db.collection("posts")
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snapshot) => {
          els.loading.hidden = true;
          els.board.innerHTML = "";

          if (snapshot.empty) {
            els.empty.hidden = false;
            return;
          }
          els.empty.hidden = true;

          snapshot.forEach((doc) => {
            els.board.appendChild(renderCard(doc.id, doc.data()));
          });
        },
        (err) => {
          console.error(err);
          els.loading.hidden = true;
          showStatus(
            "Couldn't load the board. If you just set this up, check the Firestore rules in README.md."
          );
        }
      );
  }

  function removePost(id) {
    if (!confirm("Remove this photo from the board? This can't be undone.")) return;
    db.collection("posts").doc(id).delete().catch((err) => {
      console.error(err);
      alert("Couldn't remove that photo. Try again in a moment.");
    });
  }

  // ---------- Upload dialog ----------

  function openDialog() {
    if (!els.openBtn.disabled) {
      els.backdrop.hidden = false;
      els.dialog.hidden = false;
      els.captionInput.focus();
    }
  }

  function setMode(mode) {
    postMode = mode;
    [...els.modeToggle.children].forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-checked", String(isActive));
    });
    els.nameInput.disabled = mode === "anon";
    if (mode === "anon") els.nameInput.value = "";
    validateSubmit();
  }

  function resetForm() {
    els.form.reset();
    selectedDataUrl = null;
    els.previewImg.hidden = true;
    els.previewImg.src = "";
    els.dropZoneText.hidden = false;
    els.charCount.textContent = "0";
    els.formError.hidden = true;
    els.submitBtn.disabled = false;
    els.submitBtn.querySelector(".submit-label").textContent = "Share to the board";
    setMode("name");
  }

  function closeDialog() {
    els.backdrop.hidden = true;
    els.dialog.hidden = true;
    resetForm();
  }

  function showError(msg) {
    els.formError.hidden = false;
    els.formError.textContent = msg;
  }

  function validateSubmit() {
    // purely visual/UX guard; handleSubmit re-checks before saving
  }

  // Resize + compress an image file down to a data URL under MAX_DOC_BYTES.
  function processImage(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("That file isn't a photo."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Couldn't read that file."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Couldn't read that image."));
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > MAX_DIMENSION) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else if (height > MAX_DIMENSION) {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          let quality = JPEG_QUALITY;
          let dataUrl = canvas.toDataURL("image/jpeg", quality);

          // step quality down further if still too large
          while (dataUrl.length > MAX_DOC_BYTES && quality > 0.3) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }

          if (dataUrl.length > MAX_DOC_BYTES) {
            reject(new Error("That photo is too large even after compressing. Try a smaller image."));
            return;
          }
          resolve(dataUrl);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file) {
    if (!file) return;
    els.formError.hidden = true;
    els.dropZoneText.textContent = "";
    try {
      const dataUrl = await processImage(file);
      selectedDataUrl = dataUrl;
      els.previewImg.src = dataUrl;
      els.previewImg.hidden = false;
      els.dropZoneText.hidden = true;
    } catch (err) {
      showError(err.message);
      selectedDataUrl = null;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    els.formError.hidden = true;

    if (!firebaseReady) {
      showError("Still connecting — try again in a second.");
      return;
    }
    if (!selectedDataUrl) {
      showError("Choose a photo first.");
      return;
    }

    const isAnon = postMode === "anon";
    const displayName = isAnon ? "" : els.nameInput.value.trim().slice(0, MAX_NAME_LEN);

    if (!isAnon && !displayName) {
      showError("Add a name or username, or switch to Anonymous.");
      return;
    }

    const caption = els.captionInput.value.trim().slice(0, MAX_CAPTION_LEN);

    els.submitBtn.disabled = true;
    els.submitBtn.querySelector(".submit-label").textContent = "Sharing…";

    try {
      await db.collection("posts").add({
        image: selectedDataUrl,
        caption: caption,
        anonymous: isAnon,
        displayName: isAnon ? "" : displayName,
        uid: uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      closeDialog();
    } catch (err) {
      console.error(err);
      showError("Couldn't share that photo. Check your connection and try again.");
      els.submitBtn.disabled = false;
      els.submitBtn.querySelector(".submit-label").textContent = "Share to the board";
    }
  }

  // ---------- Wire up events ----------

  els.openBtn.addEventListener("click", openDialog);
  els.closeBtn.addEventListener("click", closeDialog);
  els.backdrop.addEventListener("click", closeDialog);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.dialog.hidden) closeDialog();
  });

  els.dropZone.addEventListener("click", () => els.photoInput.click());
  els.dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      els.photoInput.click();
    }
  });
  els.photoInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

  ["dragenter", "dragover"].forEach((evt) =>
    els.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropZone.classList.add("drag-over");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    els.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropZone.classList.remove("drag-over");
    })
  );
  els.dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    handleFile(file);
  });

  els.captionInput.addEventListener("input", () => {
    els.charCount.textContent = String(els.captionInput.value.length);
  });

  els.modeToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".mode-btn");
    if (!btn) return;
    setMode(btn.dataset.mode);
  });

  els.form.addEventListener("submit", handleSubmit);

  initFirebase();
})();
