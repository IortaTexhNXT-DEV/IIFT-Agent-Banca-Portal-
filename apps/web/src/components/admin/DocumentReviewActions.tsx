import { Button, Flex, Popconfirm } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { DocumentView } from '../../api/types';
import { RemarksModal } from './RemarksModal';

type Decision = { decision: 'VERIFIED' | 'REJECTED'; remarks?: string };

function useReview(documentId: string, options: { onSuccess?: () => void; errorNotice?: string }) {
  return useApiMutation(
    (body: Decision) => api.post<DocumentView>(`/backoffice/documents/${documentId}/review`, body),
    {
      success: (result) =>
        result.status === 'REJECTED' ? 'Document rejected' : 'Document verified',
      invalidate: ['/common/documents', '/backoffice'],
      ...options,
    },
  );
}

/** BO-11/12: verify or reject an uploaded document (rejection needs remarks). */
export function DocumentReviewActions({ document }: { document: DocumentView }) {
  const [rejecting, setRejecting] = useState(false);
  const verify = useReview(document.id, { errorNotice: 'Document not verified' });
  const reject = useReview(document.id, { onSuccess: () => setRejecting(false) });

  if (document.status !== 'UPLOADED' || document.systemGenerated) return null;
  return (
    <Flex gap={4}>
      <Popconfirm
        title={`Verify ${document.fileName}?`}
        description="Confirm it is legible, complete and valid."
        okText="Verify"
        onConfirm={() => verify.mutate({ decision: 'VERIFIED' })}
      >
        <Button size="small" type="link" loading={verify.isPending}>
          Verify
        </Button>
      </Popconfirm>
      <Button size="small" type="link" danger onClick={() => setRejecting(true)}>
        Reject
      </Button>
      {rejecting && (
        <RemarksModal
          title={`Reject ${document.fileName}`}
          okText="Reject document"
          label="Reason for rejection"
          required
          danger
          maxLength={500}
          pending={reject.isPending}
          error={reject.error}
          errorTitle="Document not rejected"
          onSubmit={(remarks) => reject.mutate({ decision: 'REJECTED', remarks })}
          onClose={() => setRejecting(false)}
        />
      )}
    </Flex>
  );
}
