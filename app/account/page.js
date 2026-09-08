import { requireUser, ROLE_NOTES } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { changeMyPasswordAction } from "@/lib/actions-users";

export const dynamic = "force-dynamic";

export default async function Account() {
  // Open to every role on purpose: needing an admin to rotate your own
  // password is how people end up never rotating it.
  const me = requireUser();

  return (
    <div>
      <PageHeader title="Your account" subtitle={me.email} />

      <div className="mb-5 card max-w-md">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">Name</dt><dd className="text-ink-800">{me.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">Sign in with</dt><dd className="text-ink-800">{me.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">Role</dt><dd className="text-ink-800">{me.role}</dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-ink-200 pt-3 text-2xs leading-relaxed text-ink-400">
          {ROLE_NOTES[me.role]} To change your name, email or role, ask an admin.
        </p>
      </div>

      <ChangePasswordForm action={changeMyPasswordAction} />
    </div>
  );
}
