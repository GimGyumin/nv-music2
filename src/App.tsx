/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import Login from './components/Login';
import Layout from './components/Layout';

export default function App() {
  const { isAuthenticated, theme } = useAuthStore();
  
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  if (!isAuthenticated) {
    return <Login />;
  }

  return <Layout />;
}

