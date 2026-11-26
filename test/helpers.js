import {
    readFileSync
} from 'node:fs';
import {
    JSDOM
} from 'jsdom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../script.js', import.meta.url), 'utf8');
export const endpoint = 'https://rickandmortyapi.com/api/character';

export const rick = {
    id: 1,
    name: 'Rick Sanchez',
    status: 'Alive',
    species: 'Human',
    type: '',
    gender: 'Male',
    origin: {
        name: 'Earth (C-137)'
    },
    location: {
        name: 'Citadel of Ricks'
    },
    image: `${endpoint}/avatar/1.jpeg`,
    episode: Array.from({
        length: 51
    }, (_, i) => `https://rickandmortyapi.com/api/episode/${i + 1}`),
    created: '2017-11-04T18:48:46.250Z',
};
export const morty = {
    ...rick,
    id: 2,
    name: 'Morty Smith',
    image: `${endpoint}/avatar/2.jpeg`
};

export function data(characters = [rick], info = {}) {
    return {
        info: {
            count: characters.length,
            pages: 1,
            next: null,
            prev: null,
            ...info
        },
        results: characters
    };
}

export function response(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

export function mount(handler, query = '') {
    const dom = new JSDOM(html, {
        url: `https://gorden-prog.github.io/tests-9/${query}`,
        runScripts: 'outside-only'
    });
    const w = dom.window;
    const calls = [];

    w.matchMedia = () => ({
        matches: false
    });
    w.HTMLElement.prototype.scrollIntoView = () => {};
    w.HTMLDialogElement.prototype.showModal = function() {
        this.setAttribute('open', '');
    };
    w.HTMLDialogElement.prototype.close = function() {
        this.removeAttribute('open');
    };
    w.AbortController = globalThis.AbortController;
    w.fetch = async (url, options) => {
        const call = {
            url: new URL(url),
            options
        };
        calls.push(call);
        const result = await handler(call.url, options);
        call.status = result.status;

        call.payload = result.clone().json().catch(() => null);
        return result;
    };
    const $ = selector => w.document.querySelector(selector);
    w.eval(script);
    return {
        w,
        $,
        calls,
        close: () => w.close()
    };
}

export async function waitFor(check, timeout = 5000) {
    const start = Date.now();
    while (!check()) {
        if (Date.now() - start > timeout) throw new Error('Не дождались ожидаемого состояния интерфейса');
        await new Promise(resolve => setTimeout(resolve, 15));
    }
}

export async function ready(app, number = 1, timeout = 5000) {
    await waitFor(() => app.calls.length >= number && app.$('#results').getAttribute('aria-busy') === 'false', timeout);
}

export function setField(app, name, value) {
    const field = app.$(`[name="${name}"]`);
    field.value = value;
    field.dispatchEvent(new app.w.Event(field.tagName === 'SELECT' ? 'change' : 'input', {
        bubbles: true
    }));
}