-- One predictable refresh per day, staggered by club to avoid mass-crawling.
-- pg_cron uses UTC in this project; function is server-private, with fixed source host.
select cron.schedule('badminton-nuliga-moessingen-v96','10 4 * * *',$$select private.sync_nuliga_club('10777');$$);
select cron.schedule('badminton-nuliga-heilbronn-v96','20 4 * * *',$$select private.sync_nuliga_club('10892');$$);
select cron.schedule('badminton-nuliga-mannheim-v96','30 4 * * *',$$select private.sync_nuliga_club('10869');$$);
