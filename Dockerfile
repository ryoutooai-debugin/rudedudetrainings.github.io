FROM python:3.9-slim

WORKDIR /app

# Copy server file
COPY leaderboard_server.py .

# Create empty leaderboard.json if it doesn't exist
RUN echo '{"entries": [], "last_update": ""}' > leaderboard.json

# Railway provides PORT env variable
ENV PORT=8080

EXPOSE 8080

CMD ["python3", "leaderboard_server.py"]
