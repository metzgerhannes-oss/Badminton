/** One live-first Turniertag view and a Home teaser only for CURRENT source evidence.
 * Home never starts vendor polling and never shows an old result as live. */
import {snapshotPath,liveView,setText,matchLabel,opponents} from "./scripts/live-radar.mjs";
import {readPublicRows} from "./scripts/supabase-read.mjs";
const $=id=>document.getElementById(id);
let selected="",homeSeq=0,homeCtrl;
const valid=id=>typeof id==="string"&&/^\d{2}-\d{6}$/.test(id);
function updateSelector(id){
 const select=$("live-player-select");if(!select)return;
 const selection=window.badmintonLiveViewerOptions?.()||{own:[],friends:[],selected:id};
 select.replaceChildren();
 const groups=[
  {label:"Meine Profile",items:selection.own||[]},
  {label:"Freunde, denen ich folge",items:selection.friends||[]}
 ];
 for(const group of groups){
  if(!group.items.length)continue;
  const optGroup=document.createElement("optgroup");optGroup.label=group.label;
  for(const person of group.items){
   const option=document.createElement("option");
   option.value=person.id;
   option.textContent=person.name+" · "+(valid(person.id)?person.id:"ohne DBV-ID");
   optGroup.appendChild(option);
  }
  select.appendChild(optGroup);
 }
 if(!select.options.length){
  const opt=document.createElement("option");opt.value="";opt.textContent="Noch keine Spieler";
  select.appendChild(opt);select.disabled=true;
 }else select.disabled=false;
 if([...select.options].some(x=>x.value===id))select.value=id;
}
function hideHome(){
 const teaser=$("home-live-peek");if(!teaser)return;
 teaser.hidden=true;teaser.replaceChildren();teaser.removeAttribute("data-status");
}
function node(tag,cls,content){
 const item=document.createElement(tag);if(cls)item.className=cls;
 if(content!==undefined)item.textContent=String(content);return item;
}
function renderHome(snapshot,id){
 const box=$("home-live-peek");
 if(!box||id!==selected||location.hash!=="#start"){hideHome();return}
 const state=liveView(snapshot,id);
 if(!["playing","next","tournament"].includes(state.status)){hideHome();return}
 // "tournament" without published games is not an active-match alert.
 const hasGame=state.status==="playing"||state.status==="next"||state.upcoming?.length>0;
 if(!hasGame){hideHome();return}
 box.replaceChildren();
 const label=state.status==="playing"
   ?(setText(state.running)?"Aktuelles Spiel":"Spiel aufgerufen")
   :state.status==="next"?"Als Nächstes":"Turniertag";
 box.dataset.status=state.status;
 box.appendChild(node("span","home-live-indicator",label));
 const info=node("span","home-live-information");
 info.appendChild(node("strong","",state.tournament||"Aktueller Turniertag"));
 const summary=state.status==="playing"
    ?(opponents(state.running)?"Gegen "+opponents(state.running)+" · ":"")+matchLabel(state.running)+
      (setText(state.running)?" · "+setText(state.running):"")
    :state.status==="next"?"Deine nächste Begegnung ist in Vorbereitung.":"Kommende Begegnungen sind veröffentlicht.";
 info.appendChild(node("small","",summary));
 box.appendChild(info);box.appendChild(node("span","home-live-arrow","↗"));
 box.hidden=false;
}
async function readHome(id){
 ++homeSeq;homeCtrl?.abort();
 if(!valid(id)||location.hash!=="#start"){hideHome();return}
 const seq=homeSeq;homeCtrl=new AbortController();
 const signal=homeCtrl.signal;
 hideHome();
 try{
  const {rows}=await readPublicRows(snapshotPath(id),{signal,count:false});
  if(seq!==homeSeq||signal.aborted||id!==selected||location.hash!=="#start")return;
  renderHome(rows[0]||null,id);
 }catch(error){
  // Old aborted responses must never hide newer player live status.
  if(seq!==homeSeq||signal.aborted||error?.kind==="aborted"||error?.name==="AbortError")return;
  hideHome();
 }
}
document.addEventListener("DOMContentLoaded",()=>{
 const select=$("live-player-select");if(!select)return;
 selected=String(window.badmintonActivePlayerId||"");
 updateSelector(selected);
 select.addEventListener("change",()=>{
  const id=select.value;
  if(!window.badmintonSelectViewer?.(id,{stayOnPage:true}))updateSelector(selected);
 });
 window.addEventListener("badminton:profile-change",event=>{
  const id=String(event.detail?.playerId||"");
  const changed=selected!==id;
  selected=id;
  updateSelector(id);
  if(location.hash==="#start"&&(changed||$("home-live-peek")?.hidden))readHome(id);
  else if(location.hash!=="#start")hideHome();
 });
 window.addEventListener("hashchange",()=>{
  if(location.hash==="#start")readHome(selected);
  else{homeSeq++;homeCtrl?.abort();hideHome()}
 });
 if(location.hash==="#start")readHome(selected);
});
