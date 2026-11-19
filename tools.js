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
  const callJson = async (path, method, body, timeoutMs=30000) => {
    if (!API) throw new Error('API base URL is not configured.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(API + path, {method,headers:{Accept:'application/json','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
      const data = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(data.detail || data.message || ('HTTP '+r.status));
      return data;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Request timed out after '+Math.round(timeoutMs/1000)+' seconds.');
      throw error;
    } finally { clearTimeout(timer); }
  };
  const nav = [
    ['overview','Overview','◫'],['scanner','Live Charts','⌁'],['algo','AI Scanner','⌖'],['swing','Swing & Position Radar','↗'],
    ['signals','Signals','↗'],['alerts','Alert Centre','◷'],['planning','Trade Planner','◎'],
    ['paper','Paper Trading','▣'],['backtest','Backtesting & Performance','▤'],
    ['news','Market News','▤'],['calendar','Economic Calendar','▦'],['settings','Settings','⚙']
  ];
  const pages = [
    ['algo','AI Scanner','Multi-timeframe confluence scanner across the supported market universe.'],
    ['swing','Swing & Position Radar','Ranked multi-day and weekly research candidates with wider risk-based targets.'],
    ['signals','Signals','Current and historical research signals with transparent evidence.'],
    ['paper','Paper Trading','A browser-local simulation ledger. No broker connection or real orders.'],
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
      n.addEventListener('click',()=>{window.showPage ? window.showPage(id) : switchPage(id); if(id==='algo')scanAlgo(); if(id==='swing')scanSwing(); if(id==='signals')loadSignals(); if(id==='backtest')loadPerformance(); if(id==='news')loadNews(); if(id==='calendar')loadCalendar(); if(id==='paper')loadPaperQuotes(); if(id==='settings')loadDiagnostics();});
      n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();n.click();}});
      sidebar.insertBefore(n,sidebar.querySelector('.side-note'));
    });
    pages.forEach(([id,title,sub])=>{
      if(id==='swing') addPage(id,title,sub,
        '<div class="panel"><div class="live-toolbar"><label class="sub">Symbols <input id="swingSymbols" class="field" value="" placeholder="All supported markets (or enter symbols)" aria-label="Swing scan symbols"></label><label class="sub">Holding horizon <select id="swingHorizon" class="field"><option value="multi_day">Multi-day · 2–5 trading days</option><option value="weekly">Weekly · 1–3 weeks</option></select></label><button class="btn primary" id="swingRun">Scan swing opportunities</button></div><p class="sub">Leave symbols blank to scan all 14 supported instruments, or enter a custom list. Requires completed daily and weekly candles with aligned direction. Targets are 2R, 3R and 4R projections, not promises. Target-specific historical validation is not yet available. No orders or notifications are sent from this scanner.</p></div><div id="swingResults">'+empty('Run the scanner to rank multi-day and weekly candidates.')+'</div>');
      if(id==='algo') addPage(id,title,sub,
        '<div class="panel"><div class="live-toolbar"><label class="sub">Symbols <input id="algoSymbols" class="field" value="" placeholder="All 14 supported markets (or enter symbols)" aria-label="Symbols"></label><label class="sub">Timeframes <input id="algoFrames" class="field" value="15m,1h,4h" aria-label="Timeframes"></label><button class="btn primary" id="algoRun">Run multi-timeframe scan</button></div><p class="sub">The confluence score is a heuristic evidence score, not a probability of profit. Results require fresh provider candles. Larger scans may take up to 2 minutes; fetches run concurrently with bounded provider limits.</p></div><div id="algoResults">'+empty('Run the scanner to retrieve current multi-timeframe results.')+'</div>');
      if(id==='signals') addPage(id,title,sub,
        '<div class="panel"><div class="panel-head"><div><h3>Signal stream</h3><div class="sub">Latest alert history and current scan signals.</div></div><button class="btn" id="signalsReload">Refresh</button></div><div id="signalsResults">'+empty('Loading signal history…')+'</div></div>');
      if(id==='paper') addPage(id,title,sub,
        '<div class="notice">Persistent simulation ledger · quote-driven mark-to-market · automatic stop-loss and take-profit exits. Simulation only; no broker orders. P/L is shown in quote-currency price units, not account-currency cash.</div><div class="panel"><div class="panel-head"><div><h3>Open simulated position</h3><div class="sub">Market entry uses the latest available provider quote. An optional entry override is for historical/manual test scenarios.</div></div><span class="tag">PAPER ENGINE</span></div><div class="formgrid"><div><label>Market</label><select class="field" id="paperSymbol"><option>EURUSD</option><option>GBPUSD</option><option>USDJPY</option><option>AUDUSD</option><option>USDCAD</option><option>USDCHF</option><option>XAUUSD</option><option>BTCUSD</option><option>ETHUSD</option><option>SOLUSD</option><option>SPX500</option><option>NDX100</option><option>DJI</option><option>DXY</option></select></div><div><label>Direction</label><select class="field" id="paperSide"><option>BUY</option><option>SELL</option></select></div><div><label>Units</label><input class="field" id="paperUnits" type="number" min="0.000001" step="any" value="1"></div><div><label>Entry override (optional)</label><input class="field" id="paperEntry" type="number" step="any" placeholder="Use live quote"></div><div><label>Stop loss (optional)</label><input class="field" id="paperStop" type="number" step="any"></div><div><label>Take profit (optional)</label><input class="field" id="paperTarget" type="number" step="any"></div></div><div class="row" style="margin-top:12px"><button class="btn primary" id="paperOpen">Open simulation</button><button class="btn" id="paperRefresh">Refresh & manage open trades</button></div><p class="sub" id="paperQuoteStatus">Waiting for market quote.</p></div><div class="metrics"><div class="metric"><div class="label">Open positions</div><div class="value" id="paperOpenCount">—</div></div><div class="metric"><div class="label">Closed positions</div><div class="value" id="paperClosedCount">—</div></div><div class="metric"><div class="label">Win rate</div><div class="value" id="paperWinRate">—</div></div><div class="metric"><div class="label">Realized P/L</div><div class="value" id="paperRealized">—</div></div><div class="metric"><div class="label">Expectancy (R)</div><div class="value" id="paperExpectancy">—</div></div><div class="metric"><div class="label">Profit factor</div><div class="value" id="paperProfitFactor">—</div></div></div><div class="panel"><div class="panel-head"><div><h3>Performance engine</h3><div class="sub">Sample-aware review of closed simulations, grouped by market.</div></div><span class="tag">ANALYTICS BOT</span></div><p id="paperAssessment" class="sub">Waiting for simulation results.</p><div id="paperMarketBreakdown"></div></div><div class="panel"><div class="panel-head"><div><h3>Simulation ledger</h3><div class="sub">Saved on the server and shared across your devices.</div></div><span class="tag" id="paperEngineState">ENGINE IDLE</span></div><div id="paperTrades">'+empty('Loading persistent simulation ledger…')+'</div></div>');
      if(id==='backtest') addPage(id,title,sub,
        '<div class="notice">The performance report tracks qualified-alert outcomes. The CSV backtest below runs an EMA crossover strategy on historical OHLC data you supply. Results are historical simulations, not forecasts; costs and execution assumptions matter.</div><div class="panel"><h3>Run an EMA crossover backtest</h3><p class="sub">Upload an OHLC CSV with datetime, open, high, low and close columns. The file is sent to the JD FX API for analysis and is not saved by this dashboard.</p><div class="formgrid"><div><label>Historical OHLC CSV</label><input class="field" id="btFile" type="file" accept=".csv,text/csv"></div><div><label>Fast EMA</label><input class="field" id="btFast" type="number" min="2" max="200" value="20"></div><div><label>Slow EMA</label><input class="field" id="btSlow" type="number" min="3" max="500" value="50"></div><div><label>Trading cost (basis points)</label><input class="field" id="btCost" type="number" min="0" max="1000" step="0.1" value="2"></div></div><button class="btn primary" id="btRun" style="margin-top:12px">Run historical backtest</button><div id="btResult" style="margin-top:12px"></div></div><div class="metrics"><div class="metric"><div class="label">Resolved trades</div><div class="value" id="perfResolved">—</div></div><div class="metric"><div class="label">Historical win rate</div><div class="value" id="perfWin">—</div></div><div class="metric"><div class="label">Expectancy</div><div class="value" id="perfExpectancy">—</div></div><div class="metric"><div class="label">Losses</div><div class="value" id="perfLosses">—</div></div></div><div class="panel"><div class="panel-head"><div><h3>Paper portfolio analytics</h3><div class="sub">Persistent simulations · quote-marked results · sample-aware interpretation</div></div><span class="tag">PERFORMANCE BOT</span></div><div class="metrics"><div class="metric"><div class="label">Closed simulations</div><div class="value" id="paperPerfClosed">—</div></div><div class="metric"><div class="label">Win rate</div><div class="value" id="paperPerfWin">—</div></div><div class="metric"><div class="label">Expectancy</div><div class="value" id="paperPerfExpectancy">—</div></div><div class="metric"><div class="label">Profit factor</div><div class="value" id="paperPerfFactor">—</div></div></div><p class="sub" id="paperPerfAssessment">Paper performance has not been loaded.</p></div><div class="panel"><div class="panel-head"><div><h3>Performance report</h3><div class="sub">Signal outcomes and paper portfolio analytics</div></div><button class="btn" id="perfReload">Refresh report</button></div><pre class="jd-json" id="perfRaw">'+esc('No report loaded.')+'</pre></div>');
      if(id==='news') addPage(id,title,sub,
        '<div class="panel"><div class="panel-head"><div><h3>Latest headlines</h3><div class="sub">Aggregated headlines; open publisher sources to assess context.</div></div><button class="btn" id="newsReload">Refresh news</button></div><div id="newsFeed">'+empty('Loading market headlines…')+'</div></div>');
      if(id==='calendar') addPage(id,title,sub,
        '<div class="notice">Calendar coverage depends on the FRED API key and FRED release schedule. This is not a complete global economic calendar and may not provide guaranteed release times or impact ratings.</div><div class="panel"><div class="panel-head"><div><h3>Upcoming economic releases</h3><div class="sub">Next 14 days</div></div><button class="btn" id="calendarReload">Refresh calendar</button></div><div id="calendarFeed">'+empty('Loading economic calendar…')+'</div></div>');
    });
    const sideNote=sidebar.querySelector('.side-note');
    if(sideNote) sideNote.innerHTML='<b style="color:var(--gold)">Research mode</b><br>Manual decision support only. No broker execution or automated orders.';
    $('algoRun').onclick=scanAlgo; $('swingRun').onclick=scanSwing; $('signalsReload').onclick=loadSignals;
    $('paperOpen').onclick=openPaperTrade; $('paperRefresh').onclick=loadPaperQuotes;
    $('perfReload').onclick=loadPerformance; $('newsReload').onclick=loadNews; $('calendarReload').onclick=loadCalendar; $('btRun').onclick=runCsvBacktest; $('diagReload').onclick=loadDiagnostics; $('testTwelveData').onclick=testTwelveData;
    document.addEventListener('click',e=>{const b=e.target.closest('[data-paper-close]');if(b)closePaperTrade(b.dataset.paperClose);});
    loadPaperTrades();
  }
  function switchPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+id));document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===id));}
  function empty(s){return '<div class="live-empty">'+esc(s)+'</div>';}
  function showError(id,e){const el=$(id);if(el)el.innerHTML=empty('Could not load data: '+(e.message||e));}
  async function scanAlgo(){
    const el=$('algoResults');el.innerHTML=empty('Preparing the full market universe…');
    const raw=$('algoSymbols').value.trim(),frames=$('algoFrames').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    try{
      let symbols=raw?raw.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean):[];
      if(!raw){const catalogue=await call('/instruments');symbols=(catalogue.instruments||[]).map(x=>x.id||x.canonical).filter(Boolean);}
      if(!symbols.length||symbols.length>14||new Set(symbols).size!==symbols.length||frames.length<2||frames.length>4){
        el.innerHTML=empty('Use 1–14 unique supported markets and 2–4 timeframes. Leave symbols blank to scan all markets.');return;
      }
      const batches=[];for(let i=0;i<symbols.length;i+=4)batches.push(symbols.slice(i,i+4));
      const rows=[],meta=[];
      for(let i=0;i<batches.length;i++){
        el.innerHTML=empty('Running analysis batch '+(i+1)+'/'+batches.length+' · '+symbols.length+' markets · '+frames.join(' / '));
        const d=await call('/algo/scan?symbols='+encodeURIComponent(batches[i].join(','))+'&timeframes='+encodeURIComponent(frames.join(','))+'&notify=false',120000);
        rows.push(...(d.results||[]));meta.push({duration:d.scan_duration_ms||0,workers:d.scan_workers||0});
      }
      const ok=rows.filter(x=>x.status==='ok').length,failed=rows.length-ok;
      el.innerHTML='<div class="panel"><div class="panel-head"><div><h3>Multi-market analysis</h3><div class="sub">'+symbols.length+' instruments · '+frames.length+' timeframes · '+ok+' analyzed · '+failed+' unavailable · '+fmt(meta.reduce((n,x)=>n+x.duration,0)/1000,1)+'s aggregate provider time</div></div><span class="tag">'+(failed?'PARTIAL COVERAGE':'FULL COVERAGE')+'</span></div><div class="tablewrap"><table><thead><tr><th>Instrument</th><th>Asset class</th><th>Primary TF</th><th>Direction</th><th>Confluence</th><th>TF agreement</th><th>Evidence</th><th>Entry</th><th>Stop</th><th>TP1</th></tr></thead><tbody>'+rows.map(x=>{
        const plan=x.entry_plan||{},direction=x.alert?.side||'NO_TRADE',status=x.alert?.status||x.status||'—';
        return '<tr><td>'+esc(x.symbol||x.instrument_id)+'</td><td>'+esc(x.asset_class||'—')+'</td><td>'+esc(x.timeframe||frames[0])+'</td><td>'+esc(direction)+'</td><td>'+fmt(x.confidence_score,1)+'</td><td>'+fmt(x.timeframe_agreement_pct,1)+'%</td><td>'+esc(status)+'</td><td>'+fmt(plan.reference_entry,6)+'</td><td>'+fmt(plan.stop_loss,6)+'</td><td>'+fmt(plan.take_profit_1,6)+'</td></tr>';
      }).join('')+'</tbody></table></div></div><div class="panel"><div class="sub">Transparent engine output · stale or unavailable candles never become positive signals.</div><pre class="jd-json">'+esc(JSON.stringify({symbols,timeframes:frames,results:rows},null,2))+'</pre></div>';
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
      for(let i=0;i<symbols.length;i+=4)batches.push(symbols.slice(i,i+4));
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
  async function runCsvBacktest(){
    const file=$('btFile').files[0],fast=Number($('btFast').value),slow=Number($('btSlow').value),cost=Number($('btCost').value),el=$('btResult');
    if(!file){el.innerHTML=empty('Choose an OHLC CSV file first.');return;}
    if(!(fast>=2&&slow>fast&&cost>=0)){el.innerHTML=empty('Use valid EMA periods: slow EMA must be greater than fast EMA, and cost cannot be negative.');return;}
    const data=new FormData();data.append('file',file);
    el.innerHTML=empty('Running historical backtest…');
    try{
      const r=await fetch(API+'/backtest/ema-crossover?fast='+fast+'&slow='+slow+'&cost_bps='+cost,{method:'POST',body:data,headers:{Accept:'application/json'}});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.detail||d.message||('HTTP '+r.status));
      el.innerHTML='<div class="sub">Historical simulation output</div><pre class="jd-json">'+esc(JSON.stringify(d,null,2))+'</pre>';
    }catch(e){el.innerHTML=empty('Backtest failed: '+e.message);}
  }
  async function loadDiagnostics(){
    const el=$('diagGrid');if(!el)return;
    el.innerHTML=empty('Checking API, database and provider configuration…');
    try{
      const [d,p]=await Promise.all([call('/system/diagnostics'),call('/market/providers')]);
      const tw=(d.checks||{}).twelvedata_key_configured;
      const storage=d.storage||{},execution=(d.checks||{}).trading_execution_enabled;
      el.innerHTML='<div class="metric"><div class="label">API status</div><div class="value">'+esc(d.status||'unknown')+'</div><div class="sub">Version '+esc(d.version||'—')+'</div></div><div class="metric"><div class="label">Persistent database</div><div class="value">'+(storage.connected?'Connected':'Unavailable')+'</div><div class="sub">'+esc(storage.backend||'unknown')+' · '+fmt(storage.rows,0)+' candles</div></div><div class="metric"><div class="label">Twelve Data key</div><div class="value">'+(tw?'Configured':'Missing')+'</div><div class="sub">Presence only · authentication unverified</div></div><div class="metric"><div class="label">Broker execution</div><div class="value">'+(execution?'Enabled':'Disabled')+'</div><div class="sub">JD FX research mode</div></div>';
      $('diagNote').textContent='Storage: '+(storage.connected?'connected':'not connected')+' · latest stored candle snapshot '+(storage.latest_stored_at||'not available')+' · FRED calendar '+((d.checks||{}).fred_key_configured?'configured':'not configured')+'. Provider routing: '+JSON.stringify(p.routing||{});
    }catch(e){el.innerHTML=empty('System diagnostics failed: '+e.message);}
  }
  async function testTwelveData(){
    const el=$('twelveTestState');el.textContent='Requesting a fresh EUR/USD candle snapshot from Twelve Data…';
    try{
      const d=await call('/analyze/provider?symbol=EURUSD&provider_name=twelvedata&interval=1h&outputsize=100',60000);
      if(d.status!=='ok')throw new Error(d.message||d.error||('Provider returned '+(d.status||'an unknown status')));
      el.textContent='Twelve Data candle request succeeded · '+(d.candles||d.candle_count||'fresh')+' · '+(d.data_source?.freshness?.reason||'freshness checked');
    }catch(e){el.textContent='Twelve Data test failed: '+e.message+'. The key can be present but rejected by the provider; rotate it in FastAPI Cloud if the error indicates authentication.';}
  }
  async function loadPerformance(){
    try{
      const [d,p]=await Promise.all([call('/algo/performance'),call('/paper/performance?refresh=true',60000)]);
      const stats=d.summary||d.metrics||d;
      $('perfResolved').textContent=fmt(stats.resolved??stats.resolved_count??stats.resolved_samples??stats.total_resolved,0);
      $('perfWin').textContent=fmt(stats.win_rate_pct??stats.win_rate,1)+(stats.win_rate_pct!=null||stats.win_rate!=null?'%':'');
      $('perfExpectancy').textContent=fmt(stats.expectancy_r??stats.expectancy,2)+'R';
      $('perfLosses').textContent=fmt(stats.losses,0);
      $('paperPerfClosed').textContent=fmt(p.closed,0);
      $('paperPerfWin').textContent=p.win_rate_pct==null?'—':fmt(p.win_rate_pct,1)+'%';
      $('paperPerfExpectancy').textContent=p.expectancy_r==null?'—':fmt(p.expectancy_r,2)+'R';
      $('paperPerfFactor').textContent=p.profit_factor==null?'—':String(p.profit_factor);
      $('paperPerfAssessment').textContent=(p.assessment_message||'Paper analysis unavailable')+' · '+(p.risk_normalized_samples||0)+' risk-normalized sample(s).';
      $('perfRaw').textContent=JSON.stringify({signal_performance:d,paper_performance:p},null,2);
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
      el.innerHTML=d.status==='not_configured'?empty('Economic calendar API is online, but FRED_API_KEY is not configured on the server. No release data will be fabricated.'):rows.length?'<div class="tablewrap"><table><thead><tr><th>Date</th><th>Release</th><th>Country</th><th>Series</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.date||x.release_date||x.datetime)+'</td><td>'+esc(x.name||x.title||x.release_name)+'</td><td>'+esc(x.country||'US')+'</td><td>'+esc(x.series_id||x.id||'FRED')+'</td></tr>').join('')+'</tbody></table></div>':empty('The calendar returned no upcoming releases for this period.');
    }catch(e){showError('calendarFeed',e);}
  }
  async function openPaperTrade(){
    const symbol=$('paperSymbol').value,side=$('paperSide').value,units=Number($('paperUnits').value);
    const entry=$('paperEntry').value.trim(),stop=$('paperStop').value.trim(),target=$('paperTarget').value.trim();
    if(!(units>0)){alert('Enter a positive unit size.');return;}
    try{
      $('paperQuoteStatus').textContent='Submitting simulation to the server…';
      await callJson('/paper/trades','POST',{symbol,side,units,entry_price:entry?Number(entry):null,stop_loss:stop?Number(stop):null,take_profit:target?Number(target):null});
      $('paperEntry').value='';$('paperStop').value='';$('paperTarget').value='';
      await loadPaperTrades();
      $('paperQuoteStatus').textContent='Simulation opened and saved to the persistent ledger.';
    }catch(e){$('paperQuoteStatus').textContent='Could not open simulation: '+e.message;}
  }
  async function closePaperTrade(id){
    if(!confirm('Close this simulated position at the latest available quote?'))return;
    try{await callJson('/paper/trades/'+encodeURIComponent(id)+'/close','POST',{});await loadPaperTrades();}
    catch(e){$('paperQuoteStatus').textContent='Could not close simulation: '+e.message;}
  }
  async function loadPaperTrades(){
    const el=$('paperTrades');if(!el)return;
    el.innerHTML=empty('Refreshing live marks and checking stop/target levels…');
    try{
      const d=await call('/paper/trades?refresh=true',60000),rows=d.trades||[],refresh=d.refresh||{};
      const open=rows.filter(x=>x.status==='OPEN'),closed=rows.filter(x=>x.status==='CLOSED');
      const perf=await call('/paper/performance?refresh=false',30000).catch(()=>({}));
      $('paperOpenCount').textContent=open.length;$('paperClosedCount').textContent=closed.length;
      $('paperWinRate').textContent=perf.win_rate_pct==null?'—':fmt(perf.win_rate_pct,1)+'%';
      $('paperRealized').textContent=fmt(perf.realized_pnl_price_units,5);
      $('paperExpectancy').textContent=perf.expectancy_r==null?'—':fmt(perf.expectancy_r,2)+'R';
      $('paperProfitFactor').textContent=perf.profit_factor==null?'—':String(perf.profit_factor);
      $('paperAssessment').textContent=(perf.assessment_message||'Performance analysis is not available.')+' · '+(perf.closed||0)+' closed sample(s), '+(perf.risk_normalized_samples||0)+' risk-normalized.';
      const groups=Object.entries(perf.by_market||{});
      $('paperMarketBreakdown').innerHTML=groups.length?'<div class="tablewrap"><table><thead><tr><th>Market</th><th>Trades</th><th>Wins</th><th>Losses</th><th>Win rate</th><th>Realized P/L</th></tr></thead><tbody>'+groups.map(([symbol,x])=>'<tr><td>'+esc(symbol)+'</td><td>'+x.trades+'</td><td>'+x.wins+'</td><td>'+x.losses+'</td><td>'+fmt(x.win_rate_pct,1)+'%</td><td>'+fmt(x.realized_pnl_price_units,5)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="live-empty">Market-by-market analysis appears after simulated trades are closed.</div>';
      $('paperEngineState').textContent=refresh.quote_errors?.length?'PARTIAL QUOTES':(refresh.auto_closed?'AUTO EXIT '+refresh.auto_closed:'ENGINE LIVE');
      $('paperQuoteStatus').textContent=refresh.updated+' open positions refreshed · '+refresh.auto_closed+' auto-closed · '+(refresh.quote_errors?.length||0)+' quote errors · '+new Date().toLocaleTimeString();
      el.innerHTML=rows.length?'<div class="tablewrap"><table><thead><tr><th>Market</th><th>Side</th><th>Entry</th><th>Mark / Exit</th><th>Units</th><th>Stop</th><th>Target</th><th>Unrealized</th><th>Realized</th><th>Status</th><th>Action</th></tr></thead><tbody>'+rows.map(x=>{
        const pnl=x.status==='OPEN'?x.unrealized_pnl:x.realized_pnl;
        const price=x.status==='OPEN'?x.current_price:x.exit_price;
        return '<tr><td>'+esc(x.symbol)+'</td><td>'+esc(x.side)+'</td><td>'+fmt(x.entry_price,6)+'</td><td>'+fmt(price,6)+'</td><td>'+fmt(x.units,3)+'</td><td>'+fmt(x.stop_loss,6)+'</td><td>'+fmt(x.take_profit,6)+'</td><td>'+ (x.status==='OPEN'?fmt(pnl,5):'—')+'</td><td>'+ (x.status==='CLOSED'?fmt(pnl,5):'—')+'</td><td>'+esc(x.status)+(x.close_reason?' · '+esc(x.close_reason):'')+(x.last_quote_error?' · quote unavailable':'')+'</td><td>'+(x.status==='OPEN'?'<button class="small-action" data-paper-close="'+esc(x.id)+'">Close at quote</button>':'')+'</td></tr>';
      }).join('')+'</tbody></table></div>':'<div class="empty">No simulated positions yet. Open your first position above.</div>';
    }catch(e){showError('paperTrades',e);$('paperQuoteStatus').textContent='Simulation engine unavailable: '+e.message;}
  }
  async function loadPaperQuotes(){await loadPaperTrades();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();