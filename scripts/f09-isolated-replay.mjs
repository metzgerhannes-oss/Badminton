#!/usr/bin/env node
/** F09: opt-in local-only PostgreSQL migration replay. Never used by CI. */
import {createHash} from 'node:crypto';
import {readFile, lstat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const VERSION = /^\d{14}$/;
const HASH = /^[a-f0-9]{64}$/;
const FILE = /^(\d{14})\.sql$/;
const FORBIDDEN_SQL = /\b(?:dblink(?:_connect)?|postgres_fdw|pg_net|http_get|http_post|cron\.schedule|cron\.schedule_in_database|copy|create\s+extension|pg_read_file|pg_ls_dir|lo_import|pg_terminate_backend|pg_cancel_backend|alter\s+system|(?:create|alter|drop)\s+(?:role|user|database|tablespace))\b/i;
export function validateLocalTarget(value) {
  let url;
  try { url=new URL(value); } catch { throw Error('Invalid local database URL'); }
  if (!['postgres:','postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
      !/^f09_replay_[a-z0-9_]+$/.test(decodeURIComponent(url.pathname).slice(1)) ||
      url.username !== 'f09_replay' || url.password ||
      (!url.port || +url.port === 5432 || +url.port < 1024 || +url.port > 65535) ||
      [...url.searchParams].some(([key,value])=>key!=='sslmode'||value!=='disable') || url.hash)
    throw Error('Only explicit 127.0.0.1/f09_replay_* scratch databases without credentials are allowed');
  return url;
}
export function validateManifest(manifest,expectedCount) {
  if (!Number.isSafeInteger(expectedCount)||expectedCount<1||!manifest||
      !Array.isArray(manifest.migrations)||manifest.migrations.length!==expectedCount)
    throw Error('Independent applied migration count does not match complete private manifest');
  const seen=new Set();let previous='';
  for(const row of manifest.migrations){
    if(!row||!VERSION.test(row.version||'')||!HASH.test(row.sha256||'')||
       !FILE.test(row.file||'')||row.file!==row.version+'.sql'||
       row.reviewed!==true||seen.has(row.version)||row.version<=previous)
      throw Error('Migration manifest must be complete, ordered, individually reviewed and SHA-pinned');
    seen.add(row.version);previous=row.version;
  }
  return manifest.migrations;
}
export async function validatePrivateFiles(folder,migrations){
  const outputs=[];
  const basedir=path.resolve(folder);
  for(const migration of migrations){
    const filename=path.join(basedir,migration.file);
    if(path.dirname(filename)!==basedir)throw Error('Migration file escapes private directory');
    const stat=await lstat(filename);
    if(!stat.isFile()||stat.isSymbolicLink())throw Error('Migration must be a regular private SQL file');
    const bytes=await readFile(filename);
    if(createHash('sha256').update(bytes).digest('hex')!==migration.sha256)
      throw Error('Private migration SQL digest mismatch');
    const sql=bytes.toString('utf8');
    // psql backslash commands can reconnect and escape the target URL restriction.
    if(sql.includes('\\')||FORBIDDEN_SQL.test(sql))
      throw Error('Unsafe or network-capable SQL; requires isolated manual review');
    outputs.push({filename,version:migration.version});
  }
  return outputs;
}
export function runPsql(args,env=process.env,executor=spawnSync){
  const result=executor('psql',args,{encoding:'utf8',env:{
    PATH:env.PATH || '/usr/bin:/bin', HOME:'/tmp',
    PGPASSFILE:'/dev/null', PGSERVICEFILE:'/dev/null',
    PGCONNECT_TIMEOUT:'5', PSQLRC:'/dev/null'
  },timeout:120000,maxBuffer:1024*1024});
  if(result.error||result.status!==0)throw Error('Isolated PostgreSQL replay or inspection failed (SQL/output redacted)');
  return String(result.stdout||'').trim();
}
export function runReplay(url,files,executor=spawnSync){
  // Verify target DB identity and no existing user/application relations.
  const probeSql="SELECT current_database() || ':' || (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast') AND n.nspname NOT LIKE 'pg_temp%' AND n.nspname NOT LIKE 'pg_toast_temp%') || ':' || CASE WHEN current_user='f09_replay' AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls)) AND NOT pg_has_role(current_user,'pg_read_server_files','member') AND NOT pg_has_role(current_user,'pg_write_server_files','member') AND NOT pg_has_role(current_user,'pg_execute_server_program','member') THEN 'safe' ELSE 'unsafe' END";
  const probe=runPsql(['-X','-A','-t','-v','ON_ERROR_STOP=1',
    '--dbname='+url.href,'--command='+probeSql],process.env,executor);
  if(probe!==decodeURIComponent(url.pathname).slice(1)+':0:safe')
    throw Error('Scratch database is nonempty or replay role has unsafe privileges');
  let completed=0;
  for(const row of files){
    runPsql(['-X','-v','ON_ERROR_STOP=1','--dbname='+url.href,'--file='+row.filename],process.env,executor);
    completed++;
  }
  return {attempted:files.length,applied:completed,isolated_environment_attested:false};
}
export async function main(args=process.argv.slice(2)){
  const [mode,manifestPath,dir,expected,confirm,...extra]=args;
  if(extra.length||!['--plan','--replay'].includes(mode)||!manifestPath||!dir||
     !/^[1-9][0-9]*$/.test(expected||''))throw Error('Use --plan|--replay PRIVATE_MANIFEST PRIVATE_SQL_DIR EXPECTED_COUNT [--confirm-local]');
  if(process.env.CI||process.env.GITHUB_ACTIONS)throw Error('Private replay is forbidden in CI');
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  const versions=validateManifest(manifest,Number(expected));
  const files=await validatePrivateFiles(dir,versions);
  if(mode==='--plan'){
    if(confirm!==undefined)throw Error('Plan takes no confirmation');
    process.stdout.write('F09 local preflight passed: '+files.length+' private SQL files, no SQL displayed. No replay performed.\n');
    return;
  }
  if(confirm!=='--confirm-local')throw Error('Explicit local replay confirmation is required');
  const url=validateLocalTarget(process.env.F09_REPLAY_DATABASE_URL);
  const out=runReplay(url,files);
  process.stdout.write('F09 local SQL replay finished: '+out.applied+' applied; independent RLS/schema verification still required.\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 main().catch(()=>{console.error('F09 local replay refused or failed; details redacted.');process.exitCode=2;});
}
