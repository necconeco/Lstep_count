import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Fade,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';

// パスワードのハッシュ値（SHA-256）
// 実際のパスワード: Lstep2025!
const PASSWORD_HASH = '20c7556cb6b986c8894c8035795d2e6e48e920a1b518775700f752e8f611cc2a';

// SHA-256 ハッシュを計算
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

interface PasswordGateProps {
  children: React.ReactNode;
}

export function PasswordGate({ children }: PasswordGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // 初期化時にセッションをチェック
  useEffect(() => {
    const checkSession = () => {
      const session = sessionStorage.getItem('lstep-authenticated');
      if (session === 'true') {
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('パスワードを入力してください');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    const inputHash = await sha256(password);

    if (inputHash === PASSWORD_HASH) {
      sessionStorage.setItem('lstep-authenticated', 'true');
      setIsAuthenticated(true);
    } else {
      setError('パスワードが正しくありません');
      setPassword('');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  // ローディング中
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            animation: 'spin 1s linear infinite',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            },
          }}
        />
      </Box>
    );
  }

  // 認証済み
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // パスワード入力画面
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: 2,
      }}
    >
      <Fade in timeout={800}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 380,
            animation: isShaking ? 'shake 0.5s ease-in-out' : 'none',
            '@keyframes shake': {
              '0%, 100%': { transform: 'translateX(0)' },
              '20%, 60%': { transform: 'translateX(-10px)' },
              '40%, 80%': { transform: 'translateX(10px)' },
            },
          }}
        >
          {/* ロゴ・タイトル */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              }}
            >
              <Typography
                sx={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: '#fff',
                }}
              >
                L
              </Typography>
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                color: '#fff',
                mb: 0.5,
                letterSpacing: '-0.5px',
              }}
            >
              Lステップ集計
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              アクセスにはパスワードが必要です
            </Typography>
          </Box>

          {/* フォーム */}
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              p: 4,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
          >
            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              error={!!error}
              helperText={error}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  backgroundColor: '#f8f9fa',
                  '& fieldset': {
                    borderColor: 'transparent',
                  },
                  '&:hover fieldset': {
                    borderColor: '#667eea',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#667eea',
                    borderWidth: '2px',
                  },
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{
                borderRadius: '12px',
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
                  boxShadow: '0 6px 20px rgba(102, 126, 234, 0.5)',
                },
              }}
            >
              ログイン
            </Button>
          </Box>
        </Box>
      </Fade>
    </Box>
  );
}
