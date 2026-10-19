import { createPlannedPage } from "@/lib/planned-page";

const planned = createPlannedPage("gallery");
export const generateMetadata = planned.generateMetadata;
export default planned.Page;
