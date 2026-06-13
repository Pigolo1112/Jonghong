/* ================================================
   ระบบจองห้องประชุม — Supabase Configuration
   คณะวิทยาศาสตร์และนวัตกรรมดิจิทัล
   ================================================
   
   📌 วิธีตั้งค่า:
   1. ไปที่ https://supabase.com → สร้าง Project ใหม่
   2. ไปที่ Project Settings → API
   3. คัดลอก "Project URL" และ "anon public" key มาใส่ด้านล่าง
   4. ไปที่ Authentication → Providers → เปิด Google (ถ้าต้องการ)
   5. ไปที่ SQL Editor → รัน schema.sql
   ================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 🔧 แก้ไขค่าด้านล่างนี้ด้วย Supabase config ของคุณ
const SUPABASE_URL = 'https://ssyqzdpwjganxlqmdayh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzeXF6ZHB3amdhbnhscW1kYXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODM2MDYsImV4cCI6MjA5NjU1OTYwNn0.ycHO9ncT-I8XgzcU1QWvwnNfKB1iJOyyxsRVcX1h_BQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
