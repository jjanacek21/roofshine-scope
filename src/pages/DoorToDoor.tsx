import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin } from "lucide-react";
import { DoorToDoorMap } from "@/components/door-to-door/DoorToDoorMap";
import { SessionControls } from "@/components/door-to-door/SessionControls";
import { SessionStats } from "@/components/door-to-door/SessionStats";
import { PropertySidePanel } from "@/components/door-to-door/PropertySidePanel";
import { VideoVerificationModal } from "@/components/door-to-door/VideoVerificationModal";
import { PreSessionGoalVideo } from "@/components/door-to-door/PreSessionGoalVideo";
import { ProgressVideoModal } from "@/components/door-to-door/ProgressVideoModal";
import { FeedSidebar } from "@/components/door-to-door/FeedSidebar";
import { useDoorToDoorSession, type DoorDisposition } from "@/hooks/useDoorToDoorSession";
import { usePropertyDispositions, generateLatLngHash, type PropertyDisposition } from "@/hooks/usePropertyDispositions";
import { useGPSTracking } from "@/hooks/useGPSTracking";
import { useSessionGoals } from "@/hooks/useSessionGoals";
import { toast } from "sonner";

const VIDEO_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
const PROGRESS_VIDEO_INTERVAL = 60 * 60 * 1000; // 1 hour

interface SelectedProperty {
  lat: number;
  lng: number;
  address?: string;
  disposition?: PropertyDisposition;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  notes?: string;
}

