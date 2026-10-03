(function(root){
  'use strict';
  function extra(track){var info={};try{info=typeof track.extra_info==='string'?JSON.parse(track.extra_info):track.extra_info||{};}catch(e){}var normalized={};Object.keys(info).forEach(function(key){normalized[key.toLowerCase().replace(/[_-]/g,'')]=info[key];});return normalized;}
  function pick(info,keys){for(var i=0;i<keys.length;i++){var value=info[keys[i]];if(value!==undefined&&value!==null&&String(value).trim()!=='')return String(value).trim();}return 'Non fourni';}
  function bitrate(info){var value=Number(pick(info,['bitrate']));return isFinite(value)&&value>0?(value/1000000).toLocaleString('fr-FR',{maximumFractionDigits:2})+' Mbit/s':'Non fourni';}
  function collect(av,channel,subtitlesEnabled){var state='Lecteur indisponible',tracks=[],note='';if(av){try{state=av.getState();if(['READY','PLAYING','PAUSED'].indexOf(state)!==-1)tracks=av.getCurrentStreamInfo();}catch(e){note='Métadonnées indisponibles : '+(e.message||String(e));}}
    var video={},audio={};tracks.forEach(function(t){if(t.type==='VIDEO')video=extra(t);if(t.type==='AUDIO')audio=extra(t);});var width=Number(pick(video,['width'])),height=Number(pick(video,['height']));var server='Aucun flux';try{if(channel)server=new URL(channel.url).host;}catch(e){}
    var report={note:note,rows:[['Chaîne',channel?channel.name:'Aucune chaîne en lecture'],['Lecteur',av&&av.engineName?av.engineName:'Samsung AVPlay'],['État du lecteur',state],['Serveur',server],['Résolution du flux',width>0&&height>0?width+' × '+height:'Non fourni'],['Codec vidéo',pick(video,['fourcc','codec','codectype'])],['Débit vidéo annoncé',bitrate(video)],['Codec audio',pick(audio,['fourcc','codec','codectype'])],['Débit audio annoncé',bitrate(audio)],['Langue audio',pick(audio,['language','tracklang','lang'])],['Sous-titres',subtitlesEnabled?'Activés':'Désactivés']]};
    if(av&&typeof av.getMetrics==='function'){var m=av.getMetrics();function number(value,suffix){return typeof value==='number'&&isFinite(value)?value.toLocaleString('fr-FR',{maximumFractionDigits:2})+suffix:'Non fourni';}report.rows.push(['Fréquence vidéo',number(m.fps,' images/s')],['Tampon disponible',number(m.bufferSeconds,' s')],['Réception mesurée',number(m.speedKBps,' Ko/s')],['Images décodées',number(m.decodedFrames,'')],['Images perdues',number(m.droppedFrames,'')]);}
    return report;
  }
  root.MilkyStats={collect:collect};
})(typeof window!=='undefined'?window:globalThis);
