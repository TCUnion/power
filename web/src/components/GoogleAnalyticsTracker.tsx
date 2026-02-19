import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ReactGA from 'react-ga4';

const GoogleAnalyticsTracker = () => {
    const location = useLocation();
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        // Check if GA is already initialized to prevent multiple initializations
        // or rely on ReactGA's internal handling, but explicit check is safer for multiple mounts
        if (!window.GA_INITIALIZED) {
            ReactGA.initialize("G-H42C1SLBNM");
            window.GA_INITIALIZED = true;
            setInitialized(true);
        } else {
            setInitialized(true);
        }
    }, []);

    useEffect(() => {
        if (initialized) {
            ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
        }
    }, [initialized, location]);

    return null;
};

// Add typescript declaration for window property
declare global {
    interface Window {
        GA_INITIALIZED?: boolean;
    }
}

export default GoogleAnalyticsTracker;
