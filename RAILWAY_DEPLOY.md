# SamOwl Leaderboard Server - Railway Deployment

## Setup Instructions

1. **Install Railway CLI** (if not already installed):
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Create new project**:
   ```bash
   railway init
   ```
   - Select "Empty Project"
   - Name it: `samowl-leaderboard`

4. **Add GitHub integration** (for auto-deploy):
   - Go to Railway dashboard
   - Project Settings → GitHub Repo
   - Connect to: `ryoutooai-debugin/rudedudetrainings.github.io`

5. **Set environment variables**:
   ```bash
   railway variables set GITHUB_TOKEN=your_github_token_here
   ```
   (Create a GitHub token at https://github.com/settings/tokens with 'repo' scope)

6. **Deploy**:
   ```bash
   railway up
   ```

7. **Get public URL**:
   ```bash
   railway domain
   ```

8. **Update game** with the Railway URL:
   Edit `games/portfolio-game.html` and set:
   ```javascript
   const LEADERBOARD_API = 'https://your-app-name.railway.app';
   ```

## Manual Deploy (without GitHub integration)

1. Create project on Railway dashboard
2. Choose "Deploy from GitHub repo"
3. Select your repo
4. Add environment variable: `GITHUB_TOKEN`
5. Deploy!

## Testing Locally

```bash
python3 leaderboard_server.py
```

Server runs on http://localhost:8080
