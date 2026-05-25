// Unified Roof Measurement Engine
// Single source of truth for all measurement calculations

// ===== PITCH OPTIONS (User-Selectable with Images) =====
export const PITCH_OPTIONS = [
  { id: 'flat', label: 'Flat (0-2/12)', multiplier: 1.00, image: '/roof-pitch-flat.svg', description: 'Little to no slope' },
  { id: 'low', label: 'Low Slope (3-4/12)', multiplier: 1.05, image: '/roof-pitch-low.svg', description: 'Slight angle' },
  { id: 'standard', label: 'Standard (5-6/12)', multiplier: 1.12, image: '/roof-pitch-standard.svg', description: 'Most common residential' },
  { id: 'steep', label: 'Steep (7-8/12)', multiplier: 1.20, image: '/roof-pitch-steep.svg', description: 'Noticeable steep angle' },
  { id: 'verysteep', label: 'Very Steep (9-12/12)', multiplier: 1.30, image: '/roof-pitch-verysteep.svg', description: 'Cathedral-style steep' },
] as const;

// ===== COMPLEXITY OPTIONS (User-Selectable with Images) =====
export const COMPLEXITY_OPTIONS = {
  coating: [
    { id: 'simple', label: 'Simple', wastePct: 0.05, image: '/roof-simple.svg', description: 'Flat or low-slope roof' },
  ],
  reroof: [
    { id: 'gable', label: 'Gable (2-Sided)', wastePct: 0.10, image: '/roof-gable.svg', description: '2 sloping sides meeting at ridge' },
    { id: 'hip', label: 'Hip (4-Sided)', wastePct: 0.12, image: '/roof-hip.svg', description: '4 sloping sides meeting at ridge' },
    { id: 'complex', label: '10+ Facets', wastePct: 0.15, image: '/roof-complex.svg', description: 'Multiple valleys, hips, dormers' },
    { id: 'verycomplex', label: '20+ Facets', wastePct: 0.17, image: '/roof-complex.svg', description: 'Many facets, cut-ups, intricate' },
  ],
} as const;

// ===== TYPES =====
export type PitchBucket = 'flat' | 'low' | 'standard' | 'steep' | 'verysteep';
export type ComplexityLevel = 'simple' | 'gable' | 'hip' | 'complex' | 'verycomplex';
export type ServiceType = 'coating' | 'reroof';
export type Confidence = 'high' | 'medium' | 'low';

export interface MeasurementInput {
  baseSqFt: number;
  serviceType: ServiceType;
  pitchBucket: PitchBucket;
  complexity: ComplexityLevel;
}

export interface MeasurementOutput {
  baseSqFt: number;
  pitchMultiplier: number;
  trueSqft: number;
  wastePct: number;
  totalWithWaste: number;
  squares: number;
}

export interface MeasurementResult extends MeasurementOutput {
  address: string;
  coordinates: { lat: number; lng: number };
  confidence: Confidence;
  methodology?: string;
  pitchBucket: PitchBucket;
  complexity: ComplexityLevel;
}

// ===== HELPER FUNCTIONS =====

export function getPitchMultiplier(pitchBucket: PitchBucket): number {
  const option = PITCH_OPTIONS.find(p => p.id === pitchBucket);
  return option?.multiplier ?? 1.0;
}

export function getWastePct(serviceType: ServiceType, complexity: ComplexityLevel): number {
  if (serviceType === 'coating') {
    return 0.05; // Fixed 5% waste for coatings
  }
  // Reroof waste varies by complexity
  const options = COMPLEXITY_OPTIONS.reroof;
  const option = options.find(o => o.id === complexity);
  return option?.wastePct ?? 0.10;
}

export function getDefaultPitch(serviceType: ServiceType): PitchBucket {
  return serviceType === 'coating' ? 'flat' : 'standard';
}

export function getDefaultComplexity(serviceType: ServiceType): ComplexityLevel {
  return serviceType === 'coating' ? 'simple' : 'gable';
}

