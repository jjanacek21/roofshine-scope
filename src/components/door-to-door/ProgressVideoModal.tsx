import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Video, StopCircle, Upload, Clock, Check, MapPin, Home, Users, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProgressVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (videoUrl: string, points: number) => Promise<boolean>;
  userId: string;
  sessionId: string;
  updateNumber: number;
  currentDoors: number;
  currentLeads: number;
  goalsDoors: number;
  goalsLeads: number;
}

type RecordingState = 'setup' | 'recording' | 'preview' | 'uploading' | 'success';
type VideoLocation = 'standard' | 'roof' | 'homeowner';

const MIN_DURATION = 5; // 5 seconds minimum for progress videos

const LOCATION_CONFIG = {
  standard: { 
    multiplier: 1.0, 
    points: 100, 
    label: 'Standard Check-in', 
    description: 'Regular progress update',
    icon: Video,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30'
  },
  roof: { 
    multiplier: 2.0, 
    points: 200, 
    label: 'On the Roof! 🏠', 
    description: '2x points for roof videos',
    icon: Home,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/30'
  },
  homeowner: { 
    multiplier: 3.0, 
    points: 300, 
    label: 'With Homeowner! 🤝', 
    description: '3x points for homeowner videos',
    icon: Users,
    color: 'text-green-500 bg-green-500/10 border-green-500/30'
  }
};

