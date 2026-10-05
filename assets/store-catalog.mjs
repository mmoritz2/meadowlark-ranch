// Public draft catalog shared by the static preview and test account service.
// This module contains no account data, credentials, or payment connection.
export const PRODUCTS = Object.freeze({
  gems_40: {name: 'Pocket of gems', cents: 299, gems: 40, days: 0},
  gems_120: {name: 'Pouch of gems', cents: 699, gems: 120, days: 0},
  gems_300: {name: 'Chest of gems', cents: 1499, gems: 300, days: 0},
  vip_30: {name: '30-day VIP pass', cents: 499, gems: 0, days: 30},
});
export const REWARDS = Object.freeze({
  vip_week: {name: '7-day VIP pass', gems: 10, days: 7},
  vip_month: {name: '30-day VIP pass', gems: 32, days: 30},
  vip_season: {name: '90-day VIP pass', gems: 80, days: 90},
});
