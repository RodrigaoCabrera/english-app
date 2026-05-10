import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const modules = [
  {
    href: "/vocabulary",
    title: "Vocabulary",
    description: "Read AI-generated texts and hover over words to see definitions and images.",
    emoji: "📖",
  },
  {
    href: "/reading",
    title: "Reading",
    description: "Record yourself reading aloud and get word-by-word pronunciation feedback.",
    emoji: "🎙️",
  },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Learn English with AI</h1>
        <p className="text-muted-foreground">
          Improve your reading, vocabulary, and pronunciation through AI-generated content tailored to your CEFR level.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {modules.map((mod) => (
          <Card key={mod.href} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>{mod.emoji}</span> {mod.title}
              </CardTitle>
              <CardDescription>{mod.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={mod.href}>Start</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
