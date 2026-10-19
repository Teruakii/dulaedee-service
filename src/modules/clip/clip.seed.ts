// คลิปสอนทำเมนูไทยที่มีอยู่จริงบน YouTube · คัดเมื่อ 2026-10-14 ชื่อคลิปตรงกับเมนู ยืนยันด้วย oEmbed ว่าเปิดดูและฝังได้
// ผูกกับเมนูด้วยชื่อ (nameTh ใน food.seed) แล้วแปลงเป็น id ตอน seed · admin ลบหรือเพิ่มเองได้ในหน้าจัดการ
export type SeedClip = { youtubeId: string; title: string; channel: string; durationSec: number; foods: string[] }

export const SEED_CLIPS: SeedClip[] = [
  { youtubeId: "aROCPCKzbR0", title: "วิธีทำข้าวมันไก่ ด้วยหม้อหุงข้าว พร้อมสูตรน้ำจิ้มไม่ต้องปั่น - Easy Chicken Rice  l กินได้อร่อยด้วย", channel: "กินได้อร่อยด้วย", durationSec: 561, foods: ["ข้าวมันไก่"] },
  { youtubeId: "noQTuNaSItI", title: "กะเพราหมูสับ วิธีทำผัดกะเพราหมู  สอนทำอาหาร สูตรอาหาร ทำกินเองง่ายๆ", channel: "Tomjoke", durationSec: 159, foods: ["ข้าวกะเพราหมูสับ"] },
  { youtubeId: "UsSUEAzvNMw", title: "เทคนิคทำ กะเพราไก่ หอมๆ เผ็ดร้อนถึงใจ - Stir fried chicken with basil. กระเพราไก่ l กินได้อร่อยด้วย", channel: "กินได้อร่อยด้วย", durationSec: 480, foods: ["ข้าวกะเพราไก่ไข่ดาว"] },
  { youtubeId: "7KjW4aNdkAE", title: "เทคนิคทำ ผัดกะเพรากุ้ง ให้หอมอร่อย กุ้งกรอบเด้ง พร้อมวิธีดึงเส้นดำไม่ต้องผ่าหลัง l กินได้อร่อยด้วย", channel: "กินได้อร่อยด้วย", durationSec: 346, foods: ["กะเพรากุ้ง (ไม่มีข้าว)"] },
  { youtubeId: "7pfWcuf40uY", title: "วิธีทำ โจ๊กหมู ข้าวสุกไว ข้นไม่คืนตัว หมูก้อนนุ่มเด้ง ไข่ลวก ตับนุ่ม สูตรทำขาย l กินได้อร่อยด้วย", channel: "กินได้อร่อยด้วย", durationSec: 1054, foods: ["โจ๊กหมูใส่ไข่"] },
  { youtubeId: "do4AVo1pm-E", title: "ต้มยำกุ้งน้ำใส ใส่เห็ด กุ้งเด้ง ถึงรสถึงสมุนไพร แซ่บถึงใจ", channel: "ดีกว่ากินดิน Eatdincooking", durationSec: 429, foods: ["ต้มยำกุ้งน้ำใส","ต้มยำกุ้งน้ำใส + ข้าวกล้อง 1 ทัพพี"] },
  { youtubeId: "Tz7jH-XijB4", title: "วิธีทำ ต้มยำกุ้งน้ำข้น ให้น้ำซุปเข้มข้น สีสวย รสจัดจ้าน ซดน้ำหมดหม้อ Tom Yum Kung l กินได้อร่อยด้วย", channel: "กินได้อร่อยด้วย", durationSec: 660, foods: ["ต้มยำกุ้งน้ำข้น"] },
  { youtubeId: "zFpKXjIvHYo", title: "ส้มตำไทย ตำไทยสูตรทำขาย รสชาติแซบๆ สร้างอาชีพ สร้างรายได้ PapayaSalad", channel: "ยายแต้วครัวคำโตโต", durationSec: 382, foods: ["ส้มตำไทย","ส้มตำไทย + ไก่ย่าง 1 ไม้"] },
  { youtubeId: "o1MX6FLbQts", title: "สูตรหมักไก่ย่าง ไก่ย่างแดงไม้ 10 บาท โครงไก่ย่าง สูตรไก่นุ่มฉ่ำ ทิ้งไว้นานก็ไม่แห้งกระด้าง", channel: "เติมไขมัน Channel", durationSec: 464, foods: ["ไก่ย่าง","ส้มตำไทย + ไก่ย่าง 1 ไม้"] },
  { youtubeId: "GLEbZGEAbkM", title: "สุกี้น้ำ สูตรหมักหมูนุ่มๆแป๊บเดียวได้ทานเลย ทำกินเองที่บ้านง่ายๆ อร่อยจุใจไม่ต้องซื้อ", channel: "ครัวบ้านนอก คนบ้านๆ", durationSec: 334, foods: ["สุกี้น้ำไก่"] },
  { youtubeId: "_OaaDSn0Mrg", title: "วิธีทําน้ํายําวุ้นเส้น ให้อร่อย ยำวุ้นเส้นหมูสับหมูยอสูตรทำขาย", channel: "ครัวบันนี่", durationSec: 210, foods: ["ยำวุ้นเส้น"] },
  { youtubeId: "AvR_dM6qsWM", title: "ผัดไทยกุ้งสด ทำเองง่ายๆอร่อยด้วย | นายต้มโจ๊ก", channel: "Tomjoke", durationSec: 692, foods: ["ผัดไทยกุ้งสด"] },
  { youtubeId: "8DEc07IlIr8", title: "วิธีผัดข้าวผัดให้อร่อย ข้าวผัดหมู ข้าวผัดหมูนุ่ม หอมกลิ่นคั่วกระทะ สไตล์ร้านอาหาร ทำกินเองได้ที่บ้าน", channel: "ครัวบ้านสวนทวี - Baan Suan Tawee Cooking", durationSec: 534, foods: ["ข้าวผัดหมู"] },
  { youtubeId: "695L6df1wjY", title: "แกงเขียวหวานไก่ น้ำแกงสีสวย มะเขือไม่ดำ ไก่ไม่คาว หอมอร่อยทำกินเองที่บ้านง่ายๆ", channel: "Tomjoke", durationSec: 303, foods: ["แกงเขียวหวานไก่ (ไม่มีข้าว)"] },
  { youtubeId: "bKVoWu5xhxA", title: "[แจกสูตร] แกงจืดเต้าหู้หมูสับ - สูตรลับของเจ๊หมู", channel: "TidReview ชีวิตติดรีวิว", durationSec: 202, foods: ["แกงจืดเต้าหู้หมูสับ"] },
  { youtubeId: "gpQerDBY8ak", title: "ข้าวซอยไก่ ข้าวซอยสูตรเหนือ ทำง่าย อร่อยได้ทุกภาค | FoodTravel ทำอาหาร", channel: "FoodTravelTVChannel", durationSec: 324, foods: ["ข้าวซอยไก่"] },
  { youtubeId: "pAKxqsiLGrw", title: "แจกสูตร ขาหมูพะโล้โบราณ เทคนิคตุ๋นขาหมูให้เปื่อยนุ่ม แต่ไม่เละ พร้อมสูตรน้ำจิ้ม l กินได้อร่อยด้วย", channel: "กินได้อร่อยด้วย", durationSec: 942, foods: ["ข้าวขาหมู"] },
  { youtubeId: "Kc7GtesxigA", title: "วิธีทำปลาเผาเกลือง่ายๆเคล็ดลับทาเกลือให้ติดตัวปลาเหมือนร้านปลาเผา/ครัวกัณฐมณี channel", channel: "ครัว กัณฐมณี Channel", durationSec: 433, foods: ["ปลาเผาเกลือ (ครึ่งตัว)"] },
  { youtubeId: "0rseP0Vwt3k", title: "สลัดอกไก่ย่างพริกไทยดำ เมนูเพื่อสุขภาพ ง่าย ๆ | JJ EAT LOVER", channel: "JJ EAT LOVER", durationSec: 199, foods: ["สลัดอกไก่"] },
  { youtubeId: "yzFiKwDGAqw", title: "วิธีชงชาเย็น 5 ลิตร สูตรทำขาย ใส่ขวด ใส่เหยือก ก็อร่อยเข้มข้นหอมหวานมัน สีสวยด้วยชาตรามือ 2 ชนิด", channel: "ครัวแม่โบ BowCooking", durationSec: 411, foods: ["ชาเย็น"] },
]
