---
name: todo
created: 2026-04-26T22:50:23Z
updated: 2026-04-26T22:50:23Z
author: billlzzz26
project: Open-Agent (AI-Powered Code Generation Platform)
description: v0-like code generation agent for GitHub repositories with AI-driven development
---

# Open-Agent Development Roadmap

> Open-Agent enables AI-driven development for GitHub repositories. Users can connect their repos, have conversations with AI about their code, and generate changes via an integrated sandbox environment. This roadmap tracks implementation progress across 14 development phases.

## Phase 1: Environment Setup & Configuration (Core Infrastructure)

**Status:** ~80% Complete | **Priority:** Critical | **Files:** `turbo.json`, `.env`, `apps/web/`, `lib/`, `packages/`

- [x] Setup Monorepo structure with Turbo (`turbo.json` configured)
- [x] Initialize Next.js 16 web app (`apps/web/`)
- [x] Configure BetterAuth for authentication (`lib/auth/config.ts`, `lib/auth/client.ts`)
- [x] Setup PostgreSQL database schema (`lib/db/schema.ts`, migrations)
- [x] Install core dependencies (AI SDK 6, Radix UI, Drizzle ORM, etc.)
- [ ] **CRITICAL:** Add `BETTER_AUTH_SECRET` env var (required for auth)
- [ ] **CRITICAL:** Add `POSTGRES_URL` env var (required for database)
- [ ] Verify build outputs in `turbo.json` (currently warns about missing outputs)
- [ ] Update `.env.example` with all required environment variables
- [ ] Document setup instructions for new developers

**Blocked By:** Environment variables not configured in Vercel project

---

## Phase 2: GitHub Integration & Repository Management

**Status:** ~90% Complete | **Priority:** Critical | **Files:** `api/github/*`, `lib/github/*`

- [x] GitHub OAuth App setup and configuration
- [x] User GitHub accounts linking via BetterAuth
- [x] Repository listing from authenticated user/orgs (`api/github/orgs`, `api/github/installations/repos`)
- [x] Repository metadata retrieval (name, description, branches)
- [x] Branch listing and selection (`api/github/branches`)
- [x] Current user info retrieval (`api/github/user`)
- [x] Organization listing (`api/github/orgs`)
- [ ] GitHub App installation status tracking (`api/github/orgs/install-status`)
- [ ] Handle multiple GitHub accounts per user
- [ ] Graceful error handling for revoked app access
- [ ] Support for private repositories access verification
- [ ] Repository webhook setup for CI/CD integration

**In Progress:** GitHub app installation flow improvements

---

## Phase 3: AI-Powered Code Generation & Chat

**Status:** ~85% Complete | **Priority:** Critical | **Files:** `api/chat/*`, `lib/chat/*`, `components/`, `hooks/`

- [x] Chat interface with streaming responses (`api/chat/[chatId]/stream`)
- [x] Vercel AI SDK 6 integration with multiple models support
- [x] Tool/skill execution system for code generation
- [x] Chat message persistence to database
- [x] Stream recovery and error handling (`lib/chat/create-cancelable-readable-stream.ts`)
- [x] Auto-commit functionality (`lib/chat/auto-commit-direct.ts`)
- [x] Auto-PR generation (`lib/chat/auto-pr-direct.ts`)
- [ ] Context window optimization for large files (>10KB)
- [ ] Token usage tracking and display
- [ ] Chat history and context management improvements
- [ ] Implement prompt templates for common tasks
- [ ] Add conversation export (markdown, JSON)
- [ ] Fine-tune model selection per task type

**Files to Review:** `lib/chat/`, `api/chat/`, chat streaming implementation

---

## Phase 4: Workspace & Sandbox Environment

**Status:** ~80% Complete | **Priority:** Critical | **Files:** `api/sandbox/*`, `lib/sandbox/*`, `packages/sandbox`

