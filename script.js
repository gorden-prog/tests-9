'use strict';

const endpoint = 'https://rickandmortyapi.com/api/character';
const byId = id => document.getElementById(id);
const form = byId('filters');
const fields = form.querySelectorAll('input, select');
const grid = byId('grid');
const results = byId('results');
const resultsTitle = byId('results-title');
const count = byId('count');
const notice = byId('notice');
const noticeAction = byId('notice-action');
const pagination = byId('pagination');
const prev = byId('prev');
const next = byId('next');
const dialog = byId('detail');

const statuses = new Map([
  ['alive', 'Жив'],
  ['dead', 'Мёртв'],
  ['unknown', 'Неизвестно'],
]);

const genders = new Map([
  ['male', 'Мужской'],
  ['female', 'Женский'],
  ['genderless', 'Бесполый'],
  ['unknown', 'Неизвестно'],
]);

const speciesNames = new Map([
  ['Human', 'Человек'],
  ['Alien', 'Инопланетянин'],
  ['Humanoid', 'Гуманоид'],
  ['Robot', 'Робот'],
  ['Animal', 'Животное'],
  ['Mythological Creature', 'Мифическое существо'],
  ['Disease', 'Болезнь'],
  ['Cronenberg', 'Кроненберг'],
  ['Poopybutthole', 'Пупибаттхол'],
]);

const numberFormat = new Intl.NumberFormat('ru');
const dateFormat = new Intl.DateTimeFormat('ru', { dateStyle: 'long', timeZone: 'UTC' });

let timer;
let controller;
let page = 1;
let pageInfo;

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function known(value) {
  return !value || value.toLowerCase() === 'unknown' ? 'Неизвестно' : value;
}

function portrait(character, lazy = false) {
  const image = element('img', undefined, 'portrait');
  image.alt = character.name;
  image.width = 300;
  image.height = 300;
  if (lazy) image.loading = 'lazy';
  image.src = character.image;
  return image;
}

function characterFields(character) {
  const status = character.status.toLowerCase();
  return {
    status: statuses.get(status) ?? known(character.status),
    gender: genders.get(character.gender.toLowerCase()) ?? known(character.gender),
    species: speciesNames.get(character.species) ?? known(character.species),
    location: known(character.location.name),
  };
}

function card(character) {
  const article = element('article', undefined, 'card');
  const info = element('div', undefined, 'card-info');
  const fields = characterFields(character);
  const status = element('p', fields.status, 'status');
  status.dataset.status = character.status.toLowerCase();
  const button = element('button', 'Подробнее', 'details');
  button.type = 'button';
  button.setAttribute('aria-label', `Подробнее о персонаже ${character.name}`);
  button.setAttribute('aria-haspopup', 'dialog');
  button.addEventListener('click', () => openDetails(character));
  info.append(
    element('h3', character.name),
    status,
    element('p', `Вид: ${fields.species}`),
    element('p', `Пол: ${fields.gender}`),
    element('p', `Последняя локация: ${fields.location}`),
    button,
  );
  article.append(portrait(character, true), info);
  return article;
}

function openDetails(character) {
  const title = element('h2', character.name);
  title.id = 'detail-title';
  const info = element('div');
  const list = element('dl');
  const date = new Date(character.created);
  const fields = characterFields(character);
  const rows = [
    ['Статус', fields.status],
    ['Вид', fields.species],
    ['Тип', character.type || 'Не указан'],
    ['Пол', fields.gender],
    ['Происхождение', known(character.origin.name)],
    ['Последняя локация', fields.location],
    ['Эпизодов', numberFormat.format(character.episode.length)],
    ['Дата добавления', Number.isNaN(date.getTime()) ? 'Неизвестно' : dateFormat.format(date)],
  ];
  for (const [label, value] of rows) {
    list.append(element('dt', label), element('dd', value));
  }
  info.append(title, list);
  byId('detail-content').replaceChildren(portrait(character), info);
  dialog.showModal();
}

function readPage(value) {
  const number = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(number) && number >= 1 ? number : 1;
}

function restoreAddress() {
  const params = new URLSearchParams(location.search);
  for (const field of fields) {
    field.value = params.get(field.name) ?? '';
    if (field.tagName === 'SELECT' && field.selectedIndex === -1) field.value = '';
  }
  page = readPage(params.get('page'));
}

