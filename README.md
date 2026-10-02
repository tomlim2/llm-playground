# LLM Works

LLM이랑 같이 만들어서 배포한 작업물 링크 모음. 카드 하나 = 썸네일 + 페이지 제목 + URL + 배포 버전.
https://tomlim2.github.io/llm-playground/

## 작업물 추가

[`projects.json`](projects.json) 에 URL 한 줄 추가하고 push 하면 끝 (위에 있을수록 앞에 나옴).
1시간 안에 Sync 가 썸네일을 찍어서 허브를 다시 배포함. 바로 보려면 GitHub 의 Actions → Sync → Run workflow.
로컬에서 먼저 보려면 `npm run thumbs` → `npm run dev`.

항목에 붙일 수 있는 옵션 (전부 선택):

| 키 | 설명 |
| --- | --- |
| `title` | 카드 제목 직접 지정. 없으면 페이지 `<title>` |
| `thumb` | 직접 만든 이미지 경로(`public/` 기준)나 URL. 있으면 캡처 안 함 |
| `repo` | `owner/name`. 주소가 `owner.github.io/name/` 꼴이 아니면 배포 확인용으로 지정 |
| `wait` | 로드 후 찍기 전까지 기다릴 ms (기본 3000). 로딩 화면이 찍히면 늘리기 |
| `actions` | 찍기 전 조작. Playwright 의 fill / click / press / hover. 예: `[["fill", "#name", "menagerie"], ["press", "#name", "Enter"]]` |

## 자동 갱신 (Sync)

[`.github/workflows/sync.yml`](.github/workflows/sync.yml) 이 매시 17분에 각 작업물의 최신 GitHub Pages 배포를 확인함.

- 새로 추가됐거나 다시 배포된 작업물만 썸네일을 다시 찍고 카드의 버전을 갱신 (태그로 배포됐으면 `v1.2.3`, 아니면 배포 날짜)
- 바뀐 게 있으면 `Update thumbnails` 커밋을 main 에 push 하고 허브를 다시 배포
- 배포가 끝난 지 10분이 안 됐으면 Pages CDN 에 옛 화면이 남아 있을 수 있어서 다음 확인 때 찍음
- Actions → Sync → Run workflow 에 URL 일부를 넣으면 그것만 바로 다시 찍음

봇이 main 에 커밋하니까 이 저장소에서 작업하기 전에 `git pull`.

## 썸네일 직접 찍기

- `npm run thumbs`: 새로 추가됐거나 다시 배포된 것만
- `npm run thumbs -- --all`: 전부
- `npm run thumbs -- dice`: URL 에 `dice` 가 들어간 것만
- `--headed`: 화면이 까맣게 찍히면 창을 띄워서 찍기

## 허브 배포

```bash
npm version patch   # minor / major 도 됨
```

`preversion` 이 먼저 `git pull --rebase` 로 봇 커밋을 받고 → 버전을 올려 커밋 + `v*` 태그 →
`postversion` 이 push → 태그가 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 을 돌려서 Pages 에 올림.
커밋 안 한 변경이 있으면 `npm version` 이 멈추니 먼저 커밋.
