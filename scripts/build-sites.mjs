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

const worker = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health' || url.pathname === '/health') {
      return Response.json({
        ok: true,
        mode: 'hosted-readonly',
        capabilities: { read: true, write: false },
      });
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
      return Response.json(
        { ok: false, error: '公共站点为只读模式，请在本地服务中管理数据。' },
        { status: 405, headers: { Allow: 'GET' } },
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
