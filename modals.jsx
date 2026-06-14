// modals.jsx — full-screen sheets for every input flow.
// nf / HYPO_SYMPTOMS / HYPER_SYMPTOMS / analyze come from core.jsx (same bundle scope).

/* ---------- FEED (paquets slider) ---------- */
function FeedModal({settings, onClose, onValidate, title='Combien de paquets donnés ?', initial=1.5, min=1, max=2}){
  const [p,setP]=React.useState(initial);
  const grams=Math.round(p*settings.food_packet_weight_g);
  const kcal=Math.round(grams/100*settings.food_kcal_per_100g);
  const ticks=[]; for(let v=min;v<=max+0.001;v+=0.25) ticks.push(Math.round(v*100)/100);
  return (
    <div className="sheet">
      <div className="sheet-head"><div className="ttl">{title}</div><button className="x tap" onClick={onClose}>✕</button></div>
      <div className="sheet-body">
        <div className="bignum"><div className="n">{nf(p)}</div><div className="u">paquet{p>1?'s':''}</div></div>
        <div className="slide-wrap">
          <input className="slide" type="range" min={min} max={max} step="0.25" value={p} onChange={e=>setP(parseFloat(e.target.value))} />
          <div className="ticks">{ticks.map(t=><span key={t} className={t===p?'on':''}>{nf(t)}</span>)}</div>
        </div>
        <div className="calc">≈ {grams} g · ≈ {kcal} kcal</div>
      </div>
      <div className="sheet-foot">
        <button className="btn ghost tap" onClick={onClose}>Annuler</button>
        <button className="btn coral tap" onClick={()=>onValidate(p)}>Valider</button>
      </div>
    </div>
  );
}

