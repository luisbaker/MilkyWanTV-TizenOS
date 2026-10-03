(function(root){
  'use strict';
  function routeURL(value){try{var u=new URL(value),loc=root.location;if(u.hostname==='tv.milkywan.fr'&&loc&&/^https?:$/.test(loc.protocol)&&['127.0.0.1','localhost'].indexOf(loc.hostname)!==-1)return loc.origin+'/proxy?url='+encodeURIComponent(u.href);}catch(e){}return value;}
  function create(video){
    var state='NONE',player=null,url='',listener={},info={},stats={},epoch=0,timer=null,removers=[];
    function notify(name,value){if(typeof listener[name]==='function')listener[name](value);}
    function watch(name,callback){video.addEventListener(name,callback);removers.push(function(){video.removeEventListener(name,callback);});}
    function fail(value,token){if(token!==epoch)return;clearTimeout(timer);notify('onerror',value);}
    function close(){++epoch;clearTimeout(timer);removers.forEach(function(remove){remove();});removers=[];if(player){try{player.unload();player.detachMediaElement();player.destroy();}catch(ignore){}player=null;}video.pause();video.removeAttribute('src');video.load();info={};stats={};state='NONE';}
    function tracks(){var result=[];if(info.hasVideo!==false&&(info.videoCodec||video.videoWidth))result.push({type:'VIDEO',index:0,extra_info:JSON.stringify({width:info.width||video.videoWidth,height:info.height||video.videoHeight,fourCC:info.videoCodec||'',fps:info.fps})});
      if(info.hasAudio){result.push({type:'AUDIO',index:0,extra_info:JSON.stringify({fourCC:info.audioCodec||'',language:'Piste audio du flux'})});}return result;
    }
    return {engineName:'Web · mpegts.js / HTML5',isWeb:true,routeURL:routeURL,
      getState:function(){return state;},open:function(value){url=value;state='IDLE';},close:close,stop:function(){video.pause();state='IDLE';},setDisplayRect:function(){},setDisplayMethod:function(){},setListener:function(value){listener=value||{};},
      prepareAsync:function(success,error){var token=epoch;
        try{if(root.location&&root.location.protocol==='file:')throw new Error('Sur PC, lancez Lancer-PC.command ou Lancer-PC.bat pour ouvrir la version web locale.');
          var isNative=/\.(mp4|webm|ogg)(?:[?#]|$)/i.test(url)||(/\.m3u8(?:[?#]|$)/i.test(url)&&video.canPlayType('application/vnd.apple.mpegurl'));
          watch('waiting',function(){if(token===epoch&&state!=='PAUSED'){state='BUFFERING';notify('onbufferingstart');}});watch('playing',function(){if(token===epoch){clearTimeout(timer);state='PLAYING';notify('onbufferingcomplete');}});watch('ended',function(){if(token===epoch)notify('onstreamcompleted');});
          watch('error',function(){var e=video.error;fail('Ce navigateur ne parvient pas à décoder cette chaîne'+(e&&e.message?' ('+e.message+')':'')+'. Certains flux TV nécessitent un codec ou un désentrelacement que ce lecteur web ne fournit pas',token);});
          if(isNative){video.src=routeURL(url);video.load();}else{
            if(!root.mpegts||!root.mpegts.getFeatureList().mseLivePlayback)throw new Error('Ce navigateur ne prend pas en charge la lecture MPEG-TS avec Media Source Extensions.');
            player=root.mpegts.createPlayer({type:'mpegts',isLive:true,cors:true,url:routeURL(url)},{enableWorker:false,enableStashBuffer:true,stashInitialSize:384*1024,lazyLoad:false,autoCleanupSourceBuffer:true,autoCleanupMaxBackwardDuration:30,autoCleanupMinBackwardDuration:10,liveBufferLatencyChasing:true,liveBufferLatencyMaxLatency:4,liveBufferLatencyMinRemain:1});
            player.on(root.mpegts.Events.MEDIA_INFO,function(value){if(token===epoch)info=value||{};});player.on(root.mpegts.Events.STATISTICS_INFO,function(value){if(token===epoch)stats=value||{};});
            player.on(root.mpegts.Events.ERROR,function(type,detail){fail(detail===root.mpegts.ErrorDetails.MEDIA_CODEC_UNSUPPORTED?'Le codec de cette chaîne n’est pas pris en charge par ce navigateur.':'Erreur du lecteur web : '+type+' / '+detail,token);});
            player.attachMediaElement(video);player.load();
          }
          state='READY';success();
        }catch(e){error(e);}
      },
      play:function(){var token=epoch,promise=player?player.play():video.play();state='BUFFERING';clearTimeout(timer);timer=setTimeout(function(){fail('Le flux ne démarre pas. Vérifiez votre connexion MilkyWan et le codec de la chaîne.',token);},30000);if(promise&&promise.catch)promise.catch(function(e){fail(e.name==='NotAllowedError'?'Le navigateur a bloqué la lecture automatique. Cliquez sur la chaîne pour relancer la vidéo.':e.message||String(e),token);});},
      pause:function(){if(player)player.pause();else video.pause();clearTimeout(timer);state='PAUSED';},getCurrentStreamInfo:tracks,getTotalTrackInfo:tracks,
      setSelectTrack:function(type,index){if(type!=='AUDIO'||index!==0)throw new Error('Le choix des pistes intégrées n’est pas disponible avec ce lecteur web.');},
      setSilentSubtitle:function(){},getTrackNotice:function(type){return type==='TEXT'?'Les sous-titres intégrés de ces flux ne sont pas disponibles avec le lecteur web.':'Le lecteur web utilise la piste audio extraite du flux ; le changement de piste est disponible sur Samsung avec AVPlay.';},
      getMetrics:function(){var buffer=null;try{for(var i=0;i<video.buffered.length;i++)if(video.currentTime>=video.buffered.start(i)&&video.currentTime<=video.buffered.end(i))buffer=video.buffered.end(i)-video.currentTime;}catch(ignore){}var quality=typeof video.getVideoPlaybackQuality==='function'?video.getVideoPlaybackQuality():{};return {bufferSeconds:buffer,speedKBps:stats.speed,decodedFrames:quality.totalVideoFrames,droppedFrames:quality.droppedVideoFrames,fps:info.fps};}
    };
  }
  root.MilkyWebPlayer={create:create,routeURL:routeURL};
})(typeof window!=='undefined'?window:globalThis);
