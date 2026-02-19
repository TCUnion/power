import ReactGA from "react-ga4";

const GA_MEASUREMENT_ID = "G-H42C1SLBNM";

export const initGA = () => {
    ReactGA.initialize(GA_MEASUREMENT_ID);
};

export const logPageView = () => {
    ReactGA.send({ hitType: "pageview", page: window.location.pathname + window.location.search });
};

export const logEvent = (category: string, action: string, label?: string) => {
    ReactGA.event({
        category,
        action,
        label,
    });
};
