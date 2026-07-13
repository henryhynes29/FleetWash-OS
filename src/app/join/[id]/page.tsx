import { redirect } from "next/navigation";
import { requireProfile, sb } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";

async function redeem(inviteId: string) {
  "use server";
  const { error } = await sb().rpc("redeem_invite", { p_invite: inviteId });
  if (error) throw new Error(error.message);
  redirect("/field");
}

export default async function Join({ params }: { params: { id: string } }) {
  const { user, profile } = await requireProfile();
  if (profile) redirect("/");
  if (!user) redirect(`/login?next=/join/${params.id}`);
  const boundRedeem = redeem.bind(null, params.id);
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form action={boundRedeem} className="card" style={{ maxWidth: 420, textAlign: "center" }}>
        <div className="disp" style={{ fontSize: 20 }}>Join the crew</div>
        <div className="dim" style={{ fontSize: 14, margin: "10px 0 16px" }}>You've been invited to a FleetWash OS company. Your checkoffs, hours, and notes will be tracked under your own account.</div>
        <button className="btn btn-green" style={{ width: "100%" }}>Accept invite</button>
      </form>
    </main>
  );
}
