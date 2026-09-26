const KEY='taro_health_v1';
const PIN_KEY='taro_family_docid_v1';
const EM_SEEN_KEY='taro_em_seen_v1';
const RRR_DANGER=45;

/* ============================================================
   PAGE NAVIGATION (sidebar / bottom nav / topbar title)
   ============================================================ */
const PAGE_TITLES={
  home:'ภาพรวม', vet:'คลินิก / รพ.สัตว์', echo:'หัวใจ (Echo)',
  meds:'ยาที่ใช้ประจำ', rrr:'การหายใจ (RRR)', labs:'ผลเลือด / น้ำหนัก', tools:'ข้อมูล & การใช้งาน'
};
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  const target=document.getElementById('page-'+name);
  if(target) target.classList.add('on');
  document.querySelectorAll('.navItem[data-page]').forEach(b=>b.classList.toggle('on', b.dataset.page===name));
  document.querySelectorAll('.bnItem[data-page]').forEach(b=>b.classList.toggle('on', b.dataset.page===name));
  const titleEl=document.getElementById('pageTitleText');
  if(titleEl) titleEl.textContent=PAGE_TITLES[name]||name;
  closeSidebar();
  window.scrollTo({top:0,behavior:'instant'});
  const pc=document.querySelector('.pageContent'); if(pc) pc.scrollTop=0;
}
function openSidebar(){ document.getElementById('sidebar').classList.add('open'); document.getElementById('sideOverlay').classList.add('show'); }
function closeSidebar(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sideOverlay').classList.remove('show'); }

/* LABS = reference-range fields (excludes weight, which has no lo/hi and is handled specially) */
const LABS=[
  {k:'cre',n:'Creatinine',u:'mg/dL',lo:0.4,hi:2.3},
  {k:'bun',n:'BUN',u:'mg/dL',lo:14,hi:38},
  {k:'alt',n:'ALT / GPT',u:'U/L',lo:0,hi:55}
];
/* TABS = everything shown as switchable tabs in the merged lab chart card (weight first, per request) */
const TABS=[{k:'wt',n:'น้ำหนัก',u:'kg',lo:null,hi:null}, ...LABS];

/* ---------- Echo (cardiac ultrasound) reference parameters ----------
   Reference cutoffs below are taken DIRECTLY from what the attending vet explicitly stated
   for IVSd / LA:Ao / LAFS in this cat's own report. LVFS and LVPWd have no vet-confirmed
   cutoff in this case, so they are recorded WITHOUT an automatic pass/fail badge (dir:'none')
   to avoid asserting a threshold that hasn't been confirmed by the treating vet. */
const ECHO_PARAMS=[
  {k:'ivsd',  n:'IVSd (ผนังหัวใจหนา)', u:'cm', hi:0.6,  dir:'high'},
  {k:'laao',  n:'LA/Ao ratio',        u:'',   hi:1.7, hi2:2.0, dir:'high'},
  {k:'lafs',  n:'LAFS (บีบตัว LA)',    u:'%',  lo:25,   dir:'low'},
  {k:'lvfs',  n:'LVFS (บีบตัว LV)',    u:'%',  dir:'none'},
  {k:'lvpwd', n:'LVPWd',              u:'cm', dir:'none'}
];
const DIAG_LABELS={normal:'ปกติ',hcm:'HCM',hcm_phenotype:'HCM phenotype',rcm:'RCM',dcm:'DCM',arvc:'ARVC',hcm_endstage:'HCM ระยะท้าย'};
const RISK_LABELS={low:'ต่ำ',moderate:'ปานกลาง',high:'สูง'};
const MED_STATUS_LABELS={active:'กำลังใช้อยู่',stopped:'หยุดแล้ว'};

/* ---------- Vet clinics (Rayong) ---------- */
const VETS={
  regular:{
    name:'ดีด็อกรักษาสัตว์ (D-Dog Pet Hospital)',
    addr:'107/18 อาคาร D-DOG ถ.วัดมาบตาพุด ต.มาบตาพุด อ.เมืองระยอง จ.ระยอง 21150',
    phone:'0887787424', phoneDisplay:'088-778-7424',
    hoursText:'จ. อ. พฤ. ศ. ส. อา. 08:00–20:00 · พุธ ปิด',
    mapUrl:'https://www.google.com/maps/dir/?api=1&destination=12.71876,101.17121',
    hours:{0:[8,20],1:[8,20],2:[8,20],3:null,4:[8,20],5:[8,20],6:[8,20]}
  },
  emergency:{
    name:'โรงพยาบาลสัตว์วุฒิเลิศการุณ',
    addr:'198/31 ถ.มาบตาพุด ต.มาบตาพุด อ.เมืองระยอง จ.ระยอง 21150',
    phone:'0859999698', phoneDisplay:'085-999-9698',
    hoursText:'เปิดบริการ 24 ชั่วโมง ทุกวัน',
    mapUrl:'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent('โรงพยาบาลสัตว์วุฒิเลิศการุณ 198/31 ถ.มาบตาพุด ต.มาบตาพุด อ.เมืองระยอง จ.ระยอง')
  }
};
const THAI_DAYS=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

function isRegularOpenNow(){
  const now=new Date();
  const h=VETS.regular.hours[now.getDay()];
  if(!h) return false;
  const t=now.getHours()+now.getMinutes()/60;
  return t>=h[0] && t<h[1];
}
function recommendedVet(){ return isRegularOpenNow()?VETS.regular:VETS.emergency; }

function renderVetCards(){
  const openNow=isRegularOpenNow();
  const dayName=THAI_DAYS[new Date().getDay()];
  const cardHtml=(v,isRegular,active)=>{
    const badge = isRegular
      ? (openNow?'<span class="vBadge open">เปิดอยู่</span>':'<span class="vBadge closed">ปิดแล้ว</span>')
      : '<span class="vBadge open">เปิด 24 ชม.</span>';
    return `<div class="vetCard ${active?'active':''}">
      <div class="vTop">
        <div>
          <div class="vName">${isRegular?'🏥':'🚨'} ${v.name} ${isRegular?'<span class=\"muted\">คลินิกประจำ</span>':'<span class=\"muted\">ฉุกเฉิน/นอกเวลา</span>'}</div>
          <div class="vHours">🕐 ${v.hoursText}</div>
          <div class="vAddr">📍 ${v.addr}</div>
        </div>
        ${badge}
      </div>
      <div class="vetActions">
        <a class="btn accent" href="${v.mapUrl}" target="_blank" rel="noopener">🗺️ เปิดแผนที่นำทาง</a>
        <a class="btn ghost" href="tel:${v.phone}">📞 โทร ${v.phoneDisplay}</a>
      </div>
    </div>`;
  };
  let html = cardHtml(VETS.regular,true, openNow) + cardHtml(VETS.emergency,false, !openNow);
  html += `<div class="vetNote">${openNow
      ? `ตอนนี้ (วัน${dayName}) อยู่ในเวลาเปิดของคลินิกประจำ — ไปดีด็อกรักษาสัตว์ได้เลย`
      : `ตอนนี้ (วัน${dayName}) นอกเวลาทำการคลินิกประจำ — แนะนำไปโรงพยาบาลสัตว์วุฒิเลิศการุณ (เปิด 24 ชม.) แทน`}</div>`;
  document.getElementById('vetCards').innerHTML=html;
}

/* ---------- Seed data ----------
   NOTE: medication schema (v2): { id, drug, dose, freq, times, startDate, status, stopDate, linkedEcho, note } */
const SEED={
  labs:[
    {d:'2026-08-23',wt:4.8,cre:null,bun:null,alt:null,note:''},
    {d:'2026-08-27',wt:4.0,cre:null,bun:null,alt:null,note:''},
    {d:'2026-08-31',wt:3.8,cre:2.3,bun:28,alt:36,note:''},
    {d:'2026-09-09',wt:4.2,cre:1.7,bun:24,alt:null,note:''},
    {d:'2026-09-13',wt:4.2,cre:1.8,bun:31,alt:null,note:''},
    {d:'2026-09-21',wt:4.5,cre:2.7,bun:36,alt:20,note:'ฉีดยาขับน้ำเช้านี้ก่อนเจาะเลือด'},
    {d:'2026-09-23',wt:4.2,cre:1.6,bun:37,alt:26,note:''},
    {d:'2026-09-25',wt:4.5,cre:null,bun:null,alt:null,note:''}
  ],
  rrr:[
    {d:'2026-09-11',t:'08:00',v:60,note:''},
    {d:'2026-09-12',t:'08:15',v:46,note:''},
    {d:'2026-09-13',t:'08:10',v:27,note:''}
  ],
  echo:[],
  meds:[]
};
let DB=JSON.parse(localStorage.getItem(KEY)||'null')||JSON.parse(JSON.stringify(SEED));
DB.rrr.forEach(x=>{ if(!x.t) x.t='08:00'; });
DB.labs.forEach(x=>{ if(x.note==null) x.note=''; });
if(!DB.echo) DB.echo=[];
if(!DB.meds) DB.meds=[];

/* Migrate any OLD medication log entries (schema v1: {d, action, dose, linkedEcho, note})
   into the NEW "current medications" schema so existing data never breaks or disappears. */
function migrateMedsSchema(){
  DB.meds = DB.meds.map(x=>{
    if(x.startDate!==undefined) return x; // already new schema
    return {
      id: x.id || ('m'+Math.random().toString(36).slice(2,9)),
      drug: x.drug||'', dose: x.dose||'', freq:'', times:'',
      startDate: x.d || iso(Date.now()),
      status: x.action==='stop' ? 'stopped' : 'active',
      stopDate: x.action==='stop' ? (x.d||'') : '',
      linkedEcho: x.linkedEcho||'', note: x.note||''
    };
  });
}
migrateMedsSchema();

const iso=d=>new Date(d).toISOString().slice(0,10);
const nowTime=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
const fmtD=s=>{const[y,m,d]=s.split('-');return d+'/'+m};
function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
document.getElementById('today').textContent=new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
document.getElementById('rDate').value=iso(Date.now());
document.getElementById('rTime').value=nowTime();
document.getElementById('lDate').value=iso(Date.now());
document.getElementById('e_date').value=iso(Date.now());
document.getElementById('m_start').value=iso(Date.now());

const COL={mint:'#4C6FFF',pink:'#8C6CE0',ok:'#17B978',okBg:'rgba(23,185,120,.14)',warn:'#F5A623',warnBg:'rgba(245,166,35,.14)',bad:'#F5455C',badBg:'rgba(245,69,92,.14)',grid:'#E8EAF6',dim:'#8B90A8',ink:'#1B1E2B',note:'#8C6CE0',wt:'#F0A93F'};

function rrrStat(v){return v<30?['ปกติ','p-ok']:v<=45?['เฝ้าระวัง','p-warn']:['ผิดปกติ','p-bad']}
function labStat(l,v){
  if(v==null)return['–',''];
  if(l.lo==null) return ['',''];
  return v<l.lo?['ต่ำ','p-warn']:v>l.hi?['สูง','p-bad']:['ปกติ','p-ok'];
}
/* Generalized status for echo params: supports "higher = worse" (with an optional 2nd/severe
   threshold, e.g. LA/Ao) and "lower = worse" (e.g. LAFS). dir:'none' = no automatic judgement. */
function echoStat(p, v){
  if(v==null) return ['–',''];
  if(p.dir==='none') return ['',''];
  if(p.dir==='low'){
    return v<p.lo ? ['ผิดปกติ','p-bad'] : ['ปกติ','p-ok'];
  }
  if(p.hi2!=null && v>p.hi2) return ['รุนแรง','p-bad'];
  if(v>p.hi) return ['สูงกว่าเกณฑ์','p-warn'];
  return ['ปกติ','p-ok'];
}
function riskLabel(v){ return RISK_LABELS[v]||v||''; }
function diagnosisLabel(x){ return x.diag==='other' ? (x.diagOther||'อื่นๆ') : (DIAG_LABELS[x.diag]||''); }
function medStatusLabel(s){ return MED_STATUS_LABELS[s]||s; }
function medStatusClass(s){ return s==='active'?'p-ok':'p-off'; }

/* quick-fill helper: suggest common clock times when user picks a frequency preset */
function suggestTimesForFreq(){
  const f=document.getElementById('m_freq').value.trim();
  const timesEl=document.getElementById('m_times');
  if(timesEl.value.trim()) return; // don't overwrite something the user already typed
  if(f.includes('1 ครั้ง')) timesEl.value='08:00';
  else if(f.includes('2 ครั้ง')) timesEl.value='08:00, 20:00';
  else if(f.includes('3 ครั้ง')) timesEl.value='08:00, 14:00, 20:00';
}

/* find the most recent entry that actually has a value for `field` (skips gaps) */
function lastNonNull(field){
  const L=DB.labs;
  for(let i=L.length-1;i>=0;i--){ if(L[i][field]!=null) return {v:L[i][field], d:L[i].d, idx:i}; }
  return null;
}
function prevNonNullBefore(field, idx){
  const L=DB.labs;
  for(let i=idx-1;i>=0;i--){ if(L[i][field]!=null) return L[i][field]; }
  return null;
}

/* ---------- Emergency popup ---------- */
function checkEmergency(fromSync){
  const R=DB.rrr.slice().sort((a,b)=>(a.d+a.t)<(b.d+b.t)?-1:1);
  const last=R[R.length-1];
  if(!last || last.v<=RRR_DANGER) return;
  const seenTag=localStorage.getItem(EM_SEEN_KEY);
  const thisTag=last.d+'|'+last.t+'|'+last.v;
  if(seenTag===thisTag) return;
  localStorage.setItem(EM_SEEN_KEY, thisTag);
  document.getElementById('emVal').innerHTML = last.v+' <span>ครั้ง/นาที</span>';
  document.getElementById('emWho').textContent = 'บันทึกวันที่ '+last.d+' เวลา '+last.t+(last.note?(' · '+last.note):'')+(fromSync?' (ซิงค์จากอีกอุปกรณ์)':'');
  const v=recommendedVet();
  document.getElementById('emVetBox').innerHTML = `
    <div class="vLabel">${v===VETS.regular?'คลินิกประจำ (เปิดอยู่ตอนนี้)':'🚨 นอกเวลา/ดึก → ไปที่นี่แทน'}</div>
    <div class="vName">${v.name}</div>
    <div class="vSub">📞 ${v.phoneDisplay} · ${v.hoursText}</div>`;
  document.getElementById('emNavBtn').onclick=()=>{ window.open(v.mapUrl,'_blank'); dismissEmergency(); };
  document.getElementById('emOverlay').classList.add('show');
  if(navigator.vibrate) navigator.vibrate([200,100,200]);
}
function dismissEmergency(){ document.getElementById('emOverlay').classList.remove('show'); }

/* ---------- tiny SVG chart engine ---------- */
/* IMPORTANT: X-position is scaled against the TOTAL number of x-axis categories
   (opt.points.length — every date/entry including ones with a null value for this
   particular field), NOT just the count of non-null points. Using only non-null
   points would push later entries off the right edge whenever earlier dates had a
   null value for the selected field (e.g. Creatinine missing on some visits but
   present on later ones) — that was the "only shows 3 points" bug from before. */
function chart(el,opt){
  const W=Math.max(el.clientWidth||640,340),H=opt.h||260,P={t:26,r:16,b:34,l:44};
  const pts=opt.points.filter(p=>p.v!=null);
  if(!pts.length){el.innerHTML='<div class="muted" style="padding:30px;text-align:center">ยังไม่มีข้อมูล</div>';return}
  let mn=Math.min(...pts.map(p=>p.v)),mx=Math.max(...pts.map(p=>p.v));
  if(opt.fixedMax!=null){ mn=Math.min(0,mn); mx=Math.max(opt.fixedMax, mx); }
  else{ (opt.bands||[]).forEach(b=>{mn=Math.min(mn,b.lo);mx=Math.max(mx,b.hi===Infinity?mx:b.hi)}); }
  if(opt.ref){mn=Math.min(mn,opt.ref.lo);mx=Math.max(mx,opt.ref.hi)}
  const pad=(mx-mn||1)*0.14;mn=Math.max(0,mn-pad);mx=mx+pad;
  const total=opt.points.length;
  const X=i=>P.l+(total===1?(W-P.l-P.r)/2:i*(W-P.l-P.r)/(total-1));
  const Y=v=>P.t+(H-P.t-P.b)*(1-(v-mn)/(mx-mn));
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">`;
  (opt.bands||[]).forEach(b=>{const hiClamped=Math.min(b.hi,mx);const y1=Y(hiClamped),y2=Y(Math.max(b.lo,mn));s+=`<rect x="${P.l}" y="${y1}" width="${W-P.l-P.r}" height="${Math.max(0,y2-y1)}" rx="8" fill="${b.c}"/>`});
  if(opt.ref){[['lo',opt.ref.lo],['hi',opt.ref.hi]].forEach(([k,v])=>{s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.dim}" stroke-dasharray="5 4" stroke-width="1.4"/><text x="${W-P.r}" y="${Y(v)-4}" fill="${COL.dim}" font-size="10" font-weight="600" text-anchor="end">${k==='lo'?'Lower':'Upper'} ${v}</text>`})}
  if(opt.hline!=null)s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(opt.hline)}" y2="${Y(opt.hline)}" stroke="${COL.pink}" stroke-dasharray="4 4" stroke-width="1.6"/>`;
  for(let i=0;i<=3;i++){const v=mn+(mx-mn)*i/3;s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.grid}" stroke-width=".8"/><text x="${P.l-6}" y="${Y(v)+4}" fill="${COL.dim}" font-size="10" font-weight="600" text-anchor="end">${(+v.toFixed(mx<10?1:0))}</text>`}
  if(opt.avg){const a=opt.avg.filter(p=>p.v!=null);if(a.length>1)s+=`<polyline fill="none" stroke="${COL.pink}" stroke-width="2.2" stroke-dasharray="6 4" points="${a.map(p=>X(p.i)+','+Y(p.v)).join(' ')}"/>`}
  s+=`<polyline fill="none" stroke="${opt.c||COL.mint}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${pts.map((p)=>X(opt.points.indexOf(p))+','+Y(p.v)).join(' ')}"/>`;
  pts.forEach(p=>{
    const i=opt.points.indexOf(p);
    const titleText = p.note ? `${p.l}: ${p.v}\n📝 ${p.note}` : `${p.l}: ${p.v}`;
    s+=`<circle cx="${X(i)}" cy="${Y(p.v)}" r="5" fill="${p.c||opt.c||COL.mint}" stroke="#fff" stroke-width="2"><title>${titleText}</title></circle><text x="${X(i)}" y="${Y(p.v)-12}" fill="${COL.ink}" font-size="11" font-weight="700" text-anchor="middle">${p.v}</text>`;
    if(p.note){
      s+=`<text x="${X(i)}" y="${P.t-10}" font-size="13" text-anchor="middle" style="cursor:default"><title>${p.note}</title>📝</text>`;
      s+=`<line x1="${X(i)}" x2="${X(i)}" y1="${P.t-2}" y2="${Y(p.v)-14}" stroke="${COL.note}" stroke-width="1.3" stroke-dasharray="2 3"/>`;
    }
  });
  const step=Math.ceil(opt.points.length/8);
  opt.points.forEach((p,i)=>{if(i%step===0||i===opt.points.length-1)s+=`<text x="${X(i)}" y="${H-12}" fill="${COL.dim}" font-size="10" font-weight="600" text-anchor="middle">${p.l}</text>`});
  el.innerHTML=s+'</svg>';
}

/* ---------- render ---------- */
let curLab='wt';
let curEcho='laao';
function render(){
  DB.labs.sort((a,b)=>a.d<b.d?-1:1);
  DB.rrr.sort((a,b)=>(a.d+a.t)<(b.d+b.t)?-1:1);
  DB.echo.sort((a,b)=>a.d<b.d?-1:1);
  const L=DB.labs,R=DB.rrr,E=DB.echo;
  const lr=R[R.length-1];
  const lastEcho=E[E.length-1];
  const l7=R.slice(-7).map(x=>x.v),avg7=l7.length?(l7.reduce((a,b)=>a+b,0)/l7.length).toFixed(1):'–';

  /* ---- KPI cards ---- */
  const k=[];
  if(lr){const[t,c]=rrrStat(lr.v);k.push(`<div class="kpi primary"><div class="lab">RRR ล่าสุด (${fmtD(lr.d)} ${lr.t})</div><div class="val">${lr.v}<span style="font-size:13px;font-weight:600"> /นาที</span></div><span class="pill ${c}">${t}</span> <span class="muted" style="color:rgba(255,255,255,.78)">เฉลี่ย 7 ค่า ${avg7}</span></div>`)}
  else k.push(`<div class="kpi"><div class="lab">RRR ล่าสุด</div><div class="val">–</div></div>`);

  LABS.forEach(l=>{
    const cur=lastNonNull(l.k);
    const v=cur?cur.v:null;
    const p=cur?prevNonNullBefore(l.k,cur.idx):null;
    const[t,c]=labStat(l,v);
    const d=(v!=null&&p!=null)?(v-p):null;
    k.push(`<div class="kpi"><div class="lab">${l.n} (${l.u})</div><div class="val">${v??'–'}</div>${c?`<span class="pill ${c}">${t}</span>`:''} ${d!=null?`<span class="del" style="color:${d<0?'var(--ok)':'var(--bad)'}">${d>0?'▲ +':'▼ '}${Math.abs(d).toFixed(1)}</span>`:''}<div class="asof">${cur?'ล่าสุด '+fmtD(cur.d):''}</div></div>`);
  });

  const wtCur=lastNonNull('wt');
  const wtPrev=wtCur?prevNonNullBefore('wt',wtCur.idx):null;
  const wd=(wtCur&&wtPrev!=null)?(wtCur.v-wtPrev):null;
  k.push(`<div class="kpi"><div class="lab">น้ำหนัก (kg)</div><div class="val">${wtCur?wtCur.v:'–'}</div>${wd!=null?`<span class="del" style="color:${wd<0?'var(--warn)':'var(--ok)'}">${wd>0?'▲ +':'▼ '}${Math.abs(wd).toFixed(2)} kg</span>`:''}<div class="asof">${wtCur?'ล่าสุด '+fmtD(wtCur.d):''}</div></div>`);

  if(lastEcho){
    if(lastEcho.laao!=null){
      const p=ECHO_PARAMS.find(x=>x.k==='laao');
      const[t,c]=echoStat(p,lastEcho.laao);
      k.push(`<div class="kpi"><div class="lab">LA/Ao ratio</div><div class="val">${lastEcho.laao}</div><span class="pill ${c}">${t}</span><div class="asof">Echo ${fmtD(lastEcho.d)}</div></div>`);
    }
    if(lastEcho.risk){
      const rc = lastEcho.risk==='high'?'p-bad':lastEcho.risk==='moderate'?'p-warn':'p-ok';
      k.push(`<div class="kpi"><div class="lab">ความเสี่ยงลิ่มเลือด (ATE)</div><div class="val" style="font-size:19px">${riskLabel(lastEcho.risk)}</div><span class="pill ${rc}">จาก Echo</span><div class="asof">${fmtD(lastEcho.d)}</div></div>`);
    }
  }
  document.getElementById('kpis').innerHTML=k.join('');

  /* ---- RRR alert banner ---- */
  const hi=R.slice(-3).filter(x=>x.v>45).length,mid=R.slice(-3).filter(x=>x.v>=30).length;
  let a;
  if(!lr)a=`<div class="alert a-warn">🐾 ยังไม่มีข้อมูล RRR — เริ่มนับวันนี้ขณะทาโร่หลับสนิทได้เลยครับ</div>`;
  else if(hi>=2)a=`<div class="alert a-bad">⚠️ <b>RRR สูงเกิน 45 ติดกัน ${hi} ครั้ง</b> — อาจมีภาวะน้ำท่วมปอดกำเริบ ควรติดต่อสัตวแพทย์โดยเร็ว หากหายใจอ้าปาก/เหงือกซีด ให้ไปฉุกเฉินทันที</div>`;
  else if(mid>=2)a=`<div class="alert a-warn">🟡 RRR อยู่ในช่วงเฝ้าระวัง — นับซ้ำเช้า-เย็นวันนี้ จดอาการไอ/ซึม/เบื่ออาหาร และแจ้งหมอถ้าแนวโน้มยังขึ้น</div>`;
  else a=`<div class="alert a-ok">🟢 RRR อยู่ในเกณฑ์ปกติ — นับต่อเนื่องเช้า-เย็นทุกวัน เพื่อให้เห็นแนวโน้มชัดเจน</div>`;
  document.getElementById('alertBox').innerHTML=a;

  /* ---- ATE status banner (inside Heart/ATE card) ---- */
  const banner=document.getElementById('ateStatusBanner');
  if(lastEcho && (lastEcho.risk||lastEcho.diag)){
    const rc = lastEcho.risk==='high'?'a-bad':lastEcho.risk==='moderate'?'a-warn':'a-ok';
    banner.innerHTML = `<div class="alert ${rc}" style="margin-bottom:12px">🫀 <b>ผล Echo ล่าสุด (${fmtD(lastEcho.d)}):</b> ${lastEcho.risk?('ความเสี่ยงลิ่มเลือดอุดตัน = <b>'+riskLabel(lastEcho.risk)+'</b>'):''}${lastEcho.diag?(' · วินิจฉัย: <b>'+diagnosisLabel(lastEcho)+'</b>'):''}</div>`;
  }else{
    banner.innerHTML='';
  }

  renderVetCards();
  renderEcho();
  renderMeds();

  /* ---- RRR chart + table ---- */
  const rp=R.map((x,i)=>({i,v:x.v,l:fmtD(x.d)+' '+x.t,c:x.v>45?COL.bad:x.v>=30?COL.warn:COL.ok}));
  const av=R.map((x,i)=>{const w=R.slice(Math.max(0,i-6),i+1).map(z=>z.v);return{i,v:+(w.reduce((a,b)=>a+b,0)/w.length).toFixed(1)}});
  chart(document.getElementById('rrrChart'),{points:rp,avg:av,h:260,c:COL.mint,fixedMax:80,bands:[
    {lo:0,hi:30,c:COL.okBg},{lo:30,hi:45,c:COL.warnBg},{lo:45,hi:80,c:COL.badBg}]});

  document.getElementById('rrrBody').innerHTML=R.slice().reverse().map(x=>{const[t,c]=rrrStat(x.v);
    return `<tr><td>${x.d}</td><td>${x.t}</td><td><b>${x.v}</b></td><td><span class="pill ${c}">${t}</span></td><td style="white-space:normal;text-align:left">${x.note||'-'}</td><td class="noprint"><button class="btn danger" onclick="delRRR('${x.d}','${x.t}')">ลบ</button></td></tr>`}).join('')||'<tr><td colspan="6" class="muted">ยังไม่มีข้อมูล</td></tr>';

  /* ---- Merged tab chart: น้ำหนัก / Creatinine / BUN / ALT-GPT ---- */
  document.getElementById('labTabs').innerHTML=TABS.map(l=>`<button class="tab ${l.k===curLab?'on':''}" onclick="curLab='${l.k}';render()">${l.n}</button>`).join('');
  const l=TABS.find(x=>x.k===curLab)||TABS[0];
  if(l.k==='wt'){
    const baseRec=L.find(x=>x.wt!=null);
    chart(document.getElementById('labChart'),{
      h:270,c:COL.wt,
      hline: baseRec?baseRec.wt:null,
      points:L.map((x,i)=>({i,v:x.wt??null,l:fmtD(x.d),note:x.note||null,c:x.wt==null?COL.dim:COL.wt}))
    });
  }else{
    chart(document.getElementById('labChart'),{h:270,c:COL.mint,ref:{lo:l.lo,hi:l.hi},
      points:L.map((x,i)=>({i,v:x[l.k]??null,l:fmtD(x.d),note:x.note||null,c:x[l.k]==null?COL.dim:(x[l.k]>l.hi||x[l.k]<l.lo)?COL.bad:COL.ok})),
      bands:[{lo:l.lo,hi:l.hi,c:COL.okBg}]});
  }

  let th=`<thead><tr><th>รายการ</th><th>Lower</th><th>Upper</th>${L.map(x=>`<th>${fmtD(x.d)}</th>`).join('')}<th class="noprint"></th></tr></thead><tbody>`;
  th+=`<tr><td>น้ำหนัก (kg)</td><td>-</td><td>-</td>${L.map(x=>`<td>${x.wt??'-'}</td>`).join('')}<td class="noprint"></td></tr>`;
  LABS.forEach(li=>{th+=`<tr><td>${li.n}</td><td>${li.lo}</td><td>${li.hi}</td>${L.map(x=>{const v=x[li.k];const[t,c]=labStat(li,v);const showPill=v!=null&&(c==='p-warn'||c==='p-bad');return `<td>${v??'-'} ${showPill?`<span class="pill ${c}">${t}</span>`:''}</td>`}).join('')}<td class="noprint"></td></tr>`});
  if(L.some(x=>x.note)){
    th+=`<tr class="noteRow"><td>📝 หมายเหตุ</td><td></td><td></td>${L.map(x=>`<td>${x.note?('<span title="'+x.note.replace(/"/g,'&quot;')+'">'+x.note+'</span>'):'-'}</td>`).join('')}<td class="noprint"></td></tr>`;
  }
  th+=`<tr class="noprint"><td colspan="3"></td>${L.map(x=>`<td><div class="rowActions"><button class="btn editbtn sm" onclick="editLab('${x.d}')">แก้ไข</button><button class="btn danger" onclick="delLab('${x.d}')">ลบ</button></div></td>`).join('')}<td></td></tr></tbody>`;
  document.getElementById('labTable').innerHTML=th;
}

/* ============================================================
   ECHO HISTORY — render + CRUD
   ============================================================ */
function renderEcho(){
  const E=DB.echo;
  document.getElementById('echoTabs').innerHTML=ECHO_PARAMS.map(p=>`<button class="tab ${p.k===curEcho?'on':''}" onclick="curEcho='${p.k}';render()">${p.n}</button>`).join('');
  const p=ECHO_PARAMS.find(x=>x.k===curEcho)||ECHO_PARAMS[0];
  const bands=[];
  if(p.dir==='high') bands.push({lo:0,hi:p.hi,c:COL.okBg});
  if(p.dir==='low') bands.push({lo:p.lo,hi:9999,c:COL.okBg});
  chart(document.getElementById('echoChart'),{
    h:240,c:COL.mint,
    points:E.map((x,i)=>{
      const v=x[p.k]??null;
      let c=COL.dim;
      if(v!=null){ const st=echoStat(p,v)[1]; c = st==='p-bad'?COL.bad : st==='p-warn'?COL.warn : COL.ok; }
      return {i,v,l:fmtD(x.d),c};
    }),
    bands
  });

  if(!E.length){
    document.getElementById('echoList').innerHTML='<div class="muted" style="text-align:center;padding:14px 4px">ยังไม่มีประวัติ Echo — วางผลจากหมอ/สรุปจาก AI แล้วกด "บันทึกผล Echo" ด้านล่างได้เลยครับ</div>';
    return;
  }

  document.getElementById('echoList').innerHTML = E.slice().reverse().map(x=>{
    const riskPill = x.risk ? `<span class="pill ${x.risk==='high'?'p-bad':x.risk==='moderate'?'p-warn':'p-ok'}">ATE: ${riskLabel(x.risk)}</span>` : '';
    const diagText = diagnosisLabel(x);
    const diagPill = diagText ? `<span class="pill" style="background:var(--notebg);color:var(--note)">${diagText}</span>` : '';
    const metrics = ECHO_PARAMS.map(p=>{
      const v=x[p.k]; if(v==null) return '';
      const[t,c]=echoStat(p,v);
      return `<span class="pill ${c||'p-ok'}" title="${p.n}">${p.n.split(' ')[0]} ${v}${p.u}</span>`;
    }).join(' ');
    return `<div class="echoCard">
      <div class="echoDate">🗓️ ${x.d}${x.vet?(' · '+escapeHtml(x.vet)):''}</div>
      <div style="margin-top:6px">${riskPill} ${diagPill}</div>
      <div class="echoMetrics">${metrics}</div>
      ${x.funcnote?`<div class="echoFuncNote">🔎 ${escapeHtml(x.funcnote)}</div>`:''}
      ${x.fullnote?`<details class="echoDetails" open><summary>📄 ผลเต็มจากหมอ</summary><div class="echoText">${escapeHtml(x.fullnote)}</div></details>`:''}
      ${x.aisummary?`<details class="echoDetails" open><summary>🤖 สรุปจาก AI</summary><div class="echoText">${escapeHtml(x.aisummary)}</div></details>`:''}
      <div class="rowActions noprint" style="margin-top:10px;justify-content:flex-end">
        <button class="btn editbtn sm" onclick="editEcho('${x.d}')">แก้ไข</button>
        <button class="btn danger" onclick="delEcho('${x.d}')">ลบ</button>
      </div>
    </div>`;
  }).join('');
}

let editingEchoDate=null;
function addEcho(){
  const d=document.getElementById('e_date').value;
  if(!d) return alert('เลือกวันที่ตรวจ');
  const g=id=>document.getElementById(id).value===''?null:+document.getElementById(id).value;
  const t=id=>document.getElementById(id).value.trim();
  const o={
    d, vet:t('e_vet'),
    risk:document.getElementById('e_risk').value,
    diag:document.getElementById('e_diag').value,
    diagOther:t('e_diagOther'),
    ivsd:g('e_ivsd'), laao:g('e_laao'), lafs:g('e_lafs'), lvfs:g('e_lvfs'), lvpwd:g('e_lvpwd'),
    funcnote:t('e_funcnote'),
    fullnote:t('e_fullnote'),
    aisummary:t('e_aisummary')
  };
  const i=DB.echo.findIndex(x=>x.d===d);
  i>=0?DB.echo[i]=o:DB.echo.push(o);
  ['e_vet','e_ivsd','e_laao','e_lafs','e_lvfs','e_lvpwd','e_funcnote','e_fullnote','e_aisummary','e_diagOther'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('e_risk').value='';
  document.getElementById('e_diag').value='';
  document.getElementById('e_diagOtherWrap').style.display='none';
  cancelEditEcho(false);
  save(); render();
}
function delEcho(d){
  if(!confirm('ลบผล Echo วันที่ '+d+'?'))return;
  DB.echo=DB.echo.filter(x=>x.d!==d);
  save(); render();
}
function editEcho(d){
  const rec=DB.echo.find(x=>x.d===d); if(!rec)return;
  editingEchoDate=d;
  document.getElementById('e_date').value=rec.d;
  document.getElementById('e_vet').value=rec.vet||'';
  document.getElementById('e_risk').value=rec.risk||'';
  document.getElementById('e_diag').value=rec.diag||'';
  document.getElementById('e_diagOther').value=rec.diagOther||'';
  document.getElementById('e_diagOtherWrap').style.display = rec.diag==='other'?'block':'none';
  document.getElementById('e_ivsd').value=rec.ivsd??'';
  document.getElementById('e_laao').value=rec.laao??'';
  document.getElementById('e_lafs').value=rec.lafs??'';
  document.getElementById('e_lvfs').value=rec.lvfs??'';
  document.getElementById('e_lvpwd').value=rec.lvpwd??'';
  document.getElementById('e_funcnote').value=rec.funcnote||'';
  document.getElementById('e_fullnote').value=rec.fullnote||'';
  document.getElementById('e_aisummary').value=rec.aisummary||'';
  document.getElementById('echoSubmitBtn').textContent='💾 บันทึกการแก้ไข';
  document.getElementById('echoCancelEditBtn').style.display='inline-flex';
  document.getElementById('echoCardSection').scrollIntoView({behavior:'smooth',block:'start'});
}
function cancelEditEcho(resetDate){
  editingEchoDate=null;
  document.getElementById('echoSubmitBtn').textContent='💾 บันทึกผล Echo';
  document.getElementById('echoCancelEditBtn').style.display='none';
  if(resetDate!==false) document.getElementById('e_date').value=iso(Date.now());
}

/* ============================================================
   CURRENT MEDICATIONS — render + CRUD
   Schema: { id, drug, dose, freq, times, startDate, status:'active'|'stopped', stopDate, linkedEcho, note }
   ============================================================ */
function renderMeds(){
  const echoDates=DB.echo.slice().sort((a,b)=>a.d<b.d?1:(a.d>b.d?-1:0)).map(x=>x.d);
  const sel=document.getElementById('m_linkedEcho');
  const curVal=sel.value;
  sel.innerHTML='<option value="">— ไม่เชื่อม —</option>'+echoDates.map(d=>`<option value="${d}">${d}</option>`).join('');
  sel.value=curVal;

  const M=DB.meds.slice();
  const active=M.filter(x=>x.status!=='stopped').sort((a,b)=>a.startDate<b.startDate?1:-1);
  const stopped=M.filter(x=>x.status==='stopped').sort((a,b)=>a.startDate<b.startDate?1:-1);
  const ordered=[...active,...stopped];

  let html=`<thead><tr><th>ชื่อยา</th><th>ขนาด</th><th>ความถี่</th><th>เวลาที่กิน</th><th>เริ่มกิน</th><th>สถานะ</th><th>เชื่อม Echo</th><th style="text-align:left">หมายเหตุ</th><th class="noprint"></th></tr></thead><tbody>`;
  if(!ordered.length){
    html+='<tr><td colspan="9" class="muted">ยังไม่มีรายการยาที่ใช้ประจำ</td></tr>';
  }else{
    ordered.forEach(x=>{
      const rowCls = x.status==='stopped' ? ' class="stoppedRow"' : '';
      const stopInfo = x.status==='stopped' && x.stopDate ? ` (${x.stopDate})` : '';
      html+=`<tr${rowCls}><td style="text-align:left">${escapeHtml(x.drug)}</td><td>${escapeHtml(x.dose)||'-'}</td><td>${escapeHtml(x.freq)||'-'}</td><td>${escapeHtml(x.times)||'-'}</td><td>${x.startDate||'-'}</td><td><span class="pill ${medStatusClass(x.status)}">${medStatusLabel(x.status)}${stopInfo}</span></td><td>${x.linkedEcho||'-'}</td><td style="text-align:left;white-space:normal">${escapeHtml(x.note)||'-'}</td><td class="noprint"><div class="rowActions"><button class="btn editbtn sm" onclick="editMed('${x.id}')">แก้ไข</button><button class="btn danger" onclick="delMed('${x.id}')">ลบ</button></div></td></tr>`;
    });
  }
  html+='</tbody>';
  document.getElementById('medTable').innerHTML=html;
}

let editingMedId=null;
function addMed(){
  const drug=document.getElementById('m_drug').value.trim();
  const startDate=document.getElementById('m_start').value;
  if(!drug||!startDate) return alert('กรอกชื่อยาและวันที่เริ่มกิน');
  const status=document.getElementById('m_status').value;
  const o={
    id: editingMedId || ('m'+Date.now()+Math.random().toString(36).slice(2,7)),
    drug, dose:document.getElementById('m_dose').value.trim(),
    freq:document.getElementById('m_freq').value.trim(),
    times:document.getElementById('m_times').value.trim(),
    startDate, status,
    stopDate: status==='stopped' ? document.getElementById('m_stopDate').value : '',
    linkedEcho:document.getElementById('m_linkedEcho').value,
    note:document.getElementById('m_note').value.trim()
  };
  const i=DB.meds.findIndex(x=>x.id===o.id);
  i>=0?DB.meds[i]=o:DB.meds.push(o);
  ['m_drug','m_dose','m_freq','m_times','m_note'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('m_status').value='active';
  document.getElementById('m_stopWrap').style.display='none';
  document.getElementById('m_linkedEcho').value='';
  cancelEditMed(false);
  save(); render();
}
function delMed(id){
  if(!confirm('ลบรายการยานี้?'))return;
  DB.meds=DB.meds.filter(x=>x.id!==id);
  save(); render();
}
function editMed(id){
  const rec=DB.meds.find(x=>x.id===id); if(!rec)return;
  editingMedId=id;
  document.getElementById('m_drug').value=rec.drug;
  document.getElementById('m_dose').value=rec.dose||'';
  document.getElementById('m_freq').value=rec.freq||'';
  document.getElementById('m_times').value=rec.times||'';
  document.getElementById('m_start').value=rec.startDate||iso(Date.now());
  document.getElementById('m_status').value=rec.status||'active';
  document.getElementById('m_stopWrap').style.display = rec.status==='stopped'?'block':'none';
  document.getElementById('m_stopDate').value=rec.stopDate||'';
  document.getElementById('m_linkedEcho').value=rec.linkedEcho||'';
  document.getElementById('m_note').value=rec.note||'';
  document.getElementById('medSubmitBtn').textContent='💾 บันทึกการแก้ไข';
  document.getElementById('medCancelEditBtn').style.display='inline-flex';
  document.getElementById('m_drug').scrollIntoView({behavior:'smooth',block:'center'});
}
function cancelEditMed(resetDate){
  editingMedId=null;
  document.getElementById('medSubmitBtn').textContent='บันทึก';
  document.getElementById('medCancelEditBtn').style.display='none';
  if(resetDate!==false) document.getElementById('m_start').value=iso(Date.now());
}

/* ---------- RRR actions ---------- */
function addRRR(){
  const d=rDate.value, t=rTime.value||nowTime(), v=+rVal.value;
  if(!d||!v)return alert('กรอกวันที่และค่า RRR');
  const i=DB.rrr.findIndex(x=>x.d===d&&x.t===t);
  const o={d,t,v,note:rNote.value.trim()};
  i>=0?DB.rrr[i]=o:DB.rrr.push(o);
  rVal.value='';rNote.value='';
  save();render();checkEmergency(false);
}
function delRRR(d,t){DB.rrr=DB.rrr.filter(x=>!(x.d===d&&x.t===t));save();render()}

let editingLabDate=null;
function addLab(){
  const d=lDate.value;if(!d)return alert('เลือกวันที่');
  const g=id=>document.getElementById(id).value===''?null:+document.getElementById(id).value;
  const o={d,wt:g('l_wt'),cre:g('l_cre'),bun:g('l_bun'),alt:g('l_alt'),note:document.getElementById('l_note').value.trim()};
  const i=DB.labs.findIndex(x=>x.d===d);i>=0?DB.labs[i]=Object.assign({},DB.labs[i],o):DB.labs.push(o);
  ['l_wt','l_cre','l_bun','l_alt','l_note'].forEach(x=>document.getElementById(x).value='');
  cancelEditLab(false);
  save();render();
}
function delLab(d){if(!confirm('ลบผลตรวจวันที่ '+d+'?'))return;DB.labs=DB.labs.filter(x=>x.d!==d);save();render()}

function editLab(d){
  const rec=DB.labs.find(x=>x.d===d);
  if(!rec)return;
  editingLabDate=d;
  document.getElementById('lDate').value=rec.d;
  document.getElementById('l_wt').value=rec.wt??'';
  document.getElementById('l_cre').value=rec.cre??'';
  document.getElementById('l_bun').value=rec.bun??'';
  document.getElementById('l_alt').value=rec.alt??'';
  document.getElementById('l_note').value=rec.note||'';
  document.getElementById('labSubmitBtn').textContent='💾 บันทึกการแก้ไข';
  document.getElementById('labCancelEditBtn').style.display='inline-flex';
  document.getElementById('labFormArea').scrollIntoView({behavior:'smooth',block:'center'});
}
function cancelEditLab(resetDate){
  editingLabDate=null;
  document.getElementById('labSubmitBtn').textContent='บันทึกผล';
  document.getElementById('labCancelEditBtn').style.display='none';
  if(resetDate!==false){
    ['l_wt','l_cre','l_bun','l_alt','l_note'].forEach(x=>document.getElementById(x).value='');
    document.getElementById('lDate').value=iso(Date.now());
  }
}

/* ---------- Recorder (big tap button + progress ring) ---------- */
let recDur=30, taps=0, t0=null, tick=null;
const CIRC=2*Math.PI*90;
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
function setProgress(elapsedSec){ progressCircle.style.strokeDashoffset = CIRC*(1-Math.min(1, elapsedSec/recDur)); }

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
      capLabelEl.textContent='กำลังนับ... เหลือ '+Math.max(0,Math.ceil(recDur-elapsed))+' วิ';
      if(elapsed>=recDur){
        clearInterval(tick); tick=null;
        document.getElementById('tapRate').textContent=Math.round(taps*60/recDur);
        recBtn.classList.remove('rec'); ring.classList.remove('isRec');
        capLabelEl.textContent='เสร็จแล้ว 🎉 แตะรีเซ็ตเพื่อเริ่มใหม่';
        setProgress(recDur); t0=null;
      }
    },100);
  }
  taps++; tapCountEl.textContent=taps;
});
function resetTap(){
  clearInterval(tick); tick=null; t0=null; taps=0;
  tapCountEl.textContent='0'; document.getElementById('tapRate').textContent='–';
  recBtn.classList.remove('rec'); ring.classList.remove('isRec');
  capLabelEl.textContent='แตะทุกจังหวะหายใจ'; setProgress(0);
}
function useTap(){
  const r=document.getElementById('tapRate').textContent;
  if(r==='–')return alert('นับให้ครบเวลาก่อนครับ');
  rDate.value=iso(Date.now()); rTime.value=nowTime(); rVal.value=r; addRRR(); resetTap();
}

/* ---------- OCR ---------- */
async function handleOcrUpload(inp){
  const f=inp.files[0]; if(!f) return;
  const url=URL.createObjectURL(f);
  const row=document.getElementById('ocrPreviewRow'), thumb=document.getElementById('ocrThumb'), status=document.getElementById('ocrStatus');
  row.style.display='flex'; thumb.src=url; status.className='ocrStatus';
  status.innerHTML='<span class="spinner"></span>กำลังอ่านค่าจากรูป... (อาจใช้เวลา 10–30 วิ)';
  try{
    const { data } = await Tesseract.recognize(f, 'eng', { logger:()=>{} });
    const found = parseLabText(data.text || '');
    const parts=[];
    if(found.cre!=null){ document.getElementById('l_cre').value=found.cre; parts.push('Creatinine='+found.cre); }
    if(found.bun!=null){ document.getElementById('l_bun').value=found.bun; parts.push('BUN='+found.bun); }
    if(found.alt!=null){ document.getElementById('l_alt').value=found.alt; parts.push('ALT='+found.alt); }
    if(found.wt!=null){ document.getElementById('l_wt').value=found.wt; parts.push('น้ำหนัก='+found.wt); }
    if(parts.length){
      status.innerHTML = '✅ อ่านได้: '+parts.join(' · ')+' — <b>กรุณาตรวจสอบก่อนกดบันทึกผล</b>';
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
  const grab = (patterns)=>{ for(const p of patterns){ const m=text.match(p); if(m) return parseFloat(m[1]); } return null; };
  const cre = grab([new RegExp('creatinine[^0-9]{0,10}'+num,'i'),new RegExp('\\bcre2?\\b[^0-9]{0,10}'+num,'i'),new RegExp('\\bcrea\\b[^0-9]{0,10}'+num,'i')]);
  const bun = grab([new RegExp('bun[^0-9]{0,10}'+num,'i')]);
  const alt = grab([new RegExp('alt\\s*/?\\s*gpt[^0-9]{0,10}'+num,'i'),new RegExp('\\balt\\b[^0-9]{0,10}'+num,'i'),new RegExp('\\bgpt\\b[^0-9]{0,10}'+num,'i')]);
  const wt = grab([new RegExp('weight[^0-9]{0,10}'+num+'\\s*kg','i'),new RegExp('body\\s*weight[^0-9]{0,10}'+num,'i'),new RegExp('\\bbw\\b[^0-9]{0,10}'+num,'i'),new RegExp(num+'\\s*kg\\b','i')]);
  return {cre,bun,alt,wt};
}

/* io */
function dl(name,txt,type){const b=new Blob([txt],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
function exportJSON(){dl('taro_health_'+iso(Date.now())+'.json',JSON.stringify(DB,null,2),'application/json')}
function exportCSV(){
  let c='\ufeffLABS\ndate,weight,creatinine,bun,alt,note\n'+DB.labs.map(x=>[x.d,x.wt??'',x.cre??'',x.bun??'',x.alt??'','"'+(x.note||'')+'"'].join(',')).join('\n');
  c+='\n\nRRR\ndate,time,rate,status,note\n'+DB.rrr.map(x=>[x.d,x.t,x.v,rrrStat(x.v)[0],'"'+(x.note||'')+'"'].join(',')).join('\n');
  c+='\n\nECHO\ndate,vet,ivsd,laao,lafs,lvfs,lvpwd,risk,diagnosis,funcnote,fullnote,aisummary\n'+DB.echo.map(x=>[x.d,'"'+(x.vet||'')+'"',x.ivsd??'',x.laao??'',x.lafs??'',x.lvfs??'',x.lvpwd??'',riskLabel(x.risk),'"'+diagnosisLabel(x)+'"','"'+(x.funcnote||'')+'"','"'+(x.fullnote||'').replace(/"/g,'""')+'"','"'+(x.aisummary||'').replace(/"/g,'""')+'"'].join(',')).join('\n');
  c+='\n\nCURRENT_MEDICATIONS\ndrug,dose,frequency,times,start_date,status,stop_date,linked_echo,note\n'+DB.meds.map(x=>[
    '"'+x.drug+'"','"'+(x.dose||'')+'"','"'+(x.freq||'')+'"','"'+(x.times||'')+'"',x.startDate||'',medStatusLabel(x.status),x.stopDate||'',x.linkedEcho||'','"'+(x.note||'')+'"'
  ].join(',')).join('\n');
  dl('taro_health_'+iso(Date.now())+'.csv',c,'text/csv');
}
function importJSON(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();
  r.onload=e=>{try{
    const j=JSON.parse(e.target.result);
    if(!j.labs||!j.rrr)throw 0;
    j.rrr.forEach(x=>{if(!x.t)x.t='08:00';});
    j.labs.forEach(x=>{if(x.note==null)x.note='';});
    if(!j.echo)j.echo=[];
    if(!j.meds)j.meds=[];
    DB=j; migrateMedsSchema();
    save();render();alert('นำเข้าสำเร็จ');
  }catch(err){alert('ไฟล์ไม่ถูกต้อง')}};r.readAsText(f);
}

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
    '<div class="modalBox"><div class="modalBody"><h3 style="color:var(--ink)">⚠️ ยังไม่ได้ตั้งค่า Firebase</h3>'+
    '<p>เปิดไฟล์ <code>firebase-config.js</code> แล้วใส่ค่าจาก Firebase Console ของคุณ ดูขั้นตอนใน README.md</p>'+
    '<button class="btn accent" style="width:100%" onclick="location.reload()">ลองใหม่</button></div></div>';
}

function togglePinVisibility(){ pinInput.type = document.getElementById('pinShowChk').checked ? 'text' : 'password'; }
async function sha256Hex(text){
  const enc=new TextEncoder().encode(text);
  const buf=await crypto.subtle.digest('SHA-256',enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function setSync(state){
  syncDot.className='syncdot '+state;
  syncText.textContent = state==='on'?'ซิงค์แล้ว':state==='busy'?'กำลังซิงค์...':'ออฟไลน์';
}
function migrateRemote(data){
  data.rrr.forEach(x=>{if(!x.t)x.t='08:00';});
  data.labs.forEach(x=>{if(x.note==null)x.note='';});
  if(!data.echo) data.echo=[];
  if(!data.meds) data.meds=[];
  return data;
}
async function connectToFamily(docId){
  currentDocId=docId; firstSnapshot=true;
  document.getElementById('authModal').style.display='none';
  document.getElementById('appRoot').style.display='block';
  setSync('busy');
  if(unsub){unsub();unsub=null}
  const ref=db.collection('family').doc(docId);
  unsub = ref.onSnapshot(snap=>{
    if(snap.exists){
      const data=snap.data();
      if(data && data.labs && data.rrr){
        applyingRemote=true; DB=migrateRemote(data); migrateMedsSchema(); localStorage.setItem(KEY,JSON.stringify(DB)); render(); applyingRemote=false;
        checkEmergency(!firstSnapshot);
      }
    }else{ ref.set(DB); }
    firstSnapshot=false; setSync('on');
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
  authSubmit.disabled=false; authSubmit.textContent='เข้าใช้งาน';
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
      try{ if(!user){ await auth.signInAnonymously(); } connectToFamily(savedDocId); }
      catch(e){ document.getElementById('appRoot').style.display='none'; document.getElementById('authModal').style.display='flex'; }
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
    db.collection('family').doc(currentDocId).set(DB).then(()=>setSync('on')).catch(()=>setSync('off'));
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
