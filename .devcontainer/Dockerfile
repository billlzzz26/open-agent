FROM mcr.microsoft.com/devcontainers/base:alpine

ARG BUN_VERSION=1.3.13
ENV BUN_INSTALL=/usr/local/bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

RUN apk add --no-cache curl ca-certificates \
  && curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}" \
  && bun --version

# Install Node.js and npm for compatibility with tools that require them
# Node.js is used for npx and npm commands
RUN apk add --no-cache nodejs npm \
  && node --version \
  && npm --version
