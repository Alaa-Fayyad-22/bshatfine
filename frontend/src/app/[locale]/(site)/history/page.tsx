import { createPublicPage } from "@/lib/public-page";

const route = createPublicPage("history");
export const generateMetadata = route.generateMetadata;
export default route.Page;
