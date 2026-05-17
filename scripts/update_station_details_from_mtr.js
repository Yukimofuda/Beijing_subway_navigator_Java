const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const sourcePath = path.join(ROOT, 'data', 'station_detail_sources.json');
const detailPath = path.join(ROOT, 'data', 'station_details.json');

async function fetchHtml(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'BeijingSubwayNavigatorCourseProject/1.0'
        }
    });
    if (!response.ok) throw new Error(`${url} ${response.status}`);
    return response.text();
}

function stripHtml(html) {
    return String(html || '')
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{2,}/g, '\n')
        .trim();
}

function extractSectionText(text, title, nextTitles) {
    const start = text.indexOf(title);
    if (start === -1) return [];
    let end = text.length;

    for (const next of nextTitles) {
        const pos = text.indexOf(next, start + title.length);
        if (pos !== -1 && pos < end) end = pos;
    }

    return text
        .slice(start + title.length, end)
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index);
}

function parseMtrStationPage(stationName, url, html) {
    const text = stripHtml(html);
    const titles = [
        '紧急呼叫设备',
        '无障碍卫生间',
        '直升电梯',
        '坡道',
        '卫生间',
        '自动售票机',
        '警务室',
        '综合控制室',
        '乘客服务中心',
        'AED',
        '综合售货机',
        '自动售水机',
        '寄存柜',
        '共享充电宝'
    ];

    return {
        source: {
            provider: 'mtr.bj.cn',
            url,
            updatedAt: new Date().toISOString().slice(0, 10)
        },
        facilities: {
            emergencyCall: extractSectionText(text, '紧急呼叫设备', titles),
            accessibleToilet: extractSectionText(text, '无障碍卫生间', titles),
            elevator: extractSectionText(text, '直升电梯', titles),
            ramp: extractSectionText(text, '坡道', titles),
            toilet: extractSectionText(text, '卫生间', titles),
            ticketMachine: extractSectionText(text, '自动售票机', titles),
            policeOffice: extractSectionText(text, '警务室', titles),
            controlRoom: extractSectionText(text, '综合控制室', titles),
            serviceCenter: extractSectionText(text, '乘客服务中心', titles),
            aed: extractSectionText(text, 'AED', titles),
            vendingMachine: extractSectionText(text, '综合售货机', titles),
            waterMachine: extractSectionText(text, '自动售水机', titles),
            locker: extractSectionText(text, '寄存柜', titles),
            powerBank: extractSectionText(text, '共享充电宝', titles)
        },
        exits: {},
        notes: []
    };
}

async function readJson(filePath, fallback = {}) {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

async function main() {
    const sourceMap = await readJson(sourcePath);
    const details = await readJson(detailPath);

    for (const [stationName, url] of Object.entries(sourceMap)) {
        try {
            const html = await fetchHtml(url);
            const parsed = parseMtrStationPage(stationName, url, html);
            details[stationName] = {
                ...(details[stationName] || {}),
                ...parsed
            };
            console.log(`updated ${stationName}`);
        } catch (error) {
            console.warn(`failed ${stationName}: ${error.message}`);
        }
    }

    await fs.writeFile(detailPath, `${JSON.stringify(details, null, 2)}\n`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
