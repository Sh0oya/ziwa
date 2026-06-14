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
