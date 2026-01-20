# Hosting on GitHub Pages (All-in-One Solution)

You can use GitHub for everything (hosting the code + the live website). We have set up a **GitHub Action** to do this automatically.

## Prerequisites

1.  A GitHub Account.
2.  Your OpenAI API Key.

## Step 1: Push Code to GitHub

(If you haven't already created a repo)

1.  Create a new **empty repository** on GitHub (e.g., `osce-buddy`).
2.  Run these commands in your VS Code terminal:

```bash
git init
git add .
git commit -m "Ready for GitHub Pages"
git branch -M master
git remote add origin https://github.com/YOUR_USERNAME/osce-buddy.git
git push -u origin master
```

## Step 2: Configure Secrets (Crucial!)

For the AI to work, we need to securely give GitHub your API key.

1.  Go to your GitHub Repository page.
2.  Click **Settings** (top bar) -> **Secrets and variables** (left sidebar) -> **Actions**.
3.  Click **New repository secret**.
4.  **Name**: `EXPO_PUBLIC_OPENAI_API_KEY`
5.  **Secret**: Paste your `sk-...` key here.
6.  Click **Add secret**.

## Step 3: Enable GitHub Pages

1.  Go to **Settings** -> **Pages** (left sidebar).
2.  Under **Build and deployment**:
    *   **Source**: Select **GitHub Actions**.
    *   (It might say "Beta" or just allow you to select it. This tells GitHub to let our custom workflow handle the build).
3.  That's it!

## Triggering the Build

*   The moment you selected "GitHub Actions" or pushed your code, the build should have started.
*   Click **Actions** tab to see it running.
*   Once green, click the deploy job to find your URL (usually `https://your-username.github.io/osce-buddy`).

## Note on "White Screen" or Broken Assets
If you deploy to a sub-folder (like `/osce-buddy`), you might see a white screen or broken images. 
If this happens, you need to tell Expo where the site lives:
1. Open `app.json`.
2. Add `"baseUrl": "/osce-buddy"` inside the `"experiments"` section.
3. Commit and push again.
