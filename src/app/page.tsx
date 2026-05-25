import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Learn English with AI</h1>
        <p className="text-muted-foreground">
          Improve your reading, vocabulary, and pronunciation through AI-generated content tailored to your CEFR level.
        </p>
      </div>
      <div className="max-w-sm">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Reading</CardTitle>
            <CardDescription>
              Generate AI passages, explore vocabulary with hover translations, and practice pronunciation word by word.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/reading">Start</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
