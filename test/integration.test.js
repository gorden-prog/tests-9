import {
    expect
} from 'chai';
import {
    mount,
    ready,
    data,
    response,
    endpoint,
    rick,
    morty
} from './helpers.js';

describe('Интеграция веб-клиента с REST API (stub)', function() {
    this.timeout(10000);
    let app;
    const start = (handler, query = '') => (app = mount(handler, query));
    afterEach(() => app?.close());

    function checkRequest(index, params) {
        const call = app.calls[index];
        expect(call.url.origin + call.url.pathname).to.equal(endpoint);
        expect(call.options?.method ?? 'GET').to.equal('GET');
        expect(Object.fromEntries(call.url.searchParams)).to.deep.equal(params);
        expect(call.status).to.equal(200);
    }

    function checkCards(characters, count = characters.length) {
        expect([...app.w.document.querySelectorAll('#grid .card h3')].map(el => el.textContent))
            .to.deep.equal(characters.map(c => c.name));
        expect(app.$('#count').textContent).to.equal(`Найдено персонажей: ${count}`);
    }

    it('WEB-01 Загрузка каталога', async () => {
        start(() => response(data([rick, morty])));
        await ready(app);
        checkRequest(0, {
            page: '1'
        });
        checkCards([rick, morty]);
    });

    it('WEB-02 Комбинация фильтров', async () => {
        const clones = ['Clone A', 'Clone B', 'Clone C'].map((name, i) => ({
            ...rick,
            id: 101 + i,
            name,
            gender: 'Female',
            species: 'Human',
            type: 'Clone'
        }));
        start(() => response(data(clones)), '?gender=female&species=Human&type=Clone&page=1');
        await ready(app);
        checkRequest(0, {
            gender: 'female',
            species: 'Human',
            type: 'Clone',
            page: '1'
        });
        for (const [name, value] of Object.entries({
                gender: 'female',
                species: 'Human',
                type: 'Clone'
            })) {
            expect(app.$(`[name="${name}"]`).value).to.equal(value);
        }
        checkCards(clones);
    });

    it('WEB-03 Пагинация', async () => {
        start(url => response(url.searchParams.get('page') === '2' ?
            data([morty], {
                count: 2,
                pages: 2,
                prev: `${endpoint}?page=1`
            }) :
            data([rick], {
                count: 2,
                pages: 2,
                next: `${endpoint}?page=2`
            })));
        await ready(app);
        checkRequest(0, {
            page: '1'
        });
        checkCards([rick], 2);
        app.$('#next').click();
        await ready(app, 2);
        checkRequest(1, {
            page: '2'
        });
        expect(app.$('#page').textContent).to.equal('Страница 2 из 2');
        checkCards([morty], 2);
    });

    it('WEB-04 Сброс фильтров', async () => {
        const dead = {
            ...morty,
            status: 'Dead'
        };
        start(url => response(data(url.searchParams.has('status') ? [rick] : [rick, dead])), '?status=alive&page=1');
        await ready(app);
        checkRequest(0, {
            status: 'alive',
            page: '1'
        });
        expect(app.$('[name="status"]').value).to.equal('alive');
        checkCards([rick]);
        app.$('button[type="reset"]').click();
        await ready(app, 2);
        checkRequest(1, {
            page: '1'
        });
        for (const name of ['name', 'status', 'gender', 'species', 'type']) {
            expect(app.$(`[name="${name}"]`).value).to.equal('');
        }
        checkCards([rick, dead]);
    });

    it('WEB-05 Подробная карточка', async () => {
        start(() => response(data([rick, morty])));
        await ready(app);
        app.$('.details').click();
        expect(app.$('#detail').hasAttribute('open')).to.equal(true);
        expect(app.$('#detail-title').textContent).to.equal('Rick Sanchez');
        const values = [...app.w.document.querySelectorAll('#detail-content dd')].map(el => el.textContent);
        expect(values).to.include.members(['Жив', 'Человек', 'Мужской', 'Earth (C-137)', 'Citadel of Ricks', '51']);
    });
});