"use client";

/**
 * JWT workspace surface.
 *
 * Decodes any JSON Web Token into its three segments and renders
 * the header, payload and signature. Surfaces the standard
 * expiry, issued-at and not-before claims so the user can read
 * off whether a token is currently valid.
 *
 * No signing, no verification — the tool only decodes what the
 * user pastes.
 *
 * Mirrors /components/socialpilot/surfaces/post-creator.tsx.
 */

import { useMemo, useState } from "react";
import { Clock, FileSignature, KeyRound, ShieldCheck, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "../toast";
import { ToolChrome } from "./shared/tool-chrome";
import {
  asJwtBody,
  copyToClipboard,
  decodeJwt,
  deleteDevSession,
  formatJwt,
} from "@/lib/devpilot";
import type { DevSession } from "@/lib/devpilot";

interface JwtSurfaceProps {
  session: DevSession;
  onChange: (next: DevSession) => void;
}

export function JwtSurface({ session, onChange }: JwtSurfaceProps) {
  const body = asJwtBody(session.body);
  const { toast } = useToast();
  const [token, setToken] = useState(body.token);

  const decoded = useMemo(() => decodeJwt(token), [token]);

  function commit(patch: Partial<typeof body>) {
    onChange({ ...session, body: { ...body, ...patch } });
  }

  function handleTokenChange(next: string) {
    setToken(next);
    commit({ token: next });
  }

  async function copyValue(label: string, value: string) {
    if (!value) {
      toast({ message: `${label} is empty`, tone: "info" });
      return;
    }
    const ok = await copyToClipboard(value);
    toast({ message: ok ? `${label} copied` : "Could not copy", tone: ok ? "success" : "error" });
  }

  const expiry = decoded.expiry;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ToolChrome
        title={session.meta.title}
        description="Decode a JSON Web Token and inspect header, payload, signature and expiry."
        isFavorite={body.isFavorite}
        onToggleFavorite={async () => {
          commit({ isFavorite: !body.isFavorite });
        }}
        onCopy={async () => {
          await copyValue("Token", token);
        }}
        copyLabel="Copy token"
        onDelete={async () => {
          await deleteDevSession(session.meta.id);
          toast({ message: "Session deleted", tone: "info" });
        }}
        status={
          decoded.ok ? (
            <span className="inline-flex items-center gap-1 text-primary">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Decoded three segments
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-destructive">
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              {decoded.error ?? "Invalid token"}
            </span>
          )
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Card className="p-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Encoded JWT</span>
            <textarea
              value={token}
              onChange={(event) => handleTokenChange(event.target.value)}
              placeholder="eyJhbGciOi…"
              className="min-h-[80px] rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          </label>
        </Card>

        {decoded.ok && (
          <div className="grid gap-3 lg:grid-cols-2">
            <SectionCard
              icon={<KeyRound className="h-3.5 w-3.5" aria-hidden="true" />}
              title="Header"
              json={formatJwt(decoded.header.value)}
              onCopy={() => copyValue("Header", formatJwt(decoded.header.value))}
            />
            <SectionCard
              icon={<FileSignature className="h-3.5 w-3.5" aria-hidden="true" />}
              title="Payload"
              json={formatJwt(decoded.payload.value)}
              onCopy={() => copyValue("Payload", formatJwt(decoded.payload.value))}
            />
            <Card className="p-3 lg:col-span-2">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Signature
              </div>
              <Input
                value={decoded.signature}
                readOnly
                className="h-8 font-mono text-xs"
                aria-label="Signature"
              />
              <p className="mt-2 text-[10px] text-muted-foreground">
                The signature is shown as a base64url string. This tool does
                not verify it.
              </p>
            </Card>
            {expiry && (
              <Card className="p-3 lg:col-span-2">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  Expiry information
                </div>
                <dl className="grid grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-2">
                  <Row label="Expires at" value={expiry.expiresAt ?? "—"} />
                  <Row
                    label="Status"
                    value={
                      expiry.expired
                        ? "Expired"
                        : expiry.notYetValid
                          ? "Not yet valid"
                          : "Currently valid"
                    }
                    tone={
                      expiry.expired
                        ? "destructive"
                        : expiry.notYetValid
                          ? "warning"
                          : "success"
                    }
                  />
                  <Row
                    label="Seconds to expiry"
                    value={
                      expiry.secondsToExpiry === null
                        ? "—"
                        : String(expiry.secondsToExpiry)
                    }
                  />
                  <Row label="Not before" value={expiry.notBefore ?? "—"} />
                  <Row label="Issued at" value={expiry.issuedAt ?? "—"} />
                </dl>
              </Card>
            )}
          </div>
        )}

        {!decoded.ok && decoded.error && (
          <Card className="border-destructive/40 p-4 text-xs text-destructive">
            <p className="font-semibold">Could not decode the token.</p>
            <p className="mt-1 text-[11px]">{decoded.error}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  json: string;
  onCopy: () => void;
}

function SectionCard({ icon, title, json, onCopy }: SectionCardProps) {
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold">
          {icon}
          {title}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Copy
        </button>
      </div>
      <pre className="max-h-[260px] overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
        {json}
      </pre>
    </Card>
  );
}

interface RowProps {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "destructive";
}

function Row({ label, value, tone = "default" }: RowProps) {
  const valueClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "success"
        ? "text-primary"
        : tone === "warning"
          ? "text-yellow-600 dark:text-yellow-400"
          : "text-foreground";
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums font-medium ${valueClass}`}>{value}</dd>
    </div>
  );
}
