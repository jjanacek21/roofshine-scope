import { useState } from 'react';
import { Tag, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PropertyTagsProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

const SUGGESTED_TAGS = [
  'Storm Damage',
  'Urgent',
  'Follow Up',
  'Insurance Claim',
  'HOA Approval',
  'Multi-Family',
  'Rental Property',
  'Cash Deal',
  'Referral',
  'Neighbor',
];

export function PropertyTags({ tags, onChange, disabled }: PropertyTagsProps) {
  const [newTag, setNewTag] = useState('');
  const [showInput, setShowInput] = useState(false);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onChange([...tags, trimmedTag]);
    }
    setNewTag('');
    setShowInput(false);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(newTag);
    } else if (e.key === 'Escape') {
      setShowInput(false);
      setNewTag('');
    }
  };

  const availableSuggestions = SUGGESTED_TAGS.filter(t => !tags.includes(t));

  return (
    <div className="space-y-3">
      {/* Current tags */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge 
            key={tag} 
            variant="secondary"
            className="flex items-center gap-1"
          >
            {tag}
            {!disabled && (
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </Badge>
        ))}
        
        {tags.length === 0 && !showInput && (
          <span className="text-sm text-muted-foreground">No tags added</span>
        )}
      </div>

      {/* Add new tag */}
      {showInput ? (
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter tag..."
            className="h-8"
            autoFocus
            disabled={disabled}
          />
          <Button 
            size="sm" 
            onClick={() => addTag(newTag)}
            disabled={disabled || !newTag.trim()}
          >
            Add
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => {
              setShowInput(false);
              setNewTag('');
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowInput(true)}
          disabled={disabled}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Tag
        </Button>
      )}

      {/* Suggested tags */}
      {availableSuggestions.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground">Quick add:</span>
          <div className="flex flex-wrap gap-1">
            {availableSuggestions.slice(0, 5).map((tag) => (
              <button
                key={tag}
                onClick={() => addTag(tag)}
                disabled={disabled}
                className={cn(
                  "text-xs px-2 py-1 rounded-full border border-dashed",
                  "hover:bg-muted transition-colors",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
