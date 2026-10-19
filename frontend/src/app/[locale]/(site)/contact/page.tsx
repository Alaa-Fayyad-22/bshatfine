import { createPlannedPage } from "@/lib/planned-page";

const planned = createPlannedPage("contact");
export const generateMetadata = planned.generateMetadata;
export default planned.Page;
