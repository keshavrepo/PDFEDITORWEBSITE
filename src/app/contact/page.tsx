import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const user = await getSession();

  return (
    <>
      <Navbar user={user} />
      
      <main>
        {/* Header */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Contact
            </h1>
            <p className="text-lg text-muted-foreground">
              Get in touch with our team
            </p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div>
              <Card className="p-8">
                <form className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">First name</label>
                      <Input placeholder="John" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Last name</label>
                      <Input placeholder="Doe" required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input type="email" placeholder="john@example.com" required />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Message</label>
                    <textarea
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="How can we help?"
                      required
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full">
                    Send message
                  </Button>
                </form>
              </Card>
            </div>

            {/* Contact Information */}
            <div className="space-y-8">
              <div>
                <h3 className="font-semibold mb-2">Email</h3>
                <p className="text-sm text-muted-foreground">hello@pdfpilot.com</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Support</h3>
                <p className="text-sm text-muted-foreground">
                  We typically respond within 24 hours
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Office</h3>
                <p className="text-sm text-muted-foreground">
                  123 Business Ave<br />
                  San Francisco, CA 94102<br />
                  United States
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Business hours</h3>
                <p className="text-sm text-muted-foreground">
                  Monday - Friday: 9am - 6pm PST<br />
                  Saturday: 10am - 4pm PST<br />
                  Sunday: Closed
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
