import { ArenaExperience } from "@/components/arena-experience";
import { getArenaData } from "@/lib/arena-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getArenaData();
  return <ArenaExperience data={data} />;
}
