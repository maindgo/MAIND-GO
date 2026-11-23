import {LocationWeatherBundle, PlanId, UnitSystem} from '../types/weather';
import {
  formatPrecipValue,
  formatSpeedValue,
  formatTempValue,
  precipUnitLabel,
  speedUnitLabel,
  tempUnitLabel,
} from './weatherFormat';

export const OFFICIAL_UPI_ID = 'tntmilan06@slc';

export const PLAN_PRICING: Record<
  PlanId,
  {
    name: string;
    tierLabel: 'PRO' | 'VIP';
    inrAmount: number;
    inrFormatted: string;
    usdAmount: number;
    usdFormatted: string;
    periodLabel: string;
  }
> = {
  PRO_MONTHLY: {
    name: 'PRO Forecaster',
    tierLabel: 'PRO',
    inrAmount: 5,
    inrFormatted: '₹5',
    usdAmount: 0.06,
    usdFormatted: '$0.06',
    periodLabel: 'per month',
  },
  VIP_ANNUAL: {
    name: 'VIP Atmospheric Master',
    tierLabel: 'VIP',
    inrAmount: 10,
    inrFormatted: '₹10',
    usdAmount: 0.12,
    usdFormatted: '$0.12',
    periodLabel: 'per year',
  },
};

export function computeDiscountedPlanPricing(planId: PlanId, discountPercent = 0) {
  const base = PLAN_PRICING[planId];
  const clampedDiscount = Math.max(0, Math.min(95, Math.round(discountPercent)));
  const factor = (100 - clampedDiscount) / 100;
  const finalInr = Math.max(1, Math.round(base.inrAmount * factor));
  const finalUsd = Math.max(0.01, Number((base.usdAmount * factor).toFixed(2)));
  return {
    baseInr: base.inrAmount,
    baseInrFormatted: base.inrFormatted,
    baseUsd: base.usdAmount,
    baseUsdFormatted: base.usdFormatted,
    discountPercent: clampedDiscount,
    finalInr,
    finalInrFormatted: `₹${finalInr.toLocaleString('en-IN')}`,
    finalUsd,
    finalUsdFormatted: `$${finalUsd.toFixed(2)}`,
    savingsInr: Math.max(0, base.inrAmount - finalInr),
  };
}

export function buildUpiPaymentUri(
  planId: PlanId,
  discountPercent = 0,
  userEmail?: string | null
): string {
  const plan = PLAN_PRICING[planId];
  const pricing = computeDiscountedPlanPricing(planId, discountPercent);
  const emailHint = userEmail ? userEmail.replace(/[^a-zA-Z0-9@._-]/g, '').slice(0, 32) : '';
  const discountTag = pricing.discountPercent > 0 ? ` ${pricing.discountPercent}%OFF` : '';
  const params = new URLSearchParams({
    pa: OFFICIAL_UPI_ID,
    pn: 'MAIND GO',
    am: pricing.finalInr.toFixed(2),
    cu: 'INR',
    tn: `MAIND GO ${plan.tierLabel}${discountTag}${emailHint ? ` ${emailHint}` : ''}`,
  });
  return `upi://pay?${params.toString()}`;
}

function escapeCsvCell(raw: string): string {
  // Neutralize spreadsheet formula triggers and escape double quotes
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function triggerCsvDownload(filename: string, rows: string[][]): void {
  const csv = rows.map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportHourlyTelemetryCsv(bundle: LocationWeatherBundle, units: UnitSystem): void {
  const slug = bundle.current.locationName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'location';
  const rows: string[][] = [
    [
      'Hour',
      'Date',
      `Temp (${tempUnitLabel(units)})`,
      `Feels Like (${tempUnitLabel(units)})`,
      'Precip Prob (%)',
      `Precip (${precipUnitLabel(units)})`,
      `Wind (${speedUnitLabel(units)})`,
      'Humidity (%)',
      'Pressure (hPa)',
      'Condition',
    ],
    ...bundle.hourly.slice(0, 24).map((h) => [
      escapeCsvCell(h.localHourLabel),
      escapeCsvCell(h.localDateLabel),
      String(formatTempValue(h.temperatureC, units)),
      String(formatTempValue(h.feelsLikeC, units)),
      String(h.precipProb),
      String(formatPrecipValue(h.precipMm, units)),
      String(formatSpeedValue(h.windSpeedKmh, units)),
      String(h.relativeHumidity),
      String(Math.round(h.pressureHpa)),
      escapeCsvCell(h.conditionDescription),
    ]),
  ];
  triggerCsvDownload(`maindgo-24h-${slug}.csv`, rows);
}

export function exportDailyTelemetryCsv(bundle: LocationWeatherBundle, units: UnitSystem): void {
  const slug = bundle.current.locationName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'location';
  const rows: string[][] = [
    [
      'Day',
      'Date',
      `High (${tempUnitLabel(units)})`,
      `Low (${tempUnitLabel(units)})`,
      'Precip Prob (%)',
      `Precip (${precipUnitLabel(units)})`,
      `Wind (${speedUnitLabel(units)})`,
      'Humidity (%)',
      'UV Max',
      'Condition',
    ],
    ...bundle.daily.map((d) => [
      escapeCsvCell(d.dayName),
      escapeCsvCell(d.dateShort),
      String(formatTempValue(d.maxTempC, units)),
      String(formatTempValue(d.minTempC, units)),
      String(d.precipProb),
      String(formatPrecipValue(d.precipMm, units)),
      String(formatSpeedValue(d.windSpeedKmh, units)),
      String(d.relativeHumidity),
      String(d.uvIndexMax),
      escapeCsvCell(d.conditionDescription),
    ]),
  ];
  triggerCsvDownload(`maindgo-10day-${slug}.csv`, rows);
}
