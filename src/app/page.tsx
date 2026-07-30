import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Upload, Shield, Zap, Check, Lock, Users, Award } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSession();

  const tools = [
    { name: "Merge PDF", href: "/tools/merge-pdf" },
    { name: "Split PDF", href: "/tools/split-pdf" },
    { name: "Compress PDF", href: "/tools/compress-pdf" },
    { name: "PDF to Word", href: "/tools/pdf-to-word" },
    { name: "PDF to Image", href: "/tools/pdf-to-image" },
    { name: "Sign PDF", href: "/tools/sign-pdf" },
    { name: "Protect PDF", href: "/tools/protect-pdf" },
    { name: "Rotate PDF", href: "/tools/rotate-pdf" },
  ];

  const features = [
    {
      icon: Zap,
      title: "Process in seconds",
      description: "Enterprise-grade infrastructure ensures your files are processed instantly",
    },
    {
      icon: Lock,
      title: "Bank-level security",
      description: "256-bit SSL encryption with automatic file deletion after 24 hours",
    },
    {
      icon: Users,
      title: "Trusted by 500K+ users",
      description: "Join professionals worldwide who rely on PDFPilot daily",
    },
  ];

  const trustSignals = [
    { metric: "10M+", label: "Files processed" },
    { metric: "500K+", label: "Active users" },
    { metric: "99.9%", label: "Uptime" },
    { metric: "4.9/5", label: "User rating" },
  ];

  return (
    <>
      <Navbar user={user} />
      
      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-24 md:pt-28 md:pb-32">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Award className="w-4 h-4" />
                Trusted by 500,000+ professionals
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-[1.1]">
                Professional PDF tools<br />for modern teams
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
                Transform, edit, and manage your PDFs with precision.<br className="hidden sm:block" />
                Fast, secure, and incredibly easy to use.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild>
                  <Link href="/tools">
                    Start for free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/pricing">View pricing</Link>
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mt-6">
                No credit card required • Free forever
              </p>
            </div>

            {/* Upload Hero Card */}
            <div className="max-w-3xl mx-auto">
              <Link href="/tools">
                <Card className="p-12 md:p-16 hover:scale-[1.01] transition-all cursor-pointer group">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6 group-hover:bg-primary/20 transition-colors">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    
                    <h3 className="text-2xl font-semibold mb-2">
                      Drop your PDF here
                    </h3>
                    <p className="text-muted-foreground mb-8">
                      or click to browse files
                    </p>
                    
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {tools.slice(0, 4).map((tool) => (
                        <span
                          key={tool.name}
                          className="px-3 py-1.5 rounded-lg bg-muted text-sm font-medium"
                        >
                          {tool.name}
                        </span>
                      ))}
                      <span className="px-3 py-1.5 text-sm text-muted-foreground">
                        +{tools.length - 4} more
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </div>
        </section>

        {/* Trust Signals */}
        <section className="border-y bg-muted/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {trustSignals.map((signal) => (
                <div key={signal.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold mb-1">{signal.metric}</div>
                  <div className="text-sm text-muted-foreground">{signal.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 md:py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Built for professionals
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to work with PDFs, backed by enterprise-grade infrastructure
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature) => (
                <Card key={feature.title} className="p-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-6">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Tools Grid */}
        <section className="py-24 md:py-32 bg-muted/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                All the tools you need
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Professional-grade PDF tools for every use case
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {tools.map((tool) => (
                <Link key={tool.name} href={tool.href}>
                  <Card className="p-6 hover:scale-[1.02] transition-all group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                      <h3 className="font-semibold">{tool.name}</h3>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>

            <div className="text-center mt-10">
              <Button variant="outline" asChild>
                <Link href="/tools">
                  View all tools
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="py-24 md:py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Your files are safe with us
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  We take security seriously. All files are encrypted in transit and at rest,
                  and automatically deleted from our servers after 24 hours.
                </p>
                <div className="space-y-4">
                  {[
                    "256-bit SSL encryption",
                    "Automatic file deletion",
                    "GDPR compliant",
                    "No data sharing",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Card className="p-12">
                <div className="flex items-center justify-center h-64">
                  <Shield className="w-32 h-32 text-primary/20" />
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 md:py-32 bg-muted/30">
          <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to get started?
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              Join thousands of professionals who trust PDFPilot
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/register">
                  Start for free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/contact">Contact sales</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
