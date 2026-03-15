import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════
const GATES = { A: { rows: [10,10,7], label: "A", color: "#4da6ff" }, B: { rows: [11,11,11], label: "B", color: "#ffb347" }, C: { rows: [10,10,7], label: "C", color: "#5ce0b8" } };
const TOTAL = 87;
const GK = ["A","B","C"];
const ROW_NAMES = ["Row 1","Row 2","Row 3"];
const RIDE_DURATION = 28; // seconds
const UNLOAD_DURATION = 4;

const DIFFS = {
  easy:   { label:"Easy",   desc:"Slow arrivals · No countdown", groupMax:6,  sbRate:3500, llRate:6000, countdown:0, color:"#22c55e" },
  normal: { label:"Normal", desc:"Steady flow · Standard ops",   groupMax:10, sbRate:2200, llRate:4000, countdown:0, color:"#eab308" },
  hard:   { label:"Hard",   desc:"Rush hour · Guest patience drains", groupMax:10, sbRate:1400, llRate:2800, countdown:0, color:"#ef4444" },
};

const ACHIEVEMENTS = [
  { id:"perfect",  icon:"✦", title:"Perfect Flight",    desc:"100% occupancy on a theater" },
  { id:"speed",    icon:"⚡", title:"Speed Demon",       desc:"Dispatch in under 25 seconds" },
  { id:"triple",   icon:"🎯", title:"Triple Dispatch",   desc:"All 3 theaters riding at once" },
  { id:"split",    icon:"✂", title:"Split Decision",    desc:"Use the split mechanic" },
  { id:"ten",      icon:"👑", title:"CM of the Month",   desc:"Dispatch 10 flights total" },
  { id:"twenty",   icon:"💎", title:"Veteran Operator",  desc:"Dispatch 20 flights total" },
  { id:"streak",   icon:"🔥", title:"Hot Streak",        desc:"3 flights over 90% in a row" },
  { id:"served500",icon:"🎖", title:"500 Guests Served", desc:"Seat 500 total guests" },
];

