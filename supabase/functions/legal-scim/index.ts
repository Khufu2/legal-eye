import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get("SUPABASE_URL")!;
const S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const scimHeaders={"content-type":"application/scim+json","cache-control":"no-store"};
const schemas={list:"urn:ietf:params:scim:api:messages:2.0:ListResponse",user:"urn:ietf:params:scim:schemas:core:2.0:User",group:"urn:ietf:params:scim:schemas:core:2.0:Group",error:"urn:ietf:params:scim:api:messages:2.0:Error"};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:scimHeaders});
const problem=(detail:string,status=400,scimType?:string)=>response({schemas:[schemas.error],detail,status:String(status),...(scimType?{scimType}:{})},status);

async function sha256(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
}

function headers(extra:Record<string,string>={}){return {apikey:S,authorization:`Bearer ${S}`,...extra};}
async function db(path:string,init:RequestInit={}){
  const r=await fetch(`${U}/rest/v1/${path}`,{...init,headers:headers(init.headers as Record<string,string>||{})});
  const text=await r.text();
  if(!r.ok) throw new Error(`Database request failed: ${r.status}`);
  return text?JSON.parse(text):null;
}
async function authAdmin(path:string,init:RequestInit={}){
  const r=await fetch(`${U}/auth/v1/admin/${path}`,{...init,headers:headers({"content-type":"application/json",...(init.headers as Record<string,string>||{})})});
  const text=await r.text();
  if(!r.ok) throw new Error(`Identity operation failed: ${r.status}`);
  return text?JSON.parse(text):null;
}

