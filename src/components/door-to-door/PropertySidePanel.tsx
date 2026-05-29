import { useState, useEffect } from 'react';
import { X, MapPin, Home, FileText, Image, Tag, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { DispositionQuickBar, getDispositionColor, getDispositionConfig } from './DispositionQuickBar';
import { DispositionVideoModal, isHighValueDisposition } from './DispositionVideoModal';
import { PropertyResidents } from './PropertyResidents';
import { PropertyPhotos } from './PropertyPhotos';
import { PropertyTags } from './PropertyTags';
import { NotesHistory } from './NotesHistory';
import { InstantQuoteSection } from './InstantQuoteSection';
import type { PropertyDisposition, PropertyData } from '@/hooks/usePropertyDispositions';
import { cn } from '@/lib/utils';
import { useMapboxToken } from '@/hooks/useMapboxToken';

interface PropertySidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  property: {
    lat: number;
    lng: number;
    address?: string;
    disposition?: PropertyDisposition;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    notes?: string;
    id?: string;
    roofType?: string;
    roofCondition?: string;
    insuranceClaim?: boolean;
    stormDate?: string;
    priority?: string;
    tags?: string[];
  } | null;
  onSave: (
    disposition: PropertyDisposition,
    customerInfo: {
      name?: string;
      phone?: string;
      email?: string;
      notes?: string;
    },
    extraData?: {
      roofType?: string;
      roofCondition?: string;
      insuranceClaim?: boolean;
      stormDate?: string;
      priority?: string;
      tags?: string[];
    }
  ) => void;
  loading?: boolean;
  userId?: string;
  sessionId?: string;
}

