import endgameCheckmates from './endgame-checkmates.json';
import tacticalMotifs from './tactical-motifs.json';

/** A single teaching position within a course. */
export interface CourseStep {
  title: string;
  fen: string;
  point: string;
}

/** A guided mini-course: a titled sequence of teaching positions. */
export interface Course {
  id: string;
  title: string;
  steps: CourseStep[];
}

/**
 * All bundled Masterclass courses. The JSON files are imported directly and
 * validated structurally against {@link Course} here so consumers get strict
 * typing without re-parsing at runtime.
 */
export const COURSES: Course[] = [
  endgameCheckmates as Course,
  tacticalMotifs as Course,
];
