"use strict";
// Runtime dependency-free domain/application layer. Usable from browser or Node tests.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SteelArchitecture=api;})(typeof window!=='undefined'?window:globalThis,function(){
  const MINUTES={combinedCycle:210,castToRolling:150,rolling:70,furnaceOffset:60};
  const ROLES=Object.freeze({transfer_start:['admin','billet_transport'],transfer_arrive:['admin','billet_transport'],rolling_start:['admin','rolling'],rolling_end:['admin','rolling'],dispatch:['admin','loading']});
  function assert(ok,msg){if(!ok)throw new Error(msg);}
  function positiveTons(value){const n=Number(String(value).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)));assert(Number.isFinite(n)&&n>0,'Quantity must be a positive number');return n;}
  // State Pattern: explicit allowed transitions (client guidance; SQL RPC is authority).
  const transitions=Object.freeze({melting:['melting_done'],melting_done:['casting'],casting:['ready'],ready:['in_transit'],in_transit:['arrived'],arrived:['rolling'],rolling:['completed'],completed:[]});
  class HeatStateMachine{constructor(state='melting'){assert(Object.hasOwn(transitions,state),'Unknown production state');this.state=state;} can(next){return transitions[this.state].includes(next);} move(next){assert(this.can(next),`Invalid production transition ${this.state} → ${next}`);this.state=next;return this.state;}}
  // Factory Method: validated commands created for atomic server-side execution.
  class CommandFactory{static create(action,id,args={}){assert(Object.hasOwn(ROLES,action),'Unsupported workflow action');assert(Number.isSafeInteger(Number(id))&&Number(id)>0,'Invalid record ID');const payload={...args};if(['rolling_end','transfer_arrive','dispatch'].includes(action))payload.tons=positiveTons(payload.tons);if(action==='rolling_start'){payload.size_mm=Number(payload.size_mm);assert([12,14,16].includes(payload.size_mm),'Size must be 12, 14 or 16 mm');}if(action==='dispatch')assert(String(payload.truck_plate||'').trim(),'Truck plate is required');return Object.freeze({action,id:Number(id),args:Object.freeze(payload)});}}
  // Observer Pattern: event consumers decoupled from commands and repository.
  class EventBus{constructor(){this.subscribers=new Map();}on(type,listener){const a=this.subscribers.get(type)||new Set();a.add(listener);this.subscribers.set(type,a);return()=>a.delete(listener);}emit(type,payload){for(const listener of this.subscribers.get(type)||[])listener(payload);}}
  // Strategy Pattern: status evaluation algorithm is independently replaceable.
  class ScheduleStrategy{constructor(config=MINUTES){this.config=config;}forecast(iso,stage){const mins=this.config[stage];assert(Number.isFinite(mins),'Unknown schedule stage');const base=new Date(iso).getTime();assert(Number.isFinite(base),'Invalid timestamp');return new Date(base+mins*60000).toISOString();}compare(actual,expected){const diff=Math.round((new Date(actual)-new Date(expected))/60000);assert(Number.isFinite(diff),'Invalid timestamp');return {differenceMinutes:diff,status:diff===0?'On time':diff>0?'Delayed':'Early'};}}
  // Resilience: bounded timeout + backoff for idempotent READS only. Never retry writes.
  class ReadTimeoutError extends Error {constructor(label,ms){super(`${label} timed out after ${ms} ms`);this.name='ReadTimeoutError';}}
  function transientReadError(error){
    const code=String(error?.code||'');
    const status=Number(error?.status||0);
    return error instanceof ReadTimeoutError || ['408','425','429','500','502','503','504'].includes(code) ||
      [408,425,429,500,502,503,504].includes(status) ||
      /network|fetch failed|failed to fetch|connection|timeout|temporarily unavailable/i.test(String(error?.message||''));
  }
  async function resilientRead(operation,{timeoutMs=8000,retries=2,delayMs=150,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),label='Read'}={}){
    assert(typeof operation==='function','Read operation required');
    assert(Number.isFinite(timeoutMs)&&timeoutMs>0&&Number.isInteger(retries)&&retries>=0&&retries<=5,'Invalid retry policy');
    let last;
    for(let attempt=0;attempt<=retries;attempt++){
      let timer;
      try{
        const result=await Promise.race([
          Promise.resolve().then(()=>operation(attempt)),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(new ReadTimeoutError(label,timeoutMs)),timeoutMs);})
        ]);
        return result;
      }catch(error){
        last=error;
        if(!transientReadError(error)||attempt===retries)throw error;
        await sleep(delayMs*Math.pow(2,attempt));
      }finally{clearTimeout(timer);}
    }
    throw last;
  }
  // Adapter Pattern: browser independent transport API to RPC layer.
  class SupabaseWorkflowAdapter{constructor(client){this.client=client;}async execute(cmd){const {data,error}=await this.client.rpc('factory_stage',{p_action:cmd.action,p_id:cmd.id,p_args:cmd.args});if(error)throw error;return data;}async inventory(){return resilientRead(async()=>{const {data,error}=await this.client.rpc('factory_inventory');if(error)throw error;return data;},{label:'Inventory read'});}}
  // Dependency inversion: WorkflowService depends on execute(), not on Supabase internals.
  class WorkflowService{constructor(port,bus=new EventBus()){assert(typeof port.execute==='function','Workflow port missing execute');this.port=port;this.bus=bus;}async run(action,id,args={}){const cmd=CommandFactory.create(action,id,args);const result=await this.port.execute(cmd);this.bus.emit('workflow.saved',{command:cmd,result});return result;}}
  function inventoryFrom(production,shipments,size){assert([12,14,16].includes(Number(size)),'Invalid size');const produced=production.filter(x=>Number(x.size_mm)===Number(size)&&x.status==='Completed'&&x.finished_at).reduce((sum,x)=>sum+Number(x.produced_tons||0),0);const shipped=shipments.filter(x=>Number(x.size_mm)===Number(size)&&['Loaded','Dispatched'].includes(x.status)).reduce((sum,x)=>sum+Number(x.loaded_tons||0),0);return {produced,dispatched:shipped,available:produced-shipped};}
  function canDispatch(order,alreadyLoaded,stock,qty){const tons=positiveTons(qty);return {valid:tons<=Number(order.qty_tons)-Number(alreadyLoaded)&&tons<=Number(stock),remainingOrder:Number(order.qty_tons)-Number(alreadyLoaded),availableStock:Number(stock)};}
  return Object.freeze({MINUTES,ROLES,HeatStateMachine,CommandFactory,EventBus,ScheduleStrategy,SupabaseWorkflowAdapter,WorkflowService,ReadTimeoutError,transientReadError,resilientRead,inventoryFrom,canDispatch});
});
