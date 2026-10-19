import { createPublicPage } from "@/lib/public-page";

const route = createPublicPage("tourism");
export const generateMetadata = route.generateMetadata;
export default route.Page;
