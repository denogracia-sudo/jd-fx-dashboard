(() => {
  const API = String(window.JD_FX_API_BASE || '').replace(/\/+$/, '');
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (v, d=2) => Number.isFinite(Number(v)) ? Number(v).toLocaleString(undefined,{maximumFractionDigits:d}) : '—';
  const panel = (title, sub, body) => '<div class="panel"><div class="panel-head"><div><h3>'+title+'</h3><div class="sub">'+sub+'</div></div></div>'+body+'</div>';
  const call = async (path, timeoutMs=30000) => {
    if (!API) throw new Error('API base URL is not configured.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(API + path, {headers:{Accept:'application/json'}, signal:controller.signal});
      const data = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(data.detail || data.message || ('HTTP '+r.status));
      return data;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Request timed out after '+Math.round(timeoutMs/1000)+' seconds.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
  const nav = [
    ['overview','Overview','◫'],['scanner','Live Charts','⌁'],['algo','AI Scanner','⌖'],['swing','Swing & Position Radar','↗'],
    ['alerts','Opportunity Alerts','◷'],['planning','Trade Planner','◎'],['backtest','Performance','▤'],
    ['news','Market News','▤'],['calendar','Economic Calendar','▦'],['settings','Settings','⚙']
  ];
  const pages = [
    ['algo','AI Scanner','Multi-timeframe confluence scanner across the supported market universe.'],
    ['swing','Swing & Position Radar','Ranked multi-day and weekly research candidates with wider risk-based targets.'],
    ['backtest','Backtesting & Performance','Resolved signal outcomes and performance evidence from the API.'],
    ['news','Market News','Recent headlines from the configured news aggregator.'],
    ['calendar','Economic Calendar','Upcoming FRED releases when a FRED key is configured.']
  ];
  function addPage(id,title,sub,body) {
    const main=document.querySelector('main');
    const foot=main.querySelector('.foot');
    const s=document.createElement('section');
    s.className='page'; s.id='page-'+id;
    s.innerHTML='<div class="headline"><div><h2>'+title+'</h2><p>'+sub+'</p></div></div>'+body;
    main.insertBefore(s,foot);
  }
  function mount() {
    const sidebar=document.querySelector('.sidebar');
    if (!sidebar) return;
    const old=[...sidebar.querySelectorAll('.nav')];
    old.forEach(n=>n.remove());
    nav.forEach(([id,label,ico])=>{
      const n=document.createElement('div'); n.className='nav'+(id==='overview'?' active':'');
      n.dataset.page=id; n.tabIndex=0; n.setAttribute('role','button');
      n.innerHTML='<span class="ico">'+ico+'</span>'+label;
      n.addEventListener('click',()=>{window.showPage ? window.showPage(id) : switchPage(id); if(id==='algo')scanAlgo(); if(id==='swing')scanSwing(); if(id==='backtest')loadPerformance(); if(id==='news')loadNews(); if(id==='calendar')loadCalendar();});
      n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();n.click();}});
      sidebar.insertBefore(n,sidebar.querySelector('.side-note'));
    });
    pages.forEach(([id,title,sub])=>{
      if(id==='swing') addPage(id,title,sub,
        '<div class="panel"><div class="live-toolbar"><label class="sub">Symbols <input id="swingSymbols" class="field" value="" placeholder="All supported markets (or enter symbols)" aria-label="Swing scan symbols"></label><label class="sub">Holding horizon <select id="swingHorizon" class="field"><option value="multi_day">Multi-day · 2–5 trading days</option><option value="weekly">Weekly · 1–3 weeks</option></select></label><button class="btn primary" id="swingRun">Scan swing opportunities</button></div><p class="sub">Leave symbols blank to scan all 14 supported instruments, or enter a custom list. Requires completed daily and weekly candles with aligned direction. Targets are 2R, 3R and 4R projections, not promises. Target-specific historical validation is not yet available. No orders or notifications are sent from this scanner.</p></div><div id="swingResults">'+empty('Run the scanner to rank multi-day and weekly candidates.')+'</div>');
      if(id==='algo') addPage(id,title,sub,
        '<div class="panel"><div class="live-toolbar"><label class="sub">Symbols <input id="algoSymbols" class="field" value="EURUSD,GBPUSD,USDJPY,USDCAD,USDCHF,XAUUSD,BTCUSD,ETHUSD" aria-label="Symbols"></label><label class="sub">Timeframes <input id="algoFrames" class="field" value="15m,1h,4h" aria-label="Timeframes"></label><button class="btn primary" id="algoRun">Run multi-timeframe scan</button></div><p class="sub">The confluence score is a heuristic evidence score, not a probability of profit. Results require fresh provider candles. Larger scans may take up to 2 minutes; fetches run concurrently with bounded provider limits.</p></div><div id="algoResults">'+empty('Run the scanner to retrieve current multi-timeframe results.')+'</div>');
      if(id==='backtest') addPage(id,title,sub,
        '<div class="notice">No file uploads are required. The performance report below uses resolved JD FX alert outcomes only. Automated strategy backtesting against verified historical market candles is not yet connected, so this page will not generate simulated results from missing or invented data.</div><div class="metrics"><div class="metric"><div class="label">Resolved trades</div><div class="value" id="perfResolved">—</div></div><div class="metric"><div class="label">Historical win rate</div><div class="value" id="perfWin">—</div></div><div class="metric"><div class="label">Expectancy</div><div class="value" id="perfExpectancy">—</div></div><div class="metric"><div class="label">Losses</div><div class="value" id="perfLosses">—</div></div></div><div class="panel"><div class="panel-head"><div><h3>Performance report</h3><div class="sub">Fetched from /algo/performance</div></div><button class="btn" id="perfReload">Refresh report</button></div><pre class="jd-json" id="perfRaw">'+esc('No report loaded.')+'</pre></div>');
      if(id==='news') addPage(id,title,sub,
        '<div class="panel"><div class="panel-head"><div><h3>Latest headlines</h3><div class="sub">Aggregated headlines; open publisher sources to assess context.</div></div><button class="btn" id="newsReload">Refresh news</button></div><div id="newsFeed">'+empty('Loading market headlines…')+'</div></div>');
      if(id==='calendar') addPage(id,title,sub,
        '<div class="notice">Calendar coverage depends on the FRED API key and FRED release schedule. This is not a complete global economic calendar and may not provide guaranteed release times or impact ratings.</div><div class="panel"><div class="panel-head"><div><h3>Upcoming economic releases</h3><div class="sub">Next 14 days</div></div><button class="btn" id="calendarReload">Refresh calendar</button></div><div id="calendarFeed">'+empty('Loading economic calendar…')+'</div></div>');
    });
    const sideNote=sidebar.querySelector('.side-note');
    if(sideNote) sideNote.innerHTML='<b style="color:var(--gold)">Research mode</b><br>Manual decision support only. No broker execution or automated orders.';
    $('algoRun').onclick=scanAlgo; $('swingRun').onclick=scanSwing;
    $('perfReload').onclick=loadPerformance; $('newsReload').onclick=loadNews; $('calendarReload').onclick=loadCalendar;
  }
  function switchPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+id));document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===id));}
  function empty(s){return '<div class="live-empty">'+esc(s)+'</div>';}
  function showError(id,e){const el=$(id);if(el)el.innerHTML=empty('Could not load data: '+(e.message||e));}
  async function scanAlgo(){
    const el=$('algoResults'); el.innerHTML=empty('Scanning instruments and timeframes…');
    const symbols=$('algoSymbols').value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,8);
    const frames=$('algoFrames').value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,4);
    if(symbols.length<1||frames.length<2){el.innerHTML=empty('Enter 1–8 symbols and 2–4 timeframes.');return;}
    try{
      const d=await call('/algo/scan?symbols='+encodeURIComponent(symbols.join(','))+'&timeframes='+encodeURIComponent(frames.join(','))+'&notify=false',120000);
      const rows=d.results||d.signals||d.items||[];
      if(!rows.length){el.innerHTML=empty('No scan results were returned. Check the API response and provider availability.');return;}
      el.innerHTML='<div class="panel"><div class="sub">Completed in '+fmt((d.scan_duration_ms||0)/1000,1)+'s · '+fmt(d.scan_workers||0,0)+' bounded concurrent workers · provider latency is reported per timeframe.</div><div class="tablewrap"><table><thead><tr><th>Instrument</th><th>Primary TF</th><th>Direction</th><th>Confluence</th><th>TF agreement</th><th>Alert status</th><th>Reference entry</th><th>Stop</th><th>TP1</th></tr></thead><tbody>'+rows.map(x=>{
        const plan=x.entry_plan||{};
        const direction=x.alert?.side||'NO_TRADE';
        const status=x.alert?.status||x.status||'—';
        return '<tr><td>'+esc(x.symbol||x.instrument_id)+'</td><td>'+esc(x.timeframe||'—')+'</td><td>'+esc(direction)+'</td><td>'+fmt(x.confidence_score,1)+'</td><td>'+fmt(x.timeframe_agreement_pct,1)+'%</td><td>'+esc(status)+'</td><td>'+fmt(plan.reference_entry,5)+'</td><td>'+fmt(plan.stop_loss,5)+'</td><td>'+fmt(plan.take_profit_1,5)+'</td></tr>';
      }).join('')+'</tbody></table></div></div><div class="panel"><div class="sub">Raw response for transparency</div><pre class="jd-json">'+esc(JSON.stringify(d,null,2))+'</pre></div>';
    }catch(e){showError('algoResults',e);}
  }
  async function scanSwing(){
    const el=$('swingResults');
    const raw=$('swingSymbols').value.trim();
    const horizon=$('swingHorizon').value;
    let symbols=[];
    try{
      if(raw){
        symbols=raw.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);
      }else{
        const catalogue=await call('/instruments');
        symbols=(catalogue.instruments||[]).map(x=>x.id||x.canonical).filter(Boolean);
      }
      if(!symbols.length||symbols.length>14||new Set(symbols).size!==symbols.length){
        el.innerHTML=empty('Enter 1–14 unique supported symbols, or leave the field blank to scan the full catalogue.');return;
      }
      const batches=[];
      for(let i=0;i<symbols.length;i+=8)batches.push(symbols.slice(i,i+8));
      const rows=[];
      for(let i=0;i<batches.length;i++){
        el.innerHTML=empty('Scanning market batch '+(i+1)+' of '+batches.length+' · '+symbols.length+' instruments · '+(horizon==='weekly'?'1–3 weeks':'2–5 trading days')+'…');
        const d=await call('/algo/swing-scan?symbols='+encodeURIComponent(batches[i].join(','))+'&horizon='+encodeURIComponent(horizon)+'&outputsize=500',120000);
        rows.push(...(d.results||[]));
      }
      rows.sort((a,b)=>{
        const aq=a.swing?.qualification==='research_candidate'?1:0;
        const bq=b.swing?.qualification==='research_candidate'?1:0;
        return bq-aq||Number(b.swing?.rank_score||0)-Number(a.swing?.rank_score||0);
      });
      if(!rows.length){el.innerHTML=empty('No instruments were returned. Check the supported instrument catalogue.');return;}
      el.innerHTML='<div class="panel"><div class="sub">Scanned '+symbols.length+' instruments · '+batches.length+' bounded batches · '+(horizon==='weekly'?'1–3 weeks':'2–5 trading days')+'</div><div class="tablewrap"><table><thead><tr><th>Rank</th><th>Instrument</th><th>Direction</th><th>Daily / Weekly</th><th>Score</th><th>Entry</th><th>Stop</th><th>TP 2R</th><th>TP 3R</th><th>TP 4R</th><th>State</th></tr></thead><tbody>'+rows.map((x,i)=>{
        const p=x.entry_plan||{},t=x.timeframes||{},daily=t['1d']||{},weekly=t['1w']||{},side=x.alert?.side||'NO_TRADE',state=x.swing?.qualification||x.status||'unavailable';
        return '<tr><td>'+(i+1)+'</td><td>'+esc(x.symbol||'—')+'</td><td>'+esc(side)+'</td><td>'+esc(daily.direction||daily.status||'—')+' / '+esc(weekly.direction||weekly.status||'—')+'</td><td>'+fmt(x.swing?.rank_score,1)+'</td><td>'+fmt(p.reference_entry,5)+'</td><td>'+fmt(p.stop_loss,5)+'</td><td>'+fmt(p.take_profit_1,5)+'</td><td>'+fmt(p.take_profit_2,5)+'</td><td>'+fmt(p.take_profit_3,5)+'</td><td>'+esc(state.replaceAll('_',' '))+'</td></tr>';
      }).join('')+'</tbody></table></div></div><div class="panel"><h3>Candidate notes & data quality</h3>'+rows.map(x=>{
        const s=x.swing||{},p=x.entry_plan||{},t=x.timeframes||{},daily=t['1d']||{},weekly=t['1w']||{};
        const evidence=[...(daily.evidence||[]),...(weekly.evidence||[])].slice(0,8);
        const controls=(s.risk_controls||[]).map(v=>'<li>'+esc(v)+'</li>').join('');
        const warnings=[...(daily.warnings||[]),...(weekly.warnings||[])].join(' · ');
        return '<article class="live-card" style="margin:10px 0"><div class="live-card-top"><strong>'+esc(x.symbol||'Instrument')+' · '+esc(x.alert?.side||'NO_TRADE')+'</strong><span class="signal watch">'+esc((s.qualification||x.status||'unavailable').replaceAll('_',' '))+'</span></div><p class="sub">'+esc(s.expected_holding_period||'')+' · Rank score '+fmt(s.rank_score,1)+' (not a probability) · minimum daily/weekly score '+fmt(s.minimum_directional_score,0)+'</p><div class="live-meta"><span>Entry zone</span><b>'+fmt(p.entry_zone_low,5)+' – '+fmt(p.entry_zone_high,5)+'</b></div><div class="live-meta"><span>Stop distance</span><b>'+fmt(p.risk_distance,5)+'</b></div><div class="live-meta"><span>Daily / weekly feed</span><b>'+esc(daily.data_provider||'—')+' / '+esc(weekly.data_provider||'—')+'</b></div><div class="live-meta"><span>Latest completed candles (UTC)</span><b>'+esc(daily.latest_candle_utc||'—')+' / '+esc(weekly.latest_candle_utc||'—')+'</b></div><div class="live-meta"><span>Freshness</span><b>'+esc(daily.freshness?.reason||daily.error||'—')+' / '+esc(weekly.freshness?.reason||weekly.error||'—')+'</b></div><div class="live-meta"><span>Historical baseline ('+esc(s.baseline_statistics_timeframe||'primary TF')+')</span><b>'+(x.historical_setup_statistics?.win_rate_pct==null?'Not established':fmt(x.historical_setup_statistics.win_rate_pct,1)+'%')+' · '+fmt(x.historical_setup_statistics?.resolved_samples,0)+' samples</b></div><p class="sub">Evidence: '+esc(evidence.join(' · ')||s.qualification||'No aligned evidence')+'</p><p class="sub">'+esc(s.target_validation||'')+'</p><p class="sub">'+esc(s.invalidation||'')+'</p>'+(warnings?'<p class="sub">Feed warnings: '+esc(warnings)+'</p>':'')+(controls?'<p class="sub"><b>Risk controls</b></p><ul>'+controls+'</ul>':'')+'</article>';
      }).join('')+'</div><div class="notice">Research only. Daily/weekly alignment is required; stale or unavailable candles are not treated as confirmation. 2R/3R/4R targets are not yet backed by target-specific historical results. Check news, spreads, slippage, overnight gaps and account risk.</div>';
    }catch(e){showError('swingResults',e);}
  }
  async function loadSignals(){
    const el=$('signalsResults');el.innerHTML=empty('Loading signal history…');
    try{const [a,p]=await Promise.all([call('/alerts/history'),call('/algo/performance')]);
      const events=a.events||a.alerts||[];
      const stats=p.summary||p.metrics||p;
      el.innerHTML='<div class="metrics"><div class="metric"><div class="label">Historical win rate</div><div class="value">'+fmt(stats.win_rate_pct??stats.win_rate,1)+(stats.win_rate_pct!=null||stats.win_rate!=null?'%':'')+'</div></div><div class="metric"><div class="label">Expectancy (R)</div><div class="value">'+fmt(stats.expectancy_r??stats.expectancy,2)+'</div></div><div class="metric"><div class="label">Resolved</div><div class="value">'+fmt(stats.resolved??stats.resolved_count??stats.resolved_samples??stats.total_resolved,0)+'</div></div><div class="metric"><div class="label">Alert records</div><div class="value">'+events.length+'</div></div></div><div class="tablewrap"><table><thead><tr><th>Instrument</th><th>Side</th><th>Timeframe</th><th>Status</th><th>Signal candle</th></tr></thead><tbody>'+events.slice(0,50).map(x=>'<tr><td>'+esc(x.symbol||x.instrument_id)+'</td><td>'+esc(x.side)+'</td><td>'+esc(x.timeframe)+'</td><td>'+esc(x.status||x.alert_status)+'</td><td>'+esc(x.signal_candle_utc||x.created_at)+'</td></tr>').join('')+'</tbody></table></div>';
    }catch(e){showError('signalsResults',e);}
  }
  async function loadPerformance(){
    try{const d=await call('/algo/performance');const s=d.summary||d.metrics||d;
      $('perfResolved').textContent=fmt(s.resolved??s.resolved_count??s.resolved_samples??s.total_resolved,0);
      $('perfWin').textContent=fmt(s.win_rate_pct??s.win_rate,1)+(s.win_rate_pct!=null||s.win_rate!=null?'%':'');
      $('perfExpectancy').textContent=fmt(s.expectancy_r??s.expectancy,2)+'R';
      $('perfLosses').textContent=fmt(s.losses,0);
      $('perfRaw').textContent=JSON.stringify(d,null,2);
    }catch(e){$('perfRaw').textContent='Could not load performance report: '+e.message;}
  }
  async function loadNews(){
    const el=$('newsFeed');el.innerHTML=empty('Loading headlines…');
    try{const d=await call('/news');const rows=d.items||d.articles||d.headlines||[];
      el.innerHTML=rows.length?rows.slice(0,40).map(x=>'<div class="jd-feed-item"><div><b>'+esc(x.title||x.headline||'Untitled headline')+'</b><div class="sub">'+esc(x.source||x.publisher||'News source')+' · '+esc(x.published_at||x.pubDate||x.date||'')+'</div><p class="sub">'+esc(x.summary||x.description||'')+'</p></div>'+(x.url||x.link?'<a target="_blank" rel="noopener noreferrer" href="'+esc(x.url||x.link)+'">Open source ↗</a>':'')+'</div>').join(''):empty('The news endpoint returned no headlines.');
    }catch(e){showError('newsFeed',e);}
  }
  async function loadCalendar(){
    const el=$('calendarFeed');el.innerHTML=empty('Loading releases…');
    try{const d=await call('/calendar?days=14');const rows=d.events||d.releases||d.results||[];
      el.innerHTML=rows.length?'<div class="tablewrap"><table><thead><tr><th>Date</th><th>Release</th><th>Country</th><th>Series</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.date||x.release_date||x.datetime)+'</td><td>'+esc(x.name||x.title||x.release_name)+'</td><td>'+esc(x.country||'US')+'</td><td>'+esc(x.series_id||x.id||'FRED')+'</td></tr>').join('')+'</tbody></table></div>':empty('No upcoming FRED releases returned. Check FRED_API_KEY configuration and endpoint availability.');
    }catch(e){showError('calendarFeed',e);}
  }
  async function openPaperTrade(){
    const symbol=$('paperSymbol').value,side=$('paperSide').value,entry=Number($('paperEntry').value),units=Number($('paperUnits').value),stop=$('paperStop').value?Number($('paperStop').value):null,target=$('paperTarget').value?Number($('paperTarget').value):null;
    if(!(entry>0&&units>0)){alert('Enter a valid entry price and positive units.');return;}
    if(stop!=null&&((side==='BUY'&&stop>=entry)||(side==='SELL'&&stop<=entry))){alert('Stop loss must be below entry for BUY and above entry for SELL.');return;}
    if(target!=null&&((side==='BUY'&&target<=entry)||(side==='SELL'&&target>=entry))){alert('Take profit must be above entry for BUY and below entry for SELL.');return;}
    try{const r=await fetch(API+'/paper/trades',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({symbol,side,entry_price:entry,units,stop_loss:stop,take_profit:target})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||('HTTP '+r.status));await loadPaperTrades();$('paperEntry').value='';$('paperStop').value='';$('paperTarget').value='';}catch(e){alert('Could not save simulated trade: '+e.message);}
  }
  async function closePaperTrade(id){
    if(!confirm('Close this simulated position using the latest observed quote?'))return;
    try{const r=await fetch(API+'/paper/trades/'+encodeURIComponent(id)+'/close',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||('HTTP '+r.status));await loadPaperTrades();}catch(e){alert('Could not close simulated trade: '+e.message);}
  }
  async function loadPaperTrades(){
    const el=$('paperTrades');if(!el)return;el.innerHTML=empty('Refreshing server-side paper ledger and monitoring open positions…');
    try{const d=await call('/paper/trades?refresh=true',60000),rows=d.trades||[],update=d.refresh||{};$('paperQuoteStatus').textContent='Server ledger · '+rows.length+' trades · '+(update.auto_closed||0)+' auto-closed · '+(update.quote_errors||[]).length+' quote errors · '+new Date().toLocaleTimeString();
      el.innerHTML=rows.length?'<div class="tablewrap"><table><thead><tr><th>Pair</th><th>Side</th><th>Entry</th><th>Units</th><th>Stop</th><th>Target</th><th>Status</th><th>Unrealized / realized P&L</th><th>Close</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.symbol)+'</td><td>'+esc(x.side)+'</td><td>'+fmt(x.entry_price,5)+'</td><td>'+fmt(x.units,4)+'</td><td>'+fmt(x.stop_loss,5)+'</td><td>'+fmt(x.take_profit,5)+'</td><td>'+esc(x.status)+(x.close_reason?' · '+esc(x.close_reason):'')+'</td><td>'+fmt(x.status==='CLOSED'?x.realized_pnl:x.unrealized_pnl,5)+'</td><td>'+(x.status==='OPEN'?'<button class="small-action" data-paper-close="'+esc(x.id)+'">Close</button>':'—')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">No simulated positions in the server ledger yet.</div>';
    }catch(e){showError('paperTrades',e);$('paperQuoteStatus').textContent='Server ledger unavailable: '+e.message;}
  }
  async function loadPaperQuotes(){try{const d=await call('/market/quotes?symbols=EURUSD,GBPUSD,USDJPY,USDCAD,XAUUSD,BTCUSD,ETHUSD');const q=d.quotes||[];$('paperQuoteStatus').textContent=q.length+' quote snapshots returned · '+new Date().toLocaleTimeString();}catch(e){$('paperQuoteStatus').textContent='Quotes unavailable: '+e.message;}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();