function buildParams() {
  const params = new URLSearchParams();
  for (const [name, value] of new FormData(form)) {
    const trimmed = value.trim();
    if (trimmed) params.set(name, trimmed);
  }
  params.set('page', page);
  return params;
}

function syncAddress(params, mode) {
  if (!mode) return;
  const address = new URL(location.href);
  address.search = params.toString();
  if (address.href !== location.href) history[mode](null, '', address);
}

function showLoading() {
  pageInfo = null;
  notice.hidden = true;
  pagination.hidden = true;
  count.textContent = 'Загрузка персонажей…';
  results.setAttribute('aria-busy', 'true');
  grid.replaceChildren(byId('skeleton-template').content.cloneNode(true));
}

function showNotice(title, message, actionLabel, action) {
  grid.replaceChildren();
  byId('notice-title').textContent = title;
  byId('notice-text').textContent = message;
  noticeAction.textContent = actionLabel;
  noticeAction.onclick = action;
  notice.hidden = false;
}

function showResults(data) {
  pageInfo = data.info;
  grid.replaceChildren(...data.results.map(card));
  count.textContent = `Найдено персонажей: ${numberFormat.format(pageInfo.count)}`;
  byId('page').textContent = `Страница ${page} из ${pageInfo.pages}`;
  prev.disabled = !pageInfo.prev;
  next.disabled = !pageInfo.next;
  pagination.hidden = false;
}

async function loadCharacters(historyMode) {
  clearTimeout(timer);
  controller?.abort();
  const request = new AbortController();
  controller = request;
  showLoading();

  try {
    const params = buildParams();
    syncAddress(params, historyMode);
    const url = new URL(endpoint);
    url.search = params.toString();
    const response = await fetch(url, { method: 'GET', signal: request.signal });
    if (request.signal.aborted) return;
    if (response.status === 404) {
      count.textContent = page === 1 ? 'Найдено персонажей: 0' : 'Страница недоступна';
      if (page === 1) {
        showNotice('Персонажи не найдены', 'Измените имя или другие фильтры.', 'Сбросить фильтры', () => form.reset());
      } else {
        showNotice('Страница не найдена', 'Вернитесь к первой странице с текущими фильтрами.', 'К первой странице', () => {
          page = 1;
          loadCharacters('pushState');
        });
      }
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!request.signal.aborted) showResults(data);
  } catch (error) {
    if (request.signal.aborted) return;
    const message = error.message.startsWith('HTTP ')
      ? `Сервер вернул ошибку ${error.message}.`
      : 'Проверьте подключение к интернету и повторите запрос.';
    count.textContent = 'Не удалось загрузить персонажей';
    showNotice('Ошибка загрузки', message, 'Повторить запрос', () => loadCharacters(historyMode));
  } finally {
    if (controller === request && !request.signal.aborted) results.setAttribute('aria-busy', 'false');
  }
}

function changeFilters(delay = 0) {
  clearTimeout(timer);
  controller?.abort();
  page = 1;
  if (!delay) {
    loadCharacters('pushState');
    return;
  }
  showLoading();
  timer = setTimeout(() => loadCharacters('pushState'), delay);
}

function changePage(link) {
  if (!link) return;
  page = readPage(new URL(link).searchParams.get('page'));
  loadCharacters('pushState');
  resultsTitle.focus({ preventScroll: true });
  resultsTitle.scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

form.addEventListener('input', event => {
  if (event.target.matches('input') && !event.isComposing) changeFilters(400);
});
form.addEventListener('compositionend', () => changeFilters(400));
form.addEventListener('change', event => {
  if (event.target.matches('select')) changeFilters();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  changeFilters();
});
form.addEventListener('reset', () => {
  setTimeout(() => changeFilters(), 0);
});
window.addEventListener('popstate', () => {
  restoreAddress();
  loadCharacters();
});
prev.addEventListener('click', () => changePage(pageInfo?.prev));
next.addEventListener('click', () => changePage(pageInfo?.next));
byId('close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const { left, right, top, bottom } = dialog.getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
    dialog.close();
  }
});

restoreAddress();
loadCharacters('replaceState');
