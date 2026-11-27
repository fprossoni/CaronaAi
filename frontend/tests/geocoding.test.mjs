import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

// Resolve the application's alias while using Node's built-in TypeScript loader.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { hasCompleteLocation, resolveNumberedLocation } = await import('../src/lib/geocoding.ts');
const point = {
  label: 'Rua Exemplo, 123 — Centro',
  region: 'Centro, Porto Alegre',
  lat: -30.04,
  lng: -51.2,
  coordinatesVerified: false,
  mapAddress: { street: 'Rua Exemplo', number: '123', neighborhood: 'Centro' },
};

test('allows a selected street or meeting point without a house number', () => {
  assert.equal(hasCompleteLocation({ ...point, coordinatesVerified: true, mapAddress: { ...point.mapAddress, number: '' } }), true);
  assert.equal(hasCompleteLocation({ ...point, coordinatesVerified: true, label: 'Esquina próxima', mapAddress: undefined }), true);
  assert.equal(hasCompleteLocation(null), false);
  assert.equal(hasCompleteLocation(point), false);
  assert.equal(hasCompleteLocation({ ...point, coordinatesVerified: true, lat: NaN }), false);
  assert.equal(hasCompleteLocation({ ...point, coordinatesVerified: true, lng: 181 }), false);
});

test('tries the number and uses its exact coordinates when found', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.match(new URL(url).searchParams.get('q'), /Rua Exemplo, 123/);
    return Response.json([{
      place_id: 1, lat: '-30.041', lon: '-51.201', display_name: 'Rua Exemplo, 123',
      address: { road: 'Rua Exemplo', house_number: '123', suburb: 'Centro', city: 'Porto Alegre' },
    }]);
  });
  const result = await resolveNumberedLocation(point);
  assert.equal(result.lat, -30.041);
  assert.equal(result.numberNotFound, false);
  assert.equal(hasCompleteLocation(result), true);
});

test('keeps the selected pin and typed number when only a neighbour is found', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json([{
    place_id: 2, lat: '-30.05', lon: '-51.21', display_name: 'Rua Exemplo, 125',
    address: { road: 'Rua Exemplo', house_number: '125', suburb: 'Centro', city: 'Porto Alegre' },
  }]));
  const result = await resolveNumberedLocation(point);
  assert.equal(result.lat, point.lat);
  assert.equal(result.lng, point.lng);
  assert.equal(result.mapAddress.number, '123');
  assert.equal(result.numberNotFound, true);
  assert.equal(hasCompleteLocation(result), true);
});

test('allows the selected point when the provider has no results or is offline', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  assert.equal(hasCompleteLocation(await resolveNumberedLocation(point)), true);
  fetch.mock.mockImplementation(async () => { throw new Error('offline'); });
  const result = await resolveNumberedLocation(point);
  assert.equal(result.numberNotFound, true);
  assert.equal(result.lat, point.lat);
  assert.equal(hasCompleteLocation(result), true);
});

test('clearing the number does not require a network lookup', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected lookup'); });
  const result = await resolveNumberedLocation({ ...point, mapAddress: { ...point.mapAddress, number: '' } });
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(result.numberNotFound, false);
  assert.equal(hasCompleteLocation(result), true);
});
