export function validateIncidentStatusTransition(
    currentIncidentId: string,
    nextStatus: string,
    remark: string | undefined,
    duplicateOfIncidentId: string | undefined
  ): void {
    if (nextStatus === 'Closed' && !remark) {
      throw new Error('Remarks are required when closing an incident report.');
    }
    if (nextStatus === 'Duplicate') {
      if (!remark) {
        throw new Error('Remarks are required when marking an incident report as a duplicate.');
      }
      const target = duplicateOfIncidentId?.trim();
      if (!target) {
        throw new Error('The original incident is required when marking a report as a duplicate.');
      }
      if (target === currentIncidentId) {
        throw new Error('An incident report cannot be a duplicate of itself.');
      }
    }
  }