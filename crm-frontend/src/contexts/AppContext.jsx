import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { equipment as equipApi, clients as clientApi, orders as orderApi, settings as settingsApi } from '../api/client.js';

const AppContext = createContext(null);

const initialState = {
  equipment: [],
  clients: [],
  orders: [],
  settings: {},
  loading: { equipment: false, clients: false, orders: false, settings: false },
  error: null,
  toast: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: { ...state.loading, [action.key]: action.value } };
    case 'SET_EQUIPMENT':
      return { ...state, equipment: action.data };
    case 'SET_CLIENTS':
      return { ...state, clients: action.data };
    case 'SET_ORDERS':
      return { ...state, orders: action.data };
    case 'SET_SETTINGS':
      return { ...state, settings: action.data };
    case 'TOAST':
      return { ...state, toast: action.payload };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    case 'SET_ERROR':
      return { ...state, error: action.message };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const toast = useCallback((message, type = 'success') => {
    dispatch({ type: 'TOAST', payload: { message, type } });
    setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3500);
  }, []);

  const load = useCallback(async (key, fn) => {
    dispatch({ type: 'SET_LOADING', key, value: true });
    try {
      const data = await fn();
      dispatch({ type: `SET_${key.toUpperCase()}`, data });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      dispatch({ type: 'SET_LOADING', key, value: false });
    }
  }, [toast]);

  const loadEquipment = useCallback(() => load('equipment', equipApi.list), [load]);
  const loadClients = useCallback(() => load('clients', clientApi.list), [load]);
  const loadOrders = useCallback(() => load('orders', orderApi.list), [load]);
  const loadSettings = useCallback(() => load('settings', settingsApi.get), [load]);

  useEffect(() => {
    loadEquipment();
    loadClients();
    loadOrders();
    loadSettings();
  }, []);

  return (
    <AppContext.Provider value={{
      state, dispatch, toast,
      loadEquipment, loadClients, loadOrders, loadSettings,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
