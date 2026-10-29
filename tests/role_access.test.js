"use strict";
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const source=fs.readFileSync(require('node:path').join(__dirname,'..','models.js'),'utf8');
const ctx={window:{}};vm.runInNewContext(source,ctx);const {modules,roles}=ctx.window.SteelDomain;
const expected={
  admin:['heats','transfers','rolling_batches','customers','sales_orders','loading_events'],
  management:['heats','transfers','rolling_batches','customers','sales_orders','loading_events'],
  melting:['heats'],billet_transport:['transfers'],rolling:['rolling_batches'],
  sales:['customers','sales_orders'],loading:['loading_events'],viewer:[]};
for(const [role,allowed] of Object.entries(expected)){
  test(`role ${role} only sees assigned records`,()=>{
    assert.ok(role in roles);const accessible=Object.keys(modules).filter(k=>modules[k].reader.includes(role));
    assert.deepEqual(accessible.sort(),allowed.sort());
  });
}
for(const [k,v] of Object.entries(modules)){
  test(`${k} can be created only by assigned operator or admin`,()=>{
    assert.ok(v.creator.includes('admin'));
    assert.ok(v.reader.includes('admin'));
    for(const role of v.creator)assert.ok(v.reader.includes(role),`${role} creator not a reader`);
    assert.equal(v.creator.includes('management'),false);
    assert.equal(v.creator.includes('viewer'),false);
  });
}
test('navigation guard blocks arbitrary hidden views',()=>{
 const src=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
 assert.match(src,/function navigate\(view\)\{[\s\S]*?const permitted=/);
 assert.match(src,/if\(!permitted\)/);
});