async function authenticate(request:Request){
  const value=request.headers.get("authorization")||"";
  if(!value.startsWith("Bearer ")) return null;
  const tokenHash=await sha256(value.slice(7));
  const rows=await db(`scim_tokens?select=id,organization_id,status,expires_at&token_sha256=eq.${tokenHash}&status=eq.active`);
  const token=rows?.[0];
  if(!token||token.expires_at&&new Date(token.expires_at)<=new Date()) return null;
  await db(`scim_tokens?id=eq.${token.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({last_used_at:new Date().toISOString()})}).catch(()=>undefined);
  return token;
}

function subPath(url:string){
  const parts=new URL(url).pathname.split("/").filter(Boolean);
  const marker=parts.lastIndexOf("legal-scim");
  return marker>=0?parts.slice(marker+1):parts;
}

function displayName(body:any){
  return body?.displayName||[body?.name?.givenName,body?.name?.familyName].filter(Boolean).join(" ")||body?.userName;
}

async function getAuthUser(id:string){
  const result=await authAdmin(`users/${encodeURIComponent(id)}`);
  return result?.user||result;
}

async function scimUser(id:string,organizationId:string){
  const memberships=await db(`organization_members?select=user_id,is_active,role,created_at&organization_id=eq.${organizationId}&user_id=eq.${id}`);
  if(!memberships?.length) return null;
  const authUser=await getAuthUser(id);
  const profiles=await db(`profiles?select=full_name,title&id=eq.${id}`);
  const profile=profiles?.[0]||{};
  return {schemas:[schemas.user],id,externalId:authUser.user_metadata?.scim_external_id,
    userName:authUser.email,displayName:profile.full_name||authUser.user_metadata?.full_name||authUser.email,
    name:{formatted:profile.full_name||authUser.user_metadata?.full_name||authUser.email},active:memberships[0].is_active,
    emails:[{value:authUser.email,primary:true,type:"work"}],
    roles:[{value:memberships[0].role,primary:true}],title:profile.title||undefined,
    meta:{resourceType:"User",created:memberships[0].created_at,lastModified:authUser.updated_at,
      location:`Users/${id}`}};
}

async function log(token:any,operation:string,resourceType:"User"|"Group",outcome:string,externalId?:string,targetUserId?:string,details:Record<string,unknown>={}){
  await db("scim_sync_events",{method:"POST",headers:{"content-type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({
    organization_id:token.organization_id,scim_token_id:token.id,operation,resource_type:resourceType,
    external_id:externalId||null,target_user_id:targetUserId||null,outcome,details,
  })}).catch(()=>undefined);
}

async function users(request:Request,token:any,id?:string){
  if(request.method==="GET"&&id){
    const user=await scimUser(id,token.organization_id);
    return user?response(user):problem("User not found",404);
  }
  if(request.method==="GET"){
    const url=new URL(request.url);
    const start=Math.max(Number(url.searchParams.get("startIndex")||1),1);
    const count=Math.min(Math.max(Number(url.searchParams.get("count")||100),1),200);
    const filter=url.searchParams.get("filter")||"";
    const email=/userName\s+eq\s+"([^"]+)"/i.exec(filter)?.[1]?.toLowerCase();
    const memberships=await db(`organization_members?select=user_id&organization_id=eq.${token.organization_id}&order=created_at&limit=1000`);
    const resources=[];
    for(const membership of memberships||[]){
      const user=await scimUser(membership.user_id,token.organization_id);
      if(user&&(!email||String(user.userName).toLowerCase()===email)) resources.push(user);
    }
    const window=resources.slice(start-1,start-1+count);
    return response({schemas:[schemas.list],totalResults:resources.length,startIndex:start,itemsPerPage:window.length,Resources:window});
  }
  if(request.method==="POST"){
    const body=await request.json();
    const email=String(body.userName||body.emails?.find((x:any)=>x.primary)?.value||"").trim().toLowerCase();
    if(!email) return problem("userName is required",400,"invalidValue");
    const listed=await authAdmin("users?page=1&per_page=1000");
    let authUser=(listed?.users||[]).find((x:any)=>String(x.email).toLowerCase()===email);
    if(!authUser){
      const created=await authAdmin("users",{method:"POST",body:JSON.stringify({email,email_confirm:true,user_metadata:{
        full_name:displayName(body),scim_external_id:body.externalId,provisioning_source:"scim",
      }})});
      authUser=created?.user||created;
    }
    await db("organization_members",{method:"POST",headers:{"content-type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({
      organization_id:token.organization_id,user_id:authUser.id,role:"viewer",is_active:body.active!==false,
    })});
    await db("profiles",{method:"POST",headers:{"content-type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({
      id:authUser.id,full_name:displayName(body),title:body.title||null,updated_at:new Date().toISOString(),
    })});
    await log(token,"create","User","success",body.externalId,authUser.id);
    return response(await scimUser(authUser.id,token.organization_id),201);
  }
  if((request.method==="PATCH"||request.method==="PUT")&&id){
    const body=await request.json();
    const current=await scimUser(id,token.organization_id);
    if(!current) return problem("User not found",404);
    const changes:Record<string,unknown>={};
    if(request.method==="PUT") Object.assign(changes,{active:body.active,displayName:displayName(body),userName:body.userName,title:body.title});
    for(const operation of body.Operations||[]){
      const key=String(operation.path||"").toLowerCase();
      if(key==="active") changes.active=operation.value;
      else if(key==="displayname"||key==="name.formatted") changes.displayName=operation.value;
      else if(key==="username"||key.startsWith("emails")) changes.userName=operation.value?.value||operation.value;
      else if(key==="title") changes.title=operation.value;
      else if(!key&&operation.value&&typeof operation.value==="object") Object.assign(changes,operation.value);
    }
    if(changes.active!==undefined) await db(`organization_members?organization_id=eq.${token.organization_id}&user_id=eq.${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({is_active:Boolean(changes.active)})});
    if(changes.displayName!==undefined||changes.title!==undefined) await db(`profiles?id=eq.${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({full_name:changes.displayName,title:changes.title,updated_at:new Date().toISOString()})});
    if(changes.userName) await authAdmin(`users/${id}`,{method:"PUT",body:JSON.stringify({email:String(changes.userName),email_confirm:true})});
    await log(token,"update","User","success",body.externalId,id,{fields:Object.keys(changes)});
    return response(await scimUser(id,token.organization_id));
  }
  if(request.method==="DELETE"&&id){
    const current=await scimUser(id,token.organization_id);
    if(!current) return problem("User not found",404);
    await db(`organization_members?organization_id=eq.${token.organization_id}&user_id=eq.${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({is_active:false})});
    await log(token,"deactivate","User","success",current.externalId,id);
    return new Response(null,{status:204});
  }
  return problem("Method not supported",405);
}

