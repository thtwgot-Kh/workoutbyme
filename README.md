# Bulk Console

แดชบอร์ดคำนวณแคลอรี่ BMR/TDEE และอัตราการเพิ่มน้ำหนักต่อวัน พร้อมบันทึกเนื้อสัตว์/เวย์โปรตีน/คาร์บที่กินจริง แล้วเทียบกับเป้าหมายแบบเรียลไทม์

เป็น static site ล้วน (HTML/CSS/JS) ไม่มี backend ไม่มี build step — เปิดไฟล์ `index.html` ก็ใช้งานได้ทันที หรือจะ deploy ขึ้น GitHub Pages ก็ได้ฟรี

## โครงสร้างไฟล์

```
calorie-dashboard/
├── index.html          หน้าหลัก
├── assets/
│   ├── style.css        ธีม (dark console)
│   ├── data.js          ฐานข้อมูลโภชนาการ (เนื้อสัตว์ / คาร์บ)
│   └── script.js        ตรรกะการคำนวณทั้งหมด
└── README.md
```

## รันในเครื่องตัวเอง

ไม่ต้องติดตั้งอะไรเลย เปิด `index.html` ด้วยเบราว์เซอร์ได้โดยตรง หรือถ้าอยากรันผ่าน local server (กัน CORS/cache issue บางเบราว์เซอร์):

```bash
cd calorie-dashboard
python3 -m http.server 8000
# แล้วเปิด http://localhost:8000
```

## ตั้งค่าขึ้น GitHub (ครั้งแรก)

1. สร้าง repo ใหม่บน GitHub (ปุ่ม **New repository**) ตั้งชื่อ เช่น `bulk-console` — ไม่ต้องติ๊ก "Add README" เพราะมีอยู่แล้ว

2. ในเครื่อง เข้าไปที่โฟลเดอร์โปรเจกต์แล้วรัน:

```bash
cd calorie-dashboard
git init
git add .
git commit -m "Initial commit: Bulk Console dashboard"
git branch -M main
git remote add origin https://github.com/<username>/bulk-console.git
git push -u origin main
```

แทน `<username>` ด้วยชื่อบัญชี GitHub ของคุณ

## เปิดใช้งานผ่าน GitHub Pages (ฟรี ไม่ต้องมี server)

1. ไปที่ repo บน GitHub → **Settings** → **Pages** (เมนูซ้าย)
2. ใต้ **Build and deployment** เลือก Source = **Deploy from a branch**
3. เลือก Branch = `main`, Folder = `/ (root)` แล้วกด **Save**
4. รอประมาณ 1-2 นาที จะได้ลิงก์ประมาณ:
   `https://<username>.github.io/bulk-console/`

เข้าใช้งานได้จากมือถือ/คอมทุกเครื่องผ่านลิงก์นี้ ไม่ต้อง clone ซ้ำ

## อัปเดตหลังจากแก้ไขไฟล์

```bash
git add .
git commit -m "อัปเดต: <อธิบายสิ่งที่แก้>"
git push
```

GitHub Pages จะ deploy เวอร์ชันใหม่ให้อัตโนมัติภายในไม่กี่นาที

## ปรับแต่งเพิ่มเติม

- เพิ่ม/แก้รายการเนื้อสัตว์หรือคาร์บ → แก้ที่ `assets/data.js` (ค่าเป็นต่อ 100 กรัม)
- ปรับสูตรคำนวณ (BMR, surplus, สัดส่วนโปรตีน) → แก้ที่ `assets/script.js` ฟังก์ชัน `calc()`
- ปรับสีธีม/ฟอนต์ → แก้ตัวแปรใน `:root` ที่หัวไฟล์ `assets/style.css`

## หมายเหตุ

ค่าพลังงานที่ใช้: 1 กก. น้ำหนักตัว ≈ 7,700 kcal, BMR คำนวณด้วยสูตร Mifflin-St Jeor ค่าทั้งหมดเป็นค่าประมาณเพื่อการวางแผนทั่วไป ไม่ใช่คำแนะนำทางการแพทย์ — หากมีโรคประจำตัวหรือข้อกังวลด้านสุขภาพ ควรปรึกษาแพทย์หรือนักโภชนาการ
