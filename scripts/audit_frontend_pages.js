const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'docs', 'screenshots');

const PAGES = [
  {
    path: '/index.html',
    mustContain: ['北京地铁查询系统'],
    minButtons: 2,
    minInputs: 0,
  },
  {
    path: '/query.html',
    mustContain: ['线路查询', '出发站点', '目的站点', 'query-button'],
    minButtons: 4,
    minInputs: 2,
  },
  {
    path: '/Map.html',
    mustContain: ['北京地铁线路图', 'map'],
    minButtons: 1,
    minInputs: 1,
  },
  {
    path: '/fare_calculator.html',
    mustContain: ['票价与距离测算', 'fare-calc', 'fare-actions'],
    minButtons: 2,
    minInputs: 2,
  },
  {
    path: '/station_guide.html',
    mustContain: ['站点导览', 'station'],
    minButtons: 1,
    minInputs: 1,
  },
  {
    path: '/service_board.html',
    mustContain: ['线路运行看板', '线路状态'],
    minButtons: 1,
    minInputs: 0,
  },
  {
    path: '/lines.html',
    mustContain: ['线路'],
    minButtons: 0,
    minInputs: 0,
  },
  {
    path: '/stations.html',
    mustContain: ['站点'],
    minButtons: 0,
    minInputs: 0,
  },
  {
    path: '/trains.html',
    mustContain: ['车次'],
    minButtons: 0,
    minInputs: 0,
  },
  {
    path: '/timetable.html',
    mustContain: ['时刻表'],
    minButtons: 0,
    minInputs: 0,
  },
];

function requestPage(port, pagePath) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: 'localhost',
        port,
        path: pagePath,
        timeout: 5000,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`timeout on port ${port}`));
    });
    req.on('error', reject);
  });
}

async function detectPort() {
  const candidates = process.env.PORT
    ? [Number(process.env.PORT)]
    : [3000, 3001, 3002, 3003, 3004, 3005];

  for (const port of candidates) {
    try {
      const res = await requestPage(port, '/health');
      if (res.statusCode >= 200 && res.statusCode < 500) return port;
    } catch (_) {
      // try next port
    }
  }

  throw new Error('No local server found. Run node src/Node.js first.');
}

function countMatches(html, pattern) {
  return (html.match(pattern) || []).length;
}

function stripTags(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  let port = null;
  try {
    port = await detectPort();
  } catch (error) {
    console.warn(`${error.message} Falling back to local file audit.`);
  }
  const rows = [];
  const failures = [];

  for (const page of PAGES) {
    const res = port
      ? await requestPage(port, page.path)
      : {
          statusCode: 200,
          body: fs.readFileSync(path.join(ROOT, page.path.replace(/^\//, '')), 'utf8'),
        };
    const html = res.body || '';
    const text = stripTags(html);
    const buttonCount = countMatches(html, /<button\b/gi) + countMatches(html, /class="[^"]*\bbtn\b/gi) + countMatches(html, /class="[^"]*\broute-tile\b/gi);
    const inputCount = countMatches(html, /<input\b/gi) + countMatches(html, /<select\b/gi);
    const missingText = page.mustContain.filter((needle) => !html.includes(needle) && !text.includes(needle));
    const ok =
      res.statusCode === 200 &&
      text.length > 20 &&
      buttonCount >= page.minButtons &&
      inputCount >= page.minInputs &&
      missingText.length === 0;

    rows.push({
      page: page.path,
      status: res.statusCode,
      textLength: text.length,
      buttons: buttonCount,
      inputs: inputCount,
      ok,
      missing: missingText.join(' / '),
    });

    if (!ok) failures.push(page.path);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'frontend_pages_audit.json'),
    JSON.stringify({ port, mode: port ? 'http' : 'file', generatedAt: new Date().toISOString(), rows }, null, 2)
  );

  console.table(rows);

  if (failures.length) {
    console.error(`FAIL: frontend page audit failed for ${failures.join(', ')}`);
    process.exit(1);
  }

  console.log('PASS: frontend page static audit');
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
