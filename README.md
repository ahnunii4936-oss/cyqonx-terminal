# CYQONX Terminal — Expo App

## วิธีโหลดลงมือถือ (ไม่ต้องคอม)

### ขั้นตอนที่ 1 — สมัคร GitHub
1. เปิด github.com/signup
2. สมัครฟรี ใช้ email ใดก็ได้

### ขั้นตอนที่ 2 — สมัคร Expo
1. เปิด expo.dev/signup
2. สมัครฟรี

### ขั้นตอนที่ 3 — สร้าง Repository บน GitHub
1. Login GitHub
2. กด + → New repository
3. ตั้งชื่อ: cyqonx-terminal
4. เลือก Public
5. กด Create repository

### ขั้นตอนที่ 4 — อัปโหลดไฟล์
Upload ไฟล์เหล่านี้ขึ้น GitHub:
- App.js
- package.json
- app.json
- babel.config.js
- eas.json

วิธี upload บน GitHub mobile:
1. เข้า repo ที่สร้าง
2. กด Add file → Upload files
3. เลือกไฟล์ทั้งหมด
4. กด Commit changes

### ขั้นตอนที่ 5 — เชื่อม Expo กับ GitHub
1. Login expo.dev
2. กด Create a project
3. เลือก Import from GitHub
4. เลือก repo cyqonx-terminal
5. กด Create project

### ขั้นตอนที่ 6 — Build แอป
1. ที่ expo.dev project ของคุณ
2. กด Build → New build
3. เลือก Android (APK) หรือ iOS
4. กด Build

รอประมาณ 15-20 นาที

### ขั้นตอนที่ 7 — โหลดลงมือถือ
- **Android**: กด Download → เปิด APK ติดตั้งได้เลย
- **iPhone**: ต้องใช้ TestFlight (ต้องมี Apple Developer $99)

## ทดสอบฟรีด้วย Expo Go

1. โหลด "Expo Go" จาก App Store หรือ Play Store
2. ที่ expo.dev project ของคุณ กด Open in Expo Go
3. สแกน QR code

