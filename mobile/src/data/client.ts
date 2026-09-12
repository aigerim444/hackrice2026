import { HttpRunwayApi } from './http/httpApi';
import { MockRunwayApi } from './mock/mockApi';
import type { RunwayApi } from './api';

/**
 * Picks the implementation.
 *
 * With no `EXPO_PUBLIC_API_URL` set the app runs entirely on the in-memory mock
 * — which is the state it ships in today. Set the variable (in `.env`, or in the
 * EAS build profile) and every screen is talking to a real server instead, with
 * no other change.
 */
const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export const api: RunwayApi = baseUrl ? new HttpRunwayApi(baseUrl) : new MockRunwayApi();

export const isMockApi = !baseUrl;
