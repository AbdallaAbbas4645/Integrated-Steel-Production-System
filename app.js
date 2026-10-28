"use strict";
(() => {
  const cfg=window.STEEL_CONFIG||{};
  const $=id=>document.getElementById(id);
  const {roles,modules,SteelRecord,transformChangeValue,timeFields,displayFactoryTime}=window.SteelDomain;
  const state={session:null,profile:null,active:"overview",records:[],table:null,change:null,adminEdit:null,loading:false};
  const isConfigured=cfg.url?.startsWith("https://") && cfg.url.includes(".supabase.co") &&
    cfg.publishableKey?.startsWith("sb_publishable_");
  function notice(text,error=false){const el=$("global-message");el.className="message"+(error?" error":" good");el.textContent=text;}
  function authNotice(text,error=false){const el=$("login-message");el.className="message"+(error?" error":" good");el.textContent=text;}
  if(!isConfigured){authNotice("Project setup needed: edit config.js and add your Supabase URL and sb_publishable_ key.",true);$("login-form").querySelector("button").disabled=true;return;}
  if(!window.supabase?.createClient){authNotice("Supabase library did not load. Check internet/CDN access and reload.",true);return;}
  const client=window.supabase.createClient(cfg.url,cfg.publishableKey);
  const repo=new SteelRepository(client);

  const allowed=table=>modules[table]?.reader.includes(state.profile?.role);
  const canCreate=table=>modules[table]?.creator.includes(state.profile?.role);
  const ownRecord=(row,table)=>String(table==="heats"?row.user_id:row.created_by)===state.session?.user.id;
  const admin=()=>state.profile?.role==="admin";
  const mayRequest=(table,row)=>admin()|| (canCreate(table)&&ownRecord(row,table));
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
    state.active=view;state.table=modules[view]?view:null;
    ["overview","records","requests","users","audit"].forEach(v=>$(v+"-view").hidden=true);
    const screen=state.table?"records":view;
    $(screen+"-view").hidden=false;
    $("current-title").textContent=state.table?modules[view].title:({overview:"Overview",requests:"Change Requests",users:"Staff & Roles",audit:"Audit Trail"}[view]);
    buildNavigation();$("global-message").textContent="";
    $("sidebar").classList.remove("open");
    if(state.table)loadRecords();
    else if(view==="overview")loadOverview();
    else if(view==="requests")loadRequests();
    else if(view==="users")loadUsers();
    else if(view==="audit")loadAudit();
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
      repo.fetch(table).then(rows=>{if(box.isConnected)num.textContent=String(rows.length)+(rows.length===120?"+":"");})
        .catch(()=>{if(box.isConnected)num.textContent="—";});
    }
    if(!accessible.length){cards.textContent="Your account has no assigned factory role yet. Ask an administrator to assign your role.";}
    const list=$("overview-modules");list.replaceChildren();
    accessible.forEach(id=>{
      const m=modules[id],b=button(m.icon+"  "+m.title,"module-card",()=>navigate(id));
      const summary=document.createElement("small");summary.textContent=m.summary;b.append(summary);list.append(b);
    });
  }
  async function makeField(f,prefix="f"){
    const box=document.createElement("div");box.className="field";
    const label=document.createElement("label");label.textContent=f.label;label.htmlFor=prefix+"-"+f.key;box.append(label);
    let el;
    if(f.type==="select"||["heats","customers","sales_orders"].includes(f.type)){
      el=document.createElement("select");
      const options=f.options||await repo.fetch(f.type,120).then(rows=>rows.map(r=>[
        String(r.id),f.type==="heats"?r.heat_number:f.type==="customers"?r.name:r.order_no
      ]));
      if(!options.length){const opt=document.createElement("option");opt.value="";opt.textContent="Create the related record first";el.append(opt);}
      options.forEach(([val,text])=>{const opt=document.createElement("option");opt.value=val;opt.textContent=text;el.append(opt);});
    }else{
      el=document.createElement("input");
      el.type=f.type==="datetime-local"?"text":f.type;
      el.autocomplete="off";
      if(f.type==="datetime-local"){
        el.placeholder="YYYY-MM-DD HH:MM";el.pattern="[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}";
        el.title="24-hour English date: YYYY-MM-DD HH:MM";el.inputMode="numeric";el.lang="en-US";el.dir="ltr";
      }
      if(f.type==="number"){el.step="any";el.min=f.key==="price_per_ton"?"0":"0.01";}
    }
    el.id=prefix+"-"+f.key;el.name=f.key;el.required=f.required;
    box.append(el);return box;
  }
  async function renderForm(table){
    const config=modules[table];$("module-title").textContent=config.title;$("module-subtitle").textContent=config.summary;
    $("create-title").textContent="Register new "+config.title.toLowerCase();
    const show=canCreate(table);$("create-panel").hidden=!show;
    if(!show)return;
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
      const m=modules[table],rows=records.map(row=>{
        const tr=document.createElement("tr");
        tr.append(cell(row.id));m.list.forEach(key=>tr.append(cell(key==="payment_terms" && !row[key]?"Not set (older order)":fmt(row[key],key))));
        const actions=document.createElement("td"),area=document.createElement("div");area.className="actions";
        if(mayRequest(table,row)){
          area.append(button(admin()?"Edit":"Request edit","outline small",()=>openChange(table,row,"update")));
          area.append(button(admin()?"Delete":"Request delete","danger small",()=>openChange(table,row,"delete")));
        }else if(state.profile.role!=="management")area.textContent="View only";
        actions.append(area);tr.append(actions);return tr;
      });
      tableInto("records-table",["ID",...m.list.map(k=>m.fields.find(f=>f.key===k)?.label||k),"Actions"],rows);
    }catch(err){notice("Failed to load records: "+err.message,true);}
  }
  $("record-form").addEventListener("submit",async(event)=>{
    event.preventDefault();const table=state.table;if(!table||!canCreate(table))return;
    const submit=$("record-save");submit.disabled=true;
    try{
      const values=Object.fromEntries(new FormData(event.target));
      const record=new SteelRecord(table,values);
      await repo.insert(table,record.toJSON());
      event.target.reset();notice("Record saved successfully in Supabase.");await loadRecords();
    }catch(err){notice("Save failed: "+err.message,true);}finally{submit.disabled=false;}
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
    $("change-value").value="";$("change-reason").value="";
    $("change-dialog").showModal();
  }
  $("close-dialog").addEventListener("click",()=>$("change-dialog").close());
  $("cancel-change").addEventListener("click",()=>$("change-dialog").close());
  $("change-form").addEventListener("submit",async event=>{
    event.preventDefault();if(!state.change||!state.session)return;
    const {table,row,action}=state.change;
    const reason=$("change-reason").value.trim();
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
      $("change-dialog").close();notice("Request sent to Admin. No source data was changed.");
    }catch(err){notice("Request failed: "+err.message,true);}
  });
  async function loadRequests(){
    try{
      const requests=await repo.fetch("change_requests");
      const rows=requests.map(r=>{
        const tr=document.createElement("tr");
        [r.id,r.target_table+" #"+r.record_id,r.request_type,r.reason,fmt(r.requested_at,"created_at")].forEach(v=>tr.append(cell(v)));
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
  async function loadAudit(){
    if(!["admin","management"].includes(state.profile?.role))return;
    try{
      const [events,profiles]=await Promise.all([repo.fetch("audit_log",100),repo.fetch("profiles",250)]);
      const names=new Map(profiles.map(p=>[p.user_id,`${p.full_name || "Staff"} (${p.email})`]));
      const labels={INSERT:"Added",UPDATE:"Updated",DELETE:"Deleted"};
      const rows=events.map(r=>{
        const tr=document.createElement("tr");
        const person=r.actor_id?(names.get(r.actor_id)||"User "+String(r.actor_id).slice(0,8)+"…"):"System";
        [labels[r.action]||r.action,modules[r.table_name]?.title||r.table_name,"#"+r.record_id,person,fmt(r.created_at,"created_at")].forEach(v=>tr.append(cell(v)));
        const td=document.createElement("td"),details=document.createElement("details"),sum=document.createElement("summary");
        sum.textContent="Details";details.append(sum);
        const content=document.createElement("pre");content.className="audit-details";
        content.textContent="Before:\n"+JSON.stringify(r.old_data,null,2)+"\n\nAfter:\n"+JSON.stringify(r.new_data,null,2);
        details.append(content);td.append(details);tr.append(td);return tr;
      });
      tableInto("audit-table",["Action","Department","Record","Performed by","Date & time","Changes"],rows);
    }catch(err){notice("Audit unavailable: "+err.message,true);}
  }
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
