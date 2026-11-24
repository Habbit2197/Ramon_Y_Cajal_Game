/**
 * lab.test.ts — Lógica de los minijuegos del Laboratorio de Cajal.
 */
import { describe, it, expect } from 'vitest';
import { generateSample, applyStain, inkLeft, roundScore, MICRO_ROUNDS, FIELD_H, STAINED_PER_ROUND } from './micro';
import { BUILD_LEVELS, PARTS, newBuildState, placePart, levelComplete, levelScore, wrongMessage } from './build';
import { makeChart, newRhythm, tap, advance, accuracy, rhythmCards, RHYTHM_RULES } from './rhythm';
import { drawNeuron } from './neuronShapes';
import { MUSEUM_BY_ID } from '../museum';

describe('Microscopio', () => {
  it('cada muestra es igual con la misma semilla y tiene las neuronas separadas', () => {
    const a = generateSample(9, 0), b = generateSample(9, 0);
    expect(a.cells.map((c) => [c.x, c.y, c.type])).toEqual(b.cells.map((c) => [c.x, c.y, c.type]));
    expect(a.cells).toHaveLength(STAINED_PER_ROUND);
    for (let i = 0; i < a.cells.length; i++) for (let j = i + 1; j < a.cells.length; j++) {
      expect(Math.hypot(a.cells[i].x - a.cells[j].x, a.cells[i].y - a.cells[j].y)).toBeGreaterThan(0.2);
    }
    for (const r of [0, 1, 2]) for (const c of generateSample(3, r).cells) expect(MICRO_ROUNDS[r].types).toContain(c.type);
  });

  it('el reactivo descubre la neurona al cubrir su soma y solo gasta en zona nueva', () => {
    const s = generateSample(4, 1);
    const c = s.cells[0];
    expect(applyStain(s, c.x, c.y)).toEqual([c]);
    const used = s.coveredCount;
    applyStain(s, c.x, c.y);
    expect(s.coveredCount).toBe(used);
    expect(inkLeft(s)).toBeLessThan(1);
  });

  it('el reactivo se acaba', () => {
    const s = generateSample(4, 0, 0.05);
    for (let x = 0; x <= 1; x += 0.03) for (let y = 0; y <= FIELD_H; y += 0.03) applyStain(s, x, y);
    expect(inkLeft(s)).toBe(0);
    expect(s.cells.some((c) => !c.found)).toBe(true);
  });

  it('puntúa neuronas, tipos acertados y lo que sobra solo si se encuentran todas', () => {
    const s = generateSample(1, 0);
    s.cells.forEach((c, i) => { c.found = true; c.identified = i < 3; });
    expect(roundScore(s, 10)).toBe(4 * 150 + 3 * 100 + Math.round(inkLeft(s) * 200) + 50);
    s.cells[0].found = false;
    expect(roundScore(s, 10)).toBe(3 * 150 + 3 * 100);
  });

  it('dibuja los cinco tipos de célula', () => {
    for (const t of ['piramidal', 'purkinje', 'granulo', 'estrellada', 'astrocito'] as const) {
      const d = drawNeuron(t, 11);
      expect(d.strokes.length).toBeGreaterThan(3);
      expect(d.bounds.maxY - d.bounds.minY).toBeGreaterThan(0.1);
    }
  });
});

describe('Construye la neurona', () => {
  it('cada taller tiene piezas válidas, una intrusa y huecos dentro del dibujo', () => {
    for (const l of BUILD_LEVELS) {
      for (const s of l.slots) {
        expect(PARTS[s.part], s.part).toBeDefined();
        expect(s.x + s.w).toBeLessThanOrEqual(480);
        expect(s.y + s.h).toBeLessThanOrEqual(300);
        const card = PARTS[s.part].card;
        if (card) expect(MUSEUM_BY_ID[card]).toBeDefined();
      }
      expect(l.slots.map((s) => s.part)).not.toContain(l.intruder.id);
    }
  });

  it('colocar bien completa el taller; colocar mal cuenta un fallo y explica por qué', () => {
    const s = newBuildState(0);
    expect(placePart(s, 'axon', 'soma')).toBe(false);
    expect(placePart(s, 'globulo', 'soma')).toBe(false);
    expect(s.mistakes).toBe(2);
    expect(wrongMessage(0, 'globulo', 'soma')).toMatch(/no forma parte/);
    expect(wrongMessage(0, 'axon', 'soma')).toMatch(/Pista/);
    for (const sl of BUILD_LEVELS[0].slots) expect(placePart(s, sl.part, sl.part)).toBe(true);
    expect(levelComplete(s)).toBe(true);
    expect(placePart(s, 'soma', 'soma')).toBe(false); // ya estaba
  });

  it('la puntuación baja con los fallos y nunca de 150', () => {
    expect(levelScore(0, 10)).toBe(680);
    expect(levelScore(2, 0)).toBe(360);
    expect(levelScore(20, 0)).toBe(150);
  });
});

