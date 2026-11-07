# syntax=docker/dockerfile:1
# Kanbot client — build the Vite app, then serve the static files with nginx.

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Baked into the bundle at build time.
#   "/api"                        → same-origin; nginx below proxies it to API_UPSTREAM (default)
#   "https://api.example.com/api" → call a separately deployed API directly (set CLIENT_ORIGIN on the server)
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---- runtime ----
FROM nginx:1.27-alpine AS runtime

# Where nginx forwards /api requests (only used when VITE_API_URL is "/api").
ENV API_UPSTREAM=http://server:4000

# The nginx image runs envsubst on /etc/nginx/templates/*.template at startup.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
