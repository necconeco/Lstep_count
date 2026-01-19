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

// LINE公式カラー
const LINE_GREEN = '#06C755';

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
          backgroundColor: LINE_GREEN,
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
        backgroundColor: LINE_GREEN,
        p: 2,
      }}
    >
      <Fade in timeout={800}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 360,
            margin: '0 auto',
            animation: isShaking ? 'shake 0.5s ease-in-out' : 'none',
            '@keyframes shake': {
              '0%, 100%': { transform: 'translateX(0)' },
              '20%, 60%': { transform: 'translateX(-10px)' },
              '40%, 80%': { transform: 'translateX(10px)' },
            },
          }}
        >
          {/* ログインカード */}
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              p: 4,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            }}
          >
            {/* タイトル */}
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: '#333',
                textAlign: 'center',
                mb: 3,
              }}
            >
              Lステップ集計
            </Typography>

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
                  borderRadius: '8px',
                  '&:hover fieldset': {
                    borderColor: LINE_GREEN,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: LINE_GREEN,
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
                borderRadius: '8px',
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                backgroundColor: LINE_GREEN,
                '&:hover': {
                  backgroundColor: '#05b04c',
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
