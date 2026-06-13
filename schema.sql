-- ================================================
-- ระบบจองห้องประชุม — Database Schema (Supabase)
-- คณะวิทยาศาสตร์และนวัตกรรมดิจิทัล
-- ================================================
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ================================================

-- ===== PROFILES TABLE =====
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'ผู้ใช้ใหม่',
    email TEXT,
    role TEXT DEFAULT 'student' CHECK (role IN ('admin', 'staff', 'student')),
    department TEXT,
    student_id TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ROOMS TABLE =====
CREATE TABLE IF NOT EXISTS rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    building TEXT NOT NULL,
    floor INTEGER DEFAULT 1,
    capacity INTEGER NOT NULL DEFAULT 10,
    equipment JSONB DEFAULT '[]'::jsonb,
    image_url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    allowed_roles TEXT[] DEFAULT ARRAY['admin', 'staff', 'student'],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== BOOKINGS TABLE =====
CREATE TABLE IF NOT EXISTS bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    attendees_count INTEGER DEFAULT 1,
    admin_note TEXT,
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (start_time < end_time),
    CONSTRAINT valid_date CHECK (booking_date >= CURRENT_DATE)
);

-- ===== BOOKING LOGS TABLE =====
CREATE TABLE IF NOT EXISTS booking_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    changed_by UUID REFERENCES profiles(id),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_rooms_building ON rooms(building);
CREATE INDEX IF NOT EXISTS idx_rooms_capacity ON rooms(capacity);
CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date_room ON bookings(booking_date, room_id);
CREATE INDEX IF NOT EXISTS idx_booking_logs_booking ON booking_logs(booking_id);

-- ===== RLS =====
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_logs ENABLE ROW LEVEL SECURITY;

-- === Profiles Policies ===
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON profiles;
CREATE POLICY "Profiles viewable by authenticated"
    ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- === Rooms Policies ===
DROP POLICY IF EXISTS "Rooms viewable by all authenticated" ON rooms;
CREATE POLICY "Rooms viewable by all authenticated"
    ON rooms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin can insert rooms" ON rooms;
CREATE POLICY "Admin can insert rooms"
    ON rooms FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin can update rooms" ON rooms;
CREATE POLICY "Admin can update rooms"
    ON rooms FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin can delete rooms" ON rooms;
CREATE POLICY "Admin can delete rooms"
    ON rooms FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- === Bookings Policies ===
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
CREATE POLICY "Users can view own bookings"
    ON bookings FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR status = 'approved'
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Authenticated users can insert bookings" ON bookings;
CREATE POLICY "Authenticated users can insert bookings"
    ON bookings FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own pending bookings" ON bookings;
