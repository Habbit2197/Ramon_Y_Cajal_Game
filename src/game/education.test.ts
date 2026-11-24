/**
 * education.test.ts — Dificultad, Desafío Diario, preguntas de Cajal y Museo.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { paramsFor, setActiveDifficulty, DIFFICULTIES } from './difficulty';
import { dailyChallenge, dateKey, dailyStreak, hashString, PLAY_IDS } from './daily';
import { QUIZ, pickQuestion, shuffledOptions, quizPointsBonus } from './quiz';
import { MUSEUM, MUSEUM_BY_ID } from './museum';
import { TROPHIES, EMPTY_STATS, starsForWin } from './trophies';
import { createMazeGame, grantPower, powerSecondsFor, MAZE_RULES } from './maze/sim';
import { world } from '../engine/world';
import { useProfileStore, aliasKey } from '../store/useProfileStore';

describe('Dificultad', () => {
  it('Explorador es más suave y Nobel más exigente que Científico en los tres modos', () => {
    const [e, c, n] = DIFFICULTIES.map((d) => paramsFor(d));
    expect(e.story.hazardSpeed).toBeLessThan(c.story.hazardSpeed);
    expect(n.story.hazardSpeed).toBeGreaterThan(c.story.hazardSpeed);
    expect(e.story.starSeconds).toBeGreaterThan(c.story.starSeconds);
    expect(n.story.starSeconds).toBeLessThan(c.story.starSeconds);
    expect(e.arcade.enemySpeed).toBeLessThan(1);
    expect(n.arcade.waveBudget).toBeGreaterThan(1);
    expect(e.arcade.invulnerable).toBeGreaterThan(n.arcade.invulnerable);
    expect(e.maze.ghostSpeed).toBeLessThan(n.maze.ghostSpeed);
    expect(e.maze.powerSeconds).toBeGreaterThan(n.maze.powerSeconds);
    expect(e.scoreMult).toBeLessThan(c.scoreMult);
    expect(n.scoreMult).toBeGreaterThan(c.scoreMult);
  });

  it('Científico conserva las reglas originales', () => {
    const c = paramsFor('cientifico');
    expect(c.scoreMult).toBe(1);
    expect(c.story.starSeconds).toBe(90);
    expect(c.arcade).toMatchObject({ enemySpeed: 1, waveBudget: 1, invulnerable: 1.6, vitalityDelta: 0 });
    expect(c.maze).toMatchObject({ ghostSpeed: 1, powerSeconds: 1, lives: MAZE_RULES.lives });
  });

  it('los modificadores del Desafío Diario cambian lo que dicen', () => {
    expect(paramsFor('cientifico', 'veloces').arcade.enemySpeed).toBeCloseTo(1.2);
    expect(paramsFor('cientifico', 'fragil').maze.lives).toBe(MAZE_RULES.lives - 1);
    expect(paramsFor('cientifico', 'fragil').arcade.vitalityDelta).toBe(-1);
    expect(paramsFor('cientifico', 'contrarreloj').lab.time).toBeLessThan(1);
    expect(paramsFor('cientifico', 'fragil').scoreMult).toBeGreaterThan(1);
  });

  it('la estrella de rapidez usa el tiempo de la dificultad', () => {
    expect(starsForWin(3, 3, 100, paramsFor('explorador').story.starSeconds)).toBe(3);
    expect(starsForWin(3, 3, 100, paramsFor('cientifico').story.starSeconds)).toBe(2);
    expect(starsForWin(3, 3, 80, paramsFor('nobel').story.starSeconds)).toBe(2);
  });

  it('el Arcade aplica la dificultad al empezar: velocidad, oleadas, invulnerabilidad y vidas', () => {
    setActiveDifficulty('explorador');
    world.reset(1);
    const budgetE = world.director.budget;
    expect(world.diff.speedMult).toBeLessThan(1);
    expect(world.diff.invulnerable).toBeGreaterThan(1.6);
    setActiveDifficulty('nobel');
    world.reset(1);
    expect(world.director.budget).toBeGreaterThan(budgetE);
    expect(world.diff.scoreMult).toBe(1.4);
    setActiveDifficulty('cientifico', 'fragil');
    world.reset(1);
    expect(world.player.vitality).toBe(2);
    setActiveDifficulty('cientifico');
    world.reset(1);
    expect(world.player.vitality).toBe(3);
  });

  it('el Laberinto aplica la dificultad: BDNF, vidas y puntos', () => {
    const easy = createMazeGame(5, { ...paramsFor('explorador').maze, scoreMult: 0.75 });
    const hard = createMazeGame(5, { ...paramsFor('nobel').maze, scoreMult: 1.4 });
    expect(powerSecondsFor(easy)).toBeGreaterThan(powerSecondsFor(hard));
    expect(easy.lives).toBe(4);
    grantPower(hard);
    expect(hard.power).toBeCloseTo(powerSecondsFor(hard));
  });
});

describe('Desafío Diario', () => {
  it('la misma fecha da siempre el mismo desafío', () => {
    expect(dailyChallenge('2026-11-24')).toEqual(dailyChallenge('2026-11-24'));
    expect(hashString('2026-11-24')).toBe(hashString('2026-11-24'));
  });

  it('fechas distintas dan desafíos distintos y todos los modos aparecen en una semana', () => {
    const days = Array.from({ length: 12 }, (_, i) => dailyChallenge(dateKey(new Date(2026, 10, 1 + i))));
    expect(new Set(days.map((d) => d.seed)).size).toBe(12);
    const firstBlock = new Set(days.slice(0, 6).map((d) => d.mode));
    const secondBlock = new Set(days.slice(6, 12).map((d) => d.mode));
    // los modos rotan: en 12 días seguidos salen todos
    expect(new Set([...firstBlock, ...secondBlock]).size).toBe(PLAY_IDS.length);
    for (const d of days) {
      expect(d.levelIndex).toBeGreaterThanOrEqual(0);
      expect(d.levelIndex).toBeLessThan(3);
      expect(d.goal.length).toBeGreaterThan(5);
    }
  });

  it('la fecha es la local, con ceros', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('cuenta rachas de días seguidos', () => {
    expect(dailyStreak(['2026-11-22', '2026-11-23', '2026-11-24'], '2026-11-24')).toBe(3);
    expect(dailyStreak(['2026-11-22', '2026-11-23'], '2026-11-24')).toBe(2); // hoy aún no ha jugado
    expect(dailyStreak(['2026-11-20', '2026-11-24'], '2026-11-24')).toBe(1);
    expect(dailyStreak(['2026-11-30', '2026-12-01'], '2026-12-01')).toBe(2); // cambio de mes
  });
});

describe('Preguntas de Cajal y Museo', () => {
  it('cada pregunta tiene 3 opciones distintas, una correcta, explicación y ficha existente', () => {
    expect(QUIZ.length).toBeGreaterThanOrEqual(25);
    expect(new Set(QUIZ.map((q) => q.id)).size).toBe(QUIZ.length);
    for (const q of QUIZ) {
      expect(new Set(q.options).size).toBe(3);
      expect([0, 1, 2]).toContain(q.answer);
      expect(q.explain.length).toBeGreaterThan(20);
      expect(MUSEUM_BY_ID[q.card], q.id).toBeDefined();
    }
  });

  it('el Museo tiene 33 fichas únicas, como pide la medalla', () => {
    expect(MUSEUM).toHaveLength(33);
    expect(new Set(MUSEUM.map((c) => c.id)).size).toBe(33);
    const t = TROPHIES.find((x) => x.id === 'museo-completo')!;
    expect(t.check({ ...EMPTY_STATS, discoveries: MUSEUM.length }, {})).toBe(true);
  });

  it('elige primero preguntas sin acertar y baraja las opciones sin perder la correcta', () => {
    const answered = QUIZ.slice(0, QUIZ.length - 1).map((q) => q.id);
    expect(pickQuestion(answered).id).toBe(QUIZ[QUIZ.length - 1].id);
    const q = QUIZ[0];
    const opts = shuffledOptions(q, 42);
    expect(opts.filter((o) => o.correct)).toHaveLength(1);
    expect(opts.find((o) => o.correct)!.text).toBe(q.options[q.answer]);
    expect(shuffledOptions(q, 42)).toEqual(opts);
    expect(quizPointsBonus(1000)).toBe(150);
  });
});

describe('Progreso educativo del alias', () => {
  beforeEach(() => {
    setActiveDifficulty('cientifico');
    useProfileStore.setState({ playerName: 'Prueba Museo', progress: {}, dailyBoard: {}, shareOnline: false });
  });
  const progress = () => useProfileStore.getState().progress[aliasKey('Prueba Museo')];

  it('acertar una pregunta cuenta una vez y desbloquea su ficha', () => {
    const q = QUIZ[0];
    const st = useProfileStore.getState();
    st.recordQuiz(q.id, false);
    expect(progress().stats.quizCorrect).toBe(0);
    st.recordQuiz(q.id, true);
    st.recordQuiz(q.id, true);
    expect(progress().stats.quizCorrect).toBe(1);
    expect(progress().discoveries[q.card]).toBeTruthy();
    expect(progress().stats.discoveries).toBe(1);
  });

  it('la dificultad se guarda por alias', () => {
    useProfileStore.getState().setDifficulty('nobel');
    expect(progress().difficulty).toBe('nobel');
    useProfileStore.getState().setPlayerName('Otro Alias');
    expect(useProfileStore.getState().progress[aliasKey('Otro Alias')]).toBeUndefined();
  });

  it('el Desafío Diario guarda el mejor resultado, cuenta la racha y da la ficha', () => {
    const st = useProfileStore.getState();
    st.recordDaily('2026-11-23', 500, true);
    st.recordDaily('2026-11-24', 300, false);
    st.recordDaily('2026-11-24', 800, true);
    st.recordDaily('2026-11-24', 100, true);
    const p = progress();
    expect(p.daily.best['2026-11-24']).toBe(800);
    expect(p.stats.dailyCompleted).toBe(2);
    expect(p.stats.dailyBestStreak).toBe(2);
    expect(p.discoveries.diario).toBeTruthy();
    expect(p.trophies['desafio-diario']).toBeTruthy();
  });

  it('las puntuaciones del desafío van también a la clasificación del día', () => {
    const st = useProfileStore.getState();
    st.submitScore('maze', 1200, 'Nivel 2', { daily: '2026-11-24' });
    const s = useProfileStore.getState();
    expect(s.dailyBoard['2026-11-24'][0].score).toBe(1200);
    expect(s.leaderboard.maze[0].difficulty).toBe('cientifico');
  });

  it('los minijuegos registran récords, medallas y fichas', () => {
    const st = useProfileStore.getState();
    st.recordLab('micro', { score: 900, completed: true, found: 7, cards: ['piramidal', 'purkinje'] });
    st.recordLab('rhythm', { score: 4000, completed: true, accuracy: 92, cards: ['dopamina'] });
    st.recordLab('build', { score: 1500, completed: true, cards: ['axon'] });
    const p = progress();
    expect(p.stats.labGames).toBe(3);
    expect(p.labBest.micro).toBe(900);
    expect(p.trophies['reaccion-negra']).toBeTruthy();
    expect(p.trophies['ritmo-perfecto']).toBeTruthy();
    expect(p.trophies.arquitecto).toBeTruthy();
    expect(p.stats.discoveries).toBe(4);
  });
});
