# LLM Works

LLM이랑 같이 만들어서 배포한 작업물 링크 모음. 카드 하나 = 썸네일 + 페이지 제목 + URL.

## 작업물 추가

1. [`projects.json`](projects.json) 에 URL 추가 (위에 있을수록 앞에 나옴)
2. `npm run thumbs`: 설치된 Chrome 으로 페이지를 열어 썸네일(`public/thumbs/`)과 페이지 제목(`src/meta.json`)을 저장
3. `npm run dev` 로 확인

항목에 붙일 수 있는 옵션 (전부 선택):

| 키 | 설명 |
| --- | --- |
| `title` | 카드 제목 직접 지정. 없으면 페이지 `<title>` |
| `thumb` | 직접 만든 이미지 경로(`public/` 기준)나 URL. 있으면 캡처 안 함 |
| `wait` | 로드 후 찍기 전까지 기다릴 ms (기본 3000). 로딩 화면이 찍히면 늘리기 |
| `actions` | 찍기 전 조작. Playwright 의 fill / click / press / hover. 예: `[["fill", "#name", "menagerie"], ["press", "#name", "Enter"]]` |

## 썸네일 다시 찍기

- `npm run thumbs -- --all`: 전부
- `npm run thumbs -- dice`: URL 에 `dice` 가 들어간 것만
- `--headed`: 화면이 까맣게 찍히면 창을 띄워서 찍기

## 배포

버전을 올리면 배포됨. 주소는 https://tomlim2.github.io/llm-playground/

```bash
npm version patch   # 작업물 추가·썸네일 교체 (minor / major 도 됨)
```

`package.json` 버전을 올려 커밋하고 `v*` 태그를 붙임 → `postversion` 이 커밋과 태그를 push →
태그가 `.github/workflows/deploy.yml` 을 돌려서 GitHub Pages 에 올림. 커밋 안 한 변경이 있으면 `npm version` 이 멈추니 먼저 커밋.
