import { PortalGuestPro } from "@/components/legal-eye-portal-guest";

export default async function ClientPortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PortalGuestPro slug={slug} />;
}
