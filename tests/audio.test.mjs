import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './game.mjs';

// A stand-in for WebAudio that checks every value the game sends to it.
const bad = [], ramps = { bus: [], send: [] };
const chk = (name, ...v) => v.forEach(x => { if (typeof x !== 'number' || !Number.isFinite(x)) bad.push(`${name}: ${x}`); });
const param = (name, init = 0) => ({
  value: init,
  setValueAtTime(v, t) { chk(name, v, t); this.value = v; },
  linearRampToValueAtTime(v, t) { chk(name, v, t); (this.tap || (() => {}))(v); },
  exponentialRampToValueAtTime(v, t) { chk(name, v, t); if (v <= 0) bad.push(name + ': exponential ramp to ' + v); },
  cancelScheduledValues(t) { chk(name, t); },
  setTargetAtTime(v, t, k) { chk(name, v, t, k); }
});
const node = (extra = {}) => ({
  connect(n) { return n; }, disconnect() {}, start(t) { chk('start', t); }, stop(t) { chk('stop', t); },
  gain: param('gain', 1), frequency: param('frequency', 440), detune: param('detune'), Q: param('Q'),
  threshold: param('threshold'), knee: param('knee'), ratio: param('ratio'), attack: param('attack'), release: param('release'), ...extra
});
class FakeAudioContext {
  constructor() { this.currentTime = 10; this.sampleRate = 8000; this.state = 'running'; this.destination = node(); }
  createGain() { return node(); } createOscillator() { return node({ type: '' }); } createBiquadFilter() { return node({ type: '' }); }
  createBufferSource() { return node({ buffer: null, loop: false }); } createConvolver() { return node({ buffer: null }); }
  createDynamicsCompressor() { return node(); } createWaveShaper() { return node({ curve: null }); }
  createBuffer(ch, len) { return { getChannelData() { return new Float32Array(len); } }; } resume() {}
}

test('every sound effect and every music intensity sends only valid values to WebAudio', () => {
  const { sfx, music, settings } = loadGame({ AudioContext: FakeAudioContext });
  sfx.muted = false; sfx.musicMuted = false;
  sfx.init();
  for (const k of ['click', 'press', 'release', 'turn', 'snip', 'detent', 'lever', 'solve', 'strike', 'win', 'boom']) sfx[k]();
  [0, 1, 2].forEach(l => sfx.tick(l));
  sfx.step(3); sfx.bell(500); sfx.beep(660, .2);
  music.start();
  for (const track of [1, 2, 3]) {
    settings.musicTrack = track;
    for (const target of [.04, .2, .3, .4, .5, .65, .75, .85, 1]) {
      music.target = music.I = target;
      for (let i = 0; i < 200; i++) { sfx.ctx.currentTime += .02; music.pump(); }
    }
  }
  music.update(11000, 300000, 2); music.update(5000, 300000, 2); music.hit();
  music.stop(1.6);
  assert.deepEqual(bad, []);
});

test('muting the music silences its reverb tail as well as the main music bus', () => {
  const { sfx, music } = loadGame({ AudioContext: FakeAudioContext });
  sfx.muted = false; sfx.musicMuted = false; sfx.init(); music.start();
  music.bus.gain.tap = v => ramps.bus.push(v); music.send.gain.tap = v => ramps.send.push(v);
  sfx.setMusicMuted(true);
  assert.deepEqual(ramps.bus, [0.0001]);
  assert.deepEqual(ramps.send, [0]);
  music.stop(.1);
  sfx.setMusicMuted(true); music.start();                    // starting while muted must stay silent too
  assert.equal(music.send.gain.value, 0);
  music.stop(.1);                                            // stops the scheduler's timer so the test run can finish
});

test('three music tracks, each speeding up as the intensity rises', () => {
  const { music, settings, MUSIC_TRACKS } = loadGame({ AudioContext: FakeAudioContext });
  assert.equal(MUSIC_TRACKS.length, 3);
  assert.equal(new Set(MUSIC_TRACKS.map(t => t.name)).size, 3, 'distinct names');
  assert.equal(settings.musicTrack, 1);
  for (const track of [1, 2, 3]) {
    settings.musicTrack = track;
    const calm = music.bpm(0), mid = music.bpm(.5), end = music.bpm(1);
    assert.ok(calm < mid && mid < end, `track ${track}: ${calm} < ${mid} < ${end}`);
    assert.ok(end >= 150 && calm <= 100, `track ${track} ranges ${calm} to ${end} bpm`);
  }
});
