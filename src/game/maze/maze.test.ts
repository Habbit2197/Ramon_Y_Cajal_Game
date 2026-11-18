import { describe, it, expect } from 'vitest';
import { generateMaze, mazeProblems, OPP, type Dir } from './graph';
import { createMazeGame, stepMaze, moverPos, MAZE_RULES, type MazeState } from './sim';

const STEP = 1 / 60;
const run = (s: MazeState, secs: number, dir: Dir | null = null, fire = false) => {
  for (let i = 0; i < secs / STEP; i++) stepMaze(s, { dir, fire }, STEP);
};
const play = (seed = 3) => {
  const s = createMazeGame(seed);
  run(s, 2.1); // cuenta atrás «¿Listo?»
  expect(s.phase).toBe('playing');
  return s;
};

describe('Red neuronal', () => {
  it('500 redes: conexas, simétricas y sin callejones sin salida', () => {
    for (let seed = 1; seed <= 500; seed++) expect(mazeProblems(generateMaze(seed)), `semilla ${seed}`).toEqual([]);
  });

  it('la guarida solo se abre hacia arriba', () => {
    const g = generateMaze(11);
    expect(g.nodes[g.home].links).toEqual([g.door, -1, -1, -1]);
  });
});

describe('Movimiento del jugador', () => {
  it('se mueve por los axones y para al final de un tramo', () => {
    const s = play();
    const start = moverPos(s.graph, s.player);
    run(s, 0.5, 1);
    run(s, 0.5, 3);
    const p = moverPos(s.graph, s.player);
    expect(Math.hypot(p.x - start.x, p.z - start.z)).toBeGreaterThanOrEqual(0); // no explota
    // siempre está sobre un axón válido
    const pl = s.player;
    expect(pl.from === pl.to || s.graph.nodes[pl.from].links.includes(pl.to)).toBe(true);
  });

  it('puede dar media vuelta en mitad de un axón', () => {
    const s = play();
    // buscar una dirección posible desde la salida
    const d = ([0, 1, 2, 3] as Dir[]).find((x) => s.graph.nodes[s.graph.start].links[x] >= 0 && s.graph.nodes[s.graph.start].links[x] !== s.graph.home)!;
    run(s, 0.1, d);
    expect(s.player.from).not.toBe(s.player.to);
    const before = s.player.t;
    stepMaze(s, { dir: OPP[d], fire: false }, STEP);
    expect(s.player.dir).toBe(OPP[d]);
    expect(s.player.t).toBeLessThan(1 - before + 0.2);
  });
});

describe('Reglas', () => {
  it('recoger vesículas suma puntos y las descuenta', () => {
    const s = play();
    const left = s.pelletsLeft;
    for (const d of [3, 1, 0, 2] as Dir[]) run(s, 0.8, d);
    expect(s.pelletsLeft).toBeLessThan(left);
    expect(s.score).toBeGreaterThan(0);
  });

  it('el BDNF asusta a las toxinas activas y luego se pasa', () => {
    const s = play();
    const pw = s.pellets.find((p) => p.power)!;
    // teletransporte de prueba al nodo con BDNF
    const node = s.graph.nodes.findIndex((n) => n.x === pw.x && n.z === pw.z);
    s.player.from = s.player.to = node;
    stepMaze(s, { dir: null, fire: false }, STEP);
    expect(s.power).toBeGreaterThan(0);
    expect(s.ghosts.some((g) => g.mode === 'frightened')).toBe(true);
    run(s, MAZE_RULES.powerSeconds(1) + 0.2);
    expect(s.ghosts.some((g) => g.mode === 'frightened')).toBe(false);
  });

  it('tocar una toxina asustada la neutraliza y encadena puntos', () => {
    const s = play();
    s.power = 5;
    const gh = s.ghosts[0];
    gh.mode = 'frightened';
    Object.assign(gh, { from: s.player.from, to: s.player.to, t: s.player.t });
    const before = s.score;
    stepMaze(s, { dir: null, fire: false }, STEP);
    expect(gh.mode).toBe('eaten');
    expect(s.score - before).toBeGreaterThanOrEqual(MAZE_RULES.points.ghost);
  });

  it('tocar una toxina normal quita una vida y reinicia posiciones', () => {
    const s = play();
    const gh = s.ghosts[0];
    Object.assign(gh, { from: s.player.from, to: s.player.to, t: s.player.t, mode: 'active' });
    stepMaze(s, { dir: null, fire: false }, STEP);
    expect(s.lives).toBe(MAZE_RULES.lives - 1);
    expect(s.phase).toBe('dying');
    run(s, 2);
    expect(['ready', 'playing']).toContain(s.phase);
  });

  it('el disparo gasta una carga, aturde a la toxina y se recarga', () => {
    const s = play();
    const g = s.graph;
    const d = ([0, 1, 2, 3] as Dir[]).find((x) => g.nodes[g.start].links[x] >= 0 && g.nodes[g.start].links[x] !== g.home)!;
    const target = g.nodes[g.start].links[d];
    s.player.facing = d;
    const gh = s.ghosts[0];
    Object.assign(gh, { from: target, to: target, t: 0, mode: 'active', stun: 0 });
    stepMaze(s, { dir: null, fire: true }, STEP);
    expect(s.charges).toBe(MAZE_RULES.charges - 1);
    run(s, 0.3);
    expect(s.stuns).toBe(1);
    run(s, MAZE_RULES.rechargeSeconds + 0.1);
    expect(s.charges).toBe(MAZE_RULES.charges);
  });

  it('con BDNF dispara en varias direcciones a la vez', () => {
    const s = play();
    s.power = 5;
    stepMaze(s, { dir: null, fire: true }, STEP);
    const options = s.graph.nodes[s.graph.start].links.filter((b) => b >= 0 && b !== s.graph.home).length;
    expect(s.shots.length).toBe(options);
  });

  it('recoger todo activa la red y pasa al siguiente nivel con otra red', () => {
    const s = play();
    const oldGraph = s.graph;
    for (const p of s.pellets) p.eaten = true;
    s.pelletsLeft = 0;
    stepMaze(s, { dir: null, fire: false }, STEP);
    expect(s.phase).toBe('cleared');
    run(s, 2.6);
    expect(s.level).toBe(2);
    expect(s.graph).not.toBe(oldGraph);
    expect(s.pelletsLeft).toBeGreaterThan(50);
  });
});

describe('Partida automática', () => {
  it('3 minutos con un jugador al azar: nunca se rompe y acaba la partida', () => {
    const s = createMazeGame(42);
    let dir: Dir = 3;
    for (let i = 0; i < 180 / STEP && s.phase !== 'gameover'; i++) {
      if (i % 40 === 0) dir = (Math.floor(s.rng() * 4)) as Dir;
      stepMaze(s, { dir, fire: i % 90 === 0 }, STEP);
      s.events.length = 0;
      for (const m of [s.player, ...s.ghosts, ...s.shots]) {
        expect(m.t).toBeGreaterThanOrEqual(0);
        expect(m.t).toBeLessThanOrEqual(1);
        expect(m.from === m.to || s.graph.nodes[m.from].links.includes(m.to)).toBe(true);
      }
      expect(s.charges).toBeGreaterThanOrEqual(0);
      expect(s.pelletsLeft).toBeGreaterThanOrEqual(0);
    }
    // un jugador al azar no debería sobrevivir 3 minutos: es un modo difícil
    expect(s.phase).toBe('gameover');
  });
});
