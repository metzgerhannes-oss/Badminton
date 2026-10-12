-- v97: verified archive mapping, 2025/26. Historic clubTeams URL does not
-- select old seasons, so source group IDs were checked against league tables.
insert into public.league_teams
(id,follow_key,provider,club_id,club_name,team_label,league_name,season,position,points_for,points_against,source_url,source_checked_at,official_team_name)
select 'nuliga:'||v.club_id||':2025-26:'||v.seq,
 'nuliga:'||v.club_id||':'||v.seq,'nuliga',v.club_id,c.name,v.roman,v.league,'2025/26',
 null,null,null,
 'https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/groupPage?championship='||v.champ||'+25%2F26&group='||v.group_id,
 now(),v.official
from (values
 ('10777','1','I','35135','BWBV','Baden-Württemberg-Liga','SpVgg. Mössingen'),
 ('10777','3','III','35313','SW','Verbandsliga Südwürttemberg','SpVgg. Mössingen III'),
 ('10777','5','V','35321','SW','Kreisliga Tübingen / Böblingen','SpVgg. Mössingen V'),
 ('10858','2','II','35321','SW','Kreisliga Tübingen / Böblingen','TSV Gomaringen II'),
 ('10868','1','I','35135','BWBV','Baden-Württemberg-Liga','TuS Metzingen'),
 ('10868','2','II','35313','SW','Verbandsliga Südwürttemberg','TuS Metzingen II'),
 ('10892','1','I','35135','BWBV','Baden-Württemberg-Liga','SG Heilbronn/Leingarten')
) as v(club_id,seq,roman,group_id,champ,league,official)
join public.league_clubs c on c.id=v.club_id
on conflict(id) do nothing;
