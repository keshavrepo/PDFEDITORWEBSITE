import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { AudioWorkspace } from "@/components/audiopilot/workspace";
import { WorkspaceDashboard } from "@/components/audiopilot/surfaces/workspace-dashboard";
import { platform } from "@/lib/products";
import { getAppUrl } from "@/lib/env";

const description =
  "AudioPilot is LaunchStack's audio workspace. Batch 1 ships a reusable audio workspace with an Audio Player with playback controls, waveform preview and transport, an Audio Trimmer with precision controls and undo / redo, an Audio Converter for MP3, WAV, OGG, FLAC and AAC with metadata preservation, and a Recorder with microphone capture, pause, resume, stop and save. The same LaunchStack platform hosts PDFPilot, ImagePilot, OfficePilot, DevPilot, SocialPilot, FinancePilot and WebPilot.";
const url = `${getAppUrl()}/audiopilot`;

export const metadata: Metadata = {
  title: `AudioPilot | ${platform.name}`,
  description,
  alternates: { canonical: url },
  openGraph: {
    title: `AudioPilot | ${platform.name}`,
    description,
    url,
    type: "website",
    siteName: platform.name,
  },
};

export const dynamic = "force-dynamic";

/**
 * The default AudioPilot route. The workspace shell handles its
 * own navigation rail and surfaces, so this page is just a host.
 *
 * The default surface is the Workspace Dashboard; every other
 * tool lives at `/audiopilot/<slug>` and the rail links to all
 * of them.
 */
export default async function AudioPilotPage() {
  const user = await getSession();

  return (
    <>
      <Navbar user={user} />
      <main className="pt-16">
        <h1 className="sr-only">AudioPilot</h1>
        <div className="h-[calc(100dvh-4rem)] min-h-[520px]">
          <AudioWorkspace
            kind="dashboard"
            Surface={WorkspaceDashboard}
          />
        </div>
      </main>
    </>
  );
}