- [x] Vercel Sandbox integration for code execution
- [x] Dev server startup and management (`api/sandbox/status`)
- [x] File system navigation and code editor (`api/sessions/[sessionId]/files`)
- [x] Live preview with hot reload
- [x] Sandbox snapshot and restore capability (`api/sandbox/snapshot`)
- [x] Sandbox reconnection logic (`api/sandbox/reconnect`)
- [ ] Error recovery when sandbox crashes
- [ ] Sandbox timeout handling and extension (`api/sandbox/extend`)
- [ ] Performance optimization for large projects
- [ ] Memory usage monitoring
- [ ] Custom environment setup (env vars, dependencies)
- [ ] Support for different project types (Next.js, React, etc.)

**Ongoing:** Stability improvements based on user feedback

---

## Phase 5: Git Operations & Version Control

**Status:** ~90% Complete | **Priority:** Critical | **Files:** `lib/git/*`, `api/sessions/[sessionId]/diff*`, `api/pr`

- [x] Git diff viewing (`api/sessions/[sessionId]/diff/cached`)
- [x] File change tracking and visualization
- [x] Commit message generation (`api/sessions/[sessionId]/generate-commit-message`)
- [x] Commit and push operations to GitHub
- [x] PR generation and management (`api/generate-pr`, `api/check-pr`)
- [x] Git status checking (`api/git-status`)
- [ ] Merge conflict resolution UI
- [ ] Interactive branch management dashboard
- [ ] Git history visualization (recent commits, branches)
- [ ] Support for git cherry-pick and rebase
- [ ] Commit amending and force push warnings

**Files to Review:** `lib/git/`, diff visualization logic

---

## Phase 6: Workflow System & Task Automation

**Status:** ~75% Complete | **Priority:** High | **Files:** `.well-known/workflow/*`, workflow integration

- [x] Vercel Workflow SDK integration (basic setup)
- [x] Multi-step workflow support and execution
- [x] Webhook handling (`api/github/webhook`)
- [x] Workflow manifest generation (25 steps, 2 workflows)
- [ ] Workflow state persistence across failures
- [ ] Error handling and retry logic
- [ ] Workflow UI for monitoring and control
- [ ] Conditional branching in workflows
- [ ] Workflow scheduling (cron jobs)
- [ ] Workflow logging and debugging tools

**Status Check:** Run `bun run build` to see workflow manifest details

---

## Phase 7: Session & Chat Management

**Status:** ~85% Complete | **Priority:** High | **Files:** `api/sessions/*`, `lib/session/*`, database schema

- [x] Session creation and persistence (`api/sessions`)
- [x] Chat creation within sessions (`api/sessions/[sessionId]/chats/[chatId]`)
- [x] Chat history and message retrieval
- [x] Chat forking (`api/sessions/[sessionId]/chats/[chatId]/fork`)
- [x] Chat sharing and public links (`api/sessions/[sessionId]/chats/[chatId]/share`)
- [ ] Session state synchronization across tabs
- [ ] Chat export/import (Markdown, JSON)
- [ ] Session archival and cleanup
- [ ] Collaborative sessions (multiple users)
- [ ] Real-time message sync with WebSockets

**Database Tables:** Sessions, Chats, ChatMessages (verify in schema)

---

## Phase 8: User Profiles & Account Management

**Status:** ~70% Complete | **Priority:** High | **Files:** `settings/`, `api/settings/*`, `lib/auth/*`

- [x] User authentication via BetterAuth
- [x] GitHub account linking
- [x] Basic profile management
- [x] Settings pages (profile, preferences, accounts, connections)
- [ ] Account settings UI polish
- [ ] API key management for extensions
- [ ] Usage analytics and statistics (`api/usage`, `api/usage/rank`)
- [ ] Team/organization management
- [ ] Role-based access control (admin, user)
- [ ] Account deletion and data export

**Settings Pages:** `settings/profile`, `settings/preferences`, `settings/connections`, `settings/admin`

---

## Phase 9: Code Quality & Testing Infrastructure

**Status:** ~40% Complete | **Priority:** Medium | **Files:** `*.test.ts`, test utilities

