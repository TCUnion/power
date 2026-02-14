export const highlightKeywords = (text: string): string => {
    if (!text) return text;

    let processedText = text;

    // Highlights distances (e.g., 304.6km, 30.5公里, 100k)
    processedText = processedText.replace(/(\d+(\.\d+)?\s*(km|公里|k)(?![a-zA-Z]))/gi, "**$1**");

    // Highlights Power (e.g., 115W-120W, 200W, 300watts)
    // Range handling: 115W-120W -> **115W**-**120W**
    processedText = processedText.replace(/(\d+(\.\d+)?\s*(w|W|watt|watts)(?![a-zA-Z]))/g, "**$1**");

    // Highlights Heart Rate (e.g., 130bpm)
    processedText = processedText.replace(/(\d+(\.\d+)?\s*(bpm)(?![a-zA-Z]))/gi, "**$1**");

    // Highlights Zones (e.g., Zone 2, Zone 3.5?)
    processedText = processedText.replace(/(Zone\s*\d+(\.\d+)?)/gi, "**$1**");

    // Highlights Time (e.g., 13小時, 30分鐘, 1 hr, 30min)
    processedText = processedText.replace(/(\d+(\.\d+)?\s*(hr|hrs|min|mins|小時|分鐘)(?![a-zA-Z]))/gi, "**$1**");

    return processedText;
};
