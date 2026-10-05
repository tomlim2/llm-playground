// 작업물 썸네일·버전 동기화.
// projects.json 의 URL 중 새로 추가됐거나 GitHub Pages 에 다시 배포된 것만 Chrome 으로 열어서
// 스크린샷(public/thumbs)을 찍고, 페이지 제목과 배포 버전(src/meta.json)을 저장
// 찍다가 실패한 작업물이 있어도 나머지는 저장하고, 마지막에 종료 코드 1 로 끝남
//
//   npm run thumbs              새로 추가됐거나 다시 배포된 것만
//   npm run thumbs -- --all     전부 다시
//   npm run thumbs -- dice      URL 에 "dice" 가 들어간 것만 다시
//   npm run thumbs -- --check   찍지는 않고 뭐가 바뀌었는지만 (GitHub Actions 의 Sync 가 씀)
//   --headed                    창을 띄워서 찍기 (헤드리스에서 WebGL/WebGPU 화면이 까맣게 나올 때)
//
// projects.json 항목별 옵션
//   title    카드 제목 직접 지정. 문자열이거나 언어별 { "en": "Dice Roll" } (ko / en, 없는 언어는 페이지 <title>)
//   thumb    직접 만든 이미지. 있으면 캡처 안 함
//   repo     "owner/name". 주소가 owner.github.io/name/ 꼴이 아닐 때 배포 확인용
//   wait     로드 후 찍기 전까지 기다릴 ms (기본 3000)
//   actions  찍기 전에 할 조작. Playwright 의 page.fill / click / press / hover 그대로
//            예) [["fill", "#name", "menagerie"], ["press", "#name", "Enter"]]

