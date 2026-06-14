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
