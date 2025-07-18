import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Container, 
  Alert,
  Divider,
  Stack
} from '@mui/material';
import { 
  AccountCircle,
  Business,
  Microsoft 
} from '@mui/icons-material';
import { useMsal } from '@azure/msal-react';
import { 
  loginRequest, 
  personalAccountLoginRequest, 
  workAccountLoginRequest 
} from '../../config/authConfig';

const LoginPage: React.FC = () => {
  const { instance } = useMsal();
  const [isLoading, setIsLoading] = useState(false);

  const handlePersonalLogin = async () => {
    setIsLoading(true);
    try {
      console.log('Personal account login request:', personalAccountLoginRequest);
      await instance.loginRedirect(personalAccountLoginRequest);
    } catch (error) {
      console.error('Personal account login failed:', error);
      setIsLoading(false);
    }
  };

  const handleWorkLogin = async () => {
    setIsLoading(true);
    try {
      console.log('Work account login request:', workAccountLoginRequest);
      await instance.loginRedirect(workAccountLoginRequest);
    } catch (error) {
      console.error('Work account login failed:', error);
      setIsLoading(false);
    }
  };

  const handleGeneralLogin = async () => {
    setIsLoading(true);
    try {
      console.log('General login request:', loginRequest);
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('General login failed:', error);
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            width: '100%',
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom>
            Azure Data Collector
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            Azureリソースの監視とコスト分析を行うダッシュボードです。
          </Typography>
          
          <Alert severity="info" sx={{ width: '100%', mb: 2 }}>
            個人アカウント（hotmail.com等）とWork/Schoolアカウントの両方でログインできます
          </Alert>

          <Stack spacing={2} sx={{ width: '100%' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<AccountCircle />}
              onClick={handlePersonalLogin}
              fullWidth
              sx={{ py: 1.5 }}
              disabled={isLoading}
            >
              個人アカウントでログイン
            </Button>
            
            <Button
              variant="outlined"
              size="large"
              startIcon={<Business />}
              onClick={handleWorkLogin}
              fullWidth
              sx={{ py: 1.5 }}
              disabled={isLoading}
            >
              Work/Schoolアカウントでログイン
            </Button>

            <Divider sx={{ my: 2 }}>または</Divider>

            <Button
              variant="text"
              size="large"
              startIcon={<Microsoft />}
              onClick={handleGeneralLogin}
              fullWidth
              sx={{ py: 1.5 }}
              disabled={isLoading}
            >
              自動選択でログイン
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;
