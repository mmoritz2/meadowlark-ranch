import {ROUNDUP_MODES} from './roundup-rewards.mjs?v=roundup-finish-1';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value, fallback = 0) => finite(value) ? Math.max(0, value) : fallback;
const modeFor = value => ROUNDUP_MODES[value] || ROUNDUP_MODES.beginner;
const seconds = value => {
 const rounded = Math.round(Math.max(0, value) * 10) / 10;
 return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}s`;
};
// A positive miss smaller than a tenth still needs a visible, achievable target.
const improvement = value => seconds(Math.ceil(Math.max(0, value) * 10 - 1e-9) / 10);
function targets(value) {
 const mode = modeFor(value.mode);
 const timeLimit = finite(value.timeLimit) && value.timeLimit > 0 ? value.timeLimit : mode.time;
 const goldTimeLimit = finite(value.goldTimeLimit) && value.goldTimeLimit >= 0
  ? Math.min(timeLimit, value.goldTimeLimit) : timeLimit * .65;
 const total = Number.isInteger(value.total) && value.total > 0 ? value.total : mode.n;
 return {timeLimit, goldTimeLimit, total};
}

/** Text for the live herd guide. No medal or reward is claimed before saving. */
export function roundupPace(state = {}) {
 if (state.saved === false || state.pending && state.pending.saved !== true) {
  return {label:'Waiting to save', detail:'Keep this tab open and retry saving your round.', tone:'pending'};
 }
 if (state.paused) {
  return {label:'Roundup paused', detail:'Your timer waits while another screen is open. Return to the herd when you are ready.', tone:'neutral'};
 }
 const {timeLimit, goldTimeLimit, total} = targets(state);
 const goldTarget = `Gold: all ${total} horses home in ${seconds(goldTimeLimit)} or less.`;
 if (nonnegative(state.countdown) > 0) {
  return {label:`Starting in ${Math.ceil(state.countdown)}s`,
   detail:`${goldTarget} The clock starts after the countdown.`, tone:'ready'};
 }
 if (state.active === false) {
  return {label:'Gold target', detail:goldTarget, tone:'ready'};
 }
 const elapsed = finite(state.elapsed) ? nonnegative(state.elapsed)
  : Math.max(0, timeLimit - nonnegative(state.timeLeft, timeLimit));
 const timeLeft = finite(state.timeLeft) ? nonnegative(state.timeLeft) : Math.max(0, timeLimit - elapsed);
 if (timeLeft === 0) {
  const penned = Math.min(total, Math.floor(nonnegative(state.penned)));
  return {label:'Time is up', detail:`${penned} of ${total} home. Your next target is the whole herd.`, tone:'neutral'};
 }
 if (elapsed <= goldTimeLimit) {
  // Round the countdown upward so a small positive window never reads as zero.
  const left = Math.ceil(Math.max(0, goldTimeLimit - elapsed) * 10 - 1e-9) / 10;
  return {label:`Gold window · ${seconds(left)} left`, detail:goldTarget, tone:'gold'};
 }
 return {label:'Keep going for silver',
  detail:`Bring all ${total} horses home by ${seconds(timeLimit)} for silver.`, tone:'silver'};
}

/** A useful next ride target based only on a durable result receipt. */
export function roundupNextAttempt(receipt = {}) {
 if (receipt.saved !== true) {
  return {title:'Save your round first', detail:'Keep this tab open and retry saving before starting another ride.'};
 }
 const {timeLimit, goldTimeLimit, total} = targets(receipt);
 const all = nonnegative(receipt.penned) >= total;
 const time = nonnegative(receipt.time, timeLimit);
 const remaining = finite(receipt.remaining) ? nonnegative(receipt.remaining) : Math.max(0, timeLimit - time);
 const medal = ['gold', 'silver', 'bronze', 'none'].includes(receipt.medal) ? receipt.medal
  : all ? remaining >= timeLimit * .35 ? 'gold' : 'silver' : receipt.penned > 0 ? 'bronze' : 'none';
 if (!all || medal === 'bronze' || medal === 'none') {
  return {title:'Bring everyone home', detail:`Next target: all ${total} horses in the pen by ${seconds(timeLimit)}.`};
 }
 if (medal === 'silver') {
  const faster = Math.max(0, time - goldTimeLimit);
  return {title:'Go for gold', detail:faster > 0
   ? `Aim for ${improvement(faster)} faster. Bring all ${total} home in ${seconds(goldTimeLimit)} or less. Trot between horses, then slow down behind each one.`
   : `Bring all ${total} home in ${seconds(goldTimeLimit)} or less.`};
 }
 const best = receipt.newBestTime ? 'New fastest time. ' : receipt.newBestScore ? 'New best score. ' : '';
 if (receipt.mode !== 'full') {
  const full = ROUNDUP_MODES.full;
  return {title:'Try the full herd', detail:`${best}Guide all ${full.n} horses home in ${seconds(full.time * .65)} or less for gold.`};
 }
 const previous = finite(receipt.previousBestTime) && receipt.previousBestTime > 0 ? receipt.previousBestTime : time;
 const target = Math.min(previous, time);
 return {title:'Chase your best time', detail:`${best}Bring all ${total} home faster than ${seconds(target)}.`};
}
