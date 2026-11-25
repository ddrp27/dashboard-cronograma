-- ============================================================================
-- CRONOGRAMA AGLAB — CALENDARIO V2 (MIGRACIÓN 100% ADITIVA Y SEGURA)
-- Mantiene intactas las tablas existentes: custom_events y app_users.
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================================

-- 1. Extender app_users de forma segura con columna de correo para citas Teams
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Tabla de respaldo/sincronización del cronograma maestro
CREATE TABLE IF NOT EXISTS master_schedule (
  id TEXT PRIMARY KEY,
  file_name TEXT,
  data JSONB,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Registro dinámico de marcas (extensible en vivo sin redeploy)
CREATE TABLE IF NOT EXISTS app_brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INT DEFAULT 100,
  is_shared BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO app_brands (id, name, color, sort_order, is_shared) VALUES
  ('AG LAB', 'AG LAB', '#4f46e5', 10, false),
  ('NATIVA', 'NATIVA', '#059669', 20, false),
  ('AZZORTI', 'AZZORTI', '#e11d48', 30, false),
  ('LIVVA', 'LIVVA', '#8b5cf6', 40, false),
  ('Azz Livv', 'Azz Livv', '#0284c7', 50, true)
ON CONFLICT (id) DO NOTHING;

-- 4. Metadatos colaborativos de tarjetas (oficiales ACT_... y extras CUST_...)
CREATE TABLE IF NOT EXISTS schedule_cards (
  card_key TEXT PRIMARY KEY,
  act_no INT,
  campaign_id TEXT,
  owners TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pendiente',
  custom_color TEXT,
  brand_override TEXT,
  override_date TEXT,
  summary_note TEXT DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Hilo de notas / comentarios por tarjeta
CREATE TABLE IF NOT EXISTS card_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_key TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Centro de notificaciones in-app por usuario
CREATE TABLE IF NOT EXISTS app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id TEXT NOT NULL,
  actor_id TEXT,
  card_key TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Suscripciones Web Push PWA (PC y Celular)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Índices para consultas instantáneas
CREATE INDEX IF NOT EXISTS idx_card_notes_key_created
  ON card_notes (card_key, created_at);

CREATE INDEX IF NOT EXISTS idx_app_notifications_recipient_created
  ON app_notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions (user_id);

-- 9. Políticas RLS permisivas (idempotentes)
ALTER TABLE master_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "master_schedule_all_access" ON master_schedule FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "app_brands_all_access" ON app_brands FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "schedule_cards_all_access" ON schedule_cards FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "card_notes_all_access" ON card_notes FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "app_notifications_all_access" ON app_notifications FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "push_subscriptions_all_access" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 10. Publicación en tiempo real segura (supabase_realtime)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE master_schedule;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE app_brands;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE schedule_cards;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE card_notes;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