import { access, appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const VIEWPORT = { width: 1280, height: 800 }; // 카드 비율 16:10
const DEFAULT_WAIT = 3000; // 로드 후 WebGL 첫 프레임, 인트로 애니메이션 기다리는 시간 (ms)
const SETTLE_MS = 10 * 60 * 1000; // 막 끝난 배포는 Pages CDN 에 옛 화면이 남아 있을 수 있어 이만큼 지나서 찍음
const ACTIONS = new Set(['fill', 'click', 'press', 'hover']);

const root = new URL('../', import.meta.url);
const pathOf = (relative) => fileURLToPath(new URL(relative, root));

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const filters = args.filter((arg) => !arg.startsWith('--'));

const projects = JSON.parse(await readFile(pathOf('projects.json'), 'utf8'));
const previous = JSON.parse(await readFile(pathOf('src/meta.json'), 'utf8').catch(() => '{}'));
const meta = { ...previous };

// ── 1. 뭘 찍을지 고르기 ───────────────────────────────

const queue = [];
for (const project of projects) {
  if (project.thumb) continue; // 직접 넣은 썸네일이 있으면 안 찍음
  const file = `thumbs/${slugOf(project.url)}.jpg`;
  const known = previous[project.url];
  const deploy = await latestDeploy(project);
  let reason = null;
  if (filters.length) {
    if (filters.some((filter) => project.url.includes(filter))) reason = '지정';
  } else if (flags.has('--all')) {
    reason = '전부';
  } else if (!known || !(await exists(pathOf(`public/${file}`)))) {
    reason = '새 작업물';
  } else if (deploy && deploy.sha !== known.deploySha) {
    reason = `새 배포 ${deploy.version ?? deploy.date}`;
  }
  if (reason) queue.push({ project, file, deploy, reason });
}

if (flags.has('--check')) {
  for (const { project, reason } of queue) console.log(`• ${project.url} (${reason})`);
  if (queue.length === 0) console.log('바뀐 작업물 없음');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${queue.length > 0}\n`);
  process.exit(0);
}

// ── 2. 찍기 ──────────────────────────────────────────

let failures = 0;
if (queue.length === 0) {
  console.log('새로 찍을 게 없어요. 다시 찍으려면 --all 이나 URL 일부를 넘겨주세요.');
} else {
  await mkdir(pathOf('public/thumbs'), { recursive: true });
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: !flags.has('--headed'),
    // GPU 없는 CI 서버에서도 WebGL 이 그려지게 소프트웨어 렌더러 허용
    args: process.env.CI ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
  });
  const context = await browser.newContext({ viewport: VIEWPORT });
  for (const { project, file, deploy, reason } of queue) {
    process.stdout.write(`📸 ${project.url} (${reason}) … `);
    const page = await context.newPage();
    try {
      await page.goto(project.url, { waitUntil: 'load', timeout: 30_000 });
      for (const [action, ...params] of project.actions ?? []) {
        if (!ACTIONS.has(action)) throw new Error(`모르는 action: ${action}`);
        await page[action](...params);
      }
      await page.waitForTimeout(project.wait ?? DEFAULT_WAIT);
      await page.screenshot({ path: pathOf(`public/${file}`), type: 'jpeg', quality: 82 });
      const known = previous[project.url];
      meta[project.url] = {
        title: (await page.title()).trim(),
        thumb: file,
        capturedAt: today(),
        // 배포 정보를 못 읽었으면 (아직 CDN 대기 중 등) 이전 값 유지
        version: deploy ? (deploy.version ?? undefined) : known?.version,
        deployedAt: deploy?.date ?? known?.deployedAt,
        deploySha: deploy?.sha ?? known?.deploySha,
      };
      console.log('완료');
    } catch (error) {
      // 실패한 건 meta 를 안 고치니 다음 Sync 때 다시 시도됨
      failures += 1;
      const message = error.message.split('\n')[0];
      console.log(`실패 — ${message}`);
      if (process.env.GITHUB_ACTIONS) console.log(`::error::${project.url} 캡처 실패: ${message}`);
    } finally {
      await page.close();
    }
  }
  await browser.close();
}

// ── 3. 저장 ──────────────────────────────────────────

// projects.json 순서대로. 목록에서 빠진 URL 은 여기서 정리됨
const ordered = Object.fromEntries(projects.filter(({ url }) => meta[url]).map(({ url }) => [url, meta[url]]));
await writeFile(pathOf('src/meta.json'), `${JSON.stringify(ordered, null, 2)}\n`);

// 하나라도 실패했으면 종료 코드로 알림 (찍힌 나머지는 위에서 이미 저장함)
if (failures > 0) {
  console.log(`\n❌ ${failures}건 캡처 실패`);
  process.exitCode = 1;
}

/**
 * 그 작업물의 가장 최근 GitHub Pages 배포: 커밋, 태그로 배포됐으면 버전, 날짜.
 * 저장소를 모르거나, 마지막 배포가 실패했거나, 막 끝나서 아직 기다려야 하면 null
 */
async function latestDeploy(project) {
  const repo = project.repo ?? repoOf(project.url);
  if (!repo) return null;
  const [deployment] = (await github(`/repos/${repo}/deployments?environment=github-pages&per_page=1`)) ?? [];
  if (!deployment) return null;
  const [status] = (await github(`/repos/${repo}/deployments/${deployment.id}/statuses?per_page=1`)) ?? [];
  if (status?.state !== 'success' || Date.now() - Date.parse(status.created_at) < SETTLE_MS) return null;
  let version = /^v\d/.test(deployment.ref) ? deployment.ref : null;
  if (!version) {
    // 브랜치로 배포됐어도 그 커밋에 버전 태그가 붙어 있으면 그걸로
    const tags = (await github(`/repos/${repo}/tags?per_page=20`)) ?? [];
    version = tags.find((tag) => tag.commit.sha === deployment.sha && /^v\d/.test(tag.name))?.name ?? null;
    if (!version) {
      // gh-pages 같은 배포용 브랜치는 태그가 소스 커밋에만 붙고 배포 커밋엔 없음.
      // 대신 배포 커밋 메시지가 "deploy v0.3.0 <소스 sha>" 꼴이면 그 태그로 (실제 있는 태그만, sha 가 있으면 태그 커밋과 같을 때만)
      const { message = '' } = (await github(`/repos/${repo}/git/commits/${deployment.sha}`)) ?? {};
      const [, name, built] = message.match(/^deploy\s+(v\d\S*)(?:\s+([0-9a-f]{40}))?/i) ?? [];
      version = tags.find((tag) => tag.name === name && (!built || tag.commit.sha === built))?.name ?? null;
    }
  }
  return { sha: deployment.sha, version, date: deployment.created_at.slice(0, 10) };
}

async function github(path) {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: 'application/vnd.github+json', ...(token && { Authorization: `Bearer ${token}` }) },
  });
  if (!response.ok) {
    console.warn(`⚠️ GitHub API ${response.status} — ${path}`);
    return null;
  }
  return response.json();
}

// https://owner.github.io/name/… → owner/name
function repoOf(url) {
  const { host, pathname } = new URL(url);
  const owner = host.match(/^([^.]+)\.github\.io$/)?.[1];
  const name = pathname.split('/').find(Boolean);
  return owner && name ? `${owner}/${name}` : null;
}

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
