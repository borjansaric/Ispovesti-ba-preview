import {authClient} from '../api.js?v=20261122-chat-admin1';
import {chatRequest} from './client.mjs?v=20261122-chat-admin1';
const $=selector=>document.querySelector(selector);
const loginPanel=$('#login-panel'),archivePanel=$('#archive-panel'),loginForm=$('#login-form');
const loginStatus=$('#login-status'),archiveStatus=$('#archive-status'),messages=$('#messages'),olderButton=$('#older');
let adminClient,oldestId=null,loaded=0,busy=false;
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const date=value=>value?new Date(value).toLocaleString('sr-Latn-RS',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';
function renderMessage(item){
 const card=node('article','message'+(item.removed?' removed':''));
 const head=node('div','message-head');
 head.append(node('strong','',item.generated_nickname||'Anonimni učesnik'),node('time','',date(item.created_at)));
 if(item.removed)head.append(node('span','removed-label','UKLONJENA PORUKA'));
 const body=node('p','message-body',item.body);
 card.append(head,body);
 const reports=Array.isArray(item.reports)?item.reports:[];
 if(reports.length){
  const section=node('section','reports');section.append(node('h3','','Prijave ('+reports.length+')'));
  for(const report of reports)section.append(node('p','report','Razlog: '+report.reason+' · '+date(report.created_at)));
  card.append(section);
 }else card.append(node('p','no-reports','Nema prijava.'));
 return card;
}
async function loadArchive(older=false){
 if(busy)return;busy=true;olderButton.disabled=true;archiveStatus.textContent='Učitavam…';
 try{
  const data=await chatRequest('admin_messages',older&&oldestId?{before:oldestId}:{},true);
  const items=Array.isArray(data.items)?data.items:[];
  if(!older)messages.replaceChildren();
  for(const item of items)messages.append(renderMessage(item));
  if(items.length)oldestId=items.at(-1).id;
  loaded+=items.length;
  $('#archive-count').textContent='Prikazano '+loaded+' poruka · najnovije prve';
  olderButton.hidden=items.length<100;
  archiveStatus.textContent=items.length?'':'Nema više poruka za prikaz.';
 }catch(error){
  archiveStatus.textContent=error.message||'Arhiva trenutno nije dostupna.';
  if(!older)olderButton.hidden=true;
 }finally{busy=false;olderButton.disabled=false;}
}
async function verifyAdmin(){
 await chatRequest('admin_status',{},true);
 loginPanel.hidden=true;archivePanel.hidden=false;loaded=0;oldestId=null;
 await loadArchive(false);
}
adminClient=authClient(true);
loginForm.addEventListener('submit',async event=>{
 event.preventDefault();const submit=loginForm.querySelector('button');submit.disabled=true;loginStatus.textContent='Provjeravam prijavu…';
 try{
  const {error}=await adminClient.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});
  if(error)throw error;
  await verifyAdmin();
 }catch(error){loginStatus.textContent='Prijava nije potvrđena ili nalog nema administratorska prava.';try{await adminClient.auth.signOut();}catch{}}
 finally{submit.disabled=false;}
});
olderButton.addEventListener('click',()=>loadArchive(true));
$('#sign-out').addEventListener('click',async()=>{
 await adminClient.auth.signOut();archivePanel.hidden=true;loginPanel.hidden=false;messages.replaceChildren();loginForm.reset();loginStatus.textContent='Odjavljeni ste.';
});
adminClient.auth.getSession().then(async({data,error})=>{
 if(error||!data.session)return;
 try{await verifyAdmin();}catch{await adminClient.auth.signOut();}
});
