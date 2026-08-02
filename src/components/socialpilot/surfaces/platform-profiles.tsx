"use client";

/**
 * Platform Profiles — Batch 3 surface.
 *
 * Manages every social profile the user owns. Profiles are grouped
 * by platform (Facebook, Instagram, X, LinkedIn, YouTube, TikTok,
 * Threads, Pinterest). Each profile has a name, handle, URL,
 * notes and a "default for this platform" flag. The future
 * scheduler will reuse this list.
 */

import { useEffect, useState } from "react";
import { Plus, Save, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { cn } from "@/lib/utils";
import { asProfileBody } from "@/lib/socialpilot/bodies";
import {
  PLATFORMS,
  platformLabel,
} from "@/lib/socialpilot/platforms";
import type {
  SocialPlatformKey,
  SocialPlatformProfile,
  SocialProject,
} from "@/lib/socialpilot";

interface PlatformProfilesProps {
  project: SocialProject;
  onChange: (next: SocialProject) => void;
}

function randomId(): string {
  return `profile-${Math.random().toString(36).slice(2, 10)}`;
}

export function PlatformProfiles({ project, onChange }: PlatformProfilesProps) {
  // The project body is the per-project "draft" of the profiles; on
  // save we mirror it to the server row. The right-rail / workspace
  // reads the server row through the same endpoint.
  const body = asProfileBody(project.body);
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<SocialPlatformProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/socialpilot/platform-profiles");
        if (res.ok) {
          const data = (await res.json()) as { profiles?: SocialPlatformProfile[] };
          if (!cancelled) {
            setProfiles(data.profiles ?? []);
            onChange({ ...project, body: data.profiles ?? [] });
          }
        }
      } catch {
        if (!cancelled) setProfiles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setProfilesAndBody(next: SocialPlatformProfile[]) {
    setProfiles(next);
    onChange({ ...project, body: next });
  }

  function addProfile(platform: SocialPlatformKey) {
    const next: SocialPlatformProfile = {
      id: randomId(),
      platform,
      name: `${platformLabel(platform)} profile`,
      handle: "",
      url: "",
      notes: "",
      isDefault: profiles.filter((p) => p.platform === platform).length === 0,
    };
    setProfilesAndBody([...profiles, next]);
  }

  function updateProfile(id: string, patch: Partial<SocialPlatformProfile>) {
    setProfilesAndBody(
      profiles.map((profile) =>
        profile.id === id ? { ...profile, ...patch } : profile
      )
    );
  }

  function removeProfile(id: string) {
    setProfilesAndBody(profiles.filter((profile) => profile.id !== id));
  }

  function setDefault(id: string) {
    const target = profiles.find((profile) => profile.id === id);
    if (!target) return;
    setProfilesAndBody(
      profiles.map((profile) => ({
        ...profile,
        isDefault:
          profile.platform === target.platform ? profile.id === id : profile.isDefault,
      }))
    );
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/socialpilot/platform-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profiles }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = (await res.json()) as { profiles?: SocialPlatformProfile[] };
      setProfiles(data.profiles ?? profiles);
      toast({ message: "Profiles saved", tone: "success" });
    } catch {
      toast({ message: "Could not save profiles", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading profiles…
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Platform profiles</p>
        <Button
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={save}
          disabled={saving}
        >
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Manage every social profile in one place. The future scheduler
        will reuse this list to know which profile to publish to.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {PLATFORMS.map((platform) => {
          const platformProfiles = profiles.filter(
            (profile) => profile.platform === platform.key
          );
          return (
            <Card key={platform.key} className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold",
                      platform.color
                    )}
                    aria-hidden="true"
                  >
                    {platform.initials}
                  </span>
                  <p className="text-sm font-semibold">{platform.name}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-2 text-[10px]"
                  onClick={() => addProfile(platform.key)}
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  Add
                </Button>
              </div>
              {platformProfiles.length === 0 ? (
                <p className="text-xs text-muted-foreground">No profiles yet</p>
              ) : (
                <ul className="space-y-2">
                  {platformProfiles.map((profile) => (
                    <li
                      key={profile.id}
                      className="rounded-lg border border-border bg-background p-2"
                    >
                      <div className="mb-1 flex items-center gap-1">
                        <Input
                          value={profile.name}
                          onChange={(event) =>
                            updateProfile(profile.id, { name: event.target.value })
                          }
                          className="h-7 text-xs"
                          aria-label="Profile name"
                          placeholder="Name"
                        />
                        <button
                          type="button"
                          onClick={() => setDefault(profile.id)}
                          className={cn(
                            "rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground",
                            profile.isDefault && "text-primary"
                          )}
                          aria-label={
                            profile.isDefault
                              ? "Default for this platform"
                              : "Make default for this platform"
                          }
                          title={
                            profile.isDefault
                              ? "Default for this platform"
                              : "Make default"
                          }
                        >
                          <Star
                            className={cn(
                              "h-3.5 w-3.5",
                              profile.isDefault && "fill-primary"
                            )}
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeProfile(profile.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label={`Remove ${profile.name}`}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <Input
                          value={profile.handle}
                          onChange={(event) =>
                            updateProfile(profile.id, { handle: event.target.value })
                          }
                          className="h-7 text-xs"
                          aria-label="Handle"
                          placeholder="@handle"
                        />
                        <Input
                          value={profile.url}
                          onChange={(event) =>
                            updateProfile(profile.id, { url: event.target.value })
                          }
                          className="h-7 text-xs"
                          aria-label="Profile URL"
                          placeholder="https://"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
