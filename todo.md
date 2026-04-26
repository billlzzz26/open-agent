---
name: todo
created: 2026-04-27
updated: 2026-04-27
arthur: billlzzz26
---

# แผนการพัฒนาโปรเจกต์ Open-Agents (TDD Lifecycle)

>แผนการพัฒนานี้แบ่งออกเป็น 14 เฟส โดยยึดหลักการพัฒนาแบบ Test-Driven Development (TDD) คือการเขียน Test ก่อนการ Implement เสมอ เพื่อให้มั่นใจในคุณภาพของโค้ดและลดข้อผิดพลาดที่อาจเกิดขึ้น

## Phase 1: โครงสร้างพื้นฐานและส่วนประกอบกลาง (Core Infrastructure & Shared Components)

- [ ] **Test:** เขียน Unit/Integration Tests สำหรับการตั้งค่าโปรเจกต์ใหม่และ Shared Schemas/Types
- [ ] **Task:**
  - [ ] สร้างโปรเจกต์ `apps/api` และ `apps/worker` ใน Monorepo
  - [ ] กำหนด Shared Schemas/Types ที่จำเป็นใน `packages/shared` (เช่น `document.schema.ts`, `timeblock.schema.ts`, `generation.schema.ts`)
  - [ ] Implement ระบบ Authentication และ User Management พื้นฐาน (ใช้ตาราง `users`, `accounts`, `authSessions`, `sessions` ที่มีอยู่แล้ว)

## Phase 2: การจัดการเอกสาร (Document Management) - Server-side

- [ ] **Test:** เขียน Unit/Integration Tests สำหรับ API ของ Documents (CRUD operations)
- [ ] **Task:**
  - [ ] Implement `documents` schema ใน `apps/api/db/schema.ts` ตาม SPEC ข้อ 7.1
  - [ ] พัฒนา API Endpoints สำหรับ CRUD operations บน Documents ใน `apps/api/routes/documents.ts` และ `apps/api/controllers/documents.controller.ts`
  - [ ] Implement `document.service.ts` สำหรับ Business Logic ของ Documents

## Phase 3: การจัดการเอกสาร (Document Management) - Client-side Web

- [ ] **Test:** เขียน End-to-End Tests สำหรับ Workflow การแก้ไขเอกสารบน Web UI
- [ ] **Task:**
  - [ ] Implement Features ที่เกี่ยวข้องกับ Documents ใน `apps/web/features/documents` (API calls, hooks, mutations, queries)
  - [ ] พัฒนา `document-editor.tsx` และ UI Components ที่เกี่ยวข้องใน `apps/web/components/editor`
  - [ ] เชื่อมต่อ Editor กับ Local State (`editor-store.ts`) และ Server API

## Phase 4: การจัดการ Timeblock (Timeblock Management) - Server-side

- [ ] **Test:** เขียน Unit/Integration Tests สำหรับ API ของ Timeblocks (CRUD operations)
- [ ] **Task:**
  - [ ] Implement `timeblocks` schema ใน `apps/api/db/schema.ts` ตาม SPEC ข้อ 7.2
  - [ ] พัฒนา API Endpoints สำหรับ CRUD operations บน Timeblocks ใน `apps/api/routes/timeblocks.ts` และ `apps/api/controllers/timeblocks.controller.ts`
  - [ ] Implement `timeblock.service.ts` สำหรับ Business Logic ของ Timeblocks

## Phase 5: การจัดการ Timeblock (Timeblock Management) - Client-side Web

- [ ] **Test:** เขียน End-to-End Tests สำหรับ Workflow การจัดการ Timeblock บน Web UI
- [ ] **Task:**
  - [ ] Implement Features ที่เกี่ยวข้องกับ Timeblocks ใน `apps/web/features/timeblocks` (API calls, hooks, mutations, queries)
  - [ ] พัฒนา UI Components สำหรับ Timeblock Editor, List, Timeline, Heatmap ใน `apps/web/components/calendar`
  - [ ] เชื่อมต่อ Calendar UI กับ Local State (`calendar-store.ts`) และ Server API

## Phase 6: Local-first และการ Sync (Core Local-first & Sync)

- [ ] **Test:** เขียน Unit/Integration Tests สำหรับ Local-first Operations และ Sync Queue
- [ ] **Task:**
  - [ ] ตั้งค่า `packages/local-db` พร้อม Schemas และ Repositories สำหรับ Documents และ Timeblocks
  - [ ] Implement Core Sync Logic ใน `apps/web` (เช่น `lib/sync.ts`, `hooks/use-offline-queue.ts`, `store/sync-store.ts`)
  - [ ] พัฒนา UI Components สำหรับแสดงสถานะ Sync (`offline-badge.tsx`, `sync-progress.tsx`) ใน `apps/web/components/sync`
  - [ ] Implement `sync_state` schema ใน `apps/api/db/schema.ts` ตาม SPEC ข้อ 7.4
  - [ ] พัฒนา API Endpoints สำหรับ Sync Operations ใน `apps/api/routes/sync.ts` และ `apps/api/controllers/sync.controller.ts`

## Phase 7: AI Generation (Server-side)

- [ ] **Test:** เขียน Unit/Integration Tests สำหรับ AI Generation API และ Worker Processing
- [ ] **Task:**
  - [ ] Implement `generations` schema ใน `apps/api/db/schema.ts` ตาม SPEC ข้อ 7.3
  - [ ] พัฒนา API Endpoints สำหรับ AI Generation Requests ใน `apps/api/routes/generations.ts` และ `apps/api/controllers/generations.controller.ts`
  - [ ] ตั้งค่า `apps/worker` พร้อม Job Processing พื้นฐานสำหรับ AI Tasks (เช่น `jobs/title-gen.ts`)
  - [ ] Integrate LLM Client ใน `apps/api/integrations/llm.ts` และ `apps/worker/processors/llm-processor.ts`
  - [ ] Implement `job_queue` schema ใน `apps/api/db/schema.ts` ตาม SPEC ข้อ 7.5

