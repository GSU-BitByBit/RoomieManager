# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

FROM base AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY nest-cli.json tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
COPY scripts ./scripts
COPY test ./test
COPY openapi ./openapi

RUN pnpm prisma:generate && pnpm build

FROM base AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --chown=node:node deploy/docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const prefix=(process.env.API_PREFIX ?? 'api/v1').replace(/^\\/+|\\/+$/g,''); fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/${prefix}/health/live`).then((response)=>{ if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
