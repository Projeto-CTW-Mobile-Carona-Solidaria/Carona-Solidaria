export const MAP_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <style>
    html, body, #map { height:100%; width:100%; margin:0; padding:0; }
    body { overflow:hidden; background:#eaf0f5; }
    .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .leaflet-control-zoom {
  border: 0 !important;
  box-shadow: 0 4px 14px rgba(0,0,0,.15) !important;
}

.leaflet-control-zoom a {
  width: 36px !important;
  height: 36px !important;
  line-height: 36px !important;
  font-size: 20px !important;
}

@media (max-width: 720px) {
  .leaflet-top.leaflet-left {
    top: 132px;
    left: 12px;
  }

  .leaflet-control-zoom a {
    width: 34px !important;
    height: 34px !important;
    line-height: 34px !important;
    font-size: 19px !important;
  }
}
    .driver-pin, .stop-pin, .weg-pin { display:flex; align-items:center; justify-content:center; }
    .driver-pin { width:44px; height:44px; border-radius:50%; background:#005596; border:3px solid #fff; box-shadow:0 5px 16px rgba(0,0,0,.28); color:#fff; font-size:21px; }
    .stop-pin { width:34px; height:34px; border-radius:50%; background:#fff; border:3px solid #005596; box-shadow:0 4px 12px rgba(0,0,0,.18); color:#005596; font-weight:800; font-size:13px; }
    .weg-pin { width:46px; height:46px; border-radius:14px; background:#003F6B; border:3px solid #fff; box-shadow:0 5px 16px rgba(0,0,0,.25); color:#fff; font-weight:900; font-size:14px; }
    .weg-pin.arrived { background:#1D8F56; transform:scale(1.12); }
    .dark .leaflet-tile-pane {
  filter: brightness(.68) contrast(.98) saturate(.82);
}

.dark .leaflet-control-zoom a {
  background: #1C2C38;
  color: #fff;
}

.dark .leaflet-control-attribution {
  background: rgba(21,34,45,.88);
  color: #d6e2eb;
}

.dark .leaflet-control-attribution a {
  color: #9cc7e6;
}
  </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
  const post = (payload) => {
    const data = JSON.stringify(payload);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(data);
    } else if (window.parent && window.parent !== window) {
      window.parent.postMessage(data, '*');
    }
  };
  const map = L.map('map', { zoomControl:true, preferCanvas:true, zoomAnimation:true }).setView([-26.48,-49.08], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const layers = {
    driver: null,
    origin: null,
    destination: null,
    passengers: new Map(),
    futureSegments: [],
    activeSegment: null,
    event: null
  };
  let theme = 'light';
  let initialized = false;

  const htmlIcon = (cls, text) => {
    const size = cls.includes('driver-pin') ? 44 : cls.includes('weg-pin') ? 46 : 34;
    return L.divIcon({ className:'', html:'<div class="'+cls+'">'+text+'</div>', iconSize:[size,size], iconAnchor:[size/2,size/2] });
  };
  const distance = (a,b) => {
    const R=6371000, r=Math.PI/180, dLat=(b[0]-a[0])*r, dLon=(b[1]-a[1])*r;
    const la1=a[0]*r, la2=b[0]*r;
    const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  };
  const nearestIndex = (coords, point) => {
    let best=0,bestD=Infinity;
    coords.forEach((c,i)=>{ const d=distance(c,point); if(d<bestD){bestD=d;best=i;} });
    return best;
  };
  const partial = (coords, point) => {
    if (!Array.isArray(coords) || !coords.length) return [];
    const idx = nearestIndex(coords, point);
    return coords.slice(idx);
  };
  const marker = (lat,lng,icon,opts={}) => {
    const m = L.marker([lat,lng], { icon, ...opts });
    m.addTo(map);
    return m;
  };
  const clearSegments = () => {
    layers.futureSegments.forEach(l=>map.removeLayer(l));
    layers.futureSegments=[];
    if(layers.activeSegment){ map.removeLayer(layers.activeSegment); layers.activeSegment=null; }
  };
  const fitAll = (stops) => {
    const points = stops.filter(Boolean).map(s=>[s.lat,s.lng]);
    if(points.length) map.fitBounds(L.latLngBounds(points).pad(.18), {padding:[10,10], maxZoom:15});
  };
  const renderPlan = (plan) => {
    clearSegments();
    layers.passengers.forEach(m=>map.removeLayer(m)); layers.passengers.clear();
    if(!plan || !plan.segments) return;
    plan.segments.forEach((seg)=>{
      layers.futureSegments.push(L.geoJSON({type:'Feature',geometry:{type:'LineString',coordinates:seg.geometry.map(c=>[c[1],c[0]])}}, {style:{color:'#8EA0AD',weight:4,opacity:.30,dashArray:'6 9'}}).addTo(map));
    });
    if(plan.stops) {
      if(layers.origin) { map.removeLayer(layers.origin); layers.origin=null; }
      if(layers.destination) { map.removeLayer(layers.destination); layers.destination=null; }
      layers.origin = marker(plan.stops[0].lat, plan.stops[0].lng, htmlIcon('stop-pin','•'));
      const last = plan.stops[plan.stops.length-1];
      layers.destination = marker(last.lat,last.lng, htmlIcon('weg-pin','WEG'));
      plan.stops.forEach((s,i)=>{
        if(s.kind==='passenger') {
          if(!layers.passengers.has(s.id)) {
            layers.passengers.set(s.id, marker(s.lat,s.lng,htmlIcon('stop-pin',String(s.order ?? i))));
          } else {
            layers.passengers.get(s.id).setLatLng([s.lat,s.lng]);
          }
        }
      });
    }
  };
  const removePassenger = (id) => {
    const m=layers.passengers.get(id); if(m){ map.removeLayer(m); layers.passengers.delete(id); }
  };
  const setDriver = (lat,lng,animate=true) => {
    if(!layers.driver) layers.driver=marker(lat,lng,htmlIcon('driver-pin','🚗'),{zIndexOffset:900});
    else layers.driver.setLatLng([lat,lng]);
    if(animate) map.panTo([lat,lng], {animate:true,duration:.3});
  };
  const updateActive = (plan, progress) => {
    if(!plan || !plan.segments?.length || !progress) return;
    const idx = Math.min(Math.max(progress.segmentIndex ?? 0,0), plan.segments.length-1);
    if(layers.activeSegment){ map.removeLayer(layers.activeSegment); layers.activeSegment=null; }
    const seg=plan.segments[idx];
    if(!seg?.geometry?.length) return;
    // Trechos concluídos somem; o trecho atual fica azul e o restante fica discreto.
    for(let i=0;i<layers.futureSegments.length;i++){
      const futureLayer = layers.futureSegments[i];
      futureLayer.setStyle({opacity: i > idx ? .30 : 0});
    }
    // O ícone do passageiro some quando a etapa dele foi concluída (após o embarque).
    plan.stops.forEach((stop)=>{
      if(stop.kind==='passenger' && Number(stop.order) < Number(progress.nextStopIndex)){
        removePassenger(stop.id);
      }
    });
    if(progress.phase !== 'moving') return;
    const driverPoint = layers.driver ? layers.driver.getLatLng() : {lat:seg.geometry[0][0],lng:seg.geometry[0][1]};
    const remaining = partial(seg.geometry, [driverPoint.lat, driverPoint.lng]);
    const coords = remaining.length>1 ? remaining : seg.geometry.slice(-2);
    layers.activeSegment = L.polyline(coords, {color: theme==='dark' ? '#66B8F3' : '#005596', weight:6, opacity:.96, lineCap:'round', lineJoin:'round'}).addTo(map);
  };
  const setTheme = (next) => {
    theme=next; document.documentElement.className = next==='dark'?'dark':'';
  };

  const handle = (msg) => {
    let p; try { p=JSON.parse(msg); } catch { return; }
    if(!p || !p.type) return;
    if(p.type==='THEME'){ setTheme(p.value); }
    if(p.type==='PLAN'){
      renderPlan(p.plan);
      fitAll(p.plan?.stops || []);
      initialized=true;
      post({type:'READY'});
    }
    if(p.type==='DRIVER'){ setDriver(p.lat,p.lng,false); updateActive(p.plan,p.progress); }
    if(p.type==='FIT'){ fitAll(p.stops||[]); }
    if(p.type==='REMOVE_PASSENGER'){ removePassenger(p.id); }
    if(p.type==='ARRIVED_WEG'){
      if(layers.destination){ layers.destination.setIcon(htmlIcon('weg-pin arrived','WEG')); }
      if(layers.driver && layers.destination) map.fitBounds(L.latLngBounds([layers.driver.getLatLng(),layers.destination.getLatLng()]).pad(.55),{padding:[20,20]});
    }
    if(p.type==='CLEAR'){
      clearSegments();
      layers.passengers.forEach(m=>map.removeLayer(m)); layers.passengers.clear();
      if(layers.driver){map.removeLayer(layers.driver);layers.driver=null;}
      if(layers.origin){map.removeLayer(layers.origin);layers.origin=null;}
      if(layers.destination){map.removeLayer(layers.destination);layers.destination=null;}
    }
  };
  document.addEventListener('message', e=>handle(e.data));
  window.addEventListener('message', e=>handle(e.data));
  setTimeout(()=>post({type:'READY'}), 300);
</script>
</body>
</html>`;

