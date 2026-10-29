"use strict";
// Domain model + metadata: one place for validation and supported factory activities.
// This separation supports SRP, easy unit testing, and later movement to TypeScript modules.
(function () {
  const roles = {
    admin: "System Administrator", management: "Management (read only)",
    melting: "Melting Supervisor", billet_transport: "Billet Transfer",
    rolling: "Rolling Supervisor", sales: "Sales Officer",
    loading: "Loading & Dispatch", viewer: "Unassigned (read only)"
  };
  const field = (key,label,type="text",required=true,options=null) => ({key,label,type,required,options});
  const modules = {
    heats: {
      title:"Melting & Casting", icon:"🔥", summary:"Record furnace heats, casting times and tonnage.",
      creator:["admin","melting"], reader:["admin","management","melting"],
      fields:[field("heat_number","Heat number"),field("furnace","Furnace","select",true,[["A","Furnace A"],["B","Furnace B"]]),
        field("weight_tons","Heat weight (tons)","number"),field("start_time","Melting start","datetime-local"),
        field("ccm_poured_at","CCM pouring time","datetime-local",false),field("notes","Notes","text",false)],
      list:["heat_number","furnace","weight_tons","start_time","ccm_poured_at","status"]
    },
    transfers: {
      title:"Billet Transfer",icon:"🚚",summary:"Record billet transfer arrival and delivered tons.",
      creator:["admin","billet_transport"],reader:["admin","management","billet_transport"],
      fields:[field("heat_id","Source heat","heats"),field("arrived_at","Arrival at rolling","datetime-local"),
        field("delivered_tons","Delivered tons","number"),field("notes","Notes","text",false)],
      list:["heat_id","arrived_at","delivered_tons","notes"]
    },
    rolling_batches: {
      title:"Rolling Mill",icon:"⚙️",summary:"Track rolling sizes 12 / 14 / 16 mm and finished weight.",
      creator:["admin","rolling"],reader:["admin","management","rolling"],
      fields:[field("heat_id","Source heat","heats"),field("size_mm","Bar size (mm)","select",true,[["12","12 mm"],["14","14 mm"],["16","16 mm"]]),
        field("started_at","Rolling started","datetime-local"),field("finished_at","Rolling finished","datetime-local",false),
        field("produced_tons","Finished tons","number"),field("status","Status","select",true,[["In Progress","In Progress"],["Completed","Completed"]]),
        field("notes","Notes","text",false)],
      list:["heat_id","size_mm","started_at","finished_at","produced_tons","status"]
    },
    customers: {
      title:"Customers",icon:"👥",summary:"Customer contact and basic account details.",
      creator:["admin","sales"],reader:["admin","management","sales"],
      fields:[field("name","Customer name"),field("phone","Phone","text",false),field("notes","Notes","text",false)],
      list:["name","phone","notes"]
    },
    sales_orders: {
      title:"Sales & Orders",icon:"📊",summary:"Create sales orders by customer, size, weight and price.",
      creator:["admin","sales"],reader:["admin","management","sales"],
      fields:[field("order_no","Order number"),field("customer_id","Customer","customers"),
        field("size_mm","Bar size (mm)","select",true,[["12","12 mm"],["14","14 mm"],["16","16 mm"]]),
        field("qty_tons","Ordered tons","number"),field("price_per_ton","Price per ton","number"),
        field("payment_terms","Payment option","select",true,[["Paid","Paid"],["Payment on Delivery","Payment on Delivery"]])],
      list:["order_no","customer_id","size_mm","qty_tons","price_per_ton","payment_terms"]
    },
    loading_events: {
      title:"Loading & Dispatch",icon:"📦",summary:"Record truck information, loading and dispatch times.",
      creator:["admin","loading"],reader:["admin","management","loading"],
      fields:[field("order_id","Sales order","sales_orders"),field("truck_plate","Truck plate"),
        field("driver_name","Driver name","text",false),field("loaded_tons","Loaded tons","number"),
        field("loaded_at","Loading time","datetime-local"),field("status","Status","select",true,[["Loaded","Loaded"],["Dispatched","Dispatched"]])],
      list:["order_id","truck_plate","driver_name","loaded_tons","loaded_at","status"]
    }
  };
  const numberFields = new Set(["weight_tons","delivered_tons","produced_tons","qty_tons","price_per_ton","size_mm","heat_id","customer_id","order_id"]);
  const timeFields = new Set(["start_time","ccm_poured_at","arrived_at","started_at","finished_at","loaded_at"]);
  // Use an explicit numeric YYYY-MM-DD HH:MM format independent of OS/browser language.
  function parseFactoryTime(raw) {
    const match=/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(raw).trim());
    if (!match) throw new Error("Date must be in YYYY-MM-DD HH:MM format (24-hour time).");
    const [,y,m,d,h,min]=match.map(Number);
    const date=new Date(y,m-1,d,h,min,0,0);
    if (date.getFullYear()!==y||date.getMonth()!==m-1||date.getDate()!==d||date.getHours()!==h||date.getMinutes()!==min)
      throw new Error("Invalid date or time: "+raw);
    return date.toISOString();
  }
  const pad=n=>String(n).padStart(2,"0");
  function displayFactoryTime(value){
    if (!value) return "";
    const date=new Date(value);
    if(Number.isNaN(date.getTime())) return String(value);
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  class SteelRecord {
    constructor(table, values) {
      if (!modules[table]) throw new Error("Unknown record type");
      this.table = table;
      this.values = {};
      for (const f of modules[table].fields) {
        const v = (values[f.key] ?? "").toString().trim();
        if (f.required && !v) throw new Error(f.label + " is required");
        if (!v) continue;
        if (numberFields.has(f.key)) {
          const n = Number(v);
          if (!Number.isFinite(n) || (f.key!=="price_per_ton" && n <= 0) || (f.key==="price_per_ton" && n<0)) {
            throw new Error("Invalid value for " + f.label);
          }
          this.values[f.key] = n;
        } else if (timeFields.has(f.key)) {
          this.values[f.key] = parseFactoryTime(v);
        } else {
          this.values[f.key] = v;
        }
      }
      if (table==="rolling_batches" && this.values.finished_at && this.values.finished_at<this.values.started_at) {
        throw new Error("Rolling finish cannot be before its start");
      }
    }
    toJSON(){return {...this.values};}
  }
  function transformChangeValue(key,value) {
    if (numberFields.has(key)) {
      const n=Number(value);
      if (!Number.isFinite(n)) throw new Error("Invalid number");
      return n;
    }
    if (timeFields.has(key)) {
      if (!value && ["finished_at","ccm_poured_at"].includes(key)) return "";
      return parseFactoryTime(value);
    }
    return value.trim();
  }
  window.SteelDomain = {roles,modules,SteelRecord,transformChangeValue,numberFields,timeFields,parseFactoryTime,displayFactoryTime};
})();
