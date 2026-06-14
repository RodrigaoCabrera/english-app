import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <SignUp />
    </div>
  );
}
