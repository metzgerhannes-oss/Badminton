-- Refresh the four publicly published BWBV region directories weekly, off peak.
select cron.schedule('badminton-nuliga-club-directory-v97','17 6 * * 0',
 $$select private.sync_nuliga_club_directory();$$);
