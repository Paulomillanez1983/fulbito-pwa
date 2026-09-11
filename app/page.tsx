import { ArenaExperience } from "@/components/arena-experience";
import { OutdoorModeToggle } from "@/components/outdoor-mode-toggle";
import { OnboardingTour } from "@/components/onboarding-tour";
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
  const venueRegisterParam = params?.venue_register || params?.register_venue;
  const startParam = params?.start;
  
  const joinCode = Array.isArray(joinParam) ? joinParam[0] : joinParam;
  const inviteTeamCode = Array.isArray(teamParam) ? teamParam[0] : teamParam;
  const friendlyCode = Array.isArray(friendlyParam) ? friendlyParam[0] : friendlyParam;
  const venueRegister = venueRegisterParam === "true" || startParam === "venue_register" || startParam === "venues_register";
  const initialStartMode = typeof startParam === "string" ? startParam : Array.isArray(startParam) ? startParam[0] : undefined;
  
  const data = await getArenaData({ joinCode, friendlyCode, teamCode: inviteTeamCode });

  return (
    <>
      <div className="fixed top-3 right-3 z-40 flex items-center gap-2">
        <OutdoorModeToggle />
      </div>
      <OnboardingTour userRole={data.user?.roles?.[0] ?? "jugador"} />
      <ArenaExperience 
        data={data} 
        friendlyCode={friendlyCode} 
        initialStartMode={initialStartMode}
        inviteTeamCode={inviteTeamCode} 
        joinCode={joinCode} 
        venueRegister={venueRegister}
      />
    </>
  );
}
