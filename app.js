const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const peso=n=>'₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const SUPABASE_URL='https://rfterllaaarworlwlyfu.supabase.co',SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmdGVybGxhYWFyd29ybHdseWZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NDUzNjEsImV4cCI6MjEwODAyMTM2MX0.9iuzkjLHdByw128ccDzCRfS4PC7quBHyZmGbdCgKgp4';
/* ---------- Supabase connection ---------- */
const TERMS_VERSION='2026-11-05'; // change this date whenever the Terms or Privacy Policy change: everyone must accept again
const IDLE_MIN=15; // sign out automatically after this many idle minutes
// sessionStorage: the login is forgotten when the tab or browser is closed
try{Object.keys(localStorage).filter(k=>k.startsWith('sb-')).forEach(k=>localStorage.removeItem(k))}catch(e){}
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storage:window.sessionStorage,persistSession:true,autoRefreshToken:true}});
let db={items:[],sales:[],cut:20,seq:0},role=null,idleT;
const chk=r=>{if(r.error)toast('Save failed: '+r.error.message)};
const dbItem=async i=>chk(await sb.from('items').upsert(i));
const dbDel=async id=>chk(await sb.from('items').delete().eq('id',id));
const dbSet=async()=>chk(await sb.from('shops').update({default_cut:db.cut,seq:db.seq}).eq('id',db.shop));

/* ---------- load the barcode drawing library only when needed ---------- */
const JSB='https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js';let jsbP;
const loadJSB=()=>window.JsBarcode?Promise.resolve():jsbP||(jsbP=new Promise((ok,no)=>{const e=document.createElement('script');e.src=JSB;e.onload=ok;e.onerror=()=>{jsbP=null;no(new Error('Could not load barcode library'))};document.head.appendChild(e)}));

/* ---------- sign in, roles, auto sign-out ---------- */
async function load(uid){
 // RLS returns only this shop's rows, so no shop id needs to be sent
 const[m,a]=await Promise.all([sb.from('shop_members').select('role,shop_id,shops(name,default_cut,seq)').eq('user_id',uid).maybeSingle(),sb.from('items').select('*')]);
 if(m.error||a.error){toast('Load failed: '+(m.error||a.error).message);return false}
 if(!m.data)return 'setup'; // signed up, but no shop created yet
 const sh=m.data.shops;role=m.data.role;db.shop=m.data.shop_id;db.shopName=sh.name;db.cut=+sh.default_cut;db.seq=+sh.seq;db.items=a.data;return true}
// staff see only the Sell tab (the database enforces this too)
function applyRole(){document.querySelectorAll('nav button').forEach(b=>b.hidden=b.dataset.t!=='pos'&&role!=='owner')}
function showTab(t){document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x.dataset.t===t));['pos','inv','rep','usr'].forEach(i=>$(i).hidden=i!==t);render()}
function resetUI(){db.items=[];db.sales=[];role=null;cart={parts:[],labor:[]};['le','lpw','q','ld','la','lm','lp','cash','ue','up','fc','fn','fcost','fprice','fs','iq','pwc','pwn','pwn2','lpw2','sn','dlc','tagree'].forEach(i=>$(i).value='');$('fprev').innerHTML='';$('tagree').checked=false;try{sessionStorage.removeItem('moto-cache')}catch(e){}}
function showLogin(msg){stopIdle();$('tm').hidden=true;$('setup').hidden=true;setMode(false);closePw();closeDel();resetUI();$('lload').hidden=true;$('pwb').hidden=true;$('lerr').textContent=msg||'';$('login').hidden=false;$('lout').hidden=true;applyRole();showTab('pos')}
let curUid;
function enter(){$('login').hidden=true;$('lout').hidden=false;$('pwb').hidden=false;applyRole();startIdle();showTab('pos')}
async function boot(){
 if(SUPABASE_URL.startsWith('YOUR')){$('lload').hidden=true;$('lerr').textContent='Add your Supabase URL and anon key at the top of app.js.';return}
 const{data:{session}}=await sb.auth.getSession();
 if(!session){showLogin();return}
 curUid=session.user.id;
 // everyone must have accepted the CURRENT Terms and Privacy Policy before using the app
 if((session.user.user_metadata||{}).accepted_terms!==TERMS_VERSION){showTerms();return}
 // show the last known data at once, then refresh it in the background
 let c=null;try{c=JSON.parse(sessionStorage.getItem('moto-cache'))}catch(e){}
 if(c&&c.uid===curUid){role=c.role;db.shop=c.shop;db.shopName=c.shopName;db.items=c.items;db.cut=c.cut;db.seq=c.seq;enter()}else c=null;
 const r=await load(curUid);
 if(r==='setup'){showSetup();return}
 if(!r){if(!c)showLogin('Could not load data. Please sign in again.');return}
 if(c){applyRole();role==='owner'?render():showTab('pos')}else enter()}