export function ProgressVideoModal({
  isOpen,
  onClose,
  onUpload,
  userId,
  sessionId,
  updateNumber,
  currentDoors,
  currentLeads,
  goalsDoors,
  goalsLeads
}: ProgressVideoModalProps) {
  const [state, setState] = useState<RecordingState>('setup');
  const [videoLocation, setVideoLocation] = useState<VideoLocation>('standard');
  const [challenges, setChallenges] = useState('');
  const [updatedGoalsDoors, setUpdatedGoalsDoors] = useState(goalsDoors);
  const [updatedGoalsLeads, setUpdatedGoalsLeads] = useState(goalsLeads);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const pointsToEarn = LOCATION_CONFIG[videoLocation].points;

  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    setUpdatedGoalsDoors(goalsDoors);
    setUpdatedGoalsLeads(goalsLeads);
  }, [goalsDoors, goalsLeads]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Use back camera for proof
        audio: true
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        stopCamera();
        setState('preview');
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleUpload = async () => {
    if (!recordedBlob || duration < MIN_DURATION) return;

    setState('uploading');
    setError(null);

    try {
      const fileName = `${userId}/progress/${sessionId}_update${updateNumber}_${Date.now()}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from('door-to-door-videos')
        .upload(fileName, recordedBlob, { contentType: 'video/webm' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('door-to-door-videos')
        .getPublicUrl(fileName);

      // Save to session_progress_videos table
      await supabase
        .from('session_progress_videos')
        .insert({
          session_id: sessionId,
          user_id: userId,
          video_url: publicUrl,
          video_duration_seconds: duration,
          update_number: updateNumber,
          video_type: videoLocation,
          points_multiplier: LOCATION_CONFIG[videoLocation].multiplier,
          points_awarded: pointsToEarn,
          challenges_mentioned: challenges || null,
          updated_goals_doors: updatedGoalsDoors,
          updated_goals_leads: updatedGoalsLeads
        });

      // Auto-post to feed
      const locationEmoji = videoLocation === 'roof' ? '🏠' : videoLocation === 'homeowner' ? '🤝' : '📍';
      await supabase
        .from('session_feed_posts')
        .insert({
          session_id: sessionId,
          user_id: userId,
          video_url: publicUrl,
          video_type: videoLocation,
          content: `Hour ${updateNumber} update ${locationEmoji} Progress: ${currentDoors}/${goalsDoors} doors, ${currentLeads}/${goalsLeads} leads${challenges ? ` | Challenges: ${challenges}` : ''}`,
          points_earned: pointsToEarn,
          doors_knocked: currentDoors,
          leads_gotten: currentLeads,
          goals_doors: updatedGoalsDoors,
          goals_leads: updatedGoalsLeads
        });

      const success = await onUpload(publicUrl, pointsToEarn);
      
      if (success) {
        setState('success');
        setTimeout(() => {
          onClose();
          resetState();
        }, 2000);
      } else {
        throw new Error('Failed to save verification');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload video. Please try again.');
      setState('preview');
    }
  };

  const resetState = () => {
    setState('setup');
    setVideoLocation('standard');
    setChallenges('');
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    setError(null);
    chunksRef.current = [];
  };

  const handleClose = () => {
    stopCamera();
    if (timerRef.current) clearInterval(timerRef.current);
    resetState();
    onClose();
  };

  const doorsProgress = (currentDoors / goalsDoors) * 100;
  const leadsProgress = (currentLeads / goalsLeads) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Hour {updateNumber} Check-in
          </DialogTitle>
          <DialogDescription>
            Record your progress update - earn up to 300 points with location bonuses!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Summary */}
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Doors</span>
              <span className="font-bold">{currentDoors} / {goalsDoors}</span>
            </div>
            <div className="h-2 bg-background rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 transition-all duration-300" 
                style={{ width: `${Math.min(doorsProgress, 100)}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm">Leads</span>
              <span className="font-bold">{currentLeads} / {goalsLeads}</span>
            </div>
            <div className="h-2 bg-background rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300" 
                style={{ width: `${Math.min(leadsProgress, 100)}%` }}
              />
            </div>
          </div>

          {/* Setup Step */}
          {state === 'setup' && (
            <div className="space-y-4">
              {/* Location Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Where are you recording from?
                </Label>
                <RadioGroup 
                  value={videoLocation} 
                  onValueChange={(v) => setVideoLocation(v as VideoLocation)}
                  className="space-y-2"
                >
                  {Object.entries(LOCATION_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <div 
                        key={key}
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          videoLocation === key ? config.color : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setVideoLocation(key as VideoLocation)}
                      >
                        <RadioGroupItem value={key} id={key} />
                        <Icon className={`w-5 h-5 ${videoLocation === key ? '' : 'text-muted-foreground'}`} />
                        <div className="flex-1">
                          <p className="font-medium">{config.label}</p>
                          <p className="text-xs text-muted-foreground">{config.description}</p>
                        </div>
                        <div className={`px-2 py-1 rounded text-sm font-bold ${config.color}`}>
                          +{config.points}
                        </div>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>

              {/* Challenges */}
              <div className="space-y-2">
                <Label>Any challenges? (optional)</Label>
                <Textarea
                  value={challenges}
                  onChange={(e) => setChallenges(e.target.value)}
                  placeholder="Weather, neighborhoods, objections..."
                  rows={2}
                />
              </div>

              {/* Update Goals */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Update Door Goal</Label>
                  <Input
                    type="number"
                    value={updatedGoalsDoors}
                    onChange={(e) => setUpdatedGoalsDoors(parseInt(e.target.value) || goalsDoors)}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Update Lead Goal</Label>
                  <Input
                    type="number"
                    value={updatedGoalsLeads}
                    onChange={(e) => setUpdatedGoalsLeads(parseInt(e.target.value) || goalsLeads)}
                    min={1}
                  />
                </div>
              </div>

              <Button onClick={startRecording} className="w-full" size="lg">
                <Video className="w-5 h-5 mr-2" />
                Record Progress Video (+{pointsToEarn} pts)
              </Button>
            </div>
          )}

          {/* Recording/Preview */}
          {(state === 'recording' || state === 'preview' || state === 'uploading' || state === 'success') && (
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              {state === 'recording' && (
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
              )}
              
              {(state === 'preview' || state === 'uploading') && recordedUrl && (
                <video
                  src={recordedUrl}
                  className="w-full h-full object-cover"
                  controls
                />
              )}

              {state === 'success' && (
                <div className="absolute inset-0 flex items-center justify-center bg-green-600/90">
                  <div className="text-center text-white">
                    <Check className="w-16 h-16 mx-auto mb-2" />
                    <p className="text-lg font-bold">+{pointsToEarn} Points!</p>
                    <p className="text-sm opacity-90">
                      {LOCATION_CONFIG[videoLocation].multiplier}x {videoLocation} bonus
                    </p>
                  </div>
                </div>
              )}

              {/* Recording indicator */}
              {state === 'recording' && (
                <>
                  <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-full text-sm font-medium animate-pulse">
                    <span className="w-2 h-2 bg-white rounded-full" />
                    REC {duration}s
                  </div>
                  <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-bold ${LOCATION_CONFIG[videoLocation].color}`}>
                    <Zap className="w-4 h-4 inline mr-1" />
                    +{pointsToEarn}
                  </div>
                </>
              )}

              {/* Minimum timer */}
              {state === 'recording' && duration < MIN_DURATION && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/70 text-white rounded-full text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {MIN_DURATION - duration}s remaining
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {state === 'recording' && (
              <Button 
                onClick={stopRecording} 
                variant={duration >= MIN_DURATION ? "default" : "secondary"}
                className="flex-1"
                disabled={duration < MIN_DURATION}
              >
                <StopCircle className="w-4 h-4 mr-2" />
                {duration < MIN_DURATION ? `Wait ${MIN_DURATION - duration}s...` : 'Stop Recording'}
              </Button>
            )}

            {state === 'preview' && (
              <>
                <Button onClick={resetState} variant="outline" className="flex-1">
                  Retake
                </Button>
                <Button onClick={handleUpload} className="flex-1">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload (+{pointsToEarn})
                </Button>
              </>
            )}

            {state === 'uploading' && (
              <Button disabled className="flex-1">
                <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading...
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