// ═══════════════════════════════════════
// AUDIO
// ═══════════════════════════════════════
let _ctx = null;
const getCtx = () => { if(!_ctx) _ctx = new (window.AudioContext||window.webkitAudioContext)(); if(_ctx.state==="suspended") _ctx.resume(); return _ctx; };
const playTone = (f,d,t="sine",v=0.1) => { try { const c=getCtx(),o=c.createOscillator(),g=c.createGain(); o.type=t; o.frequency.value=f; g.gain.setValueAtTime(v,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+d); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+d); } catch{} };
const SFX = {
  select: ()=>playTone(880,.08,"sine",.07),
  place: ()=>playTone(660,.12,"triangle",.09),
  rowFull: ()=>{playTone(880,.15,"sine",.09);setTimeout(()=>playTone(1100,.2,"sine",.09),100)},
  error: ()=>playTone(220,.2,"sawtooth",.05),
  split: ()=>{playTone(600,.08,"triangle",.07);setTimeout(()=>playTone(800,.08,"triangle",.07),80)},
  depart: ()=>{[523,659,784,1047].forEach((f,i)=>setTimeout(()=>playTone(f,.3,"sine",.09),i*150))},
  achieve: ()=>{[784,988,1175,1318].forEach((f,i)=>setTimeout(()=>playTone(f,.25,"triangle",.08),i*120))},
  merge: ()=>playTone(520,.1,"triangle",.06),
  route: ()=>{playTone(440,.08,"sine",.06);setTimeout(()=>playTone(660,.1,"sine",.07),70)},
  tabSwitch: ()=>playTone(1000,.05,"sine",.04),
};

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
let _gid = 0;
const mkGroup = (max) => ({ id: `g${++_gid}`, size: Math.floor(Math.random()*max)+1, ts: Date.now() });
const mkSeats = () => { const s={}; GK.forEach(k=>{s[k]=GATES[k].rows.map(c=>({capacity:c,filled:0}))}); return s; };
const fmt = (ms) => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`; };
const seatsFilled = (seats) => GK.reduce((t,k)=>t+seats[k].reduce((a,r)=>a+r.filled,0),0);
const getStars = (pct) => pct>=97?5:pct>=93?4:pct>=85?3:pct>=70?2:1;

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function SoarinOps() {
  const [diff, setDiff] = useState(null);
  const [sbQueue, setSbQueue] = useState([]);
  const [llQueue, setLlQueue] = useState([]);
  const [theaters, setTheaters] = useState([
    { status:"empty", seats:mkSeats(), holding:[], rideTimer:0, flightsCompleted:0, loadStart:0, lastPct:0 },
    { status:"empty", seats:mkSeats(), holding:[], rideTimer:0, flightsCompleted:0, loadStart:0, lastPct:0 },
    { status:"empty", seats:mkSeats(), holding:[], rideTimer:0, flightsCompleted:0, loadStart:0, lastPct:0 },
  ]);
  const [activeT, setActiveT] = useState(0);
  const [sel, setSel] = useState(null);
  const [splitting, setSplitting] = useState(false);
  const [hover, setHover] = useState(null);
  const [msg, setMsg] = useState(null);
  const [flash, setFlash] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [totalSeated, setTotalSeated] = useState(0);
  const [totalFlights, setTotalFlights] = useState(0);
  const [unlocked, setUnlocked] = useState([]);
  const [newAch, setNewAch] = useState([]);
  const [usedSplit, setUsedSplit] = useState(false);
  const [streak, setStreak] = useState(0);
  const [showKeys, setShowKeys] = useState(false);
  const [showAch, setShowAch] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const mt = useRef(null);
  const toast = useCallback((t,type="info")=>{ clearTimeout(mt.current); setMsg({text:t,type}); mt.current=setTimeout(()=>setMsg(null),2200); },[]);

  const curTheater = theaters[activeT];
  const curFilled = seatsFilled(curTheater.seats);
  const curPct = Math.round((curFilled/TOTAL)*100);
  const selGroup = curTheater.holding.find(g=>g.id===sel);

  // ─── MAIN TICK ───
  useEffect(()=>{
    if(!running||paused||!diff) return;
    const iv = setInterval(()=>{
      setElapsed(p=>p+100);
      setTheaters(prev=>prev.map(th=>{
        if(th.status==="riding") {
          const nt = th.rideTimer - 0.1;
          if(nt<=0) return {...th, status:"unloading", rideTimer: UNLOAD_DURATION };
          return {...th, rideTimer: Math.max(0,+(nt).toFixed(1))};
        }
        if(th.status==="unloading") {
          const nt = th.rideTimer - 0.1;
          if(nt<=0) return {...th, status:"empty", seats:mkSeats(), holding:[], rideTimer:0 };
          return {...th, rideTimer: Math.max(0,+(nt).toFixed(1))};
        }
        return th;
      }));
    },100);
    return ()=>clearInterval(iv);
  },[running,paused,diff]);

  // ─── GUEST ARRIVAL ───
  useEffect(()=>{
    if(!running||paused||!diff) return;
    const d = DIFFS[diff];
    const sbIv = setInterval(()=>{ setSbQueue(p=>p.length<25?[...p,mkGroup(d.groupMax)]:p); }, d.sbRate);
    const llIv = setInterval(()=>{ setLlQueue(p=>p.length<15?[...p,mkGroup(Math.min(d.groupMax,6))]:p); }, d.llRate);
    return ()=>{clearInterval(sbIv);clearInterval(llIv)};
  },[running,paused,diff]);

  // ─── START ───
  const startGame = (d) => {
    _gid=0;
    setDiff(d); setRunning(true); setPaused(false); setElapsed(0);
    setSbQueue(Array.from({length:8},()=>mkGroup(DIFFS[d].groupMax)));
    setLlQueue(Array.from({length:4},()=>mkGroup(Math.min(DIFFS[d].groupMax,6))));
    setTheaters([
      {status:"empty",seats:mkSeats(),holding:[],rideTimer:0,flightsCompleted:0,loadStart:0,lastPct:0},
      {status:"empty",seats:mkSeats(),holding:[],rideTimer:0,flightsCompleted:0,loadStart:0,lastPct:0},
      {status:"empty",seats:mkSeats(),holding:[],rideTimer:0,flightsCompleted:0,loadStart:0,lastPct:0},
    ]);
    setActiveT(0); setSel(null); setSplitting(false);
    setTotalSeated(0); setTotalFlights(0); setUsedSplit(false); setStreak(0);
    setNewAch([]);
  };

  // ─── MERGE: release from SB/LL to active theater holding ───
  const releaseSB = () => {
    if(paused||curTheater.status==="riding"||curTheater.status==="unloading") return;
    if(sbQueue.length===0){ toast("Standby queue empty","error"); return; }
    const batch = sbQueue.slice(0,3);
    setSbQueue(p=>p.slice(batch.length));
    if(curTheater.status==="empty") {
      setTheaters(p=>p.map((th,i)=>i===activeT?{...th,status:"loading",holding:[...th.holding,...batch],loadStart:elapsed}:th));
    } else {
      setTheaters(p=>p.map((th,i)=>i===activeT?{...th,holding:[...th.holding,...batch]}:th));
    }
    SFX.merge(); toast(`+${batch.length} groups from Standby → Theater ${activeT+1}`,"success");
  };

  const releaseLL = () => {
    if(paused||curTheater.status==="riding"||curTheater.status==="unloading") return;
    if(llQueue.length===0){ toast("Lightning Lane empty","error"); return; }
    const batch = llQueue.slice(0,2);
    setLlQueue(p=>p.slice(batch.length));
    if(curTheater.status==="empty") {
      setTheaters(p=>p.map((th,i)=>i===activeT?{...th,status:"loading",holding:[...th.holding,...batch],loadStart:elapsed}:th));
    } else {
      setTheaters(p=>p.map((th,i)=>i===activeT?{...th,holding:[...th.holding,...batch]}:th));
    }
    SFX.merge(); toast(`+${batch.length} groups from LL → Theater ${activeT+1}`,"success");
  };

  // ─── SELECT GROUP FROM HOLDING ───
  const pickGroup = (g) => {
    if(paused||curTheater.status!=="loading") return;
    setSplitting(false);
    setSel(sel===g.id?null:g.id); if(sel!==g.id) SFX.select();
  };

  // ─── PLACE IN ROW ───
  const placeInRow = (gk,ri) => {
    if(!selGroup||paused||curTheater.status!=="loading") return;
    const row = curTheater.seats[gk][ri];
    const left = row.capacity - row.filled;
    if(selGroup.size>left){ SFX.error(); toast(`Group of ${selGroup.size} doesn't fit! ${left} left.`,"error"); return; }
    setFlash(`${gk}${ri}`); setTimeout(()=>setFlash(null),500);
    const newFilled = row.filled + selGroup.size;
    const rowFull = newFilled === row.capacity;
    setTheaters(p=>p.map((th,i)=>{
      if(i!==activeT) return th;
      const newSeats = {};
      GK.forEach(k=>{ newSeats[k]=th.seats[k].map((r,idx)=> k===gk&&idx===ri ? {...r,filled:r.filled+selGroup.size} : {...r}); });
      return {...th, seats:newSeats, holding:th.holding.filter(g=>g.id!==selGroup.id)};
    }));
    setTotalSeated(p=>p+selGroup.size);
    if(rowFull) SFX.rowFull(); else SFX.place();
    toast(`+${selGroup.size} → ${GATES[gk].label}${ri+1}`,"success");
    setSel(null); setSplitting(false);
  };

  // ─── SPLIT ───
  const doSplit = (n) => {
    if(!selGroup||paused) return;
    SFX.split(); setUsedSplit(true);
    setTheaters(p=>p.map((th,i)=>{
      if(i!==activeT) return th;
      const idx = th.holding.findIndex(g=>g.id===selGroup.id);
      const nh = [...th.holding];
      nh.splice(idx,1, {id:`${Date.now()}-sa`,size:n}, {id:`${Date.now()}-sb`,size:selGroup.size-n});
      return {...th, holding:nh};
    }));
    setSel(null); setSplitting(false); toast(`Split ${selGroup.size} → ${n}+${selGroup.size-n}`,"info");
  };

  // ─── DISPATCH ───
  const dispatch = () => {
    if(curTheater.status!=="loading"||paused) return;
    const pct = Math.round((seatsFilled(curTheater.seats)/TOTAL)*100);
    SFX.depart();
    const loadTime = elapsed - curTheater.loadStart;

    setTheaters(p=>p.map((th,i)=>i===activeT?{
      ...th, status:"riding", rideTimer:RIDE_DURATION, holding:[],
      flightsCompleted:th.flightsCompleted+1, lastPct:pct,
    }:th));

    const tf = totalFlights+1;
    setTotalFlights(tf);
    const ns = pct>=90 ? streak+1 : 0;
    setStreak(ns);

    // Check if all 3 riding (after this dispatch)
    const allRiding = theaters.filter(t=>t.status==="riding").length===2; // this one will be 3rd

    // Achievements
    const ctx = { pct, loadTime, tf, ns, usedSplit, allRiding, totalSeated };
    const checks = [
      { id:"perfect", c: pct>=100 },
      { id:"speed", c: pct>=80 && loadTime<25000 },
      { id:"triple", c: allRiding },
      { id:"split", c: usedSplit },
      { id:"ten", c: tf>=10 },
      { id:"twenty", c: tf>=20 },
      { id:"streak", c: ns>=3 },
      { id:"served500", c: totalSeated>=500 },
    ];
    const fresh = checks.filter(a=>a.c&&!unlocked.includes(a.id)).map(a=>a.id);
    if(fresh.length>0){
      SFX.achieve();
      setUnlocked(p=>[...p,...fresh]);
      setNewAch(ACHIEVEMENTS.filter(a=>fresh.includes(a.id)));
      setTimeout(()=>setNewAch([]),4000);
    }
    if(pct>=95){ setConfetti(true); setTimeout(()=>setConfetti(false),3500); }

    // Switch to next empty theater
    const nextEmpty = theaters.findIndex((t,i)=>i!==activeT&&(t.status==="empty"||t.status==="loading"));
    if(nextEmpty>=0) { setActiveT(nextEmpty); SFX.tabSwitch(); }
  };

  // ─── KEYBOARD ───
  useEffect(()=>{
    if(!diff) return;
    const h = (e)=>{
      const k = e.key.toLowerCase();
      if(k===" "){e.preventDefault();if(running)setPaused(p=>!p);return;}
      if(k==="escape"){setSel(null);setSplitting(false);return;}
      if(k==="s"&&selGroup&&selGroup.size>=2&&!paused){setSplitting(p=>!p);return;}
      if(k==="q"&&!paused){releaseSB();return;}
      if(k==="l"&&!paused){releaseLL();return;}
      if(k==="d"&&!paused){dispatch();return;}
      if(["1","2","3"].includes(k)&&!sel&&!splitting){
        const ti=parseInt(k)-1;
        if(ti!==activeT){setActiveT(ti);SFX.tabSwitch();setSel(null);setSplitting(false);}
        return;
      }
      if(/^[1-9]$/.test(k)&&splitting&&selGroup){const n=parseInt(k);if(n>=1&&n<selGroup.size)doSplit(n);return;}
      if(/^[0-9]$/.test(k)&&!splitting&&curTheater.status==="loading"){
        const idx=k==="0"?9:parseInt(k)-1;
        if(idx<curTheater.holding.length&&!paused){
          const g=curTheater.holding[idx];
          setSel(sel===g.id?null:g.id);if(sel!==g.id)SFX.select();setSplitting(false);
        }
        return;
      }
    };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  });

  const occColor = (p)=>p>=95?"#22c55e":p>=80?"#eab308":p>=50?"#f97316":"#ef4444";

  // ═══════════════════════════════════════
  // MENU
  // ═══════════════════════════════════════
  if(!diff) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(170deg,#060b1e 0%,#0b1530 30%,#0e1a3d 60%,#111f48 100%)",color:"#fff",fontFamily:"'Avenir Next','Segoe UI',sans-serif",padding:24}}>
      <style>{`@keyframes fin{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{marginBottom:8,animation:"fin .6s ease"}}>
        <svg width={240} height={132} viewBox="0 0 360 200" fill="none">
          <path d="M30 170 Q180 20 330 170" stroke="url(#dg1)" strokeWidth="3" fill="none" opacity=".5"/>
          <g transform="translate(130,55)"><path d="M50 10 L0 35 L50 28 L100 35 Z" fill="url(#gg)" opacity=".9"/><ellipse cx="50" cy="32" rx="3" ry="6" fill="#ffffffcc"/></g>
          <text x="180" y="120" textAnchor="middle" fontFamily="Georgia,serif" fontSize="38" fontWeight="bold" fill="url(#tg)" letterSpacing="4">SOARIN'</text>
          <text x="180" y="146" textAnchor="middle" fontSize="10" fill="#a0c4ff" letterSpacing="5" fontWeight="600">OPERATIONS SIMULATOR</text>
          <rect x="128" y="158" width="104" height="20" rx="10" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.12)" strokeWidth="1"/>
          <text x="180" y="172" textAnchor="middle" fontFamily="monospace" fontSize="9" fill="#a0c4ff90" letterSpacing="2">3-THEATER MODE</text>
          <defs>
            <linearGradient id="dg1" x1="30" y1="170" x2="330" y2="170"><stop offset="0%" stopColor="#4da6ff" stopOpacity=".3"/><stop offset="50%" stopColor="#ffb347" stopOpacity=".6"/><stop offset="100%" stopColor="#5ce0b8" stopOpacity=".3"/></linearGradient>
            <linearGradient id="gg" x1="0" y1="10" x2="100" y2="35"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#34d399"/></linearGradient>
            <linearGradient id="tg" x1="80" y1="100" x2="280" y2="130"><stop offset="0%" stopColor="#e0f0ff"/><stop offset="50%" stopColor="#fff"/><stop offset="100%" stopColor="#c0e8ff"/></linearGradient>
          </defs>
        </svg>
      </div>
      <div style={{fontSize:12,color:"rgba(255,255,255,.35)",letterSpacing:2,marginBottom:20,textAlign:"center",maxWidth:400,lineHeight:1.7}}>
        Manage the merge point, route guests to 3 theaters, load the gates, and dispatch flights — all simultaneously.
      </div>
      <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"center",marginBottom:24}}>
        {Object.entries(DIFFS).map(([key,d])=>(
          <div key={key} onClick={()=>startGame(key)} style={{width:170,padding:"18px 14px",borderRadius:14,cursor:"pointer",background:"rgba(255,255,255,.03)",border:`1.5px solid ${d.color}30`,textAlign:"center",transition:"all .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=d.color;e.currentTarget.style.background=`${d.color}10`}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=`${d.color}30`;e.currentTarget.style.background="rgba(255,255,255,.03)"}}>
            <div style={{fontSize:18,fontWeight:900,color:d.color,letterSpacing:2,marginBottom:4}}>{d.label.toUpperCase()}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",lineHeight:1.5}}>{d.desc}</div>
          </div>
        ))}
      </div>
      {unlocked.length>0&&(<div style={{textAlign:"center"}}><div style={{fontSize:9,color:"rgba(255,255,255,.3)",letterSpacing:2,marginBottom:6}}>ACHIEVEMENTS</div><div style={{display:"flex",gap:4,justifyContent:"center",flexWrap:"wrap"}}>{ACHIEVEMENTS.filter(a=>unlocked.includes(a.id)).map(a=>(<span key={a.id} title={a.title} style={{fontSize:16,padding:"3px 6px",borderRadius:5,background:"rgba(255,255,255,.05)"}}>{a.icon}</span>))}</div></div>)}
      <div style={{marginTop:16,fontSize:10,color:"rgba(255,255,255,.2)",textAlign:"center",lineHeight:1.8}}>
        <span style={{color:"rgba(255,255,255,.35)"}}>Q</span> release standby · <span style={{color:"rgba(255,255,255,.35)"}}>L</span> release LL · <span style={{color:"rgba(255,255,255,.35)"}}>1/2/3</span> switch theater · <span style={{color:"rgba(255,255,255,.35)"}}>D</span> dispatch · <span style={{color:"rgba(255,255,255,.35)"}}>S</span> split · <span style={{color:"rgba(255,255,255,.35)"}}>Space</span> pause
      </div>
    </div>
  );

  // ═══════════════════════════════════════
  // GAME SCREEN
  // ═══════════════════════════════════════
  const statusColor = {empty:"rgba(255,255,255,.2)",loading:"#eab308",riding:"#22c55e",unloading:"#60a5fa"};
  const statusLabel = {empty:"EMPTY",loading:"LOADING",riding:"IN FLIGHT",unloading:"CLEARING"};

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(170deg,#060b1e 0%,#0b1530 25%,#0e1a3d 50%,#111f48 100%)",color:"#fff",fontFamily:"'Avenir Next','Segoe UI',sans-serif",position:"relative",overflow:"hidden"}}>
      <style>{`
        @keyframes fin{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spulse{0%,100%{box-shadow:0 0 0 0 rgba(255,179,71,.4)}50%{box-shadow:0 0 0 5px rgba(255,179,71,0)}}
        @keyframes cfall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
        @keyframes achIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
        @keyframes rideGlow{0%,100%{opacity:.6}50%{opacity:1}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
      `}</style>

      {confetti&&<div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:999,overflow:"hidden"}}>{Array.from({length:50}).map((_,i)=>(<div key={i} style={{position:"absolute",left:`${(i*31+7)%100}%`,top:-20,width:6+(i%4)*2,height:6+(i%3)*2,background:["#4da6ff","#ffb347","#5ce0b8","#ef4444","#a78bfa"][i%5],borderRadius:i%2?"50%":"2px",animation:`cfall ${1.8+(i%10)*.22}s ease-in forwards`,animationDelay:`${(i%8)*.1}s`}}/>))}</div>}

      {/* New achievement toast */}
      {newAch.length>0&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:998,display:"flex",gap:8,animation:"achIn .4s ease"}}>
        {newAch.map(a=><div key={a.id} style={{padding:"8px 14px",borderRadius:10,background:"rgba(251,191,36,.12)",border:"1px solid rgba(251,191,36,.3)",textAlign:"center"}}>
          <span style={{fontSize:20}}>{a.icon}</span><div style={{fontSize:11,fontWeight:800,color:"#fbbf24"}}>{a.title}</div>
        </div>)}
      </div>}

      <div style={{position:"relative",zIndex:1,maxWidth:1200,margin:"0 auto",padding:"10px 12px 40px"}}>

        {/* HEADER */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div onClick={()=>{if(!running||paused){setDiff(null);setRunning(false)}}} style={{cursor:"pointer",fontSize:10,color:"rgba(255,255,255,.3)",letterSpacing:1}}>← MENU</div>
          <div style={{textAlign:"center",fontSize:16,fontWeight:900,letterSpacing:3,background:"linear-gradient(90deg,#e0f0ff,#fff,#c0e8ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>SOARIN' OPS</div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <div onClick={()=>setShowKeys(!showKeys)} style={{cursor:"pointer",fontSize:10,border:"1px solid rgba(255,255,255,.1)",borderRadius:5,padding:"2px 6px",color:"rgba(255,255,255,.4)"}}>⌨</div>
            <div onClick={()=>setShowAch(!showAch)} style={{cursor:"pointer",fontSize:12,border:"1px solid rgba(255,255,255,.1)",borderRadius:5,padding:"2px 6px"}}>🏆<span style={{fontSize:10,color:"rgba(255,255,255,.4)",marginLeft:2}}>{unlocked.length}</span></div>
            <div style={{fontSize:10,fontWeight:800,color:DIFFS[diff].color,border:`1px solid ${DIFFS[diff].color}40`,borderRadius:5,padding:"2px 8px"}}>{DIFFS[diff].label.toUpperCase()}</div>
          </div>
        </div>

        {/* STATS ROW */}
        <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:8}}>
          {[
            {label:paused?"PAUSED":"ELAPSED",val:fmt(elapsed),color:paused?"#ffb347":"#60a5fa"},
            {label:"FLIGHTS",val:totalFlights,color:"#fff"},
            {label:"GUESTS SERVED",val:totalSeated,color:"#fff"},
            {label:"SB QUEUE",val:sbQueue.length,color:sbQueue.length>20?"#ef4444":"#fff"},
            {label:"LL QUEUE",val:llQueue.length,color:llQueue.length>12?"#ef4444":"#fff"},
          ].map((s,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,.03)",borderRadius:8,padding:"4px 14px",border:"1px solid rgba(255,255,255,.05)",textAlign:"center",minWidth:70}}>
              <div style={{fontSize:8,fontWeight:700,color:"rgba(255,255,255,.3)",letterSpacing:1.5}}>{s.label}</div>
              <div style={{fontSize:16,fontWeight:800,fontFamily:"monospace",color:s.color}}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* TOAST */}
        {msg&&<div style={{textAlign:"center",marginBottom:6,animation:"fin .15s ease"}}><span style={{display:"inline-block",padding:"5px 14px",borderRadius:6,fontSize:12,fontWeight:700,background:msg.type==="error"?"rgba(239,68,68,.15)":msg.type==="success"?"rgba(34,197,94,.12)":"rgba(96,165,250,.12)",color:msg.type==="error"?"#fca5a5":msg.type==="success"?"#86efac":"#93c5fd",border:`1px solid ${msg.type==="error"?"rgba(239,68,68,.2)":msg.type==="success"?"rgba(34,197,94,.2)":"rgba(96,165,250,.2)"}`}}>{msg.text}</span></div>}

        {/* MAIN LAYOUT: 3 columns */}
        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>

          {/* LEFT: QUEUE PANEL */}
          <div style={{width:145,flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
            {/* Standby */}
            <div style={{background:"rgba(255,255,255,.025)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)",padding:"8px 8px 6px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1}}>STANDBY</span>
                <span style={{fontSize:13,fontWeight:800,fontFamily:"monospace",color:sbQueue.length>20?"#ef4444":"rgba(255,255,255,.6)"}}>{sbQueue.length}</span>
              </div>
              {/* Mini group preview */}
              <div style={{display:"flex",flexWrap:"wrap",gap:2,marginBottom:6,minHeight:20}}>
                {sbQueue.slice(0,12).map((g,i)=>(
                  <div key={g.id} style={{width:16,height:16,borderRadius:3,background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:"rgba(255,255,255,.5)",fontFamily:"monospace"}}>{g.size}</div>
                ))}
                {sbQueue.length>12&&<div style={{fontSize:8,color:"rgba(255,255,255,.25)",alignSelf:"center"}}>+{sbQueue.length-12}</div>}
              </div>
              <button onClick={releaseSB} disabled={paused||curTheater.status==="riding"||curTheater.status==="unloading"} style={{width:"100%",padding:"6px 0",borderRadius:6,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.04)",color:paused?"rgba(255,255,255,.15)":"#fff",fontSize:11,fontWeight:700,cursor:paused?"not-allowed":"pointer",letterSpacing:1}}>
                RELEASE →
              </button>
            </div>

            {/* Lightning Lane */}
            <div style={{background:"rgba(255,255,255,.025)",borderRadius:10,border:"1px solid rgba(96,165,250,.15)",padding:"8px 8px 6px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:9,fontWeight:700,color:"#60a5fa",letterSpacing:1}}>⚡ LIGHTNING</span>
                <span style={{fontSize:13,fontWeight:800,fontFamily:"monospace",color:llQueue.length>12?"#ef4444":"#60a5fa"}}>{llQueue.length}</span>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:2,marginBottom:6,minHeight:20}}>
                {llQueue.slice(0,8).map(g=>(
                  <div key={g.id} style={{width:16,height:16,borderRadius:3,background:"rgba(96,165,250,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:"#60a5fa",fontFamily:"monospace"}}>{g.size}</div>
                ))}
                {llQueue.length>8&&<div style={{fontSize:8,color:"rgba(96,165,250,.3)",alignSelf:"center"}}>+{llQueue.length-8}</div>}
              </div>
              <button onClick={releaseLL} disabled={paused||curTheater.status==="riding"||curTheater.status==="unloading"} style={{width:"100%",padding:"6px 0",borderRadius:6,border:"1px solid rgba(96,165,250,.2)",background:"rgba(96,165,250,.06)",color:paused?"rgba(255,255,255,.15)":"#60a5fa",fontSize:11,fontWeight:700,cursor:paused?"not-allowed":"pointer",letterSpacing:1}}>
                RELEASE →
              </button>
            </div>

            {/* Pause */}
            <button onClick={()=>setPaused(p=>!p)} style={{width:"100%",padding:"8px 0",borderRadius:8,border:`1px solid ${paused?"rgba(255,179,71,.4)":"rgba(255,255,255,.1)"}`,background:paused?"rgba(255,179,71,.12)":"rgba(255,255,255,.03)",color:paused?"#ffb347":"rgba(255,255,255,.5)",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:1}}>
              {paused?"▶ RESUME":"⏸ PAUSE"}
            </button>
          </div>

          {/* CENTER: ACTIVE THEATER LOADING */}
          <div style={{flex:1}}>
            {/* Theater tabs */}
            <div style={{display:"flex",gap:6,marginBottom:8}}>
              {theaters.map((th,i)=>{
                const f = seatsFilled(th.seats);
                const p = Math.round((f/TOTAL)*100);
                const isActive = i===activeT;
                return (
                  <div key={i} onClick={()=>{if(i!==activeT){setActiveT(i);setSel(null);setSplitting(false);SFX.tabSwitch();}}}
                    style={{flex:1,padding:"8px 10px",borderRadius:10,cursor:"pointer",
                      background:isActive?"rgba(255,255,255,.06)":"rgba(255,255,255,.02)",
                      border:`1.5px solid ${isActive?statusColor[th.status]:"rgba(255,255,255,.06)"}`,
                      transition:"all .2s",position:"relative",overflow:"hidden",
                    }}>
                    {th.status==="riding"&&<div style={{position:"absolute",inset:0,background:`linear-gradient(90deg,transparent,${statusColor.riding}08,transparent)`,animation:"rideGlow 2s infinite"}}/>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",position:"relative"}}>
                      <span style={{fontSize:12,fontWeight:800,letterSpacing:1}}>T{i+1}</span>
                      <span style={{fontSize:9,fontWeight:700,color:statusColor[th.status],letterSpacing:1}}>{statusLabel[th.status]}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:3,position:"relative"}}>
                      <div style={{height:3,flex:1,background:"rgba(255,255,255,.06)",borderRadius:2,overflow:"hidden",marginRight:6}}>
                        <div style={{height:"100%",width:th.status==="riding"||th.status==="unloading"?`${100-((th.rideTimer/(th.status==="riding"?RIDE_DURATION:UNLOAD_DURATION))*100)}%`:`${p}%`,background:th.status==="riding"?"#22c55e":occColor(p),borderRadius:2,transition:"width .3s"}}/>
                      </div>
                      <span style={{fontSize:10,fontWeight:800,fontFamily:"monospace",color:"rgba(255,255,255,.5)"}}>
                        {th.status==="riding"?`${Math.ceil(th.rideTimer)}s`:th.status==="unloading"?"CLR":`${p}%`}
                      </span>
                    </div>
                    {th.status==="loading"&&<div style={{fontSize:9,color:"rgba(255,255,255,.25)",marginTop:2}}>{th.holding.length} in hold · {f}/{TOTAL}</div>}
                  </div>
                );
              })}
            </div>

            {/* Theater content */}
            {curTheater.status==="riding"?(
              <div style={{textAlign:"center",padding:"40px 20px",background:"rgba(34,197,94,.04)",borderRadius:14,border:"1px solid rgba(34,197,94,.15)"}}>
                <div style={{fontSize:36,marginBottom:8}}>✈</div>
                <div style={{fontSize:18,fontWeight:900,color:"#22c55e",letterSpacing:2}}>IN FLIGHT</div>
                <div style={{fontSize:28,fontWeight:800,fontFamily:"monospace",color:"#22c55e",marginTop:4}}>{Math.ceil(curTheater.rideTimer)}s</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:4}}>Theater {activeT+1} · {curTheater.lastPct}% occupancy · {"★".repeat(getStars(curTheater.lastPct))}</div>
              </div>
            ):curTheater.status==="unloading"?(
              <div style={{textAlign:"center",padding:"40px 20px",background:"rgba(96,165,250,.04)",borderRadius:14,border:"1px solid rgba(96,165,250,.15)"}}>
                <div style={{fontSize:28,fontWeight:900,color:"#60a5fa",letterSpacing:2}}>CLEARING</div>
                <div style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:"#60a5fa",marginTop:4}}>{Math.ceil(curTheater.rideTimer)}s</div>
              </div>
            ):curTheater.status==="empty"&&curTheater.holding.length===0?(
              <div style={{textAlign:"center",padding:"40px 20px",background:"rgba(255,255,255,.02)",borderRadius:14,border:"1px solid rgba(255,255,255,.06)"}}>
                <div style={{fontSize:14,color:"rgba(255,255,255,.25)",letterSpacing:2,fontWeight:700}}>THEATER {activeT+1} READY</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.15)",marginTop:6}}>Release groups from Standby or Lightning Lane to begin loading</div>
              </div>
            ):(
              <>
                {/* Holding queue + selected info */}
                <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
                  <div style={{flex:1,background:"rgba(255,255,255,.02)",borderRadius:8,padding:"6px 8px",border:"1px solid rgba(255,255,255,.05)"}}>
                    <div style={{fontSize:8,fontWeight:700,color:"rgba(255,255,255,.3)",letterSpacing:1.5,marginBottom:4}}>HOLDING — {curTheater.holding.length} GROUPS</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:3,maxHeight:60,overflowY:"auto"}}>
                      {curTheater.holding.map((g,gi)=>(
                        <div key={g.id} onClick={()=>pickGroup(g)} style={{
                          padding:"3px 7px",borderRadius:5,cursor:paused?"not-allowed":"pointer",
                          background:sel===g.id?"rgba(255,179,71,.15)":"rgba(255,255,255,.04)",
                          border:sel===g.id?"1px solid rgba(255,179,71,.5)":"1px solid rgba(255,255,255,.06)",
                          fontSize:12,fontWeight:800,fontFamily:"monospace",
                          color:sel===g.id?"#ffb347":"rgba(255,255,255,.6)",
                          animation:sel===g.id?"spulse 1.5s infinite":"none",userSelect:"none",
                        }}>{g.size}</div>
                      ))}
                    </div>
                  </div>
                  {/* Split UI */}
                  {selGroup&&(
                    <div style={{background:splitting?"rgba(96,165,250,.08)":"rgba(255,179,71,.08)",borderRadius:8,padding:"6px 10px",border:`1px solid ${splitting?"rgba(96,165,250,.2)":"rgba(255,179,71,.2)"}`,minWidth:100,textAlign:"center"}}>
                      {splitting?(
                        <><div style={{fontSize:9,fontWeight:700,color:"#93c5fd",marginBottom:3}}>SPLIT {selGroup.size}</div>
                        <div style={{display:"flex",gap:3,flexWrap:"wrap",justifyContent:"center"}}>
                          {Array.from({length:selGroup.size-1}).map((_,i)=>{const n=i+1;return(
                            <div key={n} onClick={()=>doSplit(n)} style={{padding:"2px 5px",borderRadius:3,cursor:"pointer",background:"rgba(255,255,255,.06)",fontSize:10,fontWeight:800,color:"#93c5fd"}}>{n}+{selGroup.size-n}</div>
                          )})}
                        </div></>
                      ):(
                        <><div style={{fontSize:10,fontWeight:700,color:"#ffb347"}}>Group of {selGroup.size}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,.3)",marginTop:2}}>Tap a row to seat</div>
                        {selGroup.size>=2&&<div onClick={()=>setSplitting(true)} style={{marginTop:3,fontSize:9,color:"#93c5fd",cursor:"pointer",fontWeight:700}}>✂ Split</div>}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* DOME + GATES */}
                <div style={{width:"100%",height:30,marginBottom:-2,opacity:.3,overflow:"hidden"}}>
                  <svg width="100%" height="30" viewBox="0 0 800 30" preserveAspectRatio="none">
                    <path d="M0 30 Q400 -4 800 30" fill="none" stroke="url(#sg)" strokeWidth="2"/>
                    <defs><linearGradient id="sg"><stop offset="0%" stopColor="#4da6ff"/><stop offset="50%" stopColor="#fff8e7"/><stop offset="100%" stopColor="#5ce0b8"/></linearGradient></defs>
                  </svg>
                </div>

                <div style={{display:"flex",gap:8}}>
                  {GK.map(gk=>{
                    const cfg=GATES[gk]; const rows=curTheater.seats[gk];
                    const gF=rows.reduce((a,r)=>a+r.filled,0); const gC=rows.reduce((a,r)=>a+r.capacity,0);
                    return (
                      <div key={gk} style={{flex:1,background:"rgba(255,255,255,.025)",borderRadius:12,border:`1px solid ${cfg.color}20`,padding:"10px 8px 8px",position:"relative",overflow:"hidden"}}>
                        <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:"60%",height:2,background:`linear-gradient(90deg,transparent,${cfg.color}60,transparent)`}}/>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                          <div style={{display:"flex",alignItems:"center",gap:5}}>
                            <div style={{width:6,height:6,borderRadius:"50%",background:cfg.color,boxShadow:`0 0 6px ${cfg.color}80`}}/>
                            <span style={{fontSize:12,fontWeight:800,letterSpacing:2}}>SEC {cfg.label}</span>
                          </div>
                          <span style={{fontSize:10,fontFamily:"monospace",color:"rgba(255,255,255,.3)"}}>{gF}/{gC}</span>
                        </div>

                        {rows.map((row,ri)=>{
                          const left=row.capacity-row.filled; const full=left===0;
                          const fits=selGroup&&selGroup.size<=left;
                          const active=sel&&!full&&!paused&&!splitting&&curTheater.status==="loading";
                          const hov=hover===`${gk}${ri}`; const fl=flash===`${gk}${ri}`;

                          let bdr="rgba(255,255,255,.05)",bg="rgba(255,255,255,.015)";
                          if(fl){bdr=cfg.color;bg=`${cfg.color}15`}
                          else if(active&&hov){bdr=fits?"#22c55e":"#ef4444";bg=fits?"rgba(34,197,94,.1)":"rgba(239,68,68,.06)"}
                          else if(active&&fits){bdr="rgba(255,255,255,.12)";bg="rgba(255,255,255,.02)"}

                          return (
                            <div key={ri} onClick={()=>placeInRow(gk,ri)} onMouseEnter={()=>setHover(`${gk}${ri}`)} onMouseLeave={()=>setHover(null)}
                              style={{background:bg,borderRadius:6,padding:"5px 6px",marginBottom:3,transition:"all .2s",border:`1.5px solid ${bdr}`,cursor:active?"pointer":"default",position:"relative"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                                <span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.35)",letterSpacing:1}}>{ROW_NAMES[ri]}</span>
                                <span style={{fontSize:11,fontWeight:800,color:full?"#22c55e":"rgba(255,255,255,.7)",fontFamily:"monospace"}}>{row.filled}/{row.capacity}</span>
                              </div>
                              <div style={{display:"flex",gap:2,flexWrap:"wrap",justifyContent:"center"}}>
                                {Array.from({length:row.capacity}).map((_,si)=>{
                                  const isFilled=si<row.filled;
                                  const ghost=!isFilled&&selGroup&&hov&&fits&&!splitting&&si<row.filled+selGroup.size;
                                  return <div key={si} style={{width:16,height:12,borderRadius:2,
                                    background:isFilled?cfg.color:ghost?`${cfg.color}45`:"rgba(255,255,255,.05)",
                                    border:isFilled?`1px solid ${cfg.color}70`:ghost?`1px dashed ${cfg.color}50`:"1px solid rgba(255,255,255,.07)",
                                    transition:"all .2s",boxShadow:isFilled?`0 0 4px ${cfg.color}25`:"none",
                                  }}/>;
                                })}
                              </div>
                              {full&&<div style={{position:"absolute",top:4,right:6,fontSize:8,fontWeight:800,color:"#22c55e"}}>FULL</div>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Occupancy + Dispatch */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{height:5,width:100,background:"rgba(255,255,255,.06)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${curPct}%`,background:occColor(curPct),borderRadius:3,transition:"width .3s"}}/>
                    </div>
                    <span style={{fontSize:16,fontWeight:800,fontFamily:"monospace",color:occColor(curPct)}}>{curPct}%</span>
                    <span style={{fontSize:10,color:"rgba(255,255,255,.25)"}}>{curFilled}/{TOTAL}</span>
                  </div>
                  <button onClick={dispatch} disabled={paused||curTheater.status!=="loading"||curFilled===0} style={{
                    padding:"8px 20px",borderRadius:8,border:"1px solid rgba(34,197,94,.3)",
                    background:curFilled===0||paused?"rgba(34,197,94,.04)":"rgba(34,197,94,.12)",
                    color:curFilled===0||paused?"rgba(255,255,255,.15)":"#86efac",
                    fontSize:13,fontWeight:800,cursor:curFilled===0||paused?"not-allowed":"pointer",
                    letterSpacing:2,textTransform:"uppercase",
                  }}>
                    DISPATCH ✈
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Keyboard help modal */}
        {showKeys&&<div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowKeys(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#111833",borderRadius:14,padding:"20px 24px",maxWidth:360,border:"1px solid rgba(255,255,255,.1)",animation:"fin .2s ease"}}>
            <div style={{fontSize:13,fontWeight:800,marginBottom:10}}>KEYBOARD SHORTCUTS</div>
            {[["Q","Release Standby batch"],["L","Release Lightning Lane batch"],["1 / 2 / 3","Switch theater (when no group selected)"],["4–9","Select group from holding"],["S","Toggle split mode"],["D","Dispatch current theater"],["Space","Pause / Resume"],["Esc","Deselect"]].map(([k,d])=>(
              <div key={k} style={{display:"flex",gap:10,marginBottom:5}}>
                <code style={{background:"rgba(255,255,255,.08)",padding:"1px 7px",borderRadius:3,fontSize:11,fontWeight:700,color:"#ffb347",minWidth:55,textAlign:"center"}}>{k}</code>
                <span style={{fontSize:11,color:"rgba(255,255,255,.45)"}}>{d}</span>
              </div>
            ))}
          </div>
        </div>}

        {/* Achievements modal */}
        {showAch&&<div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowAch(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#111833",borderRadius:14,padding:"20px 24px",maxWidth:380,border:"1px solid rgba(255,255,255,.1)",animation:"fin .2s ease"}}>
            <div style={{fontSize:13,fontWeight:800,marginBottom:10}}>ACHIEVEMENTS</div>
            {ACHIEVEMENTS.map(a=>{const earned=unlocked.includes(a.id);return(
              <div key={a.id} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center",opacity:earned?1:.3}}>
                <span style={{fontSize:18,width:24,textAlign:"center"}}>{a.icon}</span>
                <div><div style={{fontSize:12,fontWeight:700}}>{a.title}</div><div style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>{a.desc}</div></div>
                {earned&&<span style={{marginLeft:"auto",fontSize:9,color:"#22c55e",fontWeight:700}}>✓</span>}
              </div>
            )})}
          </div>
        </div>}

      </div>
    </div>
  );
}