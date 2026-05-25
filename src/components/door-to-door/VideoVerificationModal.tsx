import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Video, StopCircle, Upload, Check, X, Clock } from "lucide-react";
import { DOOR_POINTS } from "@/hooks/useDoorToDoorSession";

interface VideoVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (videoUrl: string, duration: number) => Promise<boolean>;
  sessionId: string;
  userId: string;
}

type RecordingState = 'idle' | 'recording' | 'preview' | 'uploading' | 'success';

const MIN_DURATION = 15; // 15 seconds minimum

export function VideoVerificationModal({
  isOpen,
  onClose,
  onUpload,
  sessionId,
  userId
}: VideoVerificationModalProps) {
  const [state, setState] = useState<RecordingState>('idle');
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
      // In a real implementation, upload to Supabase Storage
      // For now, we'll simulate with a placeholder URL
      const { supabase } = await import('@/integrations/supabase/client');
      
      const fileName = `${userId}/${sessionId}_${Date.now()}.webm`;
      
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

      const success = await onUpload(publicUrl, duration);
      
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
    setState('idle');
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Video Check-In
          </DialogTitle>
          <DialogDescription>
            Record a quick {MIN_DURATION}-second video to verify you're in the field. Earn +{DOOR_POINTS.video_verification} points!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video Preview */}
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
            {(state === 'idle' || state === 'recording') && (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
            )}
            
            {state === 'preview' && recordedUrl && (
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
                  <p className="text-lg font-bold">+{DOOR_POINTS.video_verification} Points!</p>
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

            {/* Duration Warning */}
            {state === 'recording' && duration < MIN_DURATION && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/70 text-white rounded-full text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {MIN_DURATION - duration}s remaining
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {state === 'idle' && (
              <Button onClick={startRecording} className="flex-1">
                <Video className="w-4 h-4 mr-2" />
                Start Recording
              </Button>
            )}

            {state === 'recording' && (
              <Button 
                onClick={stopRecording} 
                variant="destructive" 
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
                  <X className="w-4 h-4 mr-2" />
                  Retake
                </Button>
                <Button 
                  onClick={handleUpload} 
                  className="flex-1"
                  disabled={duration < MIN_DURATION}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
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