addEventListener('pagehide',()=>{if(role)try{sessionStorage.setItem('moto-cache',JSON.stringify({uid:curUid,role,shop:db.shop,shopName:db.shopName,items:db.items,cut:db.cut,seq:db.seq}))}catch(e){}});
let signup=false;
function setMode(on){signup=on;$('lh').textContent=on?'Create your free shop account':'Sign in to Motoshop POS';$('lpw2w').hidden=!on;$('lgo').textContent=on?'Create account':'Sign in';$('lmode').textContent=on?'Already have an account? Sign in':'New shop? Create a free account';$('lerr').textContent='';$('lpw').autocomplete=on?'new-password':'current-password';}
$('lmode').onclick=()=>setMode(!signup);
/* ---------- Terms pop-up: must be read and accepted BEFORE an account is created or used ---------- */
let tmDocs={1:false,2:false},tmCur=1,tmYes=null,tmNo=null;
const TM_URL={1:'terms.html',2:'privacy.html'};
function tmCheck(){const both=tmDocs[1]&&tmDocs[2];$('tagree').disabled=!both;if(!both){$('tagree').checked=false;$('tgo').disabled=true}$('tc1').textContent=tmDocs[1]?'✓':'';$('tc2').textContent=tmDocs[2]?'✓':''}
function tmShow(n){tmCur=n;$('tt1').style.borderColor=n===1?'var(--ac)':'';$('tt2').style.borderColor=n===2?'var(--ac)':'';$('tf').src=TM_URL[n]}
// a document counts as read once its end is reached (or if it is short enough to fit on screen)
$('tf').onload=()=>{if(($('tf').src||'').indexOf('.html')<0)return;
 try{const w=$('tf').contentWindow,d=w.document.documentElement,n=tmCur;
  const done=()=>{if(d.scrollHeight-(w.scrollY+w.innerHeight)<40){tmDocs[n]=true;tmCheck()}};
  done();w.addEventListener('scroll',done,{passive:true})}catch(e){tmDocs[tmCur]=true;tmCheck()}};
function askTerms(yes,no){tmDocs={1:false,2:false};tmYes=yes;tmNo=no;$('tagree').checked=false;$('tgo').disabled=true;$('terr').textContent='';tmCheck();$('tm').hidden=false;tmShow(1)}
$('tt1').onclick=()=>tmShow(1);$('tt2').onclick=()=>tmShow(2);
$('tagree').onchange=()=>{$('tgo').disabled=!$('tagree').checked};
$('tgo').onclick=()=>{if(!$('tagree').checked)return;$('tm').hidden=true;const f=tmYes;tmYes=tmNo=null;if(f)f()};
$('tno').onclick=()=>{$('tm').hidden=true;const f=tmNo;tmYes=tmNo=null;if(f)f()};

