import { createPlannedPage } from "@/lib/planned-page";

const planned = createPlannedPage("tourism");
export const generateMetadata = planned.generateMetadata;
export default planned.Page;
