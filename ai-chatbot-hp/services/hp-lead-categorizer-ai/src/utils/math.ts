/**
 * Cohen's-kappa inter-rater agreement
 * Calculates the agreement between model classification and human ground truth.
 * Target: κ ≥ 0.7
 */
export function calculateCohensKappa(pairs: { actual: string; expected: string }[], categories: string[]): number {
  if (pairs.length === 0) return 0;

  const N = pairs.length;
  const observedCount: Record<string, Record<string, number>> = {};
  const actualFreq: Record<string, number> = {};
  const expectedFreq: Record<string, number> = {};

  categories.forEach(cat => {
    observedCount[cat] = {};
    categories.forEach(cat2 => observedCount[cat][cat2] = 0);
    actualFreq[cat] = 0;
    expectedFreq[cat] = 0;
  });

  pairs.forEach(({ actual, expected }) => {
    if (observedCount[expected] && observedCount[expected][actual] !== undefined) {
      observedCount[expected][actual]++;
      actualFreq[actual]++;
      expectedFreq[expected]++;
    }
  });

  let pObserved = 0;
  categories.forEach(cat => {
    pObserved += observedCount[cat][cat];
  });
  pObserved /= N;

  let pChance = 0;
  categories.forEach(cat => {
    pChance += (actualFreq[cat] / N) * (expectedFreq[cat] / N);
  });

  if (pChance === 1) return 1;
  return (pObserved - pChance) / (1 - pChance);
}