/* ---------- SHOT (3 dose buttons) ---------- */
function ShotModal({target, onClose, onValidate}){
  const opts=[{d:target-0.5,l:'en moins',choice:'minus'},{d:target,l:'cible',choice:'target',mid:true},{d:target+0.5,l:'en plus',choice:'plus'}];
  return (
    <div className="sheet">
      <div className="sheet-head"><div className="ttl">Quelle dose injectée ?</div><button className="x tap" onClick={onClose}>✕</button></div>
      <div className="sheet-body">
        <div className="dose-target-note">Dose cible : <b>{nf(target)} UI</b></div>
        <div className="doses">
          {opts.map(o=>(
            <button key={o.choice} className={'dosebtn tap'+(o.mid?' target':'')} onClick={()=>onValidate(o.d,o.choice)}>
              <span className="dv">{nf(o.d)}</span><span className="dl">UI · {o.l}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="sheet-foot"><button className="btn ghost tap" onClick={onClose}>Annuler</button></div>
    </div>
  );
}

/* ---------- EVENT (hypo/hyper) ---------- */
function EventModal({type, onClose, onAnalyze}){
  const list = type==='hypo'?HYPO_SYMPTOMS:HYPER_SYMPTOMS;
  const [sel,setSel]=React.useState([]);
  const [sev,setSev]=React.useState(null);
  const [mins,setMins]=React.useState(0);
  const [notes,setNotes]=React.useState('');
  const toggle=id=>setSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const danger = sev==='severe' || sel.includes('convulsions')||sel.includes('coma')||sel.includes('haleine');
  const now=new Date(); const t=new Date(now.getTime()+mins*60000);
  const hh=String(t.getHours()).padStart(2,'0'), mm=String(t.getMinutes()).padStart(2,'0');
  return (
    <div className="sheet">
      <div className="sheet-head">
        <div className="ttl">{type==='hypo'?'⚠ Hypoglycémie signalée':'⚠ Hyperglycémie signalée'}<small>Coche ce que tu observes chez Ziwa</small></div>
        <button className="x tap" onClick={onClose}>✕</button>
      </div>
      <div className="ev">
        {danger && (
          <div className="urg"><span className="big">🚑</span>
            <span>URGENCE VÉTÉRINAIRE — appelle ton véto maintenant.{type==='hypo'?' En attendant, frotte du miel ou sirop d’érable sur les gencives.':''}</span>
          </div>
        )}
        <div className="ev-cols">
          <div className="ev-col">
            <h4>Symptômes observés</h4>
            <div className="symptoms">
              {list.map(s=>(
                <div key={s.id} className={'sympt tap'+(sel.includes(s.id)?' on':'')+(s.danger?' danger':'')} onClick={()=>toggle(s.id)}>
                  <span className="box">{sel.includes(s.id)?'✓':''}</span>{s.label}
                </div>
              ))}
            </div>
          </div>
          <div className="ev-col">
            <h4>Sévérité ressentie</h4>
            <div className="sev">
              {[['mild','Léger'],['moderate','Modéré'],['severe','Sévère']].map(([v,l],i)=>(
                <button key={v} className={'sevbtn tap'+(sev===v?' on':'')+(v==='severe'?' s3':'')} onClick={()=>setSev(v)}>{l}</button>
              ))}
            </div>
            <div className="field">
              <label>Heure de l’événement</label>
              <div className="timepick">
                <button className="stp tap" onClick={()=>setMins(m=>m-5)}>−</button>
                <span className="tv">{hh}h{mm}</span>
                <button className="stp tap" onClick={()=>setMins(m=>Math.min(0,m+5))}>+</button>
                <span style={{fontSize:'13px',color:'var(--dim)',marginLeft:'4px'}}>{mins===0?'maintenant':`il y a ${-mins} min`}</span>
              </div>
            </div>
            <div className="field">
              <label>Notes (optionnel)</label>
              <textarea className="note" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Contexte, ce que tu as fait…" />
            </div>
          </div>
        </div>
      </div>
      <div className="sheet-foot">
        <button className="btn ghost tap" style={{flex:'1'}} onClick={onClose}>Annuler</button>
        <button className="btn red tap" style={{flex:'1.7',fontSize:'19px'}} onClick={()=>onAnalyze({type,severity:sev||'mild',symptoms:sel,notes})}>Enregistrer + Analyser IA</button>
      </div>
    </div>
  );
}

/* ---------- ANALYSIS (spinner -> result) ---------- */
function AnalysisModal({event, settings, onClose, onApply}){
  const [phase,setPhase]=React.useState('loading');
  const [res,setRes]=React.useState(null);
  const [applied,setApplied]=React.useState(false);
  React.useEffect(()=>{ const id=setTimeout(()=>{ setRes(analyze({...event,settings})); setPhase('result'); },1700); return ()=>clearTimeout(id); },[]);
  return (
    <div className="sheet">
      <div className="sheet-head"><div className="ttl">Analyse IA{res&&<small>{event.type==='hypo'?'Hypoglycémie':'Hyperglycémie'} · {settings.cat_name}</small>}</div>
        {phase==='result'&&<button className="x tap" onClick={onClose}>✕</button>}</div>
      {phase==='loading' ? (
        <div className="sheet-body"><div className="spin-wrap"><div className="spinner"></div><div className="lab">Analyse en cours…</div><div className="sub">Lecture des 30 derniers jours de suivi</div></div></div>
      ) : (
        <React.Fragment>
          <div className="an">
            <div><span className={'an-badge '+res.niveau}>{res.niveau==='urgent'?'⚠ Urgent':res.niveau==='attention'?'Niveau : Attention':'Info'}</span></div>
            <div className="an-card"><h5>Synthèse</h5><p>{res.synthese}</p></div>
            <div className="an-row">
              <div className="an-card" style={{flex:1}}><h5>Hypothèses</h5><ul>{res.hypotheses.map((h,i)=><li key={i}>{h}</li>)}</ul></div>
              <div className="an-card" style={{flex:1}}><h5>À faire maintenant</h5><ul>{res.actions.map((a,i)=><li key={i}>{a}</li>)}</ul></div>
            </div>
            {res.reco.ajuster ? (
              <div className="an-card reco"><h5>Recommandation de dose</h5>
                <div className="change"><span>{res.reco.moment==='morning'?'Matin':'Soir'}</span><s>{nf(res.reco.ancien)} UI</s><span className="arrow">→</span><span>{nf(res.reco.nouveau)} UI</span></div>
                <p style={{fontSize:'14px',color:'var(--dim)'}}>{res.reco.justification}</p>
                <div className="reco-acts">
                  <button className="apply tap" disabled={applied} onClick={()=>{setApplied(true);onApply(res.reco);}}>{applied?'✓ Appliqué':'Appliquer ce changement'}</button>
                  <button className="ignore tap" onClick={onClose}>Ignorer</button>
                </div>
              </div>
            ) : (
              <div className="an-card reco"><h5>Recommandation de dose</h5><p>Pas d’ajustement conseillé pour l’instant. {res.reco.justification}</p></div>
            )}
            <div className="disclaimer"><span>⚠</span><span>{res.rappel}</span></div>
          </div>
          <div className="sheet-foot"><button className="btn primary tap" onClick={onClose}>Fermer</button></div>
        </React.Fragment>
      )}
    </div>
  );
}

/* ---------- CONFIRM (annuler une action) ---------- */
function ConfirmModal({text, onYes, onNo}){
  return (
    <div className="sheet" style={{justifyContent:'center'}}>
      <div className="sheet-body" style={{flex:1,gap:'8px'}}>
        <div style={{fontSize:'27px',fontWeight:600,textAlign:'center'}}>{text}</div>
        <div style={{fontSize:'16px',color:'var(--dim)'}}>Sécurité contre les appuis accidentels.</div>
      </div>
      <div className="sheet-foot">
        <button className="btn ghost tap" onClick={onNo}>Non, garder</button>
        <button className="btn red tap" onClick={onYes}>Oui, annuler</button>
      </div>
    </div>
  );
}

Object.assign(window,{ FeedModal, ShotModal, EventModal, AnalysisModal, ConfirmModal });
