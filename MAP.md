# Project Map

LLM과 함께 만들어 배포한 작업물 링크 허브. 카드 하나 = 썸네일 + 페이지 제목 + URL + 배포 버전.
사람은 작업물 목록(`projects.json`)만 관리하고, 썸네일·제목·버전은 스크립트와 GitHub Actions 가 채운다.

- 사이트: https://tomlim2.github.io/llm-playground/
- 저장소: https://github.com/tomlim2/llm-playground (로컬 폴더 이름은 `www/hub`, package 이름도 `hub`)

## 기술 스펙

| 항목 | 내용 |
|---|---|
| 페이지 | 바닐라 JS + CSS, 프레임워크 없음. 런타임 의존성 0 (빌드된 JS 약 3KB) |
| 빌드 | Vite 8. `base: './'` 라서 어느 하위 경로에 올려도 동작 |
| 썸네일 캡처 | Node 22 + `playwright-core` 로 설치된 Google Chrome 을 구동 (브라우저를 따로 받지 않음) |
| 배포 정보 | GitHub REST API (deployments, deployment statuses, tags) |
| 호스팅 | GitHub Pages, 소스 = GitHub Actions |
| CI | `deploy.yml` (버전 태그 → 배포), `sync.yml` (매시간 작업물 확인 → 갱신·배포) |

## 구조

```
index.html              마크업: 머리(제목·개수), #grid, 카드 <template id="card-template">
vite.config.js          base './'
projects.json           [직접 관리] 작업물 목록. 배열 순서 = 화면 순서
src/
  main.js               projects.json + meta.json 을 합쳐 카드를 그림
  meta.json             [생성됨] 페이지 제목, 썸네일 경로, 배포 버전·날짜·커밋
  style.css             레이아웃, 라이트/다크 테마
public/
  favicon.svg
  thumbs/*.jpg          [생성됨] 1280×800 스크린샷
scripts/
  capture.mjs           변경 감지 + 캡처 (npm run thumbs)
.github/workflows/
  deploy.yml            v* 태그 push → 빌드 → Pages 배포
  sync.yml              매시 17분: 바뀐 작업물만 다시 찍어 커밋 → Pages 배포
README.md               사용법 요약
MAP.md                  이 문서
```

[생성됨] 파일도 손으로 고칠 수는 있지만 다음 캡처 때 덮어쓴다.

## 데이터

### projects.json (직접 관리)

```json
[
  { "url": "https://tomlim2.github.io/dice-roll/" },
  {
    "url": "https://tomlim2.github.io/some-app/",
    "actions": [["fill", "#name", "menagerie"], ["press", "#name", "Enter"]]
  },
  { "url": "https://tomlim2.github.io/mmd-anju/", "wait": 7000 }
]
```

| 키 | 필수 | 설명 |
|---|---|---|
| `url` | O | 배포된 주소. 카드 링크이자 캡처 대상 |
| `title` | | 카드 제목. 없으면 페이지 `<title>` |
| `thumb` | | 직접 만든 이미지 (`public/` 기준 경로나 URL). 있으면 캡처하지 않음 |
| `repo` | | `owner/name`. 주소가 `owner.github.io/name/` 꼴이 아닐 때 배포 확인용 |
| `wait` | | 로드 후 캡처까지 기다릴 ms (기본 3000). 로딩 화면이 찍히면 늘림 |
| `actions` | | 캡처 전 조작 목록. 각 항목 `[동작, ...인자]`, 동작은 Playwright `page.fill / click / press / hover` |

### src/meta.json (생성됨)

URL 을 키로 한 객체. `capture.mjs` 가 projects.json 순서대로 다시 쓰고, 목록에서 빠진 URL 은 지운다.

```json
"https://tomlim2.github.io/dice-roll/": {
  "title": "주사위 굴리기",
  "thumb": "thumbs/tomlim2-github-io-dice-roll.jpg",
  "capturedAt": "2026-10-02",
  "version": "v0.2.0",
  "deployedAt": "2026-10-02",
  "deploySha": "7d62930b3b2982af98d4ad51ca97a7260a293bc7"
}
```