$('lgo').onclick=async()=>{const email=$('le').value.trim(),pw=$('lpw').value,err=t=>{$('lload').hidden=true;$('lerr').textContent=t};
 $('lerr').textContent='';
 if(signup){
  if(!email){err('Enter your email.');return}if(pw.length<8){err('Password must be at least 8 characters.');return}if(pw!==$('lpw2').value){err('The passwords do not match.');return}
  // the Terms pop up first: nothing is created and no email is sent unless the person agrees
  askTerms(()=>doSignUp(email,pw),()=>err('Account not created. You must read and agree to the Terms of Use and Privacy Policy to create an account.'));return}
 $('lgo').disabled=true;$('lload').hidden=false;$('lload').textContent='Signing in…';
 const{error}=await sb.auth.signInWithPassword({email,password:pw});$('lgo').disabled=false;
 if(error)err(error.message);else{$('lpw').value='';$('lload').textContent='Loading shop data…';boot()}};
async function doSignUp(email,pw){const err=t=>{$('lload').hidden=true;$('lerr').textContent=t};
 $('lgo').disabled=true;$('lload').hidden=false;$('lload').textContent='Creating your account…';
 const{data,error}=await sb.auth.signUp({email,password:pw,options:{emailRedirectTo:location.origin+location.pathname,data:{accepted_terms:TERMS_VERSION,accepted_at:new Date().toISOString()}}});$('lgo').disabled=false;
 if(error){err(/database error|agree to the terms/i.test(error.message)?'Could not create your account. Press Ctrl+F5 to load the latest version of the app, then try again.':error.message);return}
 if(data.session){$('lpw').value=$('lpw2').value='';boot();return}
 setMode(false);$('lpw').value='';$('lload').hidden=false;$('lload').textContent='Almost done! Open the confirmation link we emailed you, then sign in here.'}
// existing users (and staff added by an owner) must accept the current Terms once before using the app
function showTerms(){stopIdle();$('setup').hidden=true;$('lload').hidden=false;$('lload').textContent='Please accept the Terms of Use and Privacy Policy to continue.';
 askTerms(async()=>{const r=await sb.auth.updateUser({data:{accepted_terms:TERMS_VERSION,accepted_at:new Date().toISOString()}});
   if(r.error){signOut('Could not save your acceptance: '+r.error.message);return}
   $('lload').textContent='Loading…';boot()},
  ()=>signOut('You must accept the Terms of Use and Privacy Policy to use Motoshop POS.'))}
function showSetup(){stopIdle();$('login').hidden=true;$('setup').hidden=false;$('serr').textContent='';$('sn').focus()}
$('sgo').onclick=async()=>{const n=$('sn').value.trim();if(!n){$('serr').textContent='Enter your shop name.';return}
 $('sgo').disabled=true;const r=await sb.rpc('create_shop',{p_name:n});$('sgo').disabled=false;
 if(r.error){$('serr').textContent=r.error.message;return}
 $('setup').hidden=true;$('login').hidden=false;$('lload').hidden=false;$('lload').textContent='Opening your shop…';boot()};
$('sout').onclick=()=>signOut();
$('lpw').onkeydown=e=>{if(e.key==='Enter')$('lgo').click()};
async function signOut(msg){await sb.auth.signOut({scope:'local'});showLogin(msg)}
$('lout').onclick=()=>signOut();
/* ---------- change own password ---------- */
function closePw(){$('pwm').hidden=true;$('pwe').textContent='';['pwc','pwn','pwn2'].forEach(i=>$(i).value='')}
$('pwb').onclick=async()=>{$('pwm').hidden=false;$('pwc').focus();const u=(await sb.auth.getSession()).data.session?.user;$('acct').textContent=u?'Signed in as '+u.email+(role==='owner'?' (owner)':role==='staff'?' (staff)':''):''};
$('pwx').onclick=closePw;
$('pws').onclick=async()=>{const c=$('pwc').value,n=$('pwn').value,e=$('pwe');
 if(!c){e.textContent='Enter your current password.';return}
 if(n.length<8){e.textContent='The new password must be at least 8 characters.';return}
 if(n!==$('pwn2').value){e.textContent='The new passwords do not match.';return}
 if(n===c){e.textContent='Choose a password different from the current one.';return}
 $('pws').disabled=true;e.textContent='';
 const email=(await sb.auth.getSession()).data.session?.user.email;
 const v=await sb.auth.signInWithPassword({email,password:c}); // confirms the current password
 if(v.error){e.textContent='Current password is incorrect.';$('pws').disabled=false;return}
 const u=await sb.auth.updateUser({password:n});$('pws').disabled=false;
 if(u.error){e.textContent=u.error.message;return}
 closePw();toast('Password changed')};
