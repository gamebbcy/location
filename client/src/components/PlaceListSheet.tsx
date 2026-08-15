import { useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@client/src/components/ui/sheet';
import { Button } from '@client/src/components/ui/button';
import { Home, Briefcase, GraduationCap, MapPin, Plus, Trash2 } from 'lucide-react';
import type { Place } from '@client/src/hooks/usePlaces';
import { cn } from '@/lib/utils';

interface PlaceListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  places: Place[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}

function TagIcon({ tag }: { tag: Place['tag'] }): React.ReactElement {
  const iconMap: Record<Place['tag'], typeof Home> = {
    home: Home,
    company: Briefcase,
    school: GraduationCap,
    other: MapPin,
  };
  const colorMap: Record<Place['tag'], string> = {
    home: 'text-orange-500',
    company: 'text-blue-500',
    school: 'text-purple-500',
    other: 'text-muted-foreground',
  };
  const Icon = iconMap[tag];
  return <Icon className={cn('size-5', colorMap[tag])} />;
}

const PlaceListSheet: React.FC<PlaceListSheetProps> = ({
  open,
  onOpenChange,
  places,
  onAdd,
  onDelete,
}) => {
  const handleDelete = useCallback(
    (id: string): void => {
      onDelete(id);
    },
    [onDelete],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
        <SheetHeader className="p-0 pb-2">
          <SheetTitle>常用地点</SheetTitle>
          <SheetDescription>共 {places.length} 个地点</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {places.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">还没有常用地点</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                点击下方按钮添加第一个地点
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {places.map((place: Place) => (
                <div
                  key={place.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/50">
                    <TagIcon tag={place.tag} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {place.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {place.address || `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(place.id)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="删除地点"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          className="mt-4 w-full rounded-xl"
          onClick={() => {
            onOpenChange(false);
            onAdd();
          }}
        >
          <Plus className="mr-2 size-4" />
          添加新地点
        </Button>
      </SheetContent>
    </Sheet>
  );
};

export default PlaceListSheet;
