# Deployment Guide for OSCE Study Buddy

Because your application allows users to "OSCE with AI" (which requires a backend server) and has an interactive frontend, it is a **Full Stack Application**.

- **Frontend**: The visual part users interact with (React/Expo). We will host this on **Netlify**.
- **Backend**: The brains that talk to OpenAI (Node.js/Express). We will host this on **Render** (free tier available).

## Prerequisites
1. A [GitHub](https://github.com/) account.
2. A [Netlify](https://www.netlify.com/) account.
3. A [Render](https://render.com/) account.

---

## Step 1: Push Your Code to GitHub

1. Create a new **empty repository** on GitHub (e.g., named `osce-buddy`).
2. Run the following commands in your local terminal (VS Code):

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit for deployment"

# Link to your GitHub repo (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/osce-buddy.git

# Push code
git push -u origin master
```

---

## Step 2: Deploy Backend to Render

1. Log in to your **Render** dashboard.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Render will detect the settings, but ensure they match:
   - **Name**: `osce-buddy-api` (or similar)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run server:build`
   - **Start Command**: `npm run server:prod`
5. **Environment Variables** (Scroll down to "Advanced" or "Environment"):
   - Key: `NODE_ENV` | Value: `production`
   - Key: `OPENAI_API_KEY` | Value: `sk-...` (Your usage key)
   - Key: `PORT` | Value: `10000` (Render usually sets this, but good to be safe)
6. Click **Create Web Service**.
7. Wait for the deployment to finish. Copy the **URL** (e.g., `https://osce-buddy-api.onrender.com`). You will need this for the frontend.

> **Note on Data Persistence**: On Render's free tier, the "filesystem" is ephemeral. This means `feedback.csv` and any custom cases you upload will disappear if the server restarts (which happens frequently on free tier). For a prototype, this is usually acceptable.

---

## Step 3: Deploy Frontend to Netlify

1. Log in to your **Netlify** dashboard.
2. Click **Add new site** -> **Import from an existing project**.
3. Choose **GitHub** and select your `osce-buddy` repo.
4. Netlify should automatically detect the settings from the `netlify.toml` file we added:
   - **Build command**: `npm run build:web`
   - **Publish directory**: `dist`
5. **Environment Variables**:
   - Click **Add environment variable**.
   - Key: `EXPO_PUBLIC_DOMAIN`
   - Value: The **Render Backend URL** you copied in Step 2 (without the trailing slash, e.g., `osce-buddy-api.onrender.com` or `https://osce-buddy-api.onrender.com`).
     *Note: If you paste just the domain, the app handles adding `https://`.*
6. Click **Deploy osce-buddy**.

---

## Step 4: Share!

Once Netlify finishes building, you will get a link like `https://osce-buddy-xyz.netlify.app`. Send this link to your friends and colleagues!

### Troubleshooting
- **"Network Error"**: Check if the `EXPO_PUBLIC_DOMAIN` variable in Netlify is correct. It must match your Render backend URL.
- **Backend sleeping**: On Render free tier, the backend goes to sleep after inactivity. The first request might take 30-50 seconds to wake it up. Warn your friends!
