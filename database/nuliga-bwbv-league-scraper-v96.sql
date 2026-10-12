-- v96: source-backed league season import. Bounded to three vetted BWBV clubs.
-- All outbound requests stay on a fixed nuLiga host; no user-controlled target URLs.
-- Each club sync is atomic: unexpected HTML raises before any partial data commits.
create or replace function private.nuliga_clean(p_html text) returns text
language sql immutable set search_path = pg_catalog
as $$
 select btrim(regexp_replace(
   replace(replace(replace(replace(replace(replace(
    regexp_replace(coalesce(p_html,''),'<[^>]*>','','g'),
    '&nbsp;',' '),'&#160;',' '),'&quot;','"'),'&amp;','&'),'&apos;',chr(39)),'&ndash;','–'),
   '[[:space:]]+',' ','g'))
$$;

create or replace function private.nuliga_cells(p_row text) returns text[]
language sql immutable set search_path = pg_catalog
as $$
 select coalesce(array_agg(private.nuliga_clean(split_part(piece,'</td>',1)) order by n),array[]::text[])
 from regexp_split_to_table(coalesce(p_row,''),'<td[^>]*>') with ordinality as x(piece,n)
 where n>1
$$;

create or replace function private.sync_nuliga_club(p_club_id text)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare
 base_url constant text := 'https://bwbv-badminton.liga.nu';
 expected_season constant text := '2026/27';
 club_html text; club_reply extensions.http_response;
 group_reply extensions.http_response; full_reply extensions.http_response;
 team_rec record; grp text; page_path text; splitrow text;
 vals text[]; rank int; pf int; pa int; pstr text; label text;
 group_html text; table_html text; fixtures_html text; full_url text;
 standings_count int; schedule_count int; team_games int; total_standings int :=0; total_games int:=0; groups_count int:=0;
 previous_date text; d text; tm text; h text; a text; score text; link_path text; link_url text;
 hg int; ag int; match_status text; event_time timestamptz; fixture_id text;
 teams_count int:=0; matched_teams int:=0;
