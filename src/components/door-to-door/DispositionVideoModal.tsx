import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Video, Square, Upload, X, Check, MapPin, Home, Users, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { PropertyDisposition } from '@/hooks/usePropertyDispositions';
import { getDispositionConfig } from './DispositionQuickBar';

export type VideoLocationType = 'standard' | 'roof' | 'homeowner';

interface DispositionVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  disposition: PropertyDisposition;
  basePoints: number;
  userId: string;
  sessionId?: string;
  propertyAddress?: string;
  onComplete: (pointsAwarded: number, videoUrl?: string) => void;
  onSkip: () => void;
}

const VIDEO_LOCATIONS: {
  value: VideoLocationType;
  label: string;
  description: string;
  multiplier: number;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: 'standard',
    label: 'Ground Level',
    description: 'Standard verification from street level',
    multiplier: 1,
    icon: MapPin,
  },
  {
    value: 'roof',
    label: 'On the Roof',
    description: 'Recording from on top of the roof',
    multiplier: 2,
    icon: Home,
  },
  {
    value: 'homeowner',
    label: 'With Homeowner',
    description: 'Video with the homeowner present',
    multiplier: 3,
    icon: Users,
  },
];

const MIN_DURATION_SECONDS = 5;

export function DispositionVideoModal({
  isOpen,
  onClose,
  disposition,
  basePoints,
  userId,
  sessionId,
  propertyAddress,
  onComplete,
  onSkip,
}: DispositionVideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [locationType, setLocationType] = useState<VideoLocationType>('standard');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [step, setStep] = useState<'select' | 'record' | 'preview'>('select');

  const selectedLocation = VIDEO_LOCATIONS.find(l => l.value === locationType)!;
  const calculatedPoints = Math.round(basePoints * selectedLocation.multiplier);
  const dispositionConfig = getDispositionConfig(disposition);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setStep('record');
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error('Camera Access Required', { description: 'Please allow camera access to record verification video.' });
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm;codecs=vp8,opus',
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
      setStep('preview');
      
      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);
    setIsRecording(true);
    setRecordingDuration(0);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const retakeVideo = async () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingDuration(0);
    setCameraReady(false);
    await startCamera();
  };

  const uploadAndSave = async () => {
    if (!recordedBlob) return;

    setIsUploading(true);

    try {
      // Upload to storage
      const fileName = `${userId}/${Date.now()}_${locationType}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('door-to-door-videos')
        .upload(fileName, recordedBlob, {
          contentType: 'video/webm',
        });

      if (uploadError) throw uploadError;

      // Get the URL
      const { data: urlData } = supabase.storage
        .from('door-to-door-videos')
        .getPublicUrl(fileName);

      // Use a session ID - create fallback if needed
      let effectiveSessionId = sessionId;
      
      if (!effectiveSessionId) {
        // Create a fallback session for this verification
        const { data: newSession, error: sessionError } = await supabase
          .from('field_sessions')
          .insert({
            user_id: userId,
            started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(),
            is_active: false,
            total_doors: 0,
            total_points: 0,
            status: 'completed',
            goals_doors: 0,
            goals_leads: 0,
          })
          .select('id')
          .single();

        if (sessionError) throw sessionError;
        effectiveSessionId = newSession.id;
      }

      // Save to session_progress_videos
      const { error: dbError } = await supabase
        .from('session_progress_videos')
        .insert({
          session_id: effectiveSessionId,
          user_id: userId,
          video_url: urlData.publicUrl,
          video_duration_seconds: recordingDuration,
          update_number: 1,
          video_type: locationType,
          points_multiplier: selectedLocation.multiplier,
          points_awarded: calculatedPoints,
        });

      if (dbError) throw dbError;

      // Also post to global feed for high-value dispositions
      const locationEmoji = locationType === 'roof' ? '🏠' : locationType === 'homeowner' ? '🤝' : '📍';
      const { error: feedError } = await supabase
        .from('session_feed_posts')
        .insert({
          session_id: effectiveSessionId,
          user_id: userId,
          video_url: urlData.publicUrl,
          video_type: locationType,
          post_type: 'video',
          content: `${dispositionConfig?.label || disposition} at ${propertyAddress || 'a property'}! ${locationEmoji}`,
          points_earned: calculatedPoints,
          doors_knocked: 1,
          leads_gotten: 1,
        });

      if (feedError) {
        console.error('Feed post error:', feedError);
        // Don't throw - the main save succeeded
      }

      toast(`+${calculatedPoints} Points!`, { description: `${selectedLocation.label} verification recorded successfully.` });

      onComplete(calculatedPoints, urlData.publicUrl);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload Failed', { description: 'Could not save video. Please try again.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setStep('select');
    setCameraReady(false);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingDuration(0);
    setIsRecording(false);
    onClose();
  };

  const handleSkip = () => {
    handleClose();
    onSkip();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Verify for Bonus Points!
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 pt-0 space-y-4">
          {/* Disposition & Address Info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: dispositionConfig?.hexColor }}
              />
              <span className="font-medium text-sm">{dispositionConfig?.label}</span>
              <span className="text-muted-foreground text-sm">
                Base: {basePoints} pts
              </span>
            </div>
            {propertyAddress && (
              <p className="text-xs text-muted-foreground truncate">{propertyAddress}</p>
            )}
          </div>

          {/* Step: Select Location */}
          {step === 'select' && (
            <>
              <div>
                <h4 className="text-sm font-medium mb-3">Where are you recording from?</h4>
                <RadioGroup
                  value={locationType}
                  onValueChange={(val) => setLocationType(val as VideoLocationType)}
                  className="space-y-2"
                >
                  {VIDEO_LOCATIONS.map((loc) => {
                    const Icon = loc.icon;
                    const points = Math.round(basePoints * loc.multiplier);
                    return (
                      <Label
                        key={loc.value}
                        htmlFor={loc.value}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                          locationType === loc.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/50"
                        )}
                      >
                        <RadioGroupItem value={loc.value} id={loc.value} />
                        <Icon className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{loc.label}</p>
                          <p className="text-xs text-muted-foreground">{loc.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">{loc.multiplier}x</p>
                          <p className="text-xs text-muted-foreground">{points} pts</p>
                        </div>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSkip} className="flex-1">
                  Skip (1x Points)
                </Button>
                <Button onClick={startCamera} className="flex-1">
                  <Video className="w-4 h-4 mr-2" />
                  Start Camera
                </Button>
              </div>
            </>
          )}

          {/* Step: Record */}
          {step === 'record' && (
            <>
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {isRecording && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-500 text-white px-2 py-1 rounded-full text-sm">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    {formatDuration(recordingDuration)}
                  </div>
                )}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="bg-black/60 text-white text-xs px-2 py-1 rounded inline-block">
                    {selectedLocation.label} • {selectedLocation.multiplier}x multiplier
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                {!isRecording ? (
                  <Button onClick={startRecording} className="flex-1 bg-red-500 hover:bg-red-600">
                    <Video className="w-4 h-4 mr-2" />
                    Record
                  </Button>
                ) : (
                  <Button
                    onClick={stopRecording}
                    disabled={recordingDuration < MIN_DURATION_SECONDS}
                    className="flex-1"
                    variant={recordingDuration < MIN_DURATION_SECONDS ? 'secondary' : 'default'}
                  >
                    <Square className="w-4 h-4 mr-2" />
                    {recordingDuration < MIN_DURATION_SECONDS
                      ? `Wait ${MIN_DURATION_SECONDS - recordingDuration}s`
                      : 'Stop'}
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Step: Preview */}
          {step === 'preview' && recordedUrl && (
            <>
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  src={recordedUrl}
                  controls
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  +{calculatedPoints} Points
                </p>
                <p className="text-sm text-muted-foreground">
                  {basePoints} base × {selectedLocation.multiplier}x {selectedLocation.label}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={retakeVideo} className="flex-1">
                  <Video className="w-4 h-4 mr-2" />
                  Retake
                </Button>
                <Button onClick={uploadAndSave} disabled={isUploading} className="flex-1">
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Save & Submit
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Export constants for use in other components
export const HIGH_VALUE_DISPOSITIONS: PropertyDisposition[] = ['inspected', 'canvass_lead', 'won'];

export function isHighValueDisposition(disposition: PropertyDisposition): boolean {
  return HIGH_VALUE_DISPOSITIONS.includes(disposition);
}