/* ---------- delete account + backup (required by the app stores) ---------- */
function openDel(){const own=role==='owner';
 $('dlt').textContent=own?'This permanently deletes your shop “'+db.shopName+'”, all its items and sales records, and the login of every staff member. It cannot be undone.':role==='staff'?'This deletes your login. Sales you made stay in the shop’s records, without your name. It cannot be undone.':'This deletes your login. It cannot be undone.';
 $('dlb').hidden=!own;$('dlc').value='';$('dle').textContent='';$('dlm').hidden=false}
function closeDel(){$('dlm').hidden=true;$('dlc').value='';$('dle').textContent=''}
$('deb').onclick=()=>{closePw();openDel()};$('sdel').onclick=openDel;$('dln').onclick=closeDel;
$('dld').onclick=async()=>{$('dld').disabled=true;
 const[s,i]=await Promise.all([sb.from('sales').select('*').order('ts'),sb.from('items').select('*')]);$('dld').disabled=false;
 if(s.error||i.error){$('dle').textContent='Could not read your data. Please try again.';return}
 const blob=new Blob([JSON.stringify({shop:db.shopName,exported:new Date().toISOString(),items:i.data,sales:s.data},null,2)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='motoshop-backup.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Backup downloaded')};
$('dly').onclick=async()=>{if($('dlc').value.trim()!=='DELETE'){$('dle').textContent='Type DELETE in capital letters to confirm.';return}
 $('dly').disabled=true;const r=await sb.rpc('delete_my_account',{p_confirm:'DELETE'});$('dly').disabled=false;
 if(r.error){$('dle').textContent=r.error.message;return}
 closeDel();await signOut('Your account has been deleted.')};
const idleEv=['click','keydown','touchstart'];
function idleReset(){clearTimeout(idleT);idleT=setTimeout(()=>signOut('Signed out after '+IDLE_MIN+' minutes of inactivity.'),IDLE_MIN*60000)}
function startIdle(){stopIdle();idleEv.forEach(e=>addEventListener(e,idleReset,{passive:true}));idleReset()}
function stopIdle(){clearTimeout(idleT);idleEv.forEach(e=>removeEventListener(e,idleReset))}
let cart={parts:[],labor:[]};
function toast(m){const t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,3200)}
function bc(el,code,h){el.innerHTML='';if(!code)return;if(!window.JsBarcode){loadJSB().then(()=>bc(el,code,h)).catch(e=>{el.textContent=e.message});return}const s=document.createElementNS('http://www.w3.org/2000/svg','svg');el.appendChild(s);try{JsBarcode(s,code,{format:'CODE128',height:h||50,displayValue:true,fontSize:14,margin:4})}catch(e){el.textContent='Cannot draw barcode'}}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>showTab(b.dataset.t));

