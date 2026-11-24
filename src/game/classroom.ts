/**
 * classroom.ts — Resumen del progreso que un alumno comparte con su profe (modo aula).
 *
 * Solo números del juego: medallas, estrellas, fichas del Museo, preguntas acertadas,
 * partidas, desafíos y mejores puntuaciones. Función pura: fácil de revisar y de testear.
 */
import type { PlayerProgress, ScoreEntry } from '../store/useProfileStore';
import type { PlayId } from './daily';

export interface ClassProgress {
  medals: number;
  stars: number;
  museum: number;
  quiz: number;
  games: number;
  labGames: number;
  daily: number;
  streak: number;
  storyBest: number;
  arcadeBest: number;
  mazeBest: number;
  microBest: number;
  buildBest: number;
  rhythmBest: number;
  difficulty: string;
}

const sum = (o: Record<string | number, number> | undefined) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);

export function classSummary(p: PlayerProgress, boards: Partial<Record<PlayId, ScoreEntry[]>>, alias: string): ClassProgress {
  const st = p.stats;
  const key = alias.trim().toLowerCase();
  const best = (m: PlayId) => Math.max(0, ...(boards[m] ?? []).filter((e) => e.name.trim().toLowerCase() === key).map((e) => e.score));
  return {
    medals: Object.keys(p.trophies).length,
    stars: sum(p.stars) + sum(p.arcadeStars),
    museum: Object.keys(p.discoveries ?? {}).length,
    quiz: st.quizCorrect ?? 0,
    games: st.storyGames + st.arcadeGames + st.mazeGames + (st.labGames ?? 0),
    labGames: st.labGames ?? 0,
    daily: st.dailyCompleted ?? 0,
    streak: st.dailyBestStreak ?? 0,
    storyBest: best('story'),
    arcadeBest: best('arcade'),
    mazeBest: Math.max(best('maze'), st.mazeBestScore ?? 0),
    microBest: Math.max(best('micro'), p.labBest?.micro ?? 0),
    buildBest: Math.max(best('build'), p.labBest?.build ?? 0),
    rhythmBest: Math.max(best('rhythm'), p.labBest?.rhythm ?? 0),
    difficulty: p.difficulty ?? 'cientifico',
  };
}

/** Código de clase: 6 caracteres sin 0, O, 1 ni I (se dictan sin confusión) */
export const normalizeClassCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const isClassCode = (c: string) => /^[A-HJ-NP-Z2-9]{6}$/.test(c);

/** CSV para que el profe lo abra en una hoja de cálculo (separado por «;» para Excel en español) */
export function classCsv(students: { name: string; updated: string; progress: Partial<ClassProgress> }[]): string {
  const head = ['Alias', 'Medallas', 'Estrellas', 'Fichas del Museo', 'Preguntas acertadas', 'Partidas', 'Laboratorio', 'Desafíos', 'Racha', 'Dificultad', 'Última vez'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = students.map((s) => {
    const p = s.progress;
    return [s.name, p.medals, p.stars, p.museum, p.quiz, p.games, p.labGames, p.daily, p.streak, p.difficulty, s.updated?.slice(0, 10)].map(esc).join(';');
  });
  return '﻿' + [head.map(esc).join(';'), ...rows].join('\r\n');
}
