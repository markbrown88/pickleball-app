// src/app/admin/games/[gameId]/ScoreEditor.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type MatchRow = {
  id: string;
  slot: string; // GameSlot
  teamAScore: number | null;
  teamBScore: number | null;
};

type Props = {
  gameId: string;
  teamAName: string;
  teamBName: string;
  matches: MatchRow[];
};

type EditRow = {
  id: string;
  slot: string;
  a: string; // text fields so user can clear -> ""
  b: string;
};

function toText(n: number | null | undefined) {
  return n == null ? "" : String(n);
}
function toNumOrNull(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

export default function ScoreEditor({ gameId, teamAName, teamBName, matches }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // local editable copy
  const [rows, setRows] = useState<EditRow[]>(
    matches.map((m) => ({ id: m.id, slot: m.slot, a: toText(m.teamAScore), b: toText(m.teamBScore) }))
  );

  // dirty tracking
  const initialKey = useMemo(
    () => JSON.stringify(matches.map((m) => [m.slot, m.teamAScore, m.teamBScore])),
    [matches]
  );
  const currentKey = useMemo(() => JSON.stringify(rows.map((r) => [r.slot, r.a, r.b])), [rows]);
  const dirty = initialKey !== currentKey;

  const totals = useMemo(() => {
    let a = 0, b = 0;
    for (const r of rows) {
      const av = toNumOrNull(r.a);
      const bv = toNumOrNull(r.b);
      if (Number.isFinite(av)) a += Number(av);
      if (Number.isFinite(bv)) b += Number(bv);
    }
    return { a, b };
  }, [rows]);

  function onChange(idx: number, which: "a" | "b", val: string) {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [which]: val };
      return copy;
    });
  }

  function reset() {
    setRows(matches.map((m) => ({ id: m.id, slot: m.slot, a: toText(m.teamAScore), b: toText(m.teamBScore) })));
  }

  async function saveAll() {
    // validate first
    for (const r of rows) {
      const av = toNumOrNull(r.a);
      const bv = toNumOrNull(r.b);
      if (!(av === null || Number.isInteger(av))) {
        alert(`Invalid score for ${r.slot} (${teamAName}). Use a non-negative integer or leave blank.`);
        return;
      }
      if (!(bv === null || Number.isInteger(bv))) {
        alert(`Invalid score for ${r.slot} (${teamBName}). Use a non-negative integer or leave blank.`);
        return;
      }
    }

    const payload = {
      matches: rows.map((r) => ({
        slot: r.slot,
        teamAScore: toNumOrNull(r.a),
        teamBScore: toNumOrNull(r.b),
      })),
    };

    const res = await fetch(`/api/admin/games/${encodeURIComponent(gameId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || `Failed to save (${res.status})`);
      return;
    }

    // Refresh server data
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-600">
          Totals — <span className="font-medium">{teamAName}</span>: {totals.a} ·{" "}
          <span className="font-medium">{teamBName}</span>: {totals.b}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!dirty || isPending}
            onClick={reset}
            className="text-sm rounded px-3 py-1 border hover:bg-gray-50 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            disabled={!dirty || isPending}
            onClick={saveAll}
            className="text-sm rounded px-3 py-1 border bg-black text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-4">Slot</th>
              <th className="py-1 pr-4">{teamAName}</th>
              <th className="py-1 pr-4">{teamBName}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id} className="border-t">
                <td className="py-2 pr-4">{r.slot}</td>
                <td className="py-2 pr-4">
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-20 border rounded px-2 py-1"
                    placeholder="—"
                    value={r.a}
                    onChange={(e) => onChange(idx, "a", e.target.value.replace(/[^\d]/g, ""))}
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-20 border rounded px-2 py-1"
                    placeholder="—"
                    value={r.b}
                    onChange={(e) => onChange(idx, "b", e.target.value.replace(/[^\d]/g, ""))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!rows.length && (
        <div className="text-sm text-gray-500">No matches seeded for this game.</div>
      )}
    </div>
  );
}
