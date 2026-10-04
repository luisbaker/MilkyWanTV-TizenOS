(function(){
  'use strict';
  var $=function(id){return document.getElementById(id);},D=window.MilkyData;
  var defaults={m3u:'http://tv.milkywan.fr/milkywan.m3u',epg:'http://tv.milkywan.fr/epg.xml'};
  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback;}catch(e){return fallback;}}
  function status(value){$('status').textContent=value;$('status').hidden=!value;}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(e){status('Mémoire locale indisponible : les réglages ne seront pas conservés.');}}
  var saved=read('mw.settings',defaults),sources={m3u:D.safeURL(saved.m3u)||defaults.m3u,epg:D.safeURL(saved.epg)||defaults.epg};
  var favorites=read('mw.favorites',[]);if(!Array.isArray(favorites))favorites=[];
  var channels=[],filtered=[],selected=null,playing=null,epg={programmes:{},names:{}},favoriteOnly=false,group='',loadToken=0,playToken=0;
  var ui='channels',tabIndex=0,tabIds=['infos','audio','subtitles','nerds-tab','options-tab'],panelIds=['info-panel','audio-panel','subtitles-panel','nerds-tab-panel','options-tab-panel'];
  var hideTimer=null,playTimer=null,subtitleTimer=null,busy=false,pendingChannel=null,subtitlesEnabled=false,chosenTracks={};
  var av=(window.webapis&&window.webapis.avplay)||(window.MilkyWebPlayer&&window.MilkyWebPlayer.create($('web-video')));
  if(av&&av.isWeb)document.body.classList.add('web-mode');
  function resizeUI(){var scale=Math.min((window.innerWidth||1920)/1920,(window.innerHeight||1080)/1080);$('app').style.transform='translate(-50%, -50%) scale('+scale+')';}resizeUI();window.addEventListener('resize',resizeUI);
  function networkURL(url){return av&&av.isWeb?av.routeURL(url):url;}
  function text(tag,value,className){var el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;}
  function time(ms){return new Date(ms).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}
  function request(url){return new Promise(function(resolve,reject){var xhr=new XMLHttpRequest();xhr.open('GET',networkURL(url),true);xhr.timeout=30000;xhr.onload=function(){if(xhr.status>=200&&xhr.status<300)resolve(xhr.responseText);else reject(new Error('Serveur HTTP '+xhr.status));};xhr.onerror=function(){reject(new Error('Accès réseau impossible'));};xhr.ontimeout=function(){reject(new Error('Le serveur ne répond pas'));};xhr.send();});}
  function schedule(ch){return ch?D.schedule(ch,epg,Date.now()):[];}
  function isFavorite(ch){return favorites.indexOf(ch.key)!==-1;}
  function progress(p){var track=text('div','','progress'),bar=text('span','');bar.style.width=percent(p,Date.now())+'%';track.appendChild(bar);return track;}
  function fillLogo(box,ch){box.textContent='';if(ch&&ch.logo){var img=document.createElement('img');img.alt='';img.decoding='async';img.src=networkURL(ch.logo);img.onerror=function(){box.textContent=ch.name;};box.appendChild(img);}else box.textContent=ch?ch.name:'TV';}
  var rows={},selectedButton=null;
  function select(ch){selected=ch;var row=rows[ch.key],b=row&&row.button;if(b===selectedButton)return;if(selectedButton){selectedButton.classList.remove('selected');selectedButton.setAttribute('aria-pressed','false');}selectedButton=b||null;if(b){b.classList.add('selected');b.setAttribute('aria-pressed','true');}if(ui==='channels'&&typeof schedulePrebuffer==='function')schedulePrebuffer('focus',ch,700);}
  function percent(p,now){return p&&p.start<=now?Math.max(0,Math.min(100,(now-p.start)/(p.stop-p.start)*100)):0;}
  // Update programme titles and progress bars in place; never rebuild the list (keeps logos and focus intact).
  function refreshRows(){var now=Date.now();filtered.forEach(function(ch){var row=rows[ch.key];if(!row)return;var p=schedule(ch)[0],title=p?p.title:'Programme indisponible';if(row.small.textContent!==title)row.small.textContent=title;row.bar.style.width=percent(p,now)+'%';});}
  function render(focusKey){var query=$('search').value.toLowerCase();filtered=channels.filter(function(ch){return (!favoriteOnly||isFavorite(ch))&&(!group||ch.group===group)&&ch.name.toLowerCase().indexOf(query)!==-1;});
    $('channels').textContent='';rows={};selectedButton=null;$('all').classList.toggle('active',!favoriteOnly);$('favorites').classList.toggle('active',favoriteOnly);
    var fragment=document.createDocumentFragment();filtered.forEach(function(ch){var b=text('button','');b.dataset.key=ch.key;b.appendChild(text('span',ch.number,'number'));var logo=text('span','','logo');fillLogo(logo,ch);b.appendChild(logo);var body=text('span','','channel-text');body.appendChild(text('strong',ch.name));var p=schedule(ch)[0],small=text('small',p?p.title:'Programme indisponible'),track=progress(p);body.appendChild(small);body.appendChild(track);b.appendChild(body);rows[ch.key]={button:b,small:small,bar:track.firstChild};if(isFavorite(ch))b.appendChild(text('span','★','star'));b.appendChild(text('span','','row-indicator'));b.onfocus=function(){select(ch);};b.onclick=function(){start(ch);};fragment.appendChild(b);});$('channels').appendChild(fragment);
    if(!filtered.length){$('channels').appendChild(text('p',favoriteOnly?'Aucun favori. Utilisez le bouton bleu sur une chaîne pour l’ajouter.':'Aucune chaîne trouvée. Bouton rouge : options.'));selected=null;}
    else select(filtered.filter(function(ch){return selected&&ch.key===selected.key;})[0]||filtered[0]);
    if(focusKey&&ui==='channels'&&!dialogOpen())focusChannel(focusKey);
  }
  function focusChannel(key){var buttons=$('channels').querySelectorAll('button'),target=buttons[0];for(var i=0;i<buttons.length;i++)if(buttons[i].dataset.key===key)target=buttons[i];if(target){target.focus();target.scrollIntoView({block:'nearest'});}else $('video-hit').focus();}
  function toggleFavorite(){var ch=favoriteTarget();if(!ch)return;var key=ch.key,index=favorites.indexOf(key);if(index<0)favorites.push(key);else favorites.splice(index,1);write('mw.favorites',favorites);render(ui==='channels'?key:null);}
  function load(){if(av&&av.isWeb&&window.location.protocol==='file:'){status('Sur PC, ouvrez Lancer-PC.command (Mac) ou Lancer-PC.bat (Windows) pour lancer la version web locale.');return;}var token=++loadToken;status('Chargement des chaînes…');request(sources.m3u).then(function(body){if(token!==loadToken)return;channels=D.parseM3U(body,sources.m3u);epg={programmes:{},names:{}};render(document.activeElement.dataset.key);if(ui==='channels'&&!dialogOpen())focusChannel(selected&&selected.key);var cached=read('mw.epg',null);if(cached&&cached.src===sources.epg&&cached.epg){epg=cached.epg;refreshRows();updateBanner();status('');}else status('Chargement du guide…');var src=sources.epg;return loadEPG(src).then(function(result){if(token!==loadToken)return;epg=result;refreshRows();updateBanner();status('');setTimeout(function(){try{localStorage.setItem('mw.epg',JSON.stringify({src:src,time:Date.now(),epg:result}));}catch(e){try{localStorage.removeItem('mw.epg');}catch(ignore){}}},3000);},function(error){if(token!==loadToken)return;if(!cached)status('Guide indisponible : '+error.message+'. Les chaînes restent accessibles.');});}).catch(function(error){if(token===loadToken)status(error.message+'. Vérifiez votre connexion MilkyWan ou les adresses dans les options (bouton rouge).');});}
  // The 20+ MB XMLTV file is downloaded and parsed in a Web Worker; main-thread parsing is only a fallback.
  function loadEPG(url){var target=networkURL(url);return new Promise(function(resolve,reject){var worker,done=false;
      function fallback(){if(done)return;done=true;if(worker)worker.terminate();request(url).then(function(xml){resolve(D.parseEPGText(xml,Date.now()));}).catch(reject);}
      try{worker=new Worker('epg-worker.js');}catch(e){fallback();return;}
      worker.onmessage=function(event){if(done)return;done=true;worker.terminate();if(event.data.error)reject(new Error(event.data.error));else resolve(event.data.epg);};
      worker.onerror=function(event){if(event&&event.preventDefault)event.preventDefault();fallback();};
      worker.postMessage({url:new URL(target,window.location.href).href});});}
  function dialogOpen(){return ['options-modal','modal','exit-modal'].some(function(id){return !$(id).hidden;});}
  function armHide(){clearTimeout(hideTimer);if(playing&&!busy&&!dialogOpen()&&$('play-status').hidden)hideTimer=setTimeout(hideUI,8000);}
  function hideUI(){clearTimeout(hideTimer);if(!playing||dialogOpen())return;ui='video';$('home').hidden=true;$('banner').hidden=true;document.body.classList.remove('banner-open');$('video-hit').focus();}
  function showChannels(keepFilter){clearTimeout(hideTimer);ui='channels';$('banner').hidden=true;document.body.classList.remove('banner-open');$('home').hidden=false;
    // Always reopen the list at the channel currently being watched.
    if(!keepFilter&&playing&&!filtered.some(function(ch){return ch.key===playing.key;})){favoriteOnly=false;group='';$('search').value='';$('group').textContent='Groupe : tous';render();}
    focusChannel(playing?playing.key:selected&&selected.key);armHide();
  }
  function updateBanner(){var ch=playing||selected;if(!ch)return;fillLogo($('banner-logo'),ch);$('banner-channel').textContent=ch.name;var items=schedule(ch),p=items[0];$('banner-program').textContent=p?p.title:'Programme indisponible';$('banner-timeline').textContent='';
    if(p){var timeline=text('div','','timeline');timeline.appendChild(text('time',time(p.start)));timeline.appendChild(progress(p));timeline.appendChild(text('time',time(p.stop)));$('banner-timeline').appendChild(timeline);}
    $('banner-next').textContent=items[1]?'Ensuite à '+time(items[1].start)+' : '+items[1].title:'';$('banner-next').hidden=!items[1];$('detail').textContent=p?(p.description||'Résumé indisponible.'):'Le guide XMLTV ne fournit pas de programme pour cette chaîne.';
  }
  function trackLabel(track,i){var info={};try{info=typeof track.extra_info==='string'?JSON.parse(track.extra_info):track.extra_info||{};}catch(e){}var raw=String(info.language||info.track_lang||info.lang||''),languages={fr:'Français',fra:'Français',fre:'Français',en:'Anglais',eng:'Anglais',de:'Allemand',deu:'Allemand',ger:'Allemand',it:'Italien',ita:'Italien',es:'Espagnol',spa:'Espagnol',und:'Langue non précisée'};var label=languages[raw.toLowerCase()]||raw||'Piste '+(i+1);if(info.audio_description===true||info.audio_description===1||/description|descriptive/i.test(String(info.role||info.name||'')))label+=' · Audiodescription';return label;}
  function renderTracks(type,focusIndex){var container=$(type==='AUDIO'?'audio-tracks':'subtitle-tracks'),notice=$(type==='AUDIO'?'audio-message':'subtitles-message');container.textContent='';notice.textContent='';
    if(!av||!playing||busy){notice.textContent='Lancez une chaîne pour voir les pistes disponibles.';return;}
    try{var tracks=av.getTotalTrackInfo().filter(function(t){return t.type===type;}),current=chosenTracks[type];if(current===undefined){try{av.getCurrentStreamInfo().forEach(function(t){if(t.type===type)current=t.index;});}catch(ignore){}}
      if(type==='TEXT'){var off=text('button','Désactivés');off.dataset.track='off';off.setAttribute('aria-pressed',String(!subtitlesEnabled));off.onclick=function(){try{av.setSilentSubtitle(true);resetSubtitles();renderTracks(type,'off');armHide();}catch(e){notice.textContent=e.message;}};container.appendChild(off);}
      tracks.forEach(function(t,i){var b=text('button',trackLabel(t,i));b.dataset.track=String(t.index);b.setAttribute('aria-pressed',String(current===t.index&&(type!=='TEXT'||subtitlesEnabled)));b.onclick=function(){try{av.setSelectTrack(type,t.index);chosenTracks[type]=t.index;if(type==='TEXT'){subtitlesEnabled=true;av.setSilentSubtitle(false);}renderTracks(type,String(t.index));armHide();}catch(e){notice.textContent='Piste indisponible : '+e.message;}};container.appendChild(b);});
      if(av.isWeb)notice.textContent=av.getTrackNotice(type);else if(!tracks.length)notice.textContent=type==='AUDIO'?'Aucune autre piste audio signalée par ce flux.':'Aucun sous-titre signalé par ce flux.';
      if(focusIndex!==undefined)Array.prototype.forEach.call(container.querySelectorAll('button'),function(b){if(b.dataset.track===focusIndex)b.focus();});
    }catch(e){notice.textContent='Impossible de lire les pistes : '+e.message;}
  }
  function setTab(index,focus){tabIndex=(index+tabIds.length)%tabIds.length;tabIds.forEach(function(id,i){$(id).classList.toggle('active',i===tabIndex);$(id).setAttribute('aria-selected',String(i===tabIndex));$(panelIds[i]).hidden=i!==tabIndex;});if(tabIndex===1)renderTracks('AUDIO');if(tabIndex===2)renderTracks('TEXT');if(tabIndex===3)renderBannerNerds();if(focus)$(tabIds[tabIndex]).focus();armHide();}
  function showBanner(index,focus){ui='banner';$('home').hidden=true;$('banner').hidden=false;document.body.classList.add('banner-open');updateBanner();setTab(index===undefined?tabIndex:index,focus!==false);}
  function message(value){$('play-status').textContent=value;$('play-status').hidden=!value;}
  function closeAV(){if(!av)return;try{var state=av.getState();if(state!=='NONE'&&state!=='IDLE')av.stop();av.close();}catch(e){try{av.close();}catch(ignore){}}}
  function resetSubtitles(){subtitlesEnabled=false;clearTimeout(subtitleTimer);$('subtitle-text').hidden=true;$('subtitle-text').textContent='';}
  function fail(error,token){if(token!==playToken)return;clearTimeout(playTimer);busy=false;pendingChannel=null;closeAV();resetSubtitles();playing=null;document.body.classList.remove('playing');message('Lecture impossible : '+error+'. Choisissez une autre chaîne ou vérifiez votre connexion.');showChannels();}
  // Fast channel change ("predictive pre-joining"): spare AVPlay instances prepare CH+, CH- and the channel
  // highlighted in the list in PREBUFFER_MODE (measured on TU70DU7105: picture 0.7 s after the switch instead
  // of ~4 s). AVPlayStore allows 4 players; a fixed pool is reused because creating new ones leaks decoders.
  var pool=null,pre={},zapDirection=1,PRE_MAX_AGE=45000,preTimers={};
  function players(){if(!pool){pool=[];if(av&&!av.isWeb&&window.webapis&&webapis.avplaystore){pool.push(webapis.avplay);for(var n=0;n<3;n++){try{pool.push(webapis.avplaystore.getPlayer());}catch(e){break;}}}}return pool;}
  function freePlayer(){var used=[av];for(var k in pre)used.push(pre[k].player);return players().filter(function(p){return used.indexOf(p)<0;})[0]||null;}
  function findPre(ch){for(var k in pre)if(pre[k].ch.key===ch.key)return k;return null;}
  function cancelPrebuffer(slot){if(slot===undefined){Object.keys(pre).forEach(cancelPrebuffer);Object.keys(preTimers).forEach(function(k){clearTimeout(preTimers[k]);});return;}clearTimeout(preTimers[slot]);var e=pre[slot];if(!e)return;delete pre[slot];clearTimeout(e.refresh);try{e.player.close();}catch(x){}}
  function prebuffer(slot,ch){clearTimeout(preTimers[slot]);if(!ch||(playing&&ch.key===playing.key))return cancelPrebuffer(slot);var other=findPre(ch);if(other){if(other!==slot)cancelPrebuffer(slot);return;}
    cancelPrebuffer(slot);var p=freePlayer();if(!p)return;var entry={player:p,ch:ch,ready:false,time:0,onReady:null};pre[slot]=entry;
    function drop(){if(pre[slot]===entry)cancelPrebuffer(slot);if(entry.onReady)entry.onReady(false);}
    try{p.open(ch.url);setUserAgent(p);p.setStreamingProperty('PREBUFFER_MODE','0');p.setBufferingParam('PLAYER_BUFFER_FOR_PLAY','PLAYER_BUFFER_SIZE_IN_SECOND',1);p.setBufferingParam('PLAYER_BUFFER_FOR_RESUME','PLAYER_BUFFER_SIZE_IN_SECOND',1);
      p.prepareAsync(function(){entry.ready=true;entry.time=Date.now();if(entry.onReady)return entry.onReady(true);if(pre[slot]!==entry)return;
        // Refresh a held prebuffer before it gets old, so a switch always lands on (near) live.
        entry.refresh=setTimeout(function(){if(pre[slot]===entry){cancelPrebuffer(slot);prebuffer(slot,ch);}},PRE_MAX_AGE-5000);},drop);}catch(e){drop();}}
  function schedulePrebuffer(slot,ch,delay){clearTimeout(preTimers[slot]);if(ch)preTimers[slot]=setTimeout(function(){prebuffer(slot,ch);},delay);}
  // Take the prepared (or still preparing) player for ch out of the pool of prebuffers.
  function takePrebuffer(ch){var slot=findPre(ch);if(!slot)return null;var e=pre[slot];delete pre[slot];clearTimeout(preTimers[slot]);clearTimeout(e.refresh);if(e.ready&&Date.now()-e.time>=PRE_MAX_AGE){try{e.player.close();}catch(x){}return null;}return e;}
  function neighbour(delta){var list=filtered.length?filtered:channels;if(!playing||!list.length)return null;var i=list.findIndex(function(ch){return ch.key===playing.key;});return list[(i+delta+list.length)%list.length];}
  var USER_AGENT='MilkyWan-TizenOS non officiel';
  function setUserAgent(player){try{player.setStreamingProperty('USER_AGENT',USER_AGENT);}catch(e){}}
  function listen(player,token){player.setListener({onbufferingstart:function(){if(token===playToken)message('Mise en mémoire tampon…');},onbufferingcomplete:function(){if(token===playToken){message('');armHide();}},onerror:function(error){fail(String(error),token);},onstreamcompleted:function(){fail('le flux a été interrompu',token);},onsubtitlechange:function(duration,value){if(token!==playToken||!subtitlesEnabled)return;clearTimeout(subtitleTimer);$('subtitle-text').textContent=value;$('subtitle-text').hidden=!value;subtitleTimer=setTimeout(function(){$('subtitle-text').hidden=true;},Math.max(0,Number(duration)||0));}});}
  // A channel picked while the previous one was still connecting wins: start it instead.
  function takePending(){clearTimeout(playTimer);busy=false;if(!pendingChannel)return false;var next=pendingChannel;pendingChannel=null;start(next);return true;}
  function onPlaying(){window.MilkyDebug.playedAt=performance.now();message('');armHide();if(ui==='banner'&&(tabIndex===1||tabIndex===2))renderTracks(tabIndex===1?'AUDIO':'TEXT');Object.keys(pre).forEach(function(k){if(k!=='focus')cancelPrebuffer(k);});if(pre.focus&&(pre.focus.ch.key===playing.key))cancelPrebuffer('focus');schedulePrebuffer(zapDirection>0?'next':'prev',neighbour(zapDirection),300);schedulePrebuffer(zapDirection>0?'prev':'next',neighbour(-zapDirection),800);}
  function openStream(ch,token){
    try{av.open(ch.url);setUserAgent(av);av.setDisplayRect(0,0,1920,1080);av.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
      // Live IPTV: AVPlay's default pre-roll buffer delays the first frame by ~6.5 s on these streams (measured: 10.3 s -> 3.8 s). 1 s is the minimum AVPlay accepts; 0 or byte sizes silently fall back to the 10 s default.
      if(av.setBufferingParam){try{av.setBufferingParam('PLAYER_BUFFER_FOR_PLAY','PLAYER_BUFFER_SIZE_IN_SECOND',1);av.setBufferingParam('PLAYER_BUFFER_FOR_RESUME','PLAYER_BUFFER_SIZE_IN_SECOND',1);}catch(ignore){}}
      listen(av,token);
      av.prepareAsync(function(){if(token!==playToken||takePending())return;try{av.setSilentSubtitle(true);av.play();onPlaying();}catch(e){fail(e.message,token);}},function(error){if(token!==playToken)return;busy=false;if(pendingChannel){var next=pendingChannel;pendingChannel=null;start(next);return;}fail(error.message||String(error),token);});
    }catch(error){fail(error.message||String(error),token);}
  }
  function start(ch){if(busy){pendingChannel=ch;return;}resetSubtitles();chosenTracks={};playing=ch;selected=ch;select(ch);document.body.classList.add('playing');$('paused').hidden=true;message('Connexion au direct…');showBanner(0);
    var token=++playToken;if(!av){fail('le lecteur Samsung AVPlay est absent',token);return;}busy=true;playTimer=setTimeout(function(){fail('délai de connexion dépassé',token);},35000);
    var ready=takePrebuffer(ch);
    // Stopping the previous stream blocks ~200 ms in AVPlay: let the banner paint first, then switch.
    requestAnimationFrame(function(){setTimeout(function(){if(token!==playToken){if(ready){try{ready.player.close();}catch(e){}}return;}closeAV();
      if(ready){av=ready.player;var go=function(ok){if(token!==playToken)return;if(ok){try{av.setDisplayRect(0,0,1920,1080);av.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');if(takePending())return;listen(av,token);av.setSilentSubtitle(true);av.play();onPlaying();return;}catch(e){}}try{av.close();}catch(ignore){}openStream(ch,token);};
        // Still preparing: adopt it and play as soon as it is ready instead of starting over.
        if(ready.ready)go(true);else ready.onReady=go;return;}
      openStream(ch,token);
    },0);});
  }
  // Read-only hooks for on-device diagnostics (remote inspector).
  window.MilkyDebug={player:function(){return av;},prebuffer:function(){var o={};for(var k in pre)o[k]=pre[k].ch.name+(pre[k].ready?' READY':' preparing');return o;}};
  function stop(){++playToken;busy=false;pendingChannel=null;cancelPrebuffer();stopTsMonitor();clearTimeout(playTimer);clearTimeout(hideTimer);closeAV();resetSubtitles();playing=null;document.body.classList.remove('playing');message('');showChannels();}
  function zap(delta){var list=filtered.length?filtered:channels,reference=pendingChannel||playing||selected;if(!list.length)return;var index=list.findIndex(function(ch){return reference&&ch.key===reference.key;});zapDirection=delta;start(list[(index+delta+list.length)%list.length]);}
  function togglePause(force){if(!playing||busy||!av)return;try{var state=av.getState();if(state==='PLAYING'&&force!=='play'){av.pause();$('paused').hidden=false;showBanner(0);clearTimeout(hideTimer);}else if(state==='PAUSED'&&force!=='pause'){av.play();$('paused').hidden=true;armHide();}}catch(e){status('Pause indisponible sur ce flux : '+e.message);}}
  function fillStats(list){var report=window.MilkyStats.collect(av,playing,subtitlesEnabled),fragment=document.createDocumentFragment();report.rows.forEach(function(row){fragment.appendChild(text('dt',row[0]));fragment.appendChild(text('dd',row[1]));});list.textContent='';list.appendChild(fragment);return report;}
  function renderBannerNerds(){if(!$('banner').hidden&&tabIndex===3)fillStats($('banner-nerds'));}
  // Stream health: AVPlay exposes no packet statistics, so while the stats overlay is open a worker reads
  // the same stream on a second connection and checks every MPEG-TS packet (see ts-monitor.js).
  var tsWorker=null,tsHistory=[],tsTotals=null,tsChannel=null,tsError='';
  function stopTsMonitor(){if(tsWorker){tsWorker.terminate();tsWorker=null;}tsChannel=null;}
  function startTsMonitor(){stopTsMonitor();if(!playing||!window.Worker)return;tsChannel=playing.key;tsHistory=[];tsTotals={cc:0,tei:0,sync:0,seconds:0};tsError='';drawTsGraph();
    try{tsWorker=new Worker('ts-monitor.js');}catch(e){tsError='analyse indisponible';return;}
    tsWorker.onmessage=function(event){var s=event.data;if(s.error){tsError=s.error;return;}tsHistory.push(s);if(tsHistory.length>60)tsHistory.shift();tsTotals.cc+=s.cc;tsTotals.tei+=s.tei;tsTotals.sync+=s.sync;tsTotals.seconds++;drawTsGraph();};
    tsWorker.postMessage({cmd:'start',url:new URL(networkURL(playing.url),window.location.href).href});}
  function drawTsGraph(){var c=$('ts-graph'),g=c.getContext('2d'),w=c.width,h=c.height,n=60,step=w/(n-1);g.clearRect(0,0,w,h);
    g.strokeStyle='rgba(255,255,255,.08)';g.lineWidth=1;for(var y=1;y<4;y++){g.beginPath();g.moveTo(0,h*y/4);g.lineTo(w,h*y/4);g.stroke();}
    var max=1;tsHistory.forEach(function(s){max=Math.max(max,s.bytes*8/1e6);});max*=1.25;var off=n-tsHistory.length;
    tsHistory.forEach(function(s,i){var e=s.cc+s.tei+s.sync;if(!e)return;var bh=h*Math.min(1,0.25+e/20);g.fillStyle='rgba(255,90,90,.85)';g.fillRect((off+i)*step-4,h-bh,8,bh);});
    g.strokeStyle='#7fd4ff';g.lineWidth=3;g.beginPath();tsHistory.forEach(function(s,i){var x=(off+i)*step,y=h-6-(h-12)*(s.bytes*8/1e6)/max;if(i)g.lineTo(x,y);else g.moveTo(x,y);});g.stroke();
    g.fillStyle='#aebccd';g.font='13px monospace';g.fillText(max.toFixed(1)+' Mbit/s',5,13);}
  function tsRows(){if(!tsTotals)return [];if(tsError&&!tsHistory.length)return [['Analyse du flux','Indisponible : '+tsError]];
    var recent=tsHistory.slice(-5),last60=function(k){return tsHistory.reduce(function(a,s){return a+s[k];},0);};
    function count(k){return tsTotals[k]+' (60 s : '+last60(k)+')';}
    function mbps(k){var v=recent.length?recent.reduce(function(a,s){return a+(s[k]||0);},0)*8/1e6/recent.length:0;return v?v.toLocaleString('fr-FR',{maximumFractionDigits:2})+' Mbit/s':'Mesure en cours…';}
    return [['Débit total mesuré',mbps('bytes')],['Débit vidéo mesuré',mbps('video')],['Débit audio mesuré (toutes pistes)',mbps('audio')],['Discontinuités (CC)',count('cc')],['Paquets corrompus (TEI)',count('tei')],['Pertes de synchro TS',count('sync')],['Durée d’analyse',tsTotals.seconds+' s'+(tsError?' · '+tsError:'')]];}
  function updateNerds(){renderBannerNerds();if($('nerds-panel').hidden)return;if(playing&&playing.key!==tsChannel)startTsMonitor();else if(!playing)stopTsMonitor();var report=window.MilkyStats.collect(av,playing,subtitlesEnabled),fragment=document.createDocumentFragment();report.rows.filter(function(row){return !(/^Débit .* annoncé$/.test(row[0])&&(row[1]==='Non fourni'||/^0(,0+)? /.test(row[1])));}).concat(tsRows()).forEach(function(row){fragment.appendChild(text('dt',row[0]));fragment.appendChild(text('dd',row[1]));});$('nerds-values').textContent='';$('nerds-values').appendChild(fragment);$('nerds-note').textContent=report.note||'Les débits mesurés et les erreurs proviennent d’une seconde lecture du même flux, active uniquement pendant l’affichage de ce panneau.';}
  function closeNerds(){$('nerds-panel').hidden=true;stopTsMonitor();if(ui==='video')$('video-hit').focus();else if(ui==='banner')$(tabIds[tabIndex]).focus();else focusChannel(selected&&selected.key);}
  function toggleNerds(){if(!$('nerds-panel').hidden){closeNerds();return;}$('options-modal').hidden=true;if(playing)hideUI();$('nerds-panel').hidden=false;updateNerds();$('nerds-close').focus();}
  $('pc-channels').onclick=showChannels;$('pc-options').onclick=openOptions;$('pc-nerds').onclick=toggleNerds;$('pc-fullscreen').onclick=function(){var target=document.documentElement;if(!target.requestFullscreen||!document.exitFullscreen){status('Le plein écran est indisponible dans ce navigateur.');return;}var promise=document.fullscreenElement?document.exitFullscreen():target.requestFullscreen();if(promise&&promise.catch)promise.catch(function(){status('Le plein écran est indisponible dans ce navigateur.');});};
  $('nerds').onclick=toggleNerds;$('nerds-close').onclick=closeNerds;setInterval(updateNerds,2000);
  var optionsReturn='channels';
  function favoriteTarget(){return ui==='channels'?selected:(playing||selected);}
  function openOptions(){clearTimeout(hideTimer);optionsReturn=ui;var ch=favoriteTarget();$('fav-toggle').hidden=!ch;if(ch)$('fav-toggle').textContent=(isFavorite(ch)?'★ Retirer des favoris : ':'☆ Ajouter aux favoris : ')+ch.name;$('options-modal').hidden=false;(ch?$('fav-toggle'):$('all')).focus();}
  function closeOptions(){$('options-modal').hidden=true;if(optionsReturn==='banner')showBanner(4);else showChannels(true);}
  function openSettings(){$('options-modal').hidden=true;$('m3u').value=sources.m3u;$('epg').value=sources.epg;$('settings-error').textContent='';$('modal').hidden=false;$('m3u').focus();}
  function closeSettings(){$('modal').hidden=true;openOptions();}
  function scope(){var dialogs=['exit-modal','modal','options-modal'];for(var i=0;i<dialogs.length;i++)if(!$(dialogs[i]).hidden)return $(dialogs[i]);return ui==='banner'?$('banner'):$('home');}
  function navigateDialog(code){var items=Array.prototype.filter.call(scope().querySelectorAll('button,input'),function(el){return el.getClientRects().length>0;}),active=document.activeElement;if(items.indexOf(active)<0){if(items[0])items[0].focus();return;}var rect=active.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2,best=null,score=Infinity;items.forEach(function(el){if(el===active)return;var r=el.getBoundingClientRect(),dx=r.left+r.width/2-x,dy=r.top+r.height/2-y,forward=code===37?-dx:code===39?dx:code===38?-dy:dy,cross=(code===37||code===39)?Math.abs(dy):Math.abs(dx);if(forward<=1)return;var s=forward+cross*3;if(s<score){score=s;best=el;}});if(best)best.focus();}
  function askExit(){clearTimeout(hideTimer);$('options-modal').hidden=true;$('exit-modal').hidden=false;$('stay').focus();}
  tabIds.forEach(function(id,i){$(id).onclick=function(){if(i===tabIndex&&ui==='banner'){if(i===3){toggleNerds();return;}if(i===4){openOptions();return;}}showBanner(i);};});$('video-hit').onclick=function(){showBanner(0);};$('close-options').onclick=closeOptions;$('fav-toggle').onclick=function(){var ch=favoriteTarget();toggleFavorite();if(ch)$('fav-toggle').textContent=(isFavorite(ch)?'★ Retirer des favoris : ':'☆ Ajouter aux favoris : ')+ch.name;};$('exit').onclick=askExit;
  $('all').onclick=function(){favoriteOnly=false;group='';$('group').textContent='Groupe : tous';render();closeOptions();};$('favorites').onclick=function(){favoriteOnly=true;render();$('options-modal').hidden=true;ui='channels';$('banner').hidden=true;document.body.classList.remove('banner-open');$('home').hidden=false;focusChannel(selected&&selected.key);armHide();};$('group').onclick=function(){var groups=[''];channels.forEach(function(ch){if(groups.indexOf(ch.group)<0)groups.push(ch.group);});group=groups[(groups.indexOf(group)+1)%groups.length];$('group').textContent='Groupe : '+(group||'tous');render();};$('search').oninput=function(){render();};$('reload').onclick=function(){load();closeOptions();};$('settings').onclick=openSettings;$('cancel').onclick=closeSettings;
  $('save').onclick=function(){var m3u=D.safeURL($('m3u').value.trim()),guide=D.safeURL($('epg').value.trim());if(!m3u||!guide){$('settings-error').textContent='Saisissez deux adresses HTTP ou HTTPS valides.';return;}sources={m3u:m3u,epg:guide};write('mw.settings',sources);$('modal').hidden=true;stop();load();};
  $('stay').onclick=function(){$('exit-modal').hidden=true;playing?showBanner(0):showChannels();};$('quit').onclick=function(){$('exit-modal').hidden=true;stop();if(window.tizen){try{tizen.application.getCurrentApplication().exit();}catch(e){status('Impossible de quitter : '+e.message);}}};
  document.addEventListener('keydown',function(event){var code=event.keyCode,input=document.activeElement.tagName==='INPUT';
    if(av&&av.isWeb&&!input&&!dialogOpen()){if(code===77){event.preventDefault();openOptions();return;}if(code===78){event.preventDefault();toggleNerds();return;}if(code===67){event.preventDefault();showChannels();return;}if(code===70){event.preventDefault();$('pc-fullscreen').click();return;}if(code===32){event.preventDefault();togglePause();return;}}
    if(!$('nerds-panel').hidden&&(code===10009||code===27||(code===13&&document.activeElement===$('nerds-close')))){event.preventDefault();closeNerds();return;}
    if(code===404&&!dialogOpen()){event.preventDefault();toggleNerds();return;}
    if(code===10009||code===27){event.preventDefault();if(!$('exit-modal').hidden)$('stay').click();else if(!$('modal').hidden)closeSettings();else if(!$('options-modal').hidden)closeOptions();else if(playing){if(ui==='video')showBanner(0);else hideUI();}else askExit();return;}
    if(dialogOpen()){if(code>=37&&code<=40){if(input&&(code===37||code===39))return;event.preventDefault();navigateDialog(code);}else if(code===13&&input){event.preventDefault();if(document.activeElement===$('search')){$('options-modal').hidden=true;ui='channels';$('home').hidden=false;focusChannel(selected&&selected.key);}else document.activeElement.blur();}return;}
    if(code===403){event.preventDefault();openOptions();return;}if(code===406){event.preventDefault();toggleFavorite();armHide();return;}
    if(code===427||code===428){event.preventDefault();zap(code===427?1:-1);return;}if([415,19,10252].indexOf(code)!==-1){event.preventDefault();togglePause(code===415?'play':code===19?'pause':null);return;}if(code===457){event.preventDefault();showBanner(0);return;}
    if(code===37||code===39){event.preventDefault();if(ui!=='banner'){showBanner(0);return;}var active=document.activeElement;if(active.dataset.track!==undefined){var peer=code===37?active.previousElementSibling:active.nextElementSibling;if(peer)peer.focus();else setTab(tabIndex,true);}else setTab(tabIndex+(code===37?-1:1),true);armHide();return;}
    if(code===38||code===40){event.preventDefault();if(ui==='banner'&&document.activeElement.dataset.track!==undefined){if(code===38)$(tabIds[tabIndex]).focus();armHide();return;}if(ui==='banner'&&code===40&&(tabIndex===1||tabIndex===2)){var first=$(tabIndex===1?'audio-tracks':'subtitle-tracks').querySelector('button');if(first){first.focus();armHide();return;}}
      if(ui!=='channels'){showChannels();return;}var active=document.activeElement,next=code===38?active.previousElementSibling:active.nextElementSibling;if(active.parentElement===$('channels')&&next&&next.tagName==='BUTTON'){next.focus();next.scrollIntoView({block:'nearest'});}else if(active.parentElement!==$('channels'))focusChannel(selected&&selected.key);armHide();return;}
    if(code===13&&ui==='video'){event.preventDefault();showBanner(0);}
  });
  if(window.tizen&&tizen.tvinputdevice){['ChannelUp','ChannelDown','ColorF0Red','ColorF1Green','ColorF3Blue','Info','MediaPlay','MediaPause','MediaPlayPause'].forEach(function(key){try{tizen.tvinputdevice.registerKey(key);}catch(e){}});}
  document.addEventListener('visibilitychange',function(){if(document.hidden&&playing)stop();});window.addEventListener('unload',function(){cancelPrebuffer();closeAV();});
  setInterval(function(){if(!dialogOpen()){if(ui==='channels')refreshRows();if(ui==='banner')updateBanner();}},30000);setInterval(load,6*60*60*1000);$('video-hit').focus();load();
})();
