import { useState, useEffect } from 'react';
import { User, Phone, Mail, Plus, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Resident {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
}

interface PropertyResidentsProps {
  propertyId?: string;
  userId?: string;
  initialName?: string;
  initialPhone?: string;
  initialEmail?: string;
  onUpdate?: (residents: Resident[]) => void;
}

export function PropertyResidents({
  propertyId,
  userId,
  initialName,
  initialPhone,
  initialEmail,
  onUpdate
}: PropertyResidentsProps) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newResident, setNewResident] = useState({ name: '', phone: '', email: '' });

  // Fetch residents when propertyId changes
  useEffect(() => {
    if (propertyId) {
      fetchResidents();
    } else {
      // If no property yet, show initial data as a resident
      if (initialName || initialPhone || initialEmail) {
        setResidents([{
          id: 'temp-primary',
          name: initialName || null,
          phone: initialPhone || null,
          email: initialEmail || null,
          is_primary: true
        }]);
      } else {
        setResidents([]);
      }
    }
  }, [propertyId, initialName, initialPhone, initialEmail]);

  const fetchResidents = async () => {
    if (!propertyId) return;

    try {
      const { data, error } = await supabase
        .from('property_residents')
        .select('*')
        .eq('property_id', propertyId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setResidents(data || []);
    } catch (err) {
      console.error('Error fetching residents:', err);
    }
  };

  const addResident = async () => {
    if (!newResident.name && !newResident.phone && !newResident.email) {
      toast.error('Error', { description: 'Please enter at least one field' });
      return;
    }

    if (!propertyId || !userId) {
      // For new properties, just add to local state
      const tempResident: Resident = {
        id: `temp-${Date.now()}`,
        name: newResident.name || null,
        phone: newResident.phone || null,
        email: newResident.email || null,
        is_primary: residents.length === 0
      };
      setResidents(prev => [...prev, tempResident]);
      setNewResident({ name: '', phone: '', email: '' });
      setShowAddForm(false);
      onUpdate?.([...residents, tempResident]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('property_residents')
        .insert({
          property_id: propertyId,
          user_id: userId,
          name: newResident.name || null,
          phone: newResident.phone || null,
          email: newResident.email || null,
          is_primary: residents.length === 0
        })
        .select()
        .single();

      if (error) throw error;

      setResidents(prev => [...prev, data]);
      setNewResident({ name: '', phone: '', email: '' });
      setShowAddForm(false);
      onUpdate?.([...residents, data]);
      
      toast.success('Resident Added', { description: 'New resident has been added successfully' });
    } catch (err) {
      console.error('Error adding resident:', err);
      toast.error('Error', { description: 'Failed to add resident' });
    } finally {
      setLoading(false);
    }
  };

  const removeResident = async (residentId: string) => {
    if (residentId.startsWith('temp-')) {
      // Local only
      setResidents(prev => prev.filter(r => r.id !== residentId));
      onUpdate?.(residents.filter(r => r.id !== residentId));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('property_residents')
        .delete()
        .eq('id', residentId);

      if (error) throw error;

      setResidents(prev => prev.filter(r => r.id !== residentId));
      onUpdate?.(residents.filter(r => r.id !== residentId));
    } catch (err) {
      console.error('Error removing resident:', err);
      toast.error('Error', { description: 'Failed to remove resident' });
    } finally {
      setLoading(false);
    }
  };

  const setPrimary = async (residentId: string) => {
    if (residentId.startsWith('temp-')) {
      setResidents(prev => prev.map(r => ({
        ...r,
        is_primary: r.id === residentId
      })));
      return;
    }

    if (!propertyId) return;
    setLoading(true);
    try {
      // First, unset all as primary
      await supabase
        .from('property_residents')
        .update({ is_primary: false })
        .eq('property_id', propertyId);

      // Then set the selected one as primary
      const { error } = await supabase
        .from('property_residents')
        .update({ is_primary: true })
        .eq('id', residentId);

      if (error) throw error;

      setResidents(prev => prev.map(r => ({
        ...r,
        is_primary: r.id === residentId
      })));
    } catch (err) {
      console.error('Error setting primary:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Existing residents */}
      {residents.map((resident) => (
        <div 
          key={resident.id}
          className={cn(
            "p-3 rounded-lg border bg-muted/30 space-y-2",
            resident.is_primary && "border-primary/50"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {resident.is_primary && (
                <Star className="w-3 h-3 text-primary fill-primary" />
              )}
              <span className="text-sm font-medium">
                {resident.name || 'Unknown'}
              </span>
            </div>
            <div className="flex gap-1">
              {!resident.is_primary && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setPrimary(resident.id)}
                  disabled={loading}
                >
                  <Star className="w-3 h-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive"
                onClick={() => removeResident(resident.id)}
                disabled={loading}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
          {resident.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />
              {resident.phone}
            </div>
          )}
          {resident.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="w-3 h-3" />
              {resident.email}
            </div>
          )}
        </div>
      ))}

      {/* Add new resident form */}
      {showAddForm ? (
        <div className="p-3 rounded-lg border border-dashed space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Name</Label>
            <Input
              value={newResident.name}
              onChange={(e) => setNewResident(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Resident name"
              className="h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Phone</Label>
            <Input
              value={newResident.phone}
              onChange={(e) => setNewResident(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="(555) 123-4567"
              className="h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Email</Label>
            <Input
              value={newResident.email}
              onChange={(e) => setNewResident(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@example.com"
              className="h-8"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addResident} disabled={loading}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Resident
        </Button>
      )}
    </div>
  );
}