/* ---------- camera scanner ---------- */
let stream,timer,reader,det,onCode,keep,last='',lt=0;
const loadZX=()=>window.ZXing?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)});
function beep(){try{const a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator();o.frequency.value=900;o.connect(a.destination);o.start();setTimeout(()=>{o.stop();a.close()},110)}catch(e){}}
function stopCam(){clearInterval(timer);if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}if(reader){try{reader.reset()}catch(e){}reader=null}}
function closeScan(){stopCam();$('scm').hidden=true}
function hit(c){const n=Date.now();if(c===last&&n-lt<2000)return;last=c;lt=n;beep();onCode(c);if(!keep)closeScan()}
async function startCam(id){stopCam();$('scmsg').textContent='Point the camera at a barcode.';
try{
 if('BarcodeDetector' in window){det=det||new BarcodeDetector();
  stream=await navigator.mediaDevices.getUserMedia({video:id?{deviceId:{exact:id}}:{facingMode:'environment'}});
  const v=$('vid');v.srcObject=stream;await v.play();
  timer=setInterval(()=>{det.detect(v).then(r=>r[0]&&hit(r[0].rawValue)).catch(()=>{})},250);
 }else{await loadZX();reader=new ZXing.BrowserMultiFormatReader();reader.decodeFromVideoDevice(id||null,'vid',r=>{if(r)hit(r.getText())});await new Promise(r=>setTimeout(r,600))}
 const devs=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput'),sel=$('camsel'),cur=sel.value;
 sel.innerHTML=devs.map((d,i)=>`<option value="${esc(d.deviceId)}">${esc(d.label||'Camera '+(i+1))}</option>`).join('');
 if(cur&&devs.some(d=>d.deviceId===cur))sel.value=cur;
}catch(e){$('scmsg').textContent='Camera unavailable. Allow camera access, or type the barcode instead. ('+(e.name||'error')+')'}}
function scan(cb,k){onCode=cb;keep=k;$('scm').hidden=false;startCam()}
$('camsel').onchange=e=>startCam(e.target.value);$('scx').onclick=closeScan;

/* ---------- sell ---------- */
const find=c=>db.items.find(i=>i.code===c);
function addPart(id){const it=db.items.find(i=>i.id===id);if(!it)return;const l=cart.parts.find(p=>p.id===id),q=(l?l.qty:0)+1;
 if(q>it.stock){toast('Only '+it.stock+' of '+it.name+' in stock');return}
 l?l.qty=q:cart.parts.push({id,qty:1});render()}
function byCode(c){const it=find(c.trim());if(it){addPart(it.id);$('q').value='';return true}return false}
$('q').oninput=renderPos;
$('q').onkeydown=e=>{if(e.key!=='Enter')return;const v=$('q').value.trim();if(!v)return;if(byCode(v))return;const m=db.items.filter(i=>i.name.toLowerCase().includes(v.toLowerCase()));if(m.length===1){addPart(m[0].id);$('q').value=''}else toast(m.length?'Pick an item from the list':'No item found')};
$('posScan').onclick=()=>scan(c=>{if(!byCode(c))toast('Barcode '+c+' is not in inventory')},true);
$('addL').onclick=()=>{const a=parseFloat($('la').value);if(!(a>0)){toast('Enter the labor amount');return}
 let p=parseFloat($('lp').value);if(isNaN(p))p=db.cut;
 cart.labor.push({desc:$('ld').value.trim()||'Labor',amt:a,mech:$('lm').value.trim()||'Mechanic',pct:Math.min(100,Math.max(0,p))});
 $('ld').value=$('la').value='';render()};
function calc(c){let rev=0,cost=0,lab=0,cut=0;
 c.parts.forEach(p=>{rev+=p.price*p.qty;cost+=p.cost*p.qty});
 c.labor.forEach(l=>{lab+=l.amt;cut+=l.amt*l.pct/100});
 return{rev,cost,lab,cut,mech:lab-cut,total:rev+lab,pp:rev-cost,profit:rev-cost+cut}}
