-- v54: READ-ONLY RELEASE AUDIT for the Badminton Supabase project.
-- This script does not modify privileges or grant a role elevated access.
-- Run after every new public-table migration, also review Supabase Security Advisor.
-- Result A: no table with RLS disabled or effective client TRUNCATE/TRIGGER/REFERENCES/MAINTAIN.
select c.relname as public_table,
       c.relrowsecurity as rls_enabled,
       has_table_privilege('anon',c.oid,'TRUNCATE') as anon_can_truncate,
       has_table_privilege('authenticated',c.oid,'TRUNCATE') as authenticated_can_truncate,
       has_table_privilege('anon',c.oid,'TRIGGER') as anon_can_trigger,
       has_table_privilege('authenticated',c.oid,'TRIGGER') as authenticated_can_trigger,
       has_table_privilege('anon',c.oid,'REFERENCES') as anon_can_reference,
       has_table_privilege('authenticated',c.oid,'REFERENCES') as authenticated_can_reference,
       has_table_privilege('anon',c.oid,'MAINTAIN') as anon_can_maintain,
       has_table_privilege('authenticated',c.oid,'MAINTAIN') as authenticated_can_maintain,
       case
        when not c.relrowsecurity then 'BLOCK: RLS disabled'
        when has_table_privilege('anon',c.oid,'TRUNCATE')
          or has_table_privilege('authenticated',c.oid,'TRUNCATE') then 'BLOCK: TRUNCATE available'
        when has_table_privilege('anon',c.oid,'TRIGGER')
          or has_table_privilege('authenticated',c.oid,'TRIGGER') then 'BLOCK: TRIGGER available'
        when has_table_privilege('anon',c.oid,'REFERENCES')
          or has_table_privilege('authenticated',c.oid,'REFERENCES') then 'BLOCK: REFERENCES available'
        when has_table_privilege('anon',c.oid,'MAINTAIN')
          or has_table_privilege('authenticated',c.oid,'MAINTAIN') then 'BLOCK: MAINTAIN available'
        else 'OK'
       end as security_status
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
order by c.relname;

-- Result B: zero violations for each of the privilege columns. This must be checked on live production, not inferred
-- from the SQL files or a previous test run.
select count(*) as public_tables,
       count(*) filter(where not c.relrowsecurity) as rls_disabled,
       count(*) filter(where has_table_privilege('anon',c.oid,'TRUNCATE')) as anon_truncate,
       count(*) filter(where has_table_privilege('authenticated',c.oid,'TRUNCATE')) as authenticated_truncate,
       count(*) filter(where has_table_privilege('anon',c.oid,'TRIGGER')) as anon_trigger,
       count(*) filter(where has_table_privilege('authenticated',c.oid,'TRIGGER')) as authenticated_trigger,
       count(*) filter(where has_table_privilege('anon',c.oid,'REFERENCES')) as anon_references,
       count(*) filter(where has_table_privilege('authenticated',c.oid,'REFERENCES')) as authenticated_references,
       count(*) filter(where has_table_privilege('anon',c.oid,'MAINTAIN')) as anon_maintain,
       count(*) filter(where has_table_privilege('authenticated',c.oid,'MAINTAIN')) as authenticated_maintain
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p');

-- Result C: DEFAULT grants for newly created tables, grouped by object owner.
-- ACL letters D (TRUNCATE), t (TRIGGER), x (REFERENCES), m (MAINTAIN)
-- are all unnecessary for browser clients. As of
-- v53 the 'supabase_admin' defaults remain too broad and require an authorized
-- administrator; postgres cannot assume membership in that owner role.
select owner.rolname as future_table_owner,
       n.nspname as target_schema,
       split_part(acl.entry::text,'=',1) as grantee,
       split_part(split_part(acl.entry::text,'=',2),'/',1) as privileges,
       split_part(split_part(acl.entry::text,'=',2),'/',1) like '%D%' as has_truncate_default,
       split_part(split_part(acl.entry::text,'=',2),'/',1) ~ '[txm]' as has_auxiliary_default
from pg_catalog.pg_default_acl d
join pg_catalog.pg_roles owner on owner.oid=d.defaclrole
left join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace
cross join lateral unnest(d.defaclacl) as acl(entry)
where d.defaclobjtype='r' and n.nspname='public'
  and split_part(acl.entry::text,'=',1) in ('anon','authenticated')
order by owner.rolname,grantee;

-- Result D: The last-demand timestamp is intentionally not visible to anon
-- while public history statuses remain queryable at the column level.
select has_column_privilege('anon','public.player_history_imports','last_demand_at','SELECT') as anonymous_can_read_demand,
       has_column_privilege('anon','public.player_history_imports','status','SELECT') as anonymous_can_read_status,
       has_function_privilege('anon','public.request_player_history_demand(text)','EXECUTE') as anonymous_can_request_validated_history;
