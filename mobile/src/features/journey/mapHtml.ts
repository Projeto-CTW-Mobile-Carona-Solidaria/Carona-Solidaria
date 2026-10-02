// Leaflet presentation adapted from weg-carona-solidaria-rn-uberstyle.
// No session token or API access is exposed to the embedded page.
export const MAP_HTML = `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>
html,body,#map{height:100%;width:100%;margin:0;background:#f7f8fa}body{font-family:system-ui,sans-serif}
.leaflet-container{font:13px system-ui,sans-serif}.leaflet-control{box-shadow:none!important}
.pin{display:grid;place-items:center;background:#fff;border:2px solid #01296f;border-radius:6px;color:#01296f;font-weight:600;width:28px;height:28px}
.driver{background:#01296f;color:white;border-color:white;border-radius:50%}.destination{width:32px;background:#01296f;color:white}.arrived{background:#166754}
.dark .leaflet-tile-pane{filter:brightness(.65) saturate(.6)}.dark .leaflet-control-zoom a{background:#213549;color:white}
.dark .leaflet-control-attribution{background:#17293b;color:#e5edf5}.dark .leaflet-control-attribution a{color:#adceff}
.fallback{padding:20px;color:#213549}
</style></head><body><div id="map" role="region" aria-label="Trajeto e posição do motorista"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
const post = value => {const data=JSON.stringify(value);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(data);else window.parent.postMessage(data,'*');};
if(!window.L){document.getElementById('map').textContent='Mapa indisponível. Confira sua conexão e recarregue.';post({type:'ERROR'});}
else {
const map=L.map('map',{zoomControl:true,preferCanvas:true,zoomAnimation:false}).setView([-26.48,-49.08],12);
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · Rota: OSRM'}).addTo(map);
let tileErrorSent=false;
tiles.on('tileerror',()=>{if(!tileErrorSent){tileErrorSent=true;post({type:'TILE_ERROR'});}});
const routes=L.layerGroup().addTo(map),pins=L.layerGroup().addTo(map);
let driver=null,lastPlan='',lastFit=-1,destination=null,passengers=new Map();
const icon=(text,cls='')=>L.divIcon({className:'',html:'<div class="pin '+cls+'">'+text+'</div>',iconSize:[32,32],iconAnchor:[16,16]});
const label=text=>{const node=document.createElement('span');node.textContent=text;return node;};
const fit=plan=>{if(plan?.stops?.length)map.fitBounds(plan.stops.map(s=>[s.lat,s.lng]),{padding:[30,30],maxZoom:16,animate:false});};
function update(data){
 document.documentElement.className=data.dark?'dark':'';
 const plan=data.plan,state=data.state,key=JSON.stringify(plan);
 if(key!==lastPlan){
   lastPlan=key;pins.clearLayers();routes.clearLayers();passengers.clear();destination=null;
   if(driver){map.removeLayer(driver);driver=null;}
   if(plan){plan.stops.forEach(s=>{const m=L.marker([s.lat,s.lng],{icon:icon(s.kind==='origin'?'S':s.kind==='destination'?'D':String(s.order),s.kind==='destination'?'destination':'')}).addTo(pins).bindPopup(label(s.label+' · '+s.address));if(s.kind==='passenger')passengers.set(s.id,m);if(s.kind==='destination')destination=m;});fit(plan);}
 }
 if(data.fitVersion!==lastFit){lastFit=data.fitVersion;fit(plan);}
 routes.clearLayers();
 if(!plan)return;
 const progress=state?.progress;
 plan.segments.forEach((segment,i)=>{
   if(progress&&(progress.phase==='arrived'||i<progress.segmentIndex))return;
   const active=progress&&i===progress.segmentIndex;
   if(active&&progress.phase==='boarding')return;
   let geometry=segment.geometry;
   if(active&&state){let nearest=0,best=Infinity;geometry.forEach((p,index)=>{const d=map.distance(p,[state.lat,state.lng]);if(d<best){best=d;nearest=index;}});geometry=geometry.slice(Math.min(nearest,geometry.length-2));}
   L.polyline(geometry,{color:active?(data.dark?'#adceff':'#01296f'):'#8292a4',weight:active?5:3,opacity:active?1:.6,dashArray:active?undefined:'5 7'}).addTo(routes);
 });
 plan.stops.forEach(s=>{if(s.kind==='passenger'){const m=passengers.get(s.id);if(!m)return;const done=progress&&(progress.phase==='arrived'||s.order<progress.nextStopIndex);if(done)pins.removeLayer(m);else if(!pins.hasLayer(m))pins.addLayer(m);}});
 if(destination)destination.setIcon(icon('D','destination'+(progress?.phase==='arrived'?' arrived':'')));
 if(state){if(!driver)driver=L.marker([state.lat,state.lng],{icon:icon('M','driver'),zIndexOffset:900}).addTo(map).bindPopup(label('Motorista'));else driver.setLatLng([state.lat,state.lng]);}
 else if(driver){map.removeLayer(driver);driver=null;}
}
const receive=e=>{if(e.source&&e.source!==window.parent)return;try{const data=JSON.parse(e.data);if(data.type==='STATE')update(data);}catch{}};
window.addEventListener('message',receive);document.addEventListener('message',receive);
new ResizeObserver(()=>map.invalidateSize({animate:false})).observe(document.getElementById('map'));
post({type:'READY'});
}
</script></body></html>`;
