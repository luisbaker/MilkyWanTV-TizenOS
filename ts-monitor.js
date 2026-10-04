// MPEG-TS health monitor (Web Worker). AVPlay exposes no packet statistics, so while the
// "nerds" panel is open we read the same live stream on a second connection and check every
// 188-byte packet: continuity-counter discontinuities, transport errors and sync losses.
// PAT/PMT are parsed to split the measured bitrate into video and audio.
// Posts one sample per second: {bytes, packets, cc, tei, sync, video, audio, pids:{pid:bytes}} and, when the
// PMT is first seen or changes, {streams:[{pid,codec,lang,kind}], program, pmt}.
var reader=null,timer=null;
function stop(){clearInterval(timer);timer=null;if(reader){try{reader.cancel();}catch(e){}reader=null;}}
self.onmessage=function(event){
  stop();
  if(event.data.cmd!=='start')return;
  var lastCC=new Int16Array(8192).fill(-1),dupSeen=new Uint8Array(8192);
  var carry=new Uint8Array(0),sample=empty(),pmtPids={},kind=new Uint8Array(8192),tracked=new Uint8Array(8192),lastStreams='';  // kind: 1 video, 2 audio, 3 subtitles
  function empty(){return {bytes:0,packets:0,cc:0,tei:0,sync:0,video:0,audio:0,pids:{}};}
  function section(b,o,afc){var p=o+4;if(afc&2)p+=1+b[o+4];if(p>=o+188)return -1;return p+1+b[p];}
  function parsePAT(b,o,afc){var t=section(b,o,afc);if(t<0||t+8>o+188)return;var end=Math.min(o+188,t+3+(((b[t+1]&15)<<8)|b[t+2])-4);
    for(var i=t+8;i+4<=end;i+=4){var prog=(b[i]<<8)|b[i+1];if(prog)pmtPids[((b[i+2]&31)<<8)|b[i+3]]=prog;}}
  var CODECS={1:'MPEG-1 vidéo',2:'MPEG-2 vidéo',0x10:'MPEG-4 vidéo',0x1b:'H.264',0x24:'HEVC',3:'MPEG audio',4:'MPEG audio',0x0f:'AAC',0x11:'AAC LATM',0x81:'AC-3',0x87:'E-AC-3',0x86:'SCTE-35 (signalisation)',5:'Données privées',0x0d:'Données DSM-CC'};
  function parsePMT(b,o,afc,pmtPid){var t=section(b,o,afc);if(t<0||t+12>o+188)return;var end=Math.min(o+188,t+3+(((b[t+1]&15)<<8)|b[t+2])-4),i=t+12+(((b[t+10]&15)<<8)|b[t+11]),streams=[];
    while(i+5<=end){var type=b[i],pid=((b[i+1]&31)<<8)|b[i+2],len=((b[i+3]&15)<<8)|b[i+4],k=0,codec=CODECS[type]||'Type 0x'+type.toString(16),lang='';
      if([1,2,0x10,0x1b,0x24].indexOf(type)>=0)k=1;else if([3,4,0x0f,0x11,0x81,0x87].indexOf(type)>=0)k=2;
      for(var d=i+5;d+2<=i+5+len&&d<end;d+=2+b[d+1]){var tag=b[d];
        if(tag===0x0a||tag===0x59||tag===0x56)lang=String.fromCharCode(b[d+2],b[d+3],b[d+4]);
        if(type===6){if(tag===0x6a){k=2;codec='AC-3';}else if(tag===0x7a){k=2;codec='E-AC-3';}else if(tag===0x7b){k=2;codec='DTS';}else if(tag===0x59){k=3;codec='Sous-titres DVB';}else if(tag===0x56){k=3;codec='Télétexte';}}}
      kind[pid]=k;tracked[pid]=1;streams.push({pid:pid,codec:codec,lang:lang,kind:k});i+=5+len;}
    var key=JSON.stringify(streams);if(key!==lastStreams){lastStreams=key;self.postMessage({streams:streams,program:pmtPids[pmtPid],pmt:pmtPid});}}
  function packet(b,o){
    var pid=((b[o+1]&0x1f)<<8)|b[o+2],afc=(b[o+3]>>4)&3,cc=b[o+3]&15;
    sample.packets++;
    if(b[o+1]&0x80)sample.tei++;
    if(pid===0x1fff)return;
    if(kind[pid]===1)sample.video+=188;else if(kind[pid]===2)sample.audio+=188;
    if(tracked[pid])sample.pids[pid]=(sample.pids[pid]||0)+188;
    if(b[o+1]&0x40){if(pid===0)parsePAT(b,o,afc);else if(pmtPids[pid])parsePMT(b,o,afc,pid);}
    // Discontinuity flagged by the encoder itself: not an error, resynchronise.
    if((afc&2)&&b[o+4]>0&&(b[o+5]&0x80)){lastCC[pid]=cc;return;}
    var last=lastCC[pid];
    if(last>=0){
      if(afc&1){
        if(cc===last){if(dupSeen[pid])sample.cc++;dupSeen[pid]=1;return;}  // one duplicate is allowed
        if(cc!==((last+1)&15))sample.cc++;
      }else if(cc!==last)sample.cc++;  // no payload: counter must not move
    }
    dupSeen[pid]=0;lastCC[pid]=cc;
  }
  function feed(chunk){
    sample.bytes+=chunk.length;
    var b;if(carry.length){b=new Uint8Array(carry.length+chunk.length);b.set(carry);b.set(chunk,carry.length);}else b=chunk;
    var o=0;
    while(o+188<=b.length){
      if(b[o]!==0x47){sample.sync++;var n=o+1;while(n<b.length&&!(b[n]===0x47&&(n+188>=b.length||b[n+188]===0x47)))n++;o=n;continue;}
      packet(b,o);o+=188;
    }
    carry=b.slice(o);
  }
  timer=setInterval(function(){self.postMessage(sample);sample=empty();},1000);
  fetch(event.data.url).then(function(res){
    if(!res.ok||!res.body)throw new Error('HTTP '+res.status);
    reader=res.body.getReader();
    (function pump(){reader.read().then(function(r){if(r.done||!reader){if(timer)self.postMessage({error:'Flux terminé'});return;}feed(r.value);pump();},function(e){if(reader)self.postMessage({error:String(e.message||e)});});})();
  }).catch(function(e){self.postMessage({error:String(e.message||e)});});
};