export default function DoorToDoor() {
  const navigate = useNavigate();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [selectedStormId, setSelectedStormId] = useState<string | null>(null);
  
  // Side panel state
  const [selectedProperty, setSelectedProperty] = useState<SelectedProperty | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // Video modal states
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showGoalVideo, setShowGoalVideo] = useState(false);
  const [showProgressVideo, setShowProgressVideo] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [lastVideoCheck, setLastVideoCheck] = useState<number>(Date.now());
  const [pendingSessionStart, setPendingSessionStart] = useState(false);

  // Session hook
  const {
    activeSession,
    doorKnocks,
    stats,
    loading: sessionLoading,
    startSession,
    endSession,
    recordDoorKnock,
    recordVideoVerification,
    updateRoute,
    saveLocation
  } = useDoorToDoorSession(userId || undefined);

  // Property dispositions hook
  const {
    properties,
    loading: propertiesLoading,
    fetchPropertiesInBounds,
    setPropertyDisposition,
    generatePropertyGrid,
  } = usePropertyDispositions(userId || undefined);

  // Session goals hook
  const {
    goals: sessionGoals,
    progressVideos,
    hasSetGoals,
    currentGoals,
    nextUpdateNumber,
    isProgressVideoDue,
    recordProgressVideo
  } = useSessionGoals(userId || undefined, activeSession?.id);

  // GPS tracking hook
  const {
    position,
    error: gpsError,
    route,
    startTracking,
    stopTracking,
    clearRoute,
  } = useGPSTracking({
    onPositionChange: (pos) => {
      if (activeSession) {
        saveLocation(pos.lat, pos.lng, pos.accuracy);
      }
    },
    saveInterval: 5000
  });

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/network-login');
        return;
      }
      setUserId(user.id);
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  // Update route in DB
  useEffect(() => {
    if (activeSession && route.length > 0) {
      updateRoute(route);
    }
  }, [route, activeSession]);

  // Video check timer (30-minute verification)
  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastVideoCheck >= VIDEO_CHECK_INTERVAL) {
        setShowVideoModal(true);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [activeSession, lastVideoCheck]);

  // Hourly progress video check
  useEffect(() => {
    if (!activeSession || !sessionStartTime || !hasSetGoals) return;

    const interval = setInterval(() => {
      if (isProgressVideoDue(sessionStartTime)) {
        setShowProgressVideo(true);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [activeSession, sessionStartTime, hasSetGoals, isProgressVideoDue]);

  // Handle bounds change - fetch properties and generate grid
  const handleBoundsChange = useCallback(async (bounds: { north: number; south: number; east: number; west: number }) => {
    if (!userId) return;

    // Fetch existing dispositions
    const existingProperties = await fetchPropertiesInBounds(bounds);
    
    // Generate grid points for the visible area (only if we don't have many existing)
    if ((existingProperties?.length || 0) < 50) {
      const gridPoints = generatePropertyGrid(bounds, 0.0003); // ~30 meter spacing
      
      // Add grid points that don't already exist
      const existingHashes = new Set((existingProperties || []).map(p => p.latLngHash));
      const newPoints = gridPoints
        .filter(p => !existingHashes.has(p.latLngHash))
        .slice(0, 100); // Limit to 100 new points per view
      
      // Create placeholder properties for grid points
      for (const point of newPoints) {
        await setPropertyDisposition(point.lat, point.lng, 'not_contacted', {});
      }
    }
  }, [userId, fetchPropertiesInBounds, generatePropertyGrid, setPropertyDisposition]);

  // Handle start session - start first, then show goal video
  const handleStartSession = async () => {
    try {
      const session = await startSession();
      if (session) {
        // Link storm event to session if selected
        if (selectedStormId) {
          await supabase
            .from('field_sessions')
            .update({ storm_event_id: selectedStormId } as any)
            .eq('id', session.id);
        }
        startTracking();
        setSessionStartTime(new Date());
        setLastVideoCheck(Date.now());
        // Show goal video after session is created
        setPendingSessionStart(true);
        setShowGoalVideo(true);
      } else {
        toast.error("Session Error", { description: "Could not start session. Please try again." });
      }
    } catch (error) {
      console.error('Session start error:', error);
      toast.error("Error", { description: "Failed to start session. Check your connection." });
    }
  };

  // Called after goal video is completed
  const handleGoalVideoComplete = async (goals: { doors: number; leads: number }, videoUrl: string) => {
    setShowGoalVideo(false);
    setPendingSessionStart(false);
    toast({
      title: "🎯 Goals Set!",
      description: `Let's hit ${goals.doors} doors and ${goals.leads} leads!`,
    });
  };

  // Handle goal video cancel - session continues without goals
  const handleGoalVideoCancel = () => {
    setShowGoalVideo(false);
    setPendingSessionStart(false);
    toast.success("Session Started", { description: "You can still record a goal video anytime!" });
  };

  // Handle end session
  const handleEndSession = async () => {
    await endSession();
    stopTracking();
    clearRoute();
    setSessionStartTime(null);
  };

  // Handle progress video upload
  const handleProgressVideoUpload = async (videoUrl: string, points: number): Promise<boolean> => {
    const success = await recordProgressVideo(videoUrl, 0, 'progress', points);
    return success;
  };

  // Handle property click from map
  const handlePropertyClick = (property: { lat: number; lng: number; address?: string; existingData?: any }) => {
    setSelectedProperty({
      lat: property.lat,
      lng: property.lng,
      address: property.address,
      disposition: property.existingData?.disposition || 'not_contacted',
      customerName: property.existingData?.customerName,
      customerPhone: property.existingData?.customerPhone,
      customerEmail: property.existingData?.customerEmail,
      notes: property.existingData?.notes,
    });
    setIsPanelOpen(true);
  };

  // Handle map click (for adding new property markers)
  const handleMapClick = async (lat: number, lng: number) => {
    // Create a new property marker at this location
    await setPropertyDisposition(lat, lng, 'not_contacted', {});
    
    // Open the panel for this new property
    setSelectedProperty({
      lat,
      lng,
      disposition: 'not_contacted',
    });
    setIsPanelOpen(true);
  };

  // Handle disposition save from panel
  const handleSaveDisposition = async (
    disposition: PropertyDisposition,
    customerInfo: { name?: string; phone?: string; email?: string; notes?: string },
    extraData?: {
      roofType?: string;
      roofCondition?: string;
      insuranceClaim?: boolean;
      stormDate?: string;
      priority?: string;
      tags?: string[];
    }
  ) => {
    if (!selectedProperty) return;

    await setPropertyDisposition(
      selectedProperty.lat,
      selectedProperty.lng,
      disposition,
      customerInfo,
      selectedProperty.address,
      activeSession?.id,
      extraData
    );

    // Also record as a door knock for session tracking
    if (activeSession && disposition !== 'not_contacted') {
      await recordDoorKnock(
        selectedProperty.lat,
        selectedProperty.lng,
        disposition as DoorDisposition,
        0, // No dwell time for this workflow
        customerInfo.name || customerInfo.phone || customerInfo.email ? {
          name: customerInfo.name || '',
          phone: customerInfo.phone,
          email: customerInfo.email,
        } : undefined,
        customerInfo.notes
      );
    }

    // Update selected property state
    setSelectedProperty(prev => prev ? {
      ...prev,
      disposition,
      customerName: customerInfo.name,
      customerPhone: customerInfo.phone,
      customerEmail: customerInfo.email,
      notes: customerInfo.notes,
      ...extraData,
    } : null);

    toast({
      title: "Saved",
      description: `Property marked as ${disposition.replace(/_/g, ' ')}`,
    });
  };

  // Handle video upload
  const handleVideoUpload = async (videoUrl: string, duration: number) => {
    const success = await recordVideoVerification(videoUrl, duration);
    if (success) {
      setLastVideoCheck(Date.now());
    }
    return success;
  };

  // Handle knock door button
  const handleKnockDoor = async () => {
    if (!position) {
      toast.error("GPS Required", { description: "Please wait for GPS lock" });
      return;
    }
    handleMapClick(position.lat, position.lng);
  };

  if (loading || sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-muted-foreground">Loading Door to Door...</p>
        </div>
      </div>
    );
  }

  // Count leads from doorKnocks
  const leadsCount = doorKnocks.filter(k => 
    ['interested', 'need_inspection', 'canvass_lead', 'new_roof', 'opportunity', 'inspected', 'won'].includes(k.disposition)
  ).length;

  return (
    <div className="h-screen w-full relative overflow-hidden">
      {/* Back Button */}
      <div className="fixed top-4 left-4 z-50">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => navigate('/member/dashboard')}
          className="rounded-full shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Feed Sidebar - integrated on map */}
      <FeedSidebar
        userId={userId || undefined}
        isOpen={showFeed}
        onToggle={() => setShowFeed(!showFeed)}
      />

      {/* Session Stats */}
      <SessionStats
        session={activeSession}
        allTimeStats={stats}
        sessionStartTime={sessionStartTime || undefined}
        selectedStormId={selectedStormId}
        onStormChange={setSelectedStormId}
      />

      {/* Goals Progress Bar (during active session) */}
      {activeSession && hasSetGoals && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Doors</span>
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 transition-all" 
                style={{ width: `${Math.min((doorKnocks.length / currentGoals.doors) * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold">{doorKnocks.length}/{currentGoals.doors}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Leads</span>
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all" 
                style={{ width: `${Math.min((leadsCount / currentGoals.leads) * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold">{leadsCount}/{currentGoals.leads}</span>
          </div>
        </div>
      )}

      {/* GPS Error Banner */}
      {gpsError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-destructive text-destructive-foreground rounded-full text-sm font-medium shadow-lg flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {gpsError}
          <Button 
            variant="ghost" 
            size="sm" 
            className="ml-2 h-6 px-2 text-xs"
            onClick={() => {
              toast.success("GPS Permission Required", { description: "Please enable location access in your browser settings and refresh the page." });
            }}
          >
            Help
          </Button>
        </div>
      )}

      {/* Map */}
      <DoorToDoorMap
        position={position}
        route={route}
        doorKnocks={doorKnocks}
        properties={properties}
        onMapClick={handleMapClick}
        onPropertyClick={handlePropertyClick}
        isSessionActive={!!activeSession}
        onBoundsChange={handleBoundsChange}
      />

      {/* Session Controls */}
      <SessionControls
        isActive={!!activeSession}
        onStart={handleStartSession}
        onStop={handleEndSession}
        onKnockDoor={handleKnockDoor}
        canKnock={!!position}
      />

      {/* Property Side Panel */}
      <PropertySidePanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        property={selectedProperty}
        onSave={handleSaveDisposition}
        loading={propertiesLoading}
        userId={userId || undefined}
        sessionId={activeSession?.id}
      />

      {/* Pre-Session Goal Video Modal */}
      {userId && activeSession && pendingSessionStart && (
        <PreSessionGoalVideo
          isOpen={showGoalVideo}
          onComplete={handleGoalVideoComplete}
          onCancel={handleGoalVideoCancel}
          userId={userId}
          sessionId={activeSession.id}
        />
      )}

      {/* Hourly Progress Video Modal */}
      {activeSession && userId && hasSetGoals && (
        <ProgressVideoModal
          isOpen={showProgressVideo}
          onClose={() => setShowProgressVideo(false)}
          onUpload={handleProgressVideoUpload}
          userId={userId}
          sessionId={activeSession.id}
          updateNumber={nextUpdateNumber}
          currentDoors={doorKnocks.length}
          currentLeads={leadsCount}
          goalsDoors={currentGoals.doors}
          goalsLeads={currentGoals.leads}
        />
      )}

      {/* Video Verification Modal (30-min check-in) */}
      {activeSession && userId && (
        <VideoVerificationModal
          isOpen={showVideoModal}
          onClose={() => setShowVideoModal(false)}
          onUpload={handleVideoUpload}
          sessionId={activeSession.id}
          userId={userId}
        />
      )}
    </div>
  );
}
