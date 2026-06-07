import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { User, AuthState, LoginCredentials, RegisterData } from '@/types';
import { authApi } from '@/services/api';

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,
};

export const loginUser = createAsyncThunk(
  'auth/login',
  async (creds: LoginCredentials, { rejectWithValue }) => {
    try {
      const res = await authApi.login(creds.email, creds.password);
      const { token, data } = res.data;
      localStorage.setItem('token', token);
      return { user: data as User, token };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (data: RegisterData, { rejectWithValue }) => {
    try {
      const res = await authApi.register(data);
      const { token, data: userData } = res.data;
      localStorage.setItem('token', token);
      return { user: userData as User, token };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Registration failed');
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  try { await authApi.logout(); } catch {}
  localStorage.removeItem('token');
});

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const res = await authApi.me();
      return res.data.data as User;
    } catch (err: any) {
      localStorage.removeItem('token');
      return rejectWithValue('Session expired');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) state.user = { ...state.user, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(loginUser.fulfilled, (s, a) => {
        s.isLoading = false; s.user = a.payload.user;
        s.token = a.payload.token; s.isAuthenticated = true;
      })
      .addCase(loginUser.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; })
      .addCase(registerUser.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(registerUser.fulfilled, (s, a) => {
        s.isLoading = false; s.user = a.payload.user;
        s.token = a.payload.token; s.isAuthenticated = true;
      })
      .addCase(registerUser.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; })
      .addCase(logoutUser.fulfilled, (s) => {
        s.user = null; s.token = null; s.isAuthenticated = false;
      })
      .addCase(fetchCurrentUser.pending, (s) => { s.isLoading = true; })
      .addCase(fetchCurrentUser.fulfilled, (s, a) => {
        s.isLoading = false; s.user = a.payload; s.isAuthenticated = true;
      })
      .addCase(fetchCurrentUser.rejected, (s) => {
        s.isLoading = false; s.user = null; s.token = null; s.isAuthenticated = false;
      });
  },
});

export const { clearError, updateUser } = authSlice.actions;
export default authSlice.reducer;
