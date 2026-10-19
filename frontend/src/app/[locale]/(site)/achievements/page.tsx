import { createPublicPage } from "@/lib/public-page";

const route = createPublicPage("achievements");
export const generateMetadata = route.generateMetadata;
export default route.Page;
