-- Resume individual historical match batches after the user leaves the app.
-- One externally sourced player per 30 minutes, globally capped by the claim
-- function to 36 HTTP source imports/day. No tokens or personal follows stored.
create or replace function private.continue_external_match_import()
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions,pg_temp as $$
declare chosen text; h record; response_status integer; response_text text;
begin
 select j.dbv_id into chosen
 from public.player_history_imports j
 join public.players p on p.dbv_id=j.dbv_id and p.verified_at is not null
 left join public.player_external_match_imports e on e.dbv_id=j.dbv_id
 where e.dbv_id is null
   or (e.status='partial' and e.cursor_offset<e.verified_count
       and e.last_started_at<now()-interval '15 minutes')
   or (e.status='error' and e.last_started_at<now()-interval '1 hour')
 order by coalesce(e.last_started_at,'2000-01-01'::timestamptz),j.requested_at
 limit 1;
 if chosen is null then return jsonb_build_object('processed',0,'reason','no_pending_job');end if;
 begin
  select x.status,x.content into response_status,response_text
   from extensions.http_post(
    'https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/history-match-import',
    jsonb_build_object('dbv_id',chosen,
      'public_key','sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE')::text,
    'application/json'
   ) x;
  return jsonb_build_object('processed',1,'dbv_id',chosen,'status',response_status,
                           'body',left(response_text,320));
 exception when others then
  return jsonb_build_object('processed',1,'dbv_id',chosen,
                           'error','Temporary worker HTTP error');
 end;
end $$;
revoke all on function private.continue_external_match_import() from public,anon,authenticated;
select cron.schedule('badminton-history-match-batches','*/30 * * * *',
 'select private.continue_external_match_import();');
