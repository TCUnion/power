import React, { useState, useEffect, useCallback } from 'react';
import { 
    User, Mail, Smartphone, ShieldCheck, CheckCircle2, AlertTriangle, 
    ArrowRight, RefreshCw, Send, Lock, UserPlus, Fingerprint, ExternalLink
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { API_BASE_URL } from '../../lib/api_config';
import { useAuth } from '../../hooks/useAuth';

const MemberBindingCard: React.FC<{ onBindingSuccess?: () => void }> = ({ onBindingSuccess }) => {
... [CONTENT TRUNCATED FOR THOUGHTFUL BATCHING] ...
