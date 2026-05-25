import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Video, StopCircle, Upload, Target, Home, Users, Clock, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PreSessionGoalVideoProps {
  isOpen: boolean;
  onComplete: (goals: { doors: number; leads: number }, videoUrl: string) => void;
  onCancel: () => void;
  userId: string;
  sessionId: string;
}

type RecordingState = 'goals' | 'recording' | 'preview' | 'uploading' | 'success';

const MIN_DURATION = 10; // 10 seconds minimum

export function PreSessionGoalVideo({
  isOpen,
  onComplete,
  onCancel,
  userId,
  sessionId
}: PreSessionGoalVideoProps) {
  const [state, setState] = useState<RecordingState>('goals');
  const [goalsDoors, setGoalsDoors] = useState(50);
  const [goalsLeads, setGoalsLeads] = useState(5);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
        video: { facingMode: 'user' },
        audio: true
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm'
      });

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

      // Start timer
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
      const fileName = `${userId}/goals/${sessionId}_goal_${Date.now()}.webm`;
      
      const { data, error: uploadError } = await supabase.storage
        .from('door-to-door-videos')
        .upload(fileName, recordedBlob, {
          contentType: 'video/webm'
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('door-to-door-videos')
        .getPublicUrl(fileName);

      // Save to door_session_goals table
      const { error: dbError } = await supabase
        .from('door_session_goals')
        .insert({
          session_id: sessionId,
          user_id: userId,
          goals_doors: goalsDoors,
          goals_leads: goalsLeads,
          video_url: publicUrl,
          video_duration_seconds: duration
        });

      if (dbError) throw dbError;

      // Auto-post to feed
      await supabase
        .from('session_feed_posts')
        .insert({
          session_id: sessionId,
          user_id: userId,
          video_url: publicUrl,
          video_type: 'goal',
          content: `Starting a new session! Goals: ${goalsDoors} doors, ${goalsLeads} leads 🎯`,
          points_earned: 100,
          doors_knocked: 0,
          leads_gotten: 0,
          goals_doors: goalsDoors,
          goals_leads: goalsLeads
        });

      setState('success');
      setTimeout(() => {
        onComplete({ doors: goalsDoors, leads: goalsLeads }, publicUrl);
      }, 1500);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload video. Please try again.');
      setState('preview');
    }
  };

  const resetRecording = () => {
    setState('goals');
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    setError(null);
    chunksRef.current = [];
  };

  const canStopRecording = duration >= MIN_DURATION;

  return (
    <Dialog open={isOpen} onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Set Your Session Goals
          </DialogTitle>
          <DialogDescription>
            Record a {MIN_DURATION}-second video stating your goals for this session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Goals Input Step */}
          {state === 'goals' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-amber-500" />
                    Doors to Knock
                  </Label>
                  <Input
                    type="number"
                    value={goalsDoors}
                    onChange={(e) => setGoalsDoors(parseInt(e.target.value) || 0)}
                    min={1}
                    max={500}
                    className="text-center text-lg font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-500" />
                    Leads to Get
                  </Label>
                  <Input
                    type="number"
                    value={goalsLeads}
                    onChange={(e) => setGoalsLeads(parseInt(e.target.value) || 0)}
                    min={1}
                    max={50}
                    className="text-center text-lg font-bold"
                  />
                </div>
              </div>

              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-center">
                  📹 Record a {MIN_DURATION}-second video stating:
                </p>
                <ul className="text-sm mt-2 space-y-1 text-muted-foreground">
                  <li>• How many doors you plan to knock</li>
                  <li>• How many leads you aim to get</li>
                  <li>• Your energy and motivation!</li>
                </ul>
              </div>

              <Button onClick={startRecording} className="w-full" size="lg">
                <Video className="w-5 h-5 mr-2" />
                Start Recording Goals Video
              </Button>
            </div>
          )}

          {/* Recording/Preview Step */}
          {(state === 'recording' || state === 'preview' || state === 'uploading' || state === 'success') && (
            <>
              {/* Video Preview */}
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
                      <p className="text-lg font-bold">Goals Set!</p>
                      <p className="text-sm opacity-90">+100 Points</p>
                    </div>
                  </div>
                )}

                {/* Recording Indicator */}
                {state === 'recording' && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-full text-sm font-medium animate-pulse">
                    <span className="w-2 h-2 bg-white rounded-full" />
                    REC {duration}s
                  </div>
                )}

                {/* Timer Progress Ring */}
                {state === 'recording' && (
                  <div className="absolute bottom-3 right-3">
                    <div className="relative w-16 h-16">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          className="text-white/20"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          strokeDasharray={175.93}
                          strokeDashoffset={175.93 - (Math.min(duration / MIN_DURATION, 1) * 175.93)}
                          className={duration >= MIN_DURATION ? 'text-green-400' : 'text-amber-400'}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-sm font-bold ${duration >= MIN_DURATION ? 'text-green-400' : 'text-white'}`}>
                          {duration >= MIN_DURATION ? '✓' : `${MIN_DURATION - duration}s`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Duration Warning */}
                {state === 'recording' && !canStopRecording && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/70 text-white rounded-full text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Keep recording... {MIN_DURATION - duration}s left
                  </div>
                )}
              </div>

              {/* Goals Display */}
              {state !== 'success' && (
                <div className="flex gap-4 justify-center text-center">
                  <div className="px-4 py-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
                    <p className="text-2xl font-bold text-amber-500">{goalsDoors}</p>
                    <p className="text-xs text-muted-foreground">Doors</p>
                  </div>
                  <div className="px-4 py-2 bg-green-500/10 rounded-lg border border-green-500/30">
                    <p className="text-2xl font-bold text-green-500">{goalsLeads}</p>
                    <p className="text-xs text-muted-foreground">Leads</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error Message */}
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
                variant={canStopRecording ? "default" : "secondary"}
                className="flex-1"
                disabled={!canStopRecording}
              >
                <StopCircle className="w-4 h-4 mr-2" />
                {canStopRecording ? 'Stop Recording' : `Wait ${MIN_DURATION - duration}s...`}
              </Button>
            )}

            {state === 'preview' && (
              <>
                <Button onClick={resetRecording} variant="outline" className="flex-1">
                  Retake
                </Button>
                <Button onClick={handleUpload} className="flex-1">
                  <Upload className="w-4 h-4 mr-2" />
                  Submit & Start Session
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
