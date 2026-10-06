-- Migration: Add chapters and meta columns to reports table
-- These support the new 4-step wizard report creation flow

-- Add chapters JSONB column (array of chapter objects)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS chapters JSONB DEFAULT '[]'::jsonb;

-- Add meta JSONB column (report metadata: style, dates, addressee, etc.)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN reports.chapters IS 'Chapter-based report structure: array of {id, title, key, photos, description, ai_generated, sort_order}';
COMMENT ON COLUMN reports.meta IS 'Report metadata: {input_pattern, report_style, survey_date, addressee, construction_name, purpose}';
