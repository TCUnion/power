import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/api_config';

const STORAGE_KEY = 'strava_athlete_data';
const BINDING_KEY = 'tcu_member_binding';
const AUTH_EVENT = 'strava-auth-change';

interface StravaAthlete {
    id: number;
    firstname: string;
    lastname: string;
    profile: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
}
... [CONTENT TRUNCATED FOR THOUGHTFUL BATCHING] ...
