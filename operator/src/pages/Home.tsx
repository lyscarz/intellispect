import { useEffect, useMemo, useState } from 'react';
import {
  Page,
  Navbar,
  NavLeft,
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
import CheckInSheet from '../components/CheckInSheet';
import FilterSheet, {
  EMPTY_FILTERS,
  filtersActive,
  type Filters,
} from '../components/FilterSheet';
import { fetchFleet } from '../data/machines';
import { useGeolocation, haversineKm } from '../lib/geo';
import { useCheckIn } from '../lib/useCheckIn';
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
  const { checkIn } = useCheckIn();

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

  // Ask for the user's location automatically on load (no button needed).
  useEffect(() => {
    geo.request();
  }, [geo.request]);

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

  const selectedMachine = selectedId
    ? filtered.find((m) => m.assetId === selectedId) ?? null
    : null;

  return (
    <Page name="home" pageContent={false}>
      <Navbar className={view === 'map' ? 'op-map-navbar' : undefined}>
        <NavLeft>
          {!loading && (
            <span className="op-count-pill">
              {filtered.length} {filtered.length === 1 ? 'asset' : 'assets'}
              {!live && <span className="op-sample-tag">sample</span>}
            </span>
          )}
        </NavLeft>
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

      {view === 'map' ? (
        <div className="op-fullmap">
          <LeafletMap
            machines={filtered}
            userPosition={geo.position}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {loading && (
            <div className="op-map-loading">
              <Preloader />
              <span>Loading assets…</span>
            </div>
          )}
        </div>
      ) : (
        <div className="page-content op-list-content">
          {loading ? (
            <div className="op-list-loading">
              <Preloader />
              <span>Loading assets…</span>
            </div>
          ) : (
            <>
              {!live && (
                <Block className="op-sample-banner">
                  Showing sample assets — connect your fleet to see live data.
                </Block>
              )}
              <List dividersIos mediaList strongIos outlineIos className="op-machine-list">
                {filtered.map((m) => (
                  <MachineListItem key={m.assetId} machine={m} onClick={() => setSelectedId(m.assetId)} />
                ))}
              </List>
              {filtered.length === 0 && (
                <Block className="op-muted">No assets match your filters.</Block>
              )}
            </>
          )}
        </div>
      )}

      <FilterSheet
        opened={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        availableTypes={availableTypes}
      />

      <CheckInSheet
        machine={checkIn ? null : selectedMachine}
        onClose={() => setSelectedId(null)}
      />
    </Page>
  );
}