export function getPitchLabel(pitch: PitchBucket): string {
  const option = PITCH_OPTIONS.find(p => p.id === pitch);
  return option?.label ?? pitch;
}

export function getComplexityLabel(complexity: ComplexityLevel): string {
  switch (complexity) {
    case 'simple': return 'Simple';
    case 'gable': return 'Gable (2-Sided)';
    case 'hip': return 'Hip (4-Sided)';
    case 'complex': return '10+ Facets';
    case 'verycomplex': return '20+ Facets';
    default: return complexity;
  }
}

export function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case 'high': return 'text-green-600';
    case 'medium': return 'text-yellow-600';
    case 'low': return 'text-red-600';
    default: return 'text-muted-foreground';
  }
}

// ===== UNIFIED CALCULATION (Single Source of Truth) =====
export function calculateMeasurement(input: MeasurementInput): MeasurementOutput {
  const { baseSqFt, serviceType, pitchBucket, complexity } = input;
  
  const pitchMultiplier = getPitchMultiplier(pitchBucket);
  const wastePct = getWastePct(serviceType, complexity);
  
  const trueSqft = Math.round(baseSqFt * pitchMultiplier);
  const totalWithWaste = Math.round(trueSqft * (1 + wastePct));
  const squares = totalWithWaste / 100;
  
  return {
    baseSqFt,
    pitchMultiplier,
    trueSqft,
    wastePct,
    totalWithWaste,
    squares,
  };
}

// ===== LEGACY SUPPORT (for backward compatibility) =====
// These can be removed once all components are migrated

export const PITCH_FACTORS = {
  flat: 1.0,
  lowSlope: 1.05,
  standard: 1.10,
  steep: 1.15,
  veryStep: 1.20
} as const;

export const WASTE_FACTORS = {
  flat: 1.05,
  gable: 1.10,
  hip: 1.15,
  complex: 1.20
} as const;

export const COMPLEXITY_FACTORS = {
  flat: 1.0,
  gable: 1.10,
  hip: 1.15,
  complex: 1.17
} as const;

export type RoofComplexity = 'flat' | 'gable' | 'hip' | 'complex';

export interface VisionEstimation {
  estimatedSqft: number;
  estimatedSqftLow: number;
  estimatedSqftHigh: number;
  confidence: Confidence;
  methodology: string;
  roofShape: string;
  roofComplexity: RoofComplexity;
  satelliteImageUrl: string;
}

// Legacy calculation function
export function calculateRoofArea(
  flatArea: number, 
  complexity: RoofComplexity,
  pitchFactor: number = PITCH_FACTORS.standard
): { trueSqft: number; totalWithWaste: number; squares: number } {
  const trueSqft = flatArea * pitchFactor;
  const wasteFactor = WASTE_FACTORS[complexity] || WASTE_FACTORS.flat;
  const totalWithWaste = trueSqft * wasteFactor;
  const squares = totalWithWaste / 100;
  
  return { trueSqft, totalWithWaste, squares };
}

export function applyPitchFactor(
  flatSqft: number, 
  complexity: string
): { adjustedSqft: number; factor: number } {
  const trueSqft = flatSqft * PITCH_FACTORS.standard;
  const complexityFactor = COMPLEXITY_FACTORS[complexity as RoofComplexity] || 1.0;
  
  return {
    adjustedSqft: trueSqft * complexityFactor,
    factor: PITCH_FACTORS.standard * complexityFactor
  };
}

export function getComplexityFactor(complexity: string): string {
  switch (complexity) {
    case 'gable': return '+10%';
    case 'hip': return '+15%';
    case 'complex': return '+17%';
    default: return '';
  }
}

export function degreesToPitchRatio(degrees: number): string {
  const rise = Math.tan(degrees * Math.PI / 180) * 12;
  return `${rise.toFixed(0)}/12`;
}

export function getPitchDegreesFromComplexity(complexity: RoofComplexity): number {
  switch (complexity) {
    case 'flat': return 0;
    case 'gable': return 25;
    case 'hip': return 30;
    case 'complex': return 35;
    default: return 20;
  }
}
