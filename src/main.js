import projects from '../projects.json';
import meta from './meta.json'; // npm run thumbs 가 만드는 파일 (페이지 제목, 썸네일 경로)
import './style.css';

// 시스템 언어. index.html <head> 의 스크립트가 <html lang> 을 'ko' 나 'en' 으로 정해 둠
const lang = document.documentElement.lang === 'ko' ? 'ko' : 'en';
const deployedOn = { ko: (date) => `${date} 배포`, en: (date) => `Deployed ${date}` }[lang];

const template = document.querySelector('#card-template');

document.querySelector('#grid').append(...projects.map(renderCard));
document.querySelector('#count').textContent = String(projects.length).padStart(2, '0');

function renderCard(project, index) {
  const info = meta[project.url] ?? {};
  const item = template.content.firstElementChild.cloneNode(true);
  item.style.setProperty('--i', index);

  item.querySelector('.card').href = project.url;
  item.querySelector('.title').textContent = titleOf(project) || info.title || shortUrl(project.url);
  item.querySelector('.url').textContent = shortUrl(project.url);

  // 태그로 배포됐으면 버전, 브랜치로 배포됐으면 배포 날짜
  const version = item.querySelector('.version');
  version.textContent = info.version ?? info.deployedAt?.replaceAll('-', '.') ?? '';
  if (info.deployedAt) version.title = deployedOn(info.deployedAt);

  // 다시 찍으면 파일 이름은 그대로라 찍은 날짜를 붙여 캐시를 피함
  const thumb = project.thumb ?? (info.thumb && `${info.thumb}?v=${info.capturedAt}`);
  const img = item.querySelector('img');
  if (thumb) {
    img.src = /^https?:/.test(thumb) ? thumb : import.meta.env.BASE_URL + thumb;
  } else {
    // 아직 안 찍은 건 도메인 첫 글자로 자리만 잡아 둠
    img.remove();
    item.querySelector('.thumb').dataset.placeholder = new URL(project.url).hostname[0].toUpperCase();
  }
  return item;
}

// title 은 문자열(모든 언어 공통)이거나 { ko, en } 꼴. 지금 언어 제목이 없으면 비워 둬서 페이지 <title> 을 쓰게 함
function titleOf({ title }) {
  return typeof title === 'string' ? title : title?.[lang];
}

function shortUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
