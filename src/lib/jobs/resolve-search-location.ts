import type { JobSearchPreferences, Profile } from "@/types/database";

export function resolveSearchLocation(
  profile: Pick<Profile, "location">,
  preferences: JobSearchPreferences,
  formLocation?: string
): string | undefined {
  if (formLocation?.trim()) return formLocation.trim();
  if (preferences.preferred_locations?.length) {
    return preferences.preferred_locations[0];
  }
  return profile.location?.trim() || undefined;
}
