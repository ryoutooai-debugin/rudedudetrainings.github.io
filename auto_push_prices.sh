#!/bin/bash
# Auto-push prices.json to GitHub every 15 minutes during market hours
# Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday

REPO_DIR="/root/rudedudetrainings.github.io"
LOG_FILE="/tmp/price_push.log"

# Get current time in ET (UTC-5 or UTC-4 depending on DST)
# For simplicity, using UTC and converting
HOUR_UTC=$(date -u +%H)
MIN=$(date +%M)
DAY=$(date +%u)  # 1=Monday, 7=Sunday

# Convert UTC to ET (roughly)
# ET = UTC - 5 (EST) or UTC - 4 (EDT)
# 9:30 AM ET = 14:30 UTC (EST) or 13:30 UTC (EDT)
# 4:00 PM ET = 21:00 UTC (EST) or 20:00 UTC (EDT)

# Check if it's a weekday (1-5) and within market hours (13:30-21:00 UTC covers both EST/EDT)
if [ "$DAY" -le 5 ] && [ "$HOUR_UTC" -ge 13 ] && [ "$HOUR_UTC" -le 21 ]; then
    cd "$REPO_DIR" || exit 1
    
    # Check if prices.json has changed
    if git diff --quiet prices.json 2>/dev/null; then
        echo "$(date): No changes to prices.json" >> "$LOG_FILE"
        exit 0
    fi
    
    # Add, commit, and push
    git add prices.json
    git commit -m "Update prices - $(date -u +'%Y-%m-%d %H:%M UTC')" >> "$LOG_FILE" 2>&1
    
    if git push origin main >> "$LOG_FILE" 2>&1; then
        echo "$(date): Successfully pushed prices.json" >> "$LOG_FILE"
    else
        echo "$(date): Push failed, will retry next cycle" >> "$LOG_FILE"
        # Pull and merge if needed
        git pull origin main --no-rebase >> "$LOG_FILE" 2>&1
        git push origin main >> "$LOG_FILE" 2>&1
    fi
else
    echo "$(date): Outside market hours, skipping push" >> "$LOG_FILE"
fi
