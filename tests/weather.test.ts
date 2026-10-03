import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assessOutlook, describeCode, windowFor, withinForecastRange, type HourlyPoint } from '../src/lib/weather.ts';

function hour(time: string, patch: Partial<HourlyPoint> = {}): HourlyPoint {
  return { time, tempF: 68, precipProb: 5, precipMm: 0, windMph: 6, gustMph: 10, code: 0, ...patch };
}

// A Sunday 9:00 AM kids session.
const START = '2026-10-04T09:00:00-04:00';
const day = (patch: Partial<HourlyPoint> = {}) => [
  hour('2026-10-04T07:00'),
  hour('2026-10-04T08:00', patch),
  hour('2026-10-04T09:00', patch),
  hour('2026-10-04T10:00', patch),
  hour('2026-10-04T14:00', { code: 95, precipProb: 90 }), // a storm later the same day must not matter
];

describe('which hours matter', () => {
  it('takes the hour before arrival through the end of the session, and nothing later', () => {
    const times = windowFor(day(), START, 60).map((item) => item.time);
    assert.deepEqual(times, ['2026-10-04T08:00', '2026-10-04T09:00', '2026-10-04T10:00']);
  });
});

describe('the outlook for a session', () => {
  it('is good, and happy, when the weather is fine', () => {
    const outlook = assessOutlook(day(), START)!;
    assert.equal(outlook.level, 'good');
    assert.match(outlook.family, /Looks great for Sunday at 9:00 AM/);
    assert.equal(outlook.summary, '68°F · Clear');
  });

  it('ignores a storm that comes after the session', () => {
    assert.equal(assessOutlook(day(), START)!.level, 'good');
  });

  it('watches a moderate chance of rain and still reassures', () => {
    const outlook = assessOutlook(day({ precipProb: 40, code: 3 }), START)!;
    assert.equal(outlook.level, 'watch');
    assert.match(outlook.family, /unsettled/);
    assert.match(outlook.family, /We’ll tell you here if anything changes/);
  });

  it('is risky for thunderstorms, and tells families to wait for the call, never that it is off', () => {
    const outlook = assessOutlook(day({ code: 95, precipProb: 70 }), START)!;
    assert.equal(outlook.level, 'risky');
    assert.match(outlook.family, /Nothing has changed yet/);
    assert.match(outlook.family, /wait for your coach/i);
    assert.doesNotMatch(outlook.family, /cancel/i);
    assert.match(outlook.staff, /Consider telling families early/);
    assert.equal(outlook.icon, 'thunderstorm-outline');
  });

  it('is risky for a high chance of heavy rain, strong gusts, heat and freezing cold', () => {
    assert.equal(assessOutlook(day({ precipProb: 80, precipMm: 3, code: 65 }), START)!.level, 'risky');
    assert.equal(assessOutlook(day({ gustMph: 40 }), START)!.level, 'risky');
    assert.equal(assessOutlook(day({ tempF: 97 }), START)!.level, 'risky');
    assert.equal(assessOutlook(day({ tempF: 25 }), START)!.level, 'risky');
  });

  it('watches warm, windy, cold and foggy mornings without alarm', () => {
    assert.equal(assessOutlook(day({ tempF: 90 }), START)!.level, 'watch');
    assert.equal(assessOutlook(day({ gustMph: 28 }), START)!.level, 'watch');
    assert.equal(assessOutlook(day({ tempF: 35 }), START)!.level, 'watch');
    assert.equal(assessOutlook(day({ code: 45 }), START)!.level, 'watch');
  });

  it('never invents an outlook when there is no forecast for that time', () => {
    assert.equal(assessOutlook([], START), null);
    assert.equal(assessOutlook([hour('2026-10-10T09:00')], START), null);
  });

  it('keeps the worst hour, not the average', () => {
    const hours = [hour('2026-10-04T08:00'), hour('2026-10-04T09:00', { precipProb: 75, precipMm: 4, code: 63 }), hour('2026-10-04T10:00')];
    assert.equal(assessOutlook(hours, START)!.level, 'risky');
  });
});

describe('labels and range', () => {
  it('names weather codes', () => {
    assert.equal(describeCode(0).label, 'Clear');
    assert.equal(describeCode(2).label, 'Partly cloudy');
    assert.equal(describeCode(61).label, 'Rain');
    assert.equal(describeCode(95).label, 'Thunderstorms');
  });

  it('only forecasts what a forecast can honestly cover', () => {
    const now = new Date('2026-10-03T12:00:00-04:00');
    assert.equal(withinForecastRange('2026-10-04T09:00:00-04:00', now), true);
    assert.equal(withinForecastRange('2026-10-12T09:00:00-04:00', now), true);
    assert.equal(withinForecastRange('2026-10-20T09:00:00-04:00', now), false);
    assert.equal(withinForecastRange('2026-09-27T09:00:00-04:00', now), false);
  });
});