- [x] Unit tests for chat streaming (`lib/chat-streaming-state.test.ts`)
- [x] Stream recovery tests (`lib/assistant-file-links.test.ts`)
- [x] Auto-commit tests (`lib/chat/auto-commit-direct.test.ts`)
- [x] Auto-PR tests (`lib/chat/auto-pr-direct.test.ts`)
- [ ] Expand test coverage to all API routes
- [ ] Add integration tests for GitHub workflows
- [ ] Add sandbox environment tests
- [ ] Performance benchmarking suite
- [ ] End-to-end tests with Playwright/Cypress
- [ ] Load testing for sandbox and chat APIs

**Test Files to Review:** `lib/*.test.ts`, `lib/chat/*.test.ts`

---

## Phase 10: Documentation & Developer Experience

**Status:** ~20% Complete | **Priority:** Medium | **Files:** `README.md`, docs/, comments

- [ ] Architecture documentation (monorepo, data flow, API)
- [ ] Setup guide for local development
- [ ] API documentation (endpoints, schemas)
- [ ] Skill/tool development guide
- [ ] Database schema documentation
- [ ] GitHub integration setup instructions
- [ ] Environment variables reference
- [ ] Troubleshooting guide
- [ ] TypeScript type safety improvements
- [ ] Error message improvements with suggestions

**Current README:** Minimal setup info only

---

## Phase 11: Performance & Scalability

**Status:** ~30% Complete | **Priority:** Medium-High | **Files:** API routes, database, middleware

- [ ] Database query optimization (add indexes)
- [ ] API response time monitoring
- [ ] Implement Redis caching layer (if needed)
- [ ] Rate limiting per user/IP (`api/middleware`)
- [ ] Query pagination for large datasets
- [ ] Database connection pooling
- [ ] CDN setup for static assets
- [ ] Image optimization
- [ ] Database migration strategy for scale
- [ ] Monitoring and alerting setup

**Current Bottlenecks:** Large file handling, chat context window limits

---

## Phase 12: Advanced Features & Integrations

**Status:** ~40% Complete | **Priority:** Low-Medium | **Files:** Various

- [x] GitHub integration (partial)
- [x] Vercel Workflow integration (partial)
- [ ] Vercel environment variables API integration (`api/vercel/*`)
- [ ] Vercel deployments management
- [ ] GitLab support
- [ ] Bitbucket support
- [ ] Slack/Discord notifications
- [ ] Advanced AI features (image generation, code analysis)
- [ ] CLI tool for local development
- [ ] Browser extension
- [ ] Mobile app or responsive improvements

**In Scope:** `api/vercel/` endpoints exist but incomplete

---

## Phase 13: Security & Compliance

**Status:** ~50% Complete | **Priority:** High | **Files:** Middleware, auth, validation

- [ ] Input validation on all API routes
- [ ] CORS configuration hardening
- [ ] CSRF token implementation
- [ ] API rate limiting and quotas
- [ ] DDoS protection
- [ ] Data encryption at rest
- [ ] Secrets rotation policy
- [ ] GDPR compliance (data export, deletion)
- [ ] Privacy policy and terms of service
- [ ] Security audit and penetration testing
- [ ] OAuth token security best practices

**Auth System:** BetterAuth handles OAuth, need to audit other security layers

---

## Phase 14: Production & Deployment

**Status:** ~60% Complete | **Priority:** Critical | **Files:** Build config, deployment scripts

- [x] Vercel deployment configuration
- [ ] Database migration strategy for production
- [ ] Environment variable management on Vercel
- [ ] Health checks and uptime monitoring
- [ ] Rollback procedures and automation
- [ ] Database backup strategy
- [ ] Log aggregation and analysis
- [ ] Error tracking (Sentry integration)
- [ ] Performance monitoring (Vercel Analytics)
- [ ] Deployment documentation
- [ ] Release notes automation

**Current Status:** Builds successfully, but missing env vars block functionality

---

## Critical Blockers

1. **BETTER_AUTH_SECRET** - Required for authentication to work
2. **POSTGRES_URL** - Required for database operations
3. **Turbo output configuration** - Warning about missing build outputs

## Quick Links

- **API Routes:** `apps/web/app/api/`
- **Libraries:** `apps/web/lib/`
- **Database:** `apps/web/lib/db/schema.ts`
- **Auth Config:** `apps/web/lib/auth/`
- **Package Config:** `turbo.json`, `package.json`
