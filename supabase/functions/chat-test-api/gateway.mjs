import {classifyChatMessage} from './moderation.mjs';
// No payment endpoint. Trial actions require server configuration AND verified admin SQL checks.
const allowedActions=new Set(['gate_status','gate_accept','bootstrap','profile','history','send','block','unblock','report','admin_status','admin_profiles','admin_test_mode','admin_grant','admin_nickname','admin_avatar','admin_messages','admin_remove','admin_restore','admin_ban','admin_unban','comment_meta','comment_favorite']);
const trialActions=new Set(['admin_test_mode','admin_grant','admin_nickname','admin_avatar']);
const keys={gate_status:[],gate_accept:['scope'],bootstrap:[],comment_meta:['ids'],comment_favorite:['id','enabled'],profile:[],history:[],send:['body','request_id'],block:['target'],unblock:['target'],report:['id','reason','details'],admin_status:[],admin_profiles:[],admin_test_mode:['enabled'],admin_grant:['target','plan','request_id'],admin_nickname:['target','nickname','request_id'],admin_avatar:['target','avatar','request_id'],admin_messages:['before'],admin_remove:['id'],admin_restore:['id'],admin_ban:['target','hours','reason'],admin_unban:['target']};

const GATE_CHAT_VERSION='chat-v2';
async function readUserGate(supabaseUrl,serviceKey,uid,fetcher){
 const r=await fetcher(supabaseUrl+'/rest/v1/isp_user_gates?user_id=eq.'+encodeURIComponent(uid)+'&select=*',{headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Accept-Profile':'public'},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new Error('Provjera pristupa trenutno nije dostupna.');
 const rows=await r.json();return rows[0]||null;
}
async function writeUserGate(supabaseUrl,serviceKey,uid,patch,fetcher){
 const r=await fetcher(supabaseUrl+'/rest/v1/isp_user_gates?on_conflict=user_id',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json','Content-Profile':'public',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({user_id:uid,...patch,updated_at:new Date().toISOString()}),signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new Error('Evidencija potvrde trenutno nije dostupna.');
 return (await r.json())[0]||null;
}
export function createChatHandler({supabaseUrl,serviceKey,allowedOrigins,allowTrials=false,environment='production',fetcher=fetch}){
 return async request=>{
  const origin=request.headers.get('origin');const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(origin&&allowedOrigins.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-chat-access-code','Access-Control-Allow-Methods':'POST, OPTIONS'});
  const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!allowedOrigins.includes(origin))return send({error:'Nedozvoljeno porijeklo.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return send({error:'Nedozvoljen zahtjev.'},405);
  try{
   if(!request.headers.get('content-type')?.startsWith('application/json'))return send({error:'Očekivan je JSON.'},415);
   const reader=request.body?.getReader();if(!reader)return send({error:'Nedostaje zahtjev.'},400);
   const chunks=[];let length=0;for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>8192){await reader.cancel();return send({error:'Zahtjev je prevelik.'},413);}chunks.push(value);}
   const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const body=JSON.parse(new TextDecoder().decode(bytes));
   if(!allowedActions.has(body?.action)||!body.args||typeof body.args!=='object'||Array.isArray(body.args))return send({error:'Nepoznata radnja.'},400);
   if(trialActions.has(body.action)&&!(allowTrials&&environment==='test'))return send({error:'Probna prava nisu dostupna na ovom serveru.'},403);
   const authorization=request.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return send({error:'Potrebna je anonimna prijava.'},401);
   const auth=await fetcher(supabaseUrl+'/auth/v1/user',{headers:{apikey:serviceKey,Authorization:authorization},signal:AbortSignal.timeout(12000)});
   if(!auth.ok)return send({error:'Prijava je istekla.'},401);
   const user=await auth.json();if(!user.id)return send({error:'Neispravna prijava.'},401);
   // Preview-only shared gate. Never copy this temporary code into chat-live-api.
   if(environment==='test'&&user.is_anonymous===true&&request.headers.get('x-chat-access-code')!=='0000')return send({error:'Pogrešan ili nedostaje pristupni kod.'},403);
   let tokenClaims={};try{const encoded=authorization.slice(7).split('.')[1];tokenClaims=JSON.parse(atob(encoded.replaceAll('-','+').replaceAll('_','/')));}catch{}
   if(body.action==='gate_status'){
    const gate=await readUserGate(supabaseUrl,serviceKey,user.id,fetcher);
    return send({age_status:gate?.age_status||'pending',age_band:gate?.age_band||null,chat_rules_accepted:gate?.chat_rules_version===GATE_CHAT_VERSION});
   }
   if(body.action==='gate_accept'){
    if(String(body.args.scope||'')!=='chat')return send({error:'Nepoznata vrsta potvrde.'},400);
    const gate=await readUserGate(supabaseUrl,serviceKey,user.id,fetcher);
    if(gate?.age_status!=='adult')return send({error:'Pristup je dozvoljen samo punoljetnim osobama.'},403);
    await writeUserGate(supabaseUrl,serviceKey,user.id,{chat_rules_version:GATE_CHAT_VERSION,chat_rules_accepted_at:new Date().toISOString()},fetcher);
    return send({success:true});
   }

   if(!['gate_status','gate_accept'].includes(body.action)&&!body.action.startsWith('admin_')){
    const gate=await readUserGate(supabaseUrl,serviceKey,user.id,fetcher);
    if(gate?.age_status!=='adult')return send({error:'Pristup je dozvoljen samo punoljetnim osobama.'},403);
    if(body.action==='send'&&gate?.chat_rules_version!==GATE_CHAT_VERSION)return send({error:'Prije prve poruke moraš prihvatiti pravila chata.'},403);
   }
   const args={};for(const key of keys[body.action]||[])if(body.args[key]!==undefined)args[key]=body.args[key];
   if(body.action.startsWith('admin_')){
    if(user.is_anonymous!==false)return send({error:'Administratorska prijava je potrebna.'},403);
    let claims;try{const encoded=authorization.slice(7).split('.')[1];claims=JSON.parse(atob(encoded.replaceAll('-','+').replaceAll('_','/')));}catch{return send({error:'Neispravna administratorska sesija.'},403);}
    args._session_id=claims.session_id;args._aal=claims.aal;
   }

   const response=await fetcher(supabaseUrl+'/rest/v1/rpc/chat_test_dispatch_v2',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_uid:user.id,p_action:body.action,p_args:args,p_session:tokenClaims.session_id||null}),signal:AbortSignal.timeout(12000)});
   const result=await response.json();if(!response.ok){const safe=['42501','28000','P0001'].includes(result.code);return send({error:safe?result.message:'Chat trenutno nije dostupan.'},result.code==='42501'?403:result.code==='28000'?401:400);}
   if(result._http_status){const {_http_status,...safe}=result;return send(safe,_http_status);}
   if(body.action==='send'&&result?.success&&result?.id){
    const reasons=classifyChatMessage(args.body);
    if(reasons.length){
     try{
      const saved=await fetcher(supabaseUrl+'/rest/v1/chat_test_moderation_flags?on_conflict=message_id',{
       method:'POST',
       headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},
       body:JSON.stringify({message_id:String(result.id),user_id:user.id,reasons,status:'review'}),
       signal:AbortSignal.timeout(6000)
      });
      if(!saved.ok)console.warn('Chat moderation flag could not be stored:',saved.status);
     }catch{console.warn('Chat moderation flag storage unavailable.');}
    }
   }
   if(body.action==='admin_messages'&&Array.isArray(result?.items)&&result.items.length){
    const ids=result.items.map(item=>String(item.id)).filter(id=>/^\d+$/.test(id));
    if(ids.length){
     try{
      const query=ids.join(',');
      const flagsResponse=await fetcher(supabaseUrl+'/rest/v1/chat_test_moderation_flags?message_id=in.('+query+')&select=message_id,reasons,status,created_at',{
       headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey},
       signal:AbortSignal.timeout(6000)
      });
      if(flagsResponse.ok){
       const flags=await flagsResponse.json();
       const byId=new Map(flags.map(flag=>[String(flag.message_id),flag]));
       result.items=result.items.map(item=>({...item,moderation:byId.get(String(item.id))||null}));
      }else console.warn('Chat moderation flags could not be loaded:',flagsResponse.status);
     }catch{console.warn('Chat moderation flags unavailable to admin view.');}
    }
   }
   return send(result);
  }catch{return send({error:'Chat trenutno nije dostupan. Pokušaj ponovo.'},400);}
 };
}
