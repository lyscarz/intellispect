'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Fleet } from '@/lib/types';
import { createFleetAction, deleteFleetAction, renameFleetAction } from './actions';

interface Row extends Fleet {
  machineCount: number;
}

export function FleetsTable({ fleets }: { fleets: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  function startEdit(fleet: Row) {
    setEditingId(fleet.id);
    setDraftName(fleet.name);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftName('');
  }

  function saveRename(fleetId: string) {
    if (!draftName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await renameFleetAction(fleetId, draftName.trim());
        setEditingId(null);
        setDraftName('');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Rename failed');
      }
    });
  }

  function handleDelete(fleet: Row) {
    if (fleet.machineCount > 0) {
      window.alert(
        `Move or delete the ${fleet.machineCount} machine${fleet.machineCount === 1 ? '' : 's'} in "${fleet.name}" before deleting this fleet.`
      );
      return;
    }
    if (!window.confirm(`Delete fleet "${fleet.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteFleetAction(fleet.id);
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
        await createFleetAction(newName.trim());
        setNewName('');
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
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-right">Machines</th>
              <th className="px-4 py-3 w-40"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fleets.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No fleets yet.
                </td>
              </tr>
            ) : (
              fleets.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {editingId === f.id ? (
                      <input
                        type="text"
                        value={draftName}
                        autoFocus
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(f.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm w-full focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                      />
                    ) : (
                      <span className="font-medium text-slate-900">{f.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">#{f.slug}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{f.machineCount}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === f.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => saveRename(f.id)}
                          disabled={pending}
                          className="rounded-md bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-2.5 py-1 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          type="button"
                          onClick={() => startEdit(f)}
                          className="text-xs text-slate-600 hover:text-brand-700"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(f)}
                          disabled={pending}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleCreate} className="mt-4 flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New fleet name (e.g. Denmark)"
          className="flex-1 max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <button
          type="submit"
          disabled={pending || !newName.trim()}
          className="rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 disabled:opacity-50"
        >
          Create fleet
        </button>
      </form>
    </div>
  );
}
