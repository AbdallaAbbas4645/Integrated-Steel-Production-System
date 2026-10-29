"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../architecture.js');
const iso='2026-10-29T07:30:00.000Z';
const cases=[
['transition path ready to completed',()=>{const sm=new A.HeatStateMachine('ready');for(const state of ['in_transit','arrived','rolling','completed'])assert.equal(sm.move(state),state);assert.equal(sm.can('rolling'),false);} ],
['state validates unknown initial state',()=>assert.throws(()=>new A.HeatStateMachine('shipped'),/Unknown/)],
['cannot transition backwards',()=>assert.throws(()=>new A.HeatStateMachine('arrived').move('ready'),/Invalid/)],
['completed is terminal',()=>assert.deepEqual(new A.HeatStateMachine('completed').can('ready'),false)],
['all five actions have a role list',()=>assert.deepEqual(Object.keys(A.ROLES).sort(),['dispatch','rolling_end','rolling_start','transfer_arrive','transfer_start'].sort())],
['unsupported commands rejected',()=>assert.throws(()=>A.CommandFactory.create('drop_table',1),/Unsupported/)],
['id must be positive',()=>assert.throws(()=>A.CommandFactory.create('transfer_start',0),/Invalid record ID/)],
['id must be safe integer',()=>assert.throws(()=>A.CommandFactory.create('transfer_start',1.5),/Invalid record ID/)],
['start rolling supports 14 mm',()=>assert.equal(A.CommandFactory.create('rolling_start',2,{size_mm:14}).args.size_mm,14)],
['start rolling supports 16 mm',()=>assert.equal(A.CommandFactory.create('rolling_start',2,{size_mm:16}).args.size_mm,16)],
['reject negative tons',()=>assert.throws(()=>A.CommandFactory.create('rolling_end',1,{tons:-1}),/positive/)],
['reject zero tons',()=>assert.throws(()=>A.CommandFactory.create('transfer_arrive',1,{tons:0}),/positive/)],
['reject nonnumeric tons',()=>assert.throws(()=>A.CommandFactory.create('dispatch',1,{tons:'abc',truck_plate:'123'}),/positive/)],
['arabic digits normalized',()=>assert.equal(A.CommandFactory.create('dispatch',1,{tons:'۲۵',truck_plate:'123'}).args.tons,25)],
['command returns frozen object',()=>assert.equal(Object.isFrozen(A.CommandFactory.create('transfer_start',1)),true)],
['rolling forecast is 70 min',()=>assert.equal(new A.ScheduleStrategy().forecast(iso,'rolling'),'2026-10-29T08:40:00.000Z')],
['casting to rolling forecast is 150 min',()=>assert.equal(new A.ScheduleStrategy().forecast(iso,'castToRolling'),'2026-10-29T10:00:00.000Z')],
['schedule early evaluation',()=>assert.equal(new A.ScheduleStrategy().compare('2026-10-29T08:59:00Z','2026-10-29T09:00:00Z').status,'Early')],
['schedule on-time evaluation',()=>assert.equal(new A.ScheduleStrategy().compare('2026-10-29T09:00:00Z','2026-10-29T09:00:00Z').status,'On time')],
['schedule disallows invalid stage',()=>assert.throws(()=>new A.ScheduleStrategy().forecast(iso,'fictional'),/Unknown/)],
['negative inventory is visible rather than hidden',()=>assert.equal(A.inventoryFrom([], [{size_mm:12,loaded_tons:5,status:'Loaded'}],12).available,-5)],
['inventory excludes cancelled load',()=>assert.equal(A.inventoryFrom([], [{size_mm:12,loaded_tons:5,status:'Cancelled'}],12).available,0)],
['inventory filters bar size',()=>assert.equal(A.inventoryFrom([{size_mm:14,status:'Completed',produced_tons:9,finished_at:iso}],[],12).produced,0)],
['dispatch exact remaining amount valid',()=>assert.equal(A.canDispatch({qty_tons:30},20,10,10).valid,true)],
['dispatch cannot exceed stock',()=>assert.equal(A.canDispatch({qty_tons:30},0,3,4).valid,false)],
['event listener unsubscribe',()=>{const b=new A.EventBus();let count=0;const off=b.on('x',()=>count++);b.emit('x',{});off();b.emit('x',{});assert.equal(count,1);} ],
['service does not publish success on error',async()=>{const b=new A.EventBus();let called=false;b.on('workflow.saved',()=>called=true);const svc=new A.WorkflowService({execute:async()=>{throw Error('offline');}},b);await assert.rejects(svc.run('transfer_start',1),/offline/);assert.equal(called,false);} ],
['adapter propagates backend error',async()=>{const a=new A.SupabaseWorkflowAdapter({rpc:async()=>({data:null,error:new Error('forbidden')})});await assert.rejects(a.execute(A.CommandFactory.create('transfer_start',1)),/forbidden/);} ],
['inventory adapter uses correct RPC',async()=>{let called='';const a=new A.SupabaseWorkflowAdapter({rpc:async(name)=>{called=name;return {data:[],error:null};}});await a.inventory();assert.equal(called,'factory_inventory');}],
['dependency inversion rejects missing port',()=>assert.throws(()=>new A.WorkflowService({}),/Workflow port missing/)],
];
for(const [name,fn] of cases)test(name,fn);
