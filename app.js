const KEY='taro_health_v1';
const PIN_KEY='taro_family_docid_v1';
const EM_SEEN_KEY='taro_em_seen_v1'; // remembers last RRR date+value already alerted on this device
const RRR_DANGER=45; // ค่าเฝ้าระวัง: เกินค่านี้ = ผิดปกติ ต้องเด้ง popup ทันที
const LABS=[
  {k:'cre',n:'Creatinine',u:'mg/dL',lo:0.4,hi:2.3},
  {k:'bun',n:'BUN',u:'mg/dL',lo:14,hi:38},
  {k:'alt',n:'ALT / GPT',u:'U/L',lo:0,hi:55}
];
const SEED={
  labs:[
    {d:'2026-08-27',wt:4.0,cre:3.4,bun:61,alt:86},
    {d:'2026-08-31',wt:3.8,cre:2.3,bun:28,alt:36},
    {d:'2026-09-09',wt:4.2,cre:1.7,bun:24,alt:null},
    {d:'2026-09-13',wt:4.2,cre:1.8,bun:31,alt:null}
  ],
  rrr:[{d:'2026-09-11',v:60,note:''},{d:'2026-09-12',v:46,note:''},{d:'2026-09-13',v:27,note:''}]
};
let DB=JSON.parse(localStorage.getItem(KEY)||'null')||JSON.parse(JSON.stringify(SEED));
const iso=d=>new Date(d).toISOString().slice(0,10);
const fmtD=s=>{const[y,m,d]=s.split('-');return d+'/'+m};
document.getElementById('today').textContent=new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
document.getElementById('rDate').value=iso(Date.now());
document.getElementById('lDate').value=iso(Date.now());

/* palette (kept in sync with CSS vars, hardcoded for inline SVG charts) */
const COL={mint:'#3AAE71',mintSoft:'rgba(58,174,113,.14)',pink:'#FF7A9A',pinkSoft:'rgba(255,122,154,.14)',
  ok:'#34C77B',okBg:'rgba(52,199,123,.14)',warn:'#F5A623',warnBg:'rgba(245,166,35,.14)',bad:'#FF6B6B',badBg:'rgba(255,107,107,.14)',
  grid:'#EEE3D2',dim:'#B5A794',ink:'#2B2A28'};

/* ---------- status helpers ---------- */
function rrrStat(v){return v<30?['ปกติ','p-ok']:v<=45?['เฝ้าระวัง','p-warn']:['ผิดปกติ','p-bad']}
function labStat(l,v){if(v==null)return['–','']; return v<l.lo?['ต่ำ','p-warn']:v>l.hi?['สูง','p-bad']:['ปกติ','p-ok']}

/* ---------- Emergency popup ---------- */
function checkEmergency(fromSync){
  const R=DB.rrr.slice().sort((a,b)=>a.d<b.d?-1:1);
  const last=R[R.length-1];
  if(!last || last.v<=RRR_DANGER) return;
  const seenTag=localStorage.getItem(EM_SEEN_KEY);
  const thisTag=last.d+'|'+last.v;
  if(seenTag===thisTag) return; // already alerted for this exact entry on this device
  localStorage.setItem(EM_SEEN_KEY, thisTag);
  document.getElementById('emVal').innerHTML = last.v+' <span>ครั้ง/นาที</span>';
  document.getElementById('emWho').textContent = 'บันทึกวันที่ '+last.d+(last.note?(' · '+last.note):'')+(fromSync?' (ซิงค์จากอีกอุปกรณ์)':'');
  document.getElementById('emOverlay').classList.add('show');
  if(navigator.vibrate) navigator.vibrate([200,100,200]);
}
function dismissEmergency(){ document.getElementById('emOverlay').classList.remove('show'); }

