import {
    expect
} from 'chai';

const base = 'https://rickandmortyapi.com/api';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

describe('REST API Rick and Morty (реальные запросы)', function() {
    this.timeout(30000);
    beforeEach(async () => {
        await delay(1100);
    });

    async function get(path, status = 200) {
        const res = await fetch(base + path, {
            method: 'GET',
            signal: AbortSignal.timeout(15000)
        });
        expect(res.status, `GET ${path}: HTTP ${res.status}${res.status === 429 ? ' — лимит внешнего API' : ''}`).to.equal(status);
        expect(res.headers.get('content-type')).to.include('application/json');
        return res.json();
    }

    function results(body) {
        expect(body.info).to.be.an('object');
        expect(body.results).to.be.an('array').that.is.not.empty;
        return body.results;
    }

    it('API-01 Получение списка', async () => {
        const body = await get('/character');
        results(body);
        expect(body.info.count).to.be.a('number').and.greaterThan(0);
    });
    it('API-02 Поиск по имени', async () => {
        for (const c of results(await get('/character?name=rick'))) {
            expect(c.name.toLowerCase()).to.include('rick');
        }
    });
    it('API-03 Фильтр статуса', async () => {
        for (const c of results(await get('/character?status=alive'))) expect(c.status).to.equal('Alive');
    });
    it('API-04 Фильтр по виду', async () => {
        for (const c of results(await get('/character?species=human'))) expect(c.species.toLowerCase()).to.include('human');
    });
    it('API-05 Фильтр по полу', async () => {
        for (const c of results(await get('/character?gender=male'))) expect(c.gender).to.equal('Male');
    });
    it('API-06 Комбинация фильтров', async () => {
        for (const c of results(await get('/character?name=rick&status=alive'))) {
            expect(c.name.toLowerCase()).to.include('rick');
            expect(c.status).to.equal('Alive');
        }
    });
    it('API-07 Вторая страница', async () => {
        const body = await get('/character?page=2');
        results(body);
        expect(body.info.prev).to.be.a('string');
        expect(new URL(body.info.prev).searchParams.get('page')).to.equal('1');
    });
    it('API-08 Персонаж по ID', async () => {
        const body = await get('/character/1');
        expect(body.id).to.equal(1);
        expect(body.name).to.equal('Rick Sanchez');
    });
    const negative = [
        ['API-09 Нет совпадений по имени', '/character?name=zzzzzzz'],
        ['API-10 Несуществующий ID', '/character/999999'],
        ['API-11 Несуществующая страница', '/character?page=999999'],
        ['API-12 Некорректный статус', '/character?status=invalid_status'],
    ];
    for (const [name, path] of negative) {
        it(name, async () => {
            const body = await get(path, 404);
            expect(body.error).to.be.a('string').and.not.empty;
        });
    }
});