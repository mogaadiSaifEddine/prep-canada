// One coach per exam per session (their state survives moving between pages).
// Signing out or deleting the account drops them.
import { IeltsCoach } from './ielts';
import { TefCoach } from './tef';

let ielts: IeltsCoach | null = null;
let tef: TefCoach | null = null;

export function getIelts() { return ielts || (ielts = new IeltsCoach()); }
export function getTef() { return tef || (tef = new TefCoach()); }
export function resetCoaches() {
  for (const c of [ielts, tef]) if (c) { c.unmount(); c.stopTimer(); c.S.run = null; }
  ielts = null; tef = null;
}
