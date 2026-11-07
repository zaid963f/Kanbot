# Kanbot API on Hugging Face Spaces (Docker SDK).
# Pulls the latest code from GitHub on every build — "Factory rebuild" in the Space settings picks up new commits.
FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Busts the Docker cache whenever main gets a new commit.
ADD https://api.github.com/repos/zaid963f/Kanbot/git/refs/heads/main /tmp/version.json

# Spaces run containers as uid 1000, which is the "node" user in this image.
USER node
WORKDIR /home/node
RUN git clone --depth 1 https://github.com/zaid963f/Kanbot.git kanbot

WORKDIR /home/node/kanbot/server
RUN npm ci --include=dev && npm run build && npm prune --omit=dev

ENV NODE_ENV=production \
    PORT=7860 \
    DATA_FILE=/home/node/kanbot/server/data/db.json

EXPOSE 7860
CMD ["node", "dist/index.js"]
