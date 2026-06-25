import { Sheet, PageContent, Block, BlockTitle, Range, Button } from 'framework7-react';
import type { ActivityState } from '../types';

export interface Filters {
  range: number; // km; 0 = any
  types: string[]; // empty = all
  statuses: ActivityState[]; // empty = all
}

export const EMPTY_FILTERS: Filters = { range: 0, types: [], statuses: [] };

export function filtersActive(f: Filters): boolean {
  return f.range > 0 || f.types.length > 0 || f.statuses.length > 0;
}

const STATUSES: ActivityState[] = ['WORKING', 'IDLING', 'STOPPED', 'UNKNOWN'];

interface Props {
  opened: boolean;
  onClose: () => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  availableTypes: string[];
}

export default function FilterSheet({
  opened,
  onClose,
  filters,
  setFilters,
  availableTypes,
}: Props) {
  const toggleType = (t: string) =>
    setFilters({
      ...filters,
      types: filters.types.includes(t)
        ? filters.types.filter((x) => x !== t)
        : [...filters.types, t],
    });

  const toggleStatus = (s: ActivityState) =>
    setFilters({
      ...filters,
      statuses: filters.statuses.includes(s)
        ? filters.statuses.filter((x) => x !== s)
        : [...filters.statuses, s],
    });

  return (
    <Sheet
      className="op-filter-sheet"
      opened={opened}
      onSheetClosed={onClose}
      swipeToClose
      backdrop
    >
      <PageContent>
        <div className="op-sheet-grip" />
        <BlockTitle large>Filter</BlockTitle>

        <BlockTitle>Range</BlockTitle>
        <Block strong inset>
          <div className="op-range-label">
            {filters.range === 0 ? 'Any distance' : `Within ${filters.range} km`}
          </div>
          <Range
            min={0}
            max={100}
            step={5}
            value={filters.range}
            onRangeChange={(v) => setFilters({ ...filters, range: v as number })}
          />
        </Block>

        <BlockTitle>Type</BlockTitle>
        <Block strong inset>
          <div className="op-chips">
            {availableTypes.length === 0 && <span className="op-muted">No types</span>}
            {availableTypes.map((t) => (
              <button
                key={t}
                type="button"
                className={`op-chip${filters.types.includes(t) ? ' op-chip-active' : ''}`}
                onClick={() => toggleType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </Block>

        <BlockTitle>Status</BlockTitle>
        <Block strong inset>
          <div className="op-chips">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`op-chip${filters.statuses.includes(s) ? ' op-chip-active' : ''}`}
                onClick={() => toggleStatus(s)}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </Block>

        <Block>
          <Button large fill onClick={onClose}>
            Show results
          </Button>
          <Button
            large
            clear
            onClick={() => setFilters(EMPTY_FILTERS)}
            style={{ marginTop: 8 }}
          >
            Reset
          </Button>
        </Block>
      </PageContent>
    </Sheet>
  );
}
