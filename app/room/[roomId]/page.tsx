import LiveMonitor from "@/components/LiveMonitor";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const resolvedParams = await params;
  return <LiveMonitor roomId={resolvedParams.roomId} />;
}
