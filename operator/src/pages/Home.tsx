import { useEffect, useMemo, useState } from 'react';
import {
  Page,
  Navbar,
  NavTitle,
  NavRight,
  Link,
  Segmented,
  Button,
  Icon,
  List,
  Block,
  Preloader,
} from 'framework7-react';
import LeafletMap from '../components/LeafletMap';
import MachineListItem from '../components/MachineListItem';
import FilterSheet, {
  EMPTY_FILTERS,
  filtersActive,
  type Filters,
} from '../components/FilterSheet';
import { fetchFleet } from '../data/machines';
import { useGeolocation, haversineKm } from '../lib/geo';
import type { Asset, FleetMachine } from '../types';

type ViewMode = 'map' | 'list';

export default function Home() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const geo = useGeolocation();

  useEffect(() => {
    let cancelled = false;
    fetchFleet().then((res) => {
      if (cancelled) return;
      setAssets(res.assets);
      setLive(res.live);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Enrich with distance + sort nearest-first when we have a position.
  const enriched: FleetMachine[] = useMemo(() => {
    const pos = geo.position;
    const list = assets.map((a) => {
      const c = a.location?.coordinates;
      const distanceKm =
        pos && c ? haversineKm(pos, [c[1], c[0]]) : null;
      return { ...a, distanceKm };
    });
    if (pos) {
      list.sort((x, y) => (x.distanceKm ?? 1e9) - (y.distanceKm ?? 1e9));
    }
    return list;
  }, [assets, geo.position]);

  const availableTypes = useMemo(
    () => Array.from(new Set(assets.map((a) => a.assetType))).sort(),
    [assets]
  );

  const filtered = useMemo(
    () =>
      enriched.filter((m) => {
        if (filters.statuses.length && !filters.statuses.includes(m.activity ?? 'UNKNOWN'))
          return false;
        if (filters.types.length && !filters.types.includes(m.assetType)) return false;
        if (filters.range > 0 && m.distanceKm != null && m.distanceKm > filters.range)
          return false;
        return true;
      }),
    [enriched, filters]
  );

  const locateLabel =
    geo.status === 'locating'
      ? 'Locating…'
      : geo.status === 'denied'
      ? 'Location denied'
      : geo.status === 'unsupported'
      ? 'No location'
      : geo.position
      ? 'Recenter'
      : 'Use my location';

  return (
    <Page name="home" pageContent={false}>
      <Navbar>
        <NavTitle>
          <Segmented strong className="op-seg">
            <Button active={view === 'map'} onClick={() => setView('map')}>
              Map
            </Button>
            <Button active={view === 'list'} onClick={() => setView('list')}>
              List
            </Button>
          </Segmented>
        </NavTitle>
        <NavRight>
          <Link onClick={() => setFilterOpen(true)} className="op-filter-btn">
            <Icon f7="slider_horizontal_3" />
            {filtersActive(filters) && <span className="op-filter-dot" />}
          </Link>
        </NavRight>
      </Navbar>

      {loading ? (
        <div className="op-center">
          <Preloader />
        </div>
      ) : view === 'map' ? (
        <div className="op-fullmap">
          <LeafletMap
            machines={filtered}
            userPosition={geo.position}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          <div className="op-map-top">
            <span className="op-count-pill">
              {filtered.length} {filtered.length === 1 ? 'machine' : 'machines'}
              {!live && <span className="op-sample-tag">sample</span>}
            </span>
          </div>

          <button className="op-locate" onClick={geo.request} type="button">
            <Icon f7="location_fill" />
            <span>{locateLabel}</span>
          </button>

          {selectedId && (
            <SelectedCard
              machine={filtered.find((m) => m.assetId === selectedId) ?? null}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      ) : (
        <div className="page-content op-list-content">
          {!live && (
            <Block className="op-sample-banner">
              Showing sample machines — connect your fleet to see live data.
            </Block>
          )}
          {geo.status === 'idle' && (
            <Block>
              <Button small round onClick={geo.request}>
                <Icon f7="location" size={16} /> &nbsp;Sort by nearest
              </Button>
            </Block>
          )}
          <List dividersIos mediaList strongIos outlineIos className="op-machine-list">
            {filtered.map((m) => (
              <MachineListItem key={m.assetId} machine={m} onClick={() => setSelectedId(m.assetId)} />
            ))}
          </List>
          {filtered.length === 0 && <Block className="op-muted">No machines match your filters.</Block>}
        </div>
      )}

      <FilterSheet
        opened={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        availableTypes={availableTypes}
      />
    </Page>
  );
}

function SelectedCard({
  machine,
  onClose,
}: {
  machine: FleetMachine | null;
  onClose: () => void;
}) {
  if (!machine) return null;
  return (
    <div className="op-selected-card">
      <div className="op-selected-head">
        <div className="op-selected-title">{machine.name}</div>
        <Link onClick={onClose}>
          <Icon f7="xmark_circle_fill" />
        </Link>
      </div>
      <div className="op-selected-sub">
        {[machine.brand, machine.model].filter(Boolean).join(' · ') || machine.assetType}
      </div>
      <div className="op-selected-meta">
        <span>
          {machine.distanceKm != null
            ? `${machine.distanceKm.toFixed(1)} km away`
            : machine.location?.address?.city ?? '—'}
        </span>
      </div>
    </div>
  );
}
