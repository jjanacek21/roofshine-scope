import { useState, useEffect, useCallback } from 'react';
import { Zap, Loader2, RefreshCw, Calculator, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { PitchSelector } from '@/components/shared/PitchSelector';
import { GoodBetterBestCards } from './GoodBetterBestCards';
import { 
  PITCH_OPTIONS, 
  COMPLEXITY_OPTIONS,
  getPitchMultiplier,
  getWastePct,
  type PitchBucket, 
  type ComplexityLevel 
} from '@/lib/roofMeasurements';
import { cn } from '@/lib/utils';

interface MeasurementData {
  baseSqFt: number;
  pitchMultiplier: number;
  trueSqft: number;
  wastePct: number;
  totalWithWaste: number;
  squares: number;
  confidence: string;
  roofShape?: string;
  roofColor?: string;
  satelliteImageUrl?: string;
}

interface TierPricing {
  packageId: string;
  packageName: string;
  pricePerSquare: { low: number; high: number };
  totalLow: number;
  totalHigh: number;
  features: string[];
  warranty: string;
  color: string;
  isPopular?: boolean;
}

interface Pricing {
  good: TierPricing;
  better: TierPricing;
  best: TierPricing;
}

interface InstantQuoteSectionProps {
  propertyId?: string;
  lat: number;
  lng: number;
  address?: string;
  onPackageSelect?: (pkg: TierPricing, tier: string, measurement: MeasurementData) => void;
}

type RoofCategory = 'shingle' | 'metal' | 'tile';

export function InstantQuoteSection({
  propertyId,
  lat,
  lng,
  address,
  onPackageSelect
}: InstantQuoteSectionProps) {
  const [measurement, setMeasurement] = useState<MeasurementData | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [pitch, setPitch] = useState<PitchBucket>('standard');
  const [complexity, setComplexity] = useState<ComplexityLevel>('gable');
  const [roofCategory, setRoofCategory] = useState<RoofCategory>('shingle');
  const [selectedTier, setSelectedTier] = useState<'good' | 'better' | 'best' | null>(null);

  const getInstantEstimate = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('instant-roof-estimate', {
        body: { 
          latitude: lat, 
          longitude: lng, 
          address: address || `${lat}, ${lng}`, 
          pitchBucket: pitch, 
          complexity,
          roofCategory,
          zoomLevel: 19
        }
      });

      if (fnError) throw fnError;
      
      if (data?.success) {
        setMeasurement(data.measurement);
        setPricing(data.pricing);
      } else {
        throw new Error(data?.error || 'Failed to get estimate');
      }
    } catch (err: any) {
      console.error('Instant estimate error:', err);
      setError(err.message || 'Failed to get instant estimate');
    } finally {
      setIsLoading(false);
    }
  };

  // Recalculate pricing locally when pitch/complexity/category changes
  const recalculatePricing = useCallback(() => {
    if (!measurement) return;

    const pitchMultiplier = getPitchMultiplier(pitch);
    const wastePct = getWastePct('reroof', complexity);
    
    const trueSqft = Math.round(measurement.baseSqFt * pitchMultiplier);
    const totalWithWaste = Math.round(trueSqft * (1 + wastePct));
    const squares = Math.round((totalWithWaste / 100) * 10) / 10;

    // Update measurement with new calculations
    setMeasurement(prev => prev ? {
      ...prev,
      pitchMultiplier,
      trueSqft,
      wastePct,
      totalWithWaste,
      squares
    } : null);

    // Recalculate pricing with new squares
    if (pricing) {
      const recalcTier = (tier: TierPricing): TierPricing => ({
        ...tier,
        totalLow: Math.round(tier.pricePerSquare.low * squares),
        totalHigh: Math.round(tier.pricePerSquare.high * squares)
      });

      setPricing({
        good: recalcTier(pricing.good),
        better: recalcTier(pricing.better),
        best: recalcTier(pricing.best)
      });
    }
  }, [measurement?.baseSqFt, pitch, complexity, pricing]);

  // Recalculate when pitch or complexity changes
  useEffect(() => {
    if (measurement) {
      recalculatePricing();
    }
  }, [pitch, complexity]);

  // Refetch when category changes (different package set)
  useEffect(() => {
    if (measurement) {
      getInstantEstimate();
    }
  }, [roofCategory]);

  const handlePackageSelect = (pkg: TierPricing, tier: 'good' | 'better' | 'best') => {
    setSelectedTier(tier);
    if (onPackageSelect && measurement) {
      onPackageSelect(pkg, tier, measurement);
    }
  };

  if (!measurement) {
    return (
      <div className="space-y-4">
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Calculator className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Instant Roof Estimate</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get satellite-based measurements and Good/Better/Best pricing instantly
            </p>
            <Button 
              onClick={getInstantEstimate} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Get Instant Quote
                </>
              )}
            </Button>
            {error && (
              <p className="text-sm text-destructive mt-2">{error}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Measurement Summary */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Home className="w-4 h-4" />
              Measurement
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={getInstantEstimate}
              disabled={isLoading}
              className="h-7 px-2"
            >
              <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Base:</span>
              <span className="ml-1 font-medium">{measurement.baseSqFt.toLocaleString()} sf</span>
            </div>
            <div>
              <span className="text-muted-foreground">With Pitch:</span>
              <span className="ml-1 font-medium">{measurement.trueSqft.toLocaleString()} sf</span>
            </div>
            <div>
              <span className="text-muted-foreground">With Waste:</span>
              <span className="ml-1 font-medium">{measurement.totalWithWaste.toLocaleString()} sf</span>
            </div>
            <div>
              <span className="text-muted-foreground">Squares:</span>
              <span className="ml-1 font-medium text-primary">{measurement.squares}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t text-xs text-muted-foreground">
            <span className={cn(
              "px-1.5 py-0.5 rounded",
              measurement.confidence === 'high' && "bg-green-100 text-green-700",
              measurement.confidence === 'medium' && "bg-yellow-100 text-yellow-700",
              measurement.confidence === 'low' && "bg-red-100 text-red-700"
            )}>
              {measurement.confidence} confidence
            </span>
            {measurement.roofShape && (
              <span>{measurement.roofShape}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Roof Category Tabs */}
      <Tabs value={roofCategory} onValueChange={(v) => setRoofCategory(v as RoofCategory)}>
        <TabsList className="w-full">
          <TabsTrigger value="shingle" className="flex-1">Shingle</TabsTrigger>
          <TabsTrigger value="metal" className="flex-1">Metal</TabsTrigger>
          <TabsTrigger value="tile" className="flex-1">Tile</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Pitch Selector */}
      <PitchSelector
        value={pitch}
        onChange={setPitch}
        serviceType="reroof"
      />

      {/* Complexity Selector */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Roof Complexity (Waste Factor)</p>
        <div className="grid grid-cols-4 gap-2">
          {COMPLEXITY_OPTIONS.reroof.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setComplexity(option.id as ComplexityLevel)}
              className={cn(
                "flex flex-col items-center p-2 rounded-lg border-2 transition-all hover:border-primary/50",
                complexity === option.id
                  ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                  : "border-muted bg-background hover:bg-muted/50"
              )}
            >
              <span className="text-xs font-medium text-center leading-tight">
                {option.label.split(' ')[0]}
              </span>
              <span className="text-[10px] text-muted-foreground">
                +{Math.round(option.wastePct * 100)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Good/Better/Best Cards */}
      {pricing && (
        <GoodBetterBestCards
          pricing={pricing}
          squares={measurement.squares}
          onSelect={handlePackageSelect}
          selectedTier={selectedTier}
          compact
        />
      )}
    </div>
  );
}

