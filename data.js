(function(root){
  'use strict';
  function attrs(text){var out={},re=/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,m;while((m=re.exec(text))){out[m[1]]=m[2]!==undefined?m[2]:m[3];}return out;}
  function safeURL(value,base){try{var u=new URL(value,base);return /^https?:$/.test(u.protocol)?u.href:'';}catch(e){return '';}}
  function parseM3U(text,base){
    if(!/^\s*#EXTM3U/m.test(text.replace(/^\uFEFF/,'')))throw new Error('La réponse reçue n’est pas une liste M3U.');
    var list=[],pending=null;
    text.split(/\r?\n/).forEach(function(raw){var line=raw.trim();
      if(line.indexOf('#EXTINF:')===0){
        var quoted=false,quote='',comma=-1;
        for(var i=0;i<line.length;i++){var c=line.charAt(i);if(c==='"'||c==="'"){if(!quoted){quoted=true;quote=c;}else if(quote===c)quoted=false;}else if(c===','&&!quoted){comma=i;break;}}
        var a=attrs(comma<0?line:line.slice(0,comma));
        pending={id:a['tvg-id']||'',epgName:a['tvg-name']||'',name:(comma>=0?line.slice(comma+1):'').trim()||a['tvg-name']||'Chaîne',group:a['group-title']||'Chaînes',number:a['tvg-chno']||'',logo:a['tvg-logo']?safeURL(a['tvg-logo'],base):''};
        var numbered=/^(\d+)[.)]\s+(.+)$/.exec(pending.name);if(numbered){pending.number=pending.number||numbered[1];pending.name=a['group-name']||numbered[2];}
      }else if(pending&&line.indexOf('#EXTGRP:')===0){pending.group=line.slice(8).trim();}
      else if(line&&line.charAt(0)!=='#'){var url=safeURL(line,base);if(pending&&url){pending.url=url;pending.key=pending.id||url;if(list.some(function(ch){return ch.key===pending.key;}))pending.key=url;pending.number=pending.number||String(list.length+1);list.push(pending);}pending=null;}
    });
    if(!list.length)throw new Error('Aucune chaîne HTTP exploitable dans la liste.');
    var head=/^\s*#EXTM3U([^\r\n]*)/m.exec(text.replace(/^\uFEFF/,''));if(head){var h=attrs(head[1]),tvg=h['url-tvg']||h['x-tvg-url'];if(tvg)list.tvgUrl=safeURL(tvg.split(',')[0].trim(),base);}
    return list;
  }
  function xmlTime(value){var m=/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*(Z|[+-]\d{4})?$/.exec(value||'');if(!m)return NaN;
    var n=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));
    if(m[7]&&m[7]!=='Z'){var offset=(+m[7].slice(1,3)*60 + +m[7].slice(3,5))*60000;n-=m[7].charAt(0)==='+'?offset:-offset;}return n;
  }
  function normalize(s){return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
  function parseEPG(text){
    var doc=new DOMParser().parseFromString(text,'text/xml');if(doc.querySelector('parsererror')||!doc.querySelector('tv'))throw new Error('Guide XMLTV invalide.');
    var programmes=Object.create(null),names=Object.create(null),cutoff=Date.now()-86400000;
    Array.prototype.forEach.call(doc.querySelectorAll('channel'),function(ch){Array.prototype.forEach.call(ch.querySelectorAll('display-name'),function(n){names[normalize(n.textContent)]=ch.getAttribute('id');});});
    Array.prototype.forEach.call(doc.querySelectorAll('programme'),function(p){var start=xmlTime(p.getAttribute('start')),stop=xmlTime(p.getAttribute('stop')),id=p.getAttribute('channel');if(!id||!isFinite(start)||!isFinite(stop)||stop<=start||stop<cutoff)return;
      var title=p.querySelector('title'),desc=p.querySelector('desc');if(!programmes[id])programmes[id]=[];programmes[id].push({start:start,stop:stop,title:title?title.textContent:'Programme',description:desc?desc.textContent:''});
    });Object.keys(programmes).forEach(function(id){programmes[id].sort(function(a,b){return a.start-b.start;});});return {programmes:programmes,names:names};
  }
  // Fast XMLTV reader: plain string scanning (no DOM), keeps only programmes overlapping [now, now+windowMs].
  // Summaries are kept for the next 8 h only (the guide refreshes every 6 h) to keep the cache small.
  var entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
  function decode(s){if(s.indexOf('<![CDATA[')!==-1)s=s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1');if(s.indexOf('&')===-1)return s.trim();
    return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi,function(m,e){if(e.charAt(0)==='#')return String.fromCharCode(e.charAt(1)==='x'||e.charAt(1)==='X'?parseInt(e.slice(2),16):+e.slice(1));return entities[e]!==undefined?entities[e]:m;}).trim();}
  function inner(xml,tag,from,to){var open=xml.indexOf('<'+tag,from);if(open===-1||open>=to)return null;var gt=xml.indexOf('>',open);if(gt===-1||gt>=to)return null;if(xml.charAt(gt-1)==='/')return '';var close=xml.indexOf('</'+tag+'>',gt);if(close===-1||close>to)return null;return decode(xml.slice(gt+1,close));}
  function attr(head,name){var re=new RegExp('\\s'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')'),m=re.exec(head);return m?decode(m[1]!==undefined?m[1]:m[2]):'';}
  function parseEPGText(xml,now,windowMs){
    if(xml.indexOf('<tv')===-1)throw new Error('Guide XMLTV invalide.');
    now=now||Date.now();var limit=now+(windowMs||36*3600000),descLimit=now+8*3600000,programmes=Object.create(null),names=Object.create(null),pos=0,end,head,gt;
    while((pos=xml.indexOf('<channel',pos))!==-1){gt=xml.indexOf('>',pos);end=xml.indexOf('</channel>',gt);if(gt===-1||end===-1)break;var id=attr(xml.slice(pos,gt),'id'),p=gt,n;
      while((n=xml.indexOf('<display-name',p))!==-1&&n<end){var g=xml.indexOf('>',n),c=xml.indexOf('</display-name>',g);if(g===-1||c===-1||c>end)break;names[normalize(decode(xml.slice(g+1,c)))]=id;p=c;}pos=end;}
    pos=0;while((pos=xml.indexOf('<programme',pos))!==-1){gt=xml.indexOf('>',pos);if(gt===-1)break;head=xml.slice(pos,gt);
      if(xml.charAt(gt-1)==='/'){pos=gt;continue;}end=xml.indexOf('</programme>',gt);if(end===-1)break;
      var start=xmlTime(attr(head,'start')),stop=xmlTime(attr(head,'stop')),cid=attr(head,'channel');
      if(cid&&isFinite(start)&&isFinite(stop)&&stop>start&&stop>now&&start<limit){var title=inner(xml,'title',gt,end),desc=start<descLimit?inner(xml,'desc',gt,end):'';
        (programmes[cid]||(programmes[cid]=[])).push({start:start,stop:stop,title:title||'Programme',description:desc||''});}
      pos=end+12;}
    Object.keys(programmes).forEach(function(id){programmes[id].sort(function(a,b){return a.start-b.start;});});return {programmes:programmes,names:names};
  }
  function schedule(channel,epg,now){var id=epg.programmes[channel.id]?channel.id:(epg.names[normalize(channel.epgName)]||epg.names[normalize(channel.name)]);return (epg.programmes[id]||[]).filter(function(p){return p.stop>now;}).slice(0,8);}
  root.MilkyData={parseM3U:parseM3U,parseEPG:parseEPG,parseEPGText:parseEPGText,xmlTime:xmlTime,schedule:schedule,safeURL:safeURL};
})(typeof window!=='undefined'?window:globalThis);
