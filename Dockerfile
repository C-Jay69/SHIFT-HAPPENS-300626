FROM node:20-slim AS deps
WORKDIR /app
# Root workspace + server package manifests.
COPY package.json bun.lock ./
COPY server/package.json server/package.json
# npm fails on the workspace link bug; use bun for installs.
RUN corepack enable && corepack prepare bun@1.3.14 --activate && bun install

FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY . .
# SPA + API compile.
RUN bunx tsc --noEmit && npm run build && npm run build:api

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/db ./db
EXPOSE 4000
CMD ["node", "server/dist/index.js"]
