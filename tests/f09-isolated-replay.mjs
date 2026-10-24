import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateLocalTarget,validateManifest,validatePrivateFiles,runReplay} from '../scripts/f09-isolated-replay.mjs';

const okUrl='postgresql://f09_replay@127.0.0.1:55432/f09_replay_test?sslmode=disable';
const url=validateLocalTarget(okUrl);
for(const bad of ['postgresql://postgres@localhost:5432/postgres',
 'postgresql://f09_replay@some-project.supabase.co:55432/f09_replay_test',
 'postgresql://f09_replay:password@127.0.0.1:55432/f09_replay_test',
 'postgresql://f09_replay@127.0.0.1:5432/f09_replay_test',
 'postgresql://f09_replay@127.0.0.1:55432/production',
 'postgresql://f09_replay@127.0.0.1:55432/f09_replay_test?sslmode=require'])
 assert.throws(()=>validateLocalTarget(bad));
const dir=await mkdtemp(path.join(tmpdir(),'f09-replay-'));
try{
  const version='20261010000001',file=version+'.sql',sql='create table test_fixture(id int);';
  await writeFile(path.join(dir,file),sql);
  const sha256=createHash('sha256').update(sql).digest('hex');
  const row={version,file,sha256,reviewed:true};
  assert.equal(validateManifest({migrations:[row]},1).length,1);
  assert.throws(()=>validateManifest({migrations:[row]},2));
  assert.throws(()=>validateManifest({migrations:[row,row]},2));
  assert.throws(()=>validateManifest({migrations:[{...row,file:'../test.sql'}]},1));
  assert.throws(()=>validateManifest({migrations:[{...row,reviewed:false}]},1));
  const files=await validatePrivateFiles(dir,[row]);
  assert.equal(files.length,1);
  let calls=0;
  const executor=(exe,args,options)=>{
    calls++;
    assert.equal(exe,'psql');
    assert.equal(options.env.PGPASSWORD,undefined);
    assert.equal(options.env.PGHOST,undefined);
    assert.equal(options.env.PGPASSFILE,'/dev/null');
    assert.equal(options.env.PGSSLMODE,undefined);
    assert.ok(args.some(a=>a.startsWith('--dbname='+okUrl)));
    return {status:0,stdout:calls===1?'f09_replay_test:0\n':''};
  };
  const outcome=runReplay(url,files,executor);
  assert.deepEqual([outcome.attempted,outcome.applied],[1,1]);
  assert.equal(calls,2);
  assert.equal(outcome.isolated_environment_attested,false);
  assert.throws(()=>runReplay(url,files,()=>({status:0,stdout:'f09_replay_test:1\n'})),/not empty/);
  await writeFile(path.join(dir,file),'\\connect production');
  const changed=await validatePrivateFiles(dir,[{...row,sha256:createHash('sha256').update('\\connect production').digest('hex')}]).then(()=>null,e=>e);
  assert.match(changed.message,/Unsafe/);
  await writeFile(path.join(dir,file),'select cron.schedule(1,2,3)');
  await assert.rejects(validatePrivateFiles(dir,[{...row,sha256:createHash('sha256').update('select cron.schedule(1,2,3)').digest('hex')}]),/Unsafe/);
  await writeFile(path.join(dir,file),'alter system set log_statement = all;');
  await assert.rejects(validatePrivateFiles(dir,[{...row,sha256:createHash('sha256').update('alter system set log_statement = all;').digest('hex')}]),/Unsafe/);
  await assert.rejects(validatePrivateFiles(dir,[row]),/digest mismatch/);
  await rm(path.join(dir,file));
  await symlink('/etc/hosts',path.join(dir,file));
  await assert.rejects(validatePrivateFiles(dir,[row]),/regular private SQL/);
  console.log('F09 isolated replay: offline synthetic guards/psql stubs PASS');
}finally{await rm(dir,{recursive:true,force:true});}
