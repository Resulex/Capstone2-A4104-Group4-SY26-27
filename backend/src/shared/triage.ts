/**
 * Rule-based triage: the system derives the severity from the incident
 * category + certain urgency keywords in the description (not chosen by a
 * human). Falls back to 'Low'.
 */
export function computeTriagePriority(
    category: string,
    description: string
  ): 'Critical' | 'High' | 'Medium' | 'Low' {
    const text = `${category} ${description}`.toLowerCase();
    if (
      /\b(fire|burning|life|critical|emergency|death|unconscious|sunog|nasusunog|apoy|buhay|patay|kritikal|emerhensiya|walang malay|sakuna)\b/.test(
        text
      )
    ) {
      return 'Critical';
    }
    if (
      /\b(criminal|robbery|assault|stab|shooting|accident|major|severe|krimen|nakawan|saksak|pamamaril|aksidente|seryoso|malala|suntukan)\b/.test(
        text
      )
    ) {
      return 'High';
    }
    if (
      /\b(flood|water|infrastructure|damage|disturbance|injury|baha|tubig|sira|nasira|gulo|pinsala|basag)\b/.test(
        text
      )
    ) {
      return 'Medium';
    }
    return 'Low';
  }