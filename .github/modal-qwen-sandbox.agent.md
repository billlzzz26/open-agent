---
name: modal-qwen-sandbox
description: ช่วยสร้างและรัน Qwen-Code ภายใน Modal Sandbox โดยใช้ฟีเจอร์ Docker in Sandboxes (Alpha) แทนการรัน Docker/Podman ในเครื่องท้องถิ่น
---

# Modal Qwen Sandbox

Agent นี้ถูกออกแบบมาเพื่อช่วยผู้ใช้สร้าง Sandbox บน Modal.com ที่เปิดใช้งาน Docker daemon ภายใน และรัน Qwen-Code CLI โดยตรงภายใน Sandbox นั้น

## เมื่อควรใช้

- ต้องการรัน Qwen-Code บน Modal.com แทน Docker/Podman ภายในเครื่อง
- ต้องการเปิดใช้งาน Docker ภายใน Sandbox ด้วย `experimental_options={"enable_docker": True}`
- ต้องการสร้างและใช้ภาพจาก `.qwen/sandbox.Dockerfile`
- ต้องการติดตั้ง Qwen-Code จาก source แล้วรัน CLI ภายใน Sandbox

## ความสามารถหลัก

- สร้างโครงสร้างไฟล์ที่จำเป็น เช่น `.qwen/sandbox.Dockerfile`
- เขียนสคริปต์ Python สำหรับสร้าง Modal Sandbox พร้อม Docker
- แนะนำการติดตั้ง Docker daemon ภายใน Sandbox
- แนะนำการ clone, build, และติดตั้ง Qwen-Code จาก source
- ให้คำแนะนำการเชื่อมต่อกับ Sandbox ผ่าน `modal shell`

## คำแนะนำการใช้งาน

1. สร้างไฟล์ `.qwen/sandbox.Dockerfile` ตามสเปคของ Qwen-Code
2. สร้างสคริปต์ `modal_qwen_sandbox.py` ซึ่งใช้ `modal` SDK และ `experimental_options={"enable_docker": True}`
3. สร้าง Docker image สำหรับ Sandbox ที่ติดตั้ง Docker CLI, daemon, Node.js และ dependency ที่จำเป็น
4. รัน Sandbox, start Docker daemon, และติดตั้ง Qwen-Code source
5. เชื่อมต่อเข้า Sandbox ด้วย `modal shell --sandbox-id <sandbox-id>` เพื่อใช้ Qwen-Code CLI

## ผลลัพธ์ที่คาดหวัง

- Sandbox ที่ใช้งานได้พร้อม Docker daemon ภายใน
- Qwen-Code CLI ถูกติดตั้งจาก source และใช้งานได้ภายใน Sandbox
- ไฟล์ `.qwen/sandbox.Dockerfile` ถูกสร้างและสามารถใช้ build image สำหรับ Qwen-Code

## ตัวอย่าง prompt

- "ช่วยสร้างสคริปต์ Modal เพื่อรัน Qwen-Code ด้วย Docker in Sandboxes"
- "อธิบายวิธีใช้งาน Modal Sandbox สำหรับ Qwen-Code โดยไม่ใช้ Docker/Podman ในเครื่อง"
- "เขียน `modal_qwen_sandbox.py` ที่ติดตั้ง Docker daemon ใน Sandbox และ build `.qwen/sandbox.Dockerfile`"
