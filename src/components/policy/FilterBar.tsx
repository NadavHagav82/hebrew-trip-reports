import { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Filter, SlidersHorizontal } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface FilterConfig {
  key: string;
  label: string;
  placeholder: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  filters: FilterConfig[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  totalCount: number;
  filteredCount: number;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'חיפוש...',
  filters,
  onClearFilters,
  hasActiveFilters,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  const activeFilterCount = filters.filter(f => f.value !== 'all').length + (searchQuery ? 1 : 0);

  return (
    <div className="mt-4 space-y-3 animate-fade-in">
      {/* Filter Bar Container */}
      <div className="bg-muted/30 border border-border/50 rounded-xl p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">סינון וחיפוש</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-0">
              {activeFilterCount} פילטרים פעילים
            </Badge>
          )}
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pr-9 w-[220px] bg-background/80 border-border/50 focus:border-primary/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Filter Selects */}
          {filters.map((filter) => (
            <Select key={filter.key} value={filter.value} onValueChange={filter.onChange}>
              <SelectTrigger 
                className={`w-[140px] bg-background/80 border-border/50 transition-all ${
                  filter.value !== 'all' 
                    ? 'border-primary/50 ring-1 ring-primary/20' 
                    : ''
                }`}
              >
                <SelectValue placeholder={filter.placeholder} />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg">
                {filter.options.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {option.icon}
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClearFilters}
              className="text-muted-foreground hover:text-foreground hover:bg-destructive/10 transition-colors"
            >
              <X className="w-3 h-3 ml-1" />
              נקה הכל
            </Button>
          )}
        </div>
      </div>

      {/* Results Counter */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
          <Filter className="w-4 h-4" />
          <span>
            מציג <span className="font-semibold text-foreground">{filteredCount}</span> מתוך{' '}
            <span className="font-semibold text-foreground">{totalCount}</span> תוצאות
          </span>
        </div>
      )}
    </div>
  );
}
