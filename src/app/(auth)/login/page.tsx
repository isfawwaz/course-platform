import { LoginForm } from "./login-form";

const ERROR_MESSAGES: Record<string, string> = {
  auth: "That sign-in link was invalid or expired. Please try again.",
  missing_code: "The sign-in link was incomplete. Please try again.",
  missing_token: "The sign-in link was incomplete. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginForm initialError={error ? ERROR_MESSAGES[error] : undefined} />;
}
