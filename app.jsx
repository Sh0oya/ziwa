// app.jsx — root: day state machine, modal routing, stage scaling, screensaver.
const { useState, useEffect, useRef, useCallback } = React;
// DEFAULT_SETTINGS / computeVM / nf come from core.jsx (same bundle scope).

function baseDay(sc, settings){
  const T = settings.morning_dose_target;
  switch(sc){
    case 'toFeed': return {kind:'morning', fed:false, shot:false, late:false, target:T};
    case 'toShot': return {kind:'morning', fed:true, fedTime:'8h05', fedPackets:1.5, shot:false, late:false, target:T};
    case 'late':   return {kind:'morning', fed:true, fedTime:'8h05', fedPackets:1.5, shot:false, late:true, target:T};
    case 'done':   return {kind:'morning', fed:true, fedTime:'8h05', fedPackets:1.5, shot:true, shotTime:'8h20', shotDose:T, late:false, target:T};
    case 'snack':  return {kind:'snack', snackDone:false, target:T};
    default: return {kind:'morning', fed:false, shot:false, late:false, target:T};
  }
}

function App(){
  const [settings,setSettings] = useState(DEFAULT_SETTINGS);
  const [snackOn,setSnackOn] = useState(true);
  const [scenario,setScenario] = useState('toShot');
  const [day,setDay] = useState(()=>baseDay('toShot',DEFAULT_SETTINGS));
  const [view,setView] = useState('main');
  const [modal,setModal] = useState(null);
  const [toastMsg,setToastMsg] = useState(null);
  const [moment,setMoment] = useState(null);
  const [saver,setSaver] = useState(false);
  const [clock,setClock] = useState(()=>fmtNow());
  const lock = useRef(false);
  const idle = useRef(null);

  function fmtNow(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+'h'+String(d.getMinutes()).padStart(2,'0'); }
  useEffect(()=>{ const id=setInterval(()=>setClock(fmtNow()),15000); return ()=>clearInterval(id); },[]);

  const toast = useCallback((text,tone)=>{ setToastMsg({text,tone}); setTimeout(()=>setToastMsg(null),2200); },[]);
  const flashMoment = useCallback((m)=>{ setMoment(m); setTimeout(()=>setMoment(null),1350); },[]);

  // ----- stage scaling -----
  const devRef = useRef(null);
  useEffect(()=>{
    const fit=()=>{ if(!devRef.current) return;
      const s=Math.min((window.innerWidth-28)/800,(window.innerHeight-118)/480);
      devRef.current.style.transform='scale('+Math.max(0.2,s)+')';
    };
    fit(); window.addEventListener('resize',fit); return ()=>window.removeEventListener('resize',fit);
  },[]);

  // ----- screensaver idle timer -----
  const poke = useCallback(()=>{
    if(idle.current) clearTimeout(idle.current);
    idle.current=setTimeout(()=>setSaver(true), 180000);
  },[]);
  useEffect(()=>{ poke(); return ()=>idle.current&&clearTimeout(idle.current); },[poke]);
  const wake = ()=>{ setSaver(false); poke(); };

  // ----- scenario / nav -----
  const jump = (sc)=>{ setScenario(sc); setDay(baseDay(sc,settings)); setView('main'); setModal(null); setSaver(false); lock.current=false; poke(); };

  // ----- actions -----
  const doFeed = (p)=>{ setModal(null); setDay(d=>({...d, fed:true, fedTime:'à l’instant', fedPackets:p})); setScenario('toShot');
    flashMoment({tone:'coral', mood:'happy', t1:'Servi !', t2:'Ziwa a son repas 🐟'}); };
  const doShot = (dose,choice)=>{ setModal(null); setDay(d=>({...d, shot:true, late:false, shotTime:'à l’instant', shotDose:dose, shotChoice:choice})); setScenario('done');
    flashMoment({tone:'green', mood:'happy', t1:'Bien piquée', t2:nf(dose)+' UI · c’est noté'}); };
  const doSnack = (p)=>{ setModal(null); setDay(d=>({...d, snackDone:true, snackPackets:p}));
    flashMoment({tone:'coral', mood:'happy', t1:'Snack donné', t2:nf(p)+' paquet 🐟'}); };

  const cancel = (which)=>setModal({type:'confirm', which});
  const doCancel = ()=>{ const w=modal.which; setModal(null);
    if(w==='feed') setDay(d=>({...d, fed:false, shot:false})), setScenario('toFeed');
    else setDay(d=>({...d, shot:false})), setScenario(day.late?'late':'toShot');
    toast('Action annulée','coral'); };

  const applyReco = (reco)=>{
    setSettings(s=>({...s, [reco.moment==='morning'?'morning_dose_target':'evening_dose_target']:reco.nouveau}));
    setDay(d=> reco.moment==='morning'?{...d, target:reco.nouveau}:d);
    toast(`Dose ${reco.moment==='morning'?'matin':'soir'} : ${nf(reco.ancien)} → ${nf(reco.nouveau)} UI`,'green');
  };

  const vm = computeVM(day);

  return (
    <div className="stage" onPointerDown={wake} onMouseMove={poke}>
      <div className="device" ref={devRef}>
        {view==='main' && <MainScreen vm={vm} day={day} settings={settings} clock={clock}
          onFeed={()=>setModal({type:'feed'})} onShot={()=>setModal({type:'shot'})} onSnack={()=>setModal({type:'snack'})}
          onAlarm={(t)=>setModal({type:'event', evType:t})} onSettings={()=>setView('settings')} onCancel={cancel} />}
        {view==='settings' && <SettingsView settings={settings} snackOn={snackOn} setSnackOn={setSnackOn}
          onBack={()=>setView('main')} onHistory={()=>setView('history')} toast={toast} />}
        {view==='history' && <HistoryView onBack={()=>setView('settings')} />}

        {/* modals */}
        {modal && <div className="scrim" onClick={()=>modal.type!=='analysis'&&setModal(null)}></div>}
        {modal?.type==='feed' && <FeedModal settings={settings} initial={1.5} onClose={()=>setModal(null)} onValidate={doFeed} />}
        {modal?.type==='shot' && <ShotModal target={day.target} onClose={()=>setModal(null)} onValidate={doShot} />}
        {modal?.type==='snack' && <FeedModal settings={settings} title="Combien pour le snack ?" initial={0.5} min={0.25} max={1} onClose={()=>setModal(null)} onValidate={doSnack} />}
        {modal?.type==='event' && <EventModal type={modal.evType} onClose={()=>setModal(null)}
          onAnalyze={(ev)=>{ toast('Événement enregistré','coral'); setModal({type:'analysis', event:ev}); }} />}
        {modal?.type==='analysis' && <AnalysisModal event={modal.event} settings={settings} onClose={()=>setModal(null)} onApply={applyReco} />}
        {modal?.type==='confirm' && <ConfirmModal text="Annuler cette action ?" onNo={()=>setModal(null)} onYes={doCancel} />}

        {/* warm done moment */}
        {moment && (
          <div className={'moment '+(moment.tone==='green'?'green':'')}>
            <div className="pop"><ZiwaCat mood={moment.mood} size={150} ink="#fff" bg={moment.tone==='green'?'var(--green)':'var(--coral)'} bandana="#fff" note={true} /></div>
            <div className="t1 script">{moment.t1}</div><div className="t2">{moment.t2}</div>
          </div>
        )}

        {/* toast */}
        {toastMsg && <div className={'toast '+(toastMsg.tone||'')}>{toastMsg.text}</div>}

        {/* screensaver */}
        {saver && (
          <div className="saver" onClick={wake}>
            <ZiwaCat mood="sleep" size={120} ink="#fff" bg="rgba(0,0,0,0)" bandana="#E07E6B" />
            <div className="clk">{clock}</div>
            <div className="dt">Vendredi 29 mai</div>
            <div className="nx">Prochaine piqûre du soir vers 20h</div>
            <div className="hint">Touche l’écran pour réveiller</div>
          </div>
        )}
      </div>

      {/* reviewer bar (letterbox — not part of the kiosk) */}
      <div className="review">
        <span className="lab">États</span>
        {[['toFeed','À nourrir'],['toShot','À piquer'],['late','Retard'],['done','Fait'],['snack','Snack']].map(([id,l])=>(
          <button key={id} className={view==='main'&&scenario===id?'on':''} onClick={()=>jump(id)}>{l}</button>
        ))}
        <span className="sep"></span>
        <button className={view==='settings'?'on':''} onClick={()=>{setView('settings');poke();}}>Réglages</button>
        <button className={view==='history'?'on':''} onClick={()=>{setView('history');poke();}}>Historique</button>
        <span className="sep"></span>
        <button onClick={()=>setSaver(true)}>Veille</button>
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