/* ---------- tiny SVG chart engine ---------- */
/* opt.fixedMax: caps the y-axis top at this value unless real data exceeds it */
function chart(el,opt){
  const W=Math.max(el.clientWidth||640,340),H=opt.h||260,P={t:16,r:16,b:34,l:44};
  const pts=opt.points.filter(p=>p.v!=null);
  if(!pts.length){el.innerHTML='<div class="muted" style="padding:30px;text-align:center">ยังไม่มีข้อมูล</div>';return}
  let mn=Math.min(...pts.map(p=>p.v)),mx=Math.max(...pts.map(p=>p.v));
  if(opt.fixedMax!=null){
    mn=Math.min(0,mn);
    mx=Math.max(opt.fixedMax, mx);
  }else{
    (opt.bands||[]).forEach(b=>{mn=Math.min(mn,b.lo);mx=Math.max(mx,b.hi===Infinity?mx:b.hi)});
  }
  if(opt.ref){mn=Math.min(mn,opt.ref.lo);mx=Math.max(mx,opt.ref.hi)}
  const pad=(mx-mn||1)*0.14;mn=Math.max(0,mn-pad);mx=mx+pad;
  const X=i=>P.l+(pts.length===1?(W-P.l-P.r)/2:i*(W-P.l-P.r)/(pts.length-1));
  const Y=v=>P.t+(H-P.t-P.b)*(1-(v-mn)/(mx-mn));
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">`;
  (opt.bands||[]).forEach(b=>{const hiClamped=Math.min(b.hi,mx);const y1=Y(hiClamped),y2=Y(Math.max(b.lo,mn));s+=`<rect x="${P.l}" y="${y1}" width="${W-P.l-P.r}" height="${Math.max(0,y2-y1)}" rx="8" fill="${b.c}"/>`});
  if(opt.ref){[['lo',opt.ref.lo],['hi',opt.ref.hi]].forEach(([k,v])=>{s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.dim}" stroke-dasharray="5 4" stroke-width="1.4"/><text x="${W-P.r}" y="${Y(v)-4}" fill="${COL.dim}" font-size="10" font-weight="600" text-anchor="end">${k==='lo'?'Lower':'Upper'} ${v}</text>`})}
  if(opt.hline!=null)s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(opt.hline)}" y2="${Y(opt.hline)}" stroke="${COL.pink}" stroke-dasharray="4 4" stroke-width="1.6"/>`;
  for(let i=0;i<=3;i++){const v=mn+(mx-mn)*i/3;s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.grid}" stroke-width=".8"/><text x="${P.l-6}" y="${Y(v)+4}" fill="${COL.dim}" font-size="10" font-weight="600" text-anchor="end">${(+v.toFixed(mx<10?1:0))}</text>`}
  if(opt.avg){const a=opt.avg.filter(p=>p.v!=null);if(a.length>1)s+=`<polyline fill="none" stroke="${COL.pink}" stroke-width="2.2" stroke-dasharray="6 4" points="${a.map(p=>X(p.i)+','+Y(p.v)).join(' ')}"/>`}
  s+=`<polyline fill="none" stroke="${opt.c||COL.mint}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${pts.map((p)=>X(opt.points.indexOf(p))+','+Y(p.v)).join(' ')}"/>`;
  pts.forEach(p=>{const i=opt.points.indexOf(p);s+=`<circle cx="${X(i)}" cy="${Y(p.v)}" r="5" fill="${p.c||opt.c||COL.mint}" stroke="#fff" stroke-width="2"><title>${p.l}: ${p.v}</title></circle><text x="${X(i)}" y="${Y(p.v)-12}" fill="${COL.ink}" font-size="11" font-weight="700" text-anchor="middle">${p.v}</text>`});
  const step=Math.ceil(opt.points.length/8);
  opt.points.forEach((p,i)=>{if(i%step===0||i===opt.points.length-1)s+=`<text x="${X(i)}" y="${H-12}" fill="${COL.dim}" font-size="10" font-weight="600" text-anchor="middle">${p.l}</text>`});
  el.innerHTML=s+'</svg>';
}

/* ---------- render ---------- */
let curLab='cre';
function render(){
  DB.labs.sort((a,b)=>a.d<b.d?-1:1);DB.rrr.sort((a,b)=>a.d<b.d?-1:1);
  const L=DB.labs,R=DB.rrr,last=L[L.length-1]||{},prev=L[L.length-2]||{};
  const lr=R[R.length-1];
  const l7=R.slice(-7).map(x=>x.v),avg7=l7.length?(l7.reduce((a,b)=>a+b,0)/l7.length).toFixed(1):'–';

  const k=[];
  if(lr){const[t,c]=rrrStat(lr.v);k.push(`<div class="kpi"><div class="lab">RRR ล่าสุด (${fmtD(lr.d)})</div><div class="val">${lr.v}<span style="font-size:13px;color:var(--dim);font-weight:600"> /นาที</span></div><span class="pill ${c}">${t}</span> <span class="muted">เฉลี่ย 7 วัน ${avg7}</span></div>`)}
  else k.push(`<div class="kpi"><div class="lab">RRR ล่าสุด</div><div class="val">–</div></div>`);
  LABS.forEach(l=>{const v=last[l.k],p=prev[l.k];const[t,c]=labStat(l,v);const d=(v!=null&&p!=null)?(v-p):null;
    k.push(`<div class="kpi"><div class="lab">${l.n} (${l.u})</div><div class="val">${v??'–'}</div><span class="pill ${c}">${t}</span> ${d!=null?`<span class="del" style="color:${d<0?'var(--ok)':'var(--bad)'}">${d>0?'▲ +':'▼ '}${Math.abs(d).toFixed(1)}</span>`:''}</div>`)});
  const wd=(last.wt!=null&&prev.wt!=null)?last.wt-prev.wt:null;
  k.push(`<div class="kpi"><div class="lab">น้ำหนัก (kg)</div><div class="val">${last.wt??'–'}</div>${wd!=null?`<span class="del" style="color:${wd<0?'var(--warn)':'var(--ok)'}">${wd>0?'▲ +':'▼ '}${Math.abs(wd).toFixed(2)} kg</span>`:''}</div>`);
  document.getElementById('kpis').innerHTML=k.join('');

  const hi=R.slice(-3).filter(x=>x.v>45).length,mid=R.slice(-3).filter(x=>x.v>=30).length;
  let a;
  if(!lr)a=`<div class="alert a-warn">🐾 ยังไม่มีข้อมูล RRR — เริ่มนับวันนี้ขณะทาโร่หลับสนิทได้เลยครับ</div>`;
  else if(hi>=2)a=`<div class="alert a-bad">⚠️ <b>RRR สูงเกิน 45 ติดกัน ${hi} ครั้ง</b> — อาจมีภาวะน้ำท่วมปอดกำเริบ ควรติดต่อสัตวแพทย์โดยเร็ว หากหายใจอ้าปาก/เหงือกซีด ให้ไปฉุกเฉินทันที</div>`;
  else if(mid>=2)a=`<div class="alert a-warn">🟡 RRR อยู่ในช่วงเฝ้าระวัง — นับซ้ำเช้า-เย็นวันนี้ จดอาการไอ/ซึม/เบื่ออาหาร และแจ้งหมอถ้าแนวโน้มยังขึ้น</div>`;
  else a=`<div class="alert a-ok">🟢 RRR อยู่ในเกณฑ์ปกติ — นับต่อเนื่องทุกวันเวลาเดิม เพื่อให้เห็นแนวโน้มชัดเจน</div>`;
  document.getElementById('alertBox').innerHTML=a;

  const rp=R.map((x,i)=>({i,v:x.v,l:fmtD(x.d),c:x.v>45?COL.bad:x.v>=30?COL.warn:COL.ok}));
  const av=R.map((x,i)=>{const w=R.slice(Math.max(0,i-6),i+1).map(z=>z.v);return{i,v:+(w.reduce((a,b)=>a+b,0)/w.length).toFixed(1)}});
  chart(document.getElementById('rrrChart'),{points:rp,avg:av,h:260,c:COL.mint,fixedMax:80,bands:[
    {lo:0,hi:30,c:COL.okBg},{lo:30,hi:45,c:COL.warnBg},{lo:45,hi:80,c:COL.badBg}]});

  document.getElementById('rrrBody').innerHTML=R.slice().reverse().map(x=>{const[t,c]=rrrStat(x.v);
    return `<tr><td>${x.d}</td><td><b>${x.v}</b></td><td><span class="pill ${c}">${t}</span></td><td style="white-space:normal;text-align:left">${x.note||'-'}</td><td class="noprint"><button class="btn danger" onclick="delRRR('${x.d}')">ลบ</button></td></tr>`}).join('')||'<tr><td colspan="5" class="muted">ยังไม่มีข้อมูล</td></tr>';

  document.getElementById('labTabs').innerHTML=LABS.map(l=>`<button class="tab ${l.k===curLab?'on':''}" onclick="curLab='${l.k}';render()">${l.n}</button>`).join('');
  const l=LABS.find(x=>x.k===curLab);
  chart(document.getElementById('labChart'),{h:260,c:COL.mint,ref:{lo:l.lo,hi:l.hi},
    points:L.map((x,i)=>({i,v:x[l.k]??null,l:fmtD(x.d),c:x[l.k]==null?COL.dim:(x[l.k]>l.hi||x[l.k]<l.lo)?COL.bad:COL.ok})),
    bands:[{lo:l.lo,hi:l.hi,c:COL.okBg}]});

  let th=`<thead><tr><th>รายการ</th><th>Lower</th><th>Upper</th>${L.map(x=>`<th>${fmtD(x.d)}</th>`).join('')}<th class="noprint"></th></tr></thead><tbody>`;
  th+=`<tr><td>น้ำหนัก (kg)</td><td>-</td><td>-</td>${L.map(x=>`<td>${x.wt??'-'}</td>`).join('')}<td class="noprint"></td></tr>`;
  LABS.forEach(li=>{th+=`<tr><td>${li.n}</td><td>${li.lo}</td><td>${li.hi}</td>${L.map(x=>{const v=x[li.k];const[t,c]=labStat(li,v);return `<td>${v??'-'} ${v!=null&&c!=='p-ok'?`<span class="pill ${c}">${t}</span>`:''}</td>`}).join('')}<td class="noprint"></td></tr>`});
  th+=`<tr class="noprint"><td colspan="3"></td>${L.map(x=>`<td><button class="btn danger" onclick="delLab('${x.d}')">ลบ</button></td>`).join('')}<td></td></tr></tbody>`;
  document.getElementById('labTable').innerHTML=th;

  const wp=L.map((x,i)=>({i,v:x.wt??null,l:fmtD(x.d)}));
  chart(document.getElementById('wtChart'),{points:wp,h:230,c:'#F0B457',hline:L[0]?L[0].wt:null});
}

/* ---------- actions ---------- */
function addRRR(){const d=rDate.value,v=+rVal.value;if(!d||!v)return alert('กรอกวันที่และค่า RRR');
  const i=DB.rrr.findIndex(x=>x.d===d);const o={d,v,note:rNote.value.trim()};
  i>=0?DB.rrr[i]=o:DB.rrr.push(o);rVal.value='';rNote.value='';save();render();checkEmergency(false)}
function delRRR(d){DB.rrr=DB.rrr.filter(x=>x.d!==d);save();render()}
function addLab(){const d=lDate.value;if(!d)return alert('เลือกวันที่');
  const g=id=>document.getElementById(id).value===''?null:+document.getElementById(id).value;
  const o={d,wt:g('l_wt'),cre:g('l_cre'),bun:g('l_bun'),alt:g('l_alt')};
  const i=DB.labs.findIndex(x=>x.d===d);i>=0?DB.labs[i]=Object.assign({},DB.labs[i],o):DB.labs.push(o);
  ['l_wt','l_cre','l_bun','l_alt'].forEach(x=>document.getElementById(x).value='');save();render()}
function delLab(d){if(!confirm('ลบผลตรวจวันที่ '+d+'?'))return;DB.labs=DB.labs.filter(x=>x.d!==d);save();render()}

/* ---------- Recorder (big tap button + progress ring) ---------- */
let recDur=30, taps=0, t0=null, tick=null;
const CIRC=2*Math.PI*90; // 565.48
const ring=document.getElementById('recorderRing');
const progressCircle=document.getElementById('progressCircle');
const recBtn=document.getElementById('tapBtn');
const tapCountEl=document.getElementById('tapCount');
const capLabelEl=document.getElementById('tapCapLabel');

document.querySelectorAll('.durChip').forEach(chip=>{
  chip.addEventListener('click',()=>{
    if(t0)return;
    document.querySelectorAll('.durChip').forEach(c=>c.classList.remove('on'));
    chip.classList.add('on');
    recDur=+chip.dataset.v;
  });
});

function setProgress(elapsedSec){
  const frac=Math.min(1, elapsedSec/recDur);
  progressCircle.style.strokeDashoffset = CIRC*(1-frac);
}

recBtn.addEventListener('click',()=>{
  tapCountEl.style.animation='none'; void tapCountEl.offsetWidth; tapCountEl.style.animation='tapPop .28s ease';

  if(!t0){
    t0=Date.now(); taps=0; tapCountEl.textContent='0';
    recBtn.classList.add('rec'); ring.classList.add('isRec');
    capLabelEl.textContent='กำลังนับ... เหลือ '+recDur+' วิ';
    setProgress(0);
    tick=setInterval(()=>{
      const elapsed=(Date.now()-t0)/1000;
      setProgress(elapsed);
      const remain=Math.max(0,Math.ceil(recDur-elapsed));
      capLabelEl.textContent='กำลังนับ... เหลือ '+remain+' วิ';
      if(elapsed>=recDur){
        clearInterval(tick); tick=null;
        const rate=Math.round(taps*60/recDur);
        document.getElementById('tapRate').textContent=rate;
        recBtn.classList.remove('rec'); ring.classList.remove('isRec');
        capLabelEl.textContent='เสร็จแล้ว 🎉 แตะรีเซ็ตเพื่อเริ่มใหม่';
        setProgress(recDur);
        t0=null;
      }
    },100);
  }
  taps++; tapCountEl.textContent=taps;
});

function resetTap(){
  clearInterval(tick); tick=null; t0=null; taps=0;
  tapCountEl.textContent='0';
  document.getElementById('tapRate').textContent='–';
  recBtn.classList.remove('rec'); ring.classList.remove('isRec');
  capLabelEl.textContent='แตะทุกจังหวะหายใจ';
  setProgress(0);
}
function useTap(){
  const r=document.getElementById('tapRate').textContent;
  if(r==='–')return alert('นับให้ครบเวลาก่อนครับ');
  rDate.value=iso(Date.now()); rVal.value=r; addRRR(); resetTap();
}

/* ---------- OCR: read lab values from an uploaded photo ---------- */
async function handleOcrUpload(inp){
  const f=inp.files[0]; if(!f) return;
  const url=URL.createObjectURL(f);
  const row=document.getElementById('ocrPreviewRow');
  const thumb=document.getElementById('ocrThumb');
  const status=document.getElementById('ocrStatus');
  row.style.display='flex';
  thumb.src=url;
  status.className='ocrStatus';
  status.innerHTML='<span class="spinner"></span>กำลังอ่านค่าจากรูป... (อาจใช้เวลา 10–30 วิ)';

  try{
    const { data } = await Tesseract.recognize(f, 'eng', { logger:()=>{} });
    const text = data.text || '';
    const found = parseLabText(text);
    const parts=[];
    if(found.cre!=null){ document.getElementById('l_cre').value=found.cre; parts.push('Creatinine='+found.cre); }
    if(found.bun!=null){ document.getElementById('l_bun').value=found.bun; parts.push('BUN='+found.bun); }
    if(found.alt!=null){ document.getElementById('l_alt').value=found.alt; parts.push('ALT='+found.alt); }
    if(found.wt!=null){ document.getElementById('l_wt').value=found.wt; parts.push('น้ำหนัก='+found.wt); }

    if(parts.length){
      status.innerHTML = '✅ อ่านได้: ' + parts.join(' · ') + ' — <b>กรุณาตรวจสอบก่อนกดบันทึกผล</b>';
    }else{
      status.className='ocrStatus err';
      status.innerHTML = '⚠️ ไม่พบค่าที่อ่านได้ชัดเจน กรุณากรอกเองด้านล่าง';
    }
  }catch(e){
    status.className='ocrStatus err';
    status.innerHTML = '⚠️ อ่านรูปไม่สำเร็จ ลองรูปที่ชัดขึ้นหรือกรอกเองด้านล่าง';
  }
  inp.value='';
}

function parseLabText(raw){
  const text = raw.replace(/,/g,'.').toLowerCase();
  const num = '([0-9]+(?:\\.[0-9]+)?)';
  const grab = (patterns)=>{
    for(const p of patterns){
      const m = text.match(p);
      if(m) return parseFloat(m[1]);
    }
    return null;
  };
  const cre = grab([
    new RegExp('creatinine[^0-9]{0,10}'+num,'i'),
    new RegExp('\\bcre2?\\b[^0-9]{0,10}'+num,'i'),
    new RegExp('\\bcrea\\b[^0-9]{0,10}'+num,'i')
  ]);
  const bun = grab([
    new RegExp('bun[^0-9]{0,10}'+num,'i')
  ]);
  const alt = grab([
    new RegExp('alt\\s*/?\\s*gpt[^0-9]{0,10}'+num,'i'),
    new RegExp('\\balt\\b[^0-9]{0,10}'+num,'i'),
    new RegExp('\\bgpt\\b[^0-9]{0,10}'+num,'i')
  ]);
  const wt = grab([
    new RegExp('weight[^0-9]{0,10}'+num+'\\s*kg','i'),
    new RegExp('body\\s*weight[^0-9]{0,10}'+num,'i'),
    new RegExp('\\bbw\\b[^0-9]{0,10}'+num,'i'),
    new RegExp(num+'\\s*kg\\b','i')
  ]);
  return {cre,bun,alt,wt};
}

/* io */
function dl(name,txt,type){const b=new Blob([txt],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
function exportJSON(){dl('taro_health_'+iso(Date.now())+'.json',JSON.stringify(DB,null,2),'application/json')}
function exportCSV(){let c='\ufeffLABS\ndate,weight,creatinine,bun,alt\n'+DB.labs.map(x=>[x.d,x.wt??'',x.cre??'',x.bun??'',x.alt??''].join(',')).join('\n');
  c+='\n\nRRR\ndate,rate,status,note\n'+DB.rrr.map(x=>[x.d,x.v,rrrStat(x.v)[0],'"'+(x.note||'')+'"'].join(',')).join('\n');
  dl('taro_health_'+iso(Date.now())+'.csv',c,'text/csv')}
function importJSON(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();
  r.onload=e=>{try{const j=JSON.parse(e.target.result);if(!j.labs||!j.rrr)throw 0;DB=j;save();render();alert('นำเข้าสำเร็จ')}catch(err){alert('ไฟล์ไม่ถูกต้อง')}};r.readAsText(f)}

/* ---------- Firebase: Anonymous Auth + Shared "Family PIN" document ---------- */
let fbApp=null, auth=null, db=null, unsub=null, saveTimer=null, applyingRemote=false, currentDocId=null, firstSnapshot=true;
function fbReady(){ return typeof firebaseConfig!=='undefined' && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('YOUR_'); }

if(fbReady()){
  fbApp = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
}else{
  document.getElementById('authModal').innerHTML =
    '<div class="modalBox"><div class="modalBody" style="background:var(--card);border-radius:28px;padding:28px 22px;box-shadow:var(--shadow)">'+
    '<h3>⚠️ ยังไม่ได้ตั้งค่า Firebase</h3>'+
    '<p>เปิดไฟล์ <code>firebase-config.js</code> แล้วใส่ค่าจาก Firebase Console ของคุณ ดูขั้นตอนใน README.md</p>'+
    '<button class="btn mint" style="width:100%" onclick="location.reload()">ลองใหม่</button></div></div>';
}

function togglePinVisibility(){
  const chk=document.getElementById('pinShowChk');
  pinInput.type = chk.checked ? 'text' : 'password';
}

async function sha256Hex(text){
  const enc=new TextEncoder().encode(text);
  const buf=await crypto.subtle.digest('SHA-256',enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

function setSync(state){
  syncDot.className='syncdot '+state;
  syncText.textContent = state==='on'?'ซิงค์แล้ว':state==='busy'?'กำลังซิงค์...':'ออฟไลน์';
}

async function connectToFamily(docId){
  currentDocId=docId;
  firstSnapshot=true;
  document.getElementById('authModal').style.display='none';
  document.getElementById('appRoot').style.display='block';
  setSync('busy');
  if(unsub){unsub();unsub=null}
  const ref=db.collection('family').doc(docId);
  unsub = ref.onSnapshot(snap=>{
    if(snap.exists){
      const data=snap.data();
      if(data && data.labs && data.rrr){
        applyingRemote=true;
        DB=data;
        localStorage.setItem(KEY,JSON.stringify(DB));
        render();
        applyingRemote=false;
        // แจ้งเตือนแม้ค่าล่าสุดจะถูกกรอกจากอุปกรณ์อื่น (เช่น พ่อ-แม่กรอกตอนเราไม่อยู่)
        checkEmergency(!firstSnapshot);
      }
    }else{
      ref.set(DB);
    }
    firstSnapshot=false;
    setSync('on');
  }, ()=>setSync('off'));
}

async function doEnter(){
  const pin=pinInput.value.trim();
  authErr.textContent='';
  if(!pin || pin.length<4) return authErr.textContent='กรอกรหัสอย่างน้อย 4 ตัวอักษร';
  authSubmit.disabled=true; authSubmit.textContent='กำลังเชื่อมต่อ...';
  try{
    if(!auth.currentUser){ await auth.signInAnonymously(); }
    const docId='fam_'+(await sha256Hex(pin)).slice(0,24);
    localStorage.setItem(PIN_KEY, docId);
    await connectToFamily(docId);
  }catch(e){
    authErr.textContent = e.code==='auth/operation-not-allowed'
      ? 'ยังไม่ได้เปิดใช้ Anonymous sign-in ใน Firebase Console (ดู README)'
      : (e.message||'เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง');
  }
  authSubmit.disabled=false; authSubmit.textContent='🐾 เข้าใช้งาน';
}

function doLeave(){
  if(!confirm('ออกจากอุปกรณ์นี้? ครั้งหน้าจะต้องใส่รหัสครอบครัวใหม่ (ข้อมูลบน cloud ไม่หาย)'))return;
  localStorage.removeItem(PIN_KEY);
  if(unsub){unsub();unsub=null}
  document.getElementById('appRoot').style.display='none';
  document.getElementById('authModal').style.display='flex';
  pinInput.value='';
}

if(auth){
  auth.onAuthStateChanged(async user=>{
    const savedDocId=localStorage.getItem(PIN_KEY);
    if(savedDocId){
      try{
        if(!user){ await auth.signInAnonymously(); }
        connectToFamily(savedDocId);
      }catch(e){
        document.getElementById('appRoot').style.display='none';
        document.getElementById('authModal').style.display='flex';
      }
    }
  });
}

function save(){
  localStorage.setItem(KEY,JSON.stringify(DB));
  if(applyingRemote) return;
  if(!currentDocId||!db) return;
  clearTimeout(saveTimer);
  setSync('busy');
  saveTimer=setTimeout(()=>{
    db.collection('family').doc(currentDocId).set(DB)
      .then(()=>setSync('on'))
      .catch(()=>setSync('off'));
  },400);
}

document.getElementById('pinInput').addEventListener('keydown',e=>{if(e.key==='Enter')doEnter()});

/* PWA install + service worker */
let deferredPrompt;
const installBtn=document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();deferredPrompt=e;installBtn.style.display='grid'});
installBtn.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.style.display='none'});
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})})}

window.addEventListener('resize',()=>render());
render();
