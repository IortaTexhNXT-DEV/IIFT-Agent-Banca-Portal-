import { FinancingRatingEngine } from './financing.engine.js';
import { FixedPlanRatingEngine } from './fixed-plan.engine.js';
import type { RatingEngine } from './rating.types.js';

const ENGINES: RatingEngine[] = [new FinancingRatingEngine(), new FixedPlanRatingEngine()];

export const RATING_ENGINE_CODES = ENGINES.map((engine) => engine.code);

export function ratingEngine(code: string): RatingEngine {
  const engine = ENGINES.find((candidate) => candidate.code === code);
  if (!engine) {
    throw new Error(`Unknown rating engine ${code}`);
  }
  return engine;
}