describe('Sinapsis rítmica', () => {
  const bpm = 100;
  it('la partitura es determinista, ordenada y con algunos frenos de GABA', () => {
    const a = makeChart(5, bpm), b = makeChart(5, bpm);
    expect(a).toEqual(b);
    for (let i = 1; i < a.length; i++) expect(a[i].t).toBeGreaterThanOrEqual(a[i - 1].t);
    const gaba = a.filter((n) => n.gaba).length;
    expect(gaba).toBeGreaterThan(3);
    expect(gaba).toBeLessThan(a.length / 4);
    expect(makeChart(6, bpm)).not.toEqual(a);
  });

  it('un jugador perfecto dispara la neurona, esquiva los frenos y acierta el 100 %', () => {
    const s = newRhythm(makeChart(7, bpm));
    let t = 0;
    for (const n of s.notes) {
      advance(s, n.t, n.t - t);
      t = n.t;
      if (!n.gaba) tap(s, n.lane, n.t);
    }
    advance(s, t + 1, 1);
    expect(accuracy(s)).toBe(100);
    expect(s.fires).toBeGreaterThan(2);
    expect(rhythmCards(s)).toEqual(expect.arrayContaining(['umbral', 'gaba']));
  });

  it('pulsar un GABA baja el potencial; no pulsar una vesícula es fallo', () => {
    const s = newRhythm([
      { t: 1, lane: 0, gaba: false, result: null },
      { t: 2, lane: 1, gaba: true, result: null },
      { t: 3, lane: 2, gaba: false, result: null },
    ]);
    tap(s, 0, 1.01);
    const before = s.potential;
    expect(tap(s, 1, 2).result).toBe('tapped');
    expect(s.potential).toBeLessThan(before);
    advance(s, 4, 1);
    expect(s.notes[2].result).toBe('miss');
    expect(tap(s, 2, 9).result).toBe('empty');
  });

  it('la ventana de acierto crece con la tolerancia', () => {
    const late = RHYTHM_RULES.good * 1.2;
    const strict = newRhythm([{ t: 1, lane: 0, gaba: false, result: null }]);
    expect(tap(strict, 0, 1 + late, 1).result).toBe('empty');
    const easy = newRhythm([{ t: 1, lane: 0, gaba: false, result: null }]);
    expect(tap(easy, 0, 1 + late, 1.4).result).toBe('good');
  });
});

describe('Cepíllate los dientes', () => {
  it('cada cara tiene placa sobre los dientes, más junto a la encía', async () => {
    const { makeFace, GRID_W, GRID_H, TOOTH_TOP, TOOTH_BOTTOM, cleanliness } = await import('./brush');
    const f = makeFace('fuera', 3, true);
    expect(f.initial).toBeGreaterThan(100);
    expect(cleanliness(f)).toBeCloseTo(0, 6);
    const row = (y: number) => { const gy = Math.floor(y * GRID_H); let s = 0, n = 0; for (let gx = 0; gx < GRID_W; gx++) { const i = gy * GRID_W + gx; if (f.tooth[i]) { s += f.plaque[i]; n++; } } return s / n; };
    // arriba: la encía está arriba → más placa cerca de TOOTH_TOP que del borde que muerde
    expect(row(TOOTH_TOP + 0.04)).toBeGreaterThan(row(TOOTH_BOTTOM - 0.06));
    expect(makeFace('fuera', 3, true).plaque).toEqual(f.plaque);
  });

  it('el vaivén corto limpia mucho más que pasar de largo deprisa', async () => {
    const { makeFace, scrub, newStroke, cleanliness } = await import('./brush');
    const wiggle = makeFace('fuera', 9, true), sweep = makeFace('fuera', 9, true);
    const s1 = newStroke(), s2 = newStroke();
    const dt = 1 / 60;
    // 6 segundos: vaivén de ±2 % recorriendo la cara despacio
    for (let k = 0; k < 360; k++) {
      const base = (k / 360) * 0.9 + 0.05;
      scrub(wiggle, s1, base + (k % 2 ? 0.02 : -0.02), 0.25 + 0.5 * ((k / 60) % 1), dt);
    }
    // 6 segundos: barridos largos y rápidos de un lado a otro
    for (let k = 0; k < 360; k++) scrub(sweep, s2, k % 2 ? 0.95 : 0.05, 0.25 + 0.5 * ((k / 60) % 1), dt);
    expect(cleanliness(wiggle)).toBeGreaterThan(0.5);
    expect(cleanliness(wiggle)).toBeGreaterThan(cleanliness(sweep) * 1.5);
  });

  it('la pasta justa es un guisante y la puntuación premia hacerlo bien', async () => {
    const { pasteAmount, pasteVerdict, brushScore, brushCards, AFTER_OPTIONS } = await import('./brush');
    expect(pasteVerdict(pasteAmount(0.2))).toBe('poca');
    expect(pasteVerdict(pasteAmount(0.7))).toBe('guisante');
    expect(pasteVerdict(pasteAmount(2))).toBe('mucha');
    expect(AFTER_OPTIONS.filter((o) => o.correct).map((o) => o.id)).toEqual(['escupir']);
    const faces = Array(12).fill(0.9);
    expect(brushScore(faces, 'guisante', true)).toBe(Math.round(12 * 90 + 200 + 150));
    expect(brushScore(faces, 'mucha', false)).toBe(1080);
    expect(brushCards(0.9, 'guisante', true, 4)).toEqual(['placa', 'pasta-guisante', 'escupir', 'dos-minutos', 'caries']);
    for (const c of brushCards(0.9, 'guisante', true, 4)) expect(MUSEUM_BY_ID[c], c).toBeDefined();
  });
});
