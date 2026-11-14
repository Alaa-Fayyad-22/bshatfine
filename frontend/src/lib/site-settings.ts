import { cache } from "react";
import { getSiteSettings } from "./api";

// The saved contact details, read live. Several parts of one page need them
// (footer, contact column, emergency number, social links): React's cache()
// makes that a single request per page render.
export const getSettings = cache(getSiteSettings);
