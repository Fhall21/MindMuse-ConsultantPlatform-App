CREATE OR REPLACE FUNCTION enqueue_analytics_projection_refresh()
RETURNS trigger AS $$
DECLARE
  event_meeting_id uuid;
  event_consultation_id uuid;
  event_source_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    event_meeting_id := OLD.meeting_id;
    event_consultation_id := OLD.consultation_id;
    event_source_id := OLD.id;
  ELSE
    event_meeting_id := NEW.meeting_id;
    event_consultation_id := NEW.consultation_id;
    event_source_id := NEW.id;
  END IF;

  INSERT INTO analytics_outbox (
    meeting_id,
    consultation_id,
    event_type,
    source_table,
    source_id,
    payload
  )
  VALUES (
    event_meeting_id,
    event_consultation_id,
    'consultation_projection_refresh',
    'extraction_results',
    event_source_id,
    jsonb_build_object(
      'meetingId', event_meeting_id,
      'consultationId', event_consultation_id,
      'sourceTable', 'extraction_results',
      'sourceId', event_source_id,
      'operation', TG_OP
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_extraction_results_outbox ON extraction_results;

CREATE TRIGGER trg_extraction_results_outbox
  AFTER INSERT OR UPDATE OR DELETE ON extraction_results
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_analytics_projection_refresh();
