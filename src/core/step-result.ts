/** Outcome of a single setup step. Steps never throw — they return this. */
export interface StepResult {
  name: string;
  status: 'ok' | 'skipped' | 'failed';
  detail?: string;
}
