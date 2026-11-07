-- Bridge the officially verified DBV calendar to the tournament metadata cache.
-- Never create a match, player association, set score or live claim from calendar rows.
-- Only the existing service role's DBV calendar upsert can trigger the invoker.
CREATE OR REPLACE FUNCTION private.sync_verified_dbv_calendar_tournament()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $func$
BEGIN
  IF NEW.source_url IS DISTINCT FROM 'https://turniere.badminton.de/'
     OR NEW.event_url IS NULL
     OR NEW.event_url !~* '^https://dbv[.]turnier[.]de/tournament/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
     OR NEW.end_date < CURRENT_DATE - 1
     OR NEW.start_date > CURRENT_DATE + 60 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tournaments
    (provider, external_id, name, city, start_date, end_date, status, source_url)
  VALUES
    ('dbv.turnier.de', split_part(NEW.event_url, '/tournament/', 2)::uuid,
     NEW.title, NEW.location_text, NEW.start_date, NEW.end_date,
     'scheduled', NEW.event_url)
  ON CONFLICT (provider, external_id) DO UPDATE
    SET name = EXCLUDED.name, city = EXCLUDED.city,
        start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date
    WHERE public.tournaments.source_url = EXCLUDED.source_url
       OR public.tournaments.source_url IS NULL;
  RETURN NEW;
END;
$func$;

REVOKE ALL ON FUNCTION private.sync_verified_dbv_calendar_tournament()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.sync_verified_dbv_calendar_tournament()
  TO service_role;

DROP TRIGGER IF EXISTS trg_verified_dbv_calendar_tournament
  ON public.dbv_calendar_entries;
CREATE TRIGGER trg_verified_dbv_calendar_tournament
AFTER INSERT OR UPDATE OF event_url, source_url, title, location_text,
  start_date, end_date
ON public.dbv_calendar_entries
FOR EACH ROW EXECUTE FUNCTION private.sync_verified_dbv_calendar_tournament();

-- One bounded initial metadata backfill; no historical mirror.
INSERT INTO public.tournaments
  (provider, external_id, name, city, start_date, end_date, status, source_url)
SELECT 'dbv.turnier.de',
  split_part(calendar.event_url, '/tournament/', 2)::uuid,
  calendar.title, calendar.location_text, calendar.start_date,
  calendar.end_date, 'scheduled', calendar.event_url
FROM (
  SELECT DISTINCT ON (event_url) event_url, title, location_text,
    start_date, end_date
  FROM public.dbv_calendar_entries
  WHERE source_url = 'https://turniere.badminton.de/'
    AND event_url ~* '^https://dbv[.]turnier[.]de/tournament/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    AND end_date >= CURRENT_DATE - 1
    AND start_date <= CURRENT_DATE + 60
  ORDER BY event_url, last_seen_at DESC NULLS LAST
) calendar
ON CONFLICT (provider, external_id) DO UPDATE
  SET name = EXCLUDED.name, city = EXCLUDED.city,
      start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date
  WHERE public.tournaments.source_url = EXCLUDED.source_url
     OR public.tournaments.source_url IS NULL;
