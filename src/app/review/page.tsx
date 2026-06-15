import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { getDueWords } from "@/services/srs";
import { ReviewSession } from "@/components/review/ReviewSession";

export default async function ReviewPage() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const words = await getDueWords(userId, 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Review</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Spaced repetition for your saved words
        </p>
      </div>
      <ReviewSession initialWords={words} />
    </div>
  );
}
