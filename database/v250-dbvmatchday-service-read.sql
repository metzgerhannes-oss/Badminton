-- v250 scoped service-only tournament metadata for the private DBV worker.
GRANT SELECT (id,external_id,provider,start_date,end_date)
 ON public.tournaments TO service_role;