## Phase 8: AI Generation (Client-side Web)

- [ ] **Test:** เขียน End-to-End Tests สำหรับ AI Generation Features บน Web UI
- [ ] **Task:**
  - [ ] Implement Features ที่เกี่ยวข้องกับ Generations ใน `apps/web/features/generations` (API calls, hooks)
  - [ ] พัฒนา UI Components สำหรับ AI Suggestions (เช่น `title-suggestions.tsx`, `tag-suggestions.tsx`, `topic-suggestions.tsx`) และ Inline Commands ใน `apps/web/components/editor`

## Phase 9: Search (Core & Full-text)

- [ ] **Test:** เขียน Unit/Integration Tests สำหรับ Full-text Search Indexing และ Querying
- [ ] **Task:**
  - [ ] ตั้งค่า `packages/search` พร้อม Components สำหรับ Full-text Indexing (เช่น `fulltext/tokenizer.ts`, `fulltext/ranking.ts`)
  - [ ] Implement `search_index` schema ใน `apps/api/db/schema.ts` ตาม SPEC ข้อ 7.6
  - [ ] พัฒนา API Endpoints สำหรับ Full-text Search ใน `apps/api/routes/search.ts` และ `apps/api/controllers/search.controller.ts`
  - [ ] Implement Search Index Update Job ใน `apps/worker/jobs/search-index.ts`

## Phase 10: Search (Semantic & Client-side)

- [ ] **Test:** เขียน Unit/Integration Tests สำหรับ Semantic Search และ End-to-End Tests สำหรับ Search UI
- [ ] **Task:**
  - [ ] Implement Components สำหรับ Semantic Search ใน `packages/search` (เช่น `semantic/embedding.ts`, `semantic/similarity.ts`, `semantic/vector-query.ts`)
  - [ ] Implement `vector_refs` schema ใน `apps/api/db/schema.ts` ตาม SPEC ข้อ 7.7
  - [ ] Integrate Vector Database Client ใน `apps/api/integrations/vector.ts` และ `apps/worker/processors/vector-processor.ts`
  - [ ] พัฒนา UI Components สำหรับ Search (`workspace-search-box.tsx`, `search-result-list.tsx`, `search-filters.tsx`, `semantic-search-panel.tsx`) ใน `apps/web/components/search`
  - [ ] เชื่อมต่อ Search UI กับ Local State (`search-store.ts`) และ Server API

## Phase 11: Webhooks และ Background Jobs

- [ ] **Test:** เขียน Unit/Integration Tests สำหรับ Webhook Delivery และ Background Job Execution
- [ ] **Task:**
  - [ ] Implement Webhook Event Schema (ตาม SPEC ข้อ 8.2) ใน `apps/api/db/schema.ts`
  - [ ] พัฒนา API Endpoints สำหรับ Webhooks ใน `apps/api/routes/webhooks.ts` และ `apps/api/controllers/webhooks.controller.ts`
  - [ ] Implement Webhook Delivery Job ใน `apps/worker/jobs/webhook.ts`
  - [ ] ตั้งค่า Redis สำหรับ Job Status, Locks, Rate Limit ใน `packages/integrations/redis`

## Phase 12: Desktop Application (Core)

- [ ] **Test:** เขียน Unit/Integration Tests สำหรับ Local SQLite และ Sync Worker ใน Desktop App
- [ ] **Task:**
  - [ ] สร้างโปรเจกต์ `apps/desktop` (Tauri) พร้อมโครงสร้างพื้นฐาน
  - [ ] ตั้งค่า Local SQLite เป็นฐานข้อมูลหลักสำหรับ Desktop App (`apps/desktop/src-tauri/src/db.rs`)
  - [ ] Implement Local-first Editor Functionality ใน Desktop App
  - [ ] พัฒนา Sync Worker สำหรับ Desktop App (`apps/desktop/src-tauri/src/sync/`)

## Phase 13: การรวมระบบและปรับปรุงประสิทธิภาพ (Integration & Performance Optimization)

- [ ] **Test:** เขียน End-to-End Tests สำหรับการทำงานร่วมกันของระบบทั้งหมด และ Performance Tests
- [ ] **Task:**
  - [ ] ตรวจสอบและปรับปรุงการทำงานร่วมกันระหว่าง `apps/web`, `apps/api`, `apps/worker`, `apps/desktop` และ `packages/*`
  - [ ] Implement Caching Strategy โดยใช้ Redis (`packages/integrations/redis/cache.ts`)
  - [ ] Implement Rate Limiting ใน `apps/api/middlewares/rate-limit.ts`
  - [ ] ปรับปรุงประสิทธิภาพของ Database Queries และ API Responses
  - [ ] ตั้งค่า Monitoring และ Logging สำหรับระบบทั้งหมด

## Phase 14: การปรับใช้และเอกสารประกอบ (Deployment & Documentation)

- [ ] **Test:** เขียน Deployment Tests และ User Acceptance Tests (UAT)
- [ ] **Task:**
  - [ ] จัดทำ Deployment Scripts และ Configuration สำหรับ Production Environment
  - [ ] เขียน Technical Documentation สำหรับ Developer (API Docs, Architecture, Setup Guide)
  - [ ] เขียน User Manual และ Help Documentation สำหรับ End-users
  - [ ] จัดทำ Release Notes และ Versioning Strategy