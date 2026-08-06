import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const HUB_LINKS = [
  {
    href: "/search",
    title: "Search",
    description:
      "Browse and query game data across realms, awakeners, covenants, and more.",
  },
  {
    href: "/calculator",
    title: "Calculator",
    description:
      "Run Path Carver–aligned tools for keyflare, resist, HP, damage, and mastery.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Mother Tree
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Public hub for read-only Search and Calculator tools. More tools will
          appear here as they ship.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {HUB_LINKS.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-500">Coming soon — placeholder</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
