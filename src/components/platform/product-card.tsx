import Link from "next/link";
import { ArrowRight, Check, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Product } from "@/lib/products";

/**
 * Product tile used on the platform homepage and products page.
 *
 * Live products link through to the product; upcoming ones render the same
 * card but are deliberately inert, so nothing on the platform leads to a
 * broken or empty page.
 */
export function ProductCard({ product }: { product: Product }) {
  const isActive = product.status === "active";

  const body = (
    <Card
      className={`p-6 h-full flex flex-col transition-colors ${
        isActive ? "cursor-pointer group hover:bg-accent/50" : "opacity-75"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isActive ? "bg-primary/10 group-hover:bg-primary/20 transition-colors" : "bg-muted"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${isActive ? "bg-primary" : "bg-muted-foreground/50"}`}
            />
          </div>
          <h3 className="font-semibold truncate">{product.name}</h3>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0 ${
            isActive
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isActive ? (
            <>
              <Check className="h-3 w-3" aria-hidden="true" />
              Active
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" aria-hidden="true" />
              Coming Soon
            </>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {product.category}
        </span>
        {isActive && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            v{product.version}
          </span>
        )}
      </div>

      <p className="text-sm font-medium mb-2">{product.tagline}</p>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
        {product.description}
      </p>

      <ul className="space-y-2 mb-5">
        {product.highlights.map((highlight) => (
          <li key={highlight} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check
              className={`h-4 w-4 shrink-0 mt-0.5 ${isActive ? "text-primary" : "text-muted-foreground/50"}`}
              aria-hidden="true"
            />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>

      {isActive ? (
        <span className="inline-flex items-center text-sm font-medium text-primary">
          Open {product.name}
          <ArrowRight
            className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">In development</span>
      )}
    </Card>
  );

  if (!isActive || !product.href) {
    // Rendered as a plain region so keyboard users are not sent to a dead link.
    return (
      <li aria-label={`${product.name}, coming soon`}>
        {body}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={product.href}
        aria-label={`Open ${product.name}`}
        className="rounded-2xl focus-visible:outline-none"
      >
        {body}
      </Link>
    </li>
  );
}
