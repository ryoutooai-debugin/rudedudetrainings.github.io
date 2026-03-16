#!/bin/bash
# Price pusher daemon - runs continuously and pushes every 15 minutes

REPO_DIR="/root/rudedudetrainings.github.io"
LOG_FILE="/tmp/price_push.log"
PUSH_INTERVAL=900  # 15 minutes in seconds

echo "$(date): Price pusher daemon started" >> "$LOG_FILE"
echo "Push interval: 15 minutes" >> "$LOG_FILE"
echo "Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday" >> "$LOG_FILE"
echo "---" >> "$LOG_FILE"

while true; do
    # Get current time
    HOUR_UTC=$(date -u +%H)
    DAY=$(date +%u)  # 1=Monday, 7=Sunday
    
    # Check if it's a weekday (1-5) and within market hours (13:30-21:00 UTC)
    if [ "$DAY" -le 5 ] && [ "$HOUR_UTC" -ge 13 ] && [ "$HOUR_UTC" -le 21 ]; then
        cd "$REPO_DIR" || exit 1
        
        # Check if prices.json has changed
        if ! git diff --quiet prices.json 2>/dev/null; then
            echo "$(date): Pushing updated prices.json..." >> "$LOG_FILE"
            
            git add prices.json
            git commit -m "Update prices - $(date -u +'%Y-%m-%d %H:%M UTC')" >> "$LOG_FILE" 2>&1
            
            if git push origin main >> "$LOG_FILE" 2>&1; then
                echo "$(date): ✓ Push successful" >> "$LOG_FILE"
            else
                echo "$(date): ✗ Push failed, attempting merge..." >> "$LOG_FILE"
                git pull origin main --no-rebase >> "$LOG_FILE" 2>&1
                git push origin main >> "$LOG_FILE" 2>&1
            fi
        else
            echo "$(date): No changes to push" >> "$LOG_FILE"
        fi
    else
        echo "$(date): Outside market hours (UTC $HOUR_UTC), waiting..." >> "$LOG_FILE"
    fi
    
    sleep $PUSH_INTERVAL
done
