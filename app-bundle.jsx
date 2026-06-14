
/* ===== ziwa-cat.jsx ===== */
// ziwa-cat.jsx — original simple line-art seated cat with a coral bandana.
// Not the Caats character. moods: calm | happy | sleep | alert.
function ZiwaCat({ mood = 'calm', size = 130, ink = '#2A2420', bg = '#FBF6EC', bandana = '#E07E6B', note = false, style }) {
  const sw = 3.4;
  const common = { fill: 'none', stroke: ink, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const filled = { fill: bg, stroke: ink, strokeWidth: sw, strokeLinejoin: 'round' };
  let eyes;
  if (mood === 'happy') eyes = (<g {...common}><path d="M52 47 q6 -7 12 0" /><path d="M76 47 q6 -7 12 0" /></g>);
  else if (mood === 'sleep') eyes = (<g {...common}><path d="M52 49 q6 6 12 0" /><path d="M76 49 q6 6 12 0" /></g>);
  else if (mood === 'alert') eyes = (<g><circle cx="58" cy="47" r="4.4" fill={ink} /><circle cx="82" cy="47" r="4.4" fill={ink} /></g>);
  else eyes = (<g><circle cx="58" cy="48" r="3.6" fill={ink} /><circle cx="82" cy="48" r="3.6" fill={ink} /></g>);
  return (
    <svg viewBox="0 0 140 162" width={size} height={size * 162 / 140} style={style} aria-hidden="true">
      <path d="M104 128 C 134 126, 136 86, 110 84" {...common} />
      <path d="M70 64 C 38 64, 30 104, 35 132 C 37 146, 52 150, 70 150 C 88 150, 103 146, 105 132 C 110 104, 102 64, 70 64 Z" {...filled} />
      <path d="M56 150 q6 -10 12 0" {...common} />
      <path d="M72 150 q6 -10 12 0" {...common} />
      <path d="M44 30 L 38 6 L 60 22 Z" {...filled} />
      <path d="M96 30 L 102 6 L 80 22 Z" {...filled} />
      <path d="M45 24 L 43 13 L 53 21" {...common} stroke={bandana} />
      <path d="M95 24 L 97 13 L 87 21" {...common} stroke={bandana} />
      <circle cx="70" cy="46" r="31" {...filled} />
      {eyes}
      <path d="M65 55 L 75 55 L 70 61 Z" fill={bandana} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M70 61 q -6 8 -13 5 M70 61 q 6 8 13 5" {...common} />
      <g {...common} strokeWidth={2.4} opacity="0.8">
        <path d="M44 52 L 18 47" /><path d="M44 58 L 19 60" /><path d="M96 52 L 122 47" /><path d="M96 58 L 121 60" />
      </g>
      <path d="M52 70 Q 70 80 88 70 L 80 92 Q 70 97 60 92 Z" fill={bandana} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M66 73 q4 3 8 0" {...common} strokeWidth={2.2} stroke={bg} />
      {note && (
        <g stroke={bandana} fill={bandana}>
          <path d="M118 30 L 118 8 L 130 5 L 130 24" fill="none" strokeWidth="3" strokeLinecap="round" />
          <circle cx="114" cy="31" r="4.5" /><circle cx="126" cy="25" r="4.5" />
        </g>
      )}
    </svg>
  );
}
window.ZiwaCat = ZiwaCat;


/* ===== core.jsx ===== */
// core.jsx — data, helpers, fake AI for the Ziwa prototype (canned, no backend).
const DEFAULT_SETTINGS = {
  cat_name:'Ziwa', cat_weight_kg:4.5,
  morning_time:'08:00', snack_time:'13:00', evening_time:'20:00',
  window_tolerance_h:2, morning_dose_target:2, evening_dose_target:2,
  dose_unit:'UI', insulin_type:'Lantus', snack_enabled:true,
  food_brand:'Caats — saumon', food_kcal_per_100g:90, food_protein_pct:10.5,
  food_fat_pct:5, food_carbs_pct:1.5, food_humidity_pct:80, food_packet_weight_g:85,
};

// french number: 1.5 -> "1,5"
function nf(n){ return (Math.round(n*100)/100).toString().replace('.',','); }

// ---- main-screen view model from the day state -----------------------------
function computeVM(s){
  if(s.kind==='snack'){
    return s.snackDone
      ? { sess:'SNACK · CIBLE 13H', status:'FAIT', color:'green', sub:'À tout à l’heure pour le soir', count:'Prochaine étape : soir, 20h', mood:'happy', bar:100, snack:true }
      : { sess:'SNACK · CIBLE 13H', status:'SNACK', color:'neutral', sub:'Petit repas — pas de piqûre', count:'Fenêtre encore 47 min', mood:'calm', bar:55, snack:true };
  }
  if(!s.fed)  return { sess:'MATIN · CIBLE 8H', status:'À NOURRIR', color:'orange', dose:nf(s.target)+' UI', doseTag:'dose prévue', count:'Fenêtre encore 1h 47', mood:'calm', bar:32 };
  if(!s.shot && !s.late) return { sess:'MATIN · CIBLE 8H', status:'À PIQUER', color:'orange', dose:nf(s.target)+' UI', doseTag:'à injecter', count:'Fenêtre encore 1h 12', mood:'calm', bar:58 };
  if(!s.shot && s.late)  return { sess:'MATIN · CIBLE 8H', status:'À PIQUER', color:'red', dose:nf(s.target)+' UI', doseTag:'à injecter', count:'Retard de 32 min', mood:'alert', bar:100 };
  return { sess:'MATIN · CIBLE 8H', status:'FAIT', color:'green', dose:nf(s.shotDose)+' UI', doseTag:'injectées', count:'Prochaine piqûre dans 11h 40', mood:'happy', bar:100 };
}

// ---- symptom lists ---------------------------------------------------------
const HYPO_SYMPTOMS = [
  {id:'faiblesse', label:'Faiblesse / tituber'},
  {id:'tremblements', label:'Tremblements'},
  {id:'pupilles', label:'Pupilles dilatées'},
  {id:'bave', label:'Bave / hypersalivation'},
  {id:'convulsions', label:'Convulsions', danger:true},
  {id:'coma', label:'Coma / inconscience', danger:true},
];
const HYPER_SYMPTOMS = [
  {id:'soif', label:'Soif excessive'},
  {id:'urines', label:'Urines fréquentes'},
  {id:'lethargie', label:'Léthargie inhabituelle'},
  {id:'appetit', label:'Perte d’appétit'},
  {id:'vomiss', label:'Vomissements'},
  {id:'haleine', label:'Haleine fruitée', danger:true},
];

// ---- fake AI analysis (canned, shaped like the real JSON) ------------------
function analyze({type, severity, symptoms, settings}){
  const urgent = severity==='severe' || symptoms.includes('convulsions') || symptoms.includes('coma') || symptoms.includes('haleine');
  if(type==='hypo'){
    return {
      urgence_veterinaire: urgent,
      niveau: urgent?'urgent':'attention',
      synthese: 'Troisième épisode d’hypoglycémie en 10 jours, toujours le matin entre 10h et 11h. La dose du matin semble trop forte pour la quantité de nourriture donnée.',
      hypotheses: ['Sous-alimentation matinale (1 paquet vs 1,5 le soir)','Effet Somogyi possible : à confirmer par courbe vétérinaire'],
      reco: { ajuster:true, moment:'morning', ancien:settings.morning_dose_target, nouveau:Math.max(0.5, settings.morning_dose_target-0.5),
              justification:'Réduire la dose du matin de 0,5 UI et maintenir 7 jours avant réévaluation.' },
      actions: urgent
        ? ['Frotter du miel ou sirop d’érable sur les gencives MAINTENANT','Appeler le vétérinaire en urgence','Ne pas donner la prochaine piqûre tant que la glycémie n’est pas remontée']
        : ['Surveiller le comportement cette nuit','Vérifier que Ziwa a bien mangé avant la prochaine piqûre','Noter l’heure exacte du prochain épisode'],
      rappel: 'Ces suggestions ne remplacent pas un avis vétérinaire. Consultation conseillée vu la récurrence.',
    };
  }
  return {
    urgence_veterinaire: urgent,
    niveau: urgent?'urgent':'attention',
    synthese: 'Glycémie élevée signalée. Avant d’augmenter la dose, il faut exclure un effet Somogyi (rebond après une hypo silencieuse) et une sous-alimentation.',
    hypotheses: ['Effet Somogyi : rebond hyper après une hypo non détectée','Ziwa ne mange peut-être pas assez avant la piqûre','Technique ou conservation de l’insuline à vérifier'],
    reco: { ajuster:false, moment:'evening', ancien:settings.evening_dose_target, nouveau:settings.evening_dose_target,
            justification:'Pas d’augmentation tant que l’effet Somogyi n’est pas écarté par une courbe vétérinaire.' },
    actions: urgent
      ? ['Surveiller les signes d’acidocétose (haleine, vomissements)','Appeler le vétérinaire aujourd’hui','Maintenir une bonne hydratation']
      : ['Confirmer que Ziwa mange avant chaque piqûre','Vérifier la conservation de l’insuline','Demander une courbe glycémique au véto avant tout changement'],
    rappel: 'Ne jamais augmenter l’insuline sur un seul épisode. Avis vétérinaire recommandé.',
  };
}

// ---- canned 30-day history -------------------------------------------------
function buildHistory(){
  const days=[]; const months=['mai','avr.'];
  const evtDays={28:'hypo',23:'hypo',18:'hypo',12:'hyper'}; // day-of-month -> event
  for(let i=0;i<30;i++){
    const dom=29-i; const m = dom>0?'mai':'avr.'; const day = dom>0?dom:dom+30;
    const e = evtDays[day];
    const mp = 1+(i%3)*0.25, ep = 1.25+((i+1)%3)*0.25;
    const md = e==='hypo'?2:2, ed=2;
    days.push({
      date:`${day} ${m}`,
      morning:`${mp.toString().replace('.',',')}pq · ${nf(md)}UI`,
      snack: i%4===0?'—':'0,5pq',
      evening:`${ep.toString().replace('.',',')}pq · ${nf(ed)}UI`,
      event: e,
    });
  }
  return days;
}
const HISTORY = buildHistory();

window.ZiwaCore = { DEFAULT_SETTINGS, nf, computeVM, HYPO_SYMPTOMS, HYPER_SYMPTOMS, analyze, HISTORY };


/* ===== modals.jsx ===== */
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


/* ===== views.jsx ===== */
// views.jsx — Settings (2 columns) and History (7j/30j) full screens.
// HISTORY comes from core.jsx (same bundle scope).

function SettingsView({settings, onBack, onHistory, snackOn, setSnackOn, toast}){
  const nf2 = window.ZiwaCore.nf;
  const F = ({label,value,unit,wide})=>(
    <div className={'set-f'+(wide?' wide':'')}>
      <label>{label}</label>
      <div className="val">{value}{unit&&<span className="unit">{unit}</span>}</div>
    </div>
  );
  return (
    <div className="set">
      <div className="set-head">
        <button className="bk tap" onClick={onBack}>←</button>
        <div className="ttl">Réglages</div>
      </div>
      <div className="set-cols">
        <div className="set-col">
          <h4>Horaires & doses</h4>
          <div className="set-grid">
            <F label="Prénom du chat" value={settings.cat_name} wide />
            <F label="Cible matin" value={settings.morning_time} />
            <F label="Cible soir" value={settings.evening_time} />
            <div className="set-f">
              <label>Snack (13h)</label>
              <div className="val">{snackOn?'Activé':'Désactivé'}<span className={'toggle tap'+(snackOn?' on':'')} onClick={()=>setSnackOn(v=>!v)}><i></i></span></div>
            </div>
            <F label="Tolérance fenêtre" value={settings.window_tolerance_h} unit="h" />
            <F label="Dose cible matin" value={nf2(settings.morning_dose_target)} unit="UI" />
            <F label="Dose cible soir" value={nf2(settings.evening_dose_target)} unit="UI" />
            <F label="Type d’insuline" value={settings.insulin_type} wide />
          </div>
        </div>
        <div className="set-col">
          <h4>Nutrition & chat</h4>
          <div className="set-grid">
            <F label="Poids du chat" value={nf2(settings.cat_weight_kg)} unit="kg" />
            <F label="Poids d’un paquet" value={settings.food_packet_weight_g} unit="g" />
            <F label="Marque aliment" value={settings.food_brand} wide />
            <F label="Kcal / 100 g" value={settings.food_kcal_per_100g} unit="kcal" />
            <F label="Protéines" value={nf2(settings.food_protein_pct)} unit="%" />
            <F label="Lipides" value={nf2(settings.food_fat_pct)} unit="%" />
            <F label="Glucides" value={nf2(settings.food_carbs_pct)} unit="%" />
            <F label="Humidité" value={settings.food_humidity_pct} unit="%" />
            <F label="Besoin théorique" value={Math.round(settings.cat_weight_kg*50)} unit="kcal/j" />
          </div>
        </div>
      </div>
      <div className="set-foot">
        <button className="btn coral tap" style={{flex:'1.4'}} onClick={()=>toast('Réglages enregistrés','green')}>Enregistrer</button>
        <button className="btn tap" onClick={onHistory}>Voir l’historique</button>
        <button className="btn ghost tap" onClick={()=>toast('CSV exporté (90 jours)','coral')}>Exporter CSV</button>
      </div>
    </div>
  );
}

function HistoryView({onBack}){
  const [range,setRange]=React.useState(30);
  const rows = HISTORY.slice(0,range);
  return (
    <div className="hist">
      <div className="hist-head">
        <button className="bk tap" onClick={onBack}>←</button>
        <div className="ttl">Historique</div>
        <div className="seg">
          <button className={range===7?'on':''} onClick={()=>setRange(7)}>7 jours</button>
          <button className={range===30?'on':''} onClick={()=>setRange(30)}>30 jours</button>
        </div>
      </div>
      <div className="hist-wrap">
        <div className="hist-scroll">
          <table className="htbl">
            <thead><tr><th>Date</th><th>Matin</th><th>Snack</th><th>Soir</th><th>Événement</th></tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i} className={r.event?'evt':''}>
                  <td><b>{r.date}</b></td>
                  <td>{r.morning}</td>
                  <td className={r.snack==='—'?'muted':''}>{r.snack}</td>
                  <td>{r.evening}</td>
                  <td>{r.event?<span className="ev-tag">{r.event==='hypo'?'Hypo':'Hyper'}</span>:<span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{ SettingsView, HistoryView });


/* ===== main.jsx ===== */
// main.jsx — the live home screen (Direction B).
function MainScreen({vm, day, settings, clock, onFeed, onShot, onSnack, onAlarm, onSettings, onCancel}){
  const panel = vm.color; // orange | red | green | neutral
  const catInk = panel==='neutral'?'#2A2420':'#fff';
  const catBg = panel==='orange'?'var(--orange)':panel==='red'?'var(--red)':panel==='green'?'var(--green)':'var(--blue)';
  const catBand = panel==='neutral'?'var(--coral)':'#fff';
  return (
    <div className="b">
      <div className="b-head">
        <span className="wm script">Ziwa</span>
        <div className="r"><span className="d">Vendredi 29 mai</span><span className="t">{clock}</span></div>
      </div>
      <div className="b-body">
        <div className={'b-panel '+panel}>
          <div className="b-sess">{vm.sess}</div>
          <div className="b-status">{vm.status}</div>
          {vm.snack ? <div className="b-sub">{vm.sub}</div> : <div className="b-dose">{vm.dose} <small>{vm.doseTag}</small></div>}
          <div className="b-count">{vm.count}</div>
          <div className={'b-pbar '+(panel==='neutral'?'dk':'')}><i style={{width:vm.bar+'%'}}></i></div>
          <div className="b-cat"><ZiwaCat mood={vm.mood} size={150} ink={catInk} bg={catBg} bandana={catBand} note={vm.mood==='happy'} /></div>
        </div>

        <div className="b-right">
          {vm.snack ? (
            <div className="b-acts">
              <div className={'bact tap '+(day.snackDone?'done-feed':'cta')} style={{minHeight:'88px'}} onClick={day.snackDone?undefined:onSnack}>
                <span className="ic">🍽️</span>
                <span className="tx"><span className="k">{day.snackDone?'Snack donné':'Donner le snack'}</span>
                  <span className="h">{day.snackDone?'13h10 · 0,5 paquet':'≈ 43 g · pas de piqûre'}</span></span>
                {day.snackDone && <span className="chk" style={{color:'var(--coral-deep)'}}>✓</span>}
              </div>
            </div>
          ) : (
            <div className="b-acts">
              <div className={'bact tap '+(day.fed?'done-feed':'cta')} onClick={day.fed?()=>onCancel('feed'):onFeed}>
                <span className="ic">🥣</span>
                <span className="tx"><span className="k">{day.fed?'Nourrie':'Nourrir'}</span>
                  <span className="h">{day.fed?`${day.fedTime} · ${window.ZiwaCore.nf(day.fedPackets)} paquet`:'1 à 2 paquets'}</span></span>
                {day.fed && <span className="chk" style={{color:'var(--coral-deep)'}}>✓</span>}
              </div>
              <div className={'bact tap '+(!day.fed?'is-disabled':day.shot?'done-shot':'cta')} onClick={!day.fed?undefined:day.shot?()=>onCancel('shot'):onShot}>
                <span className="ic">💉</span>
                <span className="tx"><span className="k">{day.shot?'Piquée':'Piquer'}</span>
                  <span className="h">{day.shot?`${day.shotTime} · ${window.ZiwaCore.nf(day.shotDose)} UI`:!day.fed?'après le repas':`dose cible ${window.ZiwaCore.nf(day.target)} UI`}</span></span>
                {day.shot && <span className="chk" style={{color:'var(--green)'}}>✓</span>}
              </div>
            </div>
          )}

          <div className="b-log">
            <div className={'chip '+(day.shot?'ok':'')}><span className="nm">Matin</span>
              <span className="v">{day.fed?`${day.fedTime} · ${window.ZiwaCore.nf(day.fedPackets)}pq`:'— nourrir'}</span>
              <span className={'v '+(day.shot?'':'muted')}>{day.shot?`${day.shotTime} · ${window.ZiwaCore.nf(day.shotDose)}UI`:'— piquer'}</span></div>
            <div className="chip"><span className="nm">Snack</span><span className={'v '+(day.snackDone?'':'muted')}>{day.snackDone?'13h10 ✓':'à 13h'}</span></div>
            <div className="chip"><span className="nm">Soir</span><span className="v muted">à 20h</span></div>
          </div>

          <div className="b-foot">
            <button className="balarm tap" onClick={()=>onAlarm('hypo')}><span>⚠</span>Hypo</button>
            <button className="balarm tap" onClick={()=>onAlarm('hyper')}><span>⚠</span>Hyper</button>
            <button className="bgear tap" onClick={onSettings}><span>⚙</span>Réglages</button>
          </div>
        </div>
      </div>
    </div>
  );
}
window.MainScreen = MainScreen;


/* ===== app.jsx ===== */
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

