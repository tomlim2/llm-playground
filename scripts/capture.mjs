// 배포된 작업물 썸네일 찍기.
// projects.json 의 URL 을 설치된 Chrome 으로 열어서 스크린샷(public/thumbs)과 페이지 제목(src/meta.json)을 저장
//
//   npm run thumbs              아직 안 찍은 것만
//   npm run thumbs -- --all     전부 다시
//   npm run thumbs -- dice      URL 에 "dice" 가 들어간 것만 다시
//   --headed                    창을 띄워서 찍기 (헤드리스에서 WebGL/WebGPU 화면이 까맣게 나올 때)
//
// projects.json 항목별 옵션
//   wait     로드 후 찍기 전까지 기다릴 ms (기본 3000)
//   actions  찍기 전에 할 조작. Playwright 의 page.fill / click / press / hover 그대로
//            예) [["fill", "#name", "menagerie"], ["press", "#name", "Enter"]]

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const VIEWPORT = { width: 1280, height: 800 }; // 카드 비율 16:10
const DEFAULT_WAIT = 3000; // 로드 후 WebGL 첫 프레임, 인트로 애니메이션 기다리는 시간 (ms)
const ACTIONS = new Set(['fill', 'click', 'press', 'hover']);

const root = new URL('../', import.meta.url);
const pathOf = (relative) => fileURLToPath(new URL(relative, root));

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const filters = args.filter((arg) => !arg.startsWith('--'));

const projects = JSON.parse(await readFile(pathOf('projects.json'), 'utf8'));
const previous = JSON.parse(await readFile(pathOf('src/meta.json'), 'utf8').catch(() => '{}'));
const meta = { ...previous };

await mkdir(pathOf('public/thumbs'), { recursive: true });

const queue = [];
for (const project of projects) {
  if (project.thumb) continue; // 직접 넣은 썸네일이 있으면 안 찍음
  const file = `thumbs/${slugOf(project.url)}.jpg`;
  const wanted = filters.length
    ? filters.some((filter) => project.url.includes(filter))
    : flags.has('--all') || !previous[project.url] || !(await exists(pathOf(`public/${file}`)));
  if (wanted) queue.push({ project, file });
}

if (queue.length === 0) {
  console.log('새로 찍을 게 없어요. 다시 찍으려면 --all 이나 URL 일부를 넘겨주세요.');
} else {
  const browser = await chromium.launch({ channel: 'chrome', headless: !flags.has('--headed') });
  const context = await browser.newContext({ viewport: VIEWPORT });
  for (const { project, file } of queue) {
    process.stdout.write(`📸 ${project.url} … `);
    const page = await context.newPage();
    try {
      await page.goto(project.url, { waitUntil: 'load', timeout: 30_000 });
      for (const [action, ...params] of project.actions ?? []) {
        if (!ACTIONS.has(action)) throw new Error(`모르는 action: ${action}`);
        await page[action](...params);
      }
      await page.waitForTimeout(project.wait ?? DEFAULT_WAIT);
      await page.screenshot({ path: pathOf(`public/${file}`), type: 'jpeg', quality: 82 });
      meta[project.url] = { title: (await page.title()).trim(), thumb: file, capturedAt: today() };
      console.log('완료');
    } catch (error) {
      console.log(`실패 — ${error.message.split('\n')[0]}`);
    } finally {
      await page.close();
    }
  }
  await browser.close();
}

// projects.json 순서대로 저장. 목록에서 빠진 URL 은 여기서 정리됨
const ordered = Object.fromEntries(projects.filter(({ url }) => meta[url]).map(({ url }) => [url, meta[url]]));
await writeFile(pathOf('src/meta.json'), `${JSON.stringify(ordered, null, 2)}\n`);

function slugOf(url) {
  const { host, pathname } = new URL(url);
  return `${host}${pathname}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
