// Downloads and parses an XMLTV guide off the main thread so the UI never freezes.
// Gzipped guides (.xml.gz, detected by their magic bytes) are inflated with DecompressionStream.
importScripts('data.js');
self.onmessage=function(event){
  function fail(message){self.postMessage({error:message});}
  fetch(event.data.url).then(function(res){
    if(!res.ok)throw new Error('Serveur HTTP '+res.status);
    return res.arrayBuffer();
  }).then(function(buf){
    var b=new Uint8Array(buf);
    if(b[0]===0x1f&&b[1]===0x8b)return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return new TextDecoder('utf-8').decode(b);
  }).then(function(xml){
    self.postMessage({epg:self.MilkyData.parseEPGText(xml,Date.now())});
  }).catch(function(e){fail(e&&e.message?e.message:'Accès réseau impossible');});
};
