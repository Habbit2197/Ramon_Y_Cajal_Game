import { describe, it, expect } from 'vitest';
import { checkPlayerName, randomAlias, NAME_MAX } from './names';
import { insertScore, type ScoreEntry } from '../store/useProfileStore';

const entry = (id: string, score: number, date: string): ScoreEntry => ({ id, name: id, avatar: 0, score, detail: '', date });

describe('Alias de jugador', () => {
  it('acepta alias normales con tildes y ñ', () => {
    expect(checkPlayerName('  Íñigo   2B ')).toEqual({ ok: true, value: 'Íñigo 2B' });
    expect(checkPlayerName('Neurona_Veloz-27').ok).toBe(true);
  });

  it('rechaza nombres vacíos, largos o con símbolos', () => {
    expect(checkPlayerName('a').ok).toBe(false);
    expect(checkPlayerName('x'.repeat(NAME_MAX + 1)).ok).toBe(false);
    expect(checkPlayerName('<script>').ok).toBe(false);
  });

  it('rechaza datos de contacto', () => {
    expect(checkPlayerName('ana@cole').ok).toBe(false);
    expect(checkPlayerName('Ana 600123456').ok).toBe(false);
    expect(checkPlayerName('www.ana.com').ok).toBe(false);
  });

  it('rechaza palabras malsonantes, también disfrazadas', () => {
    expect(checkPlayerName('MiErDa').ok).toBe(false);
    expect(checkPlayerName('p0ll4').ok).toBe(false);
    expect(checkPlayerName('Gilipóllas').ok).toBe(false);
  });

  it('genera alias válidos y dentro del límite', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 200; i++) {
      const a = randomAlias(rng);
      expect(a.length).toBeLessThanOrEqual(NAME_MAX);
      expect(checkPlayerName(a).ok).toBe(true);
    }
  });
});

describe('Clasificación', () => {
  it('ordena por puntos y, a igualdad, por quién llegó antes', () => {
    let list: ScoreEntry[] = [];
    list = insertScore(list, entry('b', 100, '2026-01-02')).list;
    list = insertScore(list, entry('a', 100, '2026-01-01')).list;
    const r = insertScore(list, entry('c', 300, '2026-01-03'));
    expect(r.list.map((e) => e.id)).toEqual(['c', 'a', 'b']);
    expect(r.rank).toBe(1);
  });

  it('devuelve null si la puntuación no entra en el top', () => {
    const full = Array.from({ length: 3 }, (_, i) => entry(`e${i}`, 1000 - i, '2026-01-01'));
    const r = insertScore(full, entry('low', 5, '2026-01-02'), 3);
    expect(r.rank).toBeNull();
    expect(r.list).toHaveLength(3);
  });
});

import { TROPHIES, EMPTY_STATS, newlyUnlocked, starsForWin } from './trophies';
import { useProfileStore, aliasKey } from '../store/useProfileStore';
import { useToastStore } from '../store/useToastStore';

describe('Medallas', () => {
  it('hay 25 medallas con ids únicos, cómo conseguirlas y un dato', () => {
    expect(TROPHIES).toHaveLength(25);
    expect(new Set(TROPHIES.map((t) => t.id)).size).toBe(25);
    for (const t of TROPHIES) { expect(t.how.length).toBeGreaterThan(5); expect(t.fact.length).toBeGreaterThan(20); }
  });

  it('un jugador nuevo no tiene ninguna', () => {
    expect(newlyUnlocked({ ...EMPTY_STATS, levelsCompleted: [] }, {}, {})).toEqual([]);
  });

  it('no repite medallas ya conseguidas', () => {
    const s = { ...EMPTY_STATS, levelsCompleted: [], storyGames: 1 };
    expect(newlyUnlocked(s, {}, {})).toEqual(['primera-sinapsis']);
    expect(newlyUnlocked(s, {}, { 'primera-sinapsis': 'x' })).toEqual([]);
  });

  it('estrellas: una por reto cumplido', () => {
    expect(starsForWin(1, 3, 200)).toBe(1);
    expect(starsForWin(3, 3, 200)).toBe(2);
    expect(starsForWin(3, 3, 45)).toBe(3);
  });
});

describe('Progreso por alias', () => {
  it('registra una victoria: estrellas, nivel completado, medallas y avisos', () => {
    useToastStore.setState({ queue: [] });
    useProfileStore.setState({ playerName: 'Ana B', progress: {} });
    const { stars } = useProfileStore.getState().recordStory({ won: true, levelIndex: 0, seconds: 50, vitality: 3, maxVitality: 3, hazardsHit: 0, habits: 6 });
    expect(stars).toBe(3);
    const p = useProfileStore.getState().progress[aliasKey('Ana B')];
    expect(p.stars[0]).toBe(3);
    expect(Object.keys(p.trophies).sort()).toEqual(['neurona-veloz', 'paseo-parque', 'primera-sinapsis', 'sin-un-rasguno']);
    expect(useToastStore.getState().queue).toHaveLength(4);
  });

  it('cada alias tiene su propio progreso', () => {
    useProfileStore.setState({ playerName: 'Otro', progress: {} });
    useProfileStore.getState().recordArcadeEnd({ won: false, kills: 12, region: 1, wave: 2, level: 4 });
    const s = useProfileStore.getState();
    expect(s.progress[aliasKey('Otro')].stats.totalKills).toBe(12);
    expect(s.progress[aliasKey('Ana B')]).toBeUndefined();
    expect(s.progress[aliasKey('Otro')].trophies['hipocampo']).toBeTruthy();
  });
});

describe('Modo Laberinto en el perfil', () => {
  it('registra la partida, la clasificación propia y las medallas del laberinto', () => {
    useToastStore.setState({ queue: [] });
    useProfileStore.setState({ playerName: 'Laberinto', progress: {}, leaderboard: { story: [], arcade: [], maze: [] } });
    const st = useProfileStore.getState();
    st.recordMaze({ level: 3 });
    st.recordMaze({ bestChain: 4 });
    expect(st.submitScore('maze', 12000, 'Nivel 3')).toBe(1);
    useProfileStore.getState().recordMazeEnd({ level: 3, score: 12000 });
    const p = useProfileStore.getState().progress[aliasKey('Laberinto')];
    expect(p.stats.mazeGames).toBe(1);
    for (const id of ['red-activada', 'plasticidad', 'cadena-bdnf', 'insomnio-vencido']) expect(p.trophies[id], id).toBeTruthy();
    expect(useProfileStore.getState().leaderboard.maze).toHaveLength(1);
  });
});
