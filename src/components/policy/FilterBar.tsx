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
import { Search, X, Filter, SlidersHorizontal, Sparkles } from 'lucide-react';

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
    <div className="mt-5 space-y-4 animate-fade-in">
      {/* Filter Bar Container - Modern gradient design */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/5 via-background to-primary/10 p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/30">
        {/* Decorative gradient orb */}
        <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl transition-transform duration-500" />
        <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-primary/5 blur-2xl transition-transform duration-500" />
        
        {/* Header with icon */}
        <div className="relative flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 hover:scale-110 hover:bg-primary/20">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">סינון וחיפוש</span>
            <span className="text-xs text-muted-foreground">מצא את החוקים שאתה מחפש</span>
          </div>
          {activeFilterCount > 0 && (
            <Badge className="mr-auto bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 animate-scale-in transition-all duration-300">
              <Sparkles className="h-3 w-3 ml-1 animate-pulse" />
              {activeFilterCount} פעילים
            </Badge>
          )}
        </div>
        
        {/* Filters Row */}
        <div className="relative flex flex-wrap gap-3 items-center">
          {/* Search Input - Enhanced */}
          <div className="relative group transition-all duration-300">
            <div className="absolute inset-0 rounded-lg bg-primary/5 opacity-0 group-focus-within:opacity-100 transition-all duration-300 -m-0.5 scale-95 group-focus-within:scale-100" />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10 transition-colors duration-200 group-focus-within:text-primary" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="relative pr-10 w-[240px] bg-background border-border/60 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 placeholder:text-muted-foreground/60"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 bg-muted/80 hover:bg-destructive/20 hover:text-destructive rounded-md transition-all duration-200 z-10 animate-scale-in hover:scale-110"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Separator */}
          <div className="h-8 w-px bg-border/60 mx-1 hidden sm:block transition-opacity duration-300" />

          {/* Filter Selects - Enhanced */}
          {filters.map((filter, index) => {
            const isActive = filter.value !== 'all';
            return (
              <div 
                key={filter.key} 
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Select value={filter.value} onValueChange={filter.onChange}>
                  <SelectTrigger 
                    className={`w-[145px] transition-all duration-300 shadow-sm hover:scale-[1.02] ${
                      isActive 
                        ? 'bg-primary/10 border-primary/40 text-primary ring-2 ring-primary/20 font-medium scale-[1.02]' 
                        : 'bg-background border-border/60 hover:border-primary/30 hover:bg-primary/5'
                    }`}
                  >
                    <SelectValue placeholder={filter.placeholder} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border/60 shadow-xl rounded-xl overflow-hidden animate-scale-in">
                    {filter.options.map((option) => (
                      <SelectItem 
                        key={option.value} 
                        value={option.value}
                        className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-all duration-200 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          {option.icon}
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}

          {/* Clear Filters Button - Enhanced */}
          {hasActiveFilters && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClearFilters}
              className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all duration-300 shadow-sm animate-scale-in hover:scale-105"
            >
              <X className="w-3.5 h-3.5 ml-1.5" />
              נקה הכל
            </Button>
          )}
        </div>
      </div>

      {/* Results Counter - Enhanced */}
      {hasActiveFilters && (
        <div className="flex items-center gap-3 px-2 animate-fade-in">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-300 hover:scale-110">
            <Filter className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">מציג </span>
            <span className="font-bold text-primary transition-all duration-300">{filteredCount}</span>
            <span className="text-muted-foreground"> מתוך </span>
            <span className="font-bold text-foreground">{totalCount}</span>
            <span className="text-muted-foreground"> תוצאות</span>
          </div>
          {filteredCount === 0 && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-50 animate-scale-in">
              לא נמצאו תוצאות
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
