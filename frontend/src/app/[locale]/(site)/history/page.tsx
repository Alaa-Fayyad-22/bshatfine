import { createPlannedPage } from "@/lib/planned-page";

const planned = createPlannedPage("history");
export const generateMetadata = planned.generateMetadata;
export default planned.Page;
