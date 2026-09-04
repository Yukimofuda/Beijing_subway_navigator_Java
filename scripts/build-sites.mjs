import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const client = path.join(dist, 'client');
const server = path.join(dist, 'server');

const publicEntries = [
  'assets',
  'data',
  'style',
  'src',
  'Beijing_Subway_System_Map.svg',
  'index2_background.png',
  'index_background.png',
  'lines.png',
  'station.png',
  'manifest.webmanifest',
];

const rootEntries = await readdir(root, { withFileTypes: true });
for (const entry of rootEntries) {
  if (entry.isFile() && entry.name.endsWith('.html')) publicEntries.push(entry.name);
}

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });

for (const entry of publicEntries) {
  await cp(path.join(root, entry), path.join(client, entry), { recursive: true });
}

const worker = `function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=600', ...headers },
  });
}

async function loadAssetJson(request, env, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = '';
  const response = await env.ASSETS.fetch(new Request(url, request));
  if (!response.ok) throw new Error(pathname + ' ' + response.status);
  return response.json();
}

function simplifyLineName(value) {
  return String(value || '').replace(/^地铁/, '').replace(/\\(.+\\)$/, '').replace(/(内环|外环)$/, '').trim();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health' || url.pathname === '/health') {
      return json({
        ok: true,
        mode: 'hosted-readonly',
        capabilities: { read: true, write: false },
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/network') {
      try {
        const stations = await loadAssetJson(request, env, '/data/_station.json');
        const lines = new Set();
        Object.values(stations || {}).forEach((info) => (info.lines || []).forEach((line) => lines.add(simplifyLineName(line))));
        return json({
          stationCount: Object.keys(stations || {}).length,
          lineCount: lines.size,
          dayTypes: ['工作日', '双休日'],
          source: 'hosted-json-api',
        });
      } catch (error) {
        return json({ ok: false, error: error.message }, 500);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/lines') {
      try {
        const stations = await loadAssetJson(request, env, '/data/_station.json');
        const lines = new Map();
        Object.entries(stations || {}).forEach(([stationName, info]) => {
          (info.lines || []).forEach((rawLine) => {
            const label = simplifyLineName(rawLine);
            if (!lines.has(label)) lines.set(label, { label, fullNames: new Set(), stations: new Set() });
            lines.get(label).fullNames.add(rawLine);
            lines.get(label).stations.add(stationName);
          });
        });
        return json({
          lines: Array.from(lines.values()).map((line) => ({
            label: line.label,
            fullNames: Array.from(line.fullNames),
            stationCount: line.stations.size,
          })).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN', { numeric: true })),
        });
      } catch (error) {
        return json({ ok: false, error: error.message }, 500);
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/stations/')) {
      try {
        const stationName = decodeURIComponent(url.pathname.slice('/api/stations/'.length));
        const stations = await loadAssetJson(request, env, '/data/_station.json');
        if (!stations[stationName]) return json({ ok: false, error: '未找到站点' }, 404);
        return json({ name: stationName, ...stations[stationName] });
      } catch (error) {
        return json({ ok: false, error: error.message }, 500);
      }
    }

    const staticApiFiles = {
      '/api/stations': '/data/_station.json',
      '/api/pinyin': '/data/station_pinyin.json',
      '/api/station-details': '/data/station_details.json',
    };
    if (request.method === 'GET' && staticApiFiles[url.pathname]) {
      url.pathname = staticApiFiles[url.pathname];
      return env.ASSETS.fetch(new Request(url, request));
    }

    if (request.method === 'GET' && url.pathname === '/api/timetable') {
      const day = (url.searchParams.get('day') || 'workday').toLowerCase();
      url.pathname = ['weekend', '双休日', '周末'].includes(day)
        ? '/data/timetable.weekend.json'
        : '/data/timetable.workday.json';
      url.search = '';
      return env.ASSETS.fetch(new Request(url, request));
    }

    if (request.method !== 'GET' && ['/saveStationData', '/saveTimetableData', '/deleteTimetableStations'].includes(url.pathname)) {
      return json(
        { ok: false, error: '公共站点为只读模式，请在本地服务中管理数据。' },
        405,
        { Allow: 'GET' },
      );
    }

    if (url.pathname === '/') {
      url.pathname = '/index.html';
      return env.ASSETS.fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  },
};
`;

await writeFile(path.join(server, 'index.js'), worker, 'utf8');
console.log(`Sites build ready: ${publicEntries.length} public entries`);
