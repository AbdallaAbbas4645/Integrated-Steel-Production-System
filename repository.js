"use strict";
// Repository Pattern: UI and domain logic never need to know the Supabase query syntax.
// This module can later be replaced with a REST API without rewriting the UI.
class SteelRepository {
  constructor(supabase) { this.db=supabase; }
  async fetch(table,limit=120) {
    const {data,error}=await this.db.from(table).select("*").order(table==="profiles"?"created_at":"id",{ascending:false}).limit(limit);
    if(error) throw error;
    return data||[];
  }
  async profile(uid) {
    const {data,error}=await this.db.from("profiles").select("*").eq("user_id",uid).single();
    if(error) throw error;
    return data;
  }
  async insert(table,payload) {
    const {error}=await this.db.from(table).insert(payload);
    if(error) throw error;
  }
  async update(table,id,payload) {
    const {data,error}=await this.db.from(table).update(payload).eq("id",id).select("id");
    if(!error && (!data || !data.length)) throw new Error("Update was not permitted or record not found");
    if(error) throw error;
  }
  async remove(table,id) {
    const {data,error}=await this.db.from(table).delete().eq("id",id).select("id");
    if(!error && (!data || !data.length)) throw new Error("Delete was not permitted or record not found");
    if(error) throw error;
  }
  async requestChange(payload) {await this.insert("change_requests",payload);}
  async reviewChange(id,approve,note) {
    const {error}=await this.db.rpc("admin_review_change",{p_request_id:id,p_approve:approve,p_note:note||null});
    if(error) throw error;
  }
  async setRole(uid,role,fullName,active) {
    const {error}=await this.db.rpc("admin_set_staff_role",{p_user_id:uid,p_role:role,p_full_name:fullName,p_active:active});
    if(error) throw error;
  }
}
window.SteelRepository=SteelRepository;
