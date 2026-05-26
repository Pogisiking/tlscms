-- Migration to allow multiple share capital contributions per member
-- by removing the unique constraint on member_id.

ALTER TABLE share_capitals
DROP CONSTRAINT IF EXISTS share_capitals_member_id_key;

-- Create a trigger function to update member summaries automatically
CREATE OR REPLACE FUNCTION fn_trigger_update_member_summary_share()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM update_member_summary(COALESCE(NEW.member_id, OLD.member_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach the trigger to the share_capitals table
DROP TRIGGER IF EXISTS trg_update_member_summary_share ON share_capitals;
CREATE TRIGGER trg_update_member_summary_share
AFTER INSERT OR UPDATE OR DELETE ON share_capitals
FOR EACH ROW
EXECUTE FUNCTION fn_trigger_update_member_summary_share();

-- Perform a one-time sync to update all member totals accurately
DO $$ 
DECLARE 
    m_record RECORD;
BEGIN
    FOR m_record IN SELECT id FROM members LOOP
        PERFORM update_member_summary(m_record.id);
    END LOOP;
END $$;