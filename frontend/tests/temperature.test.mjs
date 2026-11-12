import test from 'node:test';
import assert from 'node:assert/strict';
import { displayTemperature, readTemperatureUnit, isTemperatureUnit, TEMPERATURE_KEY } from '../src/temperature.js';

test('temperature and Fahrenheit heat index convert into the selected unit', () => {
  for (const [c, f] of [[0,32], [100,212], [-40,-40], [25,77]]) {
    assert.equal(displayTemperature(c, 'C', 'F'), f);
    assert.ok(Math.abs(displayTemperature(f, 'F', 'C') - c) < 1e-10);
    assert.equal(displayTemperature(c, 'C', 'C'), c);
    assert.equal(displayTemperature(f, 'F', 'F'), f);
  }
});

test('history converts for display without mutating sensor values', () => {
  const history = [0, 25, 100];
  assert.deepEqual(history.map(v => displayTemperature(v,'C','F')), [32,77,212]);
  assert.deepEqual(history, [0,25,100]);
  for (const value of [null, undefined, NaN, Infinity]) {
    assert.ok(Object.is(displayTemperature(value,'C','F'),value));
  }
});

test('only supported saved units are accepted, with a safe storage fallback', () => {
  try {
    for (const value of ['C','F',null,'invalid']) {
      globalThis.localStorage = {getItem(key) { assert.equal(key,TEMPERATURE_KEY); return value; }};
      assert.equal(readTemperatureUnit(), isTemperatureUnit(value) ? value : 'C');
    }
    globalThis.localStorage = {getItem() { throw new Error('Storage blocked'); }};
    assert.equal(readTemperatureUnit(),'C');
    delete globalThis.localStorage;
    assert.equal(readTemperatureUnit(),'C');
  } finally { delete globalThis.localStorage; }
});