function cartView(){return{parts:cart.parts.map(p=>{const i=db.items.find(x=>x.id===p.id);return{...p,name:i.name,price:i.price,cost:i.cost}}),labor:cart.labor}}
function renderPos(){const v=$('q').value.trim().toLowerCase();
 const m=(v?db.items.filter(i=>i.name.toLowerCase().includes(v)||i.code.toLowerCase().includes(v)):db.items).slice(0,8);
 $('res').innerHTML=m.length?m.map(i=>`<div><div><b>${esc(i.name)}</b><div class="mu">${esc(i.code)} · stock ${i.stock}</div></div><div class="r"><b>${peso(i.price)}</b><br><button class="g" data-a="${i.id}" ${i.stock<1?'disabled':''}>Add</button></div></div>`).join(''):`<p class="mu">${db.items.length?'No match.':'No items yet. Add some in Inventory.'}</p>`;
 $('res').querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>addPart(b.dataset.a));
 const c=cartView(),t=calc(c);
 $('cart').innerHTML=(c.parts.length||c.labor.length)?'<div class="list">'+c.parts.map((p,i)=>`<div><div><b>${esc(p.name)}</b><div class="qty"><button data-m="${i}">−</button>${p.qty}<button data-p="${i}">+</button><span class="mu">× ${peso(p.price)}</span></div></div><b>${peso(p.price*p.qty)}</b></div>`).join('')+c.labor.map((l,i)=>`<div><div><b>${esc(l.desc)}</b><div class="mu">${esc(l.mech)} · shop cut ${l.pct}% (${peso(l.amt*l.pct/100)})</div></div><div class="r"><b>${peso(l.amt)}</b><br><button class="x" data-l="${i}">remove</button></div></div>`).join('')+'</div>':'<p class="mu">Nothing yet. Scan a part or add labor.</p>';
 $('cart').querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{const p=cart.parts[b.dataset.m];if(--p.qty<1)cart.parts.splice(b.dataset.m,1);render()});
 $('cart').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>addPart(cart.parts[b.dataset.p].id));
 $('cart').querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{cart.labor.splice(b.dataset.l,1);render()});
 $('tots').innerHTML=`<div class="tot"><span>Parts</span><span>${peso(t.rev)}</span></div><div class="tot"><span>Labor</span><span>${peso(t.lab)}</span></div>
 <div class="tot mu"><span>Parts profit</span><span>${peso(t.pp)}</span></div><div class="tot mu"><span>Shop cut of labor</span><span>${peso(t.cut)}</span></div>
 <div class="tot mu"><span>Mechanic pay</span><span>${peso(t.mech)}</span></div><div class="tot ok"><b>Total profit</b><b>${peso(t.profit)}</b></div>
 <div class="tot big"><span>Total due</span><span>${peso(t.total)}</span></div>`}
$('clr').onclick=()=>{cart={parts:[],labor:[]};render()};
$('pay').onclick=async()=>{const c=cartView();if(!c.parts.length&&!c.labor.length){toast('The sale is empty');return}
 const t=calc(c);let cash=parseFloat($('cash').value);if(isNaN(cash))cash=t.total;
 if(cash<t.total){toast('Cash is short by '+peso(t.total-cash));return}
 $('pay').disabled=true;
 // the database recomputes prices, stock and profit, so they cannot be tampered with
 const r=await sb.rpc('complete_sale',{p_parts:c.parts.map(p=>({id:p.id,qty:p.qty})),p_labor:c.labor,p_cash:cash});
 $('pay').disabled=false;
 if(r.error){toast(r.error.message);const f=await sb.from('items').select('*');if(f.data)db.items=f.data;render();return}
 c.parts.forEach(p=>{db.items.find(i=>i.id===p.id).stock-=p.qty});
 cart={parts:[],labor:[]};$('cash').value='';render();toast('Sale saved. Change: '+peso(cash-t.total))};

/* ---------- inventory ---------- */
function genCode(){let c;do{db.seq++;c='MC'+String(db.seq).padStart(6,'0')}while(find(c));return c}
function resetForm(){['fid','fc','fn','fcost','fprice','fs'].forEach(i=>$(i).value='');$('fl').value=3;$('fh').textContent='Add item';$('fprev').innerHTML=''}
$('fnew').onclick=resetForm;
$('fc').oninput=()=>bc($('fprev'),$('fc').value.trim());
$('fgen').onclick=()=>{$('fc').value=genCode();dbSet();bc($('fprev'),$('fc').value)};
$('fscan').onclick=()=>scan(c=>{const ex=find(c);if(ex&&ex.id!==$('fid').value){edit(ex.id);toast('Already in inventory. Editing it.')}else{$('fc').value=c;bc($('fprev'),c);$('fn').focus()}},false);
$('fsave').onclick=()=>{const code=$('fc').value.trim(),name=$('fn').value.trim(),cost=parseFloat($('fcost').value),price=parseFloat($('fprice').value);
 if(!name){toast('Enter the item name');return}if(isNaN(price)){toast('Enter the selling price');return}
 const id=$('fid').value,dup=db.items.find(i=>i.code===code&&i.id!==id);
 if(code&&dup){toast('That barcode belongs to '+dup.name);return}
 const o={code:code||genCode(),name,cost:isNaN(cost)?0:cost,price,stock:parseInt($('fs').value)||0,low:parseInt($('fl').value)||0};
 if(id)Object.assign(db.items.find(i=>i.id===id),o);else db.items.push({id:'i'+Date.now(),...o});
 dbItem(id?db.items.find(i=>i.id===id):db.items[db.items.length-1]);dbSet();resetForm();render();toast('Item saved')};
