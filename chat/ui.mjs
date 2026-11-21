import {chatRequest} from './client.mjs?v=room2';
export const avatars={ghost:'👻',moon:'🌙',star:'⭐',owl:'🦉',fox:'🦊',leaf:'🍃',cloud:'☁️',comet:'☄️'};
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(label,run,cls='chat-small')=>{const b=el('button',cls,label);b.type='button';b.onclick=()=>Promise.resolve(run()).catch(e=>alert(e.message));return b;};
export async function openChat(){
 const dialog=document.querySelector('#dialog'),root=el('section','chat-panel');let stopped=false,polling=false,timer,profile,sending=false,requestId,lastBody,pendingMessage=null,initial=true,noOlder=false,activeActionMenu=null;
 const pages=[null];let messages=[];
 if(document.body.classList.contains('menu-open'))document.querySelector('#menu-toggle').click();
 dialog.classList.add('chat-room');document.body.classList.add('chat-open');document.querySelector('#dialog-title').textContent='Anonimni chat';document.querySelector('#dialog-body').replaceChildren(root);
 const close=document.querySelector('#close-dialog');close.setAttribute('aria-label','Vrati se na ispovesti');if(!dialog.open)dialog.showModal();
 const top=el('div','chat-topbar'),privacy=el('details','chat-settings'),summary=el('summary','','⋯');summary.setAttribute('aria-label','Pravila i privatnost');
 const settings=el('section','chat-settings-content');settings.append(el('h2','','Pravila i privatnost'),el('p','','Jedna zajednička anonimna soba, bez privatnih poruka. Bez pretnji, vređanja, spama, linkova i deljenja tuđih ličnih podataka. Poruke imaju najviše 1.000 znakova; fotografije nisu dozvoljene.'),el('p','','Lično blokiranje sakriva poruke izabranog korisnika samo tebi. Administratorska zabrana onemogućava pristup chatu; administrator pregleda prijave i može ukloniti ili vratiti poruku.'),el('p','','Veza koristi HTTPS. Chat nije end-to-end šifrovan: ovlašćeni moderatori i infrastruktura mogu pristupiti sadržaju. Ne šalji osetljive podatke. Pomična istorija od 1, 7 ili 31 sat ograničava pristup porukama, a ne njihov rok čuvanja. Konačan rok čuvanja biće objavljen pre stvarnog pokretanja.'),el('p','','Chat je trenutno besplatan i ne traži pristupni kod niti SMS. Pristup se automatski aktivira u anonimnoj sesiji.'));
 const account=el('div','chat-account'),blocked=el('div');settings.append(account,blocked);privacy.append(summary,settings);top.append(privacy);
 const status=el('p','chat-status');status.setAttribute('role','status');
 const list=el('div','chat-messages');list.setAttribute('aria-label','Poruke u zajedničkoj sobi');list.setAttribute('role','log');list.setAttribute('aria-live','polite');
 const form=el('form','chat-compose'),text=el('textarea');text.maxLength=2000;text.required=true;text.rows=1;text.placeholder='Napiši poruku…';text.setAttribute('aria-label','Poruka u zajedničkom chatu');
 const send=el('button','chat-send','➤');send.type='submit';send.setAttribute('aria-label','Pošalji poruku');form.append(text,send);form.hidden=true;root.append(top,status,list,form);
 function resetAccess(message){profile=null;messages=[];pages.splice(1);list.replaceChildren();form.hidden=true;status.textContent=message;clearInterval(timer);}
 function render(items,older=false){const atBottom=initial||list.scrollHeight-list.scrollTop-list.clientHeight<80,oldHeight=list.scrollHeight,oldTop=list.scrollTop;
  const frag=document.createDocumentFragment();for(const m of items){const own=m.sender===profile.id,row=el('article','chat-message '+(own?'own':'other'));row.dataset.id=m.id;
   const avatar=el('span','chat-avatar',avatars[m.avatar]||avatars.ghost);avatar.setAttribute('aria-hidden','true');row.append(avatar,el('p','chat-body',m.body));
   const actions=el('details','chat-message-menu'),more=el('summary','','⋮');more.setAttribute('aria-label','Radnje uz poruku');const menu=el('div','chat-message-actions');
   const reportButton=button('Prijavi',async()=>{const reason=prompt('Razlog: abuse, threat, spam ili other','spam');if(reason){await chatRequest('report',{id:m.id,reason});status.textContent='Prijava je poslata.';actions.open=false;}});
   menu.append(reportButton);
   if(!own){const blockButton=button('Blokiraj',async()=>{await chatRequest('block',{target:m.sender});actions.open=false;status.textContent='Korisnik je blokiran. Njegove poruke više nećeš vidjeti.';await loadProfile();});menu.append(blockButton);}
   more.addEventListener('click',()=>{if(!actions.open)activeActionMenu=actions;});
   let outsideHandler=null;
   actions.addEventListener('toggle',()=>{
    if(actions.open){
     activeActionMenu=actions;
     const anchor=more.getBoundingClientRect();
     document.body.append(menu);
     const width=Math.max(110,Math.min(menu.scrollWidth||150,window.innerWidth-16));
     const left=Math.max(8,Math.min(anchor.right-width,window.innerWidth-width-8));
     const below=window.innerHeight-anchor.bottom;
     const top=below>110?anchor.bottom+4:Math.max(8,anchor.top-82);
     menu.style.position='fixed';menu.style.left=left+'px';menu.style.top=top+'px';menu.style.width=width+'px';menu.style.zIndex='99999';
     outsideHandler=event=>{if(!actions.contains(event.target)&&!menu.contains(event.target))actions.open=false;};
     document.addEventListener('pointerdown',outsideHandler,true);
    }else{
     if(activeActionMenu===actions)activeActionMenu=null;
     if(outsideHandler){document.removeEventListener('pointerdown',outsideHandler,true);outsideHandler=null;}
     if(menu.parentNode===document.body)actions.append(menu);
     menu.removeAttribute('style');
    }
   });
   actions.append(more,menu);row.append(actions);frag.append(row);
  }list.replaceChildren(frag);if(older)list.scrollTop=oldTop+list.scrollHeight-oldHeight;else if(atBottom)list.scrollTop=list.scrollHeight;else list.scrollTop=oldTop;initial=false;
 }
 async function refresh(older=false,initialHistory=null){if(stopped||polling||!profile?.active||document.hidden||activeActionMenu)return;polling=true;
  try{const responses=[];if(initialHistory){responses.push(initialHistory);}else{for(const cursor of pages){responses.push(await chatRequest('history',cursor?{before:cursor}:{}));if(stopped)return;}}
   if(activeActionMenu)return;
   const latest=responses[0],cutoff=Date.parse(latest.history_cutoff),seen=new Map();for(const r of responses)for(const m of r.items)if(Date.parse(m.created_at)>cutoff)seen.set(m.id,m);
   messages=[...seen.values()].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||(BigInt(a.id)<BigInt(b.id)?-1:1));
   if(pendingMessage&&!seen.has(pendingMessage.id))messages.push(pendingMessage);
   root.dataset.ownSide=latest.side||profile.side||'left';
   noOlder=responses.at(-1).items.length<100;render(messages,older);form.hidden=false;
  }catch(e){if(stopped)return;if([401,403].includes(e.status))resetAccess(e.message);else status.textContent=e.message;}
  finally{polling=false;}
 }
 async function loadProfile(){try{const bootstrap=await chatRequest('bootstrap');if(stopped)return;profile=bootstrap.profile;root.dataset.ownSide=profile.side||'left';
   account.replaceChildren(el('p','hint','Tvoj anonimni chat ID: '+profile.id),el('p','hint',profile.active?(profile.plan==='free'?'Besplatan pristup':'Paket '+profile.plan+' · ističe '+new Date(profile.expires_at).toLocaleString('sr-Latn')):'Chat trenutno nije dostupan.'));
   blocked.replaceChildren();for(const [i,b]of (profile.blocked||[]).entries())blocked.append(button('Odblokiraj korisnika '+(i+1),async()=>{await chatRequest('unblock',{target:b.id});await loadProfile();}));
   form.hidden=!profile.active;if(profile.active){status.textContent='';await refresh(false,bootstrap.history);clearInterval(timer);timer=setInterval(()=>refresh(),1500);}else status.textContent='Chat trenutno nije dostupan.';
  }catch(e){resetAccess(e.message);}}
 list.addEventListener('scroll',async()=>{if(list.scrollTop>36||polling||noOlder||!messages.length)return;const cursor=messages[0].id;if(pages.includes(cursor))return;pages.push(cursor);await refresh(true);});
 form.onsubmit=async event=>{
  event.preventDefault();if(sending)return;
  const draft=text.value.trim();
  if(!pendingMessage&&!draft)return;
  const body=pendingMessage?pendingMessage.body:draft;
  if([...body].length>1000){status.textContent='Poruka može imati najviše 1.000 znakova.';return;}
  if(pendingMessage&&draft&&draft!==pendingMessage.body){status.textContent='Prethodna poruka još čeka potvrdu. Pošalji je ponovo prije slanja nove.';return;}
  if(!pendingMessage){
   requestId=crypto.randomUUID();lastBody=body;
   pendingMessage={id:'pending-'+requestId,requestId,sender:profile.id,body,avatar:profile.avatar,created_at:new Date().toISOString(),pending:true};
   messages.push(pendingMessage);render(messages);text.value='';
  }
  const sendingMessage=pendingMessage;
  sending=true;send.disabled=true;text.disabled=true;
  try{
   await chatRequest('send',{body:sendingMessage.body,request_id:sendingMessage.requestId});
   pendingMessage=null;requestId=null;lastBody=null;text.disabled=false;
   if(text.value.trim()===sendingMessage.body)text.value='';
   status.textContent='';await refresh();list.scrollTop=list.scrollHeight;
  }catch(e){
   sendingMessage.failed=true;
   if(!text.value.trim())text.value=sendingMessage.body;
   render(messages);
   status.textContent=[401,403].includes(e.status)?e.message:'Poruka još nije potvrđena. Pritisni „Pošalji“ ponovo; koristi se isti zahtev kako se poruka ne bi duplirala.';
   if([401,403].includes(e.status))resetAccess(e.message);
  }finally{sending=false;send.disabled=false;}
 };
 dialog.addEventListener('close',()=>{stopped=true;clearInterval(timer);messages=[];list.replaceChildren();text.value='';dialog.classList.remove('chat-room');document.body.classList.remove('chat-open');close.setAttribute('aria-label','Zatvori');document.querySelector('#open-chat')?.focus({preventScroll:true});},{once:true});
 await loadProfile();
}
document.querySelector('#open-chat')?.addEventListener('click',()=>openChat().catch(e=>alert(e.message)));
