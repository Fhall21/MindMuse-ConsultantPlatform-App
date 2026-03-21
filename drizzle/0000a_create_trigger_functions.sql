-- Stage X: Shared trigger functions
-- Utility functions used across multiple tables

-- ============================================================
-- update_updated_at_column()
-- Automatically updates the updated_at timestamp on row update.
-- Used by tables that track modification time.
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