function edit(id){const i=db.items.find(x=>x.id===id);$('fid').value=i.id;$('fc').value=i.code;$('fn').value=i.name;$('fcost').value=i.cost;$('fprice').value=i.price;$('fs').value=i.stock;$('fl').value=i.low;$('fh').textContent='Edit item';bc($('fprev'),i.code);scrollTo(0,0)}
$('iq').oninput=renderInv;
function renderInv(){if($('inv').hidden)return;const v=$('iq').value.trim().toLowerCase(),m=db.items.filter(i=>!v||i.name.toLowerCase().includes(v)||i.code.toLowerCase().includes(v));
 $('itbl').innerHTML=m.length?`<table><tr><th>Item</th><th>Cost</th><th>Price</th><th>Stock</th><th></th></tr>${m.map(i=>`<tr><td><b>${esc(i.name)}</b><div class="mu">${esc(i.code)}</div></td><td>${peso(i.cost)}</td><td>${peso(i.price)}</td><td class="${i.stock<=i.low?'bad':''}">${i.stock}${i.stock<=i.low?'<div class="mu bad">low</div>':''}</td><td style="white-space:nowrap"><button class="g" data-e="${i.id}">Edit</button> <button class="g" data-s="${i.id}">+Stock</button> <button class="g" data-b="${i.id}">Label</button> <button class="x" data-d="${i.id}">Delete</button></td></tr>`).join('')}</table>`:'<p class="mu">No items yet. Scan a barcode or fill the form to add one.</p>';
 const q=(a,f)=>$('itbl').querySelectorAll(`[data-${a}]`).forEach(b=>b.onclick=()=>f(b.dataset[a]));
 q('e',edit);
 q('s',id=>{const n=parseInt(prompt('Add how many units?'));if(n>0){db.items.find(i=>i.id===id).stock+=n;dbItem(db.items.find(i=>i.id===id));render()}});
 q('b',id=>{const i=db.items.find(x=>x.id===id),n=parseInt(prompt('How many labels to print?','1'))||1;$('lbl').innerHTML=Array(Math.min(n,60)).fill(`<div style="display:inline-block;margin:6px;padding:6px;border:1px dashed #999"><div style="font-size:12px"><b>${esc(i.name)}</b> ${peso(i.price)}</div><div class="lb"></div></div>`).join('');$('lbl').querySelectorAll('.lb').forEach(e=>bc(e,i.code,40));loadJSB().then(()=>setTimeout(()=>print(),150))});
 q('d',id=>{if(confirm('Delete this item?')){db.items=db.items.filter(i=>i.id!==id);dbDel(id);render()}})}

