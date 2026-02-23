import { redirect } from "next/navigation";

// Clean invite URL:
//  https://greenpassgroup.com/join?invite=...&token=...
// We forward to HomeClient (/) so the existing auth UI can handle sign-in/sign-up,
// then it will accept the invite after auth.

export const dynamic = "force-dynamic";

export default function JoinPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const invite = Array.isArray(searchParams.invite)
    ? searchParams.invite[0]
    : searchParams.invite;
  const token = Array.isArray(searchParams.token)
    ? searchParams.token[0]
    : searchParams.token;
  const lang = Array.isArray(searchParams.lang) ? searchParams.lang[0] : searchParams.lang;

  const sp = new URLSearchParams();
  if (invite) sp.set("invite", invite);
  if (token) sp.set("token", token);
  if (lang) sp.set("lang", lang);

  const qs = sp.toString();
  redirect(qs ? `/?${qs}` : "/");
}
