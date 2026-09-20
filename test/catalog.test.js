const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CATALOG = require('../public/js/catalog.js');
const { GAME_REGISTRY } = require('../game-manager');

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}

describe('Game catalog', () => {
    it('has unique ids and known categories', () => {
        const ids = CATALOG.GAMES.map(g => g.id);
        assert.equal(new Set(ids).size, ids.length);
        const cats = new Set(CATALOG.CATEGORIES.map(c => c.id));
        for (const g of CATALOG.GAMES) {
            assert.ok(cats.has(g.category), `${g.id} has unknown category ${g.category}`);
            assert.ok(g.label && g.tagline && g.clientInit, `${g.id} is missing label/tagline/clientInit`);
        }
        for (const c of CATALOG.CATEGORIES) {
            assert.ok(CATALOG.GAMES.some(g => g.category === c.id), `category ${c.id} is empty`);
        }
    });

    it('is mirrored by the server registry', () => {
        assert.deepEqual(Object.keys(GAME_REGISTRY).sort(), CATALOG.GAMES.map(g => g.id).sort());
    });

    for (const game of CATALOG.GAMES) {
        it(`${game.id}: server module and client script exist and match`, () => {
            const serverPath = path.join(__dirname, '..', 'games', `${game.id}.js`);
            const clientPath = path.join(__dirname, '..', 'public', 'js', 'games', `${game.id}-client.js`);
            assert.ok(fs.existsSync(serverPath), `missing ${serverPath}`);
            assert.ok(fs.existsSync(clientPath), `missing ${clientPath}`);

            const client = fs.readFileSync(clientPath, 'utf8');
            assert.ok(
                new RegExp(`function\\s+${game.clientInit}\\s*\\(`).test(client),
                `${clientPath} must define global function ${game.clientInit}`
            );
            assert.ok(!/\balert\(/.test(client.replace(/else alert\(msg\)/g, '')), `${game.id} client must not use alert()`);

            const Game = require(serverPath);
            const io = { to() { return { emit() {} }; } };
            const players = [fakeSocket('a'), fakeSocket('b')];
            const g = game.special === 'wordchain'
                ? new Game('r', players, 0, io)
                : game.special === 'mastermind'
                    ? new Game('r', players, 0, null)
                    : game.special === 'hangman'
                        ? new Game('r', players, 0, [])
                        : new Game('r', players, 0);
            const state = g.getStateForPlayer(0);
            assert.ok('isGameOver' in state && 'winner' in state && 'activePlayerIndex' in state, `${game.id} state shape`);
            // A garbage move must be rejected, never thrown.
            for (const bad of [{}, { x: 1.5 }, { row: 'a', col: null }]) {
                const idx = g.activePlayerIndex === null || g.activePlayerIndex === undefined ? 0 : g.activePlayerIndex;
                const result = g.makeMove(idx, bad);
                assert.equal(result.valid, false, `${game.id} accepted ${JSON.stringify(bad)}`);
            }
            if (typeof g.cleanup === 'function') g.cleanup();
        });
    }
});
