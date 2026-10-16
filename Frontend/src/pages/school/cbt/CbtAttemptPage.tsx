import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useParams } from 'react-router-dom';
import { cbtApi, type CbtAttemptPayload, type CbtResultPayload } from '../../../api/cbt';
import { apiErrorMessage } from '../../../api/client';
import { CbtTakeExam } from './CbtTakeExam';
import { CbtResultView } from './CbtResult';

/**
 * One route serves both phases of an attempt: while it is live the candidate
 * gets the exam interface, and once it is submitted or has timed out the same
 * URL renders the result (so a refresh never loses the candidate).
 */
export function CbtAttemptPage() {
  const { attemptId = '' } = useParams();
  const [live, setLive] = useState<CbtAttemptPayload | CbtResultPayload | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cbt', 'attempt', attemptId],
    queryFn: () => cbtApi.getAttempt(attemptId),
    enabled: !!attemptId,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !live && !data) {
    return <Alert severity="error">{apiErrorMessage(error)}</Alert>;
  }

  const current = live ?? data;
  if (!current) {
    return <Alert severity="error">Attempt not found</Alert>;
  }

  if (current.mode === 'result') {
    return <CbtResultView result={current} />;
  }

  return (
    <CbtTakeExam
      payload={current}
      onFinished={(result) => setLive(result)}
    />
  );
}
