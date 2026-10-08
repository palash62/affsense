import { getTrackingUrl } from "@cpl/shared";

const SITE_KEY_PATTERN = /^ss_[0-9A-Za-z]{20}$/;

function buildScript(trackingUrl: string, siteKey: string) {
  return `(function(w,d){
"use strict";
if(w.__affsenseSolo)return;w.__affsenseSolo=1;
var T=${JSON.stringify(trackingUrl)},K=${JSON.stringify(siteKey)},P="affs_click_id",S="affs_cid",RE=/^sc_[0-9A-Za-z]{24}$/,DAYS=30;
function save(id){try{localStorage.setItem(S,JSON.stringify({id:id,t:Date.now()}))}catch(e){}
try{d.cookie=S+"="+id+";path=/;max-age="+DAYS*86400+";SameSite=Lax"+(location.protocol==="https:"?";Secure":"")}catch(e){}}
function load(){var id=null;try{var v=JSON.parse(localStorage.getItem(S)||"null");if(v&&RE.test(v.id)&&Date.now()-v.t<DAYS*864e5)id=v.id}catch(e){}
if(!id){var m=d.cookie.match(/(?:^|; )affs_cid=([^;]+)/);if(m&&RE.test(m[1]))id=m[1]}return id}
var q=null;try{q=new URLSearchParams(location.search).get(P)}catch(e){}
if(q&&RE.test(q))save(q);
var cid=load(),TH="";try{TH=new URL(T).host}catch(e){}
function decorate(a){if(!cid||!a||!a.href)return;try{var u=new URL(a.href,location.href);
if(u.host!==TH||!/^\\/(cpa|dp)\\//.test(u.pathname)||u.searchParams.get(P)===cid)return;
u.searchParams.set(P,cid);a.href=u.toString()}catch(e){}}
function decorateAll(){var l=d.querySelectorAll("a[href]");for(var i=0;i<l.length;i++)decorate(l[i])}
function addInputs(){if(!cid)return;for(var i=0;i<d.forms.length;i++){var f=d.forms[i];
if(f.querySelector('input[name="'+P+'"]'))continue;var x=d.createElement("input");x.type="hidden";x.name=P;x.value=cid;f.appendChild(x)}}
function send(path,body){var data=JSON.stringify(body);
try{if(navigator.sendBeacon&&navigator.sendBeacon(T+path,new Blob([data],{type:"text/plain"})))return}catch(e){}
try{fetch(T+path,{method:"POST",body:data,mode:"cors",keepalive:true,headers:{"Content-Type":"text/plain"}})}catch(e){}}
function lead(email,key){if(!cid)return false;send("/api/v1/solo/lead",{k:K,cid:cid,email:email||null,key:key||null});return true}
d.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(a)decorate(a)},true);
d.addEventListener("submit",function(e){var f=e.target;if(!cid||!f||!f.querySelector)return;
var el=f.querySelector('input[type="email"],input[name*="email" i]');if(el&&el.value)lead(el.value)},true);
w.addEventListener("affsense.lead",function(e){var x=e.detail||{};lead(x.email,x.key)});
w.affsense=w.affsense||{};w.affsense.clickId=function(){return cid};w.affsense.lead=lead;
var timer=null;function refresh(){if(timer)return;timer=setTimeout(function(){timer=null;decorateAll();addInputs()},250)}
function ping(){var last=0;try{last=Number(sessionStorage.getItem("affs_ping")||0)}catch(e){}
if(Date.now()-last<18e5)return;try{sessionStorage.setItem("affs_ping",String(Date.now()))}catch(e){}
send("/api/v1/solo/ping",{k:K,host:location.hostname})}
function init(){decorateAll();addInputs();
if(w.MutationObserver)new MutationObserver(refresh).observe(d.documentElement,{childList:true,subtree:true});ping()}
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);`;
}

export async function GET(request: Request) {
  const siteKey = new URL(request.url).searchParams.get("k")?.trim() ?? "";
  if (!SITE_KEY_PATTERN.test(siteKey)) {
    return new Response("/* Affsense: missing or invalid site key */", {
      status: 400,
      headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new Response(buildScript(getTrackingUrl(), siteKey), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
