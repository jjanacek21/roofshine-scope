import { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Trash2, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Photo {
  id: string;
  photo_url: string;
  caption: string | null;
  photo_type: string;
  created_at: string;
}

interface PropertyPhotosProps {
  propertyId?: string;
  userId?: string;
}

export function PropertyPhotos({ propertyId, userId }: PropertyPhotosProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (propertyId) {
      fetchPhotos();
    }
  }, [propertyId]);

  const fetchPhotos = async () => {
    if (!propertyId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('property_photos')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (err) {
      console.error('Error fetching photos:', err);
    } finally {
      setLoading(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!propertyId || !userId) {
      toast.error('Save property first', { description: 'Please save the property before uploading photos' });
      return;
    }

    setUploading(true);
    try {
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${propertyId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('property-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('property-photos')
        .getPublicUrl(fileName);

      // Save to database
      const { data, error } = await supabase
        .from('property_photos')
        .insert({
          property_id: propertyId,
          user_id: userId,
          photo_url: publicUrl,
          photo_type: 'general'
        })
        .select()
        .single();

      if (error) throw error;

      setPhotos(prev => [data, ...prev]);
      toast.success('Photo Uploaded', { description: 'Photo has been added successfully' });
    } catch (err) {
      console.error('Error uploading photo:', err);
      toast.error('Upload Failed', { description: 'Failed to upload photo' });
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photoId: string) => {
    try {
      const { error } = await supabase
        .from('property_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      setPhotos(prev => prev.filter(p => p.id !== photoId));
      setSelectedPhoto(null);
    } catch (err) {
      console.error('Error deleting photo:', err);
      toast.error('Error', { description: 'Failed to delete photo' });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadPhoto(file);
    }
  };

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'image/*';
      fileInputRef.current.capture = 'environment';
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleCameraCapture}
          disabled={uploading || !propertyId}
        >
          <Camera className="w-4 h-4 mr-1" />
          Camera
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !propertyId}
        >
          <Upload className="w-4 h-4 mr-1" />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {!propertyId && (
        <p className="text-xs text-muted-foreground text-center">
          Save the property first to upload photos
        </p>
      )}

      {/* Photo grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No photos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="aspect-square rounded-lg overflow-hidden bg-muted relative group"
            >
              <img
                src={photo.photo_url}
                alt={photo.caption || 'Property photo'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs">View</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Photo viewer modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full">
            <img
              src={selectedPhoto.photo_url}
              alt={selectedPhoto.caption || 'Property photo'}
              className="w-full rounded-lg"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              <Button
                variant="destructive"
                size="icon"
                onClick={() => deletePhoto(selectedPhoto.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setSelectedPhoto(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
