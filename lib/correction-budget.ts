export interface CorrectionBudgetResult {
  allowedLines: number;
  originalChangedLines: number;
  candidateCorrectionLines: number;
  isWithinBudget: boolean;
  excessLines: number;
}

export function calculateCorrectionBudget(originalChangedLines: number): number {
  if (originalChangedLines <= 0) return 20; // minimal baseline
  return Math.min(200, Math.ceil(originalChangedLines / 2));
}

export function evaluateCorrectionDiff(
  originalChangedLines: number,
  candidateCorrectionLines: number
): CorrectionBudgetResult {
  const allowedLines = calculateCorrectionBudget(originalChangedLines);
  const isWithinBudget = candidateCorrectionLines <= allowedLines;
  const excessLines = Math.max(0, candidateCorrectionLines - allowedLines);

  return {
    allowedLines,
    originalChangedLines,
    candidateCorrectionLines,
    isWithinBudget,
    excessLines,
  };
}
