"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MessageStatus({ id, initialStatus }: { id: string; initialStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function update(nextStatus: string) {
    setStatus(nextStatus);
    setSaving(true);
    setError(false);
    const response = await fetch(`/api/admin/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!response.ok) setError(true);
    else router.refresh();
    setSaving(false);
  }

  return (
    <div>
      <select
        value={status}
        onChange={(event) => void update(event.target.value)}
        disabled={saving}
        className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
        aria-label="Message status"
      >
        <option value="new">New</option>
        <option value="in_progress">In progress</option>
        <option value="resolved">Resolved</option>
      </select>
      {error && <p className="mt-1 text-xs text-destructive">Update failed</p>}
    </div>
  );
}
