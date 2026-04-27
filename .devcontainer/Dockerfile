FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Install Bun at the version pinned in package.json#packageManager
ENV BUN_INSTALL=/usr/local/bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.2.14" \
    && bun --version
