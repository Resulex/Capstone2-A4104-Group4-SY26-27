/** Pure logic: builds the next sequential incident id given the last one. */
export function computeNextIncidentId(year: number, lastIncidentId: string | null): string {
    const prefix = `INC-${year}`;
    const seq = lastIncidentId
      ? parseInt(lastIncidentId.slice(prefix.length), 10) + 1
      : 1;
    return `${prefix}${String(seq).padStart(5, '0')}`;
  }