- `deploySha`: 변경 감지 기준. 작업물의 최신 Pages 배포 커밋과 다르면 다시 찍는다
- `version`: 버전 태그로 배포됐을 때만 있다
- 썸네일 파일 이름: URL 의 host + path 를 소문자·하이픈으로 (`tomlim2.github.io/dice-roll/` → `tomlim2-github-io-dice-roll.jpg`)

### 카드 표시 규칙 (src/main.js)

| 칸 | 값 |
|---|---|
| 제목 | `title` → 페이지 제목 → 짧은 URL |
| 썸네일 | `thumb` → 생성된 썸네일 + `?v=찍은날짜` (다시 찍어도 파일 이름이 같아서 캐시 무효화용). 둘 다 없으면 도메인 첫 글자 |
| URL | 프로토콜과 끝 슬래시를 뺀 주소. 길면 말줄임 |
| 버전 | `version` → 배포 날짜 (`2026.10.02`). 마우스를 올리면 `YYYY-MM-DD 배포` |
| 개수 | 머리 오른쪽 두 자리 숫자 (`06`) |

카드는 새 탭으로 연다 (`target="_blank" rel="noopener"`).

화면: 카드 폭 최소 340px 로 자동 열 수 (`auto-fill`), 썸네일 16:10 위쪽 기준으로 자름, 라이트/다크는 시스템 설정을 따르고
`prefers-reduced-motion` 이면 등장 애니메이션을 끈다.

## 캡처 스크립트 (scripts/capture.mjs)

### 명령

| 명령 | 하는 일 |
|---|---|
| `npm run thumbs` | 새로 추가됐거나 다시 배포된 것만 찍기 |
| `npm run thumbs -- --all` | 전부 다시 |
| `npm run thumbs -- dice` | URL 에 `dice` 가 들어간 것만 (여러 개 가능) |
| `npm run thumbs -- --check` | 찍지 않고 바뀐 것 목록만. `GITHUB_OUTPUT` 이 있으면 `changed=true/false` 기록 |
| `--headed` | 창을 띄워서 찍기 (헤드리스에서 화면이 까맣게 나올 때) |

### 다시 찍는 조건

1. 인자로 지정했거나 `--all`
2. meta.json 에 없거나 썸네일 파일이 없음 → 새 작업물
3. 작업물 저장소의 최신 `github-pages` 배포 커밋 ≠ `deploySha` → 새 배포

최신 배포를 읽는 방법 (`latestDeploy`):

- 저장소: `repo` 키, 없으면 URL 에서 (`owner.github.io/name/` → `owner/name`). 못 정하면 배포 확인을 건너뜀
- `GET /repos/{repo}/deployments?environment=github-pages&per_page=1` → 그 배포의 최신 status
- status 가 `success` 가 아니면 (진행 중·실패) 건너뜀. 실제 사이트는 아직 이전 배포라서
- 성공한 지 10분(`SETTLE_MS`)이 안 됐으면 건너뜀. Pages CDN 이 옛 화면을 줄 수 있어서. 다음 확인 때 찍힌다
- 버전: 배포 ref 가 `v…` 태그면 그것 → 아니면 배포 커밋에 붙은 `v…` 태그 → 아니면 배포 커밋 메시지가 `deploy v… [소스 sha]` 꼴일 때 그 태그 → 없으면 없음
  - 태그는 최근 20개 중에서 찾음
  - 메시지 방식은 `gh-pages` 같은 배포용 브랜치용: 태그는 소스 커밋에 붙고 배포 커밋(Pages 가 보는 커밋)에는 없어서. 실제 있는 태그만 쓰고, 메시지에 sha 가 있으면 그 태그가 가리키는 커밋과 같을 때만 씀 (태그가 옮겨졌으면 버전 없음)

### 캡처 과정

