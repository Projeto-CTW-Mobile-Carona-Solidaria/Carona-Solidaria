const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3001;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'WEG-Carona-Solidaria-MVP/1.3 (academic prototype)';
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const GEOCODE_MIN_INTERVAL_MS = 1100;

const app = express();

// Em desenvolvimento o Expo Web normalmente roda em outra porta
// (por exemplo 8081/19006) e acessa o backend em localhost:3000.
// Habilitamos CORS no Express para que as chamadas /api funcionem no navegador.
// Também desabilitamos ETag nesta API para evitar respostas 304 que podem ser
// tratadas como ERR_FAILED pelo React Native Web/Metro em alguns cenários.
app.disable('etag');
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const drivers = new Map();
const geocodeCache = new Map();
let lastNominatimRequestAt = 0;
let geocodeQueue = Promise.resolve();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'weg-carona-solidaria-mvp',
    driversOnline: drivers.size,
    cachedAddresses: geocodeCache.size,
    timestamp: new Date().toISOString()
  });
});

function normalizeAddress(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripBrazilSuffix(address) {
  return address.replace(/,?\s*Brasil\s*$/i, '').trim();
}

function stripCep(address) {
  return address.replace(/,?\s*\d{5}-?\d{3}/g, '').replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').trim();
}

function buildGeocodeQueries(address) {
  const original = stripBrazilSuffix(address);
  const withoutCep = stripCep(original);
  const queries = [];
  const add = (q, precision) => {
    q = q.replace(/\s*,\s*,/g, ',').replace(/,\s*$/g, '').trim();
    if (!q) return;
    if (!queries.some((item) => item.q.toLowerCase() === q.toLowerCase())) {
      queries.push({ q, precision });
    }
  };

  add(original, 'address');

  const match = withoutCep.match(/^(.+?),\s*(\d+)\s*,\s*(.*)$/);
  if (match) {
    const street = match[1].trim();
    const context = match[3].trim();
    add(`${street}, ${match[2]}, ${context}`, 'address');
    add(`${street}, ${context}`, 'street');
    add(`${street}, Jaraguá do Sul, SC`, 'street');
    add(`${street}, Jaragua do Sul, SC`, 'street');
  } else {
    add(withoutCep, 'street');
  }

  const cepMatch = original.match(/\b(\d{5}-?\d{3})\b/);
  if (cepMatch) {
    add(`${cepMatch[1]}, Jaraguá do Sul, SC`, 'postcode');
    add(`${cepMatch[1]}, Jaragua do Sul, SC`, 'postcode');
  }

  return queries;
}

async function geocodeWithNominatimQuery(query) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', `${query}, Brasil`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'br');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('dedupe', '1');
  url.searchParams.set('accept-language', 'pt-BR');

  const response = await fetch(url, {
    headers: {
      'User-Agent': NOMINATIM_USER_AGENT,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);

  const results = await response.json();
  if (!Array.isArray(results) || !results.length) return null;

  const result = results[0];
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    lat,
    lng,
    displayName: result.display_name,
    type: result.type || null,
    osmType: result.osm_type || null,
    osmId: result.osm_id || null
  };
}

async function geocodeAddress(address) {
  const queries = buildGeocodeQueries(address);
  let lastError = null;

  for (let index = 0; index < queries.length; index += 1) {
    const item = queries[index];
    try {
      const result = await geocodeWithNominatimQuery(item.q);
      if (result) {
        return {
          ...result,
          precision: item.precision,
          queryUsed: item.q
        };
      }
    } catch (error) {
      lastError = error;
      console.error(`Falha ao testar consulta "${item.q}":`, error.message);
    }

    if (index < queries.length - 1) await sleep(GEOCODE_MIN_INTERVAL_MS);
  }

  if (lastError) throw lastError;
  return null;
}

function enqueueGeocode(address) {
  geocodeQueue = geocodeQueue.then(async () => {
    const key = address.toLowerCase();
    const cached = geocodeCache.get(key);

    if (cached && Date.now() - cached.createdAt < GEOCODE_CACHE_TTL_MS) {
      return cached.value;
    }

    const elapsed = Date.now() - lastNominatimRequestAt;
    if (elapsed < GEOCODE_MIN_INTERVAL_MS) {
      await sleep(GEOCODE_MIN_INTERVAL_MS - elapsed);
    }

    const result = await geocodeAddress(address);
    lastNominatimRequestAt = Date.now();

    if (result) geocodeCache.set(key, { createdAt: Date.now(), value: result });
    return result;
  });

  return geocodeQueue;
}

app.get('/api/geocode', async (req, res) => {
  const address = normalizeAddress(req.query.address);

  if (address.length < 4) return res.status(400).json({ error: 'Informe um endereço válido.' });
  if (address.length > 300) return res.status(400).json({ error: 'O endereço informado é muito longo.' });

  try {
    const result = await enqueueGeocode(address);
    if (!result) {
      return res.status(404).json({
        error: 'Endereço não encontrado no OpenStreetMap. Tente rua + bairro + cidade + estado ou um CEP.'
      });
    }
    return res.json(result);
  } catch (error) {
    console.error('Erro no geocoding:', error.message);
    return res.status(502).json({ error: 'O serviço de endereços não respondeu. Tente novamente em alguns segundos.' });
  }
});

io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  socket.on('register_role', ({ role, driverId }) => {
    socket.data.role = role;
    socket.data.driverId = driverId || null;

    if (role === 'passenger') {
      for (const driver of drivers.values()) socket.emit('update_map', driver);
    }
  });

  socket.on('driver_location', (payload) => {
    if (socket.data.role !== 'driver') return;

    const { driverId, lat, lng, timestamp, source, progress, routePlan, boardingLeft } = payload || {};
    if (!driverId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

    const normalizedProgress = (progress && typeof progress === 'object')
      ? {
          segmentIndex: Number.isFinite(progress.segmentIndex) ? progress.segmentIndex : 0,
          fraction: Number.isFinite(progress.fraction) ? Math.max(0, Math.min(1, progress.fraction)) : 0,
          phase: ['idle','moving','boarding','arrived'].includes(progress.phase) ? progress.phase : 'moving',
          nextStopIndex: Number.isFinite(progress.nextStopIndex) ? progress.nextStopIndex : 1
        }
      : null;

    const state = {
      driverId,
      lat,
      lng,
      timestamp: timestamp || Date.now(),
      source: source || 'gps',
      progress: normalizedProgress,
      routePlan: routePlan || null,
      boardingLeft: Number.isFinite(boardingLeft) ? Math.max(0, Math.ceil(boardingLeft)) : 0
    };

    drivers.set(driverId, state);
    socket.broadcast.emit('update_map', state);
  });

  socket.on('driver_status', ({ driverId, active, routePlan }) => {
    if (socket.data.role !== 'driver' || !driverId) return;

    if (!active) {
      drivers.delete(driverId);
      socket.broadcast.emit('driver_offline', { driverId });
      return;
    }

    const current = drivers.get(driverId) || { driverId };
    current.routePlan = routePlan || current.routePlan || null;
    current.timestamp = Date.now();
    drivers.set(driverId, current);
    socket.broadcast.emit('driver_online', { driverId, routePlan: current.routePlan });
  });

  socket.on('disconnect', () => {
    const driverId = socket.data.driverId;
    if (socket.data.role === 'driver' && driverId) {
      drivers.delete(driverId);
      socket.broadcast.emit('driver_offline', { driverId });
    }
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n🚗 WEG Carona Solidária disponível em http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log('   Geocoding: Nominatim/OpenStreetMap com cache e fila.\n');
});
