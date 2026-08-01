import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { ContactForm } from "@/components/contact-form";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact | PDFPilot",
  description: "Contact PDFPilot and Keshav Labs in Delhi, India.",
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const user = await getSession();
  return (
    <>
      <Navbar user={user} />
      <main>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-14">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-4">Keshav Labs</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact</h1>
            <p className="text-lg text-muted-foreground">Send a product, support, business, or privacy enquiry to the team behind PDFPilot.</p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="grid lg:grid-cols-2 gap-12">
            <Card className="p-6 sm:p-8"><ContactForm defaultEmail={user?.email} /></Card>
            <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-8 content-start">
              <div><h2 className="font-semibold mb-2">Public and support email</h2><a className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4" href={`mailto:${siteConfig.publicEmail}`}>{siteConfig.publicEmail}</a></div>
              <div><h2 className="font-semibold mb-2">Founder</h2><p className="text-sm text-muted-foreground">{siteConfig.founder}, founder of {siteConfig.company}<br /><a className="hover:text-foreground underline underline-offset-4" href={`mailto:${siteConfig.founderEmail}`}>{siteConfig.founderEmail}</a></p></div>
              <div><h2 className="font-semibold mb-2">Location</h2><p className="text-sm text-muted-foreground">{siteConfig.location}</p></div>
              <div><h2 className="font-semibold mb-2">Office</h2><p className="text-sm text-muted-foreground">{siteConfig.office.map((line) => <span key={line}>{line}<br /></span>)}</p></div>
              <div><h2 className="font-semibold mb-2">Business hours</h2><p className="text-sm text-muted-foreground leading-6">{siteConfig.businessHours.map((line) => <span key={line}>{line}<br /></span>)}</p></div>
              <p className="text-sm text-muted-foreground">Messages are stored securely so our team can track and respond to your enquiry.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
