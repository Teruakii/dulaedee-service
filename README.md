# dulaedee-service

API ของแอป "ดูแลดี" สำหรับนับแคลอรี่เมนูไทย แนะนำมื้อถัดไป ติดตามน้ำและน้ำหนัก ดูแล routine ผิว และแนะนำคลิป YouTube เรื่องการกิน

Node 22+ · TypeScript · Express 5 · MongoDB · zod. โครงเดียวกับ `careo-service`: แต่ละ module มี model, dto, repo, service, handler และ module

## หน้าตาแอป

หน้าเว็บอยู่ที่ [`dulaedee-client-web`](https://github.com/Teruakii/dulaedee-client-web) ดูภาพทุกหน้าและที่มาของดีไซน์ได้ใน README ของ repo นั้น

| วันนี้ | อาหาร | สรุปและเหรียญ | ชาเลนจ์กลุ่ม |
|---|---|---|---|
| <img src="https://raw.githubusercontent.com/Teruakii/dulaedee-client-web/main/docs/screenshots/today.png" width="200" alt="หน้าวันนี้"> | <img src="https://raw.githubusercontent.com/Teruakii/dulaedee-client-web/main/docs/screenshots/food.png" width="200" alt="หน้าอาหาร"> | <img src="https://raw.githubusercontent.com/Teruakii/dulaedee-client-web/main/docs/screenshots/summary.png" width="200" alt="หน้าสรุป"> | <img src="https://raw.githubusercontent.com/Teruakii/dulaedee-client-web/main/docs/screenshots/group.png" width="200" alt="ชาเลนจ์กลุ่ม"> |

## เริ่มใช้งาน

```bash
docker compose up -d          # MongoDB ที่ 27017 (ต้องเปิด Docker Desktop)
cp .env.example .env          # แล้วตั้ง JWT_SECRET_KEY ใหม่
npm install
npm run dev                   # http://localhost:3200
```

ถ้าไม่ได้ตั้ง `SEED_ADMIN_PASSWORD` ระบบจะสุ่มรหัสของผู้ใช้ `admin` แล้วพิมพ์ลง log ครั้งเดียวตอนฐานข้อมูลว่าง

## ตรวจ

```bash
npm run typecheck   # tsc รวมไฟล์ test
npm test            # unit test ของสูตรคำนวณ การแนะนำเมนู ส่วนผสมชนกัน และ auth
npm run smoke       # เปิด server จริงกับ MongoDB ในหน่วยความจำ แล้วเดิน flow หลักผ่าน HTTP
npm run build
npm run dev:demo    # API ที่ 3200 กับ MongoDB ในหน่วยความจำ + ข้อมูลตัวอย่างตาม mockup
```

## Modules

| Path | สิทธิ์ | หน้าที่ |
|---|---|---|
| `/auth` | สาธารณะ / login | สมัคร (MEMBER), login ด้วย username หรืออีเมล, `/me` ต่ออายุด้วย refresh cookie, Google login, ยืนยันอีเมล (`/verify-email`), ลืม/เปลี่ยนรหัส |
| `/users` | ADMIN | จัดการบัญชี |
| `/profile` | เจ้าของ | ข้อมูลร่างกาย เป้าหมาย สภาพผิว การแจ้งเตือน และงบต่อวัน · `POST /profile/calc` เปิดสาธารณะ |
| `/foods` | login · แก้ไข ADMIN/STAFF | ฐานเมนูไทย ค้นหา และ `/foods/recommend` เมนูที่พอดีงบที่เหลือ |
| `/daylogs` | เจ้าของ | บันทึกรายวัน: มื้ออาหาร น้ำ น้ำหนัก ขั้นตอนผิวที่ทำแล้ว และกราฟย้อนหลัง |
| `/skin` | เจ้าของ | ผลิตภัณฑ์ routine เช้า/ก่อนนอน และเตือนส่วนผสมชนกัน |
| `/clips` | login · คัดคลิป ADMIN/STAFF | คลิป YouTube ที่ผูกกับเมนู และ `/clips/recommend` |
| `/weather` | login | UV และความชื้นจาก Open-Meteo พร้อม code คำแนะนำ |

## ข้อมูลที่ต้องเติมก่อนใช้จริง

- เมนูเริ่มต้นใน `src/modules/food/food.seed.ts` เป็นค่าประมาณ (`verified: false`) ต้องเทียบกับตาราง INMUCAL หรือกรมอนามัย
- ยังไม่มีคลิปในระบบ ทีมงานเพิ่มผ่าน `POST /clips` โดยใส่ลิงก์ YouTube และ id เมนูที่เกี่ยวข้อง
- ตาราง `CLASHES` ใน `src/modules/skin/clash.ts` เป็นข้อมูลทั่วไป ควรให้แพทย์ผิวหนังตรวจ
