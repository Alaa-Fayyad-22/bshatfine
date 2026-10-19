import { createPlannedPage } from "@/lib/planned-page";

const planned = createPlannedPage("events");
export const generateMetadata = planned.generateMetadata;
export default planned.Page;
