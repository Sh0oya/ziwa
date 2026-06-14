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
