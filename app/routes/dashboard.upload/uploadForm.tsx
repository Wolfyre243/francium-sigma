import React, { useState, useRef } from 'react';



// export function DocumentItem({
//     fileName, handleDelete, ref
// } : { fileName: string, handleDelete: any, ref: any }) {
//     // const rmFileBtnRef = useRef<HTMLButtonElement>(null);
    
//     return (
//         <div className='flex flex-row justify-between bg-tertiary rounded-lg px-4 py-2'>
//             <p>{fileName}</p>
//             <button onClick={handleDelete} type='button'>X</button>
//         </div>
//     );
// }


export default function UploadForm() {
    // Create a ref to the file input field
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<any>([]);

    const handleDrop = (event: any) => {
        event.preventDefault();
        // Assign dropped files to the file input field
        fileInputRef.current!.files = event.dataTransfer.files;
        // Set the dropped files to display
        let droppedFiles = event.dataTransfer.files;
        // TODO: Make sure files are added to the pile instead of refreshing the entire thing (do removal first)
        setFiles([
            ...droppedFiles
        ]);
    };

    const handleDragOver = (event: any) => {
        event.preventDefault();
    };

    const handleDelete = (event: any) => {
        const parent = event.target.parentElement;
        const index = parent.getAttribute('index-remove');
        if (index != null) {
            files.splice(index, 1);
            setFiles([ ...files ]);
        }
    }

    return (
        <form action="" className="flex flex-col gap-6 w-full justify-center items-start">
            {/* <label htmlFor="file_input" className="rounded-md px-3 py-1 bg-slate-500 cursor-pointer">
                Upload Document
            </label>
            <input id="file_input" type="file" name="file"/> */}
            <div id="dropArea" onDrop={handleDrop} onDragOver={handleDragOver}
            className='outline-dotted outline-2 outline-tertiary p-3 flex flex-col w-full h-full gap-3'>
            {
                files.length != 0 ? 
                files.map((file: any, index: number) => (
                    // TODO: Improve on file item ui, such as a better button
                    <div key={index} index-remove={index} className='flex flex-row justify-between bg-tertiary rounded-lg px-4 py-2'>
                        <p>{file.name}</p>
                        <button onClick={handleDelete} type='button'>X</button>
                    </div>
                )) :
                // This is the div for when no files are present
                <div>
                    <p>Drag and drop files here</p>
                    <p>Or Choose File</p>
                </div>
            }
            </div>
            <input ref={fileInputRef} type="file" name="file" multiple hidden/>

            <button type="submit" className="bg-accent text-primary px-3 py-1 rounded-md flex flex-row gap-2 items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
                </svg>
                <p className='text-lg'>Upload Files</p>
            </button>
        </form>
    );
}