# Memories and Photos

A shared photo board, like a Facebook feed but built just for the two (or
more) of you — anyone can post a photo and a caption, choose to post under a
name/username or stay anonymous, and everyone who visits the site sees the
same board with the date and time each memory was shared. Built as plain
HTML/CSS/JS so it runs on **GitHub Pages for free**.

Photos are stored in **Firebase Firestore**, which also has a free tier
("Spark plan") with no credit card required. Images are resized and
compressed right in the visitor's browser before they're saved, so you don't
need Firebase Storage (which now requires a billing account) — everything
fits in Firestore's free plan.

## What you get

- A shared board where anyone can upload a photo + caption
- Every post can be shared under a name/username, or as Anonymous — the
  poster picks each time
- Every post shows the exact date and time it was shared
- Each visitor can delete only the photos *they* personally posted (tracked
  privately, never displayed)
- Purple-and-green theme
- Fully static — works on GitHub Pages, no server needed

## 1. Create your free Firebase project (~2 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and sign in with a Google account.
2. Click **Add project**, give it any name (e.g. "memories-and-photos"),
   and finish the wizard. You can leave Google Analytics off.
3. In the left sidebar, go to **Build → Authentication → Get started**.
   Click the **Anonymous** provider and enable it. (This just gives each
   visitor's browser a private, random session ID behind the scenes, so
   they can delete their own posts later — it has nothing to do with the
   name/Anonymous choice shown on the board itself.)
4. Go to **Build → Firestore Database → Create database**. Choose
   **Start in production mode**, pick any region, and create it.
5. Once it's created, go to the **Rules** tab and replace the contents with
   everything in `firestore.rules` from this project, then click **Publish**.
6. Go to **Project settings** (gear icon, top left) → scroll to
   **Your apps** → click the **</>** (web) icon → register the app with any
   nickname → you don't need Firebase Hosting, skip that step.
7. Firebase will show you a `firebaseConfig` object. Copy it.

## 2. Add your config to the site

Open `firebase-config.js` in this project and replace the placeholder values
with the ones Firebase just gave you:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

This file is safe to make public — it just tells the app which Firebase
project to talk to. The actual protection comes from the rules you pasted in
step 1.5.

## 3. Put it on GitHub Pages

1. Create a new **public** repository on GitHub.
2. Upload all the files in this folder (`index.html`, `style.css`, `app.js`,
   `firebase-config.js` with your real keys, `README.md`) to the root of
   that repo.
3. In the repo, go to **Settings → Pages**.
4. Under **Source**, choose **Deploy from a branch**, pick the `main` branch
   and `/ (root)` folder, then **Save**.
5. GitHub will give you a URL like
   `https://your-username.github.io/your-repo-name/` — that's your live site,
   usually ready within a minute or two.

## Notes & limits

- **It's genuinely public.** Anyone with the link can post a photo, and
  anyone can see every photo. There's no login wall. If you want it private,
  the simplest option is to not share the link widely, or ask me to add a
  shared-password gate.
- **Free tier limits.** Firestore's free plan gives you 1 GiB of storage and
  50,000 reads / 20,000 writes per day — plenty for a personal or
  friend-group board. Each photo is compressed to roughly 200–800 KB.
- **Moderation.** Anyone can post anything, and only the original poster can
  remove their own photo. There's no built-in content moderation — keep that
  in mind before sharing the link widely.
- **Names are typed in by the poster.** There's no account system checking
  who's who — if someone posts under a name, it's whatever they typed. The
  Anonymous option hides it from other visitors entirely.
