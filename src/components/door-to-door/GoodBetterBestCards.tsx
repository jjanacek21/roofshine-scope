import { Check, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

interface GoodBetterBestCardsProps {
  pricing: Pricing;
  squares: number;
  onSelect: (pkg: TierPricing, tier: 'good' | 'better' | 'best') => void;
  selectedTier?: 'good' | 'better' | 'best' | null;
  compact?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function PricingCard({
  tier,
  tierKey,
  onSelect,
  isSelected,
  compact
}: {
  tier: TierPricing;
  tierKey: 'good' | 'better' | 'best';
  onSelect: () => void;
  isSelected: boolean;
  compact: boolean;
}) {
  const tierLabels = {
    good: 'Good',
    better: 'Better',
    best: 'Best'
  };

  const tierColors = {
    good: 'bg-amber-500 text-white',
    better: 'bg-primary text-primary-foreground',
    best: 'bg-slate-700 text-white'
  };

  const cardStyles = {
    good: 'border-amber-200 bg-amber-50/30 dark:bg-amber-950/20',
    better: 'border-primary ring-2 ring-primary/20 bg-primary/5',
    best: 'border-slate-300 bg-slate-50/50 dark:bg-slate-800/30'
  };

  return (
    <Card 
      className={cn(
        "relative cursor-pointer transition-all hover:shadow-lg",
        cardStyles[tierKey],
        isSelected && "ring-2 ring-offset-2 ring-primary"
      )}
      onClick={onSelect}
    >
      {tier.isPopular && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
          <Badge className="bg-primary text-primary-foreground flex items-center gap-1 shadow-sm">
            <Star className="w-3 h-3 fill-current" />
            Most Popular
          </Badge>
        </div>
      )}
      
      <CardHeader className={cn("pb-2", compact && "p-3")}>
        <div className="flex items-center justify-between">
          <Badge className={cn("w-fit", tierColors[tierKey])}>
            {tierLabels[tierKey]}
          </Badge>
          {isSelected && (
            <Check className="w-5 h-5 text-primary" />
          )}
        </div>
        <CardTitle className={cn("text-lg", compact && "text-base")}>
          {tier.packageName}
        </CardTitle>
      </CardHeader>
      
      <CardContent className={cn(compact && "p-3 pt-0")}>
        <div className="mb-3">
          <div className={cn("font-bold text-foreground", compact ? "text-lg" : "text-2xl")}>
            {formatCurrency(tier.totalLow)}
            <span className="text-muted-foreground font-normal text-sm"> - </span>
            {formatCurrency(tier.totalHigh)}
          </div>
          <p className="text-xs text-muted-foreground">
            ${tier.pricePerSquare.low}-${tier.pricePerSquare.high}/sq
          </p>
        </div>

        {!compact && (
          <ul className="space-y-1.5 mb-3">
            {tier.features.slice(0, 4).map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        )}

        <p className={cn(
          "text-muted-foreground border-t pt-2 mt-2",
          compact ? "text-[10px]" : "text-xs"
        )}>
          {tier.warranty}
        </p>

        <Button 
          className={cn("w-full mt-3", compact && "h-8 text-xs")}
          variant={isSelected ? "default" : "outline"}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isSelected ? 'Selected' : `Select ${tier.packageName}`}
        </Button>
      </CardContent>
    </Card>
  );
}

export function GoodBetterBestCards({
  pricing,
  squares,
  onSelect,
  selectedTier,
  compact = false
}: GoodBetterBestCardsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pricing Options</h3>
        <span className="text-xs text-muted-foreground">
          {squares} squares
        </span>
      </div>
      
      <div className={cn(
        "grid gap-3",
        compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"
      )}>
        <PricingCard
          tier={pricing.good}
          tierKey="good"
          onSelect={() => onSelect(pricing.good, 'good')}
          isSelected={selectedTier === 'good'}
          compact={compact}
        />
        <PricingCard
          tier={pricing.better}
          tierKey="better"
          onSelect={() => onSelect(pricing.better, 'better')}
          isSelected={selectedTier === 'better'}
          compact={compact}
        />
        <PricingCard
          tier={pricing.best}
          tierKey="best"
          onSelect={() => onSelect(pricing.best, 'best')}
          isSelected={selectedTier === 'best'}
          compact={compact}
        />
      </div>
    </div>
  );
}
