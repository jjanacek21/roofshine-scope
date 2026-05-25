import { useState, useEffect } from 'react';
import { StickyNote, Plus, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Note {
  id: string;
  note: string;
  created_at: string;
}

interface NotesHistoryProps {
  propertyId?: string;
  userId?: string;
  currentNote?: string;
  onCurrentNoteChange?: (note: string) => void;
}

export function NotesHistory({ 
  propertyId, 
  userId, 
  currentNote = '', 
  onCurrentNoteChange 
}: NotesHistoryProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (propertyId) {
      fetchNotes();
    }
  }, [propertyId]);

  const fetchNotes = async () => {
    if (!propertyId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('property_notes')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    if (!propertyId || !userId) {
      toast({
        title: 'Save property first',
        description: 'Please save the property before adding notes to history',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('property_notes')
        .insert({
          property_id: propertyId,
          user_id: userId,
          note: newNote.trim()
        })
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => [data, ...prev]);
      setNewNote('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Error adding note:', err);
      toast({
        title: 'Error',
        description: 'Failed to add note',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current note (saved with property) */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Quick Notes
        </label>
        <Textarea
          value={currentNote}
          onChange={(e) => onCurrentNoteChange?.(e.target.value)}
          placeholder="Add quick notes about this property..."
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Notes history */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Notes History
          </label>
          {propertyId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="h-6 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add to History
            </Button>
          )}
        </div>

        {/* Add note form */}
        {showAddForm && (
          <div className="p-3 rounded-lg border border-dashed space-y-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Enter note for history..."
              rows={2}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={addNote} disabled={loading || !newNote.trim()}>
                Save to History
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                setShowAddForm(false);
                setNewNote('');
              }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Notes list */}
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {propertyId ? 'No notes in history' : 'Save property to track notes history'}
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {notes.map((note) => (
              <div 
                key={note.id}
                className="p-2 rounded-lg bg-muted/50 text-sm"
              >
                <p className="whitespace-pre-wrap">{note.note}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

