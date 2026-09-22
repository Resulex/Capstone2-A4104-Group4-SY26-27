export function validateDocumentRequestStatusTransition(
    nextStatus: string,
    remark: string | undefined
  ): void {
    if (nextStatus === 'Rejected' && !remark) {
      throw new Error('Remarks are required when rejecting a document request.');
    }
  }