import React, { useState, useEffect, useRef } from 'react';
import { 
    Unlink, CheckCircle2, Loader2, Zap, LayoutDashboard, 
    ArrowLeftRight, AlertCircle, Info, ExternalLink, StravaLogo
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { API_BASE_URL } from '../../lib/api_config';
import { useAuth } from '../../hooks/useAuth';

const StravaConnect: React.FC = () => {
... [CONTENT TRUNCATED FOR THOUGHTFUL BATCHING] ...
