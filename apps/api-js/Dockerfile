FROM node:22.14.0-alpine AS base
RUN npm install --global pnpm@11.8.0
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api-js/package.json apps/api-js/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY apps/api-js apps/api-js
RUN pnpm --filter @ns-fiscal/api-js prisma:generate \
 && pnpm --filter @ns-fiscal/api-js build

FROM base AS runtime
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app /app
USER app
EXPOSE 3333
CMD ["pnpm", "--filter", "@ns-fiscal/api-js", "start"]
