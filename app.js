"use strict";
(() => {
  const cfg=window.STEEL_CONFIG||{};
  const $=id=>document.getElementById(id);
  const {roles,modules,SteelRecord,transformChangeValue,numberFields,timeFields,displayFactoryTime}=window.SteelDomain;
  const state={session:null,profile:null,active:"overview",records:[],table:null,change:null,adminEdit:null,loading:false};
  const isConfigured=cfg.url?.startsWith("https://") && cfg.url.includes(".supabase.co") &&
    cfg.publishableKey?.startsWith("sb_publishable_");
  function notice(text,error=false){const el=$("global-message");el.className="message"+(error?" error":" good");el.textContent=text;}
  function authNotice(text,error=false){const el=$("login-message");el.className="message"+(error?" error":" good");el.textContent=text;}
  if(!isConfigured){authNotice("Project setup needed: edit config.js and add your Supabase URL and sb_publishable_ key.",true);$("login-form").querySelector("button").disabled=true;return;}
  if(!window.supabase?.createClient){authNotice("Supabase library did not load. Check internet/CDN access and reload.",true);return;}
  const client=window.supabase.createClient(cfg.url,cfg.publishableKey);
  const repo=new SteelRepository(client);
  const arch=window.SteelArchitecture;
  const workflowEvents=new arch.EventBus();
  const workflowService=new arch.WorkflowService(new arch.SupabaseWorkflowAdapter(client),workflowEvents);
  const schedule=new arch.ScheduleStrategy();
  workflowEvents.on("workflow.saved",()=>{ /* Event is available for independent dashboard consumers. */ });

  const allowed=table=>modules[table]?.reader.includes(state.profile?.role);
  const canCreate=table=>modules[table]?.creator.includes(state.profile?.role);
  const ownRecord=(row,table)=>String(table==="heats"?row.user_id:row.created_by)===state.session?.user.id;
  const admin=()=>state.profile?.role==="admin";
  const mayRequest=(table,row)=>admin() || canCreate(table); // Department-wide change requests; server still approves
  function cell(text){const td=document.createElement("td");td.textContent=text??"—";return td;}
  function button(text,cls,callback){const el=document.createElement("button");el.type="button";el.textContent=text;el.className=cls;el.addEventListener("click",callback);return el;}
  function fmt(value,key=""){
    if(value===null||value===undefined||value==="")return "—";
    if(key.endsWith("_at")||["start_time","arrived_at","loaded_at"].includes(key)) {
      return displayFactoryTime(value);
    }
    return String(value);
  }
  function tableInto(target,headers,rows){
    const box=$(target);box.replaceChildren();
    if(!rows.length){const empty=document.createElement("div");empty.className="empty";empty.textContent="No records yet.";box.append(empty);return;}
    const table=document.createElement("table"),thead=document.createElement("thead"),tr=document.createElement("tr");
    headers.forEach(h=>{const th=document.createElement("th");th.textContent=h;tr.append(th);});thead.append(tr);table.append(thead);
    const body=document.createElement("tbody");rows.forEach(row=>body.append(row));table.append(body);box.append(table);
  }
  function navItems(){
    const items=[{id:"overview",title:"Overview",icon:"◫"}];
    Object.entries(modules).forEach(([id,m])=>{if(allowed(id))items.push({id,title:m.title,icon:m.icon});});
    if(["admin","management","sales"].includes(state.profile?.role))items.push({id:"inventory",title:"Finished Goods Inventory",icon:"📦"});
    if(state.profile?.role!=="viewer")items.push({id:"requests",title:"Change Requests",icon:"📝"});
    if(admin())items.push({id:"users",title:"Staff & Roles",icon:"🛡️"});
    if(["admin","management"].includes(state.profile?.role))items.push({id:"audit",title:"Audit Trail",icon:"📜"});
    return items;
  }
  function buildNavigation(){
    const nav=$("navigation");nav.replaceChildren();
    navItems().forEach(item=>{
      const b=button(item.icon+"  "+item.title,"nav-link"+(state.active===item.id?" active":""),()=>navigate(item.id));nav.append(b);
    });
  }
  function navigate(view){
    // Navigation is a presentation boundary, not a substitute for PostgreSQL RLS.
    const role=state.profile?.role;
    const permitted=(view==='overview') ||
      (Boolean(modules[view]) && allowed(view)) ||
      (view==='inventory' && ['admin','management','sales'].includes(role)) ||
      (view==='requests' && role!=='viewer') ||
      (view==='users' && admin()) ||
      (view==='audit' && ['admin','management'].includes(role));
    if(!permitted){notice('This page is not available for your assigned role.',true);return;}
    state.active=view;state.table=modules[view]?view:null;
    ["overview","records","requests","users","audit","inventory"].forEach(v=>$(v+"-view").hidden=true);
    const screen=state.table?"records":view;
    $(screen+"-view").hidden=false;
    $("current-title").textContent=state.table?modules[view].title:({overview:"Overview",requests:"Change Requests",users:"Staff & Roles",audit:"Audit Trail",inventory:"Finished Goods Inventory"}[view]);
    buildNavigation();$("global-message").textContent="";
    $("sidebar").classList.remove("open");
    if(state.table)loadRecords();
    else if(view==="overview")loadOverview();
    else if(view==="requests")loadRequests();
    else if(view==="users")loadUsers();
    else if(view==="audit")loadAudit();
    else if(view==="inventory")loadInventory();
    
  }
  async function loadOverview(){
    const cards=$("overview-metrics");cards.replaceChildren();
    const accessible=Object.keys(modules).filter(allowed);
    for(const table of accessible){
      const m=modules[table],box=document.createElement("div");box.className="metric";
      const label=document.createElement("div");label.className="label";label.textContent=m.title;
      const num=document.createElement("div");num.className="number";num.textContent="…";
      const hint=document.createElement("div");hint.className="hint";hint.textContent="Latest 120 records";
      box.append(label,num,hint);cards.append(box);
      repo.count(table).then(count=>{if(box.isConnected){num.textContent=String(count);hint.textContent="Records in database";}})
        .catch(()=>{if(box.isConnected)num.textContent="—";});
    }
    if(!accessible.length){cards.textContent="Your account has no assigned factory role yet. Ask an administrator to assign your role.";}
    const list=$("overview-modules");list.replaceChildren();
    accessible.forEach(id=>{
      const m=modules[id],b=button(m.icon+"  "+m.title,"module-card",()=>navigate(id));
      const summary=document.createElement("small");summary.textContent=m.summary;b.append(summary);list.append(b);
    });
  }
  // English-only date/time calendar with digit-only manual entry. Inputs
  // automatically format YYYY-MM-DD HH:MM; calendar allows fast selection.
  // Avoid native datetime-local because its visible language follows OS settings.
  const padDate=n=>String(n).padStart(2,"0");
  const localDateText=d=>`${d.getFullYear()}-${padDate(d.getMonth()+1)}-${padDate(d.getDate())} ${padDate(d.getHours())}:${padDate(d.getMinutes())}`;
  const monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const datePopup=document.createElement("dialog");
  datePopup.id="english-calendar";datePopup.className="calendar-dialog";
  datePopup.innerHTML=`<div class="calendar-header"><h3 id="cal-heading">Choose date &amp; time</h3><button class="outline small" type="button" id="cal-x" aria-label="Close date picker">✕</button></div>
  <div class="calendar-controls"><button type="button" class="outline small" id="cal-prev" aria-label="Previous month">‹</button><strong id="cal-month"></strong><button type="button" class="outline small" id="cal-next" aria-label="Next month">›</button></div>
  <div class="calendar-weekdays">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>`<span>${d}</span>`).join("")}</div>
  <div id="cal-days" class="calendar-days"></div>
  <div class="calendar-times"><label for="cal-hour">Hour (24h)<select id="cal-hour"></select></label><label for="cal-minute">Minute<select id="cal-minute"></select></label></div>
  <div class="calendar-actions"><button type="button" class="outline small" id="cal-today">Today / Now</button><button type="button" class="outline small" id="cal-clear">Clear</button><button type="button" class="outline small" id="cal-cancel">Cancel</button><button type="button" class="primary" id="cal-apply">Use date</button></div>`;
  document.body.append(datePopup);
  const cal=id=>datePopup.querySelector("#"+id);
  for(let h=0;h<24;h++){const opt=document.createElement("option");opt.value=padDate(h);opt.textContent=padDate(h);cal("cal-hour").append(opt);}
  for(let m=0;m<60;m++){const opt=document.createElement("option");opt.value=padDate(m);opt.textContent=padDate(m);cal("cal-minute").append(opt);}
  let calInput=null,calMonth=new Date(),calDay=1;
  const nowLocal=()=>new Date();
  function calendarRender(){
    const year=calMonth.getFullYear(),month=calMonth.getMonth();
    cal("cal-month").textContent=monthNames[month]+" "+year;
    const box=cal("cal-days");box.replaceChildren();
    for(let i=0;i<new Date(year,month,1).getDay();i++){
      const blank=document.createElement("span");blank.className="calendar-empty";box.append(blank);
    }
    const days=new Date(year,month+1,0).getDate();
    for(let day=1;day<=days;day++){
      const b=document.createElement("button");b.type="button";b.className="calendar-day"+(calDay===day?" selected":"");
      b.textContent=String(day);b.setAttribute("aria-label",`${day} ${monthNames[month]} ${year}`);
      b.addEventListener("click",()=>{calDay=day;calendarRender();});box.append(b);
    }
  }
  function openCalendar(input){
    if(!input||input.disabled)return;
    calInput=input;
    const match=/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(input.value);
    let d=match?new Date(+match[1],+match[2]-1,+match[3],+match[4],+match[5]):nowLocal();
    if(Number.isNaN(d.getTime()))d=nowLocal();
    calMonth=new Date(d.getFullYear(),d.getMonth(),1);calDay=d.getDate();
    cal("cal-hour").value=padDate(d.getHours());cal("cal-minute").value=padDate(d.getMinutes());
    calendarRender();datePopup.showModal();
  }
  const setCalendarNow=input=>{input.value=localDateText(nowLocal());input.dispatchEvent(new Event("change",{bubbles:true}));};
  // This mask allows numeric typing but strips alphabetic characters and
  // generates the date/time punctuation automatically.
  function digitDateMask(value){
    const d=String(value).replace(/[^0-9]/g,"").slice(0,12);
    let text=d.slice(0,4);
    if(d.length>4)text+="-"+d.slice(4,6);
    if(d.length>6)text+="-"+d.slice(6,8);
    if(d.length>8)text+=" "+d.slice(8,10);
    if(d.length>10)text+=":"+d.slice(10,12);
    return text;
  }
  function addDateTools(input){
    input.type="text";input.readOnly=false;input.inputMode="numeric";
    input.maxLength=16;input.pattern="[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}";
    input.placeholder="YYYY-MM-DD HH:MM";input.lang="en-US";input.dir="ltr";
    input.classList.add("date-entry");input.title="Type numbers only, or choose Calendar / Today";
    const wrap=document.createElement("div");wrap.className="date-input-row";
    input.parentNode.insertBefore(wrap,input);wrap.append(input);
    const open=button("📅","outline date-trigger",()=>openCalendar(input));open.title="Open calendar";open.setAttribute("aria-label","Choose date and time");
    const today=button("Today / Now","outline date-today",()=>setCalendarNow(input));
    wrap.append(open,today);
    input.addEventListener("input",()=>{if(input.classList.contains("date-entry"))input.value=digitDateMask(input.value);});
  }
  cal("cal-x").addEventListener("click",()=>datePopup.close());
  cal("cal-cancel").addEventListener("click",()=>datePopup.close());
  cal("cal-prev").addEventListener("click",()=>{calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()-1,1);calDay=Math.min(calDay,new Date(calMonth.getFullYear(),calMonth.getMonth()+1,0).getDate());calendarRender();});
  cal("cal-next").addEventListener("click",()=>{calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()+1,1);calDay=Math.min(calDay,new Date(calMonth.getFullYear(),calMonth.getMonth()+1,0).getDate());calendarRender();});
  cal("cal-today").addEventListener("click",()=>{const d=nowLocal();calMonth=new Date(d.getFullYear(),d.getMonth(),1);calDay=d.getDate();cal("cal-hour").value=padDate(d.getHours());cal("cal-minute").value=padDate(d.getMinutes());calendarRender();});
  cal("cal-clear").addEventListener("click",()=>{if(calInput){calInput.value="";calInput.dispatchEvent(new Event("change",{bubbles:true}));}datePopup.close();});
  cal("cal-apply").addEventListener("click",()=>{
    if(!calInput)return;
    const d=new Date(calMonth.getFullYear(),calMonth.getMonth(),calDay,+cal("cal-hour").value,+cal("cal-minute").value);
    calInput.value=localDateText(d);calInput.dispatchEvent(new Event("change",{bubbles:true}));datePopup.close();
  });

  async function makeField(f,prefix="f"){
    const box=document.createElement("div");box.className="field";
    const label=document.createElement("label");label.textContent=f.label;label.htmlFor=prefix+"-"+f.key;box.append(label);
    let el;
    if(f.type==="select"||["heats","customers","sales_orders"].includes(f.type)){
      el=document.createElement("select");
      const options=f.options||await repo.fetch(f.type,120).then(rows=>{
        if(f.type==="heats" && state.table==="transfers")rows=rows.filter(h=>Boolean(h.ready_for_transfer_at));
        return rows.map(r=>[String(r.id),f.type==="heats"?r.heat_number:f.type==="customers"?r.name:r.order_no]);
      });
      if(!options.length){const opt=document.createElement("option");opt.value="";opt.textContent="Create the related record first";el.append(opt);}
      options.forEach(([val,text])=>{const opt=document.createElement("option");opt.value=val;opt.textContent=text;el.append(opt);});
    }else{
      el=document.createElement("input");
      el.type=f.type==="datetime-local"?"text":f.type;
      el.autocomplete="off";
      if(f.type==="number"){el.step="any";el.min=f.key==="price_per_ton"?"0":"0.01";}
    }
    el.id=prefix+"-"+f.key;el.name=f.key;el.required=f.required;
    box.append(el);
    if(f.type==="datetime-local")addDateTools(el);
    return box;
  }
  async function renderForm(table){
    const config=modules[table];$("module-title").textContent=config.title;$("module-subtitle").textContent=config.summary;
    $("create-title").textContent="Register new "+config.title.toLowerCase();
    const show=canCreate(table);$("create-panel").hidden=!show;
    if(!show)return;
    if(table==="heats"){renderHeatForm();return;}
    if(["transfers","rolling_batches","loading_events"].includes(table)){ $("create-panel").hidden=true;return; }
    $("record-save").textContent="Save record";$("create-title").textContent="Register new "+config.title.toLowerCase();
    const fields=$("record-fields");fields.replaceChildren();
    for(const f of config.fields){fields.append(await makeField(f));}
    $("record-save").disabled=false;
  }
  async function loadRecords(){
    const table=state.table;if(!table||!allowed(table))return;
    try{
      await renderForm(table);
      const records=await repo.fetch(table);
      if(state.table!==table)return;
      state.records=records;
      $("records-count").textContent=records.length+" records";
      const m=modules[table],heatMap=(["transfers","rolling_batches"].includes(table)?new Map((await repo.fetch("heats",120)).map(h=>[String(h.id),h.heat_number])):new Map()),rows=records.map(row=>{
        const tr=document.createElement("tr");
        tr.append(cell(row.id));m.list.forEach(key=>tr.append(cell(key==="heat_id"?(heatMap.get(String(row[key]))||"Historical heat #"+row[key]):key==="payment_terms" && !row[key]?"Not set (older order)":fmt(row[key],key))));
        const actions=document.createElement("td"),area=document.createElement("div");area.className="actions";
        if(mayRequest(table,row)){
          area.append(button(admin()?"Edit":"Request edit","outline small",()=>openChange(table,row,"update")));
          area.append(button(admin()?"Delete":"Request delete","danger small",()=>openChange(table,row,"delete")));
        }else if(state.profile.role!=="management")area.textContent="View only";
        actions.append(area);tr.append(actions);return tr;
      });
      tableInto("records-table",["ID",...m.list.map(k=>m.fields.find(f=>f.key===k)?.label||k),"Actions"],rows);
      const live=$("factory-flow-panel");live.hidden=!["transfers","rolling_batches","loading_events","sales_orders"].includes(table);
      $("records-view").classList.toggle("wide-records",table!=="heats");
      if(!live.hidden)await renderFactoryFlow(table);
      $("heat-workflow-panel").hidden=table!=="heats";
      if(table==="heats")await renderHeatWorkflow();
      $("transfer-queue-panel").hidden=true;
      
    }catch(err){notice("Failed to load records: "+err.message,true);}
  }
  $("record-form").addEventListener("submit",async(event)=>{
    event.preventDefault();const table=state.table;if(!table||!canCreate(table))return;
    const submit=$("record-save");submit.disabled=true;
    try{
      const values=Object.fromEntries(new FormData(event.target));
      let payload;
      if(table==="heats"){
        const number=values.heat_number?.trim();const weight=Number(normDigits(values.weight_tons));
        if(!number || !Number.isFinite(weight)||weight<=0)throw new Error("Enter a valid heat number and weight.");
        const started=new Date().toISOString();
        payload={heat_number:number,furnace:values.furnace,weight_tons:weight,start_time:started,workflow_started_at:started,status:"Melting in progress",notes:values.notes||null};
      }else{
        const record=new SteelRecord(table,values);payload=record.toJSON();
      }
      await repo.insert(table,payload);
      event.target.reset();notice("Record saved successfully in Supabase.");await loadRecords();
    }catch(err){notice(err.code==="23505"?"Heat number already exists. Choose a different number.":"Save failed: "+err.message,true);}finally{submit.disabled=false;}
  });
  // Admin direct-edit form; never require typing column names or prompt() values.
  async function openAdminEditor(table,row){
    if(!admin())return;
    state.adminEdit={table,row};
    $("admin-edit-title").textContent=`Edit ${modules[table].title} · #${row.id}`;
    $("admin-edit-message").textContent="";
    const fields=$("admin-edit-fields");fields.replaceChildren();
    try{
      for (const f of modules[table].fields){
        const wrapper=await makeField(f,"edit");
        const input=wrapper.querySelector("input, select");
        const value=row[f.key];
        input.value=timeFields.has(f.key)?displayFactoryTime(value):value===null||value===undefined?"":String(value);
        fields.append(wrapper);
      }
      $("admin-edit-dialog").showModal();
    }catch(err){notice("Cannot open editor: "+err.message,true);}
  }
  $("admin-edit-close").addEventListener("click",()=>$('admin-edit-dialog').close());
  $("admin-edit-cancel").addEventListener("click",()=>$('admin-edit-dialog').close());
  $("admin-edit-form").addEventListener("submit",async event=>{
    event.preventDefault();if(!admin()||!state.adminEdit)return;
    const {table,row}=state.adminEdit;
    const save=$("admin-edit-save");save.disabled=true;
    try{
      const inputs=Object.fromEntries(new FormData(event.target));
      const record=new SteelRecord(table,inputs).toJSON();
      for(const f of modules[table].fields){
        if(!f.required && (inputs[f.key]==="" || inputs[f.key]===undefined)) record[f.key]=null;
      }
      await repo.update(table,row.id,record);
      $("admin-edit-dialog").close();state.adminEdit=null;
      await loadRecords();notice("Changes saved directly and recorded in Audit Trail.");
    }catch(err){const msg=$("admin-edit-message");msg.className="message error";msg.textContent="Cannot save: "+err.message;}
    finally{save.disabled=false;}
  });
  function openChange(table,row,action){
    if(!mayRequest(table,row))return;
    if(admin()){
      if(action==="delete"){
        if(!window.confirm("Delete record #"+row.id+" permanently? This will be recorded in Audit Trail."))return;
        repo.remove(table,row.id).then(()=>{loadRecords();notice("Record deleted and logged.");}).catch(err=>notice(err.message,true));return;
      }
      openAdminEditor(table,row);return;
    }
    state.change={table,row,action};
    $("change-dialog-title").textContent=action==="delete"?"Request deletion":"Request a correction";
    $("change-target").textContent=modules[table].title+" · Record #"+row.id;
    $("change-fields").hidden=action==="delete";
    const options=$("change-field");options.replaceChildren();
    modules[table].fields.filter(f=>!["heats","sales_orders","customers"].includes(f.type)).forEach(f=>{
      const option=document.createElement("option");option.value=f.key;option.textContent=f.label;options.append(option);
    });
    configureChangeValue();$("change-reason").value="";
    $("change-dialog").showModal();
  }
  $("close-dialog").addEventListener("click",()=>$("change-dialog").close());
  $("cancel-change").addEventListener("click",()=>$("change-dialog").close());
  function configureChangeValue(){
    const field=$("change-field").value,input=$("change-value");
    const date=timeFields.has(field);
    if(date){
      if(!input.closest(".date-input-row"))addDateTools(input);
      input.required=true;input.placeholder="YYYY-MM-DD HH:MM";
    }else{
      const row=input.closest(".date-input-row");
      if(row){row.parentNode.insertBefore(input,row);row.remove();}
      input.readOnly=false;input.removeAttribute("pattern");input.removeAttribute("min");input.removeAttribute("max");input.removeAttribute("step");input.maxLength=524288;input.type=numberFields.has(field)?"number":"text";
      input.inputMode=numberFields.has(field)?"decimal":"text";
      input.classList.remove("date-entry");
      input.placeholder="Enter new value";
    }
    input.value="";
    input.setCustomValidity("");
  }
  $("change-field").addEventListener("change",configureChangeValue);
  $("change-form").addEventListener("submit",async event=>{
    event.preventDefault();if(!state.change||!state.session)return;
    const {table,row,action}=state.change;
    const reason=$("change-reason").value.trim();
    $("change-value").setCustomValidity("");
    if(reason.length<5){notice("Please enter at least 5 characters for the reason.",true);return;}
    let changes={};
    try{
      if(action==="update"){
        const field=$("change-field").value,raw=$("change-value").value;
        if(!field)throw new Error("Select a field");
        changes={[field]:transformChangeValue(field,raw)};
      }
      await repo.requestChange({target_table:table,record_id:row.id,request_type:action,
        requested_changes:changes,reason,requested_by:state.session.user.id});
      $("change-dialog").close();state.change=null;navigate("requests");notice("Request sent to Admin. No source data was changed. Check Pending below.");
    }catch(err){notice("Request failed: "+err.message,true);}
  });
  async function loadRequests(){
    try{
      const requests=await repo.fetch("change_requests");
      const rows=requests.map(r=>{
        const tr=document.createElement("tr");
        [r.id,(modules[r.target_table]?.title||"Record")+" #"+r.record_id,r.request_type,r.reason,fmt(r.requested_at,"created_at")].forEach(v=>tr.append(cell(v)));
        const status=cell(r.status);status.className="tag "+r.status;tr.append(status);
        const actions=document.createElement("td"),area=document.createElement("div");area.className="actions";
        if(admin()&&r.status==="pending"){
          area.append(button("Approve","primary small",()=>review(r.id,true)));
          area.append(button("Reject","danger small",()=>review(r.id,false)));
        }else if(r.admin_note)area.textContent=r.admin_note;
        actions.append(area);tr.append(actions);return tr;
      });
      tableInto("requests-table",["ID","Record","Action","Reason","Requested","Status","Review"],rows);
    }catch(err){notice("Requests unavailable: "+err.message,true);}
  }
  async function review(id,approve){
    const note=window.prompt(approve?"Approval note (optional)":"Reason for rejection (optional)","");
    if(note===null)return;
    try{await repo.reviewChange(id,approve,note);notice(approve?"Approved and applied to record.":"Request rejected.");await loadRequests();}
    catch(err){notice("Could not review: "+err.message,true);}
  }
  async function loadUsers(){
    if(!admin())return;
    try{
      const profiles=await repo.fetch("profiles",250);
      const rows=profiles.map(u=>{
        const tr=document.createElement("tr");tr.append(cell(u.email));
        const name=document.createElement("input");name.className="user-name";name.value=u.full_name||"";
        const nameCell=document.createElement("td");nameCell.append(name);tr.append(nameCell);
        const roleSelect=document.createElement("select");roleSelect.className="inline-select";
        Object.entries(roles).forEach(([key,label])=>{const opt=document.createElement("option");opt.value=key;opt.textContent=label;opt.selected=key===u.role;roleSelect.append(opt);});
        const roleCell=document.createElement("td");roleCell.append(roleSelect);tr.append(roleCell);
        const active=document.createElement("input");active.type="checkbox";active.checked=u.is_active;active.style.width="auto";
        const activeCell=document.createElement("td");activeCell.append(active);tr.append(activeCell);
        const save=button("Save role","primary small",async()=>{
          save.disabled=true;
          try{await repo.setRole(u.user_id,roleSelect.value,name.value,active.checked);notice("Role saved for "+u.email);await loadUsers();}
          catch(err){notice("Role change failed: "+err.message,true);}finally{save.disabled=false;}
        });
        const td=document.createElement("td");td.append(save);tr.append(td);return tr;
      });
      tableInto("users-table",["Account","Full name","Role","Active","Action"],rows);
    }catch(err){notice("Failed to load staff accounts: "+err.message,true);}
  }
  // Human-friendly audit history: no UUIDs, table names, column codes, or JSON.
  const auditVerbs={INSERT:"Added",UPDATE:"Updated",DELETE:"Deleted"};
  const auditLabels={status:"Status",notes:"Notes",created_at:"Created on",updated_at:"Last updated"};
  const skippedAuditFields=new Set(["id","user_id","created_by","created_at","updated_at","reviewed_by","actor_id"]);
  const entityLabels={
    heats:"heat",transfers:"billet transfer",rolling_batches:"rolling batch",
    customers:"customer",sales_orders:"sales order",loading_events:"loading record",
    change_requests:"change request",profiles:"staff account"
  };
  function auditFieldLabel(table,key){
    return modules[table]?.fields.find(f=>f.key===key)?.label || auditLabels[key] ||
      ({heat_id:"Related heat",order_id:"Sales order",customer_id:"Customer",full_name:"Employee name",role:"Job role",is_active:"Account active",email:"Email",request_type:"Request",reason:"Reason",admin_note:"Manager's note",payment_terms:"Payment option"})[key] || "";
  }
  function auditRecordName(table,oldRow,newRow){
    const obj=newRow||oldRow||{};
    const name=obj.heat_number||obj.order_no||obj.name||obj.truck_plate||obj.full_name;
    return name?`${entityLabels[table]||"entry"} ${String(name)}`:entityLabels[table]||"factory record";
  }
  function humanAuditValue(table,key,value,lookups={}){
    if(value===null||value===undefined||value==="")return "Not provided";
    if(typeof value==="boolean")return value?"Yes":"No";
    if(["heat_id","customer_id","order_id"].includes(key))return lookups[key]?.get(String(value))||"Related factory record";
    if(timeFields.has(key)||key.endsWith("_at"))return displayFactoryTime(value);
    if(key==="role")return roles[value]||String(value);
    if(typeof value==="object")return "Updated information";
    if(key==="furnace")return "Furnace "+value;
    return String(value);
  }
  function friendlyAuditDetails(table,action,previous,current,lookups){
    const oldRow=previous||{},newRow=current||{};
    const relevant=action==="INSERT"?newRow:action==="DELETE"?oldRow:newRow;
    const fields=Object.keys(relevant).filter(key=>!skippedAuditFields.has(key)&&auditFieldLabel(table,key));
    if(action==="UPDATE"){
      const changed=fields.filter(key=>JSON.stringify(oldRow[key])!==JSON.stringify(newRow[key]));
      return changed.map(key=>({label:auditFieldLabel(table,key),before:humanAuditValue(table,key,oldRow[key],lookups),after:humanAuditValue(table,key,newRow[key],lookups)}));
    }
    return fields.map(key=>({label:auditFieldLabel(table,key),value:humanAuditValue(table,key,relevant[key],lookups)}));
  }
  async function loadAudit(){
    if(!["admin","management"].includes(state.profile?.role))return;
    try{
      const [events,profiles,heats,customers,orders]=await Promise.all([
        repo.fetch("audit_log",100),repo.fetch("profiles",250),
        repo.fetch("heats",250),repo.fetch("customers",250),repo.fetch("sales_orders",250)
      ]);
      const names=new Map(profiles.map(p=>[p.user_id,p.full_name||p.email||"Staff member"]));
      const lookups={
        heat_id:new Map(heats.map(h=>[String(h.id),h.heat_number||"Heat record"])),
        customer_id:new Map(customers.map(c=>[String(c.id),c.name||"Customer"])),
        order_id:new Map(orders.map(o=>[String(o.id),o.order_no||"Sales order"]))
      };
      const rows=events.map(r=>{
        const tr=document.createElement("tr");
        const who=r.actor_id?(names.get(r.actor_id)||"Factory staff member"):"System";
        const thing=auditRecordName(r.table_name,r.old_data,r.new_data);
        let sentence=(auditVerbs[r.action]||"Changed")+" "+thing;
        if(r.table_name==="change_requests"){
          if(r.action==="INSERT")sentence="Submitted a change request";
          else if(r.action==="UPDATE"&&r.old_data?.status!==r.new_data?.status){
            sentence=r.new_data?.status==="approved"?"Approved a change request":r.new_data?.status==="rejected"?"Rejected a change request":"Updated a change request";
          }
        }
        tr.append(cell(sentence),cell(who),cell(fmt(r.created_at,"created_at")));
        const td=document.createElement("td");
        const details=document.createElement("details"),summary=document.createElement("summary");
        summary.textContent="View changes";details.append(summary);
        const lines=friendlyAuditDetails(r.table_name,r.action,r.old_data,r.new_data,lookups);
        if(!lines.length){const p=document.createElement("p");p.className="muted";p.textContent="Activity recorded successfully.";details.append(p);}
        else{
          const list=document.createElement("div");list.className="audit-friendly-list";
          lines.forEach(line=>{
            const item=document.createElement("div");item.className="audit-friendly-item";
            const label=document.createElement("strong");label.textContent=line.label;item.append(label);
            const value=document.createElement("span");
            value.textContent="value" in line?line.value:`${line.before} → ${line.after}`;
            item.append(value);list.append(item);
          });details.append(list);
        }
        td.append(details);tr.append(td);return tr;
      });
      tableInto("audit-table",["What happened","Employee","Date and time","Information"],rows);
    }catch(err){notice("Audit unavailable: "+err.message,true);}
  }

  // V0.7: staged flow panels. All state transitions are performed by an
  // authenticated SQL RPC; buttons do not directly insert/update stage tables.
  function fieldControl(title,type,opts=[]) {
    const lab=document.createElement('label');lab.textContent=title;
    const input=document.createElement(opts.length?'select':'input');
    if(!opts.length){input.type=type||'text';if(type==='number'){input.min='0.01';input.step='any';}}
    opts.forEach(([v,name])=>{const o=document.createElement('option');o.value=v;o.textContent=name;input.append(o);});
    lab.append(input);return {lab,input};
  }
  async function stage(action,id,args={},success='Stage saved') {
    try{
      await workflowService.run(action,id,args);
      await loadRecords();notice(success);
    }catch(e){notice('Operation failed: '+e.message,true);}
  }
  const heatTitle=(h)=>`${h.heat_number} · Furnace ${h.furnace} · ${h.weight_tons} tons`;
  function flowCard(heading,detail){
    const c=document.createElement('div');c.className='workflow-card';
    const h=document.createElement('h4');h.textContent=heading;
    const p=document.createElement('p');p.className='muted';p.textContent=detail;c.append(h,p);return c;
  }
  function flowBtn(card,label,action){const b=button(label,'primary small',action);card.append(b);return b;}
  function appendForm(card,controls,label,handler){
    const form=document.createElement('form');form.className='compact-flow-form';
    controls.forEach(c=>form.append(c.lab));const save=button(label,'primary',()=>{});save.type='submit';form.append(save);
    form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{await handler(controls.map(c=>c.input.value));}finally{save.disabled=false;}});
    card.append(form);
  }
  async function loadInventory(){
    const container=$('inventory-metrics');container.replaceChildren();
    try{
      const {data,error}=await client.rpc('factory_inventory');if(error)throw error;
      for(const row of data){const c=document.createElement('article');c.className='metric';
        const x=document.createElement('strong');x.textContent=`${row.size_mm} mm`;x.className='label';
        const n=document.createElement('div');n.className='number';n.textContent=`${Number(row.available_tons).toFixed(2)} t`;
        const hint=document.createElement('div');hint.className='hint';hint.textContent=`Produced ${row.produced_tons} t · Dispatched ${row.dispatched_tons} t`;
        c.append(x,n,hint);container.append(c);
      }
    }catch(e){notice('Inventory unavailable: '+e.message,true);}
  }
  async function renderFactoryFlow(table){
    const box=$('factory-flow');box.replaceChildren();
    const name=$('factory-flow-title'),desc=$('factory-flow-help');
    const working=canCreate(table),heats=['transfers','rolling_batches'].includes(table)?await repo.fetch('heats',120):[];
    const transfers=table==='transfers'||table==='rolling_batches'?await repo.fetch('transfers',120):[];
    if(table==='transfers'){
      name.textContent='Ready · In transit · Arrived';
      desc.textContent=working?'Choose a heat marked Ready for Transfer, start transport, then record its arrival at the rolling mill.':'View transfer progress; transport controls are limited to the transport team.';
      const byHeat=new Set(transfers.map(t=>String(t.heat_id)));
      for(const h of heats.filter(x=>x.ready_for_transfer_at&&!byHeat.has(String(x.id)))){
        const card=flowCard(heatTitle(h),`Ready since ${displayFactoryTime(h.ready_for_transfer_at)} · Estimated rolling entry ${displayFactoryTime(addMinutes(h.casting_ended_at||h.ready_for_transfer_at,150))}`);
        if(working)flowBtn(card,'Start Transfer',()=>stage('transfer_start',h.id,{},'Transfer started.'));box.append(card);
      }
      for(const t of transfers){
        const h=heats.find(x=>String(x.id)===String(t.heat_id));
        const label=h?heatTitle(h):`Heat record ${t.heat_id}`;
        const detail=t.arrived_at?`Arrived ${displayFactoryTime(t.arrived_at)} · Delivered ${t.delivered_tons} tons`:`In transit · Started ${displayFactoryTime(t.started_at)||'Legacy record'}`;
        const card=flowCard(label,detail);
        if(working&&t.started_at&&!t.arrived_at){const tons=fieldControl('Delivered tons','number');
          if(h)tons.input.value=String(h.weight_tons);
          appendForm(card,[tons],'Confirm Arrival',async ([v])=>stage('transfer_arrive',t.id,{tons:Number(normDigits(v))},'Billet arrived and is available for rolling.'));
        }box.append(card);
      }
    }else if(table==='rolling_batches'){
      name.textContent='Arrived billets · Active rolling · Finished';
      desc.textContent='Start rolling only after billet arrival. Ending rolling adds finished tons to inventory.';
      const batches=await repo.fetch('rolling_batches',120),byHeat=new Set(batches.map(b=>String(b.heat_id)));
      for(const t of transfers.filter(x=>x.arrived_at&&!byHeat.has(String(x.heat_id)))){
        const h=heats.find(x=>String(x.id)===String(t.heat_id));if(!h)continue;
        const card=flowCard(heatTitle(h),`Billet arrived ${displayFactoryTime(t.arrived_at)} · ${t.delivered_tons} t available for rolling`);
        if(working){const sz=fieldControl('Bar size (mm)','select',[['12','12 mm'],['14','14 mm'],['16','16 mm']]);
          appendForm(card,[sz],'Start Rolling',async([v])=>stage('rolling_start',h.id,{size_mm:Number(v)},'Rolling started.'));
        }box.append(card);
      }
      for(const b of batches){const h=heats.find(x=>String(x.id)===String(b.heat_id));
        const card=flowCard(`${h?.heat_number||'Heat '+b.heat_id} · ${b.size_mm} mm`,b.finished_at?`Finished ${displayFactoryTime(b.finished_at)} · ${b.produced_tons} t added to inventory`:`Rolling started ${displayFactoryTime(b.started_at)} · Expected finish ${displayFactoryTime(b.expected_finished_at||addMinutes(b.started_at,70))}`);
        if(working&&!b.finished_at){const tons=fieldControl('Finished tons','number');const t=transfers.find(x=>String(x.heat_id)===String(b.heat_id));if(t?.delivered_tons)tons.input.value=String(t.delivered_tons);
          appendForm(card,[tons],'End Rolling',async([v])=>stage('rolling_end',b.id,{tons:Number(normDigits(v))},'Rolling completed. Inventory updated.'));
        }box.append(card);
      }
    }else if(table==='loading_events'){
      name.textContent='Dispatch an order';desc.textContent='Confirmed dispatch deducts available stock and updates remaining order quantity. No duplicate stock deductions.';
      const orders=await repo.fetch('sales_orders',120),dispatches=await repo.fetch('loading_events',120);
      const inventory=await client.rpc('factory_inventory');if(inventory.error)throw inventory.error;
      for(const o of orders){const used=dispatches.filter(x=>String(x.order_id)===String(o.id)&&['Loaded','Dispatched'].includes(x.status)).reduce((a,x)=>a+Number(x.loaded_tons||0),0),remaining=Number(o.qty_tons)-used;
        const stock=inventory.data.find(x=>Number(x.size_mm)===Number(o.size_mm));
        const card=flowCard(`Order ${o.order_no} · ${o.size_mm} mm`,remaining<0?`⚠ Over-dispatched by ${Math.abs(remaining).toFixed(2)} t in historical records. Ask Admin to investigate.`:`Order remaining: ${remaining.toFixed(2)} tons · Factory available for ${o.size_mm} mm: ${Number(stock?.available_tons||0).toFixed(2)} tons`);
        if(working&&remaining>0){const plate=fieldControl('Truck plate','text'),driver=fieldControl('Driver name (optional)','text'),tons=fieldControl('Dispatched tons','number');
          appendForm(card,[plate,driver,tons],'Confirm Dispatch',async([p,d,v])=>stage('dispatch',o.id,{truck_plate:p,driver_name:d,tons:Number(normDigits(v))},'Dispatch saved. Stock and order updated.'));
        }box.append(card);
      }
    }else if(table==='sales_orders'){
      name.textContent='Available finished goods';desc.textContent='Inventory is linked to completed rolling and confirmed dispatches. Orders may be created before stock exists; dispatch requires available stock.';
      const result=await client.rpc('factory_inventory');if(result.error)throw result.error;
      for(const s of result.data)box.append(flowCard(`${s.size_mm} mm`,`${Number(s.available_tons).toFixed(2)} t available · ${s.produced_tons} t produced · ${s.dispatched_tons} t dispatched`));
    }
    if(!box.children.length)box.textContent='No items ready for this stage.';
  }
  $('refresh-flow').addEventListener('click',()=>state.table&&renderFactoryFlow(state.table).catch(e=>notice(e.message,true)));
  $('refresh-inventory').addEventListener('click',loadInventory);
  // Workflow expectations: combined melting+casting cycle = 210 min.
  // Standalone melting/casting durations are not known and are not invented.
  const stageNames={melting:"Melting in progress",melting_done:"Melting completed",casting:"Casting in progress",ready:"Ready for Transfer"};
  const addMinutes=(iso,n)=>new Date(new Date(iso).getTime()+n*60000);
  function expectedStatus(actual,forecast){
    if(!actual||!forecast)return "";
    const delta=Math.round((new Date(actual)-new Date(forecast))/60000);
    if(delta===0)return "On time";
    return delta>0?`Delayed by ${delta} minutes`:`Completed ${Math.abs(delta)} minutes early`;
  }
  function workflowText(row){
    const box=document.createElement("div");box.className="workflow-detail";
    const stage=row.casting_ended_at?"ready":row.casting_started_at?"casting":row.melting_ended_at?"melting_done":"melting";
    const title=document.createElement("strong");title.textContent=stageNames[stage];box.append(title);
    const lines=[];
    if(!row.workflow_started_at)lines.push("Historical record — stage timestamps not available.");
    if(row.start_time)lines.push(`Melting started: ${displayFactoryTime(row.start_time)}`);
    if(row.melting_ended_at)lines.push(`Melting ended: ${displayFactoryTime(row.melting_ended_at)}`);
    if(row.casting_started_at)lines.push(`Casting started: ${displayFactoryTime(row.casting_started_at)}`);
    if(row.casting_ended_at)lines.push(`Casting ended: ${displayFactoryTime(row.casting_ended_at)}`);
    if(row.start_time && row.workflow_started_at){
      const prediction=addMinutes(row.start_time,210);
      if(row.casting_ended_at)lines.push(`Planned combined-cycle marker: ${displayFactoryTime(prediction.toISOString())} — ${expectedStatus(row.casting_ended_at,prediction)}`);
      else lines.push(`Expected combined melting/casting cycle marker: ${displayFactoryTime(prediction.toISOString())} (not a fixed deadline for either stage alone)`);
    }
    if(row.casting_ended_at)lines.push(`Expected rolling entry: ${displayFactoryTime(addMinutes(row.casting_ended_at,150).toISOString())}`);
    const p=document.createElement("p");p.className="muted";p.textContent=lines.join(" · ");box.append(p);
    return box;
  }
  async function executeStage(row,action){
    const names={end_melting:"End Melting",start_casting:"Start Casting",end_casting:"End Casting"};
    if(!window.confirm(`${names[action]} for heat ${row.heat_number}? Current time will be recorded permanently.`))return;
    try{
      const {error}=await client.rpc("record_heat_stage",{p_heat_id:row.id,p_action:action});
      if(error)throw error;
      await loadRecords();notice(`${names[action]} recorded at current time. ${action==='end_casting'?'Heat is ready for transfer.':''}`);
    }catch(err){notice("Could not record stage: "+err.message,true);}
  }
  function stageButtons(row){
    const div=document.createElement("div");div.className="stage-actions";
    if(!canCreate("heats"))return div;
    if(!row.workflow_started_at){div.textContent="Legacy record — use Request Edit to correct it.";return div;}
    let action;
    if(!row.melting_ended_at)action="end_melting";
    else if(!row.casting_started_at)action="start_casting";
    else if(!row.casting_ended_at)action="end_casting";
    if(action){
      const names={end_melting:"End Melting",start_casting:"Start Casting",end_casting:"End Casting"};
      div.append(button(names[action],"primary small",()=>executeStage(row,action)));
    }
    return div;
  }
  async function renderTransferQueue(){
    const box=$("transfer-queue");if(!box)return;box.replaceChildren();
    try{
      const [heats,transfers]=await Promise.all([repo.fetch("heats",120),repo.fetch("transfers",120)]);
      const transferred=new Set(transfers.map(t=>String(t.heat_id)));
      const ready=heats.filter(h=>h.casting_ended_at&&!transferred.has(String(h.id)));
      for(const h of ready){
        const card=document.createElement("div");card.className="workflow-card";
        const strong=document.createElement("strong");strong.textContent=`${h.heat_number} · Furnace ${h.furnace} · ${h.weight_tons} tons`;
        const caption=document.createElement("p");caption.textContent=`Casting finished ${displayFactoryTime(h.casting_ended_at)} · Expected rolling entry ${displayFactoryTime(addMinutes(h.casting_ended_at,150).toISOString())}`;
        card.append(strong,caption);box.append(card);
      }
      if(!ready.length)box.textContent="No new heats ready for transfer.";
    }catch(err){box.textContent="Transfer queue unavailable: "+err.message;}
  }
  async function renderHeatWorkflow(){
    const box=$("heat-workflow");if(!box)return;
    box.replaceChildren();
    try{
      const rows=await repo.fetch("heats",120);
      for(const row of rows){
        const card=document.createElement("div");card.className="workflow-card";
        const heading=document.createElement("h4");heading.textContent=`${row.heat_number} · Furnace ${row.furnace} · ${row.weight_tons} t`;
        card.append(heading,workflowText(row),stageButtons(row));box.append(card);
      }
      if(!rows.length)box.textContent="No heats yet. Start melting to create a new heat.";
    }catch(err){box.textContent="Unable to load heat stages: "+err.message;}
  }
  function renderHeatForm(){
    const form=$("record-form"),fields=$("record-fields");fields.replaceChildren();
    const required=[{key:"heat_number",label:"Heat number",type:"text"},{key:"furnace",label:"Furnace",type:"select",options:[["A","Furnace A"],["B","Furnace B"]]},{key:"weight_tons",label:"Heat weight (tons)",type:"number"},{key:"notes",label:"Notes",type:"text",required:false}];
    for(const f of required){
      const wrap=document.createElement("div");wrap.className="field";
      const label=document.createElement("label");label.textContent=f.label;label.htmlFor="f-"+f.key;
      let input;if(f.type==="select"){
        input=document.createElement("select");for(const [val,txt] of f.options){const opt=document.createElement("option");opt.value=val;opt.textContent=txt;input.append(opt);}
      }else{input=document.createElement("input");input.type=f.type;if(f.type==="number"){input.min="0.01";input.step="any";}}
      input.id="f-"+f.key;input.name=f.key;input.required=f.required!==false;wrap.append(label,input);fields.append(wrap);
    }
    $("create-title").textContent="Start Melting";
    $("record-save").textContent="Start Melting & Save";
  }
  function normDigits(s){return String(s).replace(/[٠-٩]/g,ch=>String(ch.charCodeAt(0)-1632)).replace(/[۰-۹]/g,ch=>String(ch.charCodeAt(0)-1776));}
  async function enterSession(session){
    if(!session){state.session=null;state.profile=null;$("app-shell").hidden=true;$("login-screen").hidden=false;return;}
    try{
      const user=session.user;
      if(state.session?.user?.id===user.id&&state.profile)return;
      const profile=await repo.profile(user.id);
      if(!profile.is_active)throw new Error("Your account has been disabled.");
      state.session=session;state.profile=profile;
      $("login-screen").hidden=true;$("app-shell").hidden=false;
      $("user-name").textContent=profile.full_name;
      $("user-role").textContent=roles[profile.role]||profile.role;
      state.active="overview";navigate("overview");
    }catch(err){authNotice("Account profile unavailable: "+err.message,true);$("app-shell").hidden=true;$("login-screen").hidden=false;}
  }
  $("login-form").addEventListener("submit",async event=>{
    event.preventDefault();const b=event.target.querySelector("button");b.disabled=true;
    authNotice("Signing in...");
    try{
      const email=$("login-email").value.trim(),password=$("login-password").value;
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error)throw error;
      $("login-password").value="";authNotice("");await enterSession(data.session);
    }catch(err){authNotice("Login failed: "+err.message,true);}finally{b.disabled=false;}
  });
  $("logout-btn").addEventListener("click",async()=>{
    const {error}=await client.auth.signOut();
    if(error)notice("Logout failed: "+error.message,true);
    else enterSession(null);
  });
  $("menu-toggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
  $("refresh-overview").addEventListener("click",loadOverview);
  $("refresh-records").addEventListener("click",loadRecords);
  $("refresh-requests").addEventListener("click",loadRequests);
  $("refresh-users").addEventListener("click",loadUsers);
  $("refresh-audit").addEventListener("click",loadAudit);
  client.auth.onAuthStateChange((event,session)=>{
    if(event==="SIGNED_OUT")enterSession(null);
    if(event==="SIGNED_IN"||event==="INITIAL_SESSION")setTimeout(()=>enterSession(session),0);
  });
  client.auth.getSession().then(({data,error})=>{if(error)authNotice(error.message,true);else enterSession(data.session);});
})();
