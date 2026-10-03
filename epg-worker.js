// Downloads and parses the XMLTV guide off the main thread so the UI never freezes.
importScripts('data.js');
self.onmessage=function(event){
  var url=event.data.url,xhr=new XMLHttpRequest();
  function fail(message){self.postMessage({error:message});}
  xhr.open('GET',url,true);xhr.timeout=60000;
  xhr.onload=function(){
    if(xhr.status<200||xhr.status>=300)return fail('Serveur HTTP '+xhr.status);
    try{self.postMessage({epg:self.MilkyData.parseEPGText(xhr.responseText,Date.now())});}catch(e){fail(e.message||String(e));}
  };
  xhr.onerror=function(){fail('Accès réseau impossible');};xhr.ontimeout=function(){fail('Le serveur ne répond pas');};
  xhr.send();
};
