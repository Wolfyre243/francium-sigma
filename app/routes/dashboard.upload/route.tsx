import UploadForm from "./uploadForm";

export default function DashboardUpload() {
    return (
        <section className="text-white flex flex-col h-full items-center">
            <div className="text-center my-10">
                <h1 className="text-3xl mb-3">Upload Files</h1>
                <p>Place notes here to be digested by Alyssa</p>
            </div>
            <div className="w-2/3 h-2/3 flex justify-center bg-primary p-6 rounded-xl">
                <UploadForm />
            </div>
        </section>
    );
}