- 설치된 Chrome (`channel: 'chrome'`), 뷰포트 1280×800, 작업물마다 새 탭
- `load` 까지 대기 (최대 30초) → `actions` 실행 → `wait` ms 대기 → JPEG (품질 82) 저장
- CI (`CI` 환경변수가 있을 때)는 GPU 가 없어서 `--use-angle=swiftshader --enable-unsafe-swiftshader` 로 WebGL 을 소프트웨어 렌더링
- 실패한 작업물은 meta 를 고치지 않음 → 다음 실행 때 다시 시도. 나머지는 그대로 저장하고, 마지막에 종료 코드 1 로 끝남. Actions 에서는 오류(annotation)로도 남김
- GitHub API 토큰: `GITHUB_TOKEN` 또는 `GH_TOKEN`. 없으면 비인증 (시간당 60회, 로컬에서는 충분)

## 배포

### 1. 허브 자체: 버전을 올리면 배포 (deploy.yml)

```bash
npm version patch   # minor / major 도 됨
```

1. `preversion`: `git pull --rebase` 로 봇 커밋을 받음
2. npm 이 `package.json`·`package-lock.json` 버전을 올리고 커밋(`0.2.1`) + 태그(`v0.2.1`)
3. `postversion`: `git push --follow-tags`
4. 태그 push → `deploy.yml`: `npm ci` → `npm run build` → `dist/` 업로드 → `deploy-pages`

커밋하지 않은 변경이 있으면 `npm version` 이 멈추니 먼저 커밋한다.

### 2. 작업물 자동 갱신 (sync.yml)

- 트리거: 매시 17분 (`cron: '17 * * * *'`, 정각은 GitHub 예약 실행이 몰려서 피함), 수동 실행 (Actions → Sync → Run workflow, 입력 `only` = URL 일부)
- `check` 잡: 의존성 설치 없이 `node scripts/capture.mjs --check`. 바뀐 게 없으면 여기서 끝 (몇 초)
- `update` 잡 (바뀐 게 있을 때만):
  1. 한글·이모지 폰트 설치 (`fonts-noto-cjk`, `fonts-noto-color-emoji`)
  2. `npm ci` → `node scripts/capture.mjs` (`continue-on-error`: 실패한 작업물이 있어도 다음 단계로 감)
  3. 바뀐 파일이 있으면 `github-actions[bot]` 이름으로 `Update thumbnails` 커밋 → main 에 push
  4. `npm run build` → Pages 배포 (main 에서 배포)
  5. 2번에서 실패한 작업물이 있었으면 마지막 단계에서 job 을 실패 처리. 찍힌 작업물은 이미 커밋·배포된 뒤이고, Actions 탭에서 빨간 실행으로 눈에 띔
- 작업물 쪽 저장소는 아무것도 바꿀 필요 없음. 반영까지 최대 약 1시간 10분

### 3. GitHub 설정 (한 번만, 이미 해 둠)

| 설정 | 값 | 이유 |
|---|---|---|
| Pages 소스 | GitHub Actions (`build_type: workflow`) | 두 워크플로가 `deploy-pages` 로 올림 |
| `github-pages` 환경 배포 규칙 | `main` (브랜치), `v*` (태그) | 기본값은 main 만 허용이라 태그 배포가 막힘 |
| 워크플로 권한 | `contents: write` (sync), `pages: write`, `id-token: write` | 봇 커밋, Pages 배포 |
| 동시 실행 | 두 워크플로 모두 `concurrency: pages` | 배포가 겹치지 않고 차례로 |

### 주의

- 봇이 main 에 커밋하니까 이 저장소에서 작업하기 전에 `git pull` (`npm version` 은 알아서 함)
- 공개 저장소의 예약 실행은 저장소 활동이 60일 없으면 GitHub 가 꺼 버림 → Actions 탭에서 Sync 를 다시 켠다
- CI 에서 찍은 썸네일은 리눅스 폰트(Noto)라 맥에서 찍은 것과 글꼴이 조금 다르다