export function PropertySidePanel({
  isOpen,
  onClose,
  property,
  onSave,
  loading,
  userId,
  sessionId
}: PropertySidePanelProps) {
  const [disposition, setDisposition] = useState<PropertyDisposition>('not_contacted');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [roofType, setRoofType] = useState('');
  const [roofCondition, setRoofCondition] = useState('');
  const [insuranceClaim, setInsuranceClaim] = useState(false);
  const [stormDate, setStormDate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [tags, setTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('disposition');
  
  // Video verification state
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [pendingDisposition, setPendingDisposition] = useState<PropertyDisposition | null>(null);

  // Reverse-geocoded address (used when property.address is missing)
  const { data: mapboxToken } = useMapboxToken();
  const [resolvedAddress, setResolvedAddress] = useState<string | undefined>(undefined);

  useEffect(() => {
    setResolvedAddress(undefined);
    if (!property || property.address || !mapboxToken) return;
    let cancelled = false;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${property.lng},${property.lat}.json?access_token=${mapboxToken}&types=address&limit=1`;
    fetch(url)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (cancelled) return;
        const place = j?.features?.[0]?.place_name as string | undefined;
        if (place) setResolvedAddress(place);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [property?.lat, property?.lng, property?.address, mapboxToken]);


  // Update form when property changes
  useEffect(() => {
    if (property) {
      setDisposition(property.disposition || 'not_contacted');
      setCustomerName(property.customerName || '');
      setCustomerPhone(property.customerPhone || '');
      setCustomerEmail(property.customerEmail || '');
      setNotes(property.notes || '');
      setRoofType(property.roofType || '');
      setRoofCondition(property.roofCondition || '');
      setInsuranceClaim(property.insuranceClaim || false);
      setStormDate(property.stormDate || '');
      setPriority(property.priority || 'normal');
      setTags(property.tags || []);
      setActiveTab('disposition');
    }
  }, [property]);

  const handleDispositionSelect = (newDisposition: PropertyDisposition) => {
    const config = getDispositionConfig(newDisposition);
    const basePoints = config?.points || 0;
    
    // Check if this is a high-value disposition that needs video verification
    if (isHighValueDisposition(newDisposition) && userId) {
      setPendingDisposition(newDisposition);
      setShowVideoModal(true);
      return;
    }
    
    // Regular disposition - save immediately
    setDisposition(newDisposition);
    onSave(newDisposition, {
      name: customerName || undefined,
      phone: customerPhone || undefined,
      email: customerEmail || undefined,
      notes: notes || undefined,
    }, {
      roofType: roofType || undefined,
      roofCondition: roofCondition || undefined,
      insuranceClaim,
      stormDate: stormDate || undefined,
      priority,
      tags,
    });
  };

  const handleVideoComplete = (pointsAwarded: number, videoUrl?: string) => {
    if (pendingDisposition) {
      setDisposition(pendingDisposition);
      onSave(pendingDisposition, {
        name: customerName || undefined,
        phone: customerPhone || undefined,
        email: customerEmail || undefined,
        notes: notes || undefined,
      }, {
        roofType: roofType || undefined,
        roofCondition: roofCondition || undefined,
        insuranceClaim,
        stormDate: stormDate || undefined,
        priority,
        tags,
      });
    }
    setShowVideoModal(false);
    setPendingDisposition(null);
  };

  const handleVideoSkip = () => {
    // User skipped video - save with base points (1x)
    if (pendingDisposition) {
      setDisposition(pendingDisposition);
      onSave(pendingDisposition, {
        name: customerName || undefined,
        phone: customerPhone || undefined,
        email: customerEmail || undefined,
        notes: notes || undefined,
      }, {
        roofType: roofType || undefined,
        roofCondition: roofCondition || undefined,
        insuranceClaim,
        stormDate: stormDate || undefined,
        priority,
        tags,
      });
    }
    setShowVideoModal(false);
    setPendingDisposition(null);
  };

  const handleSaveDetails = () => {
    onSave(disposition, {
      name: customerName || undefined,
      phone: customerPhone || undefined,
      email: customerEmail || undefined,
      notes: notes || undefined,
    }, {
      roofType: roofType || undefined,
      roofCondition: roofCondition || undefined,
      insuranceClaim,
      stormDate: stormDate || undefined,
      priority,
      tags,
    });
  };

  if (!property) return null;

  const dispositionConfig = getDispositionConfig(disposition);

  return (
    <>
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/20 z-40 transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      
      {/* Panel */}
      <div 
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[420px] bg-background shadow-2xl z-50 transition-transform duration-200 ease-out overflow-hidden flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b bg-muted/30">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div 
                className="w-4 h-4 rounded-full border-2"
                style={{ 
                  borderColor: getDispositionColor(disposition),
                  backgroundColor: disposition !== 'not_contacted' 
                    ? getDispositionColor(disposition) 
                    : 'transparent'
                }}
              />
              <span 
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: getDispositionColor(disposition) }}
              >
                {dispositionConfig?.label || disposition.replace(/_/g, ' ')}
              </span>
              {dispositionConfig?.points && dispositionConfig.points > 0 && (
                <span className="text-xs text-muted-foreground">
                  +{dispositionConfig.points} pts
                </span>
              )}
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm leading-tight">
                  {property.address || 'Unknown Address'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {property.lat.toFixed(5)}, {property.lng.toFixed(5)}
                </p>
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start px-4 pt-2 bg-transparent border-b rounded-none h-auto gap-0">
            <TabsTrigger value="disposition" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              <Home className="w-4 h-4 mr-1" />
              Status
            </TabsTrigger>
            <TabsTrigger value="details" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              <FileText className="w-4 h-4 mr-1" />
              Details
            </TabsTrigger>
            <TabsTrigger value="photos" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              <Image className="w-4 h-4 mr-1" />
              Photos
            </TabsTrigger>
            <TabsTrigger value="notes" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              <MessageSquare className="w-4 h-4 mr-1" />
              Notes
            </TabsTrigger>
          </TabsList>

          {/* Tab Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            {/* Disposition Tab */}
            <TabsContent value="disposition" className="m-0 p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">Quick Disposition</h3>
                <DispositionQuickBar 
                  currentDisposition={disposition}
                  onSelect={handleDispositionSelect}
                  disabled={loading}
                  compact
                />
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label className="text-xs">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Tags
                </Label>
                <PropertyTags 
                  tags={tags} 
                  onChange={setTags}
                  disabled={loading}
                />
              </div>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="m-0 p-4 space-y-4">
              {/* Residents */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Residents</h3>
                <PropertyResidents
                  propertyId={property.id}
                  userId={userId}
                  initialName={customerName}
                  initialPhone={customerPhone}
                  initialEmail={customerEmail}
                />
              </div>

              {/* Project Info */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-semibold">Project Info</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Roof Type</Label>
                    <Select value={roofType} onValueChange={setRoofType}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shingle">Shingle</SelectItem>
                        <SelectItem value="tile">Tile</SelectItem>
                        <SelectItem value="metal">Metal</SelectItem>
                        <SelectItem value="flat">Flat</SelectItem>
                        <SelectItem value="slate">Slate</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs">Roof Condition</Label>
                    <Select value={roofCondition} onValueChange={setRoofCondition}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Insurance Claim</Label>
                  <Switch
                    checked={insuranceClaim}
                    onCheckedChange={setInsuranceClaim}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Storm Date</Label>
                  <Input
                    type="date"
                    value={stormDate}
                    onChange={(e) => setStormDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Instant Quote Section */}
              <div className="pt-4 border-t">
                <InstantQuoteSection
                  propertyId={property.id}
                  lat={property.lat}
                  lng={property.lng}
                  address={property.address}
                  onPackageSelect={(pkg, tier, measurement) => {
                    console.log('Package selected:', tier, pkg, measurement);
                    // Could save to property or navigate to proposal creation
                  }}
                />
              </div>
            </TabsContent>

            {/* Photos Tab */}
            <TabsContent value="photos" className="m-0 p-4">
              <PropertyPhotos
                propertyId={property.id}
                userId={userId}
              />
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="m-0 p-4">
              <NotesHistory
                propertyId={property.id}
                userId={userId}
                currentNote={notes}
                onCurrentNoteChange={setNotes}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30">
          <Button 
            onClick={handleSaveDetails}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Saving...' : 'Save Details'}
          </Button>
        </div>
      </div>

      {/* Video Verification Modal */}
      {pendingDisposition && userId && (
        <DispositionVideoModal
          isOpen={showVideoModal}
          onClose={() => {
            setShowVideoModal(false);
            setPendingDisposition(null);
          }}
          disposition={pendingDisposition}
          basePoints={getDispositionConfig(pendingDisposition)?.points || 0}
          userId={userId}
          sessionId={sessionId}
          propertyAddress={property?.address}
          onComplete={handleVideoComplete}
          onSkip={handleVideoSkip}
        />
      )}
    </>
  );
}
