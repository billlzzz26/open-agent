FROM mcr.microsoft.com/devcontainers/base:alpine

ARG BUN_VERSION=1.3.13
ENV BUN_INSTALL=/usr/local/bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

RUN apk add --no-cache curl ca-certificates \
  && curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}" \
  && bun --version

# Install Node.js and npm for compatibility with tools that require them
# Node.js is used for npx and npm commands
RUN apk add --no-cache nodejs npm python3 py3-pip \
  && node --version \
  && npm --version \
  && python3 --version \
  && pip3 --version

# Install GitHub CLI
RUN apk add --no-cache github-cli \
  && gh --version

# Install uv (fast Python package installer)
RUN curl -fsSL https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-unknown-linux-musl.tar.gz | tar -xz \
  && mv uv /usr/local/bin/uv \
  && chmod +x /usr/local/bin/uv \
  && uv --version

# Install Modal CLI
RUN pip3 install modal \
  && modal --version
