import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load .env manually
const envPath = '.env';
let envVars = {};
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envVars = envContent.split('\n').reduce((acc, line) => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            acc[key] = value;
        }
        return acc;
    }, {});
}

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

async function check() {
    // 1. Get Activity to find Athlete ID
    const { data: act, error: actError } = await supabase
        .from('strava_activities')
        .select('athlete_id')
        .eq('name', 'NEKO王功之空間迷航😂')
        .maybeSingle();

    if (actError || !act) {
        console.log('Activity query failed or not found.');
        return;
    }

    const athleteId = act.athlete_id;
    console.log('Athlete ID:', athleteId);

    // 2. Check Athlete Table
    const { data: ath, error: athError } = await supabase
        .from('athletes')
        .select('*')
        .eq('id', athleteId) // Assuming id matches strava athlete id OR strava_athlete_id
        .maybeSingle();

    if (athError) {
        // Try searching by another column if id doesn't match? 
        // Usually athletes.id is UUID? And strava_athlete_id is separate?
        console.log('Athlete fetch by ID error:', athError);

        // Try listing athletes to see schema
        const { data: athList } = await supabase.from('athletes').select('*').limit(1);
        if (athList && athList.length > 0) {
            console.log('Athletes table columns:', Object.keys(athList[0]));
        }
        return;
    }

    if (ath) {
        console.log('Athlete Found.');
        console.log('Columns:', Object.keys(ath));
        if (ath.zones) console.log('Athlete has ZONES!');
        if (ath.heart_rate_zones) console.log('Athlete has HEART_RATE_ZONES!');
        // Check raw_data or similar in athlete
    } else {
        console.log('Athlete NOT found by ID ' + athleteId);
        // Try query by strava_id matching athlete_id?
    }
}

check();
