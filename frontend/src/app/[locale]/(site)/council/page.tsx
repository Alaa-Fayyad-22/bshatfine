import { createPlannedPage } from "@/lib/planned-page";

const planned = createPlannedPage("council");
export const generateMetadata = planned.generateMetadata;
export default planned.Page;