/* ---------- reports ---------- */
$('per').onchange=renderRep;$('cf').onchange=renderRep;
$('dcut').onchange=()=>{const p=parseFloat($('dcut').value);if(p>=0&&p<=100){db.cut=p;dbSet();$('lp').placeholder=p}};
let repSeq=0;
async function renderRep(){if($('rep').hidden)return;
 const n=new Date(),d0=new Date(n.getFullYear(),n.getMonth(),n.getDate()).getTime(),p=$('per').value;
 const from=p==='d'?d0:p==='w'?d0-6*864e5:p==='m'?new Date(n.getFullYear(),n.getMonth(),1).getTime():0;
 $('dcut').value=db.cut;const q=++repSeq;
 const r=await sb.from('sales').select('id,ts,cashier,parts,labor,total,pp,lab,cut,mech,profit').gte('ts',from).order('ts',{ascending:false}).limit(2000);
 if(q!==repSeq)return;if(r.error){toast('Load failed: '+r.error.message);return}
 const all=r.data,cf=$('cf'),cur=cf.value,names=[...new Set(all.map(x=>x.cashier).filter(Boolean))].sort();
 cf.innerHTML='<option value="">Everyone</option>'+names.map(n=>`<option>${esc(n)}</option>`).join('');cf.value=names.includes(cur)?cur:'';
 const s=cf.value?all.filter(x=>x.cashier===cf.value):all,sum=k=>s.reduce((a,x)=>a+Number(x[k]),0);
 const st=[['Sales',s.length],['Revenue',peso(sum('total'))],['Parts profit',peso(sum('pp'))],['Labor collected',peso(sum('lab'))],['Shop cut of labor',peso(sum('cut'))],['Paid to mechanics',peso(sum('mech'))]];
 $('stats').innerHTML=st.map(([a,b])=>`<div class="stat"><span class="mu">${a}</span><b>${b}</b></div>`).join('')+`<div class="stat hi"><span class="mu">Total profit (parts + shop cut)</span><b>${peso(sum('profit'))}</b></div>`;
 $('stbl').innerHTML=s.length?`<table><tr><th>Date</th><th>Sold by</th><th>Details</th><th>Total</th><th>Profit</th></tr>${s.slice(0,100).map(x=>`<tr><td>${new Date(x.ts).toLocaleString('en-PH',{dateStyle:'short',timeStyle:'short'})}</td><td>${esc(x.cashier||'—')}</td><td class="mu">${x.parts.map(p=>esc(p.name)+' ×'+p.qty).concat(x.labor.map(l=>esc(l.desc)+' ('+esc(l.mech)+')')).join(', ')}</td><td>${peso(x.total)}</td><td class="ok">${peso(x.profit)}</td></tr>`).join('')}</table>`:'<p class="mu">No sales in this period.</p>'}

/* ---------- users (admin only) ---------- */
async function adminCall(body){const{data,error}=await sb.functions.invoke('manage-users',{body});
 if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}
 if(data&&data.error)throw new Error(data.error);return data}
async function renderUsr(){if($('usr').hidden)return;
 const r=await sb.from('shop_members').select('user_id,email,role').order('created_at');if(r.error){toast(r.error.message);return}
 const me=(await sb.auth.getSession()).data.session?.user.id;
 $('utbl').innerHTML=`<table><tr><th>Email</th><th>Role</th><th></th></tr>${r.data.map(u=>`<tr><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td style="white-space:nowrap">${u.role==='owner'?'<span class="mu">'+(u.user_id===me?'you':'owner')+'</span>':`<button class="g" data-pw="${u.user_id}">New password</button> <button class="x" data-rm="${u.user_id}">Remove</button>`}</td></tr>`).join('')}</table>`;
 $('utbl').querySelectorAll('[data-pw]').forEach(b=>b.onclick=async()=>{const p=prompt('New password (at least 8 characters)');if(!p)return;try{await adminCall({action:'password',id:b.dataset.pw,password:p});toast('Password changed')}catch(e){toast(e.message)}});
 $('utbl').querySelectorAll('[data-rm]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove this user? They will no longer be able to sign in.'))return;try{await adminCall({action:'delete',id:b.dataset.rm});renderUsr()}catch(e){toast(e.message)}})}
$('uadd').onclick=async()=>{const email=$('ue').value.trim(),password=$('up').value;if(!email||!password){toast('Enter an email and a password');return}
 try{await adminCall({action:'create',email,password});$('ue').value=$('up').value='';toast('User added. They can only use the Sell tab.');renderUsr()}catch(e){toast(e.message)}};

function render(){$('lp').placeholder=db.cut;$('shopn').textContent=db.shopName?'· '+db.shopName:'';renderPos();renderInv();renderRep();renderUsr()}
render();boot();