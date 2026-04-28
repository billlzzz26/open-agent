FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

ARG BUN_VERSION=1.3.13
ENV BUN_INSTALL=/usr/local/bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean \
  && curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}" \
  && bun --version

# Install Node.js and npm for compatibility with tools that require them
# Node.js is used for npx and npm commands
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && node --version \
  && npm --version
