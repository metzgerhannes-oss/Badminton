-- v250: 5-minute dispatcher. When no active verified tournament exists it
-- returns without any network call. Source is queried only 07:00–22:00 Berlin.
SELECT cron.schedule('badminton-dbv-matchday-five-minutes',
 '*/5 * * * *','SELECT private.dispatch_dbv_matchday_v250();');