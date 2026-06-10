import { ArenaExperience } from "@/components/arena-experience";
import { getArenaData } from "@/lib/arena-data";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const joinParam = params?.join;
  const joinCode = Array.isArray(joinParam) ? joinParam[0] : joinParam;
  const data = await getArenaData({ joinCode });
  return <ArenaExperience data={data} joinCode={joinCode} />;
}