async function groups(request:Request,token:any,id?:string){
  if(request.method==="GET"){
    const path=id?`scim_groups?select=*&organization_id=eq.${token.organization_id}&id=eq.${id}`:`scim_groups?select=*&organization_id=eq.${token.organization_id}&order=display_name`;
    const rows=await db(path);
    const resources=[];
    for(const group of rows||[]){
      const members=await db(`scim_group_members?select=user_id&group_id=eq.${group.id}`);
      resources.push({schemas:[schemas.group],id:group.id,externalId:group.external_id,displayName:group.display_name,
        members:(members||[]).map((x:any)=>({value:x.user_id,type:"User",$ref:`Users/${x.user_id}`})),meta:{resourceType:"Group",created:group.created_at,lastModified:group.updated_at,location:`Groups/${group.id}`}});
    }
    if(id) return resources[0]?response(resources[0]):problem("Group not found",404);
    return response({schemas:[schemas.list],totalResults:resources.length,startIndex:1,itemsPerPage:resources.length,Resources:resources});
  }
  if(request.method==="POST"){
    const body=await request.json();
    if(!body.displayName) return problem("displayName is required",400,"invalidValue");
    const created=await db("scim_groups",{method:"POST",headers:{"content-type":"application/json",Prefer:"return=representation"},body:JSON.stringify({organization_id:token.organization_id,external_id:body.externalId||null,display_name:body.displayName})});
    const group=created[0];
    for(const member of body.members||[]) await db("scim_group_members",{method:"POST",headers:{"content-type":"application/json",Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({group_id:group.id,user_id:member.value})});
    await log(token,"create","Group","success",body.externalId,undefined,{group_id:group.id});
    return groups(new Request(request.url,{method:"GET"}),token,group.id).then(x=>new Response(x.body,{status:201,headers:scimHeaders}));
  }
  if((request.method==="PATCH"||request.method==="PUT")&&id){
    const body=await request.json();
    if(body.displayName) await db(`scim_groups?id=eq.${id}&organization_id=eq.${token.organization_id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({display_name:body.displayName,updated_at:new Date().toISOString()})});
    const operations=body.Operations||[];
    for(const operation of operations){
      const values=Array.isArray(operation.value)?operation.value:operation.value?.members||[];
      if(String(operation.op).toLowerCase()==="remove"&&String(operation.path||"").toLowerCase()==="members") await db(`scim_group_members?group_id=eq.${id}`,{method:"DELETE"});
      for(const member of values){
        if(String(operation.op).toLowerCase()==="remove") await db(`scim_group_members?group_id=eq.${id}&user_id=eq.${encodeURIComponent(member.value)}`,{method:"DELETE"});
        else await db("scim_group_members",{method:"POST",headers:{"content-type":"application/json",Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({group_id:id,user_id:member.value})});
      }
    }
    await log(token,"update","Group","success",body.externalId,undefined,{group_id:id});
    return groups(new Request(request.url,{method:"GET"}),token,id);
  }
  if(request.method==="DELETE"&&id){
    await db(`scim_groups?id=eq.${id}&organization_id=eq.${token.organization_id}`,{method:"DELETE"});
    await log(token,"delete","Group","success",undefined,undefined,{group_id:id});
    return new Response(null,{status:204});
  }
  return problem("Method not supported",405);
}

Deno.serve(async(request)=>{
  const token=await authenticate(request).catch(()=>null);
  if(!token) return problem("Invalid SCIM bearer token",401);
  const [resource,id]=subPath(request.url);
  try{
    if(resource==="ServiceProviderConfig") return response({schemas:["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],patch:{supported:true},bulk:{supported:false,maxOperations:0,maxPayloadSize:0},filter:{supported:true,maxResults:200},changePassword:{supported:false},sort:{supported:false},etag:{supported:false},authenticationSchemes:[{type:"oauthbearertoken",name:"Bearer Token",description:"Tenant-scoped SCIM token",primary:true}]});
    if(resource==="ResourceTypes") return response({schemas:[schemas.list],totalResults:2,Resources:[{id:"User",name:"User",endpoint:"/Users",schema:schemas.user},{id:"Group",name:"Group",endpoint:"/Groups",schema:schemas.group}]});
    if(resource==="Schemas") return response({schemas:[schemas.list],totalResults:0,Resources:[]});
    if(resource==="Users") return users(request,token,id);
    if(resource==="Groups") return groups(request,token,id);
    return problem("Resource not found",404);
  }catch{
    await log(token,request.method,(resource==="Groups"?"Group":"User"),"error",undefined,id,{error_code:"SCIM_OPERATION_FAILED"});
    return problem("SCIM operation failed",500);
  }
});