## 작업물별 배포 방식과 버전 표시

카드의 버전 칸은 작업물이 어떻게 배포되는지에 따라 달라진다 (2026-10-02 기준, 목록 원본은 projects.json).

| 작업물 | 저장소 | 배포 방식 | 카드 표시 |
|---|---|---|---|
| 주사위 굴리기 | tomlim2/dice-roll | `v*` 태그 → Actions | `v0.2.0` |
| 뽕짝 가위바위보 | tomlim2/rock-paper-scissors | `npm run deploy` 가 gh-pages 브랜치에 push (커밋 메시지 `deploy v0.3.0 <sha>` 에서 버전을 읽음) | `v0.3.0` |
| MENAGERIE | tomlim2/goofy-procedural-creatures | `v*` 태그 또는 수동 실행 → Actions | `v1.1.0` |
| RISO GRAPHIC | tomlim2/riso-graphic | main 브랜치 루트 (push 할 때마다) | 날짜 |
| MMD Player | tomlim2/mmd-anju | `v*` 태그 → Actions | `v1.0.3` |
| Matcap Painter | tomlim2/matcap-painter | main 브랜치 (push 할 때마다) | 날짜 |

날짜 대신 버전이 보이게 하려면 그 작업물을 `v*` 태그로 배포하거나, 배포된 커밋에 `v*` 태그를 붙이면 된다.

## 자주 하는 일

| 하고 싶은 것 | 방법 |
|---|---|
| 작업물 추가 (간단) | `projects.json` 에 URL 추가 → 커밋·push → 다음 Sync (1시간 안)가 찍어서 배포. 바로 하려면 Sync 수동 실행 |
| 작업물 추가 (로컬에서 확인) | URL 추가 → `npm run thumbs` → `npm run dev` 로 확인 → 커밋 → `npm version patch` |
| 작업물 빼기, 순서·옵션 변경 | `projects.json` 수정 (빼면 `public/thumbs/` 의 jpg 도 삭제) → 커밋 → `npm version patch`. Sync 는 새 작업물·새 배포만 감지해서 이건 배포하지 않음 |
| 썸네일만 바로 다시 | Actions → Sync → Run workflow, `only` 에 URL 일부 |
| 로딩 화면이 찍힘 | 그 항목의 `wait` 를 늘림 |
| 조작해야 그림이 나옴 | `actions` 추가 (예: 이름 입력 후 Enter) |
| 화면이 까맣게 찍힘 | 로컬에서 `npm run thumbs -- 이름 --headed` |
| 제목이 이상함 | `title` 지정 |
| 허브 디자인·코드 수정 반영 | 커밋 → `npm version patch` |

로컬에서 썸네일까지 찍어 커밋했다면 Sync 는 바뀐 게 없다고 보고 배포하지 않으니, 그때는 `npm version patch` 로 배포한다.

## 로컬 개발

```bash
npm install
npm run dev       # Vite 개발 서버 (기본 5173. www/.claude/launch.json 의 "hub" 는 5197)
npm run build     # dist/ 빌드
npm run preview   # 빌드 결과 미리보기
npm run thumbs    # 썸네일·버전 갱신 (Google Chrome 필요)
```

## 설계 메모

- 입력은 URL 하나로 최소화. 제목은 페이지 `<title>`, 썸네일은 실제 사이트 캡처, 버전은 배포 기록에서 가져온다
- 외부 스크린샷 서비스 대신 실제 Chrome 으로 찍는다: WebGL/WebGPU 화면, 로딩이나 조작이 필요한 화면을 제어할 수 있어서
- 작업물 저장소마다 "허브에 알리기" 단계와 토큰을 넣는 대신 허브가 매시간 확인한다: 작업물 쪽 설정이 필요 없고, 대신 최대 1시간 지연
- 생성물(meta.json, thumbs)을 저장소에 커밋한다: 태그 배포(deploy.yml)도 최신 썸네일로 빌드되고, 로컬 개발에서도 그대로 보인다
