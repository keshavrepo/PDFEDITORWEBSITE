"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { tools, type ToolCategory } from "@/lib/tools";

const categoryOrder: ToolCategory[] = ["Convert", "Organize", "Optimize", "Edit", "Security"];

export function ToolsDirectory() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(
    () => tools.filter((tool) => !normalized || `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(normalized)),
    [normalized]
  );

  return (
    <>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="max-w-2xl"><h1 className="text-4xl md:text-5xl font-bold mb-4">All Tools</h1><p className="text-lg text-muted-foreground mb-8">Everything you need to work with PDFs</p><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools..." className="pl-10" aria-label="Search PDF tools" /></div></div>
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="space-y-14">
          {categoryOrder.map((category) => {
            const categoryTools = filtered.filter((tool) => tool.category === category);
            if (!categoryTools.length) return null;
            return <div key={category}><h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">{category}</h2><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">{categoryTools.map((tool) => <Link key={tool.id} href={tool.href}><Card className="p-5 h-full hover:bg-accent transition-colors cursor-pointer group"><h3 className="font-semibold mb-1 group-hover:translate-x-0.5 transition-transform">{tool.name}</h3><p className="text-sm text-muted-foreground">{tool.description}</p></Card></Link>)}</div></div>;
          })}
          {!filtered.length && <Card className="p-12 text-center"><h2 className="font-semibold mb-2">No tools found</h2><p className="text-sm text-muted-foreground">Try a broader search term.</p></Card>}
        </div>
      </section>
    </>
  );
}
