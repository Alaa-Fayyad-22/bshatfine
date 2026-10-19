import { createPublicPage } from "@/lib/public-page";

const route = createPublicPage("services");
export const generateMetadata = route.generateMetadata;
export default route.Page;
