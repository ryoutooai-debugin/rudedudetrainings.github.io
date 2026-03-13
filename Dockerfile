FROM python:3.9-slim

WORKDIR /app

# Install git for committing to GitHub
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy files
COPY leaderboard_server.py .
COPY leaderboard.json .

# Railway provides PORT env variable
ENV PORT=8080

EXPOSE 8080

CMD ["python3", "leaderboard_server.py"]
