import {enter,initMotion} from './motion.js';
const icons={"chart": "<path d=\"M4 21V12h4v9M10 21V3h4v18M16 21V8h4v13\"/>", "trophy": "<path d=\"M8 3h8v5a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 0v6m-5 3h10m-8 0v-3h6v3\"/>", "users": "<circle cx=\"9\" cy=\"7\" r=\"3\"/><path d=\"M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2\"/>", "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 6v6l4 2\"/>", "map": "<path d=\"m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16\"/>", "swords": "<path d=\"m3 3 5 1 12 14-2 2L4 8 3 3Zm18 0-5 1-5 6m-3 3-4 5 2 2 4-4M3 21l3-3m12 0 3 3M2 16l6 6m8 0 6-6\"/>", "lock": "<rect x=\"5\" y=\"10\" width=\"14\" height=\"11\" rx=\"2\"/><path d=\"M8 10V7a4 4 0 0 1 8 0v3m-4 5v2\"/>"};
const iconSvg=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.chart}</svg>`;
import{getDashboard,getPlayerStats,teamStats,sessions,getTeamPlayers,getTrophyRanking}from'./data.js';
const $=s=>document.querySelector(s);let period='month',request=0,allPlayers=[],searchActive=false,rankingState='loading';const date=d=>new Date(d+'T12:00:00Z').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',timeZone:'UTC'}).replace('.','');const year=d=>String(d).slice(0,4);const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const initials=p=>escape(p.name.slice(0,2).toUpperCase());const rate=p=>`<span class="rate"><span class="bar"><i style="width:${p.rate}%"></i></span><strong>${p.rate}%</strong></span>`;
const playerPortrait=()=>`<span class="club-avatar" aria-hidden="true"><img src="player-emblem.png" alt="" width="64" height="64" decoding="async"></span>`;

// A season changes at midnight in Sao Paulo, regardless of visitor timezone.
const brazilSeasonYear=()=>Number(new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric"}).format(new Date()));
let activeSeasonYear=brazilSeasonYear();
function updateSeasonLabels(){
 const heading=$("#season-year"),footer=$("#copyright-year");
 if(heading)heading.textContent="/ "+activeSeasonYear;
 if(footer)footer.textContent="© "+activeSeasonYear+" Celestial Host";
}
function refreshSeason(){
 const next=brazilSeasonYear();
 if(next===activeSeasonYear)return;
 activeSeasonYear=next;
 monthsInitialized=false;
 updateSeasonLabels();
 load();
}
updateSeasonLabels();
setInterval(refreshSeason,30000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshSeason();});
function renderRanking(players){players=players.slice(0,10);if(!players.length){$('#ranking-content').innerHTML='<div class="state">Ainda não há treinos registrados neste período.<br>O ranking será preenchido quando o bot salvar os primeiros resultados.</div>';return;}$('#ranking-content').innerHTML=`<div class="ranking-wrap"><table><caption class="sr">Ranking de jogadores por confrontos vencidos</caption><thead><tr><th scope="col">Pos.</th><th scope="col">Jogador</th><th scope="col">Tag</th><th scope="col">Treinos<br>jogados</th><th scope="col">Confrontos<br>vencidos</th><th scope="col">Confrontos<br>perdidos</th><th scope="col">Mapas<br>vencidos</th><th scope="col">Mapas<br>perdidos</th><th scope="col">Taxa de<br>vitória</th></tr></thead><tbody>${players.map((p,i)=>`<tr class="rank-${i+1}"><td><span class="rank-number">${String(i+1).padStart(2,'0')}</span></td><td><span class="player">${playerPortrait()}${escape(p.name)}</span></td><td class="tag">${escape(p.tag)}</td><td>${p.trainings}</td><td class="win">${p.wins}</td><td class="loss">${p.losses}</td><td>${p.mapsWon}</td><td class="loss">${p.mapsLost}</td><td>${rate(p)}</td></tr>`).join('')}</tbody></table></div><div class="mobile-ranking">${players.map((p,i)=>`<article class="player-card rank-${i+1}"><div class="player-top"><span class="rank-number">${i+1}</span>${playerPortrait()}<div><strong>${escape(p.name)}</strong><span class="tag">${escape(p.tag)}</span></div>${rate(p)}</div><div class="player-card-stats"><div><small>Treinos jogados</small><strong>${p.trainings}</strong></div><div><small>Confrontos</small><strong>${p.wins} V <span class="loss">/ ${p.losses} D</span></strong></div><div><small>Mapas</small><strong>${p.mapsWon} V <span class="loss">/ ${p.mapsLost} D</span></strong></div></div></article>`).join('')}</div>`;}
async function load(){
 const id=++request;
 const requestedMonth=$('#month').value;
 $('#ranking-content').setAttribute('aria-busy','true');
 $('#ranking-content').innerHTML='<div class="ranking-loading" role="status"><span class="ranking-spinner" aria-hidden="true"></span><span>CARREGANDO TREINOS...</span></div>';
 allPlayers=[];rankingState='loading';$('#search-submit').disabled=true;
 if(searchActive)renderPlayerSearch();
 try{
  const data=await getDashboard({period,month:requestedMonth});
  if(id!==request)return;
  updateMonthOptions(data.months||[]);
  updateTrainingPicker();
  if(period==='month'&&data.months?.length&&requestedMonth!==$('#month').value)return load();
  renderMatches();
  allPlayers=data.players;rankingState='ready';$('#search-submit').disabled=false;
  renderRanking(allPlayers);if(searchActive)renderPlayerSearch();
  $('#ranking-content').setAttribute('aria-busy','false');
  enter(document.querySelectorAll('.ranking-wrap tbody tr,.player-card'),{distance:5,stagger:18,duration:260});
  $('#summary').innerHTML=[['Treinos realizados',data.summary.trainings,'no período selecionado','swords'],['Mapas disputados',data.summary.maps,'cada mapa, uma oportunidade','map'],['Jogadores ranqueados',data.summary.players,'na disputa pelo topo','users'],['Última atualização',data.summary.updated,'','clock']].map(([label,value,sub,icon])=>`<article><span class="stat-icon" aria-hidden="true">${iconSvg(icon)}</span><span class="stat-label">${label}</span><strong>${value}</strong>${sub?'<small>'+sub+'</small>':''}</article>`).join('');
  enter(document.querySelectorAll('.summary article'),{distance:6,stagger:30,duration:300});
 }catch(e){
  if(id!==request)return;
  $('#ranking-content').setAttribute('aria-busy','false');
  $('#ranking-content').innerHTML='<div class="state" role="alert">Não foi possível carregar os resultados.<button id="retry">Tentar novamente</button></div>';
  $('#retry').onclick=load;rankingState='error';$('#search-submit').disabled=false;
  if(searchActive)renderPlayerSearch();
 }
}
document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{period=b.dataset.period;document.querySelectorAll('[data-period]').forEach(x=>x.setAttribute('aria-pressed',x===b));$('#month').disabled=period==='all'||!sessions.length;refreshRankingMonthMenu();load();});$('#month').onchange=load;
function monthLabel(value){
 const [year,month]=value.split('-').map(Number);
 return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,1)));
}
let monthsInitialized=false;
function updateMonthOptions(months){
 const select=$('#month'),selected=monthsInitialized?select.value:'';
 const available=[...new Set(months.filter(month=>/^\d{4}-(0[1-9]|1[0-2])$/.test(month)))].sort().reverse();
 select.innerHTML=available.length?available.map(value=>`<option value="${value}">${monthLabel(value)}</option>`).join(''):'<option value="">Nenhum treino registrado</option>';
 if(monthsInitialized&&available.includes(selected))select.value=selected;
 else if(available.length)select.value=available[0];
 monthsInitialized=true;
 select.disabled=period==='all'||!available.length;
 refreshRankingMonthMenu();
}
function updateTrainingPicker(){
 const select=$('#training'),selected=select.value;
 select.innerHTML=sessions.length?sessions.map(session=>`<option value="${escape(session.id)}">${escape(session.name)} · ${date(session.date)} ${year(session.date)}</option>`).join():'<option value="">Nenhum treino registrado</option>';
 select.disabled=!sessions.length;
 if(sessions.some(session=>String(session.id)===selected))select.value=selected;
 refreshTrainingMenu();
}


/* Ranking months share the same dark visual menu as the training selector.
   Keep the original <select> as the source of truth for period, search and API. */
function refreshRankingMonthMenu(){
 const root=$('#ranking-month-menu'),select=$('#month'),trigger=$('#ranking-month-trigger'),list=$('#ranking-month-list');
 if(!root?.classList.contains('is-enhanced'))return;
 const options=[...select.options].filter(option=>option.value);
 const selected=select.selectedOptions[0];
 trigger.disabled=select.disabled||period==='all'||!options.length;
 trigger.querySelector('.training-menu-value').textContent=selected?.value?selected.textContent:'';
 list.hidden=true;root.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');
 list.innerHTML=options.map((option,index)=>{
  const chosen=option.value===select.value;
  return '<div role="option" class="training-menu-option'+(chosen?' is-selected':'')+
   '" data-value="'+escape(option.value)+'" aria-selected="'+chosen+'" tabindex="-1">'+
   '<span class="training-menu-option-icon" aria-hidden="true">'+iconSvg('clock')+'</span>'+
   '<span class="training-menu-option-title">'+escape(option.textContent)+'</span>'+
   
   '<span class="training-menu-check" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 4 4L19 6"/></svg></span></div>';
 }).join('');
}
function initRankingMonthMenu(){
 const root=$('#ranking-month-menu'),select=$('#month'),trigger=$('#ranking-month-trigger'),list=$('#ranking-month-list');
 if(!root||!select||!trigger||!list)return;
 const items=()=>[...list.querySelectorAll('[role="option"]')];
 const close=(restoreFocus=false)=>{
  if(list.hidden)return;
  list.hidden=true;root.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');
  if(restoreFocus)trigger.focus({preventScroll:true});
 };
 const focusIndex=(index)=>{
  const options=items();if(!options.length)return;
  const item=options[Math.max(0,Math.min(index,options.length-1))];
  item.focus({preventScroll:true});item.scrollIntoView({block:'nearest'});
 };
 const open=(direction='selected')=>{
  if(trigger.disabled)return;
  list.hidden=false;root.classList.add('is-open');trigger.setAttribute('aria-expanded','true');
  const options=items(),selectedIndex=options.findIndex(option=>option.dataset.value===select.value);
  focusIndex(direction==='first'?0:direction==='last'?options.length-1:Math.max(0,selectedIndex));
 };
 const choose=(item)=>{
  if(!item)return;
  select.value=item.dataset.value;
  select.dispatchEvent(new Event('change',{bubbles:true}));
  refreshRankingMonthMenu();
  trigger.focus({preventScroll:true});
 };
 trigger.addEventListener('click',()=>list.hidden?open():close());
 trigger.addEventListener('keydown',event=>{
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();open(event.key==='ArrowUp'||event.key==='End'?'last':'selected');
  }else if(event.key==='Escape')close(true);
 });
 list.addEventListener('click',event=>{
  const item=event.target.closest('[role="option"]');
  if(item&&list.contains(item))choose(item);
 });
 list.addEventListener('keydown',event=>{
  const options=items(),index=options.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();
   const target=event.key==='Home'?0:event.key==='End'?options.length-1:
     event.key==='ArrowUp'?Math.max(0,index-1):Math.min(options.length-1,index+1);
   focusIndex(target);
  }else if(event.key==='Enter'||event.key===' '){
   event.preventDefault();choose(options[index]);
  }else if(event.key==='Escape'){
   event.preventDefault();close(true);
  }else if(event.key==='Tab')close();
 });
 document.addEventListener('pointerdown',event=>{if(!root.contains(event.target))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!list.hidden){event.preventDefault();close(true);}});
 select.tabIndex=-1;select.setAttribute('aria-hidden','true');
 root.classList.add('is-enhanced');refreshRankingMonthMenu();
}

function refreshTrainingMenu(){
 const root=$('#training-menu'),select=$('#training'),trigger=$('#training-menu-trigger'),list=$('#training-menu-list');
 if(!root?.classList.contains('is-enhanced'))return;
 const options=[...select.options].filter(option=>option.value);
 const selected=select.selectedOptions[0];
 trigger.disabled=select.disabled||!options.length;
 trigger.querySelector('.training-menu-value').textContent=selected?.textContent||'Nenhum treino registrado';
 list.hidden=true;root.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');
 list.innerHTML=options.map((option,index)=>{
  const chosen=option.value===select.value;
  return '<div role="option" class="training-menu-option'+(chosen?' is-selected':'')+'" data-value="'+escape(option.value)+'" aria-selected="'+chosen+'" tabindex="-1">'+
   '<span class="training-menu-option-icon" aria-hidden="true">'+iconSvg('clock')+'</span>'+
   '<span class="training-menu-option-title">'+escape(option.textContent)+'</span>'+
   (index===0?'<span class="training-menu-newest">MAIS RECENTE</span>':'')+
   '<span class="training-menu-check" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 4 4L19 6"/></svg></span></div>';
 }).join('');
}
function initTrainingMenu(){
 const root=$('#training-menu'),select=$('#training'),trigger=$('#training-menu-trigger'),list=$('#training-menu-list');
 if(!root||!select||!trigger||!list)return;
 const items=()=>[...list.querySelectorAll('[role="option"]')];
 const close=(restoreFocus=false)=>{
  if(list.hidden)return;
  list.hidden=true;root.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');
  if(restoreFocus)trigger.focus({preventScroll:true});
 };
 const focusIndex=(index)=>{
  const options=items();if(!options.length)return;
  const item=options[Math.max(0,Math.min(index,options.length-1))];
  item.focus({preventScroll:true});item.scrollIntoView({block:'nearest'});
 };
 const open=(direction='selected')=>{
  if(trigger.disabled)return;
  list.hidden=false;root.classList.add('is-open');trigger.setAttribute('aria-expanded','true');
  const options=items(),selectedIndex=options.findIndex(option=>option.dataset.value===select.value);
  focusIndex(direction==='first'?0:direction==='last'?options.length-1:Math.max(0,selectedIndex));
 };
 const choose=(item)=>{
  if(!item)return;
  select.value=item.dataset.value;
  select.dispatchEvent(new Event('change',{bubbles:true}));
  refreshTrainingMenu();
  trigger.focus({preventScroll:true});
 };
 trigger.addEventListener('click',()=>list.hidden?open():close());
 trigger.addEventListener('keydown',event=>{
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();open(event.key==='ArrowUp'||event.key==='End'?'last':'first');
  }else if(event.key==='Escape')close(true);
 });
 list.addEventListener('click',event=>{
  const item=event.target.closest('[role="option"]');
  if(item&&list.contains(item))choose(item);
 });
 list.addEventListener('keydown',event=>{
  const options=items(),index=options.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();
   const target=event.key==='Home'?0:event.key==='End'?options.length-1:event.key==='ArrowUp'?Math.max(0,index-1):Math.min(options.length-1,index+1);
   focusIndex(target);
  }else if(event.key==='Enter'||event.key===' '){
   event.preventDefault();choose(options[index]);
  }else if(event.key==='Escape'){
   event.preventDefault();close(true);
  }else if(event.key==='Tab')close();
 });
 document.addEventListener('pointerdown',event=>{if(!root.contains(event.target))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!list.hidden){event.preventDefault();close(true);}});
 select.tabIndex=-1;select.setAttribute('aria-hidden','true');
 root.classList.add('is-enhanced');refreshTrainingMenu();
}

function renderMatches(){
 const session=sessions.find(s=>String(s.id)===$('#training').value);
 if(!session){$('#matches').innerHTML='<p class="state">Nenhum treino disponível.</p>';$('#training-title').textContent='';$('#match-count').textContent='';return;}
 $('#training-title').textContent=`${session.name} · ${date(session.date)} de ${year(session.date)}`;
 $('#match-count').textContent=`${session.matches.length} confrontos`;
 const statusLabels={pending:'Pendente',decided:'Resultado registrado',extended:'Série estendida',finished:'Finalizado'};
 $('#matches').innerHTML=session.matches.length?session.matches.map((m,i)=>{
  const teamA=session.teams.find(team=>String(team.id)===String(m.a));
  const teamB=session.teams.find(team=>String(team.id)===String(m.b));
  if(!teamA||!teamB)return '';
  const status=statusLabels[m.status]||'Finalizado';
  const foot=m.status==='pending'?'Aguardando resultado':m.extended?`Série estendida: ${m.mapsA} × ${m.mapsB}`:'Confronto encerrado';
  return `<article class="match"><div class="match-meta"><span>Confronto ${String(m.number||i+1).padStart(2,'0')}</span><span class="status">${status}</span></div><div class="score"><button class="team-link ${m.mapsA<m.mapsB?'loser':''}" data-session="${escape(session.id)}" data-team="${escape(teamA.id)}">${escape(teamA.name)}</button><strong><span class="${m.mapsA<m.mapsB?'loser':''}">${m.mapsA}</span><em>×</em><span class="${m.mapsB<m.mapsA?'loser':''}">${m.mapsB}</span></strong><button class="team-link ${m.mapsB<m.mapsA?'loser':''}" data-session="${escape(session.id)}" data-team="${escape(teamB.id)}">${escape(teamB.name)}</button></div><div class="match-foot"><span>${m.mapsA+m.mapsB} mapas disputados</span><span class="${m.extended?'extended':''}">${foot}</span></div><button class="roster-button" data-session="${escape(session.id)}" data-match="${escape(m.id)}" aria-label="Ver detalhes de ${escape(teamA.name)} contra ${escape(teamB.name)}">${iconSvg('users')} Ver times e desempenho</button></article>`
 }).join(''):'<p class="state">Nenhum confronto registrado neste treino.</p>';
}
$('#training').onchange=()=>{renderMatches();enter(document.querySelectorAll('.match'),{distance:9,stagger:42,duration:410});};initTrainingMenu();initRankingMonthMenu();renderMatches();load();$('#contact').onclick=()=>$('#contact-dialog').showModal();$('#close-dialog').onclick=()=>$('#contact-dialog').close();$('#contact-dialog').onclick=e=>{if(e.target===$('#contact-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};

document.querySelectorAll("[data-icon]").forEach(el=>el.innerHTML=iconSvg(el.dataset.icon));

initMotion();

const rosterDialog=$('#team-dialog');
document.addEventListener('click',event=>{
 const trigger=event.target.closest('button[data-session]');if(!trigger)return;
 const session=sessions.find(s=>s.id===trigger.dataset.session);if(!session)return;
 const match=session.matches.find(m=>m.id===trigger.dataset.match);
 const selected=match ? session.teams.filter(t=>t.id===match.a||t.id===match.b) : session.teams.filter(t=>String(t.id)===String(trigger.dataset.team));
 if(!selected.length)return;
 $('#team-dialog-title').textContent=match?'Times do confronto':`${selected[0].name} · Detalhes`;
 $('#team-dialog-context').textContent=`${session.name} · ${date(session.date)} de ${year(session.date)}`;
 $('#team-dialog-content').innerHTML=selected.map(team=>{const stats=teamStats(session).find(t=>t.id===team.id);return `<section class="roster-team"><h3>${escape(team.name)}</h3><p class="team-performance-label">Desempenho neste treino</p><dl class="team-performance"><div><dt>Confrontos</dt><dd>${stats.played}</dd></div><div><dt>Vitórias</dt><dd>${stats.wins}</dd></div><div><dt>Derrotas</dt><dd>${stats.losses}</dd></div><div><dt>Mapas V / D</dt><dd>${stats.mapsWon} / ${stats.mapsLost}</dd></div></dl><ul>${getTeamPlayers(session.id,team.id).map(p=>`<li>${playerPortrait()}<span><strong>${escape(p.name)}</strong><span class="tag">${escape(p.tag)}</span></span></li>`).join('')}</ul></section>`}).join('');
 rosterDialog.showModal();
});
$('#close-team-dialog').onclick=()=>rosterDialog.close();
rosterDialog.addEventListener('click',event=>{if(event.target!==rosterDialog)return;const r=rosterDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)rosterDialog.close();});

function normalizeTag(value){return String(value||'').replace(/\s+/g,'').toUpperCase().replace(/^#/,'');}
let playerSearchRequest=0;
async function renderPlayerSearch(){
 const result=$('#player-search-result'),tag=normalizeTag($('#player-tag').value),requestId=++playerSearchRequest;
 if(!tag){result.innerHTML='<p class="search-message">Digite sua tag para consultar.</p>';return;}
 if(!/^[A-Z0-9]+$/.test(tag)){result.innerHTML='<p class="search-message">Confira a tag: use apenas letras e números, com ou sem #.</p>';return;}
 result.innerHTML='<p class="search-message">Carregando estatísticas do período…</p>';
 try{
  const {player:p,registered}=await getPlayerStats('#'+tag,{period,month:$('#month').value});
  if(requestId!==playerSearchRequest)return;
  if(!p){
   if(registered===true){
    const message=period==='all'
     ? 'Esta tag está cadastrada, mas ainda não possui estatísticas nesta temporada.'
     : 'Esta tag está cadastrada, mas não possui estatísticas no mês selecionado.';
    result.innerHTML=`<p class="search-message">${message}</p>`;
   }else if(registered===null){
    result.innerHTML='<p class="search-message">Selecione um mês para consultar as estatísticas.</p>';
   }else{
    result.innerHTML='<p class="search-message">Nenhum jogador cadastrado com essa tag.</p>';
   }
   return;
  }
  const index=allPlayers.findIndex(player=>normalizeTag(player.tag)===tag);
  const position=index>=0?(index+1)+'º lugar':'';
  const label=period==='all'?`Temporada ${activeSeasonYear}`:$('#month').selectedOptions[0].textContent;
  result.innerHTML=`<article class="lookup-result"><div class="lookup-player">${playerPortrait()}<div><strong>${escape(p.name)}</strong><span class="tag">${escape(p.tag)}</span></div><span class="lookup-position">${position}</span></div><p class="lookup-period">${escape(label)}</p><dl class="lookup-stats">${[['Treinos jogados',p.trainings],['Confrontos vencidos',p.wins],['Confrontos perdidos',p.losses],['Mapas vencidos',p.mapsWon],['Mapas perdidos',p.mapsLost],['Taxa de vitória',p.rate+'%']].map(([name,value])=>`<div><dt>${name}</dt><dd>${value}</dd></div>`).join('')}</dl></article>`;
 }catch{
  if(requestId!==playerSearchRequest)return;
  result.innerHTML='<p class="search-message">Não foi possível consultar. Tente carregar o ranking novamente.</p>';
 }
}
$('#player-search').onsubmit=event=>{event.preventDefault();searchActive=true;renderPlayerSearch();};
$('#player-tag').oninput=()=>{searchActive=false;playerSearchRequest++;$('#player-search-result').innerHTML='';};

const compactSearch=matchMedia('(min-width:1100px)');
function positionSearch(){
 const lookup=$('#player-lookup'),result=$('#player-search-result');
 $(compactSearch.matches?'#lookup-desktop-slot':'#lookup-mobile-slot').append(lookup);
 (compactSearch.matches?$('#lookup-desktop-result'):lookup).append(result);
 $('#search-submit').textContent=compactSearch.matches?'Buscar':'Consultar estatísticas';
}
compactSearch.addEventListener('change',positionSearch);positionSearch();
/* Independent trophies leaderboard; train rankings are untouched. */
let trophyLastLoaded=0,trophyRequest=0;
const trophyFormatter=new Intl.NumberFormat('pt-BR');
function trophyEmpty(){
 return '<div class="trophy-empty"><span class="trophy-empty-icon" aria-hidden="true">'+iconSvg('trophy')+'</span><h3>Ranking em preparação</h3><p>Aguardando a primeira sincronização de troféus do Zeus Bot.</p></div>';
}
function trophyUpdated(date){
 if(!date)return 'Aguardando primeira sincronização';
 const parsed=new Date(date);
 return Number.isNaN(parsed.getTime())?'Última sincronização indisponível':'Atualizado em '+new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(parsed);
}
function renderTrophyRanking(data){
 const players=data.players.slice(0,10);
 $('#trophy-updated').textContent=trophyUpdated(data.updatedAt);
 if(!players.length){$('#trophy-content').innerHTML=trophyEmpty();return;}
 const rows=players.map((p,i)=>{
  const n=i+1;
  return '<tr class="trophy-position-'+n+'"><td><span class="trophy-rank-number">'+String(n).padStart(2,'0')+'</span></td>'+
   '<td><div class="trophy-player">'+playerPortrait()+'<span class="trophy-player-name"><strong>'+escape(p.name)+'</strong><small>'+escape(p.tag)+'</small></span></div></td>'+
   '<td><span class="trophy-division">'+escape(p.division)+'</span></td>'+
   '<td class="trophy-score">'+trophyFormatter.format(p.trophies)+'</td></tr>';
 }).join('');
 const cards=players.map((p,i)=>{
  const n=i+1;
  return '<article class="trophy-player-card trophy-position-'+n+'">'+
   '<div class="trophy-card-header"><span class="trophy-rank-number">'+String(n).padStart(2,'0')+'</span>'+playerPortrait()+
   '<div class="trophy-player-name"><strong>'+escape(p.name)+'</strong><small>'+escape(p.tag)+'</small></div></div>'+
   '<div class="trophy-card-bottom"><span class="trophy-division">'+escape(p.division)+'</span>'+
   '<strong class="trophy-score">'+trophyFormatter.format(p.trophies)+' <small>troféus</small></strong></div></article>';
 }).join('');
 $('#trophy-content').innerHTML='<div class="trophy-table-scroll"><table class="trophy-table">'+
  '<caption class="sr">Top 10 de troféus entre os clubes Celestial Host</caption>'+
  '<thead><tr><th scope="col">POS.</th><th scope="col">JOGADOR</th><th scope="col">DIVISÃO</th><th scope="col">TROFÉUS</th></tr></thead>'+
  '<tbody>'+rows+'</tbody></table></div><div class="trophy-mobile-list">'+cards+'</div>';
}
async function loadTrophyRanking(force=false){
 if(!force&&trophyLastLoaded&&Date.now()-trophyLastLoaded<300000)return;
 const id=++trophyRequest,button=$('#trophy-refresh'),panel=$('#trophy-content');
 if(!panel)return;
 panel.setAttribute('aria-busy','true');button.disabled=true;
 panel.innerHTML='<div class="trophy-loading" role="status"><span class="ranking-spinner" aria-hidden="true"></span><span>CARREGANDO TROFÉUS...</span></div>';
 try{
  const data=await getTrophyRanking();
  if(id!==trophyRequest)return;
  renderTrophyRanking(data);trophyLastLoaded=Date.now();
 }catch{
  if(id!==trophyRequest)return;
  $('#trophy-updated').textContent='Não foi possível atualizar';
  panel.innerHTML='<div class="trophy-empty"><span class="trophy-empty-icon" aria-hidden="true">'+iconSvg('trophy')+'</span><h3>Falha ao consultar o ranking</h3><p>Não foi possível carregar os dados. Tente novamente.</p></div>';
  trophyLastLoaded=0;
 }finally{
  if(id===trophyRequest){panel.setAttribute('aria-busy','false');button.disabled=false;}
 }
}
$('#trophy-refresh').addEventListener('click',()=>loadTrophyRanking(true));

function showView(focus=false){
 const hash=location.hash.slice(1);const route=['treinos','rankings','sobre-nos'].includes(hash)?hash:'treinos';
 document.querySelectorAll('.site-view').forEach(view=>{view.hidden=view.id!==(route==='treinos'?'view-treinos':route);});
 $('#conteudo').dataset.view=route;
 if(route==='rankings')loadTrophyRanking();
 document.querySelectorAll('nav [data-view]').forEach(a=>{const selected=a.dataset.view===route;a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 document.title=`${{treinos:'Treinos',rankings:'Rankings','sobre-nos':'Sobre Nós'}[route]} · Celestial Rankings`;
 if(focus){$('#'+(route==='treinos'?'view-treinos':route)).focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}
window.addEventListener('hashchange',()=>showView(true));showView();