CREATE POLICY "Users can update own pending bookings"
    ON bookings FOR UPDATE TO authenticated
    USING (
        (user_id = auth.uid() AND status IN ('pending', 'approved'))
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- === Booking Logs Policies ===
DROP POLICY IF EXISTS "Booking logs viewable" ON booking_logs;
CREATE POLICY "Booking logs viewable"
    ON booking_logs FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_id AND bookings.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "System can insert booking logs" ON booking_logs;
CREATE POLICY "System can insert booking logs"
    ON booking_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ===== FUNCTIONS =====

-- Function: Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, avatar_url, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'ผู้ใช้ใหม่'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        'student'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Check room availability
CREATE OR REPLACE FUNCTION public.check_room_availability(
    p_room_id UUID,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM bookings
        WHERE room_id = p_room_id
        AND booking_date = p_date
        AND status IN ('pending', 'approved')
        AND id != COALESCE(p_exclude_booking_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND (
            (start_time < p_end_time AND end_time > p_start_time)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get booking statistics
CREATE OR REPLACE FUNCTION public.get_booking_stats(
    p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_bookings', (SELECT COUNT(*) FROM bookings WHERE booking_date BETWEEN p_start_date AND p_end_date),
        'approved', (SELECT COUNT(*) FROM bookings WHERE status = 'approved' AND booking_date BETWEEN p_start_date AND p_end_date),
        'pending', (SELECT COUNT(*) FROM bookings WHERE status = 'pending' AND booking_date BETWEEN p_start_date AND p_end_date),
        'rejected', (SELECT COUNT(*) FROM bookings WHERE status = 'rejected' AND booking_date BETWEEN p_start_date AND p_end_date),
        'cancelled', (SELECT COUNT(*) FROM bookings WHERE status = 'cancelled' AND booking_date BETWEEN p_start_date AND p_end_date),
        'total_rooms', (SELECT COUNT(*) FROM rooms WHERE is_active = true),
        'today_bookings', (SELECT COUNT(*) FROM bookings WHERE booking_date = CURRENT_DATE AND status IN ('approved', 'pending'))
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Promote to admin
CREATE OR REPLACE FUNCTION public.promote_to_admin(secret_code TEXT)
RETURNS JSON AS $$
BEGIN
    IF secret_code = 'sci-admin-2025' THEN
        UPDATE public.profiles
        SET role = 'admin', updated_at = NOW()
        WHERE id = auth.uid();
        RETURN json_build_object('success', true, 'message', 'อัพเกรดเป็น Admin สำเร็จ!');
    ELSE
        RETURN json_build_object('success', false, 'message', 'รหัส Admin ไม่ถูกต้อง');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== SAMPLE DATA =====
-- ห้องประชุมคณะวิทยาศาสตร์และนวัตกรรมดิจิทัล (18 ห้อง)
INSERT INTO rooms (name, building, floor, capacity, equipment, description, is_active, allowed_roles) VALUES
-- ห้องคอมพิวเตอร์
('SC1220', 'อาคาร SC', 2, 40, '["คอมพิวเตอร์", "โปรเจกเตอร์", "เครื่องปรับอากาศ", "ระบบ LAN"]'::jsonb, 'ห้องคอมพิวเตอร์ ชั้น 2 สำหรับปฏิบัติการคอมพิวเตอร์', true, ARRAY['admin', 'staff', 'student']),
('SC1222', 'อาคาร SC', 2, 40, '["คอมพิวเตอร์", "โปรเจกเตอร์", "เครื่องปรับอากาศ", "ระบบ LAN"]'::jsonb, 'ห้องคอมพิวเตอร์ ชั้น 2 สำหรับปฏิบัติการคอมพิวเตอร์', true, ARRAY['admin', 'staff', 'student']),

-- ห้องบรรยาย
('SC1221', 'อาคาร SC', 2, 50, '["โปรเจกเตอร์", "ไมโครโฟน", "เครื่องปรับอากาศ", "ไวท์บอร์ด"]'::jsonb, 'ห้องบรรยาย ชั้น 2', true, ARRAY['admin', 'staff', 'student']),
('SC1346', 'อาคาร SC', 3, 50, '["โปรเจกเตอร์", "ไมโครโฟน", "เครื่องปรับอากาศ", "ไวท์บอร์ด"]'::jsonb, 'ห้องบรรยาย ชั้น 3', true, ARRAY['admin', 'staff', 'student']),
('SC1443', 'อาคาร SC', 4, 50, '["โปรเจกเตอร์", "ไมโครโฟน", "เครื่องปรับอากาศ", "ไวท์บอร์ด"]'::jsonb, 'ห้องบรรยาย ชั้น 4', true, ARRAY['admin', 'staff', 'student']),
('SC1403', 'อาคาร SC', 4, 50, '["โปรเจกเตอร์", "ไมโครโฟน", "เครื่องปรับอากาศ", "ไวท์บอร์ด"]'::jsonb, 'ห้องบรรยาย ชั้น 4', true, ARRAY['admin', 'staff', 'student']),
('SC1404', 'อาคาร SC', 4, 50, '["โปรเจกเตอร์", "ไมโครโฟน", "เครื่องปรับอากาศ", "ไวท์บอร์ด"]'::jsonb, 'ห้องบรรยาย ชั้น 4', true, ARRAY['admin', 'staff', 'student']),
('SC2207', 'อาคาร SC', 2, 50, '["โปรเจกเตอร์", "ไมโครโฟน", "เครื่องปรับอากาศ", "ไวท์บอร์ด"]'::jsonb, 'ห้องบรรยาย ชั้น 2', true, ARRAY['admin', 'staff', 'student']),

-- ห้องประชุม Conference
('SC2218', 'อาคาร SC', 2, 20, '["โปรเจกเตอร์", "ระบบเสียง", "ไมโครโฟนไร้สาย", "กล้อง Video Conference", "เครื่องปรับอากาศ"]'::jsonb, 'ห้องประชุม Conference ชั้น 2 สำหรับการประชุมสำคัญ', true, ARRAY['admin', 'staff']),
('SC2226', 'อาคาร SC', 2, 20, '["โปรเจกเตอร์", "ไมโครโฟน", "เครื่องปรับอากาศ", "ไวท์บอร์ด"]'::jsonb, 'ห้องประชุม ชั้น 2', true, ARRAY['admin', 'staff']),
('SC2225', 'อาคาร SC', 2, 20, '["โปรเจกเตอร์", "ไมโครโฟน", "เครื่องปรับอากาศ", "ไวท์บอร์ด"]'::jsonb, 'ห้องประชุม ชั้น 2', true, ARRAY['admin', 'staff']),
('SC2219', 'อาคาร SC', 2, 20, '["โปรเจกเตอร์", "ไมโครโฟน", "เครื่องปรับอากาศ", "ไวท์บอร์ด"]'::jsonb, 'ห้องประชุม ชั้น 2', true, ARRAY['admin', 'staff']),

-- พื้นที่ทำงานร่วม
('Co-working Space', 'อาคาร SC', 1, 30, '["WiFi", "ปลั๊กไฟ", "โต๊ะทำงาน", "เครื่องปรับอากาศ"]'::jsonb, 'พื้นที่ทำงานร่วม Co-working Space สำหรับนิสิตและบุคลากร', true, ARRAY['admin', 'staff', 'student']),

-- ห้องเรียน/ห้องปฏิบัติการ
('SC1304', 'อาคาร SC', 3, 40, '["โปรเจกเตอร์", "เครื่องปรับอากาศ", "ไวท์บอร์ด"]'::jsonb, 'ห้องเรียน/ห้องปฏิบัติการ ชั้น 3', true, ARRAY['admin', 'staff', 'student']),
('SC1305', 'อาคาร SC', 3, 40, '["โปรเจกเตอร์", "เครื่องปรับอากาศ", "ไวท์บอร์ด"]'::jsonb, 'ห้องเรียน/ห้องปฏิบัติการ ชั้น 3', true, ARRAY['admin', 'staff', 'student']),
('SC1349', 'อาคาร SC', 3, 40, '["โปรเจกเตอร์", "เครื่องปรับอากาศ", "ไวท์บอร์ด"]'::jsonb, 'ห้องเรียน/ห้องปฏิบัติการ ชั้น 3', true, ARRAY['admin', 'staff', 'student']),

-- ห้องกิจกรรม/ห้องพิเศษ
('SC1440 (Pythagoras)', 'อาคาร SC', 4, 30, '["โปรเจกเตอร์", "ระบบเสียง", "ไมโครโฟน", "เครื่องปรับอากาศ"]'::jsonb, 'ห้องประชุม Pythagoras ชั้น 4 สำหรับกิจกรรมและสัมมนา', true, ARRAY['admin', 'staff', 'student']),
('Innovation Space', 'อาคาร SC', 1, 30, '["จอ LED", "WiFi", "ปลั๊กไฟ", "โต๊ะทำงาน", "เครื่องปรับอากาศ"]'::jsonb, 'พื้นที่นวัตกรรม Innovation Space สำหรับกิจกรรมสร้างสรรค์และ Workshop', true, ARRAY['admin', 'staff', 'student'])
ON CONFLICT DO NOTHING;