begin
 if p_club_id not in ('10777','10892','10869') then
   raise exception 'Unsupported nuLiga pilot club';
 end if;
 select * into club_reply from extensions.http_get((base_url||'/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club='||p_club_id)::varchar);
 club_html:=club_reply.content;
 if club_reply.status<>200 or length(club_html)>350000 or
     club_html not like '%Mannschaften und Ligeneinteilung%' or
     club_html not like '%2026/2027%' then
   raise exception 'Unusable nuLiga club response for % (HTTP %)',p_club_id,club_reply.status;
 end if;
 for team_rec in select * from public.league_teams where club_id=p_club_id and season=expected_season order by id loop
   teams_count:=teams_count+1;
   label := case when team_rec.team_label='I' then 'Aktive' else 'Aktive '||team_rec.team_label end;
   page_path:=null;
   for splitrow in select part from regexp_split_to_table(club_html,'<tr[^>]*>') as src(part) loop
     vals:=private.nuliga_cells(splitrow);
     if cardinality(vals)>=5 and vals[1]=label then
       page_path:=replace(substring(splitrow from 'href="([^"]*groupPage[^"]*)"'),'&amp;','&');
       exit;
     end if;
   end loop;
   if page_path is null or page_path !~ '^/cgi-bin/WebObjects/nuLigaBADDE[.]woa/wa/groupPage[?]' or
      page_path !~ '[?&]group=[0-9]{4,7}(&|$)' or
      page_path not like '%26%2F27%' then
      raise exception 'Source group not found for club %, team %',p_club_id,label;
   end if;
   pstr:=vals[5]; pf:=null; pa:=null;
   if pstr~'^[0-9]{1,3}:[0-9]{1,3}$' then
     pf:=split_part(pstr,':',1)::int; pa:=split_part(pstr,':',2)::int;
   end if;
   update public.league_teams
      set source_url=base_url||page_path,league_name=vals[2],
        position=case when vals[4]~'^[0-9]+$' then vals[4]::int else null end,
        points_for=pf, points_against=pa,source_checked_at=now()
      where id=team_rec.id;
   matched_teams:=matched_teams+1;
 end loop;
 if teams_count=0 or matched_teams<>teams_count then raise exception 'Unverified club team coverage'; end if;
 for grp in select distinct source_url from public.league_teams where club_id=p_club_id and season=expected_season loop
   groups_count:=groups_count+1;
   select * into group_reply from extensions.http_get(grp::varchar);
   group_html:=group_reply.content;
   if group_reply.status<>200 or length(group_html)>750000 then raise exception 'Bad table response %',grp; end if;
   table_html:=substring(group_html from '(?s)<h2>Tabelle</h2>(.*?)</table>');
   if table_html is null then raise exception 'No official table for %',grp; end if;
   full_url:=replace(grp,'/groupPage?','/groupPage?displayTyp=gesamt&displayDetail=meetings&');
   select * into full_reply from extensions.http_get(full_url::varchar);
   if full_reply.status<>200 or length(full_reply.content)>1200000 then
     raise exception 'Bad full season response % HTTP %',full_url,full_reply.status;
   end if;
   fixtures_html:=substring(full_reply.content from '(?s)<h2>Spielplan[^<]*</h2>(.*?)</table>');
   if fixtures_html is null then raise exception 'No complete Spielplan for %',grp; end if;
   standings_count:=0;
   for splitrow in select part from regexp_split_to_table(table_html,'<tr[^>]*>') as src(part) loop
     vals:=private.nuliga_cells(splitrow);
     if cardinality(vals)>=8 and vals[2] ~ '^[0-9]+$' and vals[3]<>'' and vals[8] ~ '^[0-9]+:[0-9]+$' then standings_count:=standings_count+1; end if;
   end loop;
   schedule_count:=0;
   for splitrow in select part from regexp_split_to_table(fixtures_html,'<tr[^>]*>') as src(part) loop
     vals:=private.nuliga_cells(splitrow);
     if cardinality(vals)>=7 and vals[5]<>'' and vals[6]<>'' then schedule_count:=schedule_count+1; end if;
   end loop;
   if standings_count<3 or standings_count>24 or schedule_count<3 or schedule_count>350 then
     raise exception 'Incomplete staffel % standings %, fixtures %',grp,standings_count,schedule_count;
   end if;
   for team_rec in select * from public.league_teams where source_url=grp and club_id=p_club_id and season=expected_season loop
     delete from public.league_table_rows where team_id=team_rec.id;
     label:=team_rec.club_name||case when team_rec.team_label='I' then '' else ' '||team_rec.team_label end;
     for splitrow in select part from regexp_split_to_table(table_html,'<tr[^>]*>') as src(part) loop
       vals:=private.nuliga_cells(splitrow);
       if cardinality(vals)<8 or vals[2] !~ '^[0-9]+$' or vals[3]='' or vals[8] !~ '^[0-9]+:[0-9]+$' then continue; end if;
       rank:=vals[2]::int; pstr:=vals[8];
       pf:=split_part(pstr,':',1)::int;pa:=split_part(pstr,':',2)::int;
       insert into public.league_table_rows(id,team_id,position,club_team,played,won,drawn,lost,
         points_for,points_against,games_for,games_against,sets_for,sets_against,source_url,source_checked_at)
       values(team_rec.id||':rank:'||rank,team_rec.id,rank,vals[3],
        case when vals[4]~'^[0-9]+$' then vals[4]::int else null end,
        case when vals[5]~'^[0-9]+$' then vals[5]::int else null end,
        case when vals[6]~'^[0-9]+$' then vals[6]::int else null end,
        case when vals[7]~'^[0-9]+$' then vals[7]::int else null end,
        pf,pa,
        case when cardinality(vals)>=9 and vals[9]~'^[0-9]+:[0-9]+$' then split_part(vals[9],':',1)::int else null end,
        case when cardinality(vals)>=9 and vals[9]~'^[0-9]+:[0-9]+$' then split_part(vals[9],':',2)::int else null end,
        case when cardinality(vals)>=10 and vals[10]~'^[0-9]+:[0-9]+$' then split_part(vals[10],':',1)::int else null end,
        case when cardinality(vals)>=10 and vals[10]~'^[0-9]+:[0-9]+$' then split_part(vals[10],':',2)::int else null end,
        grp,now());
       total_standings:=total_standings+1;
       if vals[3]=label then
         update public.league_teams set position=rank,points_for=pf,points_against=pa,source_checked_at=now() where id=team_rec.id;
       end if;
     end loop;
     delete from public.league_fixtures where team_id=team_rec.id;
     previous_date:=null;team_games:=0;
     for splitrow in select part from regexp_split_to_table(fixtures_html,'<tr[^>]*>') as src(part) loop
       vals:=private.nuliga_cells(splitrow);
       if cardinality(vals)<7 then continue; end if;
       d:=vals[2];
       if d ~ '^[0-9]{2}[.][0-9]{2}[.][0-9]{4}$' then previous_date:=d; end if;
       h:=vals[5];a:=vals[6];
       if h<>label and a<>label then continue; end if;
       if previous_date is null then raise exception 'Fixture date missing for %',grp; end if;
       tm:=substring(vals[3] from '[0-9]{2}:[0-9]{2}');
       event_time:=null;
       if tm is not null then
         event_time:=make_timestamptz(substr(previous_date,7,4)::int,substr(previous_date,4,2)::int,
          substr(previous_date,1,2)::int,substr(tm,1,2)::int,substr(tm,4,2)::int,0,'Europe/Berlin');
       end if;
       score:=vals[7];hg:=null;ag:=null;match_status:='scheduled';
       link_path:=replace(substring(splitrow from 'href="([^"]*groupMeetingReport[^"]*)"'),'&amp;','&');
       if score ~ '^[0-8]:[0-8]([[:space:]].*)?$' and link_path is not null then
         hg:=split_part(score,':',1)::int;
         ag:=substring(score from '^[0-8]:([0-8])')::int;
         if hg+ag<>8 then hg:=null;ag:=null;match_status:='unknown';
         elsif score ~* 'NA|kampflos|wertung' then match_status:='forfeit';
         else match_status:='finished';end if;
       end if;
       if link_path is not null and link_path~'^/cgi-bin/WebObjects/nuLigaBADDE[.]woa/wa/groupMeetingReport[?]' and link_path ~ '[?&]meeting=[0-9]+' then
         link_url:=base_url||link_path;
       else link_url:=grp;end if;
       fixture_id:=team_rec.id||':game:'||md5(grp||'|'||previous_date||'|'||coalesce(tm,'')||'|'||h||'|'||a);
       insert into public.league_fixtures(id,team_id,match_date,home_team,away_team,home_score,away_score,status,source_url,source_checked_at)
       values(fixture_id,team_rec.id,event_time,h,a,hg,ag,match_status,link_url,now());
       team_games:=team_games+1;
       total_games:=total_games+1;
     end loop;
     if team_games<1 then raise exception 'No fixtures found for %',label; end if;
   end loop;
 end loop;
 return jsonb_build_object('club_id',p_club_id,'teams',matched_teams,'groups',groups_count,
  'table_rows',total_standings,'fixtures',total_games,'synced_at',now());
end;
$$;

revoke all on function private.nuliga_clean(text),private.nuliga_cells(text),
private.sync_nuliga_club(text) from public,anon,authenticated;