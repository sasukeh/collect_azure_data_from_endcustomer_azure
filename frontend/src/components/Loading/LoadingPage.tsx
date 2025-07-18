import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const LoadingPage: React.FC = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
      }}
    >
      <CircularProgress size={60} />
      <Typography variant="h6" color="text.secondary">
        読み込み中...
      </Typography>
    </Box>
  );
};

export default LoadingPage;
