import projects from '../projects.json';
import meta from './meta.json'; // npm run thumbs 가 만드는 파일 (페이지 제목, 썸네일 경로)
import './style.css';

const template = document.querySelector('#card-template');

document.querySelector('#grid').append(...projects.map(renderCard));
document.querySelector('#count').textContent = String(projects.length).padStart(2, '0');

function renderCard(project, index) {
  const info = meta[project.url] ?? {};
  const item = template.content.firstElementChild.cloneNode(true);
  item.style.setProperty('--i', index);

  item.querySelector('.card').href = project.url;
  item.querySelector('.title').textContent = project.title || info.title || shortUrl(project.url);
  item.querySelector('.url').textContent = shortUrl(project.url);

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

function shortUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
