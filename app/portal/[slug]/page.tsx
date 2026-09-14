import { PortalGuest } from "@/components/legal-eye-portal";

export default async function ClientPortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PortalGuest slug={slug} />;
}
