import { router } from "expo-router";
import ProjectLeadFormSheet from "../components/ProjectLeadFormSheet";

export default function NewAcquisitionScreen() {
    return <ProjectLeadFormSheet onClose={() => router.back()} />;
}
