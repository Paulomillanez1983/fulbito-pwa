import { ArenaExperience } from "@/components/arena-experience";
import { getArenaData } from "@/lib/arena-data";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const joinParam = params?.join;
  const teamParam = params?.team;
  const friendlyParam = params?.friendly;
  const joinCode = Array.isArray(joinParam) ? joinParam[0] : joinParam;
  const inviteTeamCode = Array.isArray(teamParam) ? teamParam[0] : teamParam;
  const friendlyCode = Array.isArray(friendlyParam) ? friendlyParam[0] : friendlyParam;
  const data = await getArenaData({ joinCode, friendlyCode, teamCode: inviteTeamCode });
  return <ArenaExperience data={data} friendlyCode={friendlyCode} joinCode={joinCode} inviteTeamCode={inviteTeamCode} />;
}
