-- P0: Badhub's embedded DBV cards use /dbv/turnier.php?id=NNN.
-- Preserve the existing RLS and service role privileges unchanged.
begin;
alter table public.player_external_match_facts
 drop constraint if exists player_external_match_facts_source_url_check;
alter table public.player_external_match_facts
 add constraint player_external_match_facts_source_url_check
 check(source_url ~ '^https://badhub[.]de/(bwbv/(turnier|begegnung)|dbv/turnier)[.]php[?]id=[0-9]+$');
commit;
