import React from 'react';
import { Typography, Box, Alert, Stack } from '@mui/material';
import { AdminConsentStatus } from '../../components/AdminConsentStatus/AdminConsentStatus';

const SettingsPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        設定
      </Typography>
      
      <Stack spacing={3}>
        <AdminConsentStatus />
        
        <Alert severity="info">
          その他の設定項目は現在開発中です。
        </Alert>
      </Stack>
    </Box>
  );
};

export default SettingsPage;
