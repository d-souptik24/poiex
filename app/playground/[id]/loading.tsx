import LoadingStep from "@/modules/playground/components/loader";

export default function PlaygroundLoading() {
    return (
        <div className="flex flex-1 w-full min-h-screen flex-col items-center justify-center bg-background">
            <LoadingStep
                currentStep={1}
                step={1}
                label="Loading project playground..."
                description="Preparing your editor, files, and runtime environment..."
            />
        </div>
    );
}
