import { create } from 'zustand';
import axios from 'axios';

interface VendorUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator';
}

interface VendorAuthState {
  isAuthenticated: boolean;
  user: VendorUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => void;
}

export const useVendorAuthStore = create<VendorAuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  token: null,

  login: async (email: string, password: string) => {
    try {
      const response = await axios.post('/api/vendor/auth/login', {
        email,
        password,
      });

      if (response.data.success) {
        const { token, user } = response.data.data;
        
        localStorage.setItem('vendorToken', token);
        
        // Configure axios defaults
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        set({
          isAuthenticated: true,
          user,
          token,
        });

        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('vendorToken');
    delete axios.defaults.headers.common['Authorization'];
    
    set({
      isAuthenticated: false,
      user: null,
      token: null,
    });
  },

  checkAuth: () => {
    const token = localStorage.getItem('vendorToken');
    
    if (token) {
      // Configure axios defaults
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // In a real app, you'd validate the token with the server
      set({
        isAuthenticated: true,
        token,
        // You'd fetch user data from the server here
        user: {
          id: 'vendor_1',
          email: 'admin@vendor.com',
          name: 'Vendor Admin',
          role: 'admin'
        }
      });
    }
  },
})); 