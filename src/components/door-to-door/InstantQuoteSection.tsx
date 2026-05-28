import { useState, useEffect, useCallback } from 'react';
import { Calculator, Home, Save, Check, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PitchSelector } from '@/components/shared/PitchSelector';
import { GoodBetterBestCards } from './GoodBetterBestCards';
import {
  COMPLEXITY_OPTIONS,
  type PitchBucket,
  type ComplexityLevel,
} from '@/lib/roofMeasurements';
import { buildMeasurement, buildGBB, type SystemType, type TierPricing, type MeasurementSummary } from '@/lib/d2d-gbb';
import { cn } from '@/lib/utils';

interface InstantQuoteSectionProps {
  propertyId?: string;
  lat: number;
  lng: number;
  address?: string;
  initialMeasurement?: { baseSqFt?: number; squares?: number; pitchBucket?: PitchBucket; complexity?: ComplexityLevel } | null;
  initialSystem?: SystemType | null;
  initialTier?: 'good' | 'better' | 'best' | null;
  onPackageSelect?: (pkg: TierPricing, tier: 'good' | 'better' | 'best', measurement: MeasurementSummary, system: SystemType) => void;
}

export function InstantQuoteSection({
  propertyId,
  initialMeasurement,
  initialSystem,
  initialTier,
  onPackageSelect,
}: InstantQuoteSectionProps) {
  const [baseSqFt, setBaseSqFt] = useState<string>(initialMeasurement?.baseSqFt ? String(initialMeasurement.baseSqFt) : '2000');
  const [pitch, setPitch] = useState<PitchBucket>(initialMeasurement?.pitchBucket ?? 'standard');
  const [complexity, setComplexity] = useState<ComplexityLevel>(initialMeasurement?.complexity ?? 'gable');
  const [system, setSystem] = useState<SystemType>(initialSystem ?? 'shingle');
  const [selectedTier, setSelectedTier] = useState<'good' | 'better' | 'best' | null>(initialTier ?? null);
  const [saving, setSaving] = useState(false);

  const baseNum = Math.max(0, parseInt(baseSqFt || '0', 10) || 0);
  const measurement = buildMeasurement(baseNum, pitch, complexity);
  const pricing = baseNum > 0 ? buildGBB(measurement.squares, system) : null;

  const handlePackageSelect = useCallback(async (pkg: TierPricing, tier: 'good' | 'better' | 'best') => {
    setSelectedTier(tier);
    if (onPackageSelect) onPackageSelect(pkg, tier, measurement, system);

    if (propertyId) {
      setSaving(true);
      const { error } = await supabase
        .from('property_dispositions')
        .update({
          measurement: measurement as any,
          selected_system_type: system,
          selected_tier: tier,
          selected_quote: pkg as any,
        })
        .eq('id', propertyId);
      setSaving(false);
      if (error) {
        toast.error('Could not save quote', { description: error.message });
      } else {
        toast.success(`${pkg.packageName} selected`, { description: `$${pkg.totalLow.toLocaleString()} – $${pkg.totalHigh.toLocaleString()}` });
      }
    }
  }, [measurement, propertyId, system, onPackageSelect]);

  // Reset selection when system changes
  useEffect(() => {
    setSelectedTier(null);
  }, [system]);

  return (
    <div className="space-y-4">
      {/* Measurement input */}
      <Card className="bg-muted/30">
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">Measure & Quote</h4>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Footprint (sq ft)</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={baseSqFt}
                onChange={(e) => setBaseSqFt(e.target.value)}
                className="h-9 font-mono"
                placeholder="2000"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Home className="w-3 h-3" /> Squares
              </Label>
              <div className="h-9 px-3 flex items-center rounded-md border bg-background text-sm font-mono">
                {measurement.squares}
              </div>
            </div>
          </div>

          {/* Pitch */}
          <PitchSelector value={pitch} onChange={setPitch} serviceType="reroof" />

          {/* Complexity */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Roof Complexity (Waste)</p>
            <div className="grid grid-cols-4 gap-2">
              {COMPLEXITY_OPTIONS.reroof.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setComplexity(option.id as ComplexityLevel)}
                  className={cn(
                    'flex flex-col items-center p-2 rounded-lg border-2 transition-all',
                    complexity === option.id
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : 'border-muted bg-background hover:bg-muted/50',
                  )}
                >
                  <span className="text-xs font-medium text-center leading-tight">{option.label.split(' ')[0]}</span>
                  <span className="text-[10px] text-muted-foreground">+{Math.round(option.wastePct * 100)}%</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t">
            <div><span className="text-muted-foreground">Base:</span> <span className="font-mono">{baseNum.toLocaleString()}</span></div>
            <div><span className="text-muted-foreground">Pitch:</span> <span className="font-mono">{measurement.trueSqft.toLocaleString()}</span></div>
            <div><span className="text-muted-foreground">+Waste:</span> <span className="font-mono">{measurement.totalWithWaste.toLocaleString()}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* System Type */}
      <Tabs value={system} onValueChange={(v) => setSystem(v as SystemType)}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="shingle">Shingle</TabsTrigger>
          <TabsTrigger value="tile">Tile</TabsTrigger>
          <TabsTrigger value="metal">Metal</TabsTrigger>
          <TabsTrigger value="flat">Flat</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* GBB */}
      {pricing && (
        <GoodBetterBestCards
          pricing={pricing}
          squares={measurement.squares}
          onSelect={handlePackageSelect}
          selectedTier={selectedTier}
          compact
        />
      )}

      {selectedTier && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          {saving ? <Save className="w-3 h-3 animate-pulse" /> : <Check className="w-3 h-3 text-green-600" />}
          {saving ? 'Saving…' : 'Quote saved to property'}
        </div>
      )}
    </div>
  );
}
