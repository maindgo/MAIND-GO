export type MapLayerMode = 'radar' | 'satellite_ir' | 'wind' | 'temp' | 'aqi';

export type BaseMapStyle = 'hybrid' | 'satellite' | 'roadmap' | 'terrain';

export type UnitSystem = 'METRIC' | 'IMPERIAL';

export type PanelTab = 'overview' | 'hourly' | 'daily' | 'air';

export type AppPage = 'map' | 'saved' | 'vip' | 'account';

export type WeatherSoundId =
  | 'sunny'
  | 'rainy'
  | 'thunderstorm'
  | 'snow'
  | 'windy'
  | 'ocean'
  | 'forest';

export interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  updatedByUid: string;
  updatedAt?: unknown;
}

export type SubscriptionTier = 'FREE' | 'PRO' | 'VIP';

export type PlanId = 'PRO_MONTHLY' | 'VIP_ANNUAL';

export type PaymentMethod = 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CRYPTO';

export type PaymentStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'REJECTED';

export type RefundStatus = 'PENDING_REFUND' | 'REFUNDED' | 'REJECTED';

export interface UserAccount {
  uid: string;
  displayName: string;
  preferredUnits: UnitSystem;
  tier: SubscriptionTier;
  vipConfirmed: boolean;
  pendingPlan: 'NONE' | PlanId;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavedLocation {
  id: string;
  userId: string;
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  isHome: boolean;
  createdAt?: unknown;
}

export interface PaymentRequest {
  requestId: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  planId: PlanId;
  originalAmountInr?: number;
  discountPercent?: number;
  paidAmountInr?: number;
  amountUsd: number;
  paymentMethod: PaymentMethod;
  transactionRef: string;
  payerName: string;
  note: string;
  status: PaymentStatus;
  adminNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RefundRequest {
  refundId: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  paymentRequestId: string;
  planId: PlanId;
  paidAmountInr: number;
  paidAmountUsd: number;
  adminChargePct: number;
  refundPct: number;
  refundAmountInr: number;
  refundAmountUsd: number;
  refundUpiId: string;
  reason: string;
  status: RefundStatus;
  adminNote: string;
  refundTxRef: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InvoiceLineItem {
  description: string;
  amount: string;
}

export interface PurchaseInvoice {
  invoiceId: string;
  invoiceNumber: string;
  paymentRequestId: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  planId: PlanId;
  planName: string;
  originalAmountInr: number;
  discountPercent: number;
  paidAmountInr: number;
  amountUsd: number;
  transactionRef: string;
  issueDate: string;
  billingPeriod: string;
  summaryHeadline: string;
  lineItems: InvoiceLineItem[];
  termsAndConditions: string;
  aiVerificationNote: string;
  sentByAdminEmail: string;
  generatedByAi: boolean;
  createdAt?: unknown;
}

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface WeatherCurrentData {
  locationName: string;
  regionSubtitle: string;
  lat: number;
  lng: number;
  currentTimeIso: string;
  timeZoneId: string;
  isDaytime: boolean;
  conditionType: string;
  conditionDescription: string;
  iconBaseUri?: string;
  temperatureC: number;
  feelsLikeC: number;
  dewPointC: number;
  relativeHumidity: number;
  uvIndex: number;
  precipitationProb: number;
  precipitationMm: number;
  thunderstormProb: number;
  pressureHpa: number;
  windDirectionDeg: number;
  windCardinal: string;
  windSpeedKmh: number;
  windGustKmh: number;
  visibilityKm: number;
  cloudCoverPct: number;
  maxTemp24hC?: number;
  minTemp24hC?: number;
  tempChange24hC?: number;
  sourceName: string;
}

export interface HourlyForecastItem {
  timeIso: string;
  localHourLabel: string;
  localDateLabel: string;
  isDaytime: boolean;
  conditionType: string;
  conditionDescription: string;
  temperatureC: number;
  feelsLikeC: number;
  precipProb: number;
  precipMm: number;
  windSpeedKmh: number;
  windGustKmh: number;
  windDirectionDeg: number;
  windCardinal: string;
  relativeHumidity: number;
  uvIndex: number;
  cloudCoverPct: number;
  pressureHpa: number;
}

export interface DailyForecastItem {
  dateIso: string;
  dayName: string;
  dateShort: string;
  conditionType: string;
  conditionDescription: string;
  maxTempC: number;
  minTempC: number;
  precipProb: number;
  precipMm: number;
  windSpeedKmh: number;
  uvIndexMax: number;
  relativeHumidity: number;
  sunriseIso?: string;
  sunsetIso?: string;
  moonPhase?: string;
}

export interface WeatherAlertItem {
  alertId: string;
  title: string;
  eventType: string;
  areaName: string;
  severity: string;
  urgency: string;
  certainty: string;
  description?: string;
  instruction?: string[];
  safetyRecommendations?: Array<{
    directive: string;
    subtext?: string;
  }>;
  startTimeIso?: string;
  expirationTimeIso?: string;
  dataSource: {
    publisher: string;
    name: string;
    authorityUri: string;
  };
}

export interface PollutantReading {
  code: string;
  displayName: string;
  fullName: string;
  value: number;
  units: string;
  sources?: string;
  effects?: string;
}

export interface AirQualityData {
  dateTimeIso: string;
  regionCode?: string;
  aqi: number;
  aqiDisplay: string;
  indexName: string;
  category: string;
  dominantPollutant: string;
  colorCss: string;
  pollutants: PollutantReading[];
  healthRecommendations?: {
    generalPopulation?: string;
    elderly?: string;
    athletes?: string;
    children?: string;
    lungDiseasePopulation?: string;
    heartDiseasePopulation?: string;
  };
  sourceName: string;
}

export interface LocationWeatherBundle {
  current: WeatherCurrentData;
  hourly: HourlyForecastItem[];
  daily: DailyForecastItem[];
  alerts: WeatherAlertItem[];
  airQuality: AirQualityData | null;
}

export interface StationWeatherPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  temperatureC: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  conditionType: string;
  conditionDescription: string;
  isDaytime: boolean;
}

export interface RainViewerFrame {
  time: number;
  path: string;
  isForecast: boolean;
}

export interface RainViewerData {
  host: string;
  radar: RainViewerFrame[];
  satellite: RainViewerFrame[];
}

export interface WindGridSample {
  lat: number;
  lng: number;
  speedKmh: number;
  directionDeg: number;
}
