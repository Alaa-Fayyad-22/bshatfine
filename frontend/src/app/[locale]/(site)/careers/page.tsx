import { createPlannedPage } from "@/lib/planned-page";

const planned = createPlannedPage("careers");
export const generateMetadata = planned.generateMetadata;
export default planned.Page;
