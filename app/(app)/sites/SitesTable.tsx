'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Site } from '@/lib/types';
import { createSiteAction, deleteSiteAction, updateSiteAction } from './actions';

interface Row extends Site {
  machineCount: number;
}

export function SitesTable({ sites, fleetId }: { sites: Row[]; fleetId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftAddress, setDraftAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

  function startEdit(site: Row) {
    if (site.source === 'trackunit') {
      setError(
        'Trackunit-sourced sites are read-only — the next sync would overwrite local edits. Rename in Trackunit Manager instead.'
      );
      return;
    }
    setEditingId(site.id);
    setDraftName(site.name);
    setDraftAddress(site.address ?? '');
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftName('');
    setDraftAddress('');
  }

  function saveEdit(siteId: string) {
    if (!draftName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateSiteAction(siteId, draftName.trim(), draftAddress.trim() || null);
        cancelEdit();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
      }
    });
  }

  function handleDelete(site: Row) {
    if (site.source === 'trackunit') {
      // Belt-and-braces: the button is also disabled, but bypass attempts
      // (e.g. devtools) should be told why.
      setError(
        'Trackunit-sourced sites cannot be deleted — the next sync would re-import them. Remove the site in Trackunit Manager instead.'
      );
      return;
    }
    if (
      !window.confirm(
        site.machineCount > 0
          ? `Delete "${site.name}"? ${site.machineCount} machine${site.machineCount === 1 ? '' : 's'} will lose their site assignment.`
          : `Delete "${site.name}"?`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteSiteAction(site.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed');
      }
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createSiteAction(fleetId, newName.trim(), newAddress.trim() || null);
        setNewName('');
        setNewAddress('');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Create failed');
      }
    });
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl ring-1 ring-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Address</th>
              <th className="px-4 py-3 text-right">Machines</th>
              <th className="px-4 py-3 w-40"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sites.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No sites yet for this fleet.
                </td>
              </tr>
            ) : (
              sites.map((s) => {
                const isTrackunit = s.source === 'trackunit';
                return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {editingId === s.id ? (
                      <input
                        type="text"
                        value={draftName}
                        autoFocus
                        onChange={(e) => setDraftName(e.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm w-full focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                      />
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="font-medium text-slate-900">{s.name}</span>
                        {isTrackunit && (
                          <span
                            className="inline-flex items-center rounded-full bg-sky-100 text-sky-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            title="Synced from Trackunit Manager — read-only here"
                          >
                            Trackunit
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {editingId === s.id ? (
                      <input
                        type="text"
                        value={draftAddress}
                        onChange={(e) => setDraftAddress(e.target.value)}
                        placeholder="Address (optional)"
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm w-full focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                      />
                    ) : (
                      s.address ?? <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{s.machineCount}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === s.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => saveEdit(s.id)}
                          disabled={pending}
                          className="rounded-md bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-2.5 py-1 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button type="button" onClick={cancelEdit} className="text-xs text-slate-500 hover:text-slate-700">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          type="button"
                          onClick={() => startEdit(s)}
                          disabled={isTrackunit}
                          title={
                            isTrackunit
                              ? 'Read-only — managed by Trackunit. Rename in Manager.'
                              : undefined
                          }
                          className="text-xs text-slate-600 hover:text-brand-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          disabled={pending || isTrackunit}
                          title={
                            isTrackunit
                              ? 'Cannot delete — the next Trackunit sync would re-create this site.'
                              : undefined
                          }
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleCreate} className="mt-4 flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Site name (e.g. Aalborg North)"
          className="flex-1 max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <input
          type="text"
          value={newAddress}
          onChange={(e) => setNewAddress(e.target.value)}
          placeholder="Address (optional)"
          className="flex-1 max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <button
          type="submit"
          disabled={pending || !newName.trim()}
          className="rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 disabled:opacity-50 whitespace-nowrap"
        >
          Add site
        </button>
      </form>
    </div>
  );
}
