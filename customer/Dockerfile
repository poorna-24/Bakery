# syntax=docker/dockerfile:1

# The public menu, built as a self-contained server.
#
# Three stages, so the shipped image carries no toolchain and no source — only
# the standalone server Next.js emits, the static assets, and the Prisma query
# engine. Every stage shares one base: the engine is a native binary compiled
# for the platform it was generated on, and a builder/runner mismatch would
# surface as a crash on the first query rather than as a build failure.

FROM node:22-alpine AS base
# Prisma's engine links against OpenSSL, which Alpine does not ship.
# ca-certificates lets the optional corporate root below be installed.
RUN apk add --no-cache openssl ca-certificates
WORKDIR /app


# ------------------------------------------------------------------ install
FROM base AS deps

# The schema is copied before installing because `postinstall` runs
# `prisma generate`, which reads it. Without it the install fails outright.
COPY package.json package-lock.json ./
COPY prisma ./prisma

# `prisma generate` downloads its query engine over HTTPS, which fails behind a
# network that re-signs TLS with its own root — the container trusts the public
# roots and nothing else. Pass that root in and it is trusted for this step
# only; it never lands in a layer, because a secret mount is not one:
#
#   docker build --secret id=extra_ca_certs,src=/path/to/root-ca.pem .
#
# On an ordinary network no secret is passed, the mount is absent, and this is
# a plain `npm ci`.
RUN --mount=type=secret,id=extra_ca_certs \
    set -eu; \
    if [ -s /run/secrets/extra_ca_certs ] \
       && grep -q "BEGIN CERTIFICATE" /run/secrets/extra_ca_certs; then \
      cp /run/secrets/extra_ca_certs /usr/local/share/ca-certificates/extra-ca.crt; \
      update-ca-certificates; \
      export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca_certs; \
    fi; \
    npm ci


# -------------------------------------------------------------------- build
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `output: "standalone"` is switched on by this variable alone, so a Vercel
# build stays byte-for-byte what it was before this file existed.
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1

# The Prisma client is constructed the first time lib/db.ts is imported, which
# happens while the pages compile. It only needs the variable to be present and
# well-formed — nothing connects during a build — so a placeholder is enough.
ARG DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
ARG DIRECT_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV DATABASE_URL=$DATABASE_URL
ENV DIRECT_URL=$DIRECT_URL

# NEXT_PUBLIC_* values are inlined into the bundle as the pages compile, so they
# have to be supplied now. Setting them at run time is too late — the shop name
# and phone number would already be baked in as the defaults below.
ARG NEXT_PUBLIC_SHOP_NAME="Our Bakery"
ARG NEXT_PUBLIC_SHOP_TAGLINE="Handcrafted delights, made fresh every morning."
ARG NEXT_PUBLIC_SHOP_ADDRESS=""
ARG NEXT_PUBLIC_SHOP_MAP_URL=""
ARG NEXT_PUBLIC_SHOP_PHONE=""
ARG NEXT_PUBLIC_SHOP_WHATSAPP=""
ARG NEXT_PUBLIC_CREDIT_NAME=""
ARG NEXT_PUBLIC_CREDIT_WHATSAPP=""
ENV NEXT_PUBLIC_SHOP_NAME=$NEXT_PUBLIC_SHOP_NAME \
    NEXT_PUBLIC_SHOP_TAGLINE=$NEXT_PUBLIC_SHOP_TAGLINE \
    NEXT_PUBLIC_SHOP_ADDRESS=$NEXT_PUBLIC_SHOP_ADDRESS \
    NEXT_PUBLIC_SHOP_MAP_URL=$NEXT_PUBLIC_SHOP_MAP_URL \
    NEXT_PUBLIC_SHOP_PHONE=$NEXT_PUBLIC_SHOP_PHONE \
    NEXT_PUBLIC_SHOP_WHATSAPP=$NEXT_PUBLIC_SHOP_WHATSAPP \
    NEXT_PUBLIC_CREDIT_NAME=$NEXT_PUBLIC_CREDIT_NAME \
    NEXT_PUBLIC_CREDIT_WHATSAPP=$NEXT_PUBLIC_CREDIT_WHATSAPP

# public/ is empty in this project, and git does not track empty directories —
# so on a fresh clone it is absent and the runner's COPY would fail.
RUN mkdir -p public

RUN npm run build


# ------------------------------------------------------------------- runtime
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Nothing here needs root, and a container that cannot write over its own
# program files is a far smaller prize if the app is ever exploited.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Uploaded photos live outside the image, on a volume shared with the admin
# app. Creating it here with the right owner matters: Docker seeds a new named
# volume from the image's own directory, permissions included, so without this
# the volume arrives owned by root and the app cannot write to it.
RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data
ENV BAKERY_DATA_DIR=/data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Next traces imports to decide what the standalone bundle needs, but the query
# engine is loaded by path rather than imported, so it is not reliably traced.
# Copying it explicitly is the difference between a working image and one that
# throws on its first query.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
# Without this the server binds to localhost inside the container, where no
# published port can reach it